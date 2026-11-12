<<<<<<< HEAD
# AI Seat Posture Detection – Dashboard
**Hệ thống nhận diện và cảnh báo tư thế ngồi bằng AI theo thời gian thực**

Dự án được xây dựng với **React, JavaScript, CSS và Vite**, tích hợp công nghệ thị giác máy tính tiên tiến (**MediaPipe Pose Landmarker** và **Google Teachable Machine Pose via TensorFlow.js**) nhằm theo dõi tư thế ngồi của người dùng qua webcam theo thời gian thực, tự động phát hiện các tư thế ngồi sai (gù lưng, nghiêng cổ, vẹo vai), nhắc nhở tức thì, tự động lưu trữ và xuất báo cáo dữ liệu định dạng ZIP.

---

## 1. Tính năng nổi bật

- **Nhận diện thời gian thực đa nguồn AI:**
  - **MediaPipe Pose Landmarker:** Chạy mượt mà trực tiếp trên trình duyệt qua WASM (hỗ trợ tăng tốc phần cứng GPU và tự động fallback sang CPU).
  - **Teachable Machine Pose:** Hỗ trợ kết nối Pose Project xuất từ Google Teachable Machine dạng TensorFlow.js, kết hợp giữa nhận diện phân loại của mô hình AI và các phép đo hình học.
- **5 Chỉ số tư thế chuẩn hóa chuyên sâu:**
  1. *Góc nghiêng cổ (Neck tilt):* Trục vai–tai so với phương thẳng đứng, có dấu theo hướng mặt (Góc nhìn nghiêng).
  2. *Góc lưng (Back lean):* Trục hông–vai so với phương thẳng đứng (Góc nhìn nghiêng).
  3. *Độ cân bằng hai vai (Shoulder balance):* Độ lệch đường nối vai so với phương ngang từ mốc hiệu chuẩn (Góc chính diện).
  4. *Độ nghiêng thân người (Trunk lateral lean):* Trục trung điểm hông tới trung điểm vai so với phương thẳng đứng (Góc chính diện).
  5. *Vị trí đầu so với vai (Head-to-shoulder position):* Độ lệch ngang có dấu của tai so với vai chuẩn hóa theo chiều dài thân (hiển thị: *thẳng hàng*, *đưa ra trước*, *lệch ra sau*).
- **Hiệu chuẩn cá nhân hóa (Calibration):**
  - Người dùng bấm nút **Hiệu chuẩn** và giữ thẳng người trong **3 giây**. Hệ thống tự động tính trung vị (median) từ các khung hình hợp lệ để thiết lập mốc đo chuẩn cho từng cá nhân và góc quan sát.
- **Hệ thống cảnh báo thông minh & Chống Spam:**
  - *Nhắc tư thế sai:* Phát cảnh báo khi ngồi sai liên tục vượt ngưỡng thời gian (mặc định 5s, cho phép cấu hình $\ge$ 5s). Áp dụng khoảng cách tối thiểu 5s giữa 2 lần nhắc lại.
  - *Xác nhận tư thế đúng:* Tự động hiển thị lời khen ngợi *"Tư thế ngồi của bạn đang rất tốt!"* một lần khi người dùng điều chỉnh tư thế về đúng và ổn định.
  - *Âm thanh Web Audio API:* Tích hợp âm thanh cảnh báo và âm thanh khen ngợi nhẹ nhàng, không phụ thuộc file media ngoài.
- **Chụp ảnh & Lưu trữ lịch sử linh hoạt:**
  - *Capture Now:* Chụp ngay khung hình đang được đánh giá hợp lệ gần nhất.
  - *Auto-save:* Tự động kiểm tra và lưu ảnh theo chu kỳ (mặc định mỗi 3 giây). Tích hợp thuật toán **Anti-spam 5 giây** bỏ qua các lần tự lưu trùng trạng thái liên tiếp dưới 5s, nhưng lưu ngay khi trạng thái đổi.
  - *Quản lý dung lượng an toàn:* Giới hạn ngân sách 3 MiB cho LocalStorage. Xử lý an toàn lỗi `QuotaExceededError`, tự động tạm dừng Auto-save khi đầy và hướng dẫn người dùng xuất ZIP hoặc xóa lịch sử.
- **Xuất tệp ZIP trực tiếp (In-browser ZIP Export):**
  - Tải về tệp ZIP chứa đầy đủ:
    - Thư mục `captures/<id>.jpg`: Ảnh chụp JPEG nén của từng lần đánh giá.
    - `history.csv`: Bảng dữ liệu có **UTF-8 BOM** (`\uFEFF`) để mở tiếng Việt không lỗi font trên Microsoft Excel.
    - `history.json`: Dữ liệu JSON chi tiết với các đơn vị đo, đường dẫn ảnh trỏ trực tiếp tới `captures/<id>.jpg` thay vì nhúng Data URL nặng.

---

## 2. Công thức tính toán & Thuật toán

