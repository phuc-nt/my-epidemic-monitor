/**
 * Disease Outbreaks Panel
 * Displays a filterable list of active disease outbreak alerts.
 */

import { Panel } from '@/components/panel-base';
import { emit, on } from '@/app/app-context';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { h } from '@/utils/dom-utils';
import type { DiseaseOutbreakItem, AlertLevel } from '@/types';
import type { EscalationInfo } from '@/services/trend-calculator';
import { diseaseLabel } from '@/components/case-report-panel-data';

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
  private _escalations: Set<string> = new Set();
  private _filter: AlertLevel | null = null;
  private _search = '';
  private _showAll = false;
  private _provinceFilter: string | null = null;
  private _dateFilter: string | null = null; // YYYY-MM-DD
  private _filterBar: HTMLElement;
  private _provinceChip: HTMLElement;
  private _searchInput: HTMLInputElement;
  private _listEl: HTMLElement;

  constructor() {
    super({ id: 'disease-outbreaks', title: 'Disease Outbreaks', showCount: true, defaultRowSpan: 3 });

    this._filterBar   = this._buildFilterBar();
    this._provinceChip = this._buildProvinceChip();
    this._searchInput = this._buildSearchInput();
    this._listEl = h('div', { className: 'outbreak-list' });

    const toolbar = h('div', { className: 'outbreak-toolbar' },
      this._filterBar,
      this._provinceChip,
      this._searchInput,
    );

    // Insert toolbar before content scroll area
    this.content.appendChild(toolbar);
    this.content.appendChild(this._listEl);

    // Listen for map marker clicks → filter by province
    on('map-marker-clicked', (data) => {
      const item = data as DiseaseOutbreakItem;
      this.filterByProvince(item.province ?? null);
    });
  }

  /**
   * Filter the outbreak list to show only outbreaks for a province.
   * Pass null to clear the filter.
   */
  filterByProvince(province: string | null): void {
    this._provinceFilter = province;
    this._showAll = province !== null; // auto-expand when province selected
    this._syncProvinceChip();
    this._render();
    emit('province-filter-changed', province);
  }

  /** Filter list to a specific date (YYYY-MM-DD). Pass null to show all. */
  filterByDate(date: string | null): void {
    this._dateFilter = date;
    this._showAll = false;
    this._render();
  }

  /** Set escalation info — outbreaks that recently increased severity. */
  setEscalations(escalations: EscalationInfo[]): void {
    this._escalations = new Set(escalations.map(e => e.outbreakId));
    this._render();
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
      this._provinceChip,
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

  /** Province filter chip — hidden by default, shown when a province is selected. */
  private _buildProvinceChip(): HTMLElement {
    const chip = h('div', { className: 'outbreak-province-chip outbreak-province-chip--hidden' });
    return chip;
  }

  /** Sync the province chip label and visibility. */
  private _syncProvinceChip(): void {
    if (this._provinceFilter) {
      this._provinceChip.textContent = '';
      const label = document.createTextNode(`📍 ${this._provinceFilter}`);
      const clearBtn = h('button', { className: 'outbreak-province-chip-clear', title: 'Xóa bộ lọc' }, '×');
      clearBtn.addEventListener('click', (e) => { e.stopPropagation(); this.filterByProvince(null); });
      this._provinceChip.appendChild(label);
      this._provinceChip.appendChild(clearBtn);
      this._provinceChip.classList.remove('outbreak-province-chip--hidden');
    } else {
      this._provinceChip.classList.add('outbreak-province-chip--hidden');
    }
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
      if (this._provinceFilter && o.province !== this._provinceFilter) return false;
      if (this._dateFilter) {
        const day = new Date(o.publishedAt).toISOString().split('T')[0];
        if (day !== this._dateFilter) return false;
      }
      if (this._search) {
        const hay = `${o.disease} ${o.country} ${o.province ?? ''}`.toLowerCase();
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

    const MAX_VISIBLE = 5;
    const visible = this._showAll ? items : items.slice(0, MAX_VISIBLE);
    for (const item of visible) {
      this._listEl.appendChild(this._buildRow(item));
    }

    // "Show more" button if truncated
    if (!this._showAll && items.length > MAX_VISIBLE) {
      const more = h('button', { className: 'outbreak-show-more' },
        `Xem thêm (${items.length - MAX_VISIBLE} mục)`);
      more.addEventListener('click', () => { this._showAll = true; this._render(); });
      this._listEl.appendChild(more);
    } else if (this._showAll && items.length > MAX_VISIBLE) {
      const less = h('button', { className: 'outbreak-show-more' }, 'Thu gọn');
      less.addEventListener('click', () => { this._showAll = false; this._render(); });
      this._listEl.appendChild(less);
    }
  }

  private _buildRow(item: DiseaseOutbreakItem): HTMLElement {
    const badge = h('span', {
      className: 'alert-badge',
      style: `background:${ALERT_COLORS[item.alertLevel]}`,
    }, ALERT_LABELS[item.alertLevel]);

    // Escalation badge if this outbreak recently upgraded severity
    const outbreakKey = `${item.disease}|${item.countryCode}`;
    const escalated = this._escalations.has(outbreakKey);

    const title = h('span', { className: 'outbreak-row-title' }, escapeHtml(diseaseLabel(item.disease)));

    const locParts = [];
    if (item.district) locParts.push(item.district);
    if (item.province && item.province !== item.country) locParts.push(item.province);

    const locationPart: (string | HTMLElement)[] =
      locParts.length > 0
        ? [' · ', escapeHtml(locParts.join(', '))]
        : [];

    const meta = h('span', { className: 'outbreak-row-meta' },
      escapeHtml(item.country), ...locationPart, ' · ', relativeTime(item.publishedAt),
      ...(item.source ? [' · ', h('span', { className: 'outbreak-source-badge' }, item.source)] : []),
      ...(escalated ? [' ', h('span', { className: 'escalation-badge' }, '⬆')] : []),
    );

    const safeUrl = sanitizeUrl(item.url);
    const link = safeUrl
      ? h('a', { href: safeUrl, target: '_blank', rel: 'noopener noreferrer', className: 'outbreak-row-link' }, '↗')
      : null;

    const isToday = new Date(item.publishedAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
    const todayClass = isToday ? ' outbreak-row--today' : '';
    const row = h('div', { className: `outbreak-row outbreak-row--${item.alertLevel}${todayClass}` },
      h('div', { className: 'outbreak-row-header' }, badge, title, ...(link ? [link] : [])),
      meta,
    );

    row.addEventListener('click', (e) => {
      // Don't intercept clicks on the external link
      if ((e.target as HTMLElement).tagName === 'A') return;
      emit('outbreak-selected', item);
    });

    return row;
  }
}
