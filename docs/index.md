---
layout: default
title: Trang chủ
nav_order: 1
description: "Epidemic Monitor — công cụ tham khảo tổng hợp tin dịch bệnh Việt Nam từ báo chí. Không phải nguồn chính thống."
permalink: /
---

<p align="center">
  <img src="{{ site.baseurl }}/assets/logo.svg" alt="Epidemic Monitor logo" width="200" />
</p>

# Epidemic Monitor
{: .fs-9 }

Tổng hợp tin dịch bệnh ở Việt Nam từ báo chí — gom lại thành một bản đồ duy nhất, có dẫn nguồn rõ ràng cho từng tin. **Công cụ tham khảo cộng đồng, không thay thế CDC.**
{: .fs-6 .fw-300 }

[Mở app]({{ "https://epidemic-monitor.pages.dev" }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Vì sao có dự án này]({{ site.baseurl }}/why.html){: .btn .fs-5 .mb-4 .mb-md-0 }

---

### Câu chuyện đằng sau

Mỗi năm, phụ huynh có con nhỏ ở Việt Nam đều phải đối mặt với cùng một nỗi lo: **mùa dịch lại tới**. Sốt xuất huyết tháng 7. Tay chân miệng tháng 9. Sởi, cúm, ho gà rải rác cả năm. Khi tin về một ổ dịch ở trường mầm non bên cạnh xuất hiện, thường là đã quá trễ để phòng tránh.

Báo cáo của Bộ Y tế và CDC tỉnh là nguồn chính thống — nhưng thường chậm vài ngày tới vài tuần. Trong khoảng thời gian đó, **báo chí và mạng xã hội đã viết về ổ dịch từ lâu rồi.**

Epidemic Monitor đọc giùm bạn. Mỗi 6 giờ, hệ thống quét các báo Việt Nam tin cậy bằng các từ khoá dịch bệnh, dùng AI để trích xuất thông tin có cấu trúc (bệnh gì, ở tỉnh/huyện nào, số ca được báo chí đề cập), và đưa lên một bản đồ Việt Nam duy nhất với attribution rõ ràng cho từng nguồn báo.

---

### Bạn thấy được gì

- 🗺 **Bản đồ Việt Nam** với marker theo tỉnh/huyện cho từng tin báo chí đưa
- 📰 **Danh sách tin** mới nhất từ các báo lớn (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, Sức khỏe Đời sống…) + các báo địa phương + HCDC
- 📊 **Bệnh được nhắc nhiều** — top diseases theo số tin báo chí đưa
- 🤖 **Trợ lý AI** để hỏi cụ thể: *"Hà Nội tuần này có tin gì?"*, *"Tay chân miệng được báo chí đưa ở những tỉnh nào?"*

Tất cả miễn phí, mở public, không cần đăng ký, không quảng cáo, không tracking.

---

### Hệ thống tóm gọn trong 3 dòng

1. Mỗi 6 giờ, hệ thống quét các báo Việt Nam tin cậy bằng 20 từ khoá dịch bệnh.
2. AI lọc bài, trích xuất thông tin có cấu trúc, và chỉ giữ tin về Việt Nam (loại bài giáo dục, PR, tin nước ngoài).
3. Bạn mở web — thấy bản đồ + danh sách ngay lập tức, mỗi tin có link đến bài báo gốc để xác minh.

Xem [Tính năng chính]({{ site.baseurl }}/core-features.html) để biết bạn có thể làm gì với dữ liệu này.

---

### Trạng thái dự án

- **Ngôn ngữ:** chỉ tiếng Việt
- **Phạm vi:** chỉ ổ dịch ở Việt Nam
- **Tần suất cập nhật:** mỗi 6 giờ
- **Lưu trữ:** 30 ngày gần nhất
- **Chi phí với người dùng:** miễn phí, không quảng cáo, không tracking
- **License:** MIT
