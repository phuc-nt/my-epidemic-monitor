# Epidemic Monitor — Hệ thống Giám sát Dịch bệnh Thời gian Thực cho Việt Nam

> Phiên bản MVP · Tháng 4/2026 · Open Source · Self-hostable

---

## Vấn đề

Việt Nam đang đối mặt với gánh nặng dịch bệnh ngày càng gia tăng: Q1/2026 ghi nhận **31.000 ca sốt xuất huyết** — tăng 2,2 lần so với cùng kỳ năm ngoái. Tay chân miệng, COVID-19, cúm, sởi và tả tiếp tục lưu hành song song.

Hệ thống báo cáo hiện tại (eCDS, Thông tư 54) có độ trễ **4 tuần** từ lúc phát hiện ca bệnh đến khi cơ quan y tế nhận được thông tin. Hơn **50.000 cộng tác viên y tế cộng đồng** — lực lượng thu thập dữ liệu tại tuyến cơ sở — thường xuyên làm việc trong điều kiện không có kết nối internet ổn định và không có công cụ số phù hợp.

Hậu quả: **dịch bùng phát trước khi ứng phó được triển khai.** Thời gian từ ca bệnh đầu tiên đến hành động phòng chống trung bình vượt 4 tuần.

---

## Giải pháp

**Epidemic Monitor** là một web dashboard mã nguồn mở, được thiết kế đặc thù cho bối cảnh Việt Nam. Hệ thống tổng hợp dữ liệu từ **10 nguồn quốc tế và trong nước** theo thời gian thực, kết hợp dự báo khí hậu và AI assistant, giúp cán bộ y tế nắm bắt tình hình và ra quyết định ứng phó trong vòng **dưới 24 giờ**.

Không cần tài khoản. Không cần cài đặt phức tạp. Chạy trên trình duyệt, hỗ trợ mobile.

---

## Tính năng chính

### 🗺️ Bản đồ dịch bệnh tương tác
Bản đồ vector độ phân giải cao (deck.gl + MapLibre), khóa vào lãnh thổ Việt Nam. Hiển thị marker ổ dịch theo mức độ nghiêm trọng và lớp heatmap phân bố ca bệnh. Lọc theo mốc thời gian: 24 giờ / 7 ngày / 30 ngày.

### 📊 Thống kê đa bệnh
Biểu đồ và số liệu tổng hợp cho 6 bệnh: sốt xuất huyết, tay chân miệng, COVID-19, cúm, sởi, tả — trên một giao diện duy nhất.

### 🌦️ Dự báo rủi ro khí hậu
Dự báo 14 ngày nguy cơ bùng phát sốt xuất huyết và tay chân miệng cho 8 tỉnh thành, dựa trên dữ liệu thời tiết thực từ Open-Meteo. Cảnh báo sớm 2–4 tuần trước khi dịch leo thang.

### 🤖 AI Assistant
Chatbot tích hợp, hỗ trợ tiếng Việt và tiếng Anh, kết nối trực tiếp với dữ liệu dịch tễ hiện tại. Hỏi: *"Tình hình sốt xuất huyết tháng này ở miền Nam như thế nào?"* — nhận câu trả lời dựa trên dữ liệu thực. Hỗ trợ 3 LLM provider: OpenRouter, Ollama (local), MLX.

### 📋 Biểu mẫu báo cáo ca bệnh
Form báo cáo đa bệnh với đầy đủ 63 tỉnh thành. Lưu tạm vào localStorage khi offline, tự động đồng bộ khi có kết nối. Phù hợp với cộng tác viên y tế cộng đồng làm việc tại vùng sâu, vùng xa.

### 📰 Tin tức y tế
Tổng hợp tự động từ 7 nguồn RSS: WHO, CDC, MOH-VN, ProMED, ECDC, ReliefWeb — lọc theo nguồn, cập nhật liên tục.

### 🌍 Tình hình sức khỏe quốc gia & xu hướng dịch bệnh
So sánh xu hướng dịch theo thời gian, theo quốc gia/tỉnh thành. Dữ liệu từ Our World In Data và WHO.

