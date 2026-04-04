/**
 * News Feed Panel component.
 * Displays health news from multiple sources with source filter badges.
 * Auto-refreshes every 15 minutes.
 */
import { Panel } from '@/components/panel-base';
import { fetchHealthNews } from '@/services/news-feed-service';
import type { NewsItem } from '@/types/index';
import { h } from '@/utils/dom-utils';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** Source display config: label → CSS color variable */
const SOURCE_COLORS: Record<string, string> = {
  WHO: '#1976d2',
  'WHO-VN': '#1565c0',
  'MOH-VN': '#c62828',
  CDC: '#388e3c',
  ProMED: '#f57c00',
  ECDC: '#7b1fa2',
  ReliefWeb: '#00796b',
};

function relativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function sourceBadge(source: string, active: boolean, onClick: () => void): HTMLElement {
  const color = SOURCE_COLORS[source] ?? '#555';
  const badge = h('button', {
    className: `news-source-badge${active ? ' news-source-badge--active' : ''}`,
    style: `border-color:${color};color:${active ? '#fff' : color};background:${active ? color : 'transparent'}`,
    title: `Filter by ${source}`,
  }, source);
  badge.addEventListener('click', onClick);
  return badge;
}

function newsItemEl(item: NewsItem): HTMLElement {
  const color = SOURCE_COLORS[item.source] ?? '#555';

  const badge = h('span', {
    className: 'news-item-source',
    style: `color:${color};border-color:${color}`,
  }, item.source);

  const time = h('span', { className: 'news-item-time' }, relativeTime(item.publishedAt));

  const meta = h('div', { className: 'news-item-meta' }, badge, time);

  const link = h('a', {
    className: 'news-item-title',
    href: item.url,
    target: '_blank',
    rel: 'noopener noreferrer',
  }, item.title);

  const li = h('li', { className: 'news-item' }, meta, link);

  if (item.summary) {
    const summary = h('p', { className: 'news-item-summary' }, item.summary);
    li.appendChild(summary);
  }

  return li;
}

export class NewsFeedPanel extends Panel {
  private _allItems: NewsItem[] = [];
  private _activeFilters: Set<string> = new Set();
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ id: 'news-feed', title: 'Health News', showCount: true, defaultRowSpan: 3 });
    this._startAutoRefresh();
    void this._loadData();
  }

  private _startAutoRefresh(): void {
    this._refreshTimer = setInterval(() => {
      void this._loadData(true);
    }, REFRESH_INTERVAL_MS);
  }

  /** Stop the auto-refresh timer (call when panel is removed from DOM). */
  destroy(): void {
    if (this._refreshTimer !== null) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  /** Accept pre-fetched news items (used by app-init for sample data fallback). */
  updateData(items: NewsItem[]): void {
    this._allItems = items;
    this.setCount(items.length);
    this._render();
  }

  private async _loadData(forceRefresh = false): Promise<void> {
    if (!forceRefresh && this._allItems.length > 0) return;
    this.showLoading();
    try {
      this._allItems = await fetchHealthNews();
      this.setCount(this._allItems.length);
      this._render();
    } catch {
      this.showError('Failed to load news', () => void this._loadData(true));
    }
  }

  private _toggleFilter(source: string): void {
    if (this._activeFilters.has(source)) {
      this._activeFilters.delete(source);
    } else {
      this._activeFilters.add(source);
    }
    this._render();
  }

  private _render(): void {
    // Collect unique sources from loaded items
    const sources = Array.from(new Set(this._allItems.map((i) => i.source))).sort();

    // Filter bar
    const filterBar = h('div', { className: 'news-filter-bar' });
    for (const source of sources) {
      const isActive = this._activeFilters.size === 0 || this._activeFilters.has(source);
      filterBar.appendChild(sourceBadge(source, this._activeFilters.has(source), () => {
        this._toggleFilter(source);
      }));
      void isActive; // used in rendering list below
    }

    // Filtered item list
    const filtered = this._activeFilters.size === 0
      ? this._allItems
      : this._allItems.filter((i) => this._activeFilters.has(i.source));

    const list = h('ul', { className: 'news-list' });
    if (filtered.length === 0) {
      list.appendChild(h('li', { className: 'news-empty' }, 'No items to display.'));
    } else {
      for (const item of filtered) {
        list.appendChild(newsItemEl(item));
      }
    }

    const container = h('div', { className: 'news-feed-container' }, filterBar, list);
    this.setContentNode(container);
  }
}
