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
  private _showAllLocated = false;
  private _showAllUnlocated = false;
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
    // Auto-expand both columns when a province is selected
    this._showAllLocated = province !== null;
    this._showAllUnlocated = province !== null;
    this._syncProvinceChip();
    this._render();
    emit('province-filter-changed', province);
  }

  /** Filter list to a specific date (YYYY-MM-DD). Pass null to show all. */
  filterByDate(date: string | null): void {
    this._dateFilter = date;
    this._showAllLocated = false;
    this._showAllUnlocated = false;
    this._render();
  }

  /** Set escalation info — outbreaks that recently increased severity. */
  setEscalations(escalations: EscalationInfo[]): void {
    this._escalations = new Set(escalations.map(e => e.outbreakId));
    this._render();
  }

  /** Called by app-init when fresh outbreak data arrives. */
  updateData(outbreaks: DiseaseOutbreakItem[]): void {
    // Copy the array to prevent external mutation (e.g. dedup in processOutbreaks)
    // from changing our internal state behind our back.
    this._outbreaks = [...outbreaks];
    this.setCount(this._outbreaks.length);
    // Reset expanded state so "Xem thêm" count stays consistent with new data
    this._showAllLocated = false;
    this._showAllUnlocated = false;
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

  /** Provinces that represent nationwide/regional — no specific map location */
  private static readonly UNLOCATED = new Set(['Toàn quốc', 'phía Nam', 'ĐBSCL']);

  private _isUnlocated(o: DiseaseOutbreakItem): boolean {
    return DiseaseOutbreaksPanel.UNLOCATED.has(o.province ?? '') || !o.province;
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

    // Split: located (province-specific) vs unlocated (Toàn quốc, etc.)
    const located = items.filter(o => !this._isUnlocated(o));
    const unlocated = items.filter(o => this._isUnlocated(o));

    // Build 2-column layout: left = located, right = unlocated
    const leftCol = h('div', { className: 'outbreak-col outbreak-col--located' },
      h('div', { className: 'outbreak-col-header' }, `📍 Có vị trí (${located.length})`));
    const rightCol = h('div', { className: 'outbreak-col outbreak-col--unlocated' },
      h('div', { className: 'outbreak-col-header' }, `🌐 Toàn quốc / chưa rõ (${unlocated.length})`));

    const MAX_VISIBLE = 5;

    // Located column
    const visibleLocated = this._showAllLocated ? located : located.slice(0, MAX_VISIBLE);
    for (const item of visibleLocated) {
      leftCol.appendChild(this._buildRow(item));
    }
    if (located.length > MAX_VISIBLE) {
      const remaining = located.length - MAX_VISIBLE;
      const label = this._showAllLocated ? 'Thu gọn' : `Xem thêm (${remaining} mục)`;
      const btn = h('button', { className: 'outbreak-show-more' }, label);
      btn.addEventListener('click', () => {
        this._showAllLocated = !this._showAllLocated;
        this._render();
      });
      leftCol.appendChild(btn);
    }

    // Unlocated column
    const visibleUnlocated = this._showAllUnlocated ? unlocated : unlocated.slice(0, MAX_VISIBLE);
    for (const item of visibleUnlocated) {
      rightCol.appendChild(this._buildRow(item));
    }
    if (unlocated.length > MAX_VISIBLE) {
      const remaining = unlocated.length - MAX_VISIBLE;
      const label = this._showAllUnlocated ? 'Thu gọn' : `Xem thêm (${remaining} mục)`;
      const btn = h('button', { className: 'outbreak-show-more' }, label);
      btn.addEventListener('click', () => {
        this._showAllUnlocated = !this._showAllUnlocated;
        this._render();
      });
      rightCol.appendChild(btn);
    }

    if (located.length === 0) leftCol.appendChild(h('p', { className: 'outbreak-empty' }, 'Không có'));
    if (unlocated.length === 0) rightCol.appendChild(h('p', { className: 'outbreak-empty' }, 'Không có'));

    const grid = h('div', { className: 'outbreak-2col-grid' }, leftCol, rightCol);
    this._listEl.appendChild(grid);
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
