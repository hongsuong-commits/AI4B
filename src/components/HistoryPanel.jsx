import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return isoString;
  }
}

function getSeverity(confidence) {
  if (confidence >= 0.8) return { label: 'Cao', cls: 'pro-badge-red' };
  if (confidence >= 0.6) return { label: 'Trung bình', cls: 'pro-badge-orange' };
  return { label: 'Thấp', cls: 'pro-badge-green' };
}

export default function HistoryPanel({
  history = [],
  onSelectRecord
}) {
  const count = history ? history.length : 0;

  return (
    <div className="pro-card pro-history-card">
      <div className="pro-card-header">
        <div className="pro-card-title">
          <span>Lịch sử phát hiện</span>
        </div>
        <span className="pro-badge pro-badge-count">{count} mục</span>
      </div>

      {count === 0 ? (
        <div className="pro-empty-history">
          <ImageIcon size={36} color="#475569" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Chưa có bản ghi nào</p>
          <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Nhấn "Chụp Ngay" hoặc bật "Tự động lưu ảnh lỗi" để bắt đầu ghi lại.
          </p>
        </div>
      ) : (
        <div className="pro-history-list">
          {history.map((record) => {
            const rawConf = typeof record.confidence === 'number'
              ? (record.confidence > 1 ? record.confidence / 100 : record.confidence)
              : 0.85;
            const severity = getSeverity(rawConf);
            const neckAngle = record.metrics?.neckAngle ?? 32;

            const isCorrect = (record.className || record.status) === 'Ngồi đúng tư thế';
            const isHunch = (record.className || record.status) === 'Gù lưng / Cúi cổ';

            const titleColor = isCorrect ? '#047857' : isHunch ? '#92400e' : '#b42318';

            return (
              <div
                key={record.id}
                className="pro-history-item"
                onClick={() => onSelectRecord && onSelectRecord(record)}
                title="Nhấn để xem chi tiết bản ghi"
              >
                {/* Thumbnail */}
                <div className="pro-history-thumb">
                  {record.image ? (
                    <img src={record.image} alt="capture thumbnail" loading="lazy" />
                  ) : (
                    <div className="pro-history-thumb-sim">
                      {/* Mini posture silhouette thumbnail */}
                      <svg viewBox="0 0 80 80" width="100%" height="100%">
                        <circle cx="40" cy="50" r="16" fill="rgba(251, 191, 36, 0.2)" />
                        <line x1="40" y1="58" x2="36" y2="34" stroke="#fbbf24" strokeWidth="2.5" />
                        <line x1="24" y1="38" x2="48" y2="34" stroke="#fbbf24" strokeWidth="2.5" />
                        <circle cx="33" cy="22" r="6" stroke="#fbbf24" strokeWidth="2" fill="none" />
                        <circle cx="33" cy="22" r="1.5" fill="#ffffff" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="pro-history-info">
                  <div className="pro-history-class">
                    <span style={{ color: titleColor }}>
                      {record.className || record.status || 'Gù lưng / Cúi cổ'}
                    </span>
                    <span className="pro-history-conf">
                      {' — '}
                      {rawConf.toFixed(2)}
                    </span>
                  </div>
                  <div className="pro-history-date">{formatDateTime(record.capturedAt)}</div>
                  <div className="pro-history-badges">
                    <span className="pro-badge pro-badge-neck">
                      <span className="pro-dot-red" />
                      Góc cổ: {Math.round(neckAngle)}°
                    </span>
                    <span className={`pro-badge ${severity.cls}`}>
                      Mức độ: {severity.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
