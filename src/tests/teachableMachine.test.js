import { describe, it, expect, beforeEach } from 'vitest';
import { teachableMachineAdapter, selectTopPrediction } from '../ai/teachableMachineAdapter.js';

describe('TeachableMachineAdapter Validation & Logic', () => {
  it('preserves the maximum model probability without rounding it to 1.00', () => {
    for (const [values, expected] of [
      [[0.07, 0.93], 0.93],
      [[0.92, 0.08], 0.92],
      [[0.15, 0.85], 0.85],
      [[0.004, 0.996], 0.996],
      [[0, 1], 1.00]
    ]) {
      const result = selectTopPrediction(values.map((probability, index) => ({ className: `class-${index}`, probability })));
      expect(result.probability).toBe(expected);
    }
  });

  beforeEach(() => {
    teachableMachineAdapter.dispose();
  });

  it('rejects invalid model URLs and incomplete file uploads', async () => {
    for (const [url, message] of [
      ['', 'Chưa cấu hình URL'],
      ['https://teachablemachine.withgoogle.com/models/<ID>/', "URL chứa ký tự mẫu '<ID>'"],
      ['https://teachablemachine.withgoogle.com/train/pose/12345', 'Đây là link trang huấn luyện trên trình duyệt']
    ]) {
      expect(await teachableMachineAdapter.loadModel(url)).toBe(false);
      expect(teachableMachineAdapter.loadError).toContain(message);
    }
    expect(await teachableMachineAdapter.loadModelFromFiles([
      new File(['{}'], 'model.json', { type: 'application/json' })
    ])).toBe(false);
    expect(teachableMachineAdapter.loadError).toContain('Vui lòng chọn đủ 3 tệp');
  });
});
