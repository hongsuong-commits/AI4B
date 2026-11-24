import { describe, expect, it } from 'vitest';
import { evaluatePosture } from '../services/postureGeometry.js';
import { STATUS_KEY, VIOLATIONS, DEFAULT_THRESHOLDS } from '../constants/postureConfig.js';

const metrics = (values) => ({
  isValid: true,
  metrics: {
    shoulderBalance: 1,
    trunkLean: 1,
    neckAngle: null,
    backAngle: null,
    headOffsetPercent: null,
    headPositionLabel: '—',
    ...values
  }
});

describe('AI Classification & Posture Scoring (Binary: Đúng / Sai)', () => {
  it('classifies MediaPipe geometry within and beyond configured limits', () => {
    const correct = evaluatePosture({ metricsResult: metrics({ shoulderBalance: 2, trunkLean: 3 }), thresholds: DEFAULT_THRESHOLDS, aiSource: 'mediapipe' });
    expect(correct.status).toBe(STATUS_KEY.CORRECT);
    expect(correct.violations).toHaveLength(0);

    const incorrect = evaluatePosture({ metricsResult: metrics({ neckAngle: 25, backAngle: 2, headOffsetPercent: 4 }), thresholds: DEFAULT_THRESHOLDS, aiSource: 'mediapipe' });
    expect(incorrect.status).toBe(STATUS_KEY.INCORRECT);
    expect(incorrect.violations).toContain(VIOLATIONS.FORWARD_HEAD);
  });

  it('combines Teachable Machine predictions with geometry for correct and incorrect classes', () => {
    const correct = evaluatePosture({
      metricsResult: metrics({}), thresholds: DEFAULT_THRESHOLDS, aiSource: 'teachable-machine',
      teachableMachinePrediction: { className: 'Đúng tư thế', probability: 0.95 }
    });
    expect(correct.status).toBe(STATUS_KEY.CORRECT);
    expect(correct.violations).toHaveLength(0);

    const incorrect = evaluatePosture({
      metricsResult: metrics({}), thresholds: DEFAULT_THRESHOLDS, aiSource: 'teachable-machine',
      teachableMachinePrediction: { className: 'Sai tư thế', probability: 0.92 }
    });
    expect(incorrect.status).toBe(STATUS_KEY.INCORRECT);
    expect(incorrect.violations).toContain(VIOLATIONS.MODEL_INCORRECT);
  });
});
