import { TM_CLASSES } from '../constants/postureConfig.js';

const INCORRECT_DELAY_MS = 3_000;
const MAX_OBSERVATION_GAP_MS = 5_000;

export class BrowserNotificationService {
  constructor() {
    this.reset();
  }

  reset() {
    this.incorrectSince = null;
    this.lastObservation = null;
  }

  async requestPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  notifyIfNeeded({ hidden, predictions, now = performance.now() }) {
    const validPredictions = (predictions || []).filter((prediction) =>
      typeof prediction.probability === 'number' && Number.isFinite(prediction.probability) &&
      prediction.probability >= 0 && prediction.probability <= 1
    );
    const topPrediction = validPredictions.reduce((top, prediction) =>
      !top || prediction.probability > top.probability ? prediction : top, null);
    if (!hidden || topPrediction?.className !== TM_CLASSES.INCORRECT) {
      this.reset();
      return false;
    }
    if (this.incorrectSince === null || now < this.lastObservation || now - this.lastObservation > MAX_OBSERVATION_GAP_MS) {
      this.incorrectSince = now;
      this.lastObservation = now;
      return false;
    }
    this.lastObservation = now;
    if (now - this.incorrectSince < INCORRECT_DELAY_MS ||
        typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    const incorrect = predictions?.find((prediction) => prediction.className === TM_CLASSES.INCORRECT);
    const probability = incorrect?.probability;
    if (typeof probability !== 'number' || probability < 0 || probability > 1 || Number(probability.toFixed(2)) < 0.8) return false;
    try {
      new Notification('Nhắc nhở tư thế ngồi', {
        body: 'Bạn đang ngồi sai tư thế. Hãy điều chỉnh và ngồi thẳng lại!'
      });
      return true;
    } catch (error) {
      console.warn('Không thể hiển thị thông báo tư thế:', error);
      return false;
    }
  }

}

export const browserNotificationService = new BrowserNotificationService();
