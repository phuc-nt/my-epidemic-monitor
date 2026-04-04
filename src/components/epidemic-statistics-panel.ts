/**
 * Epidemic Statistics Panel
 * Displays summary counters and a sortable top-diseases table.
 * Supports optional delta indicators to show changes over time.
 */

import { Panel } from '@/components/panel-base';
import { escapeHtml } from '@/utils/sanitize';
import { h } from '@/utils/dom-utils';
import type { EpidemicStats } from '@/types';

type SortDir = 'asc' | 'desc';

/** Delta data comparing current snapshot to a previous one. */
export interface StatsDelta {
  totalCasesDelta: number;
  totalDeathsDelta: number;
  newOutbreaks: number;
  trend: string;
}

export class EpidemicStatisticsPanel extends Panel {
  private _stats: EpidemicStats | null = null;
  private _delta: StatsDelta | undefined = undefined;
  private _sortDir: SortDir = 'desc';

  constructor() {
    super({ id: 'epidemic-stats', title: 'Epidemic Statistics', defaultRowSpan: 2 });
  }

  /** Replace displayed data (backward compatible — no arrows shown when called without delta). */
  updateData(stats: EpidemicStats): void {
    this._stats = stats;
    this._delta = undefined;
    this._render();
  }

  /** Update stats with optional delta from previous snapshot. */
  updateDataWithDelta(stats: EpidemicStats, delta?: StatsDelta): void {
    this._stats = stats;
    this._delta = delta;
    this._render();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _render(): void {
    if (!this._stats) {
      this.setContent('<p class="stats-empty">No statistics available.</p>');
      return;
    }

    const s = this._stats;
    const root = h('div', { className: 'stats-root' });

    // Summary row
    root.appendChild(this._buildSummaryRow(s));

    // Trend banner (only when delta provided)
    if (this._delta) {
      root.appendChild(this._buildTrendBanner(this._delta));
    }

    // Top diseases table
    root.appendChild(this._buildTable(s));

    // Last updated
    const updated = h('p', { className: 'stats-updated' },
      `Updated: ${new Date(s.lastUpdated).toLocaleString()}`,
    );
    root.appendChild(updated);

    this.setContentNode(root);
  }

  private _buildSummaryRow(s: EpidemicStats): HTMLElement {
    const d = this._delta;

    const stat = (label: string, value: number, cls: string, deltaValue?: number) => {
      const valueEl = h('span', { className: 'stats-counter-value' }, String(value));

      // Append delta badge if provided and non-zero
      if (deltaValue !== undefined && deltaValue !== 0) {
        const isRising = deltaValue > 0;
        const arrow = isRising ? '↑' : '↓';
        const badgeCls = isRising ? 'stats-delta--up' : 'stats-delta--down';
        const badge = h('span', { className: `stats-delta ${badgeCls}` },
          `${arrow}${Math.abs(deltaValue)}`,
        );
        valueEl.appendChild(badge);
      }

      return h('div', { className: `stats-counter ${cls}` },
        valueEl,
        h('span', { className: 'stats-counter-label' }, label),
      );
    };

    return h('div', { className: 'stats-summary' },
      stat('Total Outbreaks', s.totalOutbreaks, 'stats-counter--total', d?.newOutbreaks),
      stat('Active Alerts', s.activeAlerts, 'stats-counter--alert', d?.totalCasesDelta),
      stat('Countries', s.countriesAffected, 'stats-counter--countries'),
    );
  }

  /** Small trend banner shown below counters when delta data is available. */
  private _buildTrendBanner(delta: StatsDelta): HTMLElement {
    const trendLower = delta.trend.toLowerCase();

    let trendLabel: string;
    let trendCls: string;

    if (trendLower.includes('tăng') || trendLower.includes('increas') || trendLower.includes('rising')) {
      trendLabel = 'Xu hướng: Tăng';
      trendCls = 'stats-trend--up';
    } else if (trendLower.includes('giảm') || trendLower.includes('decreas') || trendLower.includes('falling')) {
      trendLabel = 'Xu hướng: Giảm';
      trendCls = 'stats-trend--down';
    } else {
      trendLabel = 'Xu hướng: Ổn định';
      trendCls = 'stats-trend--stable';
    }

    return h('p', { className: `stats-trend ${trendCls}` }, trendLabel);
  }

  private _buildTable(s: EpidemicStats): HTMLElement {
    const sorted = [...s.topDiseases].sort((a, b) =>
      this._sortDir === 'desc' ? b.count - a.count : a.count - b.count,
    );

    const sortArrow = this._sortDir === 'desc' ? ' ↓' : ' ↑';

    const countHeader = h('th', { className: 'stats-th stats-th--sortable', scope: 'col' },
      `Count${sortArrow}`,
    );
    countHeader.addEventListener('click', () => {
      this._sortDir = this._sortDir === 'desc' ? 'asc' : 'desc';
      this._render();
    });

    const thead = h('thead', {},
      h('tr', {},
        h('th', { className: 'stats-th', scope: 'col' }, 'Disease'),
        countHeader,
      ),
    );

    const tbody = h('tbody', {});
    for (const row of sorted) {
      tbody.appendChild(
        h('tr', { className: 'stats-row' },
          h('td', { className: 'stats-td' }, escapeHtml(row.disease)),
          h('td', { className: 'stats-td stats-td--count' }, String(row.count)),
        ),
      );
    }

    const table = h('table', { className: 'stats-table' }, thead, tbody);
    const wrapper = h('div', { className: 'stats-table-wrapper' }, table);
    const heading = h('h4', { className: 'stats-section-title' }, 'Top Diseases');

    return h('div', { className: 'stats-diseases' }, heading, wrapper);
  }
}
