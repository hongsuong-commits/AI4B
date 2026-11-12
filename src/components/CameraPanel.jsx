import React, { useRef, useEffect, useCallback } from 'react';
import { SKELETON_CONNECTIONS } from '../ai/aiContract.js';
import { TM_CLASSES } from '../constants/postureConfig.js';

export default function CameraPanel({
  isCameraRunning,
  stream,
  predictions,
  neckAngle = 9,
  hasKeypoints = true,
  activePoseFrame,
  enableVoiceAlert,
  onStartCamera,
  onSimulate,
  simulationState = 'correct'
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Top prediction
  const topPrediction = predictions && predictions.length > 0
    ? [...predictions].sort((a, b) => b.probability - a.probability)[0]
    : null;

  const isCorrect = topPrediction?.className === TM_CLASSES.CORRECT;
  const isIncorrect = topPrediction?.className === TM_CLASSES.INCORRECT;
  const postureNote = isCorrect
    ? 'Bạn đang ngồi đúng tư thế.'
    : isIncorrect
      ? 'Bạn đang ngồi sai tư thế. Hãy ngồi thẳng lại.'
      : 'Chưa có dự đoán tư thế.';

  // Stream binding
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      } else {
        video.srcObject = null;
      }
    }
  }, [stream]);

  // Draw real skeleton on canvas when camera is running
  const drawSkeleton = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !isCameraRunning) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth || 400;
    const height = canvas.clientHeight || 300;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);

    if (!activePoseFrame || !activePoseFrame.hasPerson || !activePoseFrame.keypoints) return;

    const { keypoints } = activePoseFrame;
    let strokeColor = 'rgba(74, 222, 128, 0.85)';
    let jointColor = '#4ade80';

    if (isIncorrect) {
      strokeColor = 'rgba(248, 113, 113, 0.85)';
      jointColor = '#f87171';
    }

    const videoWidth = video?.videoWidth || 640;
    const videoHeight = video?.videoHeight || 480;
    const containerAspect = width / height;
    const videoAspect = videoWidth / videoHeight;

    let renderWidth = width;
    let renderHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > videoAspect) {
      renderHeight = height;
      renderWidth = height * videoAspect;
      offsetX = (width - renderWidth) / 2;
    } else {
      renderWidth = width;
      renderHeight = width / videoAspect;
      offsetY = (height - renderHeight) / 2;
    }

    const getCanvasPoint = (kp) => {
      if (!kp || !Number.isFinite(kp.x) || !Number.isFinite(kp.y)) return null;
      return {
        x: offsetX + kp.x * renderWidth,
        y: offsetY + kp.y * renderHeight,
        score: kp.score
      };
    };

    ctx.lineWidth = 3.5;
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

    for (const key of Object.keys(keypoints)) {
      const pt = getCanvasPoint(keypoints[key]);
      if (pt && (pt.score ?? 1) >= 0.25) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = jointColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
  }, [activePoseFrame, isIncorrect, isCameraRunning]);

  useEffect(() => {
    drawSkeleton();
  }, [drawSkeleton]);

  // Status badge logic
  const statusPillClass = isCorrect ? 'correct' : isIncorrect ? 'lean' : '';
  const statusLabel = isCorrect
    ? 'Tư thế chuẩn'
    : topPrediction
    ? topPrediction.className
    : 'Chưa có dự đoán';
  const displayNeckAngle = neckAngle !== null && neckAngle !== undefined ? `${Math.round(neckAngle)}°` : '—';

  // Render stylized SVG mannequin for simulation / standby mode
  const renderMannequinSvg = () => {
    if (simulationState === 'hunch') {
      // Gù lưng / Cúi cổ: Head shifted forward/down, curved spine
      return (
        <svg viewBox="0 0 320 280" className="pro-mannequin-svg">
          {/* Chair / Pelvic zone */}
          <circle cx="160" cy="205" r="50" fill="rgba(250, 204, 21, 0.12)" />
          {/* Spine curved forward */}
          <path d="M 160 205 Q 148 160 142 125" stroke="#facc15" strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* Shoulders slouching */}
          <line x1="95" y1="138" x2="185" y2="132" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          {/* Shoulder dots */}
          <circle cx="95" cy="138" r="4.5" fill="#ffffff" />
          <circle cx="142" cy="125" r="4.5" fill="#ffffff" />
          <circle cx="185" cy="132" r="4.5" fill="#ffffff" />
          {/* Neck forward */}
          <line x1="142" y1="125" x2="128" y2="92" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          {/* Head circle tilted */}
          <circle cx="128" cy="76" r="18" stroke="#facc15" strokeWidth="3" fill="none" />
          <circle cx="128" cy="76" r="3.5" fill="#ffffff" />
          {/* Base point */}
          <circle cx="160" cy="205" r="4" fill="#ffffff" />
        </svg>
      );
    }

    if (simulationState === 'lean') {
      // Nghiêng người / Lệch vai: Shoulders tilted, spine angled
      return (
        <svg viewBox="0 0 320 280" className="pro-mannequin-svg">
          {/* Chair / Pelvic zone */}
          <circle cx="160" cy="205" r="50" fill="rgba(248, 113, 113, 0.12)" />
          {/* Angled spine */}
          <line x1="160" y1="205" x2="148" y2="120" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
          {/* Tilted shoulders */}
          <line x1="95" y1="135" x2="200" y2="105" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
          {/* Shoulder dots */}
          <circle cx="95" cy="135" r="4.5" fill="#ffffff" />
          <circle cx="148" cy="120" r="4.5" fill="#ffffff" />
          <circle cx="200" cy="105" r="4.5" fill="#ffffff" />
          {/* Neck */}
          <line x1="148" y1="120" x2="142" y2="85" stroke="#f87171" strokeWidth="4" strokeLinecap="round" />
          {/* Head */}
          <circle cx="142" cy="70" r="18" stroke="#f87171" strokeWidth="3" fill="none" />
          <circle cx="142" cy="70" r="3.5" fill="#ffffff" />
          {/* Base point */}
          <circle cx="160" cy="205" r="4" fill="#ffffff" />
        </svg>
      );
    }

    // Default: Ngồi thẳng (Tư thế chuẩn) - matching screenshot exactly!
    return (
      <svg viewBox="0 0 320 280" className="pro-mannequin-svg">
        {/* Large translucent green circle (chair / pelvic zone) */}
        <circle cx="160" cy="190" r="52" fill="rgba(34, 197, 94, 0.16)" />
        {/* Vertical straight spine line */}
        <line x1="160" y1="230" x2="160" y2="115" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
        {/* Horizontal straight shoulder bar */}
        <line x1="105" y1="115" x2="215" y2="115" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
        {/* Shoulder dots */}
        <circle cx="105" cy="115" r="4.5" fill="#ffffff" />
        <circle cx="160" cy="115" r="4.5" fill="#ffffff" />
        <circle cx="215" cy="115" r="4.5" fill="#ffffff" />
        {/* Head outer ring */}
        <circle cx="160" cy="76" r="19" stroke="#10b981" strokeWidth="3.5" fill="none" />
        {/* Head inner white center dot */}
        <circle cx="160" cy="76" r="4" fill="#ffffff" />
        {/* Base spine dot */}
        <circle cx="160" cy="230" r="4" fill="#ffffff" />
      </svg>
    );
  };

  return (
    <div className="pro-camera-col">
      {/* Viewport with grid pattern */}
      <div className="pro-video-viewport">
        {/* Real video if camera is active */}
        {isCameraRunning ? (
          <>
            <video
              ref={videoRef}
              id="webcam-video"
              className="pro-camera-feed"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} id="overlay-canvas" className="canvas-overlay" />
          </>
        ) : (
          /* Stylized mannequin on cyber grid */
          <div className="pro-mannequin-container">
            {renderMannequinSvg()}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )}

        {/* Top-left status overlay pill */}
        <div className={`pro-status-pill ${statusPillClass}`}>
          <span className="pro-status-dot-sm" />
          <span>{statusLabel}</span>
        </div>

        {/* Bottom-left telemetry info */}
        <div className="pro-video-bottom-bar">
          AI Keypoints: {hasKeypoints ? 'OK' : 'MISSING'} • Độ lệch: {displayNeckAngle}
        </div>
      </div>

      {/* Row of 4 control buttons */}
      <div className="pro-camera-buttons">
        <button
          className="btn pro-btn-webcam"
          onClick={onStartCamera}
          title="Bật webcam máy tính để nhận diện trực tiếp"
        >
          Dùng Webcam Thật
        </button>

        <div className="pro-sim-group">
          <button
            className={`btn pro-btn-sim-correct ${simulationState === 'correct' ? 'active' : ''}`}
            disabled={isCameraRunning}
            onClick={() => onSimulate('correct')}
            title="Mô phỏng tư thế ngồi thẳng chuẩn"
          >
            Ngồi thẳng
          </button>
          <button
            className={`btn pro-btn-sim-hunch ${simulationState === 'hunch' ? 'active' : ''}`}
            disabled={isCameraRunning}
            onClick={() => onSimulate('hunch')}
            title="Mô phỏng tư thế gù lưng / cúi cổ"
          >
            Gù lưng
          </button>
          <button
            className={`btn pro-btn-sim-lean ${simulationState === 'lean' ? 'active' : ''}`}
            disabled={isCameraRunning}
            onClick={() => onSimulate('lean')}
            title="Mô phỏng tư thế nghiêng người / lệch vai"
          >
            Nghiêng vai
          </button>
        </div>
      </div>
      {!enableVoiceAlert && (
        <div
          className={`pro-voice-note ${isCorrect ? 'correct' : isIncorrect ? 'incorrect' : 'pending'}`}
          role="status"
        >
          {postureNote}
        </div>
      )}
    </div>
  );
}
