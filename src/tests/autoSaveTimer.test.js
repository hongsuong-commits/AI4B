import { describe, expect, it } from 'vitest';
import { AutoSaveTimer } from '../services/autoSaveTimer.js';

describe('Tự động lưu tư thế sai sau 30 giây', () => {
  it('đợi đủ 30 giây sai liên tục và lặp lại sau mỗi 30 giây', () => {
    const timer = new AutoSaveTimer();
    const observe = (now) => timer.observe({ enabled: true, isIncorrect: true, now });

    expect(observe(0)).toBe(false);
    for (let now = 1_000; now < 29_000; now += 1_000) expect(observe(now)).toBe(false);
    expect(observe(29_000)).toBe(false);
    expect(observe(29_999)).toBe(false);
    expect(observe(30_000)).toBe(true);
    expect(observe(30_001)).toBe(false);
    for (let now = 31_000; now <= 59_000; now += 1_000) expect(observe(now)).toBe(false);
    expect(observe(59_999)).toBe(false);
    expect(observe(60_000)).toBe(true);
  });

  it.each([
    ['tư thế không còn sai hoặc không có dự đoán', { enabled: true, isIncorrect: false }],
    ['tắt tự động lưu', { enabled: false, isIncorrect: true }]
  ])('bắt đầu đếm lại khi %s', (_reason, interruption) => {
    const timer = new AutoSaveTimer();
    timer.observe({ enabled: true, isIncorrect: true, now: 0 });
    for (let now = 1_000; now < 29_000; now += 1_000) {
      expect(timer.observe({ enabled: true, isIncorrect: true, now })).toBe(false);
    }
    expect(timer.observe({ ...interruption, now: 29_000 })).toBe(false);
    expect(timer.observe({ enabled: true, isIncorrect: true, now: 30_000 })).toBe(false);
    for (let now = 31_000; now <= 59_000; now += 1_000) {
      expect(timer.observe({ enabled: true, isIncorrect: true, now })).toBe(false);
    }
    expect(timer.observe({ enabled: true, isIncorrect: true, now: 59_999 })).toBe(false);
    expect(timer.observe({ enabled: true, isIncorrect: true, now: 60_000 })).toBe(true);
  });

  it('xóa bộ đếm khi kết thúc phiên camera', () => {
    const timer = new AutoSaveTimer();
    timer.observe({ enabled: true, isIncorrect: true, now: 0 });
    timer.reset();
    expect(timer.observe({ enabled: true, isIncorrect: true, now: 30_000 })).toBe(false);
    for (let now = 31_000; now < 60_000; now += 1_000) {
      expect(timer.observe({ enabled: true, isIncorrect: true, now })).toBe(false);
    }
    expect(timer.observe({ enabled: true, isIncorrect: true, now: 60_000 })).toBe(true);
  });

  it('không tính khoảng thời gian không quan sát dài quá 5 giây', () => {
    const timer = new AutoSaveTimer();
    const observe = (now) => timer.observe({ enabled: true, isIncorrect: true, now });
    expect(observe(0)).toBe(false);
    expect(observe(5_000)).toBe(false);
    expect(observe(10_001)).toBe(false);
    for (let now = 11_001; now < 40_001; now += 1_000) expect(observe(now)).toBe(false);
    expect(observe(40_001)).toBe(true);
  });
});
