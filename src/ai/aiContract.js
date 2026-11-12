// Hợp đồng dữ liệu chung (Shared Data Contract) cho các bộ nhận diện AI

export const KEYPOINT_NAMES = {
  NOSE: 'nose',
  LEFT_EYE: 'leftEye',
  RIGHT_EYE: 'rightEye',
  LEFT_EAR: 'leftEar',
  RIGHT_EAR: 'rightEar',
  LEFT_SHOULDER: 'leftShoulder',
  RIGHT_SHOULDER: 'rightShoulder',
  LEFT_ELBOW: 'leftElbow',
  RIGHT_ELBOW: 'rightElbow',
  LEFT_WRIST: 'leftWrist',
  RIGHT_WRIST: 'rightWrist',
  LEFT_HIP: 'leftHip',
  RIGHT_HIP: 'rightHip'
};

// Các đoạn nối khung xương để vẽ Canvas trực quan
export const SKELETON_CONNECTIONS = [
  // Đầu và mặt
  [KEYPOINT_NAMES.LEFT_EAR, KEYPOINT_NAMES.LEFT_EYE],
  [KEYPOINT_NAMES.LEFT_EYE, KEYPOINT_NAMES.NOSE],
  [KEYPOINT_NAMES.NOSE, KEYPOINT_NAMES.RIGHT_EYE],
  [KEYPOINT_NAMES.RIGHT_EYE, KEYPOINT_NAMES.RIGHT_EAR],

  // Cặp vai và thân trên
  [KEYPOINT_NAMES.LEFT_SHOULDER, KEYPOINT_NAMES.RIGHT_SHOULDER],
  [KEYPOINT_NAMES.LEFT_SHOULDER, KEYPOINT_NAMES.LEFT_HIP],
  [KEYPOINT_NAMES.RIGHT_SHOULDER, KEYPOINT_NAMES.RIGHT_HIP],
  [KEYPOINT_NAMES.LEFT_HIP, KEYPOINT_NAMES.RIGHT_HIP],

  // Tay trái
  [KEYPOINT_NAMES.LEFT_SHOULDER, KEYPOINT_NAMES.LEFT_ELBOW],
  [KEYPOINT_NAMES.LEFT_ELBOW, KEYPOINT_NAMES.LEFT_WRIST],

  // Tay phải
  [KEYPOINT_NAMES.RIGHT_SHOULDER, KEYPOINT_NAMES.RIGHT_ELBOW],
  [KEYPOINT_NAMES.RIGHT_ELBOW, KEYPOINT_NAMES.RIGHT_WRIST]
];

/**
 * Tạo một đối tượng khớp chuẩn hóa
 */
export function createKeypoint(name, x, y, score = 0, z = 0) {
  return {
    name,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0,
    score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0
  };
}

/**
 * Tạo kết quả chuẩn hóa theo hợp đồng dữ liệu chung
 */
export function createStandardPoseFrame({
  timestamp = performance.now(),
  aiSource = 'mediapipe',
  keypoints = {},
  hasPerson = false,
  minConfidence = 0,
  modelPrediction = null,
  raw = null
} = {}) {
  return {
    timestamp,
    aiSource,
    keypoints,
    hasPerson,
    minConfidence: Math.round(minConfidence * 100), // Quy ra % (0-100)
    modelPrediction, // Chỉ có khi dùng Teachable Machine { className, probability, allPredictions }
    raw
  };
}
