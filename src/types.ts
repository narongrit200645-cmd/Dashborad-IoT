export interface TelemetryData {
  v100_ln: number;
  v220_ln: number;
  temperature: number;
  v100_lg: number;
  v220_lg: number;
  humidity: number;
  gnd_100v: number;
  gnd_220v: number;
  barometer: number;
  lastUpdated: string;
  status: 'online' | 'offline' | 'simulated';
  esp32Ip?: string;
  tempTarget: number;
  tempTolerance: number;
  humidityTarget: number;
  humidityTolerance: number;
}

export interface HistoryPoint {
  id: string;
  day: string;
  time: string;
  dateStr: string;
  timestamp: number;
  temperature: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  humMin: number;
  humMax: number;
}

export interface WidgetConfig {
  id: string;
  title: string;
  key: keyof TelemetryData | 'clock';
  unit: string;
  iconType: 'bolt' | 'thermometer' | 'droplet' | 'ground' | 'cloud' | 'logo_clock';
  visible: boolean;
  order: number;
  gridSpan: 'col-span-1' | 'col-span-2' | 'col-span-3';
  customColor?: string;
}

export interface ExportHistoryItem {
  id: string;
  timestamp: string;
  type: 'auto' | 'manual';
  title: string;
  imageData: string;
}

export interface AutoExportSettings {
  enabled: boolean;
  scheduleType?: 'interval' | 'sunday_2359';
  intervalMinutes: number; // e.g. 1, 5, 15, 60, 1440
  format: 'png' | 'jpeg';
  autoDownload: boolean;
  lastExportTime?: string;
  nextExportTime?: string;
}

export interface LogoSettings {
  headerRmuLogoUrl?: string; // Custom image for header RMU logo
  clockLogoUrl?: string;     // Custom image for clock NA/custom logo
}

export type ThemeMode = 'auto' | 'day' | 'night';
