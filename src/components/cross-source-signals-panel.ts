/**
 * Cross-Source Signals Panel.
 * Displays detected cross-source outbreak signals grouped by confidence level.
 * Emits 'outbreak-selected' when a signal row is clicked.
 */
import { Panel } from '@/components/panel-base';
import { h } from '@/utils/dom-utils';
import { emit } from '@/app/app-context';
import type { CrossSourceSignal } from '@/services/cross-source-signal-service';
import type { DiseaseOutbreakItem } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the colored dot indicator for a confidence level. */
function confidenceDot(level: CrossSourceSignal['confidence']): string {
  switch (level) {
    case 'high':   return '🔴';
    case 'medium': return '🟡';
    case 'low':    return '⚪';
  }
}

/** Returns the confidence label in uppercase. */
function confidenceLabel(level: CrossSourceSignal['confidence']): string {
  return level.toUpperCase();
}

/** Format a timestamp to a relative human-readable string (e.g. "2h ago"). */
function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ---------------------------------------------------------------------------
// Panel class
// ---------------------------------------------------------------------------

export class CrossSourceSignalsPanel extends Panel {
  private _signals: CrossSourceSignal[] = [];
  private _outbreaks: DiseaseOutbreakItem[] = [];

  constructor() {
    super({
      id: 'cross-source-signals',
      title: 'CROSS-SOURCE SIGNALS',
      showCount: true,
      defaultRowSpan: 2,
    });

    this._renderEmpty();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Update the panel with new signal data.
   * @param signals  - Detected cross-source signals
   * @param outbreaks - Full outbreak list (used for click → outbreak-selected)
   */
  updateData(signals: CrossSourceSignal[], outbreaks: DiseaseOutbreakItem[]): void {
    this._signals = signals;
    this._outbreaks = outbreaks;
    this.setCount(signals.length);
    if (signals.length === 0) {
      this._renderEmpty();
    } else {
      this.setContentNode(this._buildContent());
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private _renderEmpty(): void {
    this.setContentNode(
      h('div', { className: 'signal-placeholder' }, 'No cross-source signals detected.'),
    );
  }

  private _buildContent(): HTMLElement {
    const list = h('div', { className: 'signal-list' });

    for (const signal of this._signals) {
      const row = this._buildSignalRow(signal);
      list.appendChild(row);
    }

    return list;
  }

  private _buildSignalRow(signal: CrossSourceSignal): HTMLElement {
    const dot   = confidenceDot(signal.confidence);
    const label = confidenceLabel(signal.confidence);

    // Display disease without Vietnamese parenthetical for brevity
    const shortDisease = signal.disease.split('(')[0]?.trim() ?? signal.disease;

    const header = h('div', { className: 'signal-row-header' },
      h('span', { className: `signal-dot signal-dot--${signal.confidence}` }, dot),
      h('span', { className: 'signal-confidence' }, ` ${label} — `),
      h('span', { className: 'signal-name' }, `${shortDisease} in ${signal.location}`),
    );

    const sourceLine = h('div', { className: 'signal-sources' },
      `Sources: ${signal.sources.join(', ')} (${signal.sourceCount})`,
    );

    const timeLine = h('div', { className: 'signal-time' },
      `Latest: ${relativeTime(signal.latestMention)}`,
    );

    const row = h('div', { className: `signal-row signal-row--${signal.confidence}` },
      header,
      sourceLine,
      timeLine,
    );

    // Click → find first matching outbreak and emit event
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => this._onSignalClick(signal));

    return row;
  }

  private _onSignalClick(signal: CrossSourceSignal): void {
    const match = this._outbreaks.find(ob => {
      const loc = ob.province ?? ob.country;
      return ob.disease === signal.disease && loc === signal.location;
    });
    if (match) {
      emit('outbreak-selected', match);
    }
  }
}
