import React from 'react';
import {
  Activity,
  Camera,
  Square,
  Download,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AI_SOURCES } from '../constants/postureConfig.js';

export default function DashboardHeader({
  aiSource,
  modelStatus, // { isLoaded, isLoading, error }
  isCameraRunning,
  hasHistory,
  isExportingZip,
  exportProgress,
  onStartCamera,
  onStopCamera,
  onExportZip,
  onRetryLoadModel
}) {
  const getAiSourceName = () => {
    return aiSource === AI_SOURCES.TEACHABLE_MACHINE
      ? 'Teachable Machine Pose'
      : 'MediaPipe Pose Landmarker';
  };

  return (
    <header className="dashboard-header">
      {/* Brand & Subtitle */}
      <div className="header-brand">
        <div className="brand-icon">
          <Activity size={24} />
        </div>
        <div className="brand-info">
          <h1>AI Seat Posture – Dashboard</h1>
          <p>Hệ thống nhận diện và cảnh báo tư thế ngồi bằng AI</p>
        </div>
      </div>

      {/* AI Source & Model Status */}
      <div className="header-status-group">
        <div className="badge-ai-source">
          <Cpu size={14} />
          <span>{getAiSourceName()}</span>
        </div>

        {modelStatus.isLoading ? (
          <div className="badge-model-status loading">
            <RefreshCw size={14} className="spin" />
            <span>Đang tải Model...</span>
          </div>
        ) : modelStatus.isLoaded ? (
          <div className="badge-model-status loaded">
            <CheckCircle2 size={14} />
            <span>Model: Loaded</span>
          </div>
        ) : (
          <div className="badge-model-status not-loaded">
            <AlertCircle size={14} />
            <span>Model: Not Loaded</span>
            {modelStatus.error && (
              <span style={{ fontSize: '0.72rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={modelStatus.error}>
                ({modelStatus.error})
              </span>
            )}
            <button
              onClick={onRetryLoadModel}
              className="btn btn-outline btn-sm"
              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
              title="Thử tải lại model"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Main Action Buttons */}
      <div className="header-actions">
        {!isCameraRunning ? (
          <button
            onClick={onStartCamera}
            className="btn btn-primary"
            id="start-camera-btn"
          >
            <Camera size={18} />
            <span>Start Camera</span>
          </button>
        ) : (
          <button
            onClick={onStopCamera}
            className="btn btn-danger"
            id="stop-camera-btn"
          >
            <Square size={16} />
            <span>Stop Camera</span>
          </button>
        )}

        <button
          onClick={onExportZip}
          className="btn btn-success"
          disabled={!hasHistory || isExportingZip}
          title={!hasHistory ? 'Chưa có bản ghi lịch sử để xuất ZIP' : 'Tải xuống gói ZIP'}
          id="export-zip-header-btn"
        >
          {isExportingZip ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>{exportProgress?.message || 'Đang xuất ZIP...'}</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>Export ZIP</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