### 2.1. Công thức Điểm tư thế (Posture Score: 0 – 100)
Điểm tư thế phản ánh độ lệch hình học so với ngưỡng cho phép. Gọi $r$ là tỷ lệ lớn nhất giữa độ lệch của từng tiêu chí và ngưỡng tương ứng:
$$r = \max_{i} \left( \frac{|\text{giá trị đo được}_i - \text{mốc hiệu chuẩn}_i|}{\text{ngưỡng cho phép}_i} \right)$$

Điểm số tư thế được tính theo công thức:
$$\text{postureScore} = \text{Math.round}(\text{Math.max}(0, 100 - 30 \times r))$$

- Khi ngồi hoàn toàn thẳng theo mốc ($r = 0$): $\text{postureScore} = 100$.
- Khi độ lệch chạm đúng ngưỡng ($r = 1.0$): $\text{postureScore} = 70$ (vẫn trong khoảng chấp nhận được).
- Khi độ lệch vượt ngưỡng ($r > 1.0$): điểm giảm dần theo độ lệch, về 0 khi $r \ge 3.33$.

### 2.2. Phân biệt giữa Confidence (%) và Posture Score (0-100)
- **Confidence (%):** Thể hiện chất lượng nhận diện điểm khớp thực tế của camera/AI (lấy độ tin cậy thấp nhất trong nhóm khớp bắt buộc). Dưới ngưỡng tin cậy sẽ báo `Insufficient Data · Chưa đủ dữ liệu`.
- **Posture Score (0-100):** Thể hiện mức độ đúng/sai của tư thế người dùng so với mốc chuẩn y khoa.

### 2.3. Quy tắc làm mượt và chuyển đổi trạng thái (Status Smoothing)
- Để tránh hiện tượng nhấp nháy trạng thái khi cử động tự nhiên, trạng thái mới yêu cầu phải duy trì ổn định ít nhất **1 giây (1000ms)** mới cập nhật sang `Current Status`.
- Riêng khi người dùng rời khỏi khung hình hoặc thiếu khớp, hệ thống **chuyển ngay tức thì** sang `Insufficient Data` và ngừng sử dụng kết quả cũ.

---

## 3. Cài đặt và Khởi chạy

### Yêu cầu môi trường
- **Node.js:** Phiên bản 18+ (Dự án đã kiểm thử trên Node v26).
- **Trình duyệt:** Chrome, Edge, Firefox, Safari (hỗ trợ WebRTC MediaDevices, WebGL và Web Audio API).

### Các bước cài đặt:
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy môi trường phát triển (Dev Server)
npm run dev
# Mở trình duyệt tại: http://localhost:5173

# 3. Chạy toàn bộ bộ kiểm thử tự động (Unit Tests)
npm test

