import { describe, it, expect, beforeEach } from 'vitest';
import { teachableMachineAdapter } from '../ai/teachableMachineAdapter.js';

describe('TeachableMachineAdapter Validation & Logic', () => {
  beforeEach(() => {
    teachableMachineAdapter.dispose();
  });

  it('rejects empty URL with appropriate error', async () => {
    const success = await teachableMachineAdapter.loadModel('');
    expect(success).toBe(false);
    expect(teachableMachineAdapter.loadError).toContain('Chưa cấu hình URL');
  });

  it('rejects placeholder <ID> URL with specific warning', async () => {
    const success = await teachableMachineAdapter.loadModel('https://teachablemachine.withgoogle.com/models/<ID>/');
    expect(success).toBe(false);
    expect(teachableMachineAdapter.loadError).toContain("URL chứa ký tự mẫu '<ID>'");
  });

  it('rejects training project URL with instruction to export', async () => {
    const success = await teachableMachineAdapter.loadModel('https://teachablemachine.withgoogle.com/train/pose/12345');
    expect(success).toBe(false);
    expect(teachableMachineAdapter.loadError).toContain('Đây là link trang huấn luyện trên trình duyệt');
  });

  it('validates file upload requiring all 3 files', async () => {
    // Chỉ truyền 1 file .json không đủ
    const incompleteFiles = [
      new File(['{}'], 'model.json', { type: 'application/json' })
    ];
    const success = await teachableMachineAdapter.loadModelFromFiles(incompleteFiles);
    expect(success).toBe(false);
    expect(teachableMachineAdapter.loadError).toContain('Vui lòng chọn đủ 3 tệp');
  });
});
