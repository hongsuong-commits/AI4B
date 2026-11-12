import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Cpu,
  Volume2,
  VolumeX,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileArchive,
  HelpCircle,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import {
  AI_SOURCES,
  SYSTEM_LIMITS
} from '../constants/postureConfig.js';

export default function AlertSettings({
  settings,
  onUpdateSettings,
  storageUsedBytes,
  modelStatus,
  onTestTmModel,
  onLoadTmFromFiles,
  onLoadTmSample
}) {
  const [tmInputTab, setTmInputTab] = useState('url'); // 'url' | 'file' | 'guide'
  const [testUrlStatus, setTestUrlStatus] = useState(null);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(settings.teachableMachineUrl || '');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileLoadStatus, setFileLoadStatus] = useState(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Đồng bộ urlInput nếu settings được cập nhật từ ngoài
  useEffect(() => {
    setUrlInput(settings.teachableMachineUrl || '');
  }, [settings.teachableMachineUrl]);

  // Tính phần trăm bộ nhớ đã dùng
  const storagePercent = Math.min(
    100,
    Math.round((storageUsedBytes / SYSTEM_LIMITS.STORAGE_BUDGET_BYTES) * 100)
  );
  const storageUsedMiB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
  const storageBudgetMiB = (SYSTEM_LIMITS.STORAGE_BUDGET_BYTES / (1024 * 1024)).toFixed(2);

  const handleConnectModel = async () => {
    let trimmed = urlInput.trim().replace(/^['"`]+|['"`]+$/g, '');
    if (!trimmed) {
      setTestUrlStatus({ success: false, message: 'Vui lòng nhập hoặc dán liên kết URL model.' });
      return;
    }

    // Kiểm tra nếu người dùng vô tình dán ký hiệu <ID>
    if (trimmed.includes('<') || trimmed.includes('>')) {
      setTestUrlStatus({
        success: false,
        message: "Bạn đang để nguyên chữ mẫu '<ID>'. Hãy thay bằng mã thực tế từ Google Teachable Machine (ví dụ: https://teachablemachine.withgoogle.com/models/abc123xyz/)."
      });
      return;
    }

    if (trimmed.includes('teachablemachine.withgoogle.com/train/')) {
      setTestUrlStatus({
        success: false,
        message: "Đây là link trang huấn luyện trên trình duyệt, không phải link model đã xuất bản. Vui lòng bấm 'Export Model' -> 'TensorFlow.js' -> 'Upload my model' để nhận link."
      });
      return;
    }

    // Tự động chuẩn hóa dấu gạch chéo cuối
    if (!trimmed.endsWith('/') && !trimmed.endsWith('.json')) {
      trimmed = trimmed + '/';
      setUrlInput(trimmed);
    }

    // Lưu URL vào settings
    onUpdateSettings({ teachableMachineUrl: trimmed });

    setIsTestingUrl(true);
    setTestUrlStatus(null);
    try {
      const res = await onTestTmModel(trimmed);
      if (res && res.success) {
        setTestUrlStatus({ success: true, message: 'Kết nối model thành công!' });
      } else {
        setTestUrlStatus({ success: false, message: res?.message || 'Không thể kết nối.' });
      }
    } catch (e) {
      setTestUrlStatus({ success: false, message: e.message || 'Lỗi mạng hoặc CORS.' });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleUseSampleModel = async () => {
    setIsTestingUrl(true);
    setTestUrlStatus(null);
    try {
      const res = await onLoadTmSample();
      if (res && res.success) {
        setUrlInput('/models/tm_sample/');
        setTestUrlStatus({ success: true, message: 'Đã nạp model mẫu thử nghiệm thành công!' });
      } else {
        setTestUrlStatus({ success: false, message: res?.message || 'Không thể nạp model mẫu.' });
      }
    } catch (e) {
      setTestUrlStatus({ success: false, message: e.message });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
      setFileLoadStatus(null);
    }
  };

  const handleLoadFiles = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setFileLoadStatus({ success: false, message: 'Vui lòng chọn ít nhất 1 tệp .ZIP hoặc đủ 3 tệp model.' });
      return;
    }

    setIsFileLoading(true);
    setFileLoadStatus(null);
    try {
      const res = await onLoadTmFromFiles(selectedFiles);
      if (res && res.success) {
        setFileLoadStatus({
          success: true,
          message: `Nạp thành công model từ ${selectedFiles.length === 1 ? selectedFiles[0].name : '3 tệp model'}!`
        });
      } else {
        setFileLoadStatus({ success: false, message: res?.message || 'Không thể nạp tệp model.' });
      }
    } catch (e) {
      setFileLoadStatus({ success: false, message: e.message || 'Lỗi khi nạp tệp.' });
    } finally {
      setIsFileLoading(false);
    }
  };

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">
          <Bell size={20} />
          <span>Cảnh báo & Cài đặt hệ thống</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
          <HardDrive size={14} />
          <span>Lưu trữ: {storageUsedMiB} / {storageBudgetMiB} MiB ({storagePercent}%)</span>
        </div>
      </div>

      <div className="settings-group">
        {/* 1. Lựa chọn nguồn AI Model */}
        <div className="setting-item-col">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} color="#3b82f6" />
              <span className="setting-label-text">Nguồn AI nhận diện</span>
            </div>
            <select
              value={settings.aiSource}
              onChange={(e) => onUpdateSettings({ aiSource: e.target.value })}
              className="select-input"
            >
              <option value={AI_SOURCES.MEDIAPIPE}>MediaPipe Pose Landmarker (Mặc định)</option>
              <option value={AI_SOURCES.TEACHABLE_MACHINE}>Teachable Machine Pose (TensorFlow.js)</option>
            </select>
          </div>

          {settings.aiSource === AI_SOURCES.TEACHABLE_MACHINE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {/* Tab Switcher cho Teachable Machine */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTmInputTab('url')}
                  className={`btn btn-sm ${tmInputTab === 'url' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  <LinkIcon size={13} style={{ marginRight: '4px' }} />
                  Nhập link URL
                </button>
                <button
                  type="button"
                  onClick={() => setTmInputTab('file')}
                  className={`btn btn-sm ${tmInputTab === 'file' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  <Upload size={13} style={{ marginRight: '4px' }} />
                  Tải tệp ZIP / Files
                </button>
                <button
                  type="button"
                  onClick={() => setTmInputTab('guide')}
                  className={`btn btn-sm ${tmInputTab === 'guide' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', marginLeft: 'auto' }}
                >
                  <HelpCircle size={13} style={{ marginRight: '4px' }} />
                  Hướng dẫn lấy link
                </button>
              </div>

              {/* Tab 1: Nhập URL */}
              {tmInputTab === 'url' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="setting-desc-text">
                    Dán liên kết model sau khi nhấn <b>Upload my model</b> trên Google Teachable Machine:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="https://teachablemachine.withgoogle.com/models/abc123xyz/"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConnectModel();
                        }
                      }}
                      className="input-text"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleConnectModel}
                      disabled={isTestingUrl || !urlInput.trim()}
                      className="btn btn-primary btn-sm"
                      title="Kiểm tra tải model.json & metadata.json và kết nối"
                    >
                      {isTestingUrl ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Đang nạp...</span>
                        </>
                      ) : (
                        <span>Kết nối</span>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleUseSampleModel}
                      disabled={isTestingUrl}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }}
                    >
                      <Sparkles size={12} style={{ marginRight: '4px' }} />
                      Dùng model mẫu thử nghiệm có sẵn
                    </button>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      (Nhấn Enter hoặc nút Kết nối)
                    </span>
                  </div>

                  {testUrlStatus && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: testUrlStatus.success ? '#34d399' : '#f87171',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        background: testUrlStatus.success ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${testUrlStatus.success ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                      }}
                    >
                      {testUrlStatus.success ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />}
                      <span>{testUrlStatus.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Tải lên tệp cục bộ (ZIP hoặc 3 files) */}
              {tmInputTab === 'file' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="setting-desc-text">
                    Tải lên tệp <b>.zip</b> bạn đã tải về từ Teachable Machine (hoặc chọn cả 3 tệp <code>model.json</code>, <code>metadata.json</code>, <code>weights.bin</code>):
                  </span>

                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".zip,.json,.bin"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                      transition: 'border-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                  >
                    <FileArchive size={24} style={{ color: '#60a5fa', margin: '0 auto 6px' }} />
                    <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500 }}>
                      {selectedFiles.length > 0
                        ? `Đã chọn: ${selectedFiles.map(f => f.name).join(', ')}`
                        : 'Bấm để chọn tệp .ZIP hoặc 3 tệp model từ máy tính'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                      Hỗ trợ tệp ZIP xuất từ mục "Download my model"
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleLoadFiles}
                      disabled={isFileLoading || selectedFiles.length === 0}
                      className="btn btn-primary btn-sm"
                    >
                      {isFileLoading ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Đang nạp tệp...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          <span>Nạp tệp vào hệ thống</span>
                        </>
                      )}
                    </button>
                  </div>

                  {fileLoadStatus && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: fileLoadStatus.success ? '#34d399' : '#f87171',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        background: fileLoadStatus.success ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${fileLoadStatus.success ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                      }}
                    >
                      {fileLoadStatus.success ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />}
                      <span>{fileLoadStatus.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Hướng dẫn chi tiết */}
              {tmInputTab === 'guide' && (
                <div style={{ fontSize: '0.76rem', color: '#cbd5e1', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8' }}>Cách lấy link hoặc tệp từ Google Teachable Machine:</div>
                  <div>1. Truy cập <a href="https://teachablemachine.withgoogle.com" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>teachablemachine.withgoogle.com</a> và mở Pose Project của bạn.</div>
                  <div>2. Nhấn nút <b>Export Model</b> (ở góc trên cột Preview bên phải).</div>
                  <div>3. Chọn tab <b>TensorFlow.js</b>.</div>
                  <div>
                    <b>Cách 1 (Khuyên dùng - Nhận link online):</b>
                    <div style={{ paddingLeft: '12px', color: '#94a3b8' }}>
                      - Bấm nút xanh <b>"Upload my model"</b> (chờ 10-30 giây).<br />
                      - Sao chép liên kết ở mục <i>"Your shareable link"</i> (dạng <code>https://teachablemachine.withgoogle.com/models/xxx.../</code>).<br />
                      - Dán vào tab <b>"Nhập link URL"</b> rồi bấm <b>Kết nối</b>.
                    </div>
                  </div>
                  <div>
                    <b>Cách 2 (Chạy Offline không cần mạng):</b>
                    <div style={{ paddingLeft: '12px', color: '#94a3b8' }}>
                      - Chọn mục <b>"Download"</b> thay vì Upload &rarr; Bấm <b>"Download my model"</b> để tải về máy file <code>.zip</code>.<br />
                      - Chuyển sang tab <b>"Tải tệp ZIP / Files"</b> ở trên, chọn tệp ZIP đó và bấm <b>Nạp tệp</b>.
                    </div>
                  </div>
                  <div style={{ color: '#fbbf24', marginTop: '2px' }}>
                    💡 <i>Lưu ý: Không dán link có chữ <code>&lt;ID&gt;</code> hoặc link trang đang huấn luyện (có chữ <code>/train/</code>).</i>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Cài đặt Nhắc tư thế sai */}
        <div className="setting-item">
          <div>
            <span className="setting-label-text">Nhắc tư thế sai</span>
            <p className="setting-desc-text">
              Phát thông báo nhắc nhở khi ngồi sai tư thế liên tục vượt quá thời gian cài đặt.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableIncorrectAlert}
              onChange={(e) => onUpdateSettings({ enableIncorrectAlert: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>

        {settings.enableIncorrectAlert && (
          <div className="setting-item-col" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="setting-desc-text">Thời gian sai liên tục trước khi nhắc lần đầu (giây):</span>
              <input
                type="number"
                min="5"
                max="60"
                value={settings.incorrectAlertDelay}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value, 10) || 5);
                  onUpdateSettings({ incorrectAlertDelay: val });
                }}
                className="input-number"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="setting-desc-text">Khoảng cách tối thiểu giữa các lần nhắc lại (giây, &ge; 5s):</span>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.alertRepeatInterval}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value, 10) || 5);
                  onUpdateSettings({ alertRepeatInterval: val });
                }}
                className="input-number"
              />
            </div>
          </div>
        )}

        {/* 3. Âm thanh cảnh báo */}
        <div className="setting-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {settings.enableSoundAlert ? <Volume2 size={18} color="#3b82f6" /> : <VolumeX size={18} color="#64748b" />}
            <div>
              <span className="setting-label-text">Âm thanh cảnh báo</span>
              <p className="setting-desc-text">Phát chuông thông báo nhẹ nhàng khi tư thế sai hoặc đạt chuẩn.</p>
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableSoundAlert}
              onChange={(e) => onUpdateSettings({ enableSoundAlert: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>

        {/* 4. Xác nhận tư thế đúng */}
        <div className="setting-item">
          <div>
            <span className="setting-label-text">Xác nhận tư thế đúng</span>
            <p className="setting-desc-text">
              Hiển thị thông báo "Tư thế ngồi của bạn đang rất tốt!" khi tư thế chuyển sang đúng và ổn định.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableCorrectToast}
              onChange={(e) => onUpdateSettings({ enableCorrectToast: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>

        {/* 5. Tự động lưu ảnh (Auto-save) */}
        <div className="setting-item">
          <div>
            <span className="setting-label-text">Auto-save</span>
            <p className="setting-desc-text">
              Tự động lưu lại khung hình và số đo tư thế theo chu kỳ (có chống spam 5 giây cho trạng thái trùng).
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableAutoSave}
              onChange={(e) => onUpdateSettings({ enableAutoSave: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>

        {settings.enableAutoSave && (
          <div className="setting-item" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div>
              <span className="setting-label-text">Chu kỳ kiểm tra tự lưu (giây)</span>
              <p className="setting-desc-text">Mặc định 3s. Nếu cùng trạng thái, hệ thống áp dụng cửa sổ 5s chống trùng lặp.</p>
            </div>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.autoSaveInterval}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 3);
                onUpdateSettings({ autoSaveInterval: val });
              }}
              className="input-number"
            />
          </div>
        )}

      </div>
    </div>
  );
}
