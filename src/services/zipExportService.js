import JSZip from 'jszip';
import { STATUS_DISPLAY } from '../constants/postureConfig.js';

/**
 * Chuyển đổi Data URL (base64) thành Uint8Array để đưa vào zip
 */
function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl || !dataUrl.includes(',')) return null;
  try {
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('Lỗi chuyển base64 sang Uint8Array:', e);
    return null;
  }
}

/**
 * Thoát các ký tự đặc biệt cho trường CSV
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Xuất toàn bộ lịch sử thành tệp ZIP
 */
export async function exportHistoryToZip(historyRecords, onProgress = () => {}) {
  if (!historyRecords || historyRecords.length === 0) {
    throw new Error('Lịch sử hiện tại đang trống, không có dữ liệu để xuất ZIP.');
  }

  onProgress(10, 'Đang chuẩn bị gói dữ liệu...');
  const zip = new JSZip();
  const capturesFolder = zip.folder('captures');

  const total = historyRecords.length;
  const processedRecords = [];
  const csvRows = [];

  // Tiêu đề CSV UTF-8 với BOM
  csvRows.push([
    'ID',
    'Thời gian (ISO)',
    'Trạng thái',
    'Độ tin cậy (%)',
    'Điểm tư thế (0-100)',
    'Các lỗi vi phạm',
    'Nguồn chụp',
    'Nguồn AI',
    'Góc quan sát',
    'Đường dẫn ảnh'
  ].map(escapeCsvField).join(','));

  for (let i = 0; i < total; i++) {
    const rec = historyRecords[i];
    const imageFilename = `captures/${rec.id}.jpg`;
    let hasImage = false;

    // 1. Lưu ảnh vào thư mục captures/
    if (rec.image) {
      const imgBytes = dataUrlToUint8Array(rec.image);
      if (imgBytes) {
        capturesFolder.file(`${rec.id}.jpg`, imgBytes, { binary: true });
        hasImage = true;
      }
    }

    // 2. Thêm dòng vào CSV
    const violationsStr = Array.isArray(rec.violations) ? rec.violations.join('; ') : '';
    csvRows.push([
      rec.id,
      rec.capturedAt,
      STATUS_DISPLAY[rec.status] || rec.status,
      rec.confidence ?? 0,
      rec.postureScore ?? 0,
      violationsStr,
      rec.source,
      rec.aiSource,
      rec.viewAngle,
      hasImage ? imageFilename : ''
    ].map(escapeCsvField).join(','));

    // 3. Chuẩn bị đối tượng cho history.json (thay Data URL bằng đường dẫn ảnh)
    processedRecords.push({
      id: rec.id,
      sessionId: rec.sessionId,
      frameId: rec.frameId,
      capturedAt: rec.capturedAt,
      source: rec.source,
      aiSource: rec.aiSource,
      viewAngle: rec.viewAngle,
      status: rec.status,
      confidence: rec.confidence,
      postureScore: rec.postureScore,
      metrics: {
        neckAngle_deg: rec.metrics?.neckAngle ?? null,
        backAngle_deg: rec.metrics?.backAngle ?? null,
        shoulderBalance_deg: rec.metrics?.shoulderBalance ?? null,
        trunkLean_deg: rec.metrics?.trunkLean ?? null,
        headOffsetPercent: rec.metrics?.headOffsetPercent ?? null,
        headPositionLabel: rec.metrics?.headPositionLabel ?? '—'
      },
      violations: rec.violations || [],
      imagePath: hasImage ? imageFilename : null,
      schemaVersion: rec.schemaVersion || 1
    });

    const percent = Math.round(10 + (i / total) * 60);
    onProgress(percent, `Đang xử lý bản ghi ${i + 1}/${total}...`);
  }

  // Thêm file CSV với UTF-8 BOM (\uFEFF)
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  zip.file('history.csv', csvContent);

  // Thêm file JSON
  const jsonContent = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalRecords: processedRecords.length,
      records: processedRecords
    },
    null,
    2
  );
  zip.file('history.json', jsonContent);

  onProgress(75, 'Đang nén tệp ZIP...');

  // Tạo blob zip
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      const p = Math.round(75 + (metadata.percent / 100) * 20);
      onProgress(p, `Đang nén: ${Math.round(metadata.percent)}%`);
    }
  );

  onProgress(98, 'Đang chuẩn bị tải xuống...');

  // Kích hoạt download trực tiếp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `ai_posture_history_${timestamp}.zip`;

  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

  onProgress(100, 'Tải ZIP thành công!');
  return { success: true, filename, totalRecords: total };
}
