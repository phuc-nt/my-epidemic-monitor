<p align="center">
  <img src="assets/logo.svg" alt="Epidemic Monitor logo" width="220" />
</p>

<h1 align="center">Epidemic Monitor</h1>

<p align="center">
  <strong>Bản đồ cảnh báo nguy cơ sức khoẻ · Việt Nam</strong>
</p>

<p align="center">
  <em>AI tổng hợp tin tức y tế công cộng từ báo chí Việt Nam, mỗi 6 giờ. Công cụ tham khảo cộng đồng — không thay thế CDC.</em>
</p>

<p align="center">
  <a href="https://epidemic-monitor.pages.dev"><strong>🌐 Mở app</strong></a> ·
  <a href="https://phuc-nt.github.io/my-epidemic-monitor/"><strong>📖 Docs</strong></a>
</p>

---

## Vì sao

Mỗi năm, phụ huynh có con nhỏ ở Việt Nam đều lo cùng một thứ: **mùa dịch lại tới**. Sốt xuất huyết tháng 7, tay chân miệng tháng 9, sởi/cúm/ho gà rải rác cả năm. Báo cáo Bộ Y tế chậm vài ngày tới vài tuần — trong khi đó báo chí và mạng xã hội đã viết từ trước.

Epidemic Monitor đọc giùm bạn. Mỗi 6 giờ, AI quét các báo Việt Nam tin cậy, lọc ra tin có ca bệnh / sự kiện sức khoẻ cộng đồng cụ thể ở Việt Nam, đưa lên một **bản đồ cảnh báo nguy cơ sức khoẻ** duy nhất với attribution rõ ràng cho từng nguồn báo. Mở là dùng, không đăng ký, miễn phí, không quảng cáo, không tracking.

Cách tiếp cận **Social Listening** này là phương pháp tiêu chuẩn mà WHO và US CDC đã áp dụng từ lâu để xây dựng cảnh báo nguy cơ sức khoẻ cộng đồng dựa trên các nguồn tin không chính thống.

> ⚠️ Đây là **công cụ tham khảo**, không phải công bố chính thức. Luôn đối chiếu với [Bộ Y tế](https://moh.gov.vn) và CDC tỉnh trước khi ra quyết định quan trọng.

## Quick start

```bash
npm install
npm run dev     # → http://localhost:5173
npm run deploy  # → https://epidemic-monitor.pages.dev
```

## Stack

Vanilla TS + Vite + deck.gl + MapLibre GL · Cloudflare Pages Functions + D1 (native binding) · MiniMax M2.7 via OpenRouter · Playwright E2E.

Pipeline crawl + extract chạy tách biệt trên Mac Mini, push data lên D1 mỗi 6h — frontend không phụ thuộc uptime của Mac Mini.

## License

AGPL-3.0 — Non-commercial. Xem [LICENSE](LICENSE).

Một dự án cá nhân của [@phuc-nt](https://github.com/phuc-nt), làm vì vấn đề có thật muốn giải quyết cho chính gia đình mình.