---

## Đối tượng sử dụng

| Đối tượng | Nhu cầu chính |
|-----------|--------------|
| **Cán bộ y tế dự phòng** (trung ương, tỉnh, huyện) | Theo dõi diễn biến dịch, phát hiện ổ dịch mới, báo cáo lên cấp trên |
| **Cộng tác viên y tế cộng đồng** (50K+ người) | Báo cáo ca bệnh nhanh từ điện thoại, kể cả khi offline |
| **Chuyên gia dịch tễ học** | Phân tích xu hướng, dự báo, hỗ trợ nghiên cứu |
| **Truyền thông y tế & báo chí** | Nắm bắt tình hình dịch theo thời gian thực, thông tin chính xác từ nhiều nguồn |
| **Cơ quan quản lý & hoạch định chính sách** | Dashboard tổng quan để ra quyết định ứng phó, phân bổ nguồn lực |

---

## Tác động kỳ vọng

- **Rút ngắn thời gian từ ca bệnh đến hành động** từ 4+ tuần xuống dưới 24 giờ
- **Tăng độ phủ báo cáo** từ tuyến cộng đồng nhờ form offline-first, thân thiện với mobile
- **Cảnh báo sớm bùng phát** 2–4 tuần trước mùa đỉnh dịch nhờ mô hình khí hậu tích hợp
- **Giảm chi phí và thời gian** tổng hợp dữ liệu từ nhiều nguồn cho cán bộ phân tích
- **Nâng cao năng lực giám sát** ở cấp tỉnh/huyện — nơi hệ thống hiện tại còn yếu nhất

---

## Công nghệ

| Thành phần | Công nghệ |
|-----------|-----------|
| Frontend | TypeScript, Vite, Web Components |
| Bản đồ | deck.gl, MapLibre GL JS |
| AI | OpenRouter API / Ollama (local) / MLX |
| Dữ liệu thời tiết | Open-Meteo API |
| Nguồn dịch tễ | WHO DON, CDC, MOH-VN, ProMED, ECDC, ReliefWeb, OWID, WHO-VN |
| Triển khai | Docker, Vercel, nginx |
| Kiểm thử | Playwright (15 E2E tests), TypeScript strict mode |
| Bundle size | 455 KB (gzipped) |

Toàn bộ mã nguồn mở, self-hostable — tổ chức có thể triển khai trên hạ tầng riêng để bảo đảm an toàn dữ liệu.

---

## Roadmap tóm tắt

### P1 — Offline Mobile & PWA *(quý 2/2026)*
- Service worker, PWA installable trên điện thoại
- IndexedDB sync queue cho báo cáo ca bệnh
- Giao diện mobile tối ưu hóa cho cộng tác viên y tế

### P2 — Ops Board kiểm soát vector *(quý 3/2026)*
- Bản đồ liên kết: ca bệnh → lịch phun thuốc → hiệu quả
- Theo dõi trạng thái phun xịt theo quận/huyện

### P3 — Báo cáo cộng đồng & giám sát môi trường *(quý 4/2026)*
- Form báo cáo triệu chứng cho người dân, phụ huynh
- Tích hợp dữ liệu giám sát nước thải (wastewater surveillance)

### P4 — Tích hợp dữ liệu chính thức *(2027)*
- API HCDC, NIHE, WHO GHO
- Kết nối eCDS (định dạng Thông tư 54)
- Chia sẻ cảnh báo xuyên biên giới (Lào, Campuchia)

---

## Thông tin liên hệ & tham gia

Epidemic Monitor là dự án mã nguồn mở, hướng đến cộng đồng y tế công cộng Việt Nam và khu vực.

Chúng tôi hoan nghênh sự hợp tác từ: cơ quan y tế, tổ chức nghiên cứu, nhà tài trợ, và cộng đồng developer.

> **GitHub:** *(link sẽ cập nhật sau khi public)*
> **Demo:** *(link deployment)*
> **Liên hệ:** *(email/contact)*

---

*Xây dựng trong 1 ngày với AI-assisted development · April 2026 · Vietnam*
