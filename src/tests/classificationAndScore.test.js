import { describe, it, expect } from 'vitest';
import { evaluatePosture } from '../services/postureGeometry.js';
import {
  STATUS_KEY,
  VIOLATIONS,
  DEFAULT_THRESHOLDS
} from '../constants/postureConfig.js';

describe('AI Classification & Posture Scoring (Binary: Đúng / Sai)', () => {
  it('MediaPipe: returns CORRECT when all metrics are within thresholds', () => {
    const result = evaluatePosture({
      metricsResult: {
        isValid: true,
        metrics: {
          shoulderBalance: 2.0, // < 5.0
          trunkLean: 3.0,       // < 8.0
          neckAngle: null,
          backAngle: null,
          headOffsetPercent: null,
          headPositionLabel: '—'
        }
      },
      thresholds: DEFAULT_THRESHOLDS,
      aiSource: 'mediapipe'
    });

    expect(result.status).toBe(STATUS_KEY.CORRECT);
    expect(result.violations).toHaveLength(0);
    expect(result.postureScore).toBeGreaterThanOrEqual(80);
  });

  it('MediaPipe: returns INCORRECT when neck tilt exceeds threshold', () => {
    const result = evaluatePosture({
      metricsResult: {
        isValid: true,
        metrics: {
          neckAngle: 25.0, // diff = 25 > 10 (threshold)
          backAngle: 2.0,
          headOffsetPercent: 4.0,
          shoulderBalance: null,
          trunkLean: null,
          headPositionLabel: 'thẳng hàng'
        }
      },
      thresholds: DEFAULT_THRESHOLDS,
      aiSource: 'mediapipe'
    });

    expect(result.status).toBe(STATUS_KEY.INCORRECT);
    expect(result.violations).toContain(VIOLATIONS.FORWARD_HEAD);
  });

  it('Teachable Machine: returns CORRECT when model predicts Correct and geometry passes', () => {
    const result = evaluatePosture({
      metricsResult: {
        isValid: true,
        metrics: {
          shoulderBalance: 1.0,
          trunkLean: 1.0,
          neckAngle: null,
          backAngle: null,
          headOffsetPercent: null,
          headPositionLabel: '—'
        }
      },
      thresholds: DEFAULT_THRESHOLDS,
      aiSource: 'teachable-machine',
      teachableMachinePrediction: {
        className: 'Đúng tư thế',
        probability: 0.95
      }
    });

    expect(result.status).toBe(STATUS_KEY.CORRECT);
    expect(result.violations).toHaveLength(0);
  });

  it('Teachable Machine: returns INCORRECT when model predicts Incorrect', () => {
    const result = evaluatePosture({
      metricsResult: {
        isValid: true,
        metrics: {
          shoulderBalance: 1.0,
          trunkLean: 1.0,
          neckAngle: null,
          backAngle: null,
          headOffsetPercent: null,
          headPositionLabel: '—'
        }
      },
      thresholds: DEFAULT_THRESHOLDS,
      aiSource: 'teachable-machine',
      teachableMachinePrediction: {
        className: 'Sai tư thế',
        probability: 0.92
      }
    });

    expect(result.status).toBe(STATUS_KEY.INCORRECT);
    expect(result.violations).toContain(VIOLATIONS.MODEL_INCORRECT);
  });
});
