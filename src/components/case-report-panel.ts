import '@/styles/case-report.css';
import { Panel } from '@/components/panel-base';
import { h, replaceChildren } from '@/utils/dom-utils';
import { emit } from '@/app/app-context';
import { submitReport, getReports, type CaseReport } from '@/services/case-report-service';
import { DISEASES, PROVINCES, relativeTime, diseaseLabel, buildSelect, todayIso } from '@/components/case-report-panel-data';

export class CaseReportPanel extends Panel {
  private _diseaseSelect!: HTMLSelectElement;
  private _provinceSelect!: HTMLSelectElement;
  private _districtInput!: HTMLInputElement;
  private _suspectRadio!: HTMLInputElement;
  private _confirmedRadio!: HTMLInputElement;
  private _severeRadio!: HTMLInputElement;
  private _casesInput!: HTMLInputElement;
  private _deathsInput!: HTMLInputElement;
  private _detectedInput!: HTMLInputElement;
  private _notesTextarea!: HTMLTextAreaElement;
  private _recentListEl!: HTMLUListElement;
  private _toastContainer!: HTMLDivElement;

  constructor() {
    super({ id: 'case-report', title: 'Báo cáo ca bệnh', defaultRowSpan: 4 });
    this.setContentNode(this._buildUI());
    this._renderRecentList();
  }

  private _buildUI(): HTMLElement {
    const wrapper = h('div', { className: 'case-report-wrapper' });

    this._toastContainer = document.createElement('div');
    wrapper.appendChild(this._toastContainer);

    const form = document.createElement('form');
    form.className = 'case-form';
    form.addEventListener('submit', (e) => { e.preventDefault(); this._handleSubmit(); });

    // Disease
    this._diseaseSelect = buildSelect('case-select', DISEASES, '-- Chọn bệnh --');
    form.appendChild(this._buildField('Loại bệnh', this._diseaseSelect));

    // Province
    this._provinceSelect = buildSelect(
      'case-select',
      PROVINCES.map((p) => ({ value: p, label: p })),
      '-- Chọn tỉnh/thành --',
    );
    form.appendChild(this._buildField('Tỉnh/TP', this._provinceSelect));

    // District
    this._districtInput = document.createElement('input');
    this._districtInput.type = 'text';
    this._districtInput.className = 'case-input';
    this._districtInput.placeholder = 'Quận / Huyện';
    form.appendChild(this._buildField('Quận/Huyện', this._districtInput));

    // Severity radios
    this._suspectRadio   = this._radio('severity', 'suspect');
    this._confirmedRadio = this._radio('severity', 'confirmed');
    this._severeRadio    = this._radio('severity', 'severe');
    this._suspectRadio.checked = true;
    const radioGroup = h('div', { className: 'case-radio-group' },
      this._radioLabel(this._suspectRadio,   'Nghi ngờ'),
      this._radioLabel(this._confirmedRadio, 'Xác nhận'),
      this._radioLabel(this._severeRadio,    'Nặng'),
    );
    form.appendChild(this._buildField('Mức độ', radioGroup));

    // Cases + Deaths (two columns)
    this._casesInput = this._numInput('1');
    this._casesInput.required = true;
    this._deathsInput = this._numInput('0');
    form.appendChild(h('div', { className: 'case-row' },
      this._buildField('Số ca', this._casesInput),
      this._buildField('Tử vong', this._deathsInput),
    ));

    // Detection date
    this._detectedInput = document.createElement('input');
    this._detectedInput.type = 'date';
    this._detectedInput.className = 'case-input';
    this._detectedInput.required = true;
    this._detectedInput.value = todayIso();
    form.appendChild(this._buildField('Ngày phát hiện', this._detectedInput));

    // Notes
    this._notesTextarea = document.createElement('textarea');
    this._notesTextarea.className = 'case-textarea';
    this._notesTextarea.placeholder = 'Ghi chú thêm...';
    this._notesTextarea.rows = 2;
    form.appendChild(this._buildField('Ghi chú', this._notesTextarea));

    form.appendChild(h('button', { className: 'case-submit-btn', type: 'submit' }, 'Gửi báo cáo'));
    wrapper.appendChild(form);

    // Recent reports
    const recentSection = h('div', { className: 'case-recent-section' });
    recentSection.appendChild(h('div', { className: 'case-recent-title' }, 'Báo cáo gần đây'));
    this._recentListEl = document.createElement('ul');
    this._recentListEl.className = 'case-recent-list';
    recentSection.appendChild(this._recentListEl);
    wrapper.appendChild(recentSection);

    return wrapper;
  }

