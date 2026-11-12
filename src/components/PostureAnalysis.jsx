import React from 'react';
import {
  Compass,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge
} from 'lucide-react';
import { STATUS_KEY } from '../constants/postureConfig.js';

// Helper định dạng giây thành HH:MM:SS
function formatDuration(totalSeconds) {
  const sec = Math.floor(totalSeconds || 0);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

export default function PostureAnalysis({
  currentStatus,
  confidence,
  sittingDuration,
  isCameraRunning,
  hasValidPose
}) {
  const isIncorrect = currentStatus === STATUS_KEY.INCORRECT;

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <Compass size={20} />
          <span>Posture Analysis</span>
        </div>
      </div>

      {/* Ba chỉ số chính: Current Status (lớn), Sitting Duration, Confidence */}
      <div className="stat-highlight-grid">
        {/* Current Status */}
        <div className="stat-box" style={{ gridColumn: 'span 2' }}>
          <span className="stat-box-label">Current Status</span>
          <div
            className={`stat-box-value ${isIncorrect ? 'incorrect' : 'correct'}`}
            style={{ fontSize: '1.25rem', lineHeight: 1.3, fontWeight: 700 }}
          >
            {isIncorrect ? (
              <>
                <XCircle size={22} />
                <span>Sai tư thế</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={22} />
                <span>Đúng tư thế</span>
              </>
            )}
          </div>
        </div>

        {/* Confidence */}
        <div className="stat-box">
          <span className="stat-box-label">Confidence</span>
          <div className="stat-box-value">
            <Gauge size={20} color="#3b82f6" style={{ marginRight: '4px' }} />
            <span>{confidence !== null && hasValidPose ? `${confidence}%` : '—'}</span>
          </div>
        </div>

        {/* Sitting Duration */}
        <div className="stat-box" style={{ gridColumn: 'span 3' }}>
          <span className="stat-box-label">Sitting Duration (Thời gian ngồi)</span>
          <div className="stat-box-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem' }}>
            <Clock size={22} color="#8b5cf6" style={{ marginRight: '6px' }} />
            <span>{formatDuration(sittingDuration)}</span>
          </div>
        </div>
      </div>

      {/* Thẻ gợi ý và phản hồi trực quan theo trạng thái */}
      <div
        style={{
          background: isIncorrect
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${
            isIncorrect ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
          }`,
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginTop: '6px'
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: isIncorrect
              ? 'rgba(239, 68, 68, 0.18)'
              : 'rgba(16, 185, 129, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isIncorrect ? '#ef4444' : '#10b981',
            flexShrink: 0
          }}
        >
          {isIncorrect ? <XCircle size={24} /> : <CheckCircle2 size={24} />}
        </div>
        <div>
          <h4
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: isIncorrect ? '#f87171' : '#34d399',
              marginBottom: '4px'
            }}
          >
            {isIncorrect ? 'Cảnh báo: Sai tư thế ngồi' : 'Tư thế ngồi đang rất tốt'}
          </h4>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45, margin: 0 }}>
            {isIncorrect
              ? 'Hãy ngồi thẳng lưng, đưa vai về vị trí tự nhiên và giữ đầu thẳng hàng với thân để bảo vệ cột sống.'
              : 'Bạn đang duy trì tư thế ngồi thẳng và chuẩn. Hãy giữ vững tư thế này nhé!'}
          </p>
        </div>
      </div>
    </div>
  );
}
