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
    [25, 50],
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
  it.each([
    ['manual', TM_CLASSES.CORRECT, 0.92, 'Correct Posture'],
    ['auto', TM_CLASSES.INCORRECT, 0.85, 'Incorrect Posture']
  ])('keeps label, confidence, keypoints and score from the captured inference for %s capture', (
    captureSource,
    className,
    confidence,
    expectedLabel
  ) => {
    const poseFrame = {
      hasPerson: true,
      aiSource: 'teachable-machine',
      keypoints: keypointsAtAngle(25),
      modelPrediction: { className, probability: confidence }
    };
    const capturedAt = '2026-11-24T11:00:00.000Z';
    const record = buildCaptureRecord({
      poseFrame,
      image: 'data:image/jpeg;base64,snapshot',
      capturedAt,
      captureSource,
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      sessionId: 'session_test',
      frameId: captureSource,
      thresholds: {}
    });

    expect(record.predictionLabel).toBe(expectedLabel);
    expect(record.status).toBe(expectedLabel);
    expect(record.confidence).toBe(confidence);
    expect(record.postureScore).toBe(50);
    expect(record.keypoints).toBe(poseFrame.keypoints);
    expect(record.image).toBe('data:image/jpeg;base64,snapshot');
    expect(record.capturedAt).toBe(capturedAt);
    expect(record.capture_source).toBe(captureSource);
  });

  it('keeps a valid label but stores NULL confidence and score when source data is invalid', () => {
    const assessment = getCaptureAssessment({
      hasPerson: true,
      keypoints: {},
      modelPrediction: { className: TM_CLASSES.CORRECT, probability: 1.01 }
    }, frameSize.width, frameSize.height);

    expect(assessment.predictionLabel).toBe('Correct Posture');
    expect(assessment.confidence).toBeNull();
    expect(assessment.postureScore).toBeNull();
  });
});
