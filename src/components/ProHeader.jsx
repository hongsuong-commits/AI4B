import React from 'react';
import { Download } from 'lucide-react';

export default function ProHeader({
  modelStatus,
  isCameraRunning,
  hasHistory,
  isExportingZip,
  onStartCamera,
  onStopCamera,
  onExportZip
}) {
  const getModelStatusPill = () => {
    if (modelStatus.isLoading) {
      return (
        <span className="pro-model-pill loading">
          <span className="pro-status-dot loading-dot" />
          Mô hình: Đang tải...
        </span>
      );
    }
    if (modelStatus.error) {
      return (
        <span className="pro-model-pill error">
          <span className="pro-status-dot error-dot" />
          Mô hình: Lỗi
        </span>
      );
    }
    if (modelStatus.isLoaded) {
      return (
        <span className="pro-model-pill ready">
          <span className="pro-status-dot ready-dot" />
          Mô hình: Đã sẵn sàng
        </span>
      );
    }
    return (
      <span className="pro-model-pill loading">
        <span className="pro-status-dot loading-dot" />
        Mô hình: Đang tải...
      </span>
    );
  };

  return (
    <header className="pro-header">
      <div className="pro-header-brand">
        <div className="pro-ts-avatar">TS</div>
        <div className="pro-brand-info">
          <h1 className="pro-brand-title">Posture AI — Bảng Điều Khiển Tư Thế (Pro UI)</h1>
          <p className="pro-brand-subtitle">
            Nhận diện tư thế ngồi đúng / sai — Lưu ảnh tự động &amp; Xuất báo cáo
          </p>
        </div>
      </div>

      <div className="pro-header-actions">
        {getModelStatusPill()}

        {isCameraRunning ? (
          <>
            <button className="btn pro-btn-camera-running" disabled>
              <span className="pro-status-dot ready-dot" />
              Camera đang chạy
            </button>
            <button className="btn pro-btn-camera-stop" onClick={onStopCamera}>
              Tắt Camera
            </button>
          </>
        ) : (
          <button className="btn pro-btn-camera-start" onClick={onStartCamera}>
            Bật Camera
          </button>
        )}

        <button
          className="btn pro-btn-export"
          onClick={onExportZip}
          disabled={!hasHistory || isExportingZip}
          title={!hasHistory ? 'Chưa có bản ghi để xuất' : 'Xuất báo cáo ZIP và CSV'}
        >
          <Download size={15} />
          Xuất báo cáo (CSV/ZIP)
        </button>
      </div>
    </header>
  );
}
