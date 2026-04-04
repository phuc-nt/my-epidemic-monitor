/**
 * Breaking News Banner component.
 * Fixed bar at top of page for urgent health alerts.
 * Auto-dismisses after 30 seconds; manual dismiss via ✕ button.
 */
import '@/styles/breaking-news.css';

const AUTO_DISMISS_MS = 30_000;

export class BreakingNewsBanner {
  private _el: HTMLElement;
  private _textEl: HTMLSpanElement;
  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Icon span
    const icon = document.createElement('span');
    icon.className = 'breaking-news-banner__icon';
    icon.textContent = '⚠';
    icon.setAttribute('aria-hidden', 'true');

    // Label span
    const label = document.createElement('span');
    label.className = 'breaking-news-banner__label';
    label.textContent = 'CẢNH BÁO';

    // Message text span
    this._textEl = document.createElement('span');
    this._textEl.className = 'breaking-news-banner__text';

    // Dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'breaking-news-banner__dismiss';
    dismissBtn.textContent = '✕';
    dismissBtn.title = 'Đóng thông báo';
    dismissBtn.setAttribute('aria-label', 'Dismiss alert');
    dismissBtn.addEventListener('click', () => this.dismiss());

    // Root banner element — hidden by default via CSS transform
    this._el = document.createElement('div');
    this._el.className = 'breaking-news-banner';
    this._el.setAttribute('role', 'alert');
    this._el.setAttribute('aria-live', 'assertive');
    this._el.appendChild(icon);
    this._el.appendChild(label);
    this._el.appendChild(this._textEl);
    this._el.appendChild(dismissBtn);

    // Prepend to #app if present, fallback to body
    const root = document.getElementById('app') ?? document.body;
    root.insertBefore(this._el, root.firstChild);
  }

  /**
   * Show a breaking news alert.
   * @param message - Alert text to display
   * @param level   - 'alert' (red) or 'warning' (orange)
   */
  show(message: string, level: 'alert' | 'warning' = 'alert'): void {
    // Clear any existing auto-dismiss timer
    this._clearTimer();

    // Update level modifier classes
    this._el.classList.remove('breaking-news-banner--alert', 'breaking-news-banner--warning');
    this._el.classList.add(`breaking-news-banner--${level}`);

    // Set message text (safe — textContent only, no innerHTML)
    this._textEl.textContent = message;

    // Slide down
    this._el.classList.add('breaking-news-banner--visible');

    // Auto-dismiss after 30 seconds
    this._dismissTimer = setTimeout(() => this.dismiss(), AUTO_DISMISS_MS);
  }

  /** Hide the banner and clear the auto-dismiss timer. */
  dismiss(): void {
    this._clearTimer();
    this._el.classList.remove('breaking-news-banner--visible');
  }

  /** Remove from DOM entirely (call when app is torn down). */
  destroy(): void {
    this._clearTimer();
    this._el.remove();
  }

  private _clearTimer(): void {
    if (this._dismissTimer !== null) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }
}
