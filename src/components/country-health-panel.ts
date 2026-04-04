/**
 * Country Health Profile Panel
 * Shows risk level, active outbreaks, and disease list for a selected country.
 * Listens to the 'country-selected' event from the event bus.
 */

import { Panel } from '@/components/panel-base';
import { on } from '@/app/app-context';
import { escapeHtml } from '@/utils/sanitize';
import { h } from '@/utils/dom-utils';
import type { CountryHealthProfile, AlertLevel } from '@/types';

const RISK_COLORS: Record<AlertLevel, string> = {
  alert: '#e74c3c',
  warning: '#e67e22',
  watch: '#f1c40f',
};

const RISK_LABELS: Record<AlertLevel, string> = {
  alert: 'HIGH RISK',
  warning: 'MODERATE RISK',
  watch: 'LOW RISK',
};

export class CountryHealthPanel extends Panel {
  private _profile: CountryHealthProfile | null = null;

  constructor() {
    super({ id: 'country-health', title: 'Country Health Profile', defaultRowSpan: 2 });

    // Subscribe to event bus
    on('country-selected', (data) => {
      const profile = data as CountryHealthProfile;
      this.setCountry(profile);
    });

    this._renderDefault();
  }

  /** Display profile for the given country. */
  setCountry(profile: CountryHealthProfile): void {
    this._profile = profile;
    this._render();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _renderDefault(): void {
    const msg = h('p', { className: 'country-health-placeholder' },
      'Select a country on the map or click an outbreak to view its health profile.',
    );
    this.setContentNode(h('div', { className: 'country-health-root' }, msg));
  }

  private _render(): void {
    if (!this._profile) { this._renderDefault(); return; }

    const p = this._profile;
    const root = h('div', { className: 'country-health-root' });

    // Country name + risk badge
    const badge = h('span', {
      className: 'risk-badge',
      style: `background:${RISK_COLORS[p.riskLevel]}`,
    }, RISK_LABELS[p.riskLevel]);

    const nameRow = h('div', { className: 'country-health-name-row' },
      h('h3', { className: 'country-health-name' }, escapeHtml(p.countryName)),
      badge,
    );
    root.appendChild(nameRow);

    // Active outbreaks counter
    const outbreakCount = h('div', { className: 'country-health-stat' },
      h('span', { className: 'country-health-stat-value' }, String(p.activeOutbreaks)),
      h('span', { className: 'country-health-stat-label' }, 'Active Outbreaks'),
    );
    root.appendChild(outbreakCount);

    // Disease tags
    if (p.diseases.length > 0) {
      const tagList = h('div', { className: 'country-health-diseases' });
      for (const disease of p.diseases) {
        tagList.appendChild(
          h('span', { className: 'disease-tag' }, escapeHtml(disease)),
        );
      }
      root.appendChild(h('div', { className: 'country-health-diseases-section' },
        h('p', { className: 'country-health-section-label' }, 'Active Diseases'),
        tagList,
      ));
    }

    // Last updated
    const updated = h('p', { className: 'country-health-updated' },
      `Updated: ${new Date(p.lastUpdated).toLocaleString()}`,
    );
    root.appendChild(updated);

    this.setContentNode(root);
  }
}
