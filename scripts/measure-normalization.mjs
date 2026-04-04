/**
 * Measures disease name normalization coverage.
 * Reads DISEASE_ALIASES from source, feeds realistic inputs, counts matches.
 * Outputs single number: match percentage (0-100).
 */
import { readFileSync } from 'fs';

const src = readFileSync('src/services/llm-data-pipeline.ts', 'utf-8');

// Extract aliases from tuple array format: ['alias', 'normalized']
const aliases = [];
for (const m of src.matchAll(/\['([^']+)',\s*'[^']+'\]/g)) {
  aliases.push(m[1].toLowerCase());
}

if (!aliases.length) { console.log('0'); process.exit(0); }

function matches(name) {
  const lower = name.toLowerCase().trim();
  for (const alias of aliases) {
    if (lower.includes(alias)) return true;
  }
  return false;
}

const TEST_INPUTS = [
  'Dengue fever - Viet Nam', 'Dengue - Brazil', 'COVID-19 - Global update',
  'Coronavirus disease (COVID-19)', 'Avian Influenza A(H5N1) - United States',
  'Avian influenza A(H5N2) - Australia', 'Influenza A(H1N1) - Seasonal update',
  'Measles - Democratic Republic of the Congo', 'Cholera - Haiti',
  'Mpox (monkeypox) - Multi-country outbreak', 'Mpox - clade Ib',
  'Yellow fever - Nigeria', 'Plague - Madagascar', 'Marburg virus disease - Tanzania',
  'Ebola virus disease - DRC', 'Lassa fever - Nigeria', 'Meningococcal disease - Niger',
  'Diphtheria - Bangladesh', 'Pertussis - Worldwide increase',
  'Poliomyelitis - Global update', 'Rift Valley fever - Kenya',
  'Japanese encephalitis - India', 'Chikungunya - Americas',
  'Zika virus disease - Update', 'Nipah virus - India', 'MERS-CoV - Saudi Arabia',
  'Typhoid fever - Pakistan', 'Hepatitis A - outbreak', 'Hepatitis E - South Sudan',
  'Malaria - Mozambique', 'Rabies - Indonesia', 'Tuberculosis - Drug resistant',
  'Leprosy - Global', 'Hand, foot and mouth disease - Viet Nam', 'HFMD update - China',
  'Acute flaccid paralysis', 'Crimean-Congo haemorrhagic fever',
  'Leptospirosis - Philippines', 'Dengue haemorrhagic fever',
  'Severe acute respiratory syndrome',
  'Sốt xuất huyết bùng phát tại TPHCM', 'Dịch sốt xuất huyết Dengue',
  'Tay chân miệng ở trẻ em', 'Bệnh tay chân miệng tăng',
  'Cúm A H5N1 ở gia cầm', 'Cúm mùa tăng cao',
  'Sởi bùng phát ở trẻ chưa tiêm', 'Bệnh sởi tại Tuyên Quang',
  'COVID-19 biến thể mới', 'Dịch tả tại miền Trung', 'Bệnh dại ở Tây Nguyên',
  'Sốt rét biên giới', 'Bệnh bạch hầu tại Đắk Lắk', 'Ho gà ở trẻ sơ sinh',
  'Thương hàn tại Hà Nội', 'Viêm não Nhật Bản', 'Sốt Chikungunya', 'Sốt Zika',
  'Đậu mùa khỉ Mpox', 'Bệnh leptospirosis', 'Viêm gan A', 'Viêm gan E',
  'Bệnh lao kháng thuốc', 'Sốt vàng da', 'Dịch hạch',
  'Bệnh Ebola', 'Bệnh Marburg', 'Cúm gia cầm H5N1',
];

let matched = 0;
const missed = [];
for (const input of TEST_INPUTS) {
  if (matches(input)) { matched++; }
  else { missed.push(input); }
}

const pct = Math.round((matched / TEST_INPUTS.length) * 100);
if (process.argv.includes('--verbose') && missed.length) {
  console.error(`Missed (${missed.length}):`);
  missed.forEach(m => console.error(`  - ${m}`));
}
console.log(pct);
