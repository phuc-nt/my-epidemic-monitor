/**
 * Disease slug → Vietnamese label lookup for Cloudflare Pages Functions.
 * Mirrors DISEASES list in src/components/case-report-panel-data.ts.
 */
const LABELS: Record<string, string> = {
  'dengue':              'Sốt xuất huyết (Dengue)',
  'hand-foot-mouth':     'Tay chân miệng (HFMD)',
  'covid-19':            'COVID-19',
  'influenza':           'Cúm (Influenza)',
  'avian-influenza':     'Cúm gia cầm',
  'measles':             'Sởi (Measles)',
  'chickenpox':          'Thủy đậu',
  'mumps':               'Quai bị',
  'rabies':              'Dại (Rabies)',
  'meningitis':          'Viêm màng não',
  'diphtheria':          'Bạch hầu (Diphtheria)',
  'pertussis':           'Ho gà (Pertussis)',
  'typhoid':             'Thương hàn (Typhoid)',
  'malaria':             'Sốt rét (Malaria)',
  'cholera':             'Tả (Cholera)',
  'ebola':               'Ebola',
  'mpox':                'Mpox (Đậu mùa khỉ)',
  'hepatitis':           'Viêm gan',
  'tuberculosis':        'Lao (Tuberculosis)',
  'plague':              'Dịch hạch',
};

export function diseaseLabel(slug: string): string {
  return LABELS[slug.toLowerCase()] ?? slug;
}
