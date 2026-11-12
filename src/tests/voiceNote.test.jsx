import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import CameraPanel from '../components/CameraPanel.jsx';
import { TM_CLASSES } from '../constants/postureConfig.js';

function renderNote({ predictions, enableVoiceAlert = false, isCameraRunning = true }) {
  const html = renderToString(
    <CameraPanel
      predictions={predictions}
      enableVoiceAlert={enableVoiceAlert}
      isCameraRunning={isCameraRunning}
    />
  );
  return html.match(/<[^>]*role="status"[^>]*>(.*?)<\/[^>]+>/)?.[1].replaceAll('<!-- -->', '') ?? null;
}

describe('Thông báo tư thế khi tắt giọng nói', () => {
  it('hiển thị tư thế có xác suất cao nhất khi camera đang chạy', () => {
    expect(renderNote({ predictions: [
      { className: TM_CLASSES.INCORRECT, probability: 0.1 },
      { className: TM_CLASSES.CORRECT, probability: 0.9 }
    ] })).toBe('Bạn đang ngồi đúng tư thế.');
    expect(renderNote({ predictions: [
      { className: TM_CLASSES.CORRECT, probability: 0.2 },
      { className: TM_CLASSES.INCORRECT, probability: 0.8 }
    ] })).toBe('Bạn đang ngồi sai tư thế. Hãy ngồi thẳng lại.');
  });

  it('cho biết khi chưa có dự đoán và không thêm tiền tố mô phỏng', () => {
    expect(renderNote({ predictions: [] })).toBe('Chưa có dự đoán tư thế.');
    expect(renderNote({
      predictions: [{ className: TM_CLASSES.CORRECT, probability: 0.9 }],
      isCameraRunning: false
    })).toBe('Bạn đang ngồi đúng tư thế.');
  });

  it('ẩn thông báo khi giọng nói được bật', () => {
    expect(renderNote({
      predictions: [{ className: TM_CLASSES.INCORRECT, probability: 0.9 }],
      enableVoiceAlert: true
    })).toBeNull();
  });

  it('đặt thông báo sau nút dùng webcam thật', () => {
    const html = renderToString(<CameraPanel
      predictions={[{ className: TM_CLASSES.CORRECT, probability: 0.9 }]}
      enableVoiceAlert={false}
    />);
    expect(html.indexOf('Dùng Webcam Thật')).toBeGreaterThan(-1);
    expect(html.indexOf('role="status"')).toBeGreaterThan(html.indexOf('Dùng Webcam Thật'));
  });
});
