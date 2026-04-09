/**
 * Top Diseases panel — shows which diseases are currently trending.
 * Simple table derived from the current outbreak list (no server stats).
 */
import { h } from '@/utils/dom-utils';
import { escapeHtml } from '@/utils/sanitize';
import { Panel } from '@/components/panel-base';
import { diseaseLabel } from '@/components/case-report-panel-data';
import type { DiseaseOutbreakItem } from '@/types';

const MAX_ROWS = 10;

export class TopDiseasesPanel extends Panel {
  constructor() {
    super({ id: 'top-diseases', title: 'Bệnh đang nóng', defaultRowSpan: 2 });
  }

  /** Rebuild table from the current outbreak list. Groups by human label to
   *  merge variants that map to the same disease (e.g., 'hfmd' and 'hand-foot-mouth'). */
  updateData(outbreaks: DiseaseOutbreakItem[]): void {
    const count = new Map<string, number>();
    for (const o of outbreaks) {
      const label = diseaseLabel(o.disease);
      count.set(label, (count.get(label) ?? 0) + 1);
    }

    const top = Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ROWS);

    if (top.length === 0) {
      this.setContentNode(
        h('p', { className: 'top-diseases-empty' }, 'Chưa có dữ liệu.'),
      );
      return;
    }

    const rows = top.map(([label, n]) =>
      h('tr', {},
        h('td', { className: 'top-diseases-name' }, escapeHtml(label)),
        h('td', { className: 'top-diseases-count' }, String(n)),
      ),
    );

    const table = h('table', { className: 'top-diseases-table' },
      h('thead', {},
        h('tr', {},
          h('th', {}, 'Bệnh'),
          h('th', { className: 'top-diseases-count' }, 'Số ổ dịch'),
        ),
      ),
      h('tbody', {}, ...rows),
    );

    this.setContentNode(table);
  }
}
