import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateMedian,
  validateKeypoints,
  verifyCameraAngle,
  calculatePostureMetrics,
  evaluatePosture,
  calculateCalibrationBaseline
} from '../services/postureGeometry.js';
import { KEYPOINT_NAMES } from '../ai/aiContract.js';
import {
  VIEW_ANGLES,
  FACING_DIRECTIONS,
  DEFAULT_THRESHOLDS,
  STATUS_KEY,
  VIOLATIONS
} from '../constants/postureConfig.js';

describe('Posture Geometry & Measurements', () => {
  it('calculateDistance returns correct euclidean distance', () => {
    expect(calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(calculateDistance(null, { x: 1, y: 1 })).toBe(0);
  });

  it('calculateMedian returns correct median for odd and even arrays', () => {
    expect(calculateMedian([5, 1, 9])).toBe(5);
    expect(calculateMedian([10, 20, 30, 40])).toBe(25);
    expect(calculateMedian([])).toBe(0);
  });

  it('validateKeypoints checks missing joints and minimum confidence', () => {
    const keypoints = {
      [KEYPOINT_NAMES.LEFT_SHOULDER]: { x: 0.3, y: 0.4, score: 0.9 },
      [KEYPOINT_NAMES.RIGHT_SHOULDER]: { x: 0.7, y: 0.4, score: 0.8 },
      [KEYPOINT_NAMES.LEFT_HIP]: { x: 0.35, y: 0.8, score: 0.3 } // low score
    };

    const res = validateKeypoints(
      keypoints,
      [KEYPOINT_NAMES.LEFT_SHOULDER, KEYPOINT_NAMES.RIGHT_SHOULDER, KEYPOINT_NAMES.LEFT_HIP],
      0.5
    );

    expect(res.valid).toBe(false);
    expect(res.missing).toContain(KEYPOINT_NAMES.LEFT_HIP);
    expect(res.minConf).toBe(0.3);
  });

  it('calculates Front View metrics correctly (shoulder balance & trunk lean)', () => {
    // Perfectly level shoulders, perfectly vertical trunk
    const keypoints = {
      [KEYPOINT_NAMES.LEFT_SHOULDER]: { x: 0.3, y: 0.4, score: 0.9 },
      [KEYPOINT_NAMES.RIGHT_SHOULDER]: { x: 0.7, y: 0.4, score: 0.9 },
      [KEYPOINT_NAMES.LEFT_HIP]: { x: 0.35, y: 0.8, score: 0.9 },
      [KEYPOINT_NAMES.RIGHT_HIP]: { x: 0.65, y: 0.8, score: 0.9 }
    };

    const res = calculatePostureMetrics({
      keypoints,
      viewAngle: VIEW_ANGLES.FRONT,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(res.isValid).toBe(true);
    expect(res.metrics.shoulderBalance).toBeCloseTo(0, 1);
    expect(res.metrics.trunkLean).toBeCloseTo(0, 1);
  });

  it('calculates Side View metrics correctly (neck angle, back angle, head position)', () => {
    // Facing left: ear is forward of shoulder by dx = -0.05
    const keypoints = {
      [KEYPOINT_NAMES.LEFT_EAR]: { x: 0.45, y: 0.2, score: 0.9 },
      [KEYPOINT_NAMES.LEFT_SHOULDER]: { x: 0.5, y: 0.35, score: 0.9 },
      [KEYPOINT_NAMES.LEFT_HIP]: { x: 0.5, y: 0.75, score: 0.9 }
    };

    const res = calculatePostureMetrics({
      keypoints,
      viewAngle: VIEW_ANGLES.SIDE,
      facingDirection: FACING_DIRECTIONS.LEFT,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(res.isValid).toBe(true);
    // Ear forward of shoulder produces positive neck angle
    expect(res.metrics.neckAngle).toBeGreaterThan(0);
    expect(res.metrics.backAngle).toBeCloseTo(0, 1);
    expect(res.metrics.headOffsetPercent).toBeGreaterThan(0);
  });

  it('computes postureScore accurately using Math.round(Math.max(0, 100 - 30 * r))', () => {
    // Perfect posture: r = 0 -> score = 100
    const perfectEval = evaluatePosture({
      metricsResult: {
        isValid: true,
        metrics: {
          shoulderBalance: 0,
          trunkLean: 0,
          neckAngle: null,
          backAngle: null,
          headOffsetPercent: null,
          headPositionLabel: '—'
        }
      },
      viewAngle: VIEW_ANGLES.FRONT,
      baseline: { shoulderBalance: 0, trunkLean: 0 },
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(perfectEval.status).toBe(STATUS_KEY.CORRECT);
    expect(perfectEval.postureScore).toBe(100);
    expect(perfectEval.violations.length).toBe(0);

    // Shoulder tilt = 10° when threshold is 5° -> r = 10/5 = 2.0 -> score = 100 - 30*2 = 40
    const tiltedEval = evaluatePosture({
      metricsResult: {
        isValid: true,
        metrics: {
          shoulderBalance: 10,
          trunkLean: 0,
          neckAngle: null,
          backAngle: null,
          headOffsetPercent: null,
          headPositionLabel: '—'
        }
      },
      viewAngle: VIEW_ANGLES.FRONT,
      baseline: { shoulderBalance: 0, trunkLean: 0 },
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(tiltedEval.status).toBe(STATUS_KEY.INCORRECT);
    expect(tiltedEval.violations).toContain(VIOLATIONS.UNEVEN_SHOULDERS);
    expect(tiltedEval.postureScore).toBe(40);
  });

  it('calculateCalibrationBaseline computes medians for collected samples', () => {
    const samples = [
      { shoulderBalance: 2, trunkLean: 1 },
      { shoulderBalance: 4, trunkLean: 3 },
      { shoulderBalance: 1, trunkLean: 2 }
    ];

    const baseline = calculateCalibrationBaseline(samples, VIEW_ANGLES.FRONT);
    expect(baseline.shoulderBalance).toBe(2);
    expect(baseline.trunkLean).toBe(2);
    expect(baseline.viewAngle).toBe(VIEW_ANGLES.FRONT);
  });
});
