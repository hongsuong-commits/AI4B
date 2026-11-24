import React from 'react';
import { TM_CLASSES } from '../constants/postureConfig.js';

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

export default function PredictionPanel({
  predictions,
  checkCount = 99,
  errorSaveCount = 1,
  lastSaveTime = '2026-11-12T03:25:30.000Z',
  enableSoundAlert,
  enableVoiceAlert,
  enableAutoSave,
  onToggleSoundAlert,
  onToggleVoiceAlert,
  onToggleAutoSave,
  onCaptureNow,
  onClearHistory
}) {
  const ordered = [TM_CLASSES.CORRECT, TM_CLASSES.INCORRECT].map((className) => {
    const found = (predictions || []).find((p) => p.className === className);
    return { className, probability: found?.probability ?? null };
  });

  const topPrediction = predictions && predictions.length > 0
    ? [...predictions].sort((a, b) => b.probability - a.probability)[0]
    : null;

  const isCorrect = topPrediction?.className === TM_CLASSES.CORRECT;

  const getBarColor = (index) => {
    if (index === 0) return '#10b981'; // green - correct
    return '#f87171'; // red - incorrect
  };

  const getScoreColor = (index) => {
    if (index === 0) return '#047857';
    return '#b42318';
  };

  return (
    <div className="pro-prediction-col">
      <div className="pro-pred-title">
        Dự đoán AI (Predictions)
      </div>

      {/* Model class probabilities */}
      <div className="pro-pred-bars">
        {ordered.map((pred, i) => (
          <div key={pred.className} className="pro-pred-row">
            <div className="pro-pred-row-header">
              <span className="pro-pred-label">{pred.className}:</span>
              <span
                className="pro-pred-value"
                style={{ color: getScoreColor(i) }}
              >
                {pred.probability === null ? '—' : pred.probability.toFixed(2)}
              </span>
            </div>
            <div className="pro-pred-track">
              <div
                className="pro-pred-fill"
                style={{
                  width: `${pred.probability === null ? 0 : Math.round(pred.probability * 100)}%`,
                  background: getBarColor(i)
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Stats 2x2 Grid */}
      <div className="pro-stats-grid">
        <div className="pro-stat-box">
          <span className="pro-stat-key">Đã kiểm tra:</span>
          <span className="pro-stat-val bold-num">{checkCount}</span>
        </div>
        <div className="pro-stat-box">
          <span className="pro-stat-key">Đã lưu lỗi:</span>
          <span className="pro-stat-val bold-num">{errorSaveCount}</span>
        </div>
        <div className="pro-stat-box pro-stat-full">
          <span className="pro-stat-key">Lưu gần nhất:</span>
          <span className="pro-stat-val font-mono">{formatDateTime(lastSaveTime)}</span>
        </div>
        <div className="pro-stat-box pro-stat-full">
          <span className="pro-stat-key">Trạng thái ngồi:</span>
          <span className={`pro-badge ${!topPrediction ? 'pro-badge-cyan' : isCorrect ? 'pro-badge-green' : 'pro-badge-red'}`}>
            {!topPrediction ? 'Chưa có dự đoán' : isCorrect ? 'Tư thế chuẩn' : topPrediction.className}
          </span>
        </div>
      </div>

      {/* Action Buttons: Chụp Ngay & Xóa Lịch Sử */}
      <div className="pro-action-row">
        <button className="btn pro-btn-capture" onClick={onCaptureNow}>
          Chụp Ngay
        </button>
        <button className="btn pro-btn-clear" onClick={onClearHistory}>
          Xóa Lịch Sử
        </button>
      </div>

      {/* 3 Checkboxes */}
      <div className="pro-checks-list">
        <div className="pro-check-item">
          <span className="pro-check-title">Âm thanh cảnh báo (bật/tắt)</span>
          <label className="pro-checkbox-label">
            <input
              type="checkbox"
              aria-label="Âm thanh cảnh báo"
              checked={!!enableSoundAlert}
              onChange={(e) => onToggleSoundAlert(e.target.checked)}
            />
          </label>
        </div>

        <div className="pro-check-item">
          <span className="pro-check-title">Giọng nói nhắc nhở (bật/tắt)</span>
          <label className="pro-checkbox-label">
            <input
              type="checkbox"
              aria-label="Giọng nói nhắc nhở"
              checked={!!enableVoiceAlert}
              onChange={(e) => onToggleVoiceAlert(e.target.checked)}
            />
          </label>
        </div>

        <div className="pro-check-item">
          <span className="pro-check-title">Tự động lưu ảnh lỗi (bật/tắt)</span>
          <label className="pro-checkbox-label">
            <input
              type="checkbox"
              aria-label="Tự động lưu ảnh lỗi"
              checked={!!enableAutoSave}
              onChange={(e) => onToggleAutoSave(e.target.checked)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
