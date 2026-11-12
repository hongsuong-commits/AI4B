import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserNotificationService } from '../services/browserNotificationService.js';
import { TM_CLASSES } from '../constants/postureConfig.js';

const prediction = (incorrect) => [
  { className: TM_CLASSES.CORRECT, probability: 1 - incorrect },
  { className: TM_CLASSES.INCORRECT, probability: incorrect }
];

function mockNotifications(permission = 'granted') {
  const Notification = vi.fn(function Notification() {});
  Notification.permission = permission;
  Notification.requestPermission = vi.fn().mockResolvedValue('granted');
  vi.stubGlobal('Notification', Notification);
  return Notification;
}

const observe = (service, now, incorrect = 1, hidden = true) =>
  service.notifyIfNeeded({ hidden, predictions: prediction(incorrect), now });

afterEach(() => vi.unstubAllGlobals());

describe('Thông báo tư thế khi chuyển tab', () => {
  it('đợi đủ 3 giây sai liên tục trong tab ẩn rồi thông báo từ mức hiển thị 80%', () => {
    const Notification = mockNotifications();
    const service = new BrowserNotificationService();
    for (let now = 0; now <= 2_000; now += 1_000) {
      expect(observe(service, now, 0.8)).toBe(false);
    }
    expect(observe(service, 2_999, 0.8)).toBe(false);
    expect(observe(service, 3_000, 0.794)).toBe(false);
    expect(Notification).not.toHaveBeenCalled();
    expect(observe(service, 4_000, 0.7951)).toBe(true);
    expect(Notification).toHaveBeenCalledTimes(1);
  });

  it('gửi tiếp mỗi lần dự đoán sai từ 80% sau 3 giây liên tục', () => {
    const Notification = mockNotifications();
    const service = new BrowserNotificationService();
    for (let now = 0; now < 3_000; now += 1_000) observe(service, now);
    expect(observe(service, 3_000, 0.8)).toBe(true);
    expect(observe(service, 4_000, 0.9)).toBe(true);
    expect(observe(service, 5_000, 1)).toBe(true);
    expect(Notification).toHaveBeenCalledTimes(3);
    expect(Notification.mock.calls.every(([, options]) => !('tag' in options))).toBe(true);
  });

  it.each([
    ['trở về tab', { hidden: false, predictions: prediction(1) }],
    ['tư thế đúng', { hidden: true, predictions: prediction(0.1) }],
    ['không có dự đoán', { hidden: true, predictions: [] }]
  ])('đếm lại sau khi %s', (_reason, interruption) => {
    const Notification = mockNotifications();
    const service = new BrowserNotificationService();
    for (let now = 0; now < 2_000; now += 1_000) observe(service, now);
    service.notifyIfNeeded({ ...interruption, now: 2_000 });
    for (let now = 3_000; now < 6_000; now += 1_000) expect(observe(service, now)).toBe(false);
    expect(observe(service, 6_000)).toBe(true);
    expect(Notification).toHaveBeenCalledTimes(1);
  });

  it('đếm lại sau khi ngừng camera hoặc gián đoạn quan sát quá 5 giây', () => {
    const Notification = mockNotifications();
    const service = new BrowserNotificationService();
    observe(service, 0);
    observe(service, 1_000);
    service.reset();
    for (let now = 2_000; now <= 4_000; now += 1_000) observe(service, now);
    expect(observe(service, 9_001)).toBe(false);
    for (let now = 10_001; now < 12_001; now += 1_000) expect(observe(service, now)).toBe(false);
    expect(observe(service, 12_001)).toBe(true);
    expect(Notification).toHaveBeenCalledTimes(1);
  });

  it('không gửi khi quyền bị từ chối hoặc trình duyệt không hỗ trợ', () => {
    const Notification = mockNotifications('denied');
    const service = new BrowserNotificationService();
    for (let now = 0; now <= 11_000; now += 1_000) observe(service, now);
    expect(Notification).not.toHaveBeenCalled();
    vi.stubGlobal('Notification', undefined);
    expect(() => observe(service, 12_000)).not.toThrow();
  });

  it('chỉ yêu cầu quyền khi chưa được quyết định', async () => {
    const Notification = mockNotifications('default');
    const service = new BrowserNotificationService();
    await service.requestPermission();
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    Notification.permission = 'denied';
    await service.requestPermission();
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  });
});