# 4. Xây dựng bản phát hành sản phẩm (Production Build)
npm run build
```

---

## 4. Hướng dẫn sử dụng Dashboard chi tiết

1. **Khởi động Camera:**
   - Nhấn nút **Start Camera** ở thanh điều hướng trên cùng.
   - Khi trình duyệt hỏi xin quyền, chọn **Cho phép (Allow)**.
2. **Căn khung và Hiệu chuẩn:**
   - Chọn góc quan sát: **Chính diện** hoặc **Nhìn nghiêng** (nếu chọn nhìn nghiêng, chọn thêm hướng mặt *Trái* hoặc *Phải*).
   - Ngồi cách camera khoảng 1.0 - 1.5m, căn chỉnh sao cho thấy rõ **đầu, hai vai và hông**.
   - Ngồi thẳng lưng trong tư thế chuẩn, nhấn nút **Hiệu chuẩn**. Giữ nguyên tư thế trong 3 giây để hệ thống lưu mốc trung vị.
3. **Theo dõi tư thế:**
   - Quan sát trạng thái hiển thị trên khung video và cột *Posture Analysis*:
     - 🟢 **Correct Posture · Tư thế ngồi đúng:** Màu xanh lá.
     - 🔴 **Incorrect Posture · Tư thế ngồi sai:** Màu đỏ kèm cảnh báo lỗi cụ thể (ví dụ: *Góc nghiêng cổ*, *Lưng cong*, *Hai vai lệch*).
     - ⚪ **Insufficient Data · Chưa đủ dữ liệu:** Màu xám khi thiếu khớp hoặc góc quay chưa chuẩn.
4. **Lưu lịch sử & Tự động lưu:**
   - Nhấn **Capture Now** bất cứ lúc nào để lưu ngay một khung hình đánh giá hợp lệ.
   - Bật công tắc **Auto-save** trong phần Cài đặt để hệ thống tự động lưu mỗi 3 giây (được bảo vệ bởi bộ lọc chống spam 5 giây cho các bản ghi cùng trạng thái).
5. **Xem chi tiết bản ghi & Xuất dữ liệu:**
   - Nhấn vào bất kỳ ảnh thu nhỏ nào trong phần **Lịch sử & Bản ghi** để mở popup xem ảnh chụp phân giải cao, toàn bộ các số đo hình học và gợi ý cải thiện tư thế.
   - Nhấn nút **Export ZIP** để tải toàn bộ lịch sử (ảnh chụp, file CSV tiếng Việt có BOM và file JSON cấu trúc).

---

## 5. Hướng dẫn huấn luyện & Xuất model Teachable Machine Pose

Ứng dụng mặc định tải model `My pose model v2` từ `public/models/my_pose_model_v2/`. Model này phân loại hai lớp: `Ngồi đúng tư thế` và `Ngồi sai tư thế`; model không phân biệt riêng gù lưng và nghiêng người. Ba tệp model được lưu cùng ứng dụng, nhưng thư viện Teachable Machine vẫn cần tải model PoseNet nền từ mạng khi khởi tạo.

Để cập nhật bằng một phiên bản huấn luyện mới:

1. Truy cập [Google Teachable Machine](https://teachablemachine.withgoogle.com/) và chọn **New Project $\rightarrow$ Pose Project**.
2. Tạo hai lớp `Ngồi đúng tư thế` và `Ngồi sai tư thế`, rồi thu thập mẫu cho từng lớp.
3. Nhấn **Train Model** để huấn luyện mô hình.
4. Nhấn **Export Model**, chọn **TensorFlow.js** và tải model xuống.
5. Thay cả ba tệp `model.json`, `metadata.json` và `weights.bin` trong `public/models/my_pose_model_v2/`, sau đó chạy lại hoặc build lại ứng dụng.

---

## 6. Danh sách các ca kiểm thử đã thực hiện (Test Suite)

Dự án đi kèm bộ kiểm thử tự động với **21 ca kiểm thử** (`vitest`):

| Nhóm kiểm thử | Các trường hợp đã xác minh | Trạng thái |
|---|---|---|
| **Hình học & Góc đo** (`postureGeometry.test.js`) | - Khoảng cách Euclid và tính trung vị (Median)<br>- Kiểm tra khớp bắt buộc và ngưỡng tin cậy<br>- Đo độ cân bằng vai và nghiêng thân người (Chính diện)<br>- Đo góc nghiêng cổ, góc lưng và độ lệch đầu (Nhìn nghiêng)<br>- Hiệu chuẩn mốc chuẩn trung vị | ✅ PASS (7/7) |
| **Phân loại & Điểm số** (`classificationAndScore.test.js`) | - MediaPipe phân loại Correct khi trong ngưỡng<br>- MediaPipe phát hiện vi phạm và gán mã lỗi chuẩn (`FORWARD_HEAD`, `BACK_LEAN`, `UNEVEN_SHOULDERS`)<br>- Teachable Machine: Ngưỡng xác suất tối thiểu $\ge$ 0.75<br>- Gán mã `MODEL_INCORRECT` khi model báo sai nhưng hình học trong ngưỡng<br>- Công thức điểm tư thế $\text{Math.round}(\text{Math.max}(0, 100 - 30 \times r))$ | ✅ PASS (4/4) |
| **Chống Spam & Đồng hồ** (`antiSpamEngine.test.js`) | - Chỉ nhắc sai tư thế sau khi duy trì liên tục $\ge$ 5s<br>- Khoảng cách tối thiểu giữa 2 lần nhắc lại $\ge$ 5s<br>- Auto-save: chu kỳ 3s, chống lưu trùng trạng thái trong 5s<br>- Auto-save: lưu ngay ở nhịp kế tiếp khi trạng thái thay đổi<br>- Làm mượt trạng thái: cần ổn định 1000ms trước khi cập nhật<br>- Về `Insufficient Data` tức thì khi mất dấu khớp<br>- Đếm thời gian ngồi và reset sau gián đoạn $\ge$ 5s | ✅ PASS (6/6) |
| **Lưu trữ & Xuất ZIP** (`storageAndExport.test.js`) | - Lưu và đọc cài đặt độc lập với lịch sử<br>- Hàng đợi ghi tuần tự ngăn lưu trùng `frameId` trong cùng phiên<br>- Kiểm soát ngân sách lưu trữ 3 MiB an toàn, chống tràn bộ nhớ<br>- Xuất file ZIP hợp lệ gồm thư mục `captures/`, file `history.csv` có UTF-8 BOM và `history.json` | ✅ PASS (4/4) |

### Xác minh bổ sung trong môi trường thực tế:
- **Webcam thực tế:** Mở website qua `http://localhost:5173`, cấp quyền camera, kiểm tra việc khớp khung xương màu xanh lá/đỏ khi cử động đầu và vai.
- **Model Teachable Machine thực tế:** Kiểm tra hai xác suất dự đoán với webcam và các mẫu tư thế thực tế.
=======
# AI4B
>>>>>>> 1360e7c74eb7ac8be831aeffe64a9fd7ae128011
