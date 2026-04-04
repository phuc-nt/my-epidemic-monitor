/**
 * Sample Vietnam epidemic data used when API edge functions are unavailable (dev mode).
 * Real data comes from WHO, MOH-VN, OWID when deployed.
 */
import type { DiseaseOutbreakItem, EpidemicStats, NewsItem } from '@/types';

export const SAMPLE_OUTBREAKS: DiseaseOutbreakItem[] = [
  {
    id: 'vn-deng-hcm', disease: 'Sốt xuất huyết (Dengue)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'alert', title: 'Dengue Fever — Ho Chi Minh City',
    summary: 'Số ca sốt xuất huyết tăng mạnh tại TP.HCM, đặc biệt ở các quận 12, Bình Tân, Gò Vấp.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 3600_000,
    lat: 10.82, lng: 106.63, cases: 4520, deaths: 3,
  },
  {
    id: 'vn-deng-hn', disease: 'Sốt xuất huyết (Dengue)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'warning', title: 'Dengue Fever — Hanoi',
    summary: 'Ca mắc sốt xuất huyết gia tăng tại Hà Nội, tập trung ở quận Hoàng Mai, Thanh Xuân.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 7200_000,
    lat: 21.03, lng: 105.85, cases: 1850, deaths: 1,
  },
  {
    id: 'vn-hfmd-dn', disease: 'Tay chân miệng (HFMD)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'warning', title: 'Hand Foot Mouth Disease — Da Nang',
    summary: 'Bùng phát tay chân miệng ở trẻ em dưới 5 tuổi tại Đà Nẵng.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 14400_000,
    lat: 16.05, lng: 108.22, cases: 620, deaths: 0,
  },
  {
    id: 'vn-flu-hp', disease: 'Cúm A (Influenza A)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'watch', title: 'Influenza A — Hai Phong',
    summary: 'Ghi nhận các ca cúm A tăng theo mùa tại Hải Phòng.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 28800_000,
    lat: 20.86, lng: 106.68, cases: 340, deaths: 0,
  },
  {
    id: 'vn-covid-bd', disease: 'COVID-19', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'watch', title: 'COVID-19 — Binh Duong',
    summary: 'Ca mắc COVID-19 biến thể mới được phát hiện tại Bình Dương.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 43200_000,
    lat: 11.17, lng: 106.65, cases: 150, deaths: 0,
  },
  {
    id: 'vn-deng-ct', disease: 'Sốt xuất huyết (Dengue)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'alert', title: 'Dengue Fever — Can Tho',
    summary: 'Dịch sốt xuất huyết lan rộng ở Cần Thơ và các tỉnh ĐBSCL.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 57600_000,
    lat: 10.04, lng: 105.79, cases: 2100, deaths: 2,
  },
  {
    id: 'vn-deng-kh', disease: 'Sốt xuất huyết (Dengue)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'warning', title: 'Dengue Fever — Khanh Hoa',
    summary: 'Nha Trang ghi nhận số ca sốt xuất huyết tăng 40% so với cùng kỳ.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 86400_000,
    lat: 12.25, lng: 109.05, cases: 780, deaths: 0,
  },
  {
    id: 'vn-meas-tq', disease: 'Sởi (Measles)', country: 'Vietnam',
    countryCode: 'VN', alertLevel: 'warning', title: 'Measles — Tuyen Quang',
    summary: 'Ổ dịch sởi ở trẻ em chưa tiêm chủng tại Tuyên Quang.',
    url: 'https://moh.gov.vn', publishedAt: Date.now() - 172800_000,
    lat: 21.78, lng: 105.21, cases: 45, deaths: 0,
  },
];

export const SAMPLE_STATS: EpidemicStats = {
  totalOutbreaks: SAMPLE_OUTBREAKS.length,
  activeAlerts: SAMPLE_OUTBREAKS.filter(o => o.alertLevel === 'alert').length,
  countriesAffected: 1,
  topDiseases: [
    { disease: 'Sốt xuất huyết (Dengue)', count: 4 },
    { disease: 'Tay chân miệng (HFMD)', count: 1 },
    { disease: 'Cúm A (Influenza A)', count: 1 },
    { disease: 'COVID-19', count: 1 },
    { disease: 'Sởi (Measles)', count: 1 },
  ],
  lastUpdated: Date.now(),
};

export const SAMPLE_NEWS: NewsItem[] = [
  {
    id: 'news-1', title: 'Bộ Y tế cảnh báo dịch sốt xuất huyết bùng phát mạnh tại miền Nam',
    source: 'MOH-VN', url: 'https://moh.gov.vn', publishedAt: Date.now() - 1800_000,
    summary: 'Số ca mắc sốt xuất huyết trong tuần qua tăng 35% so với tuần trước.',
  },
  {
    id: 'news-2', title: 'WHO supports Vietnam dengue response in southern provinces',
    source: 'WHO-VN', url: 'https://who.int/vietnam', publishedAt: Date.now() - 7200_000,
    summary: 'WHO provides technical assistance for vector control and surveillance.',
  },
  {
    id: 'news-3', title: 'TP.HCM triển khai chiến dịch diệt lăng quăng, bọ gậy',
    source: 'MOH-VN', url: 'https://moh.gov.vn', publishedAt: Date.now() - 14400_000,
    summary: 'Phát động chiến dịch vệ sinh môi trường tại 22 quận huyện.',
  },
  {
    id: 'news-4', title: 'New COVID-19 subvariant detected in Southeast Asia',
    source: 'WHO', url: 'https://who.int', publishedAt: Date.now() - 28800_000,
    summary: 'WHO monitoring new subvariant with increased transmissibility in the region.',
  },
  {
    id: 'news-5', title: 'Tiêm chủng mở rộng: Đợt tiêm sởi cho trẻ em tại 15 tỉnh',
    source: 'MOH-VN', url: 'https://moh.gov.vn', publishedAt: Date.now() - 43200_000,
    summary: 'Bộ Y tế phối hợp WHO triển khai tiêm sởi bổ sung cho trẻ 1-5 tuổi.',
  },
];
