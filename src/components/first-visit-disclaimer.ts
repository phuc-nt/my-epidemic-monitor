/**
 * First-visit disclaimer modal.
 * Shows once per 30 days (tracked in localStorage). Blocks the UI until the
 * user explicitly acknowledges that Epidemic Monitor is an AI-aggregated
 * reference tool, not an official health authority announcement.
 *
 * Legal rationale: provides evidence that every user was informed about the
 * app's nature before using it, which strengthens the defense against
 * Nghị định 15/2020 Điều 101 claims ("cung cấp thông tin sai sự thật gây
 * hoang mang dư luận"). User opt-in is a documented due-diligence step.
 */
import { h } from '@/utils/dom-utils';

const ACK_KEY = 'em_disclaimer_ack_v1';
const ACK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Has the user acknowledged the disclaimer within the last 30 days? */
function hasValidAck(): boolean {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) < ACK_TTL_MS;
  } catch {
    // localStorage blocked (private mode) — treat as un-acknowledged
    return false;
  }
}

/** Record the acknowledgment timestamp. */
function recordAck(): void {
  try {
    localStorage.setItem(ACK_KEY, String(Date.now()));
  } catch {
    // Private browsing — fail silently, modal will show again next visit
  }
}

/** Build + mount the modal. Returns a promise that resolves when acknowledged. */
function showModal(): Promise<void> {
  return new Promise((resolve) => {
    const ackBtn = h('button', { className: 'em-disclaimer-ack-btn' }, 'Tôi đã hiểu, tiếp tục');

    const modal = h('div', { className: 'em-disclaimer-modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { className: 'em-disclaimer-card' },
        h('div', { className: 'em-disclaimer-header' },
          h('img', { className: 'em-disclaimer-logo', src: '/logo.svg', alt: 'Epidemic Monitor' }),
          h('h2', { className: 'em-disclaimer-title' }, 'Trước khi sử dụng'),
        ),
        h('p', { className: 'em-disclaimer-intro' },
          'Epidemic Monitor là công cụ tham khảo cá nhân, tự động tổng hợp tin dịch bệnh từ báo chí Việt Nam bằng AI.',
        ),
        h('div', { className: 'em-disclaimer-section em-disclaimer-section--not' },
          h('div', { className: 'em-disclaimer-section-title' }, '❗ KHÔNG PHẢI:'),
          h('ul', {},
            h('li', {}, 'Công bố chính thức của cơ quan y tế'),
            h('li', {}, 'Tư vấn y khoa chuyên môn'),
            h('li', {}, 'Cơ sở để ra quyết định du lịch / kinh tế quan trọng'),
          ),
        ),
        h('div', { className: 'em-disclaimer-section em-disclaimer-section--yes' },
          h('div', { className: 'em-disclaimer-section-title' }, '✅ CÓ THỂ DÙNG ĐỂ:'),
          h('ul', {},
            h('li', {}, 'Theo dõi nhanh tin tức dịch bệnh được báo chí đưa'),
            h('li', {}, 'Phát hiện sớm để tra cứu thêm từ nguồn chính thống'),
            h('li', {}, 'Tham khảo cho phụ huynh theo dõi mùa dịch'),
          ),
        ),
        h('p', { className: 'em-disclaimer-footer' },
          'Để có thông tin chính xác, luôn đối chiếu với ',
          h('a', { href: 'https://moh.gov.vn', target: '_blank', rel: 'noopener noreferrer' }, 'Bộ Y tế'),
          ', ',
          h('a', { href: 'https://vncdc.gov.vn', target: '_blank', rel: 'noopener noreferrer' }, 'Cục Y tế dự phòng'),
          ' và CDC các tỉnh.',
        ),
        h('div', { className: 'em-disclaimer-actions' }, ackBtn),
      ),
    );

    ackBtn.addEventListener('click', () => {
      recordAck();
      modal.remove();
      resolve();
    });

    document.body.appendChild(modal);
    // Focus the ack button so Enter/Space can dismiss it
    setTimeout(() => ackBtn.focus(), 50);
  });
}

/**
 * Show the disclaimer modal if the user hasn't acknowledged it in the last
 * 30 days. Resolves immediately if the user has a valid acknowledgment.
 */
export function ensureDisclaimerAcknowledged(): Promise<void> {
  if (hasValidAck()) return Promise.resolve();
  return showModal();
}
