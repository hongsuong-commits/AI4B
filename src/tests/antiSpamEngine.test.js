import { describe, expect, it, vi } from 'vitest';
import { AntiSpamEngine } from '../services/antiSpamEngine.js';
import { STATUS_KEY } from '../constants/postureConfig.js';

describe('AntiSpamEngine', () => {
  it('throttles repeated incorrect-posture alerts and resets after recovery', () => {
    const onAlert = vi.fn();
    const onCorrectToast = vi.fn();
    const engine = new AntiSpamEngine({ onAlert, onCorrectToast });

    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 0 });
    expect(engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 4_999 })).toBeNull();
    expect(engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 5_000 })).not.toBeNull();
    expect(onAlert).toHaveBeenCalledTimes(1);
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 9_999 });
    expect(onAlert).toHaveBeenCalledTimes(1);
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 10_000 });
    expect(onAlert).toHaveBeenCalledTimes(2);

    engine.processAlerts({ status: STATUS_KEY.CORRECT, now: 10_100 });
    expect(onCorrectToast).toHaveBeenCalledTimes(1);
    engine.processAlerts({ status: STATUS_KEY.INSUFFICIENT, now: 11_000 });
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 12_000 });
    expect(engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: 17_000 })).not.toBeNull();
    expect(onAlert).toHaveBeenCalledTimes(3);
  });

  it('prevents duplicate auto-saves while allowing a changed posture status', () => {
    const onAutoSave = vi.fn();
    const engine = new AntiSpamEngine({ onAutoSave, autoSaveInterval: 3, antiSpamWindow: 5 });
    const save = (status, now) => engine.processAutoSave({
      isEnabled: true, status, isTabVisible: true, isCameraRunning: true, now
    });

    expect(save(STATUS_KEY.INCORRECT, 0)).toBe(true);
    expect(save(STATUS_KEY.INCORRECT, 3_000)).toBe(false);
    expect(save(STATUS_KEY.INCORRECT, 6_000)).toBe(true);
    expect(save(STATUS_KEY.CORRECT, 9_000)).toBe(true);
    expect(save(STATUS_KEY.INSUFFICIENT, 12_000)).toBe(false);
    expect(onAutoSave).toHaveBeenCalledTimes(3);

    expect(engine.processAutoSave({ isEnabled: false, status: STATUS_KEY.INCORRECT, now: 20_000 })).toBe(false);
    expect(engine.processAutoSave({ isEnabled: true, status: STATUS_KEY.INCORRECT, isTabVisible: false, now: 20_000 })).toBe(false);
  });

  it('smooths status changes and resets sitting time after a long interruption', () => {
    const engine = new AntiSpamEngine();
    expect(engine.smoothStatus(STATUS_KEY.CORRECT, 1_000)).toBe(STATUS_KEY.INSUFFICIENT);
    expect(engine.smoothStatus(STATUS_KEY.CORRECT, 2_000)).toBe(STATUS_KEY.CORRECT);
    expect(engine.smoothStatus(STATUS_KEY.INSUFFICIENT, 2_100)).toBe(STATUS_KEY.INSUFFICIENT);

    engine.updateSittingDuration(true, true, 0);
    engine.updateSittingDuration(true, true, 1_000);
    expect(engine.sittingDurationSeconds).toBe(1);
    engine.updateSittingDuration(false, true, 2_000);
    engine.updateSittingDuration(true, true, 7_000);
    expect(engine.sittingDurationSeconds).toBe(0);
  });
});
