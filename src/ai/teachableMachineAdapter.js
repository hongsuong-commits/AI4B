import JSZip from 'jszip';
import { KEYPOINT_NAMES, createKeypoint, createStandardPoseFrame } from './aiContract.js';

class TeachableMachineAdapter {
  constructor() {
    this.model = null;
    this.modelUrl = '';
    this.isLoaded = false;
    this.isLoading = false;
    this.loadError = null;
    this.metadata = null;
    this.scriptLoadingPromise = null;
  }

  /**
   * Tải thư viện tfjs và teachablemachine-pose động vào trang nếu chưa có sẵn
   */
  async ensureLibrariesLoaded() {
    if (typeof window !== 'undefined' && window.tmPose && window.tf) {
      return true;
    }
    if (typeof window === 'undefined') {
      return true;
    }

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = (async () => {
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${src}"]`);
          if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
            if (window.tmPose && window.tf) return resolve();
            return;
          }

          const script = document.createElement('script');
          script.src = src;
          script.async = false;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Không thể nạp thư viện từ ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        if (!window.tf) {
          try {
            await loadScript('/libs/tf.min.js');
          } catch {
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js');
          }
        }

        if (!window.tmPose) {
          try {
            await loadScript('/libs/teachablemachine-pose.min.js');
          } catch {
            await loadScript('https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js');
          }
        }

        if (!window.tmPose) {
          throw new Error('Thư viện @teachablemachine/pose không khởi tạo được trên window');
        }

        return true;
      } catch (err) {
        console.error('Lỗi nạp thư viện Teachable Machine Pose:', err);
        throw err;
      }
    })();

    return this.scriptLoadingPromise;
  }

  /**
   * Nạp model Teachable Machine từ URL do người dùng cung cấp
   */
  async loadModel(url) {
    let cleanUrl = (url || '').trim().replace(/^['"`]+|['"`]+$/g, '');
    this.modelUrl = cleanUrl;

    if (!cleanUrl) {
      this.isLoaded = false;
      this.isLoading = false;
      this.model = null;
      this.loadError = 'Chưa cấu hình URL model Teachable Machine';
      return false;
    }

    // 1. Kiểm tra nếu người dùng vô tình giữ nguyên placeholder <ID>
    if (cleanUrl.includes('<') || cleanUrl.includes('>') || cleanUrl.includes('YOUR_MODEL_ID')) {
      this.isLoaded = false;
      this.isLoading = false;
      this.model = null;
      this.loadError = "URL chứa ký tự mẫu '<ID>'. Vui lòng dán liên kết thực tế nhận được sau khi bấm 'Upload my model' trên Teachable Machine (ví dụ: https://teachablemachine.withgoogle.com/models/abc123xyz/).";
      return false;
    }

    // 2. Kiểm tra nếu người dùng dán link trang train thay vì link xuất bản
    if (cleanUrl.includes('teachablemachine.withgoogle.com/train/')) {
      this.isLoaded = false;
      this.isLoading = false;
      this.model = null;
      this.loadError = "Đây là link trang huấn luyện trên trình duyệt, không phải link model đã xuất bản. Trong trang Teachable Machine, bấm 'Export Model' -> chọn tab 'TensorFlow.js' -> bấm 'Upload my model' để nhận link.";
      return false;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      await this.ensureLibrariesLoaded();

      let base = cleanUrl;
      if (base.endsWith('model.json')) {
        base = base.replace(/model\.json$/, '');
      }
      if (!base.endsWith('/')) {
        base = base + '/';
      }
      const modelJson = base + 'model.json';
      const metadataJson = base + 'metadata.json';

      // Kiểm tra file metadata và model trước để bắt lỗi mạng/CORS sớm
      try {
        const metaRes = await fetch(metadataJson);
        if (!metaRes.ok) {
          if (metaRes.status === 404) {
            throw new Error(`Mã lỗi HTTP 404: Không tìm thấy model tại đường dẫn này. Hãy chắc chắn bạn đã nhấn 'Upload my model' (hoặc 'Update cloud model') trên Teachable Machine để Google tải model lên máy chủ.`);
          } else if (metaRes.status === 403) {
            throw new Error(`Mã lỗi HTTP 403: Không có quyền truy cập vào liên kết này.`);
          }
          throw new Error(`Mã lỗi HTTP ${metaRes.status}`);
        }
        this.metadata = await metaRes.json();
      } catch (fetchErr) {
        throw new Error(fetchErr.message || 'Lỗi mạng hoặc CORS không thể truy cập URL.');
      }

      // Gọi window.tmPose.load()
      this.model = await window.tmPose.load(modelJson, metadataJson);
      if (this.model.getMetadata) {
        this.metadata = this.model.getMetadata();
      }

      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error('Lỗi khi nạp model Teachable Machine:', err);
      this.isLoaded = false;
      this.isLoading = false;
      this.model = null;
      this.loadError = err.message || 'Lỗi không xác định khi nạp model';
      return false;
    }
  }

  /**
   * Nạp model trực tiếp từ tệp cục bộ:
   * Chấp nhận tệp .ZIP (chứa model.json, metadata.json, weights.bin)
   * HOẶC chọn cả 3 tệp riêng lẻ.
   */
  async loadModelFromFiles(filesInput) {
    this.isLoading = true;
    this.loadError = null;

    try {
      const files = Array.from(filesInput || []);
      if (files.length === 0) {
        throw new Error('Chưa có tệp nào được chọn.');
      }

      let modelFile = null;
      let weightsFile = null;
      let metadataFile = null;

      // Trường hợp 1: Người dùng tải lên 1 tệp .ZIP
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        const zipFile = files[0];
        const zip = await JSZip.loadAsync(zipFile);

        for (const filename of Object.keys(zip.files)) {
          const entry = zip.files[filename];
          if (entry.dir) continue;
          const lower = filename.toLowerCase();

          if (lower.endsWith('metadata.json')) {
            const blob = await entry.async('blob');
            metadataFile = new File([blob], 'metadata.json', { type: 'application/json' });
          } else if (lower.endsWith('model.json')) {
            const blob = await entry.async('blob');
            modelFile = new File([blob], 'model.json', { type: 'application/json' });
          } else if (lower.endsWith('.bin')) {
            const blob = await entry.async('blob');
            const cleanName = filename.split('/').pop();
            weightsFile = new File([blob], cleanName, { type: 'application/octet-stream' });
          }
        }

        if (!modelFile || !metadataFile || !weightsFile) {
          throw new Error('Tệp ZIP thiếu một trong các tệp bắt buộc: model.json, metadata.json, weights.bin');
        }

        this.modelUrl = `Tệp ZIP (${zipFile.name})`;
      } else {
        // Trường hợp 2: Người dùng chọn 3 tệp lẻ
        for (const f of files) {
          const lower = f.name.toLowerCase();
          if (lower.includes('metadata') && lower.endsWith('.json')) {
            metadataFile = f;
          } else if (lower.endsWith('model.json') || (lower.endsWith('.json') && !lower.includes('metadata'))) {
            modelFile = f;
          } else if (lower.endsWith('.bin')) {
            weightsFile = f;
          }
        }

        if (!modelFile || !metadataFile || !weightsFile) {
          throw new Error('Vui lòng chọn đủ 3 tệp: model.json, metadata.json và weights.bin (hoặc tải lên 1 tệp .zip).');
        }

        this.modelUrl = 'Tệp cục bộ (3 tệp model)';
      }

      await this.ensureLibrariesLoaded();

      // Đọc metadata
      try {
        const metaText = await metadataFile.text();
        this.metadata = JSON.parse(metaText);
      } catch (parseErr) {
        console.warn('Không phân tích được metadata.json:', parseErr);
      }

      // Nạp model qua tmPose.loadFromFiles
      this.model = await window.tmPose.loadFromFiles(modelFile, weightsFile, metadataFile);
      if (this.model.getMetadata) {
        this.metadata = this.model.getMetadata();
      }

      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error('Lỗi khi nạp model từ tệp:', err);
      this.isLoaded = false;
      this.isLoading = false;
      this.model = null;
      this.loadError = err.message || 'Lỗi khi phân tích tệp model';
      return false;
    }
  }

  /**
   * Nạp model mẫu có sẵn trong hệ thống
   */
  async loadSampleModel() {
    return this.loadModel('/models/tm_sample/');
  }

  /**
   * Thực hiện nhận diện pose và phân loại tư thế từ video
   */
  async detectPose(videoElement, timestamp = performance.now()) {
    if (!this.isLoaded || !this.model || !videoElement) {
      return createStandardPoseFrame({
        timestamp,
        aiSource: 'teachable-machine',
        hasPerson: false
      });
    }

    try {
      const videoWidth = videoElement.videoWidth || videoElement.width || 640;
      const videoHeight = videoElement.videoHeight || videoElement.height || 480;

      // 1. Ước lượng pose qua estimatePose
      const { pose, posenetOutput } = await this.model.estimatePose(videoElement);

      if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
        return createStandardPoseFrame({
          timestamp,
          aiSource: 'teachable-machine',
          hasPerson: false
        });
      }

      // 2. Dự đoán lớp tư thế qua model.predict(posenetOutput)
      const predictions = await this.model.predict(posenetOutput);
      let topPrediction = null;

      if (predictions && predictions.length > 0) {
        const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
        topPrediction = {
          className: sorted[0].className,
          probability: Math.round(sorted[0].probability * 100) / 100,
          allPredictions: sorted
        };
      }

      // 3. Chuẩn hóa 17 keypoints PoseNet sang hợp đồng chung
      const keypointsMap = {};
      const poseNetNameMapping = {
        nose: KEYPOINT_NAMES.NOSE,
        leftEye: KEYPOINT_NAMES.LEFT_EYE,
        rightEye: KEYPOINT_NAMES.RIGHT_EYE,
        leftEar: KEYPOINT_NAMES.LEFT_EAR,
        rightEar: KEYPOINT_NAMES.RIGHT_EAR,
        leftShoulder: KEYPOINT_NAMES.LEFT_SHOULDER,
        rightShoulder: KEYPOINT_NAMES.RIGHT_SHOULDER,
        leftElbow: KEYPOINT_NAMES.LEFT_ELBOW,
        rightElbow: KEYPOINT_NAMES.RIGHT_ELBOW,
        leftWrist: KEYPOINT_NAMES.LEFT_WRIST,
        rightWrist: KEYPOINT_NAMES.RIGHT_WRIST,
        leftHip: KEYPOINT_NAMES.LEFT_HIP,
        rightHip: KEYPOINT_NAMES.RIGHT_HIP
      };

      for (const kp of pose.keypoints) {
        const standardName = poseNetNameMapping[kp.part];
        if (standardName) {
          keypointsMap[standardName] = createKeypoint(
            standardName,
            kp.position.x / videoWidth,
            kp.position.y / videoHeight,
            kp.score
          );
        }
      }

      // Tính minConfidence từ các khớp cơ bản
      const coreKeys = [
        KEYPOINT_NAMES.LEFT_SHOULDER,
        KEYPOINT_NAMES.RIGHT_SHOULDER,
        KEYPOINT_NAMES.LEFT_HIP,
        KEYPOINT_NAMES.RIGHT_HIP
      ];
      const minConfidence = Math.min(
        ...coreKeys.map(k => keypointsMap[k]?.score ?? 0.5)
      );

      return createStandardPoseFrame({
        timestamp,
        aiSource: 'teachable-machine',
        keypoints: keypointsMap,
        hasPerson: true,
        minConfidence,
        modelPrediction: topPrediction,
        raw: { pose, predictions }
      });
    } catch (err) {
      console.error('Lỗi suy luận Teachable Machine Pose:', err);
      return createStandardPoseFrame({
        timestamp,
        aiSource: 'teachable-machine',
        hasPerson: false
      });
    }
  }

  dispose() {
    this.model = null;
    this.isLoaded = false;
    this.isLoading = false;
  }
}

export const teachableMachineAdapter = new TeachableMachineAdapter();
