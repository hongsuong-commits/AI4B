import React, { useState, useEffect, useRef, useCallback } from 'react';
import ProHeader from './components/ProHeader.jsx';
import CameraPanel from './components/CameraPanel.jsx';
import PredictionPanel from './components/PredictionPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import RecordDetailModal from './components/RecordDetailModal.jsx';
import ConfirmationModal from './components/ConfirmationModal.jsx';
import ToastNotification from './components/ToastNotification.jsx';

import {
  TM_MODEL_URL,
  TM_CLASSES,
  AI_SOURCES
} from './constants/postureConfig.js';
import { teachableMachineAdapter } from './ai/teachableMachineAdapter.js';
import { calculatePostureMetrics } from './services/postureGeometry.js';
import { storageService } from './services/storageService.js';
import { exportHistoryToZip } from './services/zipExportService.js';
import { audioAlertService } from './services/audioAlertService.js';
import { browserNotificationService } from './services/browserNotificationService.js';
import { AutoSaveTimer, AUTO_SAVE_INTERVAL_MS } from './services/autoSaveTimer.js';

// Example predictions used only in simulation mode.
const DEFAULT_PREDICTIONS = [
  { className: TM_CLASSES.CORRECT, probability: 0.94 },
  { className: TM_CLASSES.INCORRECT, probability: 0.06 }
];

// Initial sample history if local storage is empty
const getInitialHistory = () => {
  const stored = storageService.getHistory();
  if (stored && stored.length > 0) return stored;
  return [
    {
      id: 'rec_sample_1',
      frameId: 1,
      source: 'auto',
      aiSource: AI_SOURCES.TEACHABLE_MACHINE,
      viewAngle: 'front',
      status: 'Incorrect Posture',
      className: 'Gù lưng / Cúi cổ',
      confidence: 0.85,
      postureScore: 35,
      metrics: { neckAngle: 32 },
      violations: ['FORWARD_HEAD'],
      image: null,
      capturedAt: '2026-11-12T03:25:30.000Z'
    }
  ];
};

