export type AlertLevel = 'alert' | 'warning' | 'watch';

export interface DiseaseOutbreakItem {
  id: string;
  disease: string;
  country: string;
  countryCode: string;
  alertLevel: AlertLevel;
  title: string;
  summary: string;
  url: string;
  publishedAt: number;
  lat?: number;
  lng?: number;
  cases?: number;
  deaths?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  summary?: string;
  imageUrl?: string;
  category?: string;
}

export interface CountryHealthProfile {
  countryCode: string;
  countryName: string;
  activeOutbreaks: number;
  riskLevel: AlertLevel;
  diseases: string[];
  lastUpdated: number;
}

export interface EpidemicStats {
  totalOutbreaks: number;
  activeAlerts: number;
  countriesAffected: number;
  topDiseases: { disease: string; count: number }[];
  lastUpdated: number;
}

export interface OwidCountryRecord {
  location: string;
  iso_code: string;
  total_cases: number;
  total_deaths: number;
  total_cases_per_million: number;
  total_deaths_per_million: number;
  total_vaccinations_per_hundred: number;
  last_updated_date: string;
}
