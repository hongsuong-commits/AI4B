import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PredictionPanel from '../components/PredictionPanel.jsx';
import CameraPanel from '../components/CameraPanel.jsx';
import { TM_CLASSES } from '../constants/postureConfig.js';

describe('Two-class posture model display', () => {
  it('shows the actual correct and incorrect probabilities', () => {
    const predictions = [
      { className: TM_CLASSES.CORRECT, probability: 0.12 },
      { className: TM_CLASSES.INCORRECT, probability: 0.88 }
    ];
    const html = renderToString(<PredictionPanel predictions={predictions} />);
    expect(html).toContain('Ngồi đúng tư thế');
    expect(html).toContain('Ngồi sai tư thế');
    expect(html).toContain('0.12');
    expect(html).toContain('0.88');
    expect(html).not.toContain('Gù lưng / Cúi cổ');
    expect(html).not.toContain('Nghiêng người / Lệch vai');
  });

  it('does not display a stale posture when no prediction is available', () => {
    const panel = renderToString(<PredictionPanel predictions={[]} />);
    const camera = renderToString(<CameraPanel isCameraRunning predictions={[]} neckAngle={null} />);
    expect(panel).toContain('Chưa có dự đoán');
    expect(camera).toContain('Chưa có dự đoán');
    expect(camera).not.toContain('Tư thế chuẩn');
  });
});
