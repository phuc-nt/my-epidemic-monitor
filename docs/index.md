---
layout: default
title: Trang chủ
nav_order: 1
description: "Epidemic Monitor — phát hiện sớm điểm nóng dịch bệnh ở Việt Nam từ tin tức và mạng xã hội."
permalink: /
---

<p align="center">
  <img src="{{ site.baseurl }}/assets/logo.svg" alt="Epidemic Monitor logo" width="200" />
</p>

# Epidemic Monitor
{: .fs-9 }

Phát hiện sớm điểm nóng dịch bệnh ở Việt Nam — từ báo chí, YouTube và mạng xã hội, gom lại thành một bản đồ duy nhất.
{: .fs-6 .fw-300 }

[Mở app]({{ "https://epidemic-monitor.pages.dev" }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Vì sao có dự án này]({{ site.baseurl }}/why.html){: .btn .fs-5 .mb-4 .mb-md-0 }

---

### Câu chuyện đằng sau

Mỗi năm, phụ huynh có con nhỏ ở Việt Nam đều phải đối mặt với cùng một nỗi lo: **mùa dịch lại tới**. Sốt xuất huyết tháng 7. Tay chân miệng tháng 9. Sởi, cúm, ho gà rải rác cả năm. Khi tin về một ổ dịch ở trường mầm non bên cạnh xuất hiện, thường là đã quá trễ để phòng tránh.

Báo cáo của Bộ Y tế và CDC tỉnh là nguồn chính thống — nhưng thường chậm vài ngày tới vài tuần. Trong khoảng thời gian đó, **báo chí và mạng xã hội đã viết về ổ dịch từ lâu rồi.**

Epidemic Monitor đọc những nguồn đó giùm bạn. Mỗi 6 giờ, hệ thống quét báo chí Việt Nam, YouTube và Facebook bằng các từ khoá dịch bệnh, dùng AI để trích xuất thông tin có cấu trúc (bệnh gì, ở tỉnh/huyện nào, bao nhiêu ca, mức cảnh báo), và đưa lên một bản đồ Việt Nam duy nhất.

---

### Bạn thấy được gì

- 🗺 **Bản đồ Việt Nam** với marker theo tỉnh/huyện cho từng ổ dịch đang hoạt động
- 📰 **Dòng tin tức** mới nhất từ các báo lớn (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí…)
- 📊 **Thống kê tổng quan**: số ổ dịch, số tỉnh ảnh hưởng, top bệnh đang nóng
- 🤖 **AI Chat** để hỏi cụ thể: *"Hà Nội tuần này có dịch gì?"*, *"Tay chân miệng đang lan ở những tỉnh nào?"*
- 🌡 **Cảnh báo khí hậu** — nhiệt độ + độ ẩm tương quan với mùa muỗi và bệnh hô hấp

Tất cả miễn phí, mở public, không cần đăng ký.

---

### Hệ thống tóm gọn trong 3 dòng

1. Mỗi 6 giờ, hệ thống quét các nguồn tin tiếng Việt tin cậy bằng 20 từ khoá dịch bệnh.
2. AI lọc bài, trích xuất thông tin có cấu trúc, và filter chỉ giữ ổ dịch ở Việt Nam.
3. Bạn mở web — thấy bản đồ và danh sách ngay lập tức, không cần đăng ký.

Xem [Tính năng chính]({{ site.baseurl }}/core-features.html) để biết bạn có thể làm gì với dữ liệu này.

---

### Trạng thái dự án

- **Ngôn ngữ:** chỉ tiếng Việt
- **Phạm vi:** chỉ ổ dịch ở Việt Nam
- **Tần suất cập nhật:** mỗi 6 giờ
- **Lưu trữ:** 30 ngày gần nhất
- **Chi phí với người dùng:** miễn phí, không quảng cáo, không tracking
- **License:** MIT
