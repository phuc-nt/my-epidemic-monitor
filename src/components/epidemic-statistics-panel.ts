/**
 * Epidemic Statistics Panel
 * Displays summary counters and a sortable top-diseases table.
 */

import { Panel } from '@/components/panel-base';
import { escapeHtml } from '@/utils/sanitize';
import { h } from '@/utils/dom-utils';
import type { EpidemicStats } from '@/types';

type SortDir = 'asc' | 'desc';

export class EpidemicStatisticsPanel extends Panel {
  private _stats: EpidemicStats | null = null;
  private _sortDir: SortDir = 'desc';

  constructor() {
    super({ id: 'epidemic-stats', title: 'Epidemic Statistics', defaultRowSpan: 2 });
  }

  /** Replace displayed data. */
  updateData(stats: EpidemicStats): void {
    this._stats = stats;
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
    const stat = (label: string, value: number, cls: string) =>
      h('div', { className: `stats-counter ${cls}` },
        h('span', { className: 'stats-counter-value' }, String(value)),
        h('span', { className: 'stats-counter-label' }, label),
      );

    return h('div', { className: 'stats-summary' },
      stat('Total Outbreaks', s.totalOutbreaks, 'stats-counter--total'),
      stat('Active Alerts', s.activeAlerts, 'stats-counter--alert'),
      stat('Countries', s.countriesAffected, 'stats-counter--countries'),
    );
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
