import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { STATUS_KEY } from '../constants/postureConfig.js';
import { SKELETON_CONNECTIONS } from '../ai/aiContract.js';

export default function LiveCamera({
  isCameraRunning,
  stream,
  cameraError,
  modelStatus,
  currentStatus,
  hasValidPose,
  activePoseFrame,
  isAutoSaveEnabled,
  autoSaveInterval,
  mirrorVideo,
  onToggleMirror,
  onCaptureNow,
  isCapturing,
  onRetryCamera
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [showShutterFlash, setShowShutterFlash] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // Gán luồng video trực tiếp qua ref
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (stream) {
        video.srcObject = stream;
        video.play().catch((err) => {
          console.warn('Tự động phát video gặp lỗi:', err);
        });
      } else {
        video.srcObject = null;
      }
    }
  }, [stream]);

  // Vẽ skeleton lên Canvas overlay
  const drawSkeleton = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !isCameraRunning) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cập nhật kích thước canvas khớp với kích thước hiển thị thực tế của video container
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 360;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (!activePoseFrame || !activePoseFrame.hasPerson || !activePoseFrame.keypoints) {
      return;
    }

    const { keypoints } = activePoseFrame;
    const isCorrect = currentStatus === STATUS_KEY.CORRECT;
    const isIncorrect = currentStatus === STATUS_KEY.INCORRECT;

    // Chọn màu sắc khung xương theo trạng thái tư thế
    let strokeColor = 'rgba(100, 116, 139, 0.7)'; // Insufficient
    let jointColor = '#94a3b8';
    if (isCorrect) {
      strokeColor = 'rgba(16, 185, 129, 0.85)'; // Green
      jointColor = '#10b981';
    } else if (isIncorrect) {
      strokeColor = 'rgba(239, 68, 68, 0.85)'; // Red
      jointColor = '#ef4444';
    }

    // Tính toán vùng hiển thị thực tế của video theo object-fit: contain để tọa độ canvas khớp 100%
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;
    const containerAspect = width / height;
    const videoAspect = videoWidth / videoHeight;

    let renderWidth = width;
    let renderHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > videoAspect) {
      // Pillarboxed (khoảng đen ở hai bên trái/phải)
      renderHeight = height;
      renderWidth = height * videoAspect;
      offsetX = (width - renderWidth) / 2;
    } else {
      // Letterboxed (khoảng đen ở trên/dưới)
      renderWidth = width;
      renderHeight = width / videoAspect;
      offsetY = (height - renderHeight) / 2;
    }

    // Helper quy đổi tọa độ chuẩn [0..1] sang pixel canvas, có tính đến chế độ gương và tỷ lệ hiển thị
    const getCanvasPoint = (kp) => {
      if (!kp || !Number.isFinite(kp.x) || !Number.isFinite(kp.y)) return null;
      let px = offsetX + kp.x * renderWidth;
      if (mirrorVideo) {
        px = width - px;
      }
      const py = offsetY + kp.y * renderHeight;
      return { x: px, y: py, score: kp.score };
    };

    // 1. Vẽ các đường nối xương (Skeleton Connections)
    ctx.lineWidth = 3;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [partA, partB] of SKELETON_CONNECTIONS) {
      const pA = getCanvasPoint(keypoints[partA]);
      const pB = getCanvasPoint(keypoints[partB]);

      if (pA && pB && (pA.score ?? 1) >= 0.25 && (pB.score ?? 1) >= 0.25) {
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    }

    // 2. Vẽ các điểm khớp (Keypoints)
    for (const key of Object.keys(keypoints)) {
      const pt = getCanvasPoint(keypoints[key]);
      if (pt && (pt.score ?? 1) >= 0.25) {
        // Vòng ngoài
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = jointColor;
        ctx.fill();

        // Viền trắng nổi bật
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
  }, [activePoseFrame, currentStatus, isCameraRunning, mirrorVideo]);

  // Cập nhật canvas mỗi khi có pose mới hoặc thay đổi kích thước
  useEffect(() => {
    drawSkeleton();
  }, [drawSkeleton]);

  // Xử lý hiệu ứng chớp sáng khi bấm Chụp
  const handleCaptureClick = async () => {
    setShowShutterFlash(true);
    setTimeout(() => setShowShutterFlash(false), 250);
    if (onCaptureNow) {
      await onCaptureNow();
    }
  };

  // Lấy nhãn và class trạng thái trên video (chỉ hiện Đúng tư thế và Sai tư thế)
  const getStatusOverlay = () => {
    if (!isCameraRunning) return null;

    if (currentStatus === STATUS_KEY.INCORRECT) {
      return (
        <div className="posture-status-pill incorrect">
          <XCircle size={16} />
          <span>Sai tư thế</span>
        </div>
      );
    }
    return (
      <div className="posture-status-pill correct">
        <CheckCircle2 size={16} />
        <span>Đúng tư thế</span>
      </div>
    );
  };

  const isCaptureDisabled =
    !isCameraRunning ||
    !modelStatus.isLoaded ||
    !hasValidPose ||
    isCapturing;

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <Camera size={20} />
          <span>Live Camera</span>
        </div>

        <div className="camera-meta">
          <label title="Lật gương video để thuận chiều quan sát webcam">
            <input
              type="checkbox"
              checked={mirrorVideo}
              onChange={onToggleMirror}
            />
            <span>Chế độ gương</span>
          </label>
        </div>
      </div>

      {/* Vùng hiển thị video webcam */}
      <div className="video-viewport" ref={containerRef}>
        {isCameraRunning ? (
          <>
            <video
              ref={videoRef}
              id="webcam-video"
              className={`camera-feed ${mirrorVideo ? 'mirrored' : ''}`}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                setVideoDimensions({
                  width: e.target.videoWidth,
                  height: e.target.videoHeight
                });
              }}
            />
            <canvas ref={canvasRef} id="overlay-canvas" className="canvas-overlay" />

            {/* Banner trạng thái đè trên video */}
            <div className="video-status-overlay">
              {getStatusOverlay()}

              {isAutoSaveEnabled && (
                <div className="autosave-active-pill">
                  <div className="pulse-dot" />
                  <span>Auto-save: BẬT ({autoSaveInterval}s)</span>
                </div>
              )}
            </div>

            {/* Hướng dẫn khi chưa phát hiện đủ khớp */}
            {isCameraRunning && !hasValidPose && (
              <div className="camera-guide-prompt">
                <AlertTriangle size={18} />
                <span>
                  Vui lòng ngồi vào khung hình hoặc điều chỉnh góc camera để thấy rõ đầu, vai và hông.
                </span>
              </div>
            )}

            {/* Chớp màn trập khi chụp */}
            {showShutterFlash && <div className="shutter-flash" />}
          </>
        ) : (
          <div className="camera-placeholder">
            {cameraError ? (
              <>
                <div className="camera-placeholder-icon" style={{ color: '#ef4444' }}>
                  <AlertTriangle size={42} />
                </div>
                <div style={{ maxWidth: '440px', textAlign: 'center', padding: '0 16px' }}>
                  <p style={{ color: '#f87171', fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>
                    {cameraError.title || 'Lỗi truy cập Camera'}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '16px', lineHeight: 1.5 }}>
                    {cameraError.message}
                  </p>
                  <button onClick={onRetryCamera} className="btn btn-primary btn-sm" style={{ margin: '0 auto' }}>
                    <RotateCw size={14} />
                    <span>Thử lại</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="camera-placeholder-icon">
                  <CameraOff size={36} />
                </div>
                <p style={{ fontWeight: 600, color: '#cbd5e1' }}>Camera chưa bật</p>
                <p style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  Nhấn nút "Start Camera" ở góc trên để bắt đầu theo dõi tư thế.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Thanh điều khiển dưới video */}
      <div className="camera-controls-bar">
        <button
          onClick={handleCaptureClick}
          className="btn btn-primary"
          disabled={isCaptureDisabled}
          id="capture-now-btn"
          title={
            !isCameraRunning
              ? 'Vui lòng bật camera để chụp'
              : !hasValidPose
              ? 'Chờ dữ liệu khớp hợp lệ để chụp'
              : 'Chụp lại khung hình đánh giá hiện tại'
          }
        >
          <Camera size={16} />
          <span>Capture Now</span>
        </button>

        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
          {isCameraRunning && videoDimensions.width > 0 && (
            <span>Độ phân giải: {videoDimensions.width}x{videoDimensions.height}</span>
          )}
        </div>
      </div>
    </div>
  );
}
