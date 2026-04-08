<p align="center">
  <img src="assets/logo.svg" alt="Epidemic Monitor logo" width="220" />
</p>

<h1 align="center">Epidemic Monitor</h1>

<p align="center">
  <em>Phát hiện sớm điểm nóng dịch bệnh ở Việt Nam — từ báo chí, YouTube và mạng xã hội.</em>
</p>

<p align="center">
  <a href="https://epidemic-monitor.pages.dev"><strong>🌐 Mở app</strong></a> ·
  <a href="https://phuc-nt.github.io/my-epidemic-monitor/"><strong>📖 Docs</strong></a>
</p>

---

## Vì sao

Mỗi năm, phụ huynh có con nhỏ ở Việt Nam đều lo cùng một thứ: **mùa dịch lại tới**. Sốt xuất huyết tháng 7, tay chân miệng tháng 9, sởi/cúm/ho gà rải rác cả năm. Báo cáo Bộ Y tế chậm vài ngày tới vài tuần — trong khi đó báo chí và mạng xã hội đã viết từ trước.

Epidemic Monitor đọc giùm bạn. Mỗi 6 giờ, AI quét báo VN + YouTube + Facebook, lọc ra tin dịch thật ở Việt Nam, đưa lên một bản đồ duy nhất. Mở là dùng, không đăng ký, miễn phí.

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
