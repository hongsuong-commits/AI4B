import { KEYPOINT_NAMES } from '../ai/aiContract.js';
import { DEFAULT_THRESHOLDS, STATUS_KEY, VIEW_ANGLES } from '../constants/postureConfig.js';
import { calculatePostureMetrics } from './postureGeometry.js';

export const PREDICTION_LABELS = {
  CORRECT: 'Correct Posture',
  INCORRECT: 'Incorrect Posture'
};

export function normalizePredictionLabel(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  if (value === STATUS_KEY.INCORRECT || normalized.includes('incorrect') || normalized.includes('sai') || normalized.includes('bad') || normalized.includes('slouch') || normalized.includes('hunch')) {
    return PREDICTION_LABELS.INCORRECT;
  }
  if (value === STATUS_KEY.CORRECT || normalized.includes('correct') || normalized.includes('dung') || normalized.includes('good') || normalized.includes('straight')) {
    return PREDICTION_LABELS.CORRECT;
  }
  return null;
}

function getValidNeckPair(keypoints, frameWidth, frameHeight) {
  if (!keypoints || !Number.isFinite(frameWidth) || !Number.isFinite(frameHeight) || frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }

  const pairs = [
    [KEYPOINT_NAMES.LEFT_EAR, KEYPOINT_NAMES.LEFT_SHOULDER],
    [KEYPOINT_NAMES.RIGHT_EAR, KEYPOINT_NAMES.RIGHT_SHOULDER]
  ];
  const valid = pairs.map(([earName, shoulderName]) => {
    const ear = keypoints[earName];
    const shoulder = keypoints[shoulderName];
    if (!ear || !shoulder ||
      !Number.isFinite(ear.x) || !Number.isFinite(ear.y) ||
      !Number.isFinite(shoulder.x) || !Number.isFinite(shoulder.y) ||
      !Number.isFinite(ear.score) || !Number.isFinite(shoulder.score) ||
      ear.score < 0.25 || shoulder.score < 0.25 ||
      ear.x < 0 || ear.x > 1 || ear.y < 0 || ear.y > 1 ||
      shoulder.x < 0 || shoulder.x > 1 || shoulder.y < 0 || shoulder.y > 1) {
      return null;
    }
    return {
      ear,
      shoulder,
      confidence: Math.min(ear.score, shoulder.score)
    };
  }).filter(Boolean);

  return valid.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

export function calculateNeckPostureScore(keypoints, frameWidth, frameHeight) {
  const pair = getValidNeckPair(keypoints, frameWidth, frameHeight);
  if (!pair) return null;

  const dx = Math.abs(pair.ear.x - pair.shoulder.x) * frameWidth;
  const dy = Math.abs(pair.ear.y - pair.shoulder.y) * frameHeight;
  if (Math.hypot(dx, dy) === 0) return null;

  const neckAngle = Math.atan2(dx, dy) * (180 / Math.PI);
  let postureScore;
  if (neckAngle <= 15) postureScore = 100;
  else if (neckAngle >= 45) postureScore = 0;
  else postureScore = 100 - ((neckAngle - 15) / (45 - 15)) * 100;

  return {
    postureScore: Math.round(postureScore * 10) / 10,
    neckAngle: Math.round(neckAngle * 10) / 10
  };
}

export function getCaptureAssessment(poseFrame, frameWidth, frameHeight, thresholds = {}) {
  const prediction = poseFrame?.modelPrediction;
  const predictionLabel = normalizePredictionLabel(prediction?.className);
  if (!poseFrame?.hasPerson || !predictionLabel) return null;

  const confidence = Number.isFinite(prediction.probability) &&
    prediction.probability >= 0 && prediction.probability <= 1
    ? prediction.probability
    : null;
  const posture = calculateNeckPostureScore(poseFrame.keypoints, frameWidth, frameHeight);
  const minimumProbability = thresholds.tmMinProbability ?? DEFAULT_THRESHOLDS.tmMinProbability;
  const modelIncorrect = predictionLabel === PREDICTION_LABELS.INCORRECT && confidence !== null && confidence >= minimumProbability;
  const isIncorrect = modelIncorrect || (posture?.neckAngle !== null && posture?.neckAngle !== undefined && posture.neckAngle > 15);

  return {
    className: prediction.className,
    predictionLabel,
    status: isIncorrect ? STATUS_KEY.INCORRECT : STATUS_KEY.CORRECT,
    isIncorrect,
    confidence,
    postureScore: posture?.postureScore ?? null,
    neckAngle: posture?.neckAngle ?? null,
    keypoints: poseFrame.keypoints || null
  };
}

export function buildCaptureRecord({
  poseFrame,
  image,
  capturedAt,
  captureSource,
  frameWidth,
  frameHeight,
  sessionId,
  frameId,
  thresholds
}) {
  const assessment = getCaptureAssessment(poseFrame, frameWidth, frameHeight, thresholds);
  if (!assessment) return null;

  const metrics = poseFrame.keypoints
    ? calculatePostureMetrics({
        keypoints: poseFrame.keypoints,
        viewAngle: VIEW_ANGLES.FRONT,
        thresholds: { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) }
      })?.metrics || {}
    : {};

  return {
    captureId: poseFrame.captureId || null,
    sessionId,
    frameId,
    source: captureSource,
    capture_source: captureSource,
    aiSource: poseFrame.aiSource || 'teachable-machine',
    viewAngle: 'front',
    status: assessment.status,
    className: assessment.className,
    predictionLabel: assessment.predictionLabel,
    confidence: assessment.confidence,
    postureScore: assessment.postureScore,
    keypoints: assessment.keypoints,
    metrics: { ...metrics, neckAngle: assessment.neckAngle },
    violations: assessment.isIncorrect ? ['MODEL_INCORRECT'] : [],
    image: image || null,
    capturedAt
  };
}
