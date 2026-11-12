export const AUTO_SAVE_INTERVAL_MS = 30_000;
export const MAX_OBSERVATION_GAP_MS = 5_000;

// Only time spent continuously observing an incorrect posture counts.
export class AutoSaveTimer {
  constructor() {
    this.since = null;
    this.lastObservation = null;
  }

  reset() {
    this.since = null;
    this.lastObservation = null;
  }

  observe({ enabled, isIncorrect, now }) {
    if (!enabled || !isIncorrect) {
      this.reset();
      return false;
    }
    if (this.since === null || now < this.lastObservation || now - this.lastObservation > MAX_OBSERVATION_GAP_MS) {
      this.since = now;
      this.lastObservation = now;
      return false;
    }
    this.lastObservation = now;
    if (now - this.since < AUTO_SAVE_INTERVAL_MS) return false;
    this.since = now;
    return true;
  }
}
