/**
 * Vietnam ward/district database for HN, ĐN, TPHCM + southern provinces.
 * Used by LLM entity extraction to geo-locate outbreak mentions to ward level.
 * Coordinates are approximate centroids.
 */

export interface WardEntry {
  ward: string;        // Tên phường/xã
  district: string;    // Tên quận/huyện
  province: string;    // Tên tỉnh/thành phố
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// TP. Hồ Chí Minh — 22 quận/huyện, key wards
// ---------------------------------------------------------------------------
const TPHCM: WardEntry[] = [
  // Quận 1
  { ward: 'Bến Nghé', district: 'Quận 1', province: 'TP. Hồ Chí Minh', lat: 10.776, lng: 106.703 },
  { ward: 'Bến Thành', district: 'Quận 1', province: 'TP. Hồ Chí Minh', lat: 10.772, lng: 106.698 },
  { ward: 'Đa Kao', district: 'Quận 1', province: 'TP. Hồ Chí Minh', lat: 10.788, lng: 106.699 },
  // Quận 3
  { ward: 'Phường 1', district: 'Quận 3', province: 'TP. Hồ Chí Minh', lat: 10.784, lng: 106.685 },
  { ward: 'Phường 9', district: 'Quận 3', province: 'TP. Hồ Chí Minh', lat: 10.778, lng: 106.677 },
  // Quận 7
  { ward: 'Tân Phong', district: 'Quận 7', province: 'TP. Hồ Chí Minh', lat: 10.733, lng: 106.720 },
  { ward: 'Phú Mỹ', district: 'Quận 7', province: 'TP. Hồ Chí Minh', lat: 10.726, lng: 106.735 },
  // Quận 12
  { ward: 'Tân Chánh Hiệp', district: 'Quận 12', province: 'TP. Hồ Chí Minh', lat: 10.867, lng: 106.654 },
  { ward: 'An Phú Đông', district: 'Quận 12', province: 'TP. Hồ Chí Minh', lat: 10.860, lng: 106.668 },
  { ward: 'Hiệp Thành', district: 'Quận 12', province: 'TP. Hồ Chí Minh', lat: 10.878, lng: 106.636 },
  // Bình Tân
  { ward: 'Bình Hưng Hòa', district: 'Bình Tân', province: 'TP. Hồ Chí Minh', lat: 10.784, lng: 106.597 },
  { ward: 'Bình Hưng Hòa A', district: 'Bình Tân', province: 'TP. Hồ Chí Minh', lat: 10.778, lng: 106.590 },
  { ward: 'Bình Trị Đông', district: 'Bình Tân', province: 'TP. Hồ Chí Minh', lat: 10.763, lng: 106.606 },
  { ward: 'An Lạc', district: 'Bình Tân', province: 'TP. Hồ Chí Minh', lat: 10.742, lng: 106.616 },
  // Gò Vấp
  { ward: 'Phường 12', district: 'Gò Vấp', province: 'TP. Hồ Chí Minh', lat: 10.843, lng: 106.670 },
  { ward: 'Phường 15', district: 'Gò Vấp', province: 'TP. Hồ Chí Minh', lat: 10.831, lng: 106.662 },
  { ward: 'Phường 3', district: 'Gò Vấp', province: 'TP. Hồ Chí Minh', lat: 10.840, lng: 106.655 },
  // TP Thủ Đức
  { ward: 'Linh Trung', district: 'TP. Thủ Đức', province: 'TP. Hồ Chí Minh', lat: 10.857, lng: 106.770 },
  { ward: 'Bình Chiểu', district: 'TP. Thủ Đức', province: 'TP. Hồ Chí Minh', lat: 10.873, lng: 106.733 },
  { ward: 'Hiệp Bình Chánh', district: 'TP. Thủ Đức', province: 'TP. Hồ Chí Minh', lat: 10.839, lng: 106.723 },
  { ward: 'Tam Bình', district: 'TP. Thủ Đức', province: 'TP. Hồ Chí Minh', lat: 10.850, lng: 106.754 },
  // Bình Chánh
  { ward: 'Vĩnh Lộc A', district: 'Bình Chánh', province: 'TP. Hồ Chí Minh', lat: 10.750, lng: 106.580 },
  { ward: 'Tân Kiên', district: 'Bình Chánh', province: 'TP. Hồ Chí Minh', lat: 10.724, lng: 106.590 },
  // Tân Phú
  { ward: 'Tân Quý', district: 'Tân Phú', province: 'TP. Hồ Chí Minh', lat: 10.793, lng: 106.624 },
  { ward: 'Sơn Kỳ', district: 'Tân Phú', province: 'TP. Hồ Chí Minh', lat: 10.802, lng: 106.631 },
  // Quận 8
  { ward: 'Phường 2', district: 'Quận 8', province: 'TP. Hồ Chí Minh', lat: 10.738, lng: 106.666 },
  { ward: 'Phường 5', district: 'Quận 8', province: 'TP. Hồ Chí Minh', lat: 10.744, lng: 106.650 },
  // Bình Thạnh
  { ward: 'Phường 25', district: 'Bình Thạnh', province: 'TP. Hồ Chí Minh', lat: 10.808, lng: 106.711 },
  { ward: 'Phường 26', district: 'Bình Thạnh', province: 'TP. Hồ Chí Minh', lat: 10.815, lng: 106.716 },
  // Hóc Môn
  { ward: 'Bà Điểm', district: 'Hóc Môn', province: 'TP. Hồ Chí Minh', lat: 10.835, lng: 106.604 },
  { ward: 'Tân Thới Nhì', district: 'Hóc Môn', province: 'TP. Hồ Chí Minh', lat: 10.877, lng: 106.585 },
  // Củ Chi
  { ward: 'Tân An Hội', district: 'Củ Chi', province: 'TP. Hồ Chí Minh', lat: 10.970, lng: 106.505 },
  // Nhà Bè
  { ward: 'Phước Kiển', district: 'Nhà Bè', province: 'TP. Hồ Chí Minh', lat: 10.695, lng: 106.727 },
];

// ---------------------------------------------------------------------------
// Hà Nội — key districts
// ---------------------------------------------------------------------------
const HANOI: WardEntry[] = [
  // Hoàng Mai (hotspot SXH)
  { ward: 'Hoàng Liệt', district: 'Hoàng Mai', province: 'Hà Nội', lat: 20.965, lng: 105.850 },
  { ward: 'Đại Kim', district: 'Hoàng Mai', province: 'Hà Nội', lat: 20.975, lng: 105.840 },
  { ward: 'Định Công', district: 'Hoàng Mai', province: 'Hà Nội', lat: 20.985, lng: 105.840 },
  { ward: 'Thịnh Liệt', district: 'Hoàng Mai', province: 'Hà Nội', lat: 20.970, lng: 105.855 },
  // Thanh Xuân
  { ward: 'Khương Đình', district: 'Thanh Xuân', province: 'Hà Nội', lat: 20.994, lng: 105.815 },
  { ward: 'Hạ Đình', district: 'Thanh Xuân', province: 'Hà Nội', lat: 20.988, lng: 105.808 },
  { ward: 'Thanh Xuân Trung', district: 'Thanh Xuân', province: 'Hà Nội', lat: 20.999, lng: 105.820 },
  // Đống Đa
  { ward: 'Láng Hạ', district: 'Đống Đa', province: 'Hà Nội', lat: 21.010, lng: 105.815 },
  { ward: 'Kim Liên', district: 'Đống Đa', province: 'Hà Nội', lat: 21.005, lng: 105.835 },
  { ward: 'Trung Tự', district: 'Đống Đa', province: 'Hà Nội', lat: 21.002, lng: 105.838 },
  // Cầu Giấy
  { ward: 'Dịch Vọng', district: 'Cầu Giấy', province: 'Hà Nội', lat: 21.030, lng: 105.790 },
  { ward: 'Mai Dịch', district: 'Cầu Giấy', province: 'Hà Nội', lat: 21.040, lng: 105.783 },
  // Hai Bà Trưng
  { ward: 'Bạch Đằng', district: 'Hai Bà Trưng', province: 'Hà Nội', lat: 21.023, lng: 105.860 },
  { ward: 'Minh Khai', district: 'Hai Bà Trưng', province: 'Hà Nội', lat: 21.005, lng: 105.870 },
  // Nam Từ Liêm
  { ward: 'Mỹ Đình 1', district: 'Nam Từ Liêm', province: 'Hà Nội', lat: 21.027, lng: 105.770 },
  { ward: 'Mỹ Đình 2', district: 'Nam Từ Liêm', province: 'Hà Nội', lat: 21.033, lng: 105.765 },
  // Bắc Từ Liêm
  { ward: 'Phúc Diễn', district: 'Bắc Từ Liêm', province: 'Hà Nội', lat: 21.050, lng: 105.754 },
  // Hà Đông
  { ward: 'Mộ Lao', district: 'Hà Đông', province: 'Hà Nội', lat: 20.980, lng: 105.778 },
  { ward: 'Văn Quán', district: 'Hà Đông', province: 'Hà Nội', lat: 20.972, lng: 105.783 },
  // Long Biên
  { ward: 'Phúc Đồng', district: 'Long Biên', province: 'Hà Nội', lat: 21.045, lng: 105.893 },
  // Hoàn Kiếm
  { ward: 'Hàng Bồ', district: 'Hoàn Kiếm', province: 'Hà Nội', lat: 21.035, lng: 105.850 },
];

// ---------------------------------------------------------------------------
// Đà Nẵng
// ---------------------------------------------------------------------------
const DANANG: WardEntry[] = [
  { ward: 'Thạch Thang', district: 'Hải Châu', province: 'Đà Nẵng', lat: 16.068, lng: 108.218 },
  { ward: 'Thanh Bình', district: 'Hải Châu', province: 'Đà Nẵng', lat: 16.072, lng: 108.210 },
  { ward: 'Hòa Thuận Tây', district: 'Hải Châu', province: 'Đà Nẵng', lat: 16.056, lng: 108.208 },
  { ward: 'An Hải Bắc', district: 'Sơn Trà', province: 'Đà Nẵng', lat: 16.080, lng: 108.230 },
  { ward: 'Phước Mỹ', district: 'Sơn Trà', province: 'Đà Nẵng', lat: 16.063, lng: 108.245 },
  { ward: 'Hòa Khánh Bắc', district: 'Liên Chiểu', province: 'Đà Nẵng', lat: 16.082, lng: 108.150 },
  { ward: 'Hòa Khánh Nam', district: 'Liên Chiểu', province: 'Đà Nẵng', lat: 16.070, lng: 108.155 },
  { ward: 'Thanh Khê Đông', district: 'Thanh Khê', province: 'Đà Nẵng', lat: 16.068, lng: 108.192 },
  { ward: 'Khuê Trung', district: 'Cẩm Lệ', province: 'Đà Nẵng', lat: 16.038, lng: 108.210 },
  { ward: 'Hòa Phát', district: 'Cẩm Lệ', province: 'Đà Nẵng', lat: 16.025, lng: 108.207 },
  { ward: 'Hòa Xuân', district: 'Cẩm Lệ', province: 'Đà Nẵng', lat: 16.015, lng: 108.223 },
  { ward: 'Hòa Quý', district: 'Ngũ Hành Sơn', province: 'Đà Nẵng', lat: 16.010, lng: 108.245 },
];

// ---------------------------------------------------------------------------
// Southern provinces — key districts
// ---------------------------------------------------------------------------
const SOUTHERN: WardEntry[] = [
  // Bình Dương
  { ward: 'Phú Hòa', district: 'TP. Thủ Dầu Một', province: 'Bình Dương', lat: 11.005, lng: 106.653 },
  { ward: 'Dĩ An', district: 'TP. Dĩ An', province: 'Bình Dương', lat: 10.897, lng: 106.767 },
  { ward: 'Thuận An', district: 'TP. Thuận An', province: 'Bình Dương', lat: 10.928, lng: 106.710 },
  { ward: 'Bến Cát', district: 'TX. Bến Cát', province: 'Bình Dương', lat: 11.105, lng: 106.593 },
  // Đồng Nai
  { ward: 'Tân Phong', district: 'TP. Biên Hòa', province: 'Đồng Nai', lat: 10.957, lng: 106.826 },
  { ward: 'Long Bình Tân', district: 'TP. Biên Hòa', province: 'Đồng Nai', lat: 10.935, lng: 106.850 },
  { ward: 'Trảng Dài', district: 'TP. Biên Hòa', province: 'Đồng Nai', lat: 10.975, lng: 106.842 },
  // Long An
  { ward: 'Phường 1', district: 'TP. Tân An', province: 'Long An', lat: 10.535, lng: 106.413 },
  { ward: 'Đức Hòa', district: 'H. Đức Hòa', province: 'Long An', lat: 10.800, lng: 106.425 },
  // Cần Thơ
  { ward: 'An Phú', district: 'Ninh Kiều', province: 'Cần Thơ', lat: 10.033, lng: 105.784 },
  { ward: 'Xuân Khánh', district: 'Ninh Kiều', province: 'Cần Thơ', lat: 10.025, lng: 105.770 },
  { ward: 'Cái Răng', district: 'Cái Răng', province: 'Cần Thơ', lat: 10.005, lng: 105.785 },
  // Tây Ninh
  { ward: 'Phường 1', district: 'TP. Tây Ninh', province: 'Tây Ninh', lat: 11.310, lng: 106.098 },
  // Bà Rịa - Vũng Tàu
  { ward: 'Phường 1', district: 'TP. Vũng Tàu', province: 'Bà Rịa Vũng Tàu', lat: 10.346, lng: 107.084 },
  // Tiền Giang
  { ward: 'Phường 1', district: 'TP. Mỹ Tho', province: 'Tiền Giang', lat: 10.350, lng: 106.362 },
  // An Giang
  { ward: 'Mỹ Bình', district: 'TP. Long Xuyên', province: 'An Giang', lat: 10.386, lng: 105.435 },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All ward entries for target cities/provinces */
export const WARD_DATABASE: WardEntry[] = [...TPHCM, ...HANOI, ...DANANG, ...SOUTHERN];

/** All unique district names for quick lookup */
export const DISTRICT_NAMES: string[] = [...new Set(WARD_DATABASE.map(w => w.district))];

/** All unique ward names for quick lookup */
export const WARD_NAMES: string[] = [...new Set(WARD_DATABASE.map(w => w.ward))];

/** Remove Vietnamese diacritics for fuzzy matching */
function removeDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/**
 * Find ward/district match in text.
 * Returns the most specific match (ward > district > null).
 */
export function findWardInText(text: string): WardEntry | null {
  const normText = removeDiacritics(text);

  // Try exact ward name match first (most specific)
  for (const entry of WARD_DATABASE) {
    if (normText.includes(removeDiacritics(entry.ward)) &&
        normText.includes(removeDiacritics(entry.district))) {
      return entry;
    }
  }

  // Try ward name only
  for (const entry of WARD_DATABASE) {
    if (normText.includes(removeDiacritics(entry.ward))) {
      return entry;
    }
  }

  // Try district name only
  for (const entry of WARD_DATABASE) {
    if (normText.includes(removeDiacritics(entry.district))) {
      return entry;
    }
  }

  return null;
}

/**
 * Find all matching locations in text (may return multiple districts/wards).
 */
export function findAllLocationsInText(text: string): WardEntry[] {
  const normText = removeDiacritics(text);
  const matches: WardEntry[] = [];
  const seen = new Set<string>();

  for (const entry of WARD_DATABASE) {
    const key = `${entry.district}|${entry.province}`;
    if (seen.has(key)) continue;
    if (normText.includes(removeDiacritics(entry.district))) {
      matches.push(entry);
      seen.add(key);
    }
  }

  return matches;
}
