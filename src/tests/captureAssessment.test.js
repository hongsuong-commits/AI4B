import { describe, expect, it } from 'vitest';
import { buildCaptureRecord, calculateNeckPostureScore, getCaptureAssessment } from '../services/captureAssessment.js';
import { TM_CLASSES } from '../constants/postureConfig.js';

const frameSize = { width: 640, height: 480 };

function keypointsAtAngle(angle, score = 0.9) {
  const shoulder = { x: 0.4, y: 0.65, score };
  const dyPixels = 200;
  const dxPixels = Math.tan((angle * Math.PI) / 180) * dyPixels;
  return {
    leftEar: {
      x: shoulder.x + dxPixels / frameSize.width,
      y: shoulder.y - dyPixels / frameSize.height,
      score
    },
    leftShoulder: shoulder
  };
}

describe('posture score from same-side ear and shoulder keypoints', () => {
  it.each([
    [5, 100],
    [25, 66.7],
    [45, 0]
  ])('maps %i degrees to %i points', (angle, expectedScore) => {
    expect(calculateNeckPostureScore(keypointsAtAngle(angle), frameSize.width, frameSize.height)?.postureScore)
      .toBe(expectedScore);
  });

  it('returns no score when the same-side pair or keypoint confidence is invalid', () => {
    expect(calculateNeckPostureScore({
      rightEar: { x: 0.4, y: 0.2, score: 0.9 },
      leftShoulder: { x: 0.4, y: 0.6, score: 0.9 }
    }, frameSize.width, frameSize.height)).toBeNull();
    expect(calculateNeckPostureScore(keypointsAtAngle(10, 0.24), frameSize.width, frameSize.height)).toBeNull();
    expect(calculateNeckPostureScore({}, frameSize.width, frameSize.height)).toBeNull();
  });
});

describe('manual and automatic capture assessment', () => {
  it('preserves inference data and confidence in manual and automatic capture payloads', () => {
    for (const captureSource of ['manual', 'auto']) {
      for (const confidence of [0.93, 0.87, 0.996, 1.00]) {
        const capturedAt = '2026-11-24T11:00:00.000Z';
        const className = captureSource === 'manual' ? TM_CLASSES.CORRECT : TM_CLASSES.INCORRECT;
        const poseFrame = {
          hasPerson: true,
          aiSource: 'teachable-machine',
          inferenceId: `inference-${captureSource}-${confidence}`,
          inferenceTimestamp: capturedAt,
          probabilities: [1 - confidence, confidence],
          confidence,
          inputFrame: {},
          keypoints: keypointsAtAngle(5),
          modelPrediction: { className: TM_CLASSES.CORRECT, probability: confidence }
        };
        poseFrame.modelPrediction.className = className;
        const record = buildCaptureRecord({
          poseFrame,
          image: 'snapshot',
          capturedAt,
          captureSource,
          frameWidth: frameSize.width,
          frameHeight: frameSize.height,
          sessionId: 'session_test',
          frameId: `${captureSource}-${confidence}`,
          thresholds: {}
        });

        expect(record.confidence).toBe(confidence);
        expect(record.capture_source).toBe(captureSource);
        expect(record.inferenceId).toBe(`inference-${captureSource}-${confidence}`);
        expect(record.inferenceTimestamp).toBe(capturedAt);
        expect(record.keypoints).toBe(poseFrame.keypoints);
        expect(record.image).toBe('snapshot');
        expect(record.status).toBe(captureSource === 'manual' ? 'Correct Posture' : 'Incorrect Posture');
      }
    }
  });

  it('rejects a capture inference with invalid confidence', () => {
    const assessment = getCaptureAssessment({
      hasPerson: true,
      keypoints: {},
      confidence: 1.01,
      inferenceId: 'invalid-inference',
      inputFrame: {},
      probabilities: [0, 1.01],
      modelPrediction: { className: TM_CLASSES.CORRECT, probability: 1.01 }
    }, frameSize.width, frameSize.height);

    expect(assessment).toBeNull();
  });
});
