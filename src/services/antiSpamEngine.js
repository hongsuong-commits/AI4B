import {
  STATUS_KEY,
  VIOLATION_MESSAGES,
  SYSTEM_LIMITS
} from '../constants/postureConfig.js';

export class AntiSpamEngine {
  constructor({
    incorrectAlertDelay = 5,
    alertRepeatInterval = 5,
    autoSaveInterval = 3,
    antiSpamWindow = 5,
    onAlert = () => {},
    onCorrectToast = () => {},
    onAutoSave = () => {}
  } = {}) {
    this.incorrectAlertDelay = Math.max(5, incorrectAlertDelay);
    this.alertRepeatInterval = Math.max(5, alertRepeatInterval);
    this.autoSaveInterval = Math.max(1, autoSaveInterval);
    this.antiSpamWindow = Math.max(5, antiSpamWindow);

    this.onAlert = onAlert;
    this.onCorrectToast = onCorrectToast;
    this.onAutoSave = onAutoSave;

    // Trạng thái theo dõi nhắc nhở
    this.incorrectStartTime = null;
    this.lastAlertTime = null;
    this.hasAlertedForCurrentStreak = false;

    // Trạng thái theo dõi Auto-save
    this.lastAutoSaveTime = null;
    this.lastAutoSaveStatus = null;
    this.lastAutoSaveTick = null;

    // Trạng thái làm mượt kết quả hiển thị (Status Smoothing - 1 giây)
    this.smoothedStatus = STATUS_KEY.INSUFFICIENT;
    this.candidateStatus = STATUS_KEY.INSUFFICIENT;
    this.candidateStatusStartTime = null;

    // Trạng thái lời khen tư thế đúng
    this.previousWasIncorrect = false;
    this.hasPraisedCorrect = false;

    // Trạng thái theo dõi Sitting Duration
    this.sittingDurationSeconds = 0;
    this.lastValidTrackingTimestamp = null;
    this.lastInterruptionTimestamp = null;
  }

  /**
   * Cập nhật cài đặt cấu hình
   */
  updateConfig({
    incorrectAlertDelay,
    alertRepeatInterval,
    autoSaveInterval,
    antiSpamWindow
  }) {
    if (Number.isFinite(incorrectAlertDelay)) {
      this.incorrectAlertDelay = Math.max(5, incorrectAlertDelay);
    }
    if (Number.isFinite(alertRepeatInterval)) {
      this.alertRepeatInterval = Math.max(5, alertRepeatInterval);
    }
    if (Number.isFinite(autoSaveInterval)) {
      this.autoSaveInterval = Math.max(1, autoSaveInterval);
    }
    if (Number.isFinite(antiSpamWindow)) {
      this.antiSpamWindow = Math.max(5, antiSpamWindow);
    }
  }

  /**
   * Khởi tạo lại toàn bộ khi bắt đầu phiên mới hoặc đổi camera/model
   */
  resetSession() {
    this.incorrectStartTime = null;
    this.lastAlertTime = null;
    this.hasAlertedForCurrentStreak = false;

    this.lastAutoSaveTime = null;
    this.lastAutoSaveStatus = null;
    this.lastAutoSaveTick = null;

    this.smoothedStatus = STATUS_KEY.INSUFFICIENT;
    this.candidateStatus = STATUS_KEY.INSUFFICIENT;
    this.candidateStatusStartTime = null;

    this.previousWasIncorrect = false;
    this.hasPraisedCorrect = false;

    this.sittingDurationSeconds = 0;
    this.lastValidTrackingTimestamp = null;
    this.lastInterruptionTimestamp = null;
  }

  /**
   * Làm mượt trạng thái hiển thị (Current Status)
   * Yêu cầu trạng thái mới ổn định trong 1000ms.
   * Riêng khi mất dấu (INSUFFICIENT), chuyển ngay tức thì để không giữ kết quả cũ.
   */
  smoothStatus(rawStatus, now = performance.now()) {
    if (rawStatus === STATUS_KEY.INSUFFICIENT) {
      this.smoothedStatus = STATUS_KEY.INSUFFICIENT;
      this.candidateStatus = STATUS_KEY.INSUFFICIENT;
      this.candidateStatusStartTime = null;
      return this.smoothedStatus;
    }

    if (rawStatus !== this.candidateStatus) {
      this.candidateStatus = rawStatus;
      this.candidateStatusStartTime = now;
    } else {
      const elapsed = now - (this.candidateStatusStartTime || now);
      if (elapsed >= SYSTEM_LIMITS.STATUS_SMOOTHING_MS) {
        this.smoothedStatus = this.candidateStatus;
      }
    }

    return this.smoothedStatus;
  }

  /**
   * Cập nhật đồng hồ thời gian ngồi Sitting Duration
   * Chỉ đếm khi tab đang hiển thị và dữ liệu hợp lệ (Correct hoặc Incorrect).
   * Tạm dừng khi tab ẩn hoặc thiếu dữ liệu.
   * Nếu gián đoạn >= 5s thì reset đoạn liên tục.
   */
  updateSittingDuration(isValidData, isTabVisible, now = performance.now()) {
    if (!isTabVisible || !isValidData) {
      if (this.lastValidTrackingTimestamp !== null) {
        this.lastInterruptionTimestamp = now;
      }
      this.lastValidTrackingTimestamp = null;
      return this.sittingDurationSeconds;
    }

    // Nếu quay lại sau gián đoạn >= 5 giây thì reset bộ đếm liên tục
    if (this.lastInterruptionTimestamp !== null) {
      const interruptionDuration = now - this.lastInterruptionTimestamp;
      if (interruptionDuration >= SYSTEM_LIMITS.SITTING_INTERRUPTION_RESET_MS) {
        this.sittingDurationSeconds = 0;
      }
      this.lastInterruptionTimestamp = null;
    }

    if (this.lastValidTrackingTimestamp !== null) {
      const deltaSeconds = (now - this.lastValidTrackingTimestamp) / 1000;
      if (deltaSeconds > 0 && deltaSeconds < 2) {
        this.sittingDurationSeconds += deltaSeconds;
      }
    }

    this.lastValidTrackingTimestamp = now;
    return this.sittingDurationSeconds;
  }

