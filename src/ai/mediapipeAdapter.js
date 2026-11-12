import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { KEYPOINT_NAMES, createKeypoint, createStandardPoseFrame } from './aiContract.js';

class MediaPipeAdapter {
  constructor() {
    this.poseLandmarker = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadError = null;
    this.delegate = 'GPU';
  }

  async loadModel() {
    if (this.isLoaded && this.poseLandmarker) {
      return true;
    }

    if (this.isLoading) {
      // Đang tải
      return false;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      // Thử nạp WASM từ local trước, nếu lỗi thì dùng CDN
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (e) {
        console.warn('Không tải được local WASM, thử nạp từ CDN jsdelivery...', e);
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
      }

      // Thử nạp model với GPU delegate trước, nếu lỗi thì chuyển sang CPU
      const modelCandidates = [
        '/models/pose_landmarker_lite.task',
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
      ];

      let lastError = null;
      for (const modelPath of modelCandidates) {
        try {
          this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          this.delegate = 'GPU';
          break;
        } catch (gpuError) {
          console.warn(`GPU delegate thất bại với ${modelPath}, thử CPU...`, gpuError);
          try {
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: modelPath,
                delegate: 'CPU'
              },
              runningMode: 'VIDEO',
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5
            });
            this.delegate = 'CPU';
            break;
          } catch (cpuError) {
            lastError = cpuError;
          }
        }
      }

      if (!this.poseLandmarker) {
        throw lastError || new Error('Không thể khởi tạo MediaPipe Pose Landmarker');
      }

      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error('Lỗi nạp MediaPipe Pose Landmarker:', err);
      this.isLoaded = false;
      this.isLoading = false;
      this.loadError = err.message || 'Lỗi khởi tạo MediaPipe';
      return false;
    }
  }

  detectPose(videoElement, timestamp = performance.now()) {
    if (!this.isLoaded || !this.poseLandmarker || !videoElement) {
      return createStandardPoseFrame({
        timestamp,
        aiSource: 'mediapipe',
        hasPerson: false
      });
    }

    try {
      // detectForVideo yêu cầu timestamp tăng đơn điệu
      const result = this.poseLandmarker.detectForVideo(videoElement, timestamp);

      if (!result || !result.landmarks || result.landmarks.length === 0) {
        return createStandardPoseFrame({
          timestamp,
          aiSource: 'mediapipe',
          hasPerson: false,
          raw: result
        });
      }

      const rawLandmarks = result.landmarks[0];
      // Ánh xạ 33 điểm của MediaPipe sang chuẩn Keypoints
      const keypoints = {
        [KEYPOINT_NAMES.NOSE]: createKeypoint(
          KEYPOINT_NAMES.NOSE,
          rawLandmarks[0].x,
          rawLandmarks[0].y,
          rawLandmarks[0].visibility ?? 1.0,
          rawLandmarks[0].z
        ),
        [KEYPOINT_NAMES.LEFT_EYE]: createKeypoint(
          KEYPOINT_NAMES.LEFT_EYE,
          rawLandmarks[2].x,
          rawLandmarks[2].y,
          rawLandmarks[2].visibility ?? 1.0,
          rawLandmarks[2].z
        ),
        [KEYPOINT_NAMES.RIGHT_EYE]: createKeypoint(
          KEYPOINT_NAMES.RIGHT_EYE,
          rawLandmarks[5].x,
          rawLandmarks[5].y,
          rawLandmarks[5].visibility ?? 1.0,
          rawLandmarks[5].z
        ),
        [KEYPOINT_NAMES.LEFT_EAR]: createKeypoint(
          KEYPOINT_NAMES.LEFT_EAR,
          rawLandmarks[7].x,
          rawLandmarks[7].y,
          rawLandmarks[7].visibility ?? 1.0,
          rawLandmarks[7].z
        ),
        [KEYPOINT_NAMES.RIGHT_EAR]: createKeypoint(
          KEYPOINT_NAMES.RIGHT_EAR,
          rawLandmarks[8].x,
          rawLandmarks[8].y,
          rawLandmarks[8].visibility ?? 1.0,
          rawLandmarks[8].z
        ),
        [KEYPOINT_NAMES.LEFT_SHOULDER]: createKeypoint(
          KEYPOINT_NAMES.LEFT_SHOULDER,
          rawLandmarks[11].x,
          rawLandmarks[11].y,
          rawLandmarks[11].visibility ?? 1.0,
          rawLandmarks[11].z
        ),
        [KEYPOINT_NAMES.RIGHT_SHOULDER]: createKeypoint(
          KEYPOINT_NAMES.RIGHT_SHOULDER,
          rawLandmarks[12].x,
          rawLandmarks[12].y,
          rawLandmarks[12].visibility ?? 1.0,
          rawLandmarks[12].z
        ),
        [KEYPOINT_NAMES.LEFT_ELBOW]: createKeypoint(
          KEYPOINT_NAMES.LEFT_ELBOW,
          rawLandmarks[13].x,
          rawLandmarks[13].y,
          rawLandmarks[13].visibility ?? 1.0,
          rawLandmarks[13].z
        ),
        [KEYPOINT_NAMES.RIGHT_ELBOW]: createKeypoint(
          KEYPOINT_NAMES.RIGHT_ELBOW,
          rawLandmarks[14].x,
          rawLandmarks[14].y,
          rawLandmarks[14].visibility ?? 1.0,
          rawLandmarks[14].z
        ),
        [KEYPOINT_NAMES.LEFT_WRIST]: createKeypoint(
          KEYPOINT_NAMES.LEFT_WRIST,
          rawLandmarks[15].x,
          rawLandmarks[15].y,
          rawLandmarks[15].visibility ?? 1.0,
          rawLandmarks[15].z
        ),
        [KEYPOINT_NAMES.RIGHT_WRIST]: createKeypoint(
          KEYPOINT_NAMES.RIGHT_WRIST,
          rawLandmarks[16].x,
          rawLandmarks[16].y,
          rawLandmarks[16].visibility ?? 1.0,
          rawLandmarks[16].z
        ),
        [KEYPOINT_NAMES.LEFT_HIP]: createKeypoint(
          KEYPOINT_NAMES.LEFT_HIP,
          rawLandmarks[23].x,
          rawLandmarks[23].y,
          rawLandmarks[23].visibility ?? 1.0,
          rawLandmarks[23].z
        ),
        [KEYPOINT_NAMES.RIGHT_HIP]: createKeypoint(
          KEYPOINT_NAMES.RIGHT_HIP,
          rawLandmarks[24].x,
          rawLandmarks[24].y,
          rawLandmarks[24].visibility ?? 1.0,
          rawLandmarks[24].z
        )
      };

      // Tính min confidence trong các khớp thân chính (tai, vai, hông)
      const coreKeys = [
        KEYPOINT_NAMES.LEFT_SHOULDER,
        KEYPOINT_NAMES.RIGHT_SHOULDER,
        KEYPOINT_NAMES.LEFT_HIP,
        KEYPOINT_NAMES.RIGHT_HIP
      ];
      const minConfidence = Math.min(...coreKeys.map(k => keypoints[k]?.score ?? 1.0));

      return createStandardPoseFrame({
        timestamp,
        aiSource: 'mediapipe',
        keypoints,
        hasPerson: true,
        minConfidence,
        raw: result
      });
    } catch (err) {
      console.error('Lỗi khi suy luận MediaPipe Pose:', err);
      return createStandardPoseFrame({
        timestamp,
        aiSource: 'mediapipe',
        hasPerson: false
      });
    }
  }

  dispose() {
    if (this.poseLandmarker) {
      try {
        this.poseLandmarker.close();
      } catch (e) {
        console.warn('Lỗi đóng poseLandmarker:', e);
      }
      this.poseLandmarker = null;
    }
    this.isLoaded = false;
    this.isLoading = false;
  }
}

export const mediaPipeAdapter = new MediaPipeAdapter();
