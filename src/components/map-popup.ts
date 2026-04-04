/**
 * Map Popup
 * Floating overlay that appears on marker click.
 * Positioned relative to the map container (fixed coords).
 * Closes on button click or Escape key.
 */

import { h } from '@/utils/dom-utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import type { DiseaseOutbreakItem, AlertLevel } from '@/types';

const ALERT_LABELS: Record<AlertLevel, string> = {
  alert:   'ALERT',
  warning: 'WARNING',
  watch:   'WATCH',
};

const ALERT_COLORS: Record<AlertLevel, string> = {
  alert:   '#e74c3c',
  warning: '#e67e22',
  watch:   '#f1c40f',
};

export class MapPopup {
  private _el: HTMLElement;
  private _container: HTMLElement;
  private _escHandler: (e: KeyboardEvent) => void;

  constructor(mapContainer: HTMLElement) {
    this._container = mapContainer;

    this._el = h('div', { className: 'map-popup', style: 'display:none' });
    this._container.appendChild(this._el);

    this._escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
  }

  /** Show popup near pixel (x, y) inside the map container. */
  show(item: DiseaseOutbreakItem, x: number, y: number): void {
    this._el.style.display = '';
    this._render(item);
    this._position(x, y);

    document.addEventListener('keydown', this._escHandler);
  }

  hide(): void {
    this._el.style.display = 'none';
    document.removeEventListener('keydown', this._escHandler);
  }

  /** Remove the popup element from the DOM entirely. */
  destroy(): void {
    this.hide();
    this._container.removeChild(this._el);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _render(item: DiseaseOutbreakItem): void {
    // Clear previous content
    while (this._el.firstChild) this._el.removeChild(this._el.firstChild);

    const badge = h('span', {
      className: 'map-popup-badge',
      style: `background:${ALERT_COLORS[item.alertLevel]}`,
    }, ALERT_LABELS[item.alertLevel]);

    const closeBtn = h('button', {
      className: 'map-popup-close',
      'aria-label': 'Close popup',
    }, '×');
    closeBtn.addEventListener('click', () => this.hide());

    const header = h('div', { className: 'map-popup-header' }, badge, closeBtn);

    const disease = h('h4', { className: 'map-popup-disease' }, escapeHtml(item.disease));
    const country = h('p',  { className: 'map-popup-country' }, escapeHtml(item.country));

    const date = h('p', { className: 'map-popup-date' },
      new Date(item.publishedAt).toLocaleDateString(),
    );

    const safeUrl = sanitizeUrl(item.url);
    const footer = safeUrl
      ? h('a', {
          href: safeUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'map-popup-link',
        }, 'View full report →')
      : h('span', {});

    this._el.appendChild(header);
    this._el.appendChild(disease);
    this._el.appendChild(country);
    this._el.appendChild(date);
    this._el.appendChild(footer);
  }

  private _position(x: number, y: number): void {
    const popupW = 220;
    const popupH = 160;
    const pad     = 8;
    const cw = this._container.clientWidth;
    const ch = this._container.clientHeight;

    // Prefer right of cursor; flip left if too close to edge
    let left = x + pad;
    if (left + popupW > cw - pad) left = x - popupW - pad;

    let top = y - popupH / 2;
    if (top < pad) top = pad;
    if (top + popupH > ch - pad) top = ch - popupH - pad;

    this._el.style.left = `${left}px`;
    this._el.style.top  = `${top}px`;
  }
}
