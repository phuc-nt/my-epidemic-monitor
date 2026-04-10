---
layout: default
title: Tính năng chính
nav_order: 4
description: "Bản đồ ổ dịch, dòng tin tức, AI Chat, cảnh báo khí hậu — và cách hệ thống lọc dữ liệu."
---

# Tính năng chính

## 1. Bản đồ ổ dịch theo tỉnh/huyện

Bản đồ Việt Nam với marker cho từng ổ dịch đang hoạt động trong 30 ngày gần nhất.

- **Marker theo tỉnh** — kích thước phụ thuộc số ca / mức cảnh báo
- **Zoom xuống huyện** — khi báo có nhắc cấp huyện, marker hiển thị chính xác hơn
- **Màu cảnh báo** — xanh (theo dõi), vàng (chú ý), đỏ (cảnh báo cao)
- **Click marker** → mở chi tiết ổ dịch + link bài báo gốc
- Mượt cả khi có hàng trăm marker đồng thời

> Ổ dịch chỉ ghi *"Toàn quốc"* (không xác định được tỉnh cụ thể) sẽ KHÔNG hiện marker mà gom vào panel riêng *"Chưa xác định vị trí"*.

---

## 2. Panel danh sách ổ dịch

Bên cạnh bản đồ là danh sách dạng thẻ:

- Tên bệnh + emoji (🦟 sốt xuất huyết, 🤒 tay chân miệng, 🦠 sởi…)
- Tỉnh + huyện (nếu có)
- Số ca / số tử vong (nếu báo có nêu)
- Mức cảnh báo
- Nguồn báo + thời gian đăng
- **Click thẻ** → bản đồ tự động fly-to vị trí đó

Hỗ trợ filter theo bệnh và sắp xếp theo thời gian / mức cảnh báo.

---

## 3. Dòng tin tức tổng hợp

50 tin mới nhất từ tất cả các nguồn, sắp xếp theo thời gian. Mỗi tin gồm:

- Tiêu đề gốc
- Tên báo nguồn
- Thời gian đăng
- Tóm tắt ngắn 1–2 dòng

Click → mở bài báo gốc trên trang nguồn. Không sao chép nội dung, không tái xuất bản.

---

## 4. Thống kê tổng quan

Panel stats gồm:

- **Tổng số ổ dịch** đang hoạt động
- **Số tỉnh ảnh hưởng**
- **Số cảnh báo cấp cao** đang mở
- **Top bệnh đang nóng** (10 bệnh có nhiều bài viết nhất)

Cập nhật mỗi 6 giờ. Trong cycle pipeline mới chạy xong, bạn có thể thấy con số nhảy.

---

## 5. AI Chat hỏi đáp

Click icon chat ở góc dưới phải. Hỏi tự nhiên bằng tiếng Việt:

- *"Hà Nội tuần này có dịch gì?"*
- *"Tay chân miệng đang lan ở những tỉnh nào?"*
- *"Có ổ sốt xuất huyết nào ở miền Tây không?"*
- *"Tóm tắt tình hình dịch tuần này?"*

Trợ lý AI chỉ trả lời dựa trên dữ liệu ổ dịch hiện đang hiển thị trong app, kèm link nguồn cho từng câu trả lời. Không bịa, không suy đoán ngoài dữ liệu.

> Chat KHÔNG dùng để chẩn đoán y tế hay thay thế bác sĩ. Chỉ dùng để tra cứu tình hình.

---

## 6. Cảnh báo khí hậu (Climate Panel)

Panel nhỏ hiển thị nhiệt độ + độ ẩm + mưa theo vùng, kèm gợi ý:

- Nhiệt độ cao + độ ẩm cao → mùa muỗi → cảnh báo sốt xuất huyết
- Mưa nhiều + ngập lụt → nguy cơ tiêu chảy, leptospirosis
- Lạnh khô + ô nhiễm → nguy cơ hô hấp / RSV ở trẻ nhỏ

Khí hậu kết hợp với danh sách ổ dịch để dự báo bệnh nào đang vào mùa cao điểm ở khu vực bạn quan tâm.

---

## 7. Lọc dữ liệu — đây là phần quan trọng nhất

Tin về sức khoẻ cộng đồng trên Internet rất nhiễu: tin cũ, tin thú y, tin nước ngoài, tin tuyên truyền, tin trùng lặp. Để bản đồ cảnh báo nguy cơ sức khoẻ có ích, hệ thống áp dụng **nhiều lớp lọc** trước khi một tin được hiển thị:

- **Lớp nguồn** — chỉ đọc các báo lớn tiếng Việt đã được kiểm chứng + nguồn video chính thống. Không quét Internet ngẫu nhiên.
- **Lớp AI** — mỗi bài phải vượt qua cả ba câu hỏi: *đây có phải tin dịch thật cho người không? — có xảy ra ở Việt Nam không? — có ca/ổ dịch/cảnh báo cụ thể không?*. Trả lời "không" cho bất kỳ câu nào → bài bị loại.
- **Lớp dedup + độ tin cậy** — bài trùng nhau bị gộp; bài có độ tin cậy thấp bị bỏ; số ca bất hợp lý (cao bất thường, số tử vong > số ca) bị đánh dấu nghi ngờ.

Mục tiêu: nếu bạn thấy một ổ dịch trên bản đồ, **tỉ lệ rất cao đó là tin có thật**, và bạn có thể click thẳng vào bài báo gốc để xác nhận.

---

## 8. Tự động cập nhật mỗi 6 giờ

Hệ thống làm mới dữ liệu **4 lần/ngày**, hoàn toàn tự động. Bạn không cần làm gì.

- Mỗi cycle quét toàn bộ nguồn với 20 từ khoá sức khoẻ cộng đồng tiếng Việt
- Bài mới được trích xuất, lọc, và đẩy lên cơ sở dữ liệu trên cloud
- Tin cũ hơn 30 ngày tự động được xoá để giữ bản đồ luôn phản ánh tình hình hiện tại
- Nếu một lần cập nhật gặp sự cố (mạng, nguồn bị chặn…), hệ thống tự thử lại

Khi bạn mở app, dữ liệu hiển thị thường có độ trễ tối đa 6 giờ so với thời điểm bài báo được đăng.

---

## 9. Mở, miễn phí, tôn trọng người dùng

- **Mở app là dùng** — không đăng ký, không yêu cầu email, không cần app store
- **Không quảng cáo** — không banner, không pop-up, không sponsored content
- **Không tracking** — không Google Analytics, không cookie bên thứ ba, không bán dữ liệu
- **Không gửi notification rác** — bạn quay lại khi cần, không bị làm phiền
- **Mã nguồn frontend mở** trên GitHub — có thể tự kiểm tra rằng app không làm gì sau lưng bạn

Hệ thống được duy trì bởi cá nhân, không backed bởi công ty hay tổ chức nào. Đây là một dự án cộng đồng, làm vì *vấn đề có thật* mà tác giả muốn giải quyết cho chính gia đình mình.

---

## 10. Không có gì

Để kỳ vọng đúng, đây là **những gì hệ thống KHÔNG làm**:

- ❌ Không dự báo (chỉ tổng hợp tin đã có)
- ❌ Không cảnh báo realtime (cycle 6h, không phải streaming)
- ❌ Không có account / lưu lịch sử cá nhân
- ❌ Không gửi notification (chưa có)
- ❌ Không đa ngôn ngữ (chỉ tiếng Việt, chỉ Việt Nam)
- ❌ Không thay thế tư vấn y tế chuyên môn
