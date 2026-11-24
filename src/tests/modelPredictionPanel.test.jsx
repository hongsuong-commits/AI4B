import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PredictionPanel from '../components/PredictionPanel.jsx';
import CameraPanel from '../components/CameraPanel.jsx';
import { TM_CLASSES } from '../constants/postureConfig.js';

describe('Two-class posture model display', () => {
  it('shows model probabilities accurately and clears stale predictions', () => {
    const predictions = [
      { className: TM_CLASSES.CORRECT, probability: 0.12 },
      { className: TM_CLASSES.INCORRECT, probability: 0.88 }
    ];
    const html = renderToString(<PredictionPanel predictions={predictions} />);
    expect(html).toContain('0.12');
    expect(html).toContain('0.88');
    expect(html).toContain('Ngồi đúng tư thế');
    expect(html).toContain('Ngồi sai tư thế');

    const nearOne = renderToString(<PredictionPanel predictions={[{ className: TM_CLASSES.CORRECT, probability: 0.996 }]} />);
    expect(nearOne).toContain('0.996');
    expect(nearOne).not.toContain('1.00');

    const emptyPanel = renderToString(<PredictionPanel predictions={[]} />);
    const emptyCamera = renderToString(<CameraPanel isCameraRunning predictions={[]} neckAngle={null} />);
    expect(emptyPanel).toContain('Chưa có dự đoán');
    expect(emptyCamera).toContain('Chưa có dự đoán');
    expect(emptyCamera).not.toContain('Tư thế chuẩn');
  });
});
