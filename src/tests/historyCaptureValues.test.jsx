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
          { id: 'incorrect', className: 'Ngồi sai tư thế', predictionLabel: 'Incorrect Posture', confidence: 0.87, postureScore: 24, capturedAt: '2026-11-24T11:01:00.000Z', capture_source: 'auto' },
          { id: 'near-perfect', className: 'Ngồi đúng tư thế', confidence: 0.996, capturedAt: '2026-11-24T11:02:00.000Z', capture_source: 'manual' },
          { id: 'missing', predictionLabel: 'Correct Posture', confidence: null, postureScore: null, capturedAt: '2026-11-24T11:03:00.000Z', capture_source: 'manual' }
        ]}
      />
    );

    expect(html).toContain('Ngồi đúng tư thế');
    expect(html).toContain('Ngồi sai tư thế');
    expect(html).toContain('0.92');
    expect(html).toContain('0.87');
    expect(html).toContain('0.996');
    expect(html).not.toContain('— <!-- -->1.00');
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
    expect(detail).toContain('Đúng tư thế</span>');
    expect(detail).toContain('92%');
    expect(detail).toContain('72.5 / 100');

    const nearPerfectDetail = renderToString(
      <RecordDetailModal record={{ id: 'rec_996', confidence: 0.996 }} onClose={() => {}} />
    );
    expect(nearPerfectDetail).toContain('99.6%');
    const detailAt87 = renderToString(
      <RecordDetailModal record={{ id: 'rec_87', confidence: 0.87 }} onClose={() => {}} />
    );
    expect(detailAt87).toContain('87%');

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
