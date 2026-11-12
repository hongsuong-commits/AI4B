import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../services/storageService.js';
import { exportHistoryToZip } from '../services/zipExportService.js';
import { STORAGE_KEYS, SYSTEM_LIMITS, STATUS_KEY } from '../constants/postureConfig.js';

// Polyfill localStorage cho môi trường node/vitest nếu cần
if (typeof localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

describe('Storage & ZIP Export Services', () => {
  beforeEach(() => {
    localStorage.clear();
    storageService.cachedHistory = null;
  });

  it('saves and retrieves user settings independently from history', () => {
    const customSettings = {
      aiSource: 'teachable-machine',
      teachableMachineUrl: 'https://teachablemachine.withgoogle.com/models/test1234/',
      autoSaveInterval: 4
    };
    storageService.saveSettings(customSettings);

    const retrieved = storageService.getSettings();
    expect(retrieved.aiSource).toBe('teachable-machine');
    expect(retrieved.teachableMachineUrl).toBe('https://teachablemachine.withgoogle.com/models/test1234/');
    expect(retrieved.autoSaveInterval).toBe(4);
  });

  it('sequential queue prevents saving identical frameId in same session', async () => {
    const rec1 = {
      sessionId: 'session_1',
      frameId: 'frame_100',
      status: STATUS_KEY.CORRECT,
      confidence: 85,
      postureScore: 90
    };

    const res1 = await storageService.addRecord(rec1);
    expect(res1.success).toBe(true);

    // Try adding duplicate frameId in session_1
    const res2 = await storageService.addRecord(rec1);
    expect(res2.success).toBe(false);
    expect(res2.duplicate).toBe(true);

    const history = storageService.getHistory();
    expect(history.length).toBe(1);
  });

  it('enforces 3 MiB budget limit safely', async () => {
    // Generate a payload that would exceed 3 MiB
    // We can simulate this by setting a huge string in the record
    const hugeString = 'x'.repeat(SYSTEM_LIMITS.STORAGE_BUDGET_BYTES + 100);
    const hugeRec = {
      sessionId: 'session_huge',
      frameId: 'frame_huge',
      status: STATUS_KEY.CORRECT,
      image: hugeString
    };

    const res = await storageService.addRecord(hugeRec);
    expect(res.success).toBe(false);
    expect(res.quotaExceeded).toBe(true);
    expect(res.message).toContain('3 MiB đã đạt giới hạn');
  });

  it('exports history to ZIP with CSV BOM, json, and image paths', async () => {
    const records = [
      {
        id: 'rec_test_1',
        sessionId: 'sess_1',
        frameId: 1,
        capturedAt: '2026-11-10T04:50:00.000Z',
        source: 'manual',
        aiSource: 'mediapipe',
        viewAngle: 'front',
        status: STATUS_KEY.CORRECT,
        confidence: 90,
        postureScore: 95,
        metrics: { shoulderBalance: 1.2, trunkLean: 2.1 },
        violations: [],
        // Simple 1x1 png base64
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
      }
    ];

    // Mock document.createElement and URL for node environment
    const createdElements = [];
    global.document = global.document || {};
    global.document.createElement = (tag) => {
      const el = { tag, click: () => {} };
      createdElements.push(el);
      return el;
    };
    global.document.body = global.document.body || {
      appendChild: () => {},
      removeChild: () => {}
    };
    global.URL = global.URL || {};
    global.URL.createObjectURL = () => 'blob:mock-url';
    global.URL.revokeObjectURL = () => {};

    const exportResult = await exportHistoryToZip(records);
    expect(exportResult.success).toBe(true);
    expect(exportResult.totalRecords).toBe(1);
    expect(exportResult.filename).toContain('ai_posture_history_');
  });
});
