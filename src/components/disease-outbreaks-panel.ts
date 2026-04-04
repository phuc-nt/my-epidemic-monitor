/**
 * Disease Outbreaks Panel
 * Displays a filterable list of active disease outbreak alerts.
 */

import { Panel } from '@/components/panel-base';
import { emit } from '@/app/app-context';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { h } from '@/utils/dom-utils';
import type { DiseaseOutbreakItem, AlertLevel } from '@/types';

const ALERT_LABELS: Record<AlertLevel, string> = {
  alert: 'ALERT',
  warning: 'WARNING',
  watch: 'WATCH',
};

const ALERT_COLORS: Record<AlertLevel, string> = {
  alert: '#e74c3c',
  warning: '#e67e22',
  watch: '#f1c40f',
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export class DiseaseOutbreaksPanel extends Panel {
  private _outbreaks: DiseaseOutbreakItem[] = [];
  private _filter: AlertLevel | null = null;
  private _search = '';
  private _filterBar: HTMLElement;
  private _searchInput: HTMLInputElement;
  private _listEl: HTMLElement;

  constructor() {
    super({ id: 'disease-outbreaks', title: 'Disease Outbreaks', showCount: true, defaultRowSpan: 3 });

    this._filterBar = this._buildFilterBar();
    this._searchInput = this._buildSearchInput();
    this._listEl = h('div', { className: 'outbreak-list' });

    const toolbar = h('div', { className: 'outbreak-toolbar' },
      this._filterBar,
      this._searchInput,
    );

    // Insert toolbar before content scroll area
    this.content.appendChild(toolbar);
    this.content.appendChild(this._listEl);
  }

  /** Called by app-init when fresh outbreak data arrives. */
  updateData(outbreaks: DiseaseOutbreakItem[]): void {
    this._outbreaks = outbreaks;
    this.setCount(outbreaks.length);
    // Re-mount toolbar + list (showLoading may have wiped content)
    this._remount();
    this._render();
  }

  /** Re-insert the toolbar and list container into the panel content area. */
  private _remount(): void {
    this.content.textContent = '';
    const toolbar = h('div', { className: 'outbreak-toolbar' },
      this._filterBar,
      this._searchInput,
    );
    this.content.appendChild(toolbar);
    this.content.appendChild(this._listEl);
  }

  // ---------------------------------------------------------------------------
  // Private — UI builders
  // ---------------------------------------------------------------------------

  private _buildFilterBar(): HTMLElement {
    const bar = h('div', { className: 'outbreak-filter-bar' });
    const levels: AlertLevel[] = ['alert', 'warning', 'watch'];

    for (const level of levels) {
      const btn = h('button', {
        className: 'outbreak-filter-btn',
        style: `--badge-color:${ALERT_COLORS[level]}`,
        dataset: { level },
      }, ALERT_LABELS[level]);

      btn.addEventListener('click', () => {
        this._filter = this._filter === level ? null : level;
        this._syncFilterButtons();
        this._render();
      });

      bar.appendChild(btn);
    }

    return bar;
  }

  private _buildSearchInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search disease / country…';
    input.className = 'outbreak-search';
    input.addEventListener('input', () => {
      this._search = input.value.trim().toLowerCase();
      this._render();
    });
    return input;
  }

  private _syncFilterButtons(): void {
    for (const btn of Array.from(this._filterBar.querySelectorAll('.outbreak-filter-btn'))) {
      const level = (btn as HTMLElement).dataset['level'] as AlertLevel;
      btn.classList.toggle('outbreak-filter-btn--active', this._filter === level);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — rendering
  // ---------------------------------------------------------------------------

  private _getFiltered(): DiseaseOutbreakItem[] {
    return this._outbreaks.filter(o => {
      if (this._filter && o.alertLevel !== this._filter) return false;
      if (this._search) {
        const hay = `${o.disease} ${o.country}`.toLowerCase();
        if (!hay.includes(this._search)) return false;
      }
      return true;
    });
  }

  private _render(): void {
    const items = this._getFiltered();

    // Remove previous children
    while (this._listEl.firstChild) this._listEl.removeChild(this._listEl.firstChild);

    if (!items.length) {
      const empty = h('p', { className: 'outbreak-empty' }, 'No outbreaks match the current filters.');
      this._listEl.appendChild(empty);
      return;
    }

    for (const item of items) {
      this._listEl.appendChild(this._buildRow(item));
    }
  }

  private _buildRow(item: DiseaseOutbreakItem): HTMLElement {
    const badge = h('span', {
      className: 'alert-badge',
      style: `background:${ALERT_COLORS[item.alertLevel]}`,
    }, ALERT_LABELS[item.alertLevel]);

    const title = h('span', { className: 'outbreak-row-title' }, escapeHtml(item.disease));
    const meta = h('span', { className: 'outbreak-row-meta' },
      escapeHtml(item.country), ' · ', relativeTime(item.publishedAt),
    );
    const summary = h('p', { className: 'outbreak-row-summary' },
      escapeHtml(item.summary.length > 100 ? `${item.summary.slice(0, 100)}…` : item.summary),
    );

    const safeUrl = sanitizeUrl(item.url);
    const link = safeUrl
      ? h('a', { href: safeUrl, target: '_blank', rel: 'noopener noreferrer', className: 'outbreak-row-link' }, 'Details →')
      : h('span', {});

    const row = h('div', { className: `outbreak-row outbreak-row--${item.alertLevel}` },
      h('div', { className: 'outbreak-row-header' }, badge, title, meta),
      summary,
      link,
    );

    row.addEventListener('click', (e) => {
      // Don't intercept clicks on the external link
      if ((e.target as HTMLElement).tagName === 'A') return;
      emit('outbreak-selected', item);
    });

    return row;
  }
}
