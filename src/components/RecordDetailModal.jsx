import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Award,
  Gauge
} from 'lucide-react';
import {
  STATUS_KEY,
  VIOLATION_LABELS,
  VIOLATION_MESSAGES
} from '../constants/postureConfig.js';

export default function RecordDetailModal({ record, onClose }) {
  if (!record) return null;

  const isCorrect =
    record.status === STATUS_KEY.CORRECT ||
    record.className === 'Ngồi đúng tư thế';
  const confidencePercent =
    typeof record.confidence === 'number'
      ? Math.round(record.confidence <= 1 ? record.confidence * 100 : record.confidence)
      : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 700 }}>
              Chi tiết bản ghi tư thế
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Mã ID: {record.id} · Khung: {record.frameId}
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Đóng">
            <X size={20} />
          </button>
        </div>

        {/* Khung ảnh chụp lớn */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#090d16',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {record.image ? (
            <img
              src={record.image}
              alt="Snapshot"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <p style={{ color: '#cbd5e1' }}>Không có ảnh đính kèm</p>
          )}

          {/* Badge trạng thái */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isCorrect ? 'rgba(4, 120, 87, 0.96)' : 'rgba(180, 35, 24, 0.96)',
              color: 'white',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>
              {isCorrect ? 'Đúng tư thế' : record.className || 'Sai tư thế'}
            </span>
          </div>
        </div>

        {/* Thông số tổng quan: Điểm tư thế & Độ tin cậy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Award size={24} color="#3b82f6" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Điểm tư thế</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {record.postureScore} / 100
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Gauge size={24} color="#8b5cf6" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence Khớp</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {confidencePercent !== null ? `${confidencePercent}%` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Thông tin metadata */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-main)',
            background: 'var(--bg-card-subtle)',
            padding: '12px',
            borderRadius: '8px'
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Thời gian:</span>{' '}
            {new Date(record.capturedAt).toLocaleString('vi-VN')}
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Nguồn chụp:</span>{' '}
            {record.source === 'auto' ? 'Tự động (Auto-save)' : 'Thủ công (Capture Now)'}
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Nguồn AI:</span>{' '}
            {record.aiSource === 'teachable-machine' ? 'Teachable Machine Pose' : 'MediaPipe Pose'}
          </div>
        </div>

        {/* Lỗi vi phạm và Gợi ý điều chỉnh */}
        {record.violations && record.violations.length > 0 ? (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b42318', fontWeight: 600, fontSize: '0.85rem' }}>
              <Lightbulb size={16} />
              <span>Gợi ý điều chỉnh:</span>
            </div>
            <ul style={{ paddingLeft: '20px', fontSize: '0.8rem', color: '#b42318', lineHeight: 1.6 }}>
              {record.violations.map((code) => (
                <li key={code}>
                  <strong>{VIOLATION_LABELS[code] || code}:</strong> {VIOLATION_MESSAGES[code] || 'Hãy điều chỉnh lại tư thế ngồi thẳng.'}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#047857',
              fontSize: '0.82rem'
            }}
          >
            <CheckCircle2 size={18} />
            <span>Tư thế chuẩn xác, người ngồi thẳng lưng và vai cân bằng.</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-outline btn-sm">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
