// Cấu hình mặc định cho hệ thống AI Seat Posture Detection

export const STATUS = {
  CORRECT: 'Đúng tư thế',
  INCORRECT: 'Sai tư thế',
  INSUFFICIENT: 'Chưa đủ dữ liệu'
};

export const STATUS_KEY = {
  CORRECT: 'Correct Posture',
  INCORRECT: 'Incorrect Posture',
  INSUFFICIENT: 'Insufficient Data'
};

export const STATUS_DISPLAY = {
  [STATUS_KEY.CORRECT]: 'Đúng tư thế',
  [STATUS_KEY.INCORRECT]: 'Sai tư thế',
  [STATUS_KEY.INSUFFICIENT]: 'Chưa đủ dữ liệu'
};

export const VIOLATIONS = {
  FORWARD_HEAD: 'FORWARD_HEAD',
  BACK_LEAN: 'BACK_LEAN',
  UNEVEN_SHOULDERS: 'UNEVEN_SHOULDERS',
  SIDE_LEAN: 'SIDE_LEAN',
  MODEL_INCORRECT: 'MODEL_INCORRECT'
};

export const VIOLATION_LABELS = {
  FORWARD_HEAD: 'Đầu nhô ra trước (Forward Head)',
  BACK_LEAN: 'Lưng cong / ngả sai góc (Back Slouch/Lean)',
  UNEVEN_SHOULDERS: 'Hai vai không cân bằng (Uneven Shoulders)',
  SIDE_LEAN: 'Thân người nghiêng sang bên (Trunk Lean)',
  MODEL_INCORRECT: 'Mô hình AI phát hiện tư thế sai chung (AI Prediction)'
};

export const VIOLATION_MESSAGES = {
  FORWARD_HEAD: 'Hãy điều chỉnh vị trí cổ và giữ đầu thẳng hàng với vai!',
  BACK_LEAN: 'Hãy giữ lưng thẳng và tựa đều vào ghế!',
  UNEVEN_SHOULDERS: 'Hãy thả lỏng và giữ hai vai cân bằng ngang nhau!',
  SIDE_LEAN: 'Hãy ngồi thẳng trọng tâm, tránh nghiêng thân người sang một bên!',
  MODEL_INCORRECT: 'Hãy điều chỉnh lại tư thế ngồi thẳng theo hướng dẫn!'
};

export const VIEW_ANGLES = {
  FRONT: 'front', // Chính diện
  SIDE: 'side'    // Nhìn nghiêng
};

export const FACING_DIRECTIONS = {
  LEFT: 'left',   // Hướng mặt sang trái
  RIGHT: 'right'  // Hướng mặt sang phải
};

export const AI_SOURCES = {
  MEDIAPIPE: 'mediapipe',
  TEACHABLE_MACHINE: 'teachable-machine'
};

export const TM_MODEL_URL = `${import.meta.env.BASE_URL}models/my_pose_model_v2/`;

export const TM_CLASSES = {
  CORRECT: 'Ngồi đúng tư thế',
  INCORRECT: 'Ngồi sai tư thế',
  HUNCH: 'Gù lưng / Cúi cổ',
  LEAN: 'Nghiêng người / Lệch vai'
};

// Ngưỡng kỹ thuật mặc định theo mục 4.1 và 7 của prompt
export const DEFAULT_THRESHOLDS = {
  shoulderBalance: 5,        // Độ lệch vai: 5° (Chính diện)
  trunkLean: 8,              // Nghiêng thân sang bên: 8° (Chính diện)
  neckTilt: 10,              // Góc nghiêng cổ: 10° so với mốc (Nhìn nghiêng)
  backLean: 8,               // Góc lưng: 8° so với mốc (Nhìn nghiêng)
  forwardHeadPercent: 8,     // Đầu dịch về trước: 8% chiều dài thân vai-hông (Nhìn nghiêng)
  minConfidence: 0.5,        // Độ tin cậy tối thiểu của khớp (50%)
  tmMinProbability: 0.75     // Xác suất Teachable Machine tối thiểu (75%)
};

// Cài đặt cảnh báo và tự lưu mặc định
export const DEFAULT_SETTINGS = {
  aiSource: AI_SOURCES.TEACHABLE_MACHINE,
  teachableMachineUrl: TM_MODEL_URL,
  viewAngle: VIEW_ANGLES.FRONT,
  facingDirection: FACING_DIRECTIONS.LEFT,
  enableIncorrectAlert: true,
  incorrectAlertDelay: 5,     // Giây sai liên tục trước khi nhắc lần đầu (mặc định 5s)
  alertRepeatInterval: 5,     // Khoảng cách tối thiểu giữa các lần nhắc lại (>= 5s)
  enableSoundAlert: true,
  enableCorrectToast: true,   // Hiển thị lời khen tư thế đúng khi phục hồi
  enableAutoSave: false,      // Mặc định tắt, người dùng chủ động bật
  autoSaveInterval: 3,        // Chu kỳ kiểm tra tự lưu: 3s
  antiSpamWindow: 5,          // Cửa sổ chống trùng tự lưu cùng trạng thái: 5s
  mirrorVideo: true,          // Chế độ gương
  thresholds: { ...DEFAULT_THRESHOLDS }
};

export const SYSTEM_LIMITS = {
  STORAGE_BUDGET_BYTES: 3 * 1024 * 1024, // 3 MiB ngân sách lưu trữ lịch sử
  MAX_IMAGE_DIMENSION: 480,              // Cạnh tối đa của ảnh nén JPEG (px)
  IMAGE_JPEG_QUALITY: 0.75,              // Chất lượng nén JPEG
  CALIBRATION_DURATION_MS: 3000,         // Thời gian hiệu chuẩn tối thiểu (3s)
  STATUS_SMOOTHING_MS: 1000,             // Thời gian trạng thái mới phải ổn định (1s)
  SITTING_INTERRUPTION_RESET_MS: 5000,   // Gián đoạn >= 5s thì reset đoạn ngồi liên tục
  SCHEMA_VERSION: 1
};

export const STORAGE_KEYS = {
  SETTINGS: 'ai_seat_posture_settings_v1',
  HISTORY: 'ai_seat_posture_history_v1',
  CALIBRATION: 'ai_seat_posture_calibration_v1'
};
