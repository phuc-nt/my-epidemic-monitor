/**
 * Static lookup data and pure helper functions for the Case Report panel.
 * Kept separate to stay under the 200-line file limit.
 */

// ── Disease list ──────────────────────────────────────────────────────────────

export const DISEASES: { value: string; label: string }[] = [
  { value: 'dengue',          label: 'Sốt xuất huyết (Dengue)' },
  { value: 'hfmd',            label: 'Tay chân miệng (HFMD)' },
  { value: 'hand-foot-mouth', label: 'Tay chân miệng (HFMD)' },
  { value: 'covid19',         label: 'COVID-19' },
  { value: 'covid-19',        label: 'COVID-19' },
  { value: 'influenza_a',     label: 'Cúm A (Influenza A)' },
  { value: 'influenza',       label: 'Cúm (Influenza)' },
  { value: 'measles',         label: 'Sởi' },
  { value: 'chickenpox',      label: 'Thủy đậu' },
  { value: 'mumps',           label: 'Quai bị' },
  { value: 'rabies',          label: 'Dại (Rabies)' },
  { value: 'meningitis',      label: 'Viêm màng não' },
  { value: 'other',           label: 'Khác...' },
];

// ── Province list (63 provinces, full list) ───────────────────────────────────

export const PROVINCES: string[] = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cần Thơ', 'Cao Bằng', 'Đà Nẵng',
  'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
  'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh',
  'Hải Dương', 'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên',
  'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng',
  'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An',
  'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình',
  'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng',
  'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa',
  'Thừa Thiên Huế', 'Tiền Giang', 'TP. Hồ Chí Minh', 'Trà Vinh',
  'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Return a relative-time string in Vietnamese for a unix-ms timestamp. */
export function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)    return `${diff}s trước`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

/** Resolve a disease value to its human-readable Vietnamese label. */
export function diseaseLabel(value: string): string {
  return DISEASES.find((d) => d.value === value)?.label ?? value;
}

/** Build a <select> element from an option list with a placeholder first option. */
export function buildSelect(
  className: string,
  options: { value: string; label: string }[],
  placeholder: string,
): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = className;
  sel.required = true;

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = placeholder;
  placeholderOpt.disabled = true;
  placeholderOpt.selected = true;
  sel.appendChild(placeholderOpt);

  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  }
  return sel;
}

/** Today's date as YYYY-MM-DD string. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
