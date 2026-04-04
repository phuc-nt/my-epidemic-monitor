/**
 * Disease Trend Chart Panel
 * Renders a sparkline SVG chart for a selected disease's case trend.
 * Shows placeholder until data is provided via setData().
 */

import { Panel } from '@/components/panel-base';
import { escapeHtml } from '@/utils/sanitize';
import { h } from '@/utils/dom-utils';
import { renderSVGArea } from '@/utils/sparkline';

type Period = '30d' | '90d' | '1y';

const PERIOD_LABELS: Record<Period, string> = {
  '30d': '30 Days',
  '90d': '90 Days',
  '1y': '1 Year',
};

export class TrendChartPanel extends Panel {
  private _label = '';
  private _allValues: number[] = [];
  private _period: Period = '30d';

  constructor() {
    super({ id: 'trend-chart', title: 'Disease Trend', defaultRowSpan: 2 });
    this._renderPlaceholder();
  }

  /**
   * Provide full dataset (assume values ordered oldest→newest).
   * Panel slices to the active period window.
   */
  setData(label: string, values: number[]): void {
    this._label = label;
    this._allValues = values;
    this._render();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _periodSlice(): number[] {
    const counts: Record<Period, number> = { '30d': 30, '90d': 90, '1y': 365 };
    const n = counts[this._period];
    return this._allValues.slice(-n);
  }

  private _renderPlaceholder(): void {
    const msg = h('p', { className: 'trend-placeholder' },
      'Select a disease to view case trends.',
    );
    this.setContentNode(h('div', { className: 'trend-root' }, msg));
  }

  private _render(): void {
    if (!this._allValues.length) { this._renderPlaceholder(); return; }

    const root = h('div', { className: 'trend-root' });

    // Label row
    const labelEl = h('div', { className: 'trend-label' }, escapeHtml(this._label));
    root.appendChild(labelEl);

    // Period selector
    root.appendChild(this._buildPeriodSelector());

    // Chart
    const slice = this._periodSlice();
    const chartHtml = renderSVGArea(slice, 300, 80, '#e74c3c');
    const chartEl = h('div', { className: 'trend-chart' });
    chartEl.innerHTML = chartHtml; // SVG is generated internally — safe, no user data
    root.appendChild(chartEl);

    // Min / max annotation — only show when enough data points for meaningful trend
    if (slice.length > 1) {
      const max = Math.max(...slice);
      const min = Math.min(...slice);
      const annotation = h('div', { className: 'trend-annotation' },
        h('span', {}, `Min: ${min.toLocaleString()}`),
        h('span', {}, `Max: ${max.toLocaleString()}`),
        h('span', {}, `${slice.length} data points`),
      );
      root.appendChild(annotation);
    } else if (slice.length === 1) {
      root.appendChild(h('p', { className: 'trend-placeholder' }, 'Cần thêm dữ liệu để hiển thị xu hướng'));
    }

    this.setContentNode(root);
  }

  private _buildPeriodSelector(): HTMLElement {
    const bar = h('div', { className: 'trend-period-bar' });
    const periods: Period[] = ['30d', '90d', '1y'];

    for (const p of periods) {
      const btn = h('button', {
        className: `trend-period-btn${this._period === p ? ' trend-period-btn--active' : ''}`,
        dataset: { period: p },
      }, PERIOD_LABELS[p]);

      btn.addEventListener('click', () => {
        this._period = p;
        this._render();
      });

      bar.appendChild(btn);
    }

    return bar;
  }
}
