---
layout: default
title: Vì sao
nav_order: 2
description: "Vì sao cần một hệ thống cảnh báo dịch bệnh từ tin tức + mạng xã hội ở Việt Nam."
---

# Vì sao có dự án này

## Nỗi lo lặp lại mỗi năm

Nếu bạn là phụ huynh có con nhỏ ở Việt Nam, lịch dịch bệnh trong năm gần như đã thuộc lòng:

| Tháng | Mùa dịch chính |
|-------|----------------|
| 4 – 6 | Cúm mùa, sởi, ho gà, thuỷ đậu |
| 6 – 8 | **Sốt xuất huyết** (cao điểm muỗi) |
| 8 – 11 | **Tay chân miệng** (mở trường học) |
| Quanh năm | Tiêu chảy, ngộ độc thực phẩm, RSV ở trẻ sơ sinh |

Khi ổ dịch xuất hiện ở trường mầm non bên cạnh, hoặc ở phường đối diện, **bạn thường biết quá muộn**. Lúc đó con đã đi học, đã chơi cùng bạn, đã có thể bị phơi nhiễm.

---

## Báo cáo chính thống không đủ nhanh

Bộ Y tế và CDC tỉnh có hệ thống giám sát rất tốt. Nhưng:

- **Báo cáo tuần** thường công bố sau 5–10 ngày
- **Báo cáo tỉnh** đôi khi không lên cấp trung ương trong vòng 1–2 tuần
- **Mạng phường/xã** thường chỉ thông báo khi đã có ca xác nhận đầu tiên

Trong khi đó, **báo chí và mạng xã hội đã viết về ổ dịch trước đó vài ngày**:
- Báo địa phương đăng ngay khi sở y tế tỉnh thông báo
- Phóng viên y tế của báo lớn (Tuổi Trẻ, VnExpress…) phỏng vấn bác sĩ tuyến đầu
- YouTube y tế đăng video phân tích trong vòng 1 ngày
- Phụ huynh đăng Facebook hỏi nhau khi con bị ốm bất thường

Vấn đề là: **không ai có thời gian đọc hết các nguồn này mỗi ngày.**

---

## Ý tưởng đơn giản

> Để máy đọc giúp. AI lọc ra cái nào thực sự là dịch. Đưa lên một bản đồ duy nhất.

Đó là toàn bộ ý tưởng của Epidemic Monitor.

```
20+ từ khoá dịch bệnh tiếng Việt
        ↓
Quét báo + YouTube + Facebook (mỗi 6h)
        ↓
AI lọc: có phải tin dịch thật không? ở Việt Nam không?
        ↓
Trích xuất: bệnh gì, tỉnh nào, bao nhiêu ca, cảnh báo cấp mấy
        ↓
Bản đồ + danh sách ổ dịch + dòng tin
```

Toàn bộ chạy tự động. Bạn chỉ cần mở app, nhìn bản đồ, biết ngay tuần này có gì cần lo.

---

## So sánh nhanh

| Cách tiếp cận | Vấn đề |
|---------------|--------|
| Tự đọc Bộ Y tế / CDC tỉnh | Chậm 1–2 tuần. Không có bản đồ. |
| Tự đọc báo mỗi ngày | Mất thời gian. Tin trùng lặp. Khó tổng hợp. |
| Hỏi bác sĩ quen | Phụ thuộc vào người. Không scale. |
| Group phụ huynh trên Facebook | Tin đồn. Không có nguồn. Hoảng loạn không cần thiết. |
| **Epidemic Monitor** | **Tự động. Có nguồn. Có bản đồ. Có AI lọc.** |

---

## Tại sao "tin tức" và "mạng xã hội" lại đáng tin?

Câu hỏi đúng. Câu trả lời ngắn: **tin một mình không đáng tin, nhưng tổng hợp nhiều tin từ nguồn uy tín thì đáng.**

Hệ thống có 3 lớp lọc:

1. **Lớp nguồn** — chỉ đọc 12 báo lớn đã được kiểm chứng (suckhoedoisong.vn, vnexpress.net, tuoitre.vn, thanhnien.vn, dantri.com.vn, laodong.vn, vietnamnet.vn, nld.com.vn, kenh14.vn, vtcnews.vn, nhandan.vn). Facebook/YouTube qua Google SERP và YouTube Data API có rank.
2. **Lớp AI** — MiniMax M2.7 đọc bài, hỏi: *"Đây có phải tin dịch thật không? Có phải ở Việt Nam không?"*. Nếu không chắc → loại.
3. **Lớp dedup + confidence** — bài trùng URL bị loại. Bài có độ tin cậy < 0.5 bị loại.

Kết quả: trong cùng một cycle, nếu bạn thấy 5 báo cùng đưa tin về một ổ tay chân miệng ở Đồng Nai, **rất có thể đó là tin thật**.

---

## Đây không phải gì

- ❌ Không phải hệ thống y tế chính thức. Không thay thế CDC, không thay thế bác sĩ.
- ❌ Không phải hệ thống dự báo. Chỉ tổng hợp những gì *đã* xảy ra.
- ❌ Không phải nguồn duy nhất. Hãy luôn cross-check với Bộ Y tế khi cần ra quyết định quan trọng.

## Đây là gì

- ✅ Một **early-warning radar** để phụ huynh chủ động hơn
- ✅ Một **bản đồ tổng quan** thay vì 20 tab báo
- ✅ Một **nguồn open-source**, miễn phí, không quảng cáo, không tracking
