import { describe, it, expect, vi } from 'vitest';
import { AntiSpamEngine } from '../services/antiSpamEngine.js';
import { STATUS_KEY, VIOLATIONS } from '../constants/postureConfig.js';

describe('AntiSpamEngine & Timing Logic', () => {
  it('triggers first alert only after incorrect status persists for >= 5s', () => {
    const onAlert = vi.fn();
    const engine = new AntiSpamEngine({
      incorrectAlertDelay: 5,
      alertRepeatInterval: 5,
      onAlert
    });

    let t = 10000;
    // Frame at t=10s: Incorrect starts
    engine.processAlerts({
      status: STATUS_KEY.INCORRECT,
      violations: [VIOLATIONS.BACK_LEAN],
      now: t
    });
    expect(onAlert).not.toHaveBeenCalled();

    // Frame at t=13s (3s elapsed): still waiting
    t = 13000;
    engine.processAlerts({
      status: STATUS_KEY.INCORRECT,
      violations: [VIOLATIONS.BACK_LEAN],
      now: t
    });
    expect(onAlert).not.toHaveBeenCalled();

    // Frame at t=15.1s (> 5s elapsed): first alert triggers
    t = 15100;
    engine.processAlerts({
      status: STATUS_KEY.INCORRECT,
      violations: [VIOLATIONS.BACK_LEAN],
      now: t
    });
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'first',
        message: expect.stringContaining('giữ lưng thẳng')
      })
    );
  });

  it('enforces minimum 5s interval between repeated alerts', () => {
    const onAlert = vi.fn();
    const engine = new AntiSpamEngine({
      incorrectAlertDelay: 5,
      alertRepeatInterval: 5,
      onAlert
    });

    let t = 10000;
    // First alert at 15.5s
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: t });
    t = 15500;
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: t });
    expect(onAlert).toHaveBeenCalledTimes(1);

    // Try at 18s (< 5s since last alert at 15.5s) -> should NOT alert
    t = 18000;
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: t });
    expect(onAlert).toHaveBeenCalledTimes(1);

    // At 21s (5.5s since last alert) -> repeat alert triggers
    t = 21000;
    engine.processAlerts({ status: STATUS_KEY.INCORRECT, now: t });
    expect(onAlert).toHaveBeenCalledTimes(2);
  });

  it('handles Auto-save 3s cycle and 5s anti-spam window for duplicate status', () => {
    const onAutoSave = vi.fn();
    const engine = new AntiSpamEngine({
      autoSaveInterval: 3,
      antiSpamWindow: 5,
      onAutoSave
    });

    // t=0s: start
    let t = 0;
    let saved = engine.processAutoSave({
      isEnabled: true,
      status: STATUS_KEY.INCORRECT,
      isTabVisible: true,
      isCameraRunning: true,
      now: t
    });
    expect(saved).toBe(true);
    expect(onAutoSave).toHaveBeenCalledTimes(1);

    // t=3s: 3s tick fires, but same status (INCORRECT) and elapsed is 3s (< 5s antiSpamWindow) -> SKIPPED
    t = 3000;
    saved = engine.processAutoSave({
      isEnabled: true,
      status: STATUS_KEY.INCORRECT,
      isTabVisible: true,
      isCameraRunning: true,
      now: t
    });
    expect(saved).toBe(false);
    expect(onAutoSave).toHaveBeenCalledTimes(1);

    // t=6s: 3s tick fires again. Same status, but elapsed from last save (t=0) is 6s (>= 5s) -> SAVED
    t = 6000;
    saved = engine.processAutoSave({
      isEnabled: true,
      status: STATUS_KEY.INCORRECT,
      isTabVisible: true,
      isCameraRunning: true,
      now: t
    });
    expect(saved).toBe(true);
    expect(onAutoSave).toHaveBeenCalledTimes(2);
  });

  it('allows Auto-save immediately on next tick when status changes', () => {
    const onAutoSave = vi.fn();
    const engine = new AntiSpamEngine({
      autoSaveInterval: 3,
      antiSpamWindow: 5,
      onAutoSave
    });

    // t=0s: saves INCORRECT
    let t = 0;
    engine.processAutoSave({
      isEnabled: true,
      status: STATUS_KEY.INCORRECT,
      isTabVisible: true,
      isCameraRunning: true,
      now: t
    });
    expect(onAutoSave).toHaveBeenCalledTimes(1);

    // t=3s: status changed to CORRECT! Even though 3s < 5s, the status has changed -> SAVED!
    t = 3000;
    const saved = engine.processAutoSave({
      isEnabled: true,
      status: STATUS_KEY.CORRECT,
      isTabVisible: true,
      isCameraRunning: true,
      now: t
    });
    expect(saved).toBe(true);
    expect(onAutoSave).toHaveBeenCalledTimes(2);
  });

  it('smooths status: requires 1000ms stability, but drops immediately on INSUFFICIENT', () => {
    const engine = new AntiSpamEngine();

    let t = 1000;
    // Initial status: INSUFFICIENT
    expect(engine.smoothStatus(STATUS_KEY.INSUFFICIENT, t)).toBe(STATUS_KEY.INSUFFICIENT);

    // t=2000ms: candidate becomes CORRECT
    t = 2000;
    expect(engine.smoothStatus(STATUS_KEY.CORRECT, t)).toBe(STATUS_KEY.INSUFFICIENT);

    // t=2500ms (500ms elapsed): still INSUFFICIENT
    t = 2500;
    expect(engine.smoothStatus(STATUS_KEY.CORRECT, t)).toBe(STATUS_KEY.INSUFFICIENT);

    // t=3100ms (1100ms elapsed >= 1000ms): now stabilized to CORRECT
    t = 3100;
    expect(engine.smoothStatus(STATUS_KEY.CORRECT, t)).toBe(STATUS_KEY.CORRECT);

    // When landmarks are lost (INSUFFICIENT), it must drop immediately
    t = 3200;
    expect(engine.smoothStatus(STATUS_KEY.INSUFFICIENT, t)).toBe(STATUS_KEY.INSUFFICIENT);
  });

  it('sitting duration counts monotonic tracking and resets after 5s interruption', () => {
    const engine = new AntiSpamEngine();

    let t = 0;
    engine.updateSittingDuration(true, true, t);

    // 1 second later
    t = 1000;
    let dur = engine.updateSittingDuration(true, true, t);
    expect(dur).toBeCloseTo(1, 1);

    // 2 seconds later
    t = 2000;
    dur = engine.updateSittingDuration(true, true, t);
    expect(dur).toBeCloseTo(2, 1);

    // Interrupt for 6 seconds (t = 8000)
    t = 3000;
    engine.updateSittingDuration(false, true, t); // interrupted (invalid data)

    t = 9500; // 6.5s later, user returns
    dur = engine.updateSittingDuration(true, true, t);
    // Since interruption was >= 5s, duration resets
    expect(dur).toBe(0);
  });
});
