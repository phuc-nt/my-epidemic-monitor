/**
 * Vietnam province population data (2023 General Statistics Office figures,
 * rounded to nearest thousand). Used to normalize outbreak counts per-capita
 * so dense-media provinces like TP.HCM and Hà Nội don't dominate the map
 * purely because they have more newspapers reporting.
 *
 * Per Anh Dũng Phan's feedback (2026-04-08):
 *   "Đông dân thì nơi đó càng nhiều nguy cơ bệnh tật → lại đi chứng minh
 *    1 sự thật hiển nhiên"
 *
 * Source: Tổng cục Thống kê 2023 (approx, rounded).
 */

// Population in thousands (1000s).
const VN_PROVINCE_POPULATION_K: Record<string, number> = {
  // Biggest 6
  'TP.HCM': 9389, 'Hồ Chí Minh': 9389, 'Ho Chi Minh': 9389, 'HCMC': 9389, 'Saigon': 9389,
  'Hà Nội': 8435, 'Ha Noi': 8435, 'Hanoi': 8435,
  'Thanh Hóa': 3721, 'Thanh Hoa': 3721,
  'Nghệ An': 3419, 'Nghe An': 3419,
  'Đồng Nai': 3308, 'Dong Nai': 3308,
  'Bình Dương': 2779, 'Binh Duong': 2779,
  // Large
  'Hải Phòng': 2086, 'Hai Phong': 2086,
  'An Giang': 1891,
  'Đắk Lắk': 1919, 'Dak Lak': 1919,
  'Gia Lai': 1590,
  'Bắc Giang': 1865, 'Bac Giang': 1865,
  'Kiên Giang': 1747, 'Kien Giang': 1747,
  'Long An': 1721,
  'Thái Bình': 1870, 'Thai Binh': 1870,
  'Nam Định': 1876, 'Nam Dinh': 1876,
  'Hải Dương': 1936, 'Hai Duong': 1936,
  'Quảng Nam': 1509, 'Quang Nam': 1509,
  'Đà Nẵng': 1236, 'Da Nang': 1236,
  'Lâm Đồng': 1322, 'Lam Dong': 1322,
  'Thái Nguyên': 1335, 'Thai Nguyen': 1335,
  'Quảng Ninh': 1391, 'Quang Ninh': 1391,
  // Medium
  'Bình Thuận': 1249, 'Binh Thuan': 1249,
  'Tiền Giang': 1775, 'Tien Giang': 1775,
  'Bến Tre': 1297, 'Ben Tre': 1297,
  'Bình Định': 1494, 'Binh Dinh': 1494,
  'Đồng Tháp': 1602, 'Dong Thap': 1602,
  'Hà Tĩnh': 1319, 'Ha Tinh': 1319,
  'Quảng Bình': 917, 'Quang Binh': 917,
  'Quảng Ngãi': 1264, 'Quang Ngai': 1264,
  'Khánh Hòa': 1250, 'Khanh Hoa': 1250,
  'Sóc Trăng': 1200, 'Soc Trang': 1200,
  'Cà Mau': 1194, 'Ca Mau': 1194,
  'Bắc Ninh': 1488, 'Bac Ninh': 1488,
  'Phú Thọ': 1494, 'Phu Tho': 1494,
  'Hưng Yên': 1280, 'Hung Yen': 1280,
  'Thừa Thiên Huế': 1164, 'Huế': 1164, 'Thua Thien Hue': 1164, 'Hue': 1164,
  'Tây Ninh': 1180, 'Tay Ninh': 1180,
  'Cần Thơ': 1244, 'Can Tho': 1244,
  'Vĩnh Phúc': 1194, 'Vinh Phuc': 1194,
  'Vĩnh Long': 1022, 'Vinh Long': 1022,
  'Hoà Bình': 875, 'Hòa Bình': 875, 'Hoa Binh': 875,
  'Trà Vinh': 1009, 'Tra Vinh': 1009,
  'Lạng Sơn': 802, 'Lang Son': 802,
  'Lào Cai': 779, 'Lao Cai': 779,
  'Yên Bái': 843, 'Yen Bai': 843,
  // Smaller
  'Phú Yên': 873, 'Phu Yen': 873,
  'Ninh Bình': 1024, 'Ninh Binh': 1024,
  'Sơn La': 1290, 'Son La': 1290,
  'Bà Rịa - Vũng Tàu': 1178, 'Bà Rịa Vũng Tàu': 1178, 'Ba Ria Vung Tau': 1178, 'Vũng Tàu': 1178, 'Vung Tau': 1178,
  'Tuyên Quang': 807, 'Tuyen Quang': 807,
  'Hà Giang': 908, 'Ha Giang': 908,
  'Ninh Thuận': 606, 'Ninh Thuan': 606,
  'Đắk Nông': 692, 'Dak Nong': 692,
  'Cao Bằng': 543, 'Cao Bang': 543,
  'Hậu Giang': 732, 'Hau Giang': 732,
  'Điện Biên': 636, 'Dien Bien': 636,
  'Bình Phước': 1030, 'Binh Phuoc': 1030,
  'Bạc Liêu': 908, 'Bac Lieu': 908,
  'Quảng Trị': 639, 'Quang Tri': 639,
  'Kon Tum': 578,
  'Lai Châu': 487, 'Lai Chau': 487,
  'Bắc Kạn': 323, 'Bac Kan': 323,
};

/** Vietnam total population (2023, thousands), used as fallback baseline. */
const VN_TOTAL_POPULATION_K = 100300;

/**
 * Look up population for a province name. Falls back to total VN population
 * so unknown / aggregate labels like "Toàn quốc" get the national baseline.
 * Returns value in thousands (1000s of people).
 */
export function populationK(province: string): number {
  if (!province) return VN_TOTAL_POPULATION_K;
  if (VN_PROVINCE_POPULATION_K[province]) return VN_PROVINCE_POPULATION_K[province];
  const lower = province.toLowerCase().trim();
  for (const [name, pop] of Object.entries(VN_PROVINCE_POPULATION_K)) {
    if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
      return pop;
    }
  }
  return VN_TOTAL_POPULATION_K;
}

/**
 * Normalize an absolute count to cases-per-million-inhabitants. Useful for
 * comparing outbreak intensity across provinces with wildly different
 * populations.
 */
export function casesPerMillion(cases: number, province: string): number {
  const popK = populationK(province);
  if (popK <= 0) return 0;
  return (cases * 1000) / popK;
}