  private _buildField(label: string, control: HTMLElement): HTMLElement {
    return h('div', { className: 'case-field' },
      h('span', { className: 'case-label' }, label),
      control,
    );
  }

  private _radio(name: string, value: string): HTMLInputElement {
    const r = document.createElement('input');
    r.type = 'radio';
    r.name = name;
    r.value = value;
    return r;
  }

  private _radioLabel(radio: HTMLInputElement, text: string): HTMLElement {
    const lbl = document.createElement('label');
    lbl.className = 'case-radio-label';
    lbl.appendChild(radio);
    lbl.appendChild(document.createTextNode(text));
    return lbl;
  }

  private _numInput(defaultVal: string): HTMLInputElement {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'case-input';
    inp.min = '0';
    inp.value = defaultVal;
    return inp;
  }

  private _handleSubmit(): void {
    const disease  = this._diseaseSelect.value;
    const province = this._provinceSelect.value;
    const cases    = parseInt(this._casesInput.value, 10);
    const detected = this._detectedInput.value;

    if (!disease)                   { this._toast('Vui lòng chọn loại bệnh.', true); return; }
    if (!province)                  { this._toast('Vui lòng chọn tỉnh/thành phố.', true); return; }
    if (isNaN(cases) || cases < 0) { this._toast('Số ca không hợp lệ.', true); return; }
    if (!detected)                  { this._toast('Vui lòng chọn ngày phát hiện.', true); return; }

    const severity: CaseReport['severity'] =
      this._severeRadio.checked    ? 'severe'    :
      this._confirmedRadio.checked ? 'confirmed' : 'suspect';

    const report = submitReport({
      disease,
      province,
      district:   this._districtInput.value.trim(),
      severity,
      cases,
      deaths:     Math.max(0, parseInt(this._deathsInput.value, 10) || 0),
      detectedAt: detected,
      notes:      this._notesTextarea.value.trim(),
    });

    emit('case-reported', report);
    this._toast(`Đã gửi: ${diseaseLabel(disease)} — ${province}`);
    this._resetForm();
    this._renderRecentList();
  }

  private _renderRecentList(): void {
    const reports = getReports().slice(0, 5);
    replaceChildren(this._recentListEl,
      ...reports.map((r) => {
        const li = document.createElement('li');
        li.className = 'case-recent-item';
        li.appendChild(document.createTextNode(
          `• ${diseaseLabel(r.disease)} — ${r.province} — ${r.cases} ca `,
        ));
        const meta = document.createElement('span');
        meta.className = 'case-recent-meta';
        meta.textContent = relativeTime(r.reportedAt);
        li.appendChild(meta);
        return li;
      }),
    );
  }

  private _toast(msg: string, isError = false): void {
    const el = document.createElement('div');
    el.className = isError ? 'case-error-toast' : 'case-success-toast';
    el.textContent = msg;
    this._toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  private _resetForm(): void {
    this._diseaseSelect.value  = '';
    this._provinceSelect.value = '';
    this._districtInput.value  = '';
    this._suspectRadio.checked = true;
    this._casesInput.value     = '1';
    this._deathsInput.value    = '0';
    this._detectedInput.value  = todayIso();
    this._notesTextarea.value  = '';
  }
}
