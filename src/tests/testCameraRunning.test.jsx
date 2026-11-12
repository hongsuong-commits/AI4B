import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LiveCamera from '../components/LiveCamera.jsx';
import PostureAnalysis from '../components/PostureAnalysis.jsx';
import RecordDetailModal from '../components/RecordDetailModal.jsx';
import { STATUS_KEY } from '../constants/postureConfig.js';

describe('Components with Camera Running', () => {
  it('renders LiveCamera with isCameraRunning=true', () => {
    const html = renderToString(
      <LiveCamera
        isCameraRunning={true}
        cameraError={null}
        modelStatus={{ isLoaded: true, isLoading: false, error: null }}
        currentStatus={STATUS_KEY.CORRECT}
        hasValidPose={true}
        activePoseFrame={{
          hasPerson: true,
          keypoints: {
            leftShoulder: { x: 0.4, y: 0.5, score: 0.9 },
            rightShoulder: { x: 0.6, y: 0.5, score: 0.9 },
            leftHip: { x: 0.45, y: 0.8, score: 0.9 },
            rightHip: { x: 0.55, y: 0.8, score: 0.9 }
          }
        }}
        isAutoSaveEnabled={true}
        autoSaveInterval={3}
        mirrorVideo={true}
        onToggleMirror={() => {}}
        onCaptureNow={() => {}}
        isCapturing={false}
        onRetryCamera={() => {}}
      />
    );
    expect(html).toContain('webcam-video');
    expect(html).toContain('canvas-overlay');
    expect(html).toContain('Đúng tư thế');
  });

  it('renders PostureAnalysis with active pose', () => {
    const html = renderToString(
      <PostureAnalysis
        currentStatus={STATUS_KEY.CORRECT}
        confidence={95}
        sittingDuration={120}
        isCameraRunning={true}
        hasValidPose={true}
      />
    );
    expect(html).toContain('Đúng tư thế');
    expect(html).toContain('00:02:00');
    expect(html).toContain('95%');
  });

  it('renders RecordDetailModal when open', () => {
    const html = renderToString(
      <RecordDetailModal
        record={{
          id: 'rec_1',
          frameId: 1,
          capturedAt: new Date().toISOString(),
          source: 'manual',
          aiSource: 'mediapipe',
          status: STATUS_KEY.CORRECT,
          confidence: 90,
          postureScore: 95,
          image: 'data:image/jpeg;base64,123'
        }}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Chi tiết bản ghi');
    expect(html).toContain('Đúng tư thế');
  });
});