  /**
   * Xử lý logic phát lời nhắc sai tư thế và lời khen đúng tư thế
   */
  processAlerts({
    status,
    violations = [],
    enableIncorrectAlert = true,
    enableCorrectToast = true,
    now = performance.now()
  }) {
    // 1. Nếu trạng thái là Chưa đủ dữ liệu -> Reset bộ đếm sai liên tục
    if (status === STATUS_KEY.INSUFFICIENT) {
      this.incorrectStartTime = null;
      this.hasAlertedForCurrentStreak = false;
      return null;
    }

    // 2. Xử lý khi tư thế ĐÚNG (Correct Posture)
    if (status === STATUS_KEY.CORRECT) {
      // Nếu trước đó đang sai mà nay chuyển sang đúng và ổn định -> Khen 1 lần
      if (this.previousWasIncorrect && !this.hasPraisedCorrect) {
        if (enableCorrectToast) {
          this.onCorrectToast('Tư thế ngồi của bạn đang rất tốt!');
        }
        this.hasPraisedCorrect = true;
      }

      // Reset theo dõi sai
      this.incorrectStartTime = null;
      this.hasAlertedForCurrentStreak = false;
      this.previousWasIncorrect = false;
      return null;
    }

    // 3. Xử lý khi tư thế SAI (Incorrect Posture)
    if (status === STATUS_KEY.INCORRECT) {
      this.previousWasIncorrect = true;
      this.hasPraisedCorrect = false;

      if (!enableIncorrectAlert) {
        return null;
      }

      if (this.incorrectStartTime === null) {
        this.incorrectStartTime = now;
      }

      const incorrectDurationSec = (now - this.incorrectStartTime) / 1000;
      const timeSinceLastAlertSec = this.lastAlertTime !== null ? (now - this.lastAlertTime) / 1000 : Infinity;

      // Chọn thông điệp nhắc nhở phù hợp nhất dựa trên lỗi
      let message = 'Hãy điều chỉnh lại tư thế ngồi';
      if (violations && violations.length > 0) {
        const firstViolation = violations[0];
        message = VIOLATION_MESSAGES[firstViolation] || message;
      }

      // Nhắc lần đầu sau khi sai liên tục đủ ngưỡng incorrectAlertDelay
      if (!this.hasAlertedForCurrentStreak) {
        if (incorrectDurationSec >= this.incorrectAlertDelay) {
          // Kiểm tra khoảng cách chống spam tối thiểu giữa 2 lần nhắc
          if (this.lastAlertTime === null || timeSinceLastAlertSec >= this.alertRepeatInterval) {
            this.lastAlertTime = now;
            this.hasAlertedForCurrentStreak = true;
            this.onAlert({ message, violations, type: 'first' });
            return message;
          }
        }
      } else {
        // Nhắc lại theo chu kỳ alertRepeatInterval (>= 5s) nếu vẫn tiếp tục sai
        if (timeSinceLastAlertSec >= this.alertRepeatInterval) {
          this.lastAlertTime = now;
          this.onAlert({ message, violations, type: 'repeat' });
          return message;
        }
      }
    }

    return null;
  }

  /**
   * Xử lý nhịp Auto-save theo chu kỳ và quy tắc Anti-spam 5 giây
   * @param {Object} params
   * @returns {boolean} true nếu thỏa mãn điều kiện và được lưu
   */
  processAutoSave({
    isEnabled = false,
    status,
    isTabVisible = true,
    isCameraRunning = true,
    now = performance.now()
  }) {
    if (!isEnabled || !isCameraRunning || !isTabVisible) {
      return false;
    }

    // Chỉ lưu khi đánh giá là Đúng hoặc Sai hợp lệ
    if (status !== STATUS_KEY.CORRECT && status !== STATUS_KEY.INCORRECT) {
      return false;
    }

    // Kiểm tra nhịp chu kỳ autoSaveInterval (ví dụ mỗi 3s)
    const timeSinceLastTick = this.lastAutoSaveTick !== null ? (now - this.lastAutoSaveTick) / 1000 : Infinity;
    if (this.lastAutoSaveTick !== null && timeSinceLastTick < this.autoSaveInterval) {
      return false;
    }

    this.lastAutoSaveTick = now;

    // Kiểm tra quy tắc Anti-spam 5 giây:
    // Nếu trùng trạng thái với lần lưu tự động gần nhất: cần cách tối thiểu 5s (antiSpamWindow)
    // Nếu trạng thái thay đổi: cho phép lưu ngay ở nhịp này
    const timeSinceLastSave = this.lastAutoSaveTime !== null ? (now - this.lastAutoSaveTime) / 1000 : Infinity;

    if (this.lastAutoSaveStatus === status) {
      if (this.lastAutoSaveTime !== null && timeSinceLastSave < this.antiSpamWindow) {
        // Bỏ qua lượt này do chưa đủ 5s cùng trạng thái
        return false;
      }
    }

    // Đạt điều kiện lưu tự động!
    this.lastAutoSaveTime = now;
    this.lastAutoSaveStatus = status;

    this.onAutoSave({ status, timestamp: now });
    return true;
  }
}
