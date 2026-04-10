---
layout: default
title: Trang chủ
nav_order: 1
description: "Epidemic Monitor — bản đồ cảnh báo nguy cơ sức khoẻ Việt Nam, AI tổng hợp từ báo chí mỗi 6 giờ. Công cụ tham khảo, không phải nguồn chính thống."
permalink: /
---

<p align="center">
  <img src="{{ site.baseurl }}/assets/logo.svg" alt="Epidemic Monitor logo" width="200" />
</p>

# Epidemic Monitor
{: .fs-9 }

**Bản đồ cảnh báo nguy cơ sức khoẻ · Việt Nam**
{: .fs-6 .fw-500 }

AI tổng hợp tin tức y tế / sức khoẻ cộng đồng từ báo chí Việt Nam, mỗi 6 giờ — gom lại thành một bản đồ duy nhất có dẫn nguồn rõ ràng cho từng tin. **Công cụ tham khảo cộng đồng, không thay thế CDC.**
{: .fs-5 .fw-300 }

[Mở app]({{ "https://epidemic-monitor.pages.dev" }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Vì sao có dự án này]({{ site.baseurl }}/why.html){: .btn .fs-5 .mb-4 .mb-md-0 }

---

### Câu chuyện đằng sau

Mỗi năm, phụ huynh có con nhỏ ở Việt Nam đều phải đối mặt với cùng một nỗi lo về sức khoẻ theo mùa. Sốt xuất huyết tháng 7. Tay chân miệng tháng 9. Sởi, cúm, ho gà rải rác cả năm. Khi tin về một sự kiện sức khoẻ cộng đồng ở trường mầm non bên cạnh xuất hiện, thường là đã quá trễ để phòng tránh.

Báo cáo chính thức của Bộ Y tế và CDC tỉnh là nguồn đáng tin cậy nhất — nhưng thường được công bố chậm vài ngày tới vài tuần. Trong khoảng thời gian đó, **báo chí Việt Nam đã đưa tin từ lâu rồi**.

Epidemic Monitor đọc giùm bạn. Mỗi 6 giờ, hệ thống quét các báo Việt Nam tin cậy bằng 20 từ khoá sức khoẻ cộng đồng, dùng AI để trích xuất thông tin có cấu trúc (bệnh gì, ở tỉnh/huyện nào, số ca được báo chí đề cập), và đưa lên một **bản đồ cảnh báo nguy cơ sức khoẻ** duy nhất với attribution rõ ràng cho từng nguồn báo.

Đây là cách tiếp cận **Social Listening** — phương pháp mà WHO và US CDC đã áp dụng từ lâu để xây dựng cảnh báo nguy cơ sức khoẻ cộng đồng từ các nguồn thông tin không chính thống. Epic (công ty y tế số lớn nhất Mỹ) cũng đặt tên hệ thống tương tự của họ là "Health Alerts — Cảnh báo sức khoẻ" thay vì "epidemic map".

---

### Bạn thấy được gì

- 🗺 **Bản đồ cảnh báo nguy cơ sức khoẻ** với marker theo tỉnh/huyện cho từng tin báo chí đưa
- 📰 **Danh sách tin** mới nhất từ các báo lớn (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, Sức khỏe Đời sống…) + các báo địa phương + HCDC
- 📊 **Bệnh được nhắc nhiều** — top diseases theo số tin báo chí đưa
- 🤖 **Trợ lý AI** để hỏi cụ thể: *"Hà Nội tuần này có tin gì?"*, *"Tay chân miệng được báo chí đưa ở những tỉnh nào?"*

Tất cả miễn phí, mở public, không cần đăng ký, không quảng cáo, không tracking.

---

### Hệ thống tóm gọn trong 3 dòng

1. Mỗi 6 giờ, hệ thống quét các báo Việt Nam tin cậy bằng 20 từ khoá liên quan sức khoẻ cộng đồng.
2. AI lọc bài, trích xuất thông tin có cấu trúc, và chỉ giữ tin về Việt Nam (loại bài giáo dục, PR, tin nước ngoài).
3. Bạn mở web — thấy bản đồ cảnh báo nguy cơ sức khoẻ + danh sách tin ngay lập tức, mỗi tin có link đến bài báo gốc để xác minh.

Xem [Tính năng chính]({{ site.baseurl }}/core-features.html) để biết bạn có thể làm gì với dữ liệu này.

---

### Trạng thái dự án

- **Ngôn ngữ:** chỉ tiếng Việt
- **Phạm vi:** chỉ tin sức khoẻ cộng đồng ở Việt Nam
- **Tần suất cập nhật:** mỗi 6 giờ
- **Lưu trữ:** 30 ngày gần nhất
- **Chi phí với người dùng:** miễn phí, không quảng cáo, không tracking
- **License:** MIT