export default function App() {
  // Settings
  const [settings, setSettings] = useState(() => {
    const stored = storageService.getSettings();
    return {
      ...stored,
      aiSource: AI_SOURCES.TEACHABLE_MACHINE,
      teachableMachineUrl: TM_MODEL_URL,
      enableVoiceAlert: stored.enableVoiceAlert !== undefined ? stored.enableVoiceAlert : true,
      enableAutoSave: stored.enableAutoSave !== undefined ? stored.enableAutoSave : true,
      enableSoundAlert: stored.enableSoundAlert !== undefined ? stored.enableSoundAlert : true,
      antiSpamWindow: stored.antiSpamWindow || 5
    };
  });

  // History & Storage
  const [history, setHistory] = useState(getInitialHistory);
  const [storageUsedBytes, setStorageUsedBytes] = useState(() => storageService.getEstimatedStorageUsage());

  // Camera & Stream
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const streamRef = useRef(null);
  const isStopRequestedRef = useRef(false);

  // Model Status
  const [modelStatus, setModelStatus] = useState({ isLoaded: false, isLoading: false, error: null });

  // Predictions, Pose & Mannequin state
  const [predictions, setPredictions] = useState(DEFAULT_PREDICTIONS);
  const [activePoseFrame, setActivePoseFrame] = useState(null);
  const [neckAngle, setNeckAngle] = useState(9);
  const [simulationState, setSimulationState] = useState('correct'); // 'correct' | 'hunch' | 'lean'

  // Stats matching screenshot defaults
  const [checkCount, setCheckCount] = useState(99);
  const [errorSaveCount, setErrorSaveCount] = useState(1);
  const [lastSaveTime, setLastSaveTime] = useState('2026-11-12T03:25:30.000Z');

  // UI Modals & Toasts
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Loop & Session Refs
  const isInferenceRunningRef = useRef(false);
  const autoSaveTimerRef = useRef(new AutoSaveTimer());
  const autoSaveEnabledRef = useRef(settings.enableAutoSave);
  const autoSaveGenerationRef = useRef(0);
  const lastPostureAlertRef = useRef(null);
  const sessionIdRef = useRef(`sess_${Date.now()}`);
  const frameCounterRef = useRef(99);

  // Toast Helper
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync sound settings
  useEffect(() => {
    audioAlertService.setEnabled(settings.enableSoundAlert);
  }, [settings.enableSoundAlert]);

  // Auto-load TM model on mount
  useEffect(() => {
    let isCancelled = false;
    const loadModel = async () => {
      setModelStatus({ isLoaded: false, isLoading: true, error: null });
      const success = await teachableMachineAdapter.loadModel(TM_MODEL_URL);
      if (!isCancelled) {
        if (success) {
          setModelStatus({ isLoaded: true, isLoading: false, error: null });
        } else {
          setModelStatus({
            isLoaded: false,
            isLoading: false,
            error: teachableMachineAdapter.loadError || 'Lỗi tải model'
          });
        }
      }
    };
    loadModel();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Update Settings Helper
  const handleUpdateSettings = useCallback((partial) => {
    if (partial.enableAutoSave !== undefined) {
      autoSaveEnabledRef.current = partial.enableAutoSave;
      if (!partial.enableAutoSave) {
        autoSaveTimerRef.current.reset();
        autoSaveGenerationRef.current += 1;
      }
    }
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      storageService.saveSettings(updated);
      return updated;
    });
  }, []);

  // Start Camera
  const handleStartCamera = useCallback(async () => {
    isStopRequestedRef.current = false;
    sessionIdRef.current = `sess_${Date.now()}`;
    browserNotificationService.reset();
    // Request from the user's click, before awaiting camera access.
    browserNotificationService.requestPermission().then((permission) => {
      if (permission !== 'granted') {
        addToast('Chưa có quyền gửi thông báo khi chuyển tab. Hãy kiểm tra quyền thông báo của trình duyệt.', 'warning', 6000);
      }
    });

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ MediaDevices API');
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (isStopRequestedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setPredictions([]);
      setActivePoseFrame(null);
      setNeckAngle(null);
      setCameraStream(stream);
      setIsCameraRunning(true);
      addToast('Camera đã sẵn sàng hoạt động!', 'success');
    } catch (err) {
      addToast('Không thể mở Camera: ' + err.message, 'danger', 6000);
      setIsCameraRunning(false);
    }
  }, [addToast]);

  // Stop Camera
  const handleStopCamera = useCallback(() => {
    isStopRequestedRef.current = true;
    browserNotificationService.reset();
    autoSaveTimerRef.current.reset();
    autoSaveGenerationRef.current += 1;
    lastPostureAlertRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
    setIsCameraRunning(false);
    setActivePoseFrame(null);
    setSimulationState('correct');
    setPredictions(DEFAULT_PREDICTIONS);
    setNeckAngle(9);
    isInferenceRunningRef.current = false;
  }, []);

  // Auto-save bad posture
  const autoSaveBadPosture = useCallback(async (poseFrame, topClass, topProb) => {
    if (!autoSaveEnabledRef.current || isStopRequestedRef.current) return;
    const generation = autoSaveGenerationRef.current;

    const video = document.getElementById('webcam-video');
    if (!video) return;

    try {
      const dataUrl = await storageService.compressVideoFrame(video);
      if (!dataUrl || !autoSaveEnabledRef.current || isStopRequestedRef.current || generation !== autoSaveGenerationRef.current) return;

      const metricsRes = poseFrame.keypoints
        ? calculatePostureMetrics({ keypoints: poseFrame.keypoints, thresholds: settings.thresholds || {} })
        : null;

      const record = {
        sessionId: sessionIdRef.current,
        frameId: ++frameCounterRef.current,
        source: 'auto',
        aiSource: AI_SOURCES.TEACHABLE_MACHINE,
        viewAngle: 'front',
        status: 'Incorrect Posture',
        className: topClass,
        confidence: topProb,
        postureScore: 30,
        metrics: metricsRes?.metrics || { neckAngle: neckAngle ?? 32 },
        violations: [],
        image: dataUrl,
        capturedAt: new Date().toISOString()
      };

      const res = await storageService.addRecord(record);
      if (res.success) {
        setLastSaveTime(new Date().toISOString());
        setErrorSaveCount((c) => c + 1);
        setHistory(storageService.getHistory());
        setStorageUsedBytes(storageService.getEstimatedStorageUsage());

      } else {
        addToast(res.message || 'Không thể tự động lưu ảnh.', 'warning');
      }
    } catch (e) {
      console.error('Auto-save error:', e);
      addToast('Không thể tự động lưu ảnh.', 'warning');
    }
  }, [
    settings.thresholds,
    neckAngle,
    addToast
  ]);

  // Real-time Inference Loop
  useEffect(() => {
    if (!isCameraRunning || !modelStatus.isLoaded) return;

    let isMounted = true;
    let scheduled = null;
    let inProgress = false;

    const cancelScheduled = () => {
      if (!scheduled) return;
      if (scheduled.type === 'frame') cancelAnimationFrame(scheduled.id);
      else clearTimeout(scheduled.id);
      scheduled = null;
    };

    const scheduleNext = () => {
      if (!isMounted || scheduled || inProgress) return;
      if (document.hidden) {
        scheduled = { type: 'timer', id: setTimeout(runLoop, 1000) };
      } else {
        scheduled = { type: 'frame', id: requestAnimationFrame(runLoop) };
      }
    };

    const onVisibilityChange = () => {
      browserNotificationService.reset();
      cancelScheduled();
      scheduleNext();
    };

    const runLoop = async () => {
      scheduled = null;
      if (!isMounted || !isCameraRunning) return;
      inProgress = true;

      const video = document.getElementById('webcam-video');
      const now = performance.now();

      if (video && video.readyState >= 2 && video.videoWidth > 0 && !isInferenceRunningRef.current) {
        isInferenceRunningRef.current = true;
        try {
          const poseResult = await teachableMachineAdapter.detectPose(video, now);

          if (isMounted) {
            setActivePoseFrame(poseResult);
            setCheckCount((c) => c + 1);

            if (poseResult.hasPerson && poseResult.modelPrediction) {
              const { allPredictions, className: topClass, probability: topProb } = poseResult.modelPrediction;

              setPredictions(allPredictions || []);
              browserNotificationService.notifyIfNeeded({
                hidden: document.hidden,
                predictions: allPredictions,
                now: performance.now()
              });

              // Neck Angle calculation
              if (poseResult.keypoints) {
                try {
                  const metricsRes = calculatePostureMetrics({
                    keypoints: poseResult.keypoints,
                    thresholds: settings.thresholds || {}
                  });
                  setNeckAngle(metricsRes?.metrics?.neckAngle ?? null);
                } catch {
                  setNeckAngle(null);
                }
              }

              // Save after each full interval of continuously incorrect posture.
              const observedAt = performance.now();
              if (autoSaveEnabledRef.current && topClass === TM_CLASSES.INCORRECT &&
                  (lastPostureAlertRef.current === null || observedAt - lastPostureAlertRef.current >= (settings.antiSpamWindow || 5) * 1000)) {
                lastPostureAlertRef.current = observedAt;
                if (settings.enableSoundAlert) audioAlertService.playIncorrectAlert();
                if (settings.enableVoiceAlert) {
                  audioAlertService.speakVoice(`Nhắc nhở: Bạn đang ${topClass}. Vui lòng ngồi thẳng lại!`);
                }
              }
              if (autoSaveTimerRef.current.observe({
                enabled: autoSaveEnabledRef.current,
                isIncorrect: topClass === TM_CLASSES.INCORRECT,
                now: observedAt
              })) {
                await autoSaveBadPosture(poseResult, topClass, topProb);
              }
            } else {
              browserNotificationService.reset();
              autoSaveTimerRef.current.reset();
              setPredictions([]);
              setNeckAngle(null);
            }
          }
        } catch (err) {
          browserNotificationService.reset();
          autoSaveTimerRef.current.reset();
          console.error('Inference error:', err);
        } finally {
          isInferenceRunningRef.current = false;
        }
      } else if (!video || video.readyState < 2 || video.videoWidth <= 0) {
        browserNotificationService.reset();
        autoSaveTimerRef.current.reset();
      }

      inProgress = false;
      scheduleNext();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    scheduleNext();

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelScheduled();
    };
  }, [isCameraRunning, modelStatus.isLoaded, autoSaveBadPosture, settings.thresholds, settings.enableSoundAlert, settings.enableVoiceAlert, settings.antiSpamWindow]);

  // Simulation Mode Click
  const handleSimulate = useCallback(
    (mode) => {
      setSimulationState(mode);
      setCheckCount((c) => c + 1);
      setActivePoseFrame(null);

      if (mode === 'correct') {
        setPredictions([
          { className: TM_CLASSES.CORRECT, probability: 0.94 },
          { className: TM_CLASSES.INCORRECT, probability: 0.06 }
        ]);
        setNeckAngle(9);
      } else if (mode === 'hunch') {
        setPredictions([
          { className: TM_CLASSES.CORRECT, probability: 0.04 },
          { className: TM_CLASSES.INCORRECT, probability: 0.96 }
        ]);
        setNeckAngle(32);
        if (settings.enableSoundAlert) audioAlertService.playIncorrectAlert();
        if (settings.enableVoiceAlert) {
          audioAlertService.speakVoice('Nhắc nhở: Bạn đang gù lưng, cúi cổ. Vui lòng ngồi thẳng lại!');
        }
      } else if (mode === 'lean') {
        setPredictions([
          { className: TM_CLASSES.CORRECT, probability: 0.03 },
          { className: TM_CLASSES.INCORRECT, probability: 0.97 }
        ]);
        setNeckAngle(18);
        if (settings.enableSoundAlert) audioAlertService.playIncorrectAlert();
        if (settings.enableVoiceAlert) {
          audioAlertService.speakVoice('Nhắc nhở: Bạn đang nghiêng người hoặc lệch vai. Vui lòng điều chỉnh lại!');
        }
      }
    },
    [settings.enableSoundAlert, settings.enableVoiceAlert]
  );

  // Manual Capture Now
  const handleCaptureNow = useCallback(async () => {
    const video = document.getElementById('webcam-video');
    try {
      let dataUrl = null;
      if (video && video.videoWidth > 0) {
        dataUrl = await storageService.compressVideoFrame(video);
      }

      const topPred = [...predictions].sort((a, b) => b.probability - a.probability)[0];
      if (!topPred) {
        addToast('Chưa có kết quả dự đoán để lưu.', 'warning');
        return;
      }
      const isBad = topPred.className === TM_CLASSES.INCORRECT;

      const record = {
        sessionId: sessionIdRef.current,
        frameId: ++frameCounterRef.current,
        source: 'manual',
        aiSource: AI_SOURCES.TEACHABLE_MACHINE,
        viewAngle: 'front',
        status: isBad ? 'Incorrect Posture' : 'Correct Posture',
        className: topPred?.className || 'Ngồi đúng tư thế',
        confidence: topPred?.probability || 0.94,
        postureScore: isBad ? 35 : 95,
        metrics: { neckAngle: neckAngle ?? 9 },
        violations: isBad ? ['MODEL_INCORRECT'] : [],
        image: dataUrl,
        capturedAt: new Date().toISOString()
      };

      const res = await storageService.addRecord(record);
      if (res.success) {
        setLastSaveTime(new Date().toISOString());
        if (isBad) {
          setErrorSaveCount((c) => c + 1);
        }
        setHistory(storageService.getHistory());
        setStorageUsedBytes(storageService.getEstimatedStorageUsage());
        audioAlertService.playShutterSound();
        addToast('Đã chụp và lưu thành công!', 'success');
      } else {
        addToast(res.message || 'Lỗi khi lưu', 'warning');
      }
    } catch (e) {
      addToast('Lỗi khi chụp ảnh: ' + e.message, 'danger');
    }
  }, [predictions, neckAngle, addToast]);

  // Clear History
  const handleConfirmClearHistory = useCallback(() => {
    storageService.clearHistory();
    setHistory([]);
    setStorageUsedBytes(0);
    setErrorSaveCount(0);
    setIsClearModalOpen(false);
    addToast('Đã xóa sạch lịch sử bản ghi.', 'info');
  }, [addToast]);

  // Export ZIP
  const handleExportZip = useCallback(async () => {
    if (!history || history.length === 0 || isExportingZip) return;
    setIsExportingZip(true);
    try {
      const res = await exportHistoryToZip(history, () => {});
      addToast(`Đã xuất ZIP thành công (${res.totalRecords} bản ghi)!`, 'success');
    } catch (err) {
      addToast('Lỗi khi xuất ZIP: ' + err.message, 'danger');
    } finally {
      setIsExportingZip(false);
    }
  }, [history, isExportingZip, addToast]);

  const hasKeypoints = isCameraRunning
    ? activePoseFrame?.hasPerson && activePoseFrame?.keypoints && Object.keys(activePoseFrame.keypoints).length > 0
    : true; // In simulation mode, keypoints are simulated OK

  return (
    <div className="pro-dashboard">
      {/* 1. Header Bar */}
      <ProHeader
        modelStatus={modelStatus}
        isCameraRunning={isCameraRunning}
        hasHistory={history.length > 0}
        isExportingZip={isExportingZip}
        onStartCamera={handleStartCamera}
        onStopCamera={handleStopCamera}
        onExportZip={handleExportZip}
      />

      {/* 2. Main 2-Column Layout matching Screenshot */}
      <div className="pro-main-layout">
        {/* Large Left Card: Workbench (Camera + Predictions) */}
        <div className="pro-card pro-workbench-card">
          {/* Workbench Top Header */}
          <div className="pro-workbench-header">
            <div className="pro-workbench-title">
              <span className="pro-header-label">Camera Trực Tiếp</span>
              <span className="pro-badge pro-badge-cyan">
                {isCameraRunning ? 'Webcam trực tiếp' : 'Chế độ: Mô phỏng AI'}
              </span>
            </div>
            <div className="pro-autosave-info">
              Tự động lưu: sau {AUTO_SAVE_INTERVAL_MS / 1000} giây ngồi sai liên tục
            </div>
          </div>

          {/* 2-Column Grid inside Workbench */}
          <div className="pro-workbench-grid">
            {/* Left Sub-column: Camera / Mannequin */}
            <CameraPanel
              isCameraRunning={isCameraRunning}
              stream={cameraStream}
              predictions={predictions}
              neckAngle={neckAngle}
              hasKeypoints={hasKeypoints}
              activePoseFrame={activePoseFrame}
              enableVoiceAlert={settings.enableVoiceAlert}
              onStartCamera={handleStartCamera}
              onSimulate={handleSimulate}
              simulationState={simulationState}
            />

            {/* Right Sub-column: Predictions & Controls */}
            <PredictionPanel
              predictions={predictions}
              checkCount={checkCount}
              errorSaveCount={errorSaveCount}
              lastSaveTime={lastSaveTime}
              enableSoundAlert={settings.enableSoundAlert}
              enableVoiceAlert={settings.enableVoiceAlert}
              enableAutoSave={settings.enableAutoSave}
              onToggleSoundAlert={(v) => handleUpdateSettings({ enableSoundAlert: v })}
              onToggleVoiceAlert={(v) => handleUpdateSettings({ enableVoiceAlert: v })}
              onToggleAutoSave={(v) => handleUpdateSettings({ enableAutoSave: v })}
              onCaptureNow={handleCaptureNow}
              onClearHistory={() => setIsClearModalOpen(true)}
            />
          </div>
        </div>

        {/* Right Column: History Panel */}
        <div className="pro-history-column">
          <HistoryPanel
            history={history}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
          />
        </div>
      </div>

      {/* Modals */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      <ConfirmationModal
        isOpen={isClearModalOpen}
        title="Xác nhận xóa lịch sử?"
        message="Toàn bộ hình ảnh và dữ liệu đánh giá tư thế đã lưu sẽ bị xóa vĩnh viễn khỏi thiết bị này. Các cài đặt cấu hình vẫn sẽ được giữ nguyên."
        confirmText="Xác nhận xóa hết"
        cancelText="Giữ lại"
        onConfirm={handleConfirmClearHistory}
        onCancel={() => setIsClearModalOpen(false)}
      />

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
