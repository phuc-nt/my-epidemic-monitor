import { h, replaceChildren, safeHtml } from '@/utils/dom-utils';
import { getPanelSpan, savePanelSpan, isPanelCollapsed, savePanelCollapsed } from '@/components/panel-persistence';

const ROW_RESIZE_STEP_PX = 80;
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 6;

export interface PanelOptions {
  id: string;
  title: string;
  showCount?: boolean;
  className?: string;
  defaultRowSpan?: number;
}

/**
 * Base panel component.
 * Provides header, content area, collapse toggle, and row-span resize.
 * Stripped of all premium/billing, analytics, Tauri/desktop, and AI-flow logic.
 */
export class Panel {
  readonly id: string;
  readonly el: HTMLElement;

  protected readonly header: HTMLElement;
  protected readonly titleEl: HTMLElement;
  protected readonly countEl: HTMLElement;
  protected readonly content: HTMLElement;

  private _rowSpan: number;
  private _collapsed: boolean;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: PanelOptions) {
    this.id = opts.id;
    this._rowSpan = getPanelSpan(opts.id, opts.defaultRowSpan ?? 1);
    this._collapsed = isPanelCollapsed(opts.id);

    // Title element
    this.titleEl = h('span', { className: 'panel-title' }, opts.title);

    // Optional count badge
    this.countEl = h('span', {
      className: 'panel-count',
      style: opts.showCount ? '' : 'display:none',
    });

    // Collapse toggle button
    const collapseBtn = h('button', {
      className: 'panel-collapse-btn',
      title: 'Toggle collapse',
      'aria-label': 'Toggle collapse',
    }, this._collapsed ? '▶' : '▼');

    // Row-span resize buttons
    const shrinkBtn = h('button', {
      className: 'panel-resize-btn',
      title: 'Shrink panel',
      'aria-label': 'Shrink panel height',
    }, '−');
    const growBtn = h('button', {
      className: 'panel-resize-btn',
      title: 'Grow panel',
      'aria-label': 'Grow panel height',
    }, '+');

    // Header assembles title + controls
    this.header = h('div', { className: 'panel-header' },
      h('div', { className: 'panel-header-left' }, this.titleEl, this.countEl),
      h('div', { className: 'panel-header-right' }, shrinkBtn, growBtn, collapseBtn),
    );

    // Content area
    this.content = h('div', { className: 'panel-content' });

    // Root element
    this.el = h('div', {
      className: ['panel', opts.className].filter(Boolean).join(' '),
      dataset: { panelId: opts.id },
    }, this.header, this.content);

    // Apply initial state
    this._applyRowSpan();
    if (this._collapsed) this._applyCollapsed();

    // Bind events
    collapseBtn.addEventListener('click', () => {
      this._collapsed = !this._collapsed;
      collapseBtn.textContent = this._collapsed ? '▶' : '▼';
      this._applyCollapsed();
      savePanelCollapsed(this.id, this._collapsed);
    });

    shrinkBtn.addEventListener('click', () => this._adjustRowSpan(-1));
    growBtn.addEventListener('click', () => this._adjustRowSpan(1));
  }

  /** Replace panel content with sanitized HTML string (debounced 16ms). */
  setContent(html: string): void {
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      replaceChildren(this.content, safeHtml(html));
      this._debounceTimer = null;
    }, 16);
  }

  /** Replace panel content with a DOM node directly. */
  setContentNode(node: Node): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    replaceChildren(this.content, node);
  }

  /** Update the count badge text and make it visible. */
  setCount(n: number): void {
    this.countEl.textContent = String(n);
    this.countEl.style.display = '';
  }

  /** Show a centered loading spinner. */
  showLoading(): void {
    this.setContentNode(h('div', { className: 'panel-loading' },
      h('span', { className: 'panel-spinner' }),
    ));
  }

  /** Show an error message with optional retry callback. */
  showError(msg: string, retry?: () => void): void {
    const container = h('div', { className: 'panel-error' },
      h('p', { className: 'panel-error-msg' }, msg),
    );
    if (retry) {
      const btn = h('button', { className: 'panel-retry-btn' }, 'Retry');
      btn.addEventListener('click', retry);
      container.appendChild(btn);
    }
    this.setContentNode(container);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _adjustRowSpan(delta: number): void {
    const next = Math.min(MAX_ROW_SPAN, Math.max(MIN_ROW_SPAN, this._rowSpan + delta));
    if (next === this._rowSpan) return;
    this._rowSpan = next;
    this._applyRowSpan();
    savePanelSpan(this.id, this._rowSpan);
  }

  private _applyRowSpan(): void {
    // Each row unit = ROW_RESIZE_STEP_PX px
    this.el.style.gridRowEnd = `span ${this._rowSpan}`;
    this.el.style.minHeight = `${this._rowSpan * ROW_RESIZE_STEP_PX}px`;
  }

  private _applyCollapsed(): void {
    if (this._collapsed) {
      this.content.style.display = 'none';
      this.el.classList.add('panel--collapsed');
    } else {
      this.content.style.display = '';
      this.el.classList.remove('panel--collapsed');
    }
  }
}
