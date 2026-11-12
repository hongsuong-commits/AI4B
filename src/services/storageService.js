import {
  STORAGE_KEYS,
  SYSTEM_LIMITS,
  DEFAULT_SETTINGS
} from '../constants/postureConfig.js';

class StorageService {
  constructor() {
    this.writeQueue = Promise.resolve();
    this.cachedHistory = null;
  }

  /**
   * Đọc cài đặt người dùng từ LocalStorage
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        thresholds: {
          ...DEFAULT_SETTINGS.thresholds,
          ...(parsed.thresholds || {})
        }
      };
    } catch (e) {
      console.warn('Lỗi đọc settings từ localStorage:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Lưu cài đặt người dùng vào LocalStorage (không ảnh hưởng lịch sử)
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Lỗi ghi settings vào localStorage:', e);
      return false;
    }
  }

  /**
   * Đọc dữ liệu hiệu chuẩn
   */
  getCalibration() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CALIBRATION);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Lỗi đọc calibration:', e);
      return null;
    }
  }

  /**
   * Lưu mốc hiệu chuẩn
   */
  saveCalibration(baseline) {
    try {
      if (!baseline) {
        localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
      } else {
        localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(baseline));
      }
      return true;
    } catch (e) {
      console.error('Lỗi lưu calibration:', e);
      return false;
    }
  }

  /**
   * Đọc toàn bộ danh sách lịch sử
   */
  getHistory() {
    if (this.cachedHistory) {
      return [...this.cachedHistory];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!raw) {
        this.cachedHistory = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Kiểm tra tính hợp lệ cơ bản
        this.cachedHistory = parsed.filter(item => item && item.id && item.capturedAt);
        return [...this.cachedHistory];
      }
      this.cachedHistory = [];
      return [];
    } catch (e) {
      console.error('Lỗi đọc history từ localStorage:', e);
      this.cachedHistory = [];
      return [];
    }
  }

  /**
   * Tính ước lượng kích thước dữ liệu history đang lưu trữ (Bytes)
   */
  getEstimatedStorageUsage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!raw) return 0;
      // Dùng Blob size hoặc tính byte theo chuỗi UTF-16
      return new Blob([raw]).size;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Nén ảnh từ video element thành Data URL JPEG kích thước tối đa 480px
   */
  async compressVideoFrame(videoElement, maxDimension = SYSTEM_LIMITS.MAX_IMAGE_DIMENSION, quality = SYSTEM_LIMITS.IMAGE_JPEG_QUALITY) {
    return new Promise((resolve) => {
      try {
        if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          resolve(null);
          return;
        }

        const srcWidth = videoElement.videoWidth;
        const srcHeight = videoElement.videoHeight;

        let targetWidth = srcWidth;
        let targetHeight = srcHeight;

        if (srcWidth > maxDimension || srcHeight > maxDimension) {
          if (srcWidth > srcHeight) {
            targetWidth = maxDimension;
            targetHeight = Math.round((srcHeight * maxDimension) / srcWidth);
          } else {
            targetHeight = maxDimension;
            targetWidth = Math.round((srcWidth * maxDimension) / srcHeight);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (err) {
        console.error('Lỗi nén ảnh khung hình:', err);
        resolve(null);
      }
    });
  }

  /**
   * Ghi bản ghi mới vào lịch sử qua hàng đợi tuần tự (Sequential Write Queue)
   */
  async addRecord(record) {
    // Đưa vào hàng đợi để tránh ghi đè đồng thời giữa chụp tay và Auto-save
    return new Promise((resolve) => {
      this.writeQueue = this.writeQueue.then(async () => {
        try {
          const currentList = this.getHistory();

          // Kiểm tra xem đã có bản ghi cùng frameId trong session này chưa
          if (record.frameId && record.sessionId) {
            const isDuplicate = currentList.some(
              r => r.sessionId === record.sessionId && r.frameId === record.frameId
            );
            if (isDuplicate) {
              resolve({
                success: false,
                duplicate: true,
                message: 'Khung hình này đã được lưu trong phiên hiện tại.'
              });
              return;
            }
          }

          // Chuẩn hóa bản ghi
          const recordToSave = {
            id: record.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sessionId: record.sessionId || 'default',
            frameId: record.frameId || Date.now(),
            capturedAt: record.capturedAt || new Date().toISOString(),
            source: record.source || 'manual', // 'manual' | 'auto'
            aiSource: record.aiSource || 'mediapipe',
            viewAngle: record.viewAngle || 'front',
            status: record.status,
            confidence: Number.isFinite(record.confidence) ? Math.round(record.confidence) : 0,
            postureScore: Number.isFinite(record.postureScore) ? Math.round(record.postureScore) : 0,
            metrics: record.metrics || {},
            violations: Array.isArray(record.violations) ? record.violations : [],
            image: record.image || null,
            schemaVersion: SYSTEM_LIMITS.SCHEMA_VERSION
          };

          const newList = [recordToSave, ...currentList];
          const serialized = JSON.stringify(newList);
          const estimatedBytes = new Blob([serialized]).size;

          // Kiểm tra ngân sách bộ nhớ 3 MiB
          if (estimatedBytes > SYSTEM_LIMITS.STORAGE_BUDGET_BYTES) {
            resolve({
              success: false,
              quotaExceeded: true,
              message: 'Dung lượng lưu trữ 3 MiB đã đạt giới hạn. Vui lòng nhấn Export ZIP và Xóa lịch sử để tiếp tục lưu.'
            });
            return;
          }

          localStorage.setItem(STORAGE_KEYS.HISTORY, serialized);
          this.cachedHistory = newList;

          resolve({
            success: true,
            record: recordToSave,
            storageUsedBytes: estimatedBytes
          });
        } catch (err) {
          console.error('Lỗi thêm bản ghi vào storage:', err);
          const isQuota =
            err.name === 'QuotaExceededError' ||
            err.code === 22 ||
            err.code === 1014 ||
            (err.message && err.message.toLowerCase().includes('quota'));

          resolve({
            success: false,
            quotaExceeded: isQuota,
            message: isQuota
              ? 'Dung lượng trình duyệt đã đầy (QuotaExceededError). Vui lòng Export ZIP và Xóa lịch sử.'
              : `Lỗi lưu trữ: ${err.message}`
          });
        }
      });
    });
  }

  /**
   * Xóa toàn bộ lịch sử (yêu cầu người dùng xác nhận ở UI)
   */
  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      this.cachedHistory = [];
      return true;
    } catch (e) {
      console.error('Lỗi xóa lịch sử:', e);
      return false;
    }
  }
}

export const storageService = new StorageService();
