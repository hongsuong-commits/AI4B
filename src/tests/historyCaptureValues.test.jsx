import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import HistoryPanel from '../components/HistoryPanel.jsx';
import RecordDetailModal from '../components/RecordDetailModal.jsx';

describe('saved capture values in history and record detail', () => {
  it('shows each stored AI label and confidence without showing posture score in the list', () => {
    const html = renderToString(
      <HistoryPanel
        history={[
          { id: 'correct', className: 'Ngồi đúng tư thế', predictionLabel: 'Correct Posture', confidence: 0.92, postureScore: 72, capturedAt: '2026-11-24T11:00:00.000Z', capture_source: 'manual' },
          { id: 'incorrect', className: 'Ngồi sai tư thế', predictionLabel: 'Incorrect Posture', confidence: 0.85, postureScore: 24, capturedAt: '2026-11-24T11:01:00.000Z', capture_source: 'auto' },
          { id: 'missing', predictionLabel: 'Correct Posture', confidence: null, postureScore: null, capturedAt: '2026-11-24T11:02:00.000Z', capture_source: 'manual' }
        ]}
      />
    );

    expect(html).toContain('Correct Posture');
    expect(html).toContain('Incorrect Posture');
    expect(html).toContain('0.92');
    expect(html).toContain('0.85');
    expect(html).toContain('Tự động lưu');
    expect(html).toContain('Chụp thủ công');
    expect(html).toContain('—</span>');
    expect(html).not.toContain('Điểm tư thế');
    expect(html).not.toContain('72 / 100');
  });

  it('shows the stored score and confidence percent in detail, and dashes for missing values', () => {
    const detail = renderToString(
      <RecordDetailModal
        record={{
          id: 'rec_1',
          frameId: 3,
          capturedAt: '2026-11-24T11:00:00.000Z',
          status: 'Correct Posture',
          predictionLabel: 'Correct Posture',
          confidence: 0.92,
          postureScore: 72.5,
          capture_source: 'manual'
        }}
        onClose={() => {}}
      />
    );
    expect(detail).toContain('Correct Posture</div>');
    expect(detail).toContain('92%');
    expect(detail).toContain('72.5 / 100');

    const missing = renderToString(
      <RecordDetailModal
        record={{ id: 'rec_missing', capturedAt: '2026-11-24T11:00:00.000Z', status: 'Correct Posture' }}
        onClose={() => {}}
      />
    );
    expect(missing).toContain('Độ tin cậy AI');
    expect(missing).toContain('Điểm tư thế');
    expect(missing.match(/—/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
