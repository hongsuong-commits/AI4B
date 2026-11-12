import {
  STATUS_KEY,
  VIOLATIONS,
  VIEW_ANGLES,
  FACING_DIRECTIONS
} from '../constants/postureConfig.js';
import { KEYPOINT_NAMES } from '../ai/aiContract.js';

/**
 * Tính khoảng cách Euclid giữa 2 điểm
 */
export function calculateDistance(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = (p1.x || 0) - (p2.x || 0);
  const dy = (p1.y || 0) - (p2.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Tính trung vị (median) của một mảng số thực
 */
export function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Kiểm tra các khớp bắt buộc có trong khung hình và đạt ngưỡng tin cậy không
 */
export function validateKeypoints(keypoints, requiredJoints, minConfidence = 0.5) {
  if (!keypoints) return { valid: false, minConf: 0, missing: requiredJoints };

  let minConf = 1.0;
  const missing = [];

  for (const joint of requiredJoints) {
    const pt = keypoints[joint];
    if (!pt) {
      missing.push(joint);
      minConf = 0;
      continue;
    }

    const conf = pt.score !== undefined ? pt.score : 1.0;
    if (conf < minConfidence) {
      missing.push(joint);
    }
    if (conf < minConf) {
      minConf = conf;
    }
  }

  return {
    valid: missing.length === 0,
    minConf,
    missing
  };
}

/**
 * Kiểm tra sơ bộ góc quan sát camera (chính diện vs nhìn nghiêng)
 */
export function verifyCameraAngle(keypoints, viewAngle, facingDirection) {
  if (!keypoints) return { valid: false, reason: 'Không có dữ liệu khớp' };

  const ls = keypoints[KEYPOINT_NAMES.LEFT_SHOULDER];
  const rs = keypoints[KEYPOINT_NAMES.RIGHT_SHOULDER];
  const lh = keypoints[KEYPOINT_NAMES.LEFT_HIP];
  const rh = keypoints[KEYPOINT_NAMES.RIGHT_HIP];

  if (viewAngle === VIEW_ANGLES.FRONT) {
    if (!ls || !rs || !lh || !rh) {
      return { valid: false, reason: 'Chưa thấy đủ hai vai và hai hông' };
    }
    const shoulderWidth = calculateDistance(ls, rs);
    const leftTrunk = calculateDistance(ls, lh);
    const rightTrunk = calculateDistance(rs, rh);
    const avgTrunk = (leftTrunk + rightTrunk) / 2;

    // Trong góc chính diện, khoảng cách ngang hai vai phải đủ mở (> 0.25 chiều dài thân)
    if (avgTrunk > 0 && shoulderWidth / avgTrunk < 0.25) {
      return { valid: false, reason: 'Góc camera quá hẹp hoặc bạn đang ngồi quay nghiêng' };
    }
    return { valid: true };
  } else {
    // Nhìn nghiêng (Side View)
    const isLeft = facingDirection === FACING_DIRECTIONS.LEFT;
    const ear = isLeft ? keypoints[KEYPOINT_NAMES.LEFT_EAR] : keypoints[KEYPOINT_NAMES.RIGHT_EAR];
    const shoulder = isLeft ? keypoints[KEYPOINT_NAMES.LEFT_SHOULDER] : keypoints[KEYPOINT_NAMES.RIGHT_SHOULDER];
    const hip = isLeft ? keypoints[KEYPOINT_NAMES.LEFT_HIP] : keypoints[KEYPOINT_NAMES.RIGHT_HIP];

    if (!ear || !shoulder || !hip) {
      return { valid: false, reason: `Chưa thấy đủ tai, vai, hông phía ${isLeft ? 'trái' : 'phải'}` };
    }
    const trunkLen = calculateDistance(shoulder, hip);
    if (trunkLen < 0.05) {
      return { valid: false, reason: 'Khoảng cách vai–hông quá nhỏ' };
    }
    return { valid: true };
  }
}

/**
 * Đo các chỉ số tư thế từ tập khớp
 */
export function calculatePostureMetrics({
  keypoints,
  viewAngle,
  facingDirection = FACING_DIRECTIONS.LEFT,
  baseline = null,
  thresholds
}) {
  const isFront = viewAngle === VIEW_ANGLES.FRONT;
  const isSide = viewAngle === VIEW_ANGLES.SIDE;

  let neckAngle = null;
  let backAngle = null;
  let shoulderBalance = null;
  let trunkLean = null;
  let headOffsetPercent = null;
  let headPositionLabel = '—';

  const requiredJoints = isFront
    ? [KEYPOINT_NAMES.LEFT_SHOULDER, KEYPOINT_NAMES.RIGHT_SHOULDER, KEYPOINT_NAMES.LEFT_HIP, KEYPOINT_NAMES.RIGHT_HIP]
    : (facingDirection === FACING_DIRECTIONS.LEFT
      ? [KEYPOINT_NAMES.LEFT_EAR, KEYPOINT_NAMES.LEFT_SHOULDER, KEYPOINT_NAMES.LEFT_HIP]
      : [KEYPOINT_NAMES.RIGHT_EAR, KEYPOINT_NAMES.RIGHT_SHOULDER, KEYPOINT_NAMES.RIGHT_HIP]);

  const validation = validateKeypoints(keypoints, requiredJoints, thresholds.minConfidence);
  if (!validation.valid) {
    return {
      isValid: false,
      reason: `Thiếu khớp: ${validation.missing.join(', ')}`,
      minConfidence: validation.minConf,
      metrics: {
        neckAngle: null,
        backAngle: null,
        shoulderBalance: null,
        trunkLean: null,
        headOffsetPercent: null,
        headPositionLabel: '—'
      }
    };
  }

  const angleCheck = verifyCameraAngle(keypoints, viewAngle, facingDirection);
  if (!angleCheck.valid) {
    return {
      isValid: false,
      reason: angleCheck.reason,
      minConfidence: validation.minConf,
      metrics: {
        neckAngle: null,
        backAngle: null,
        shoulderBalance: null,
        trunkLean: null,
        headOffsetPercent: null,
        headPositionLabel: '—'
      }
    };
  }

  if (isFront) {
    const ls = keypoints[KEYPOINT_NAMES.LEFT_SHOULDER];
    const rs = keypoints[KEYPOINT_NAMES.RIGHT_SHOULDER];
    const lh = keypoints[KEYPOINT_NAMES.LEFT_HIP];
    const rh = keypoints[KEYPOINT_NAMES.RIGHT_HIP];

    // 1. Độ cân bằng hai vai: góc nghiêng của đường nối vai so với phương ngang
    const shoulderDx = rs.x - ls.x;
    const shoulderDy = rs.y - ls.y;
    // Góc so với phương ngang (0 độ khi hoàn toàn thăng bằng)
    shoulderBalance = Math.abs(Math.atan2(shoulderDy, shoulderDx) * (180 / Math.PI));
    if (shoulderBalance > 90) shoulderBalance = 180 - shoulderBalance;

    // 2. Độ nghiêng thân người: góc giữa trục trung điểm hông tới trung điểm vai so với phương thẳng đứng
    const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const trunkDx = midShoulder.x - midHip.x;
    const trunkDy = midHip.y - midShoulder.y; // Hướng lên trên dương
    trunkLean = Math.abs(Math.atan2(trunkDx, trunkDy) * (180 / Math.PI));
  }

  if (isSide) {
    const isLeft = facingDirection === FACING_DIRECTIONS.LEFT;
    const facingSign = isLeft ? -1 : 1;
    const ear = isLeft ? keypoints[KEYPOINT_NAMES.LEFT_EAR] : keypoints[KEYPOINT_NAMES.RIGHT_EAR];
    const shoulder = isLeft ? keypoints[KEYPOINT_NAMES.LEFT_SHOULDER] : keypoints[KEYPOINT_NAMES.RIGHT_SHOULDER];
    const hip = isLeft ? keypoints[KEYPOINT_NAMES.LEFT_HIP] : keypoints[KEYPOINT_NAMES.RIGHT_HIP];

    const trunkLength = calculateDistance(shoulder, hip);

    // 1. Góc nghiêng cổ: trục vai-tai so với phương thẳng đứng, có dấu theo hướng mặt
    const neckDy = shoulder.y - ear.y; // Tai nằm phía trên vai -> neckDy > 0
    const neckDx = (ear.x - shoulder.x) * facingSign; // Dương khi đầu đưa ra phía trước
    neckAngle = Math.atan2(neckDx, neckDy) * (180 / Math.PI);

    // 2. Góc lưng: trục hông-vai so với phương thẳng đứng
    const backDy = hip.y - shoulder.y; // Vai nằm phía trên hông -> backDy > 0
    const backDx = (shoulder.x - hip.x) * facingSign;
    backAngle = Math.atan2(backDx, backDy) * (180 / Math.PI);

    // 3. Vị trí đầu so với vai: độ lệch ngang có dấu, chuẩn hóa theo chiều dài thân (%)
    if (trunkLength > 0.001) {
      const horizontalOffset = (ear.x - shoulder.x) * facingSign;
      headOffsetPercent = (horizontalOffset / trunkLength) * 100;

      // Xác định nhãn hiển thị dựa trên mốc hiệu chuẩn và ngưỡng
      const baselineHeadOffset = baseline?.headOffsetPercent || 0;
      const headDiff = headOffsetPercent - baselineHeadOffset;
      const forwardThreshold = thresholds.forwardHeadPercent || 8;

      if (headDiff > forwardThreshold) {
        headPositionLabel = 'đưa ra trước';
      } else if (headDiff < -forwardThreshold) {
        headPositionLabel = 'lệch ra sau';
      } else {
        headPositionLabel = 'thẳng hàng';
      }
    }
  }

  return {
    isValid: true,
    minConfidence: validation.minConf,
    metrics: {
      neckAngle: neckAngle !== null ? Math.round(neckAngle * 10) / 10 : null,
      backAngle: backAngle !== null ? Math.round(backAngle * 10) / 10 : null,
      shoulderBalance: shoulderBalance !== null ? Math.round(shoulderBalance * 10) / 10 : null,
      trunkLean: trunkLean !== null ? Math.round(trunkLean * 10) / 10 : null,
      headOffsetPercent: headOffsetPercent !== null ? Math.round(headOffsetPercent * 10) / 10 : null,
      headPositionLabel
    }
  };
}

/**
 * Đánh giá tư thế: phân loại Đúng/Sai, danh sách mã vi phạm và điểm tư thế
 * Chỉ trả về duy nhất 2 trạng thái: Correct Posture hoặc Incorrect Posture
 */
export function evaluatePosture({
  metricsResult,
  viewAngle = VIEW_ANGLES.FRONT,
  baseline = null,
  thresholds = DEFAULT_THRESHOLDS,
  aiSource = 'mediapipe',
  teachableMachinePrediction = null
}) {
  if (!metricsResult || !metricsResult.isValid) {
    return {
      status: STATUS_KEY.CORRECT,
      postureScore: 100,
      violations: [],
      maxDeviationRatio: 0,
      metrics: metricsResult?.metrics || {
        neckAngle: null,
        backAngle: null,
        shoulderBalance: null,
        trunkLean: null,
        headOffsetPercent: null,
        headPositionLabel: '—'
      }
    };
  }

  const { metrics } = metricsResult;
  const violations = [];
  const deviationRatios = [];

  // Tự động kiểm tra lệch vai
  if (metrics.shoulderBalance !== null) {
    const baseShoulder = baseline?.shoulderBalance || 0;
    const diff = Math.abs(metrics.shoulderBalance - baseShoulder);
    const ratio = diff / thresholds.shoulderBalance;
    deviationRatios.push(ratio);
    if (diff > thresholds.shoulderBalance) {
      violations.push(VIOLATIONS.UNEVEN_SHOULDERS);
    }
  }

  // Tự động kiểm tra nghiêng thân người
  if (metrics.trunkLean !== null) {
    const baseTrunk = baseline?.trunkLean || 0;
    const diff = Math.abs(metrics.trunkLean - baseTrunk);
    const ratio = diff / thresholds.trunkLean;
    deviationRatios.push(ratio);
    if (diff > thresholds.trunkLean) {
      violations.push(VIOLATIONS.SIDE_LEAN);
    }
  }

  // Tự động kiểm tra góc cổ (khi quan sát nghiêng)
  if (metrics.neckAngle !== null) {
    const baseNeck = baseline?.neckAngle || 0;
    const diff = Math.abs(metrics.neckAngle - baseNeck);
    const ratio = diff / thresholds.neckTilt;
    deviationRatios.push(ratio);
    if (diff > thresholds.neckTilt) {
      violations.push(VIOLATIONS.FORWARD_HEAD);
    }
  }

  // Tự động kiểm tra góc lưng
  if (metrics.backAngle !== null) {
    const baseBack = baseline?.backAngle || 0;
    const diff = Math.abs(metrics.backAngle - baseBack);
    const ratio = diff / thresholds.backLean;
    deviationRatios.push(ratio);
    if (diff > thresholds.backLean) {
      violations.push(VIOLATIONS.BACK_LEAN);
    }
  }

  // Tự động kiểm tra đầu đưa ra trước
  if (metrics.headOffsetPercent !== null) {
    const baseHead = baseline?.headOffsetPercent || 0;
    const diff = Math.abs(metrics.headOffsetPercent - baseHead);
    const ratio = diff / thresholds.forwardHeadPercent;
    deviationRatios.push(ratio);
    if (diff > thresholds.forwardHeadPercent) {
      if (!violations.includes(VIOLATIONS.FORWARD_HEAD)) {
        violations.push(VIOLATIONS.FORWARD_HEAD);
      }
    }
  }

  // Tỷ lệ lệch lớn nhất r để tính điểm tư thế
  const maxDeviationRatio = deviationRatios.length > 0 ? Math.max(...deviationRatios) : 0;
  const postureScore = Math.round(Math.max(0, 100 - 30 * maxDeviationRatio));

  let status = violations.length > 0 ? STATUS_KEY.INCORRECT : STATUS_KEY.CORRECT;

  // Với Teachable Machine: kết hợp dự đoán model + hình học
  if (aiSource === 'teachable-machine' && teachableMachinePrediction) {
    const { className, probability } = teachableMachinePrediction;
    const minProb = thresholds.tmMinProbability || 0.65;

    if (probability >= minProb) {
      const lowerName = (className || '').toLowerCase();
      const isModelIncorrect =
        lowerName.includes('incorrect') ||
        lowerName.includes('sai') ||
        lowerName.includes('bad') ||
        lowerName.includes('slouch');
      const isModelCorrect =
        lowerName.includes('correct') ||
        lowerName.includes('đúng') ||
        lowerName.includes('dung') ||
        lowerName.includes('good') ||
        lowerName.includes('straight');

      if (isModelIncorrect) {
        status = STATUS_KEY.INCORRECT;
        if (violations.length === 0) {
          violations.push(VIOLATIONS.MODEL_INCORRECT);
        }
      } else if (isModelCorrect && violations.length === 0) {
        status = STATUS_KEY.CORRECT;
      }
    }
  }

  return {
    status,
    postureScore,
    violations,
    maxDeviationRatio,
    metrics
  };
}

/**
 * Tính giá trị hiệu chuẩn trung vị từ danh sách mẫu đo
 */
export function calculateCalibrationBaseline(samples, viewAngle) {
  if (!samples || samples.length === 0) return null;

  if (viewAngle === VIEW_ANGLES.FRONT) {
    const shoulderVals = samples
      .map(s => s.shoulderBalance)
      .filter(v => v !== null && Number.isFinite(v));
    const trunkVals = samples
      .map(s => s.trunkLean)
      .filter(v => v !== null && Number.isFinite(v));

    return {
      shoulderBalance: Math.round(calculateMedian(shoulderVals) * 10) / 10,
      trunkLean: Math.round(calculateMedian(trunkVals) * 10) / 10,
      viewAngle,
      calibratedAt: new Date().toISOString()
    };
  } else {
    const neckVals = samples
      .map(s => s.neckAngle)
      .filter(v => v !== null && Number.isFinite(v));
    const backVals = samples
      .map(s => s.backAngle)
      .filter(v => v !== null && Number.isFinite(v));
    const headVals = samples
      .map(s => s.headOffsetPercent)
      .filter(v => v !== null && Number.isFinite(v));

    return {
      neckAngle: Math.round(calculateMedian(neckVals) * 10) / 10,
      backAngle: Math.round(calculateMedian(backVals) * 10) / 10,
      headOffsetPercent: Math.round(calculateMedian(headVals) * 10) / 10,
      viewAngle,
      calibratedAt: new Date().toISOString()
    };
  }
}
