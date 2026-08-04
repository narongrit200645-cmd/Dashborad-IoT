import React, { useRef } from 'react';
import { NALogo } from './NALogo';
import { CrestLogo } from './CrestLogo';
import { Sun, Moon, Cpu, Camera, Settings, Activity, Wifi, Upload, Image as ImageIcon } from 'lucide-react';
import { ThemeMode, TelemetryData, LogoSettings } from '../types';

interface HeaderProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  isDark: boolean;
  onOpenAutoExport: () => void;
  onOpenESP32Modal: () => void;
  onOpenLayoutModal: () => void;
  telemetry: TelemetryData;
  logoSettings: LogoSettings;
  onUpdateLogoSettings: (updated: Partial<LogoSettings>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  themeMode,
  onThemeModeChange,
  isDark,
  onOpenAutoExport,
  onOpenESP32Modal,
  onOpenLayoutModal,
  telemetry,
  logoSettings,
  onUpdateLogoSettings,
}) => {
  const rmuFileInputRef = useRef<HTMLInputElement>(null);

  const handleRmuLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateLogoSettings({ headerRmuLogoUrl: String(event.target.result) });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <header className="w-full flex flex-col space-y-3 pb-3">
      {/* Hidden File Input for Custom Header RMU Logo */}
      <input
        type="file"
        ref={rmuFileInputRef}
        onChange={handleRmuLogoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Main Top Header Banner Matching Screenshot Layout 100% */}
      <div
        className={`relative w-full flex items-center justify-between px-4 py-2 rounded-xl border transition-all duration-300 ${
          isDark
            ? 'bg-gradient-to-r from-[#0B1329] via-[#0F1D42] to-[#0B1329] border-blue-600/70 shadow-lg text-white'
            : 'bg-gradient-to-r from-blue-50 via-white to-blue-50 border-blue-200 shadow-md text-slate-900'
        }`}
      >
        {/* Top Left RMU Logo Badge (Replaced NA with RMU logo per request) */}
        <div className="relative group flex items-center space-x-2">
          {logoSettings.headerRmuLogoUrl ? (
            <img
              src={logoSettings.headerRmuLogoUrl}
              alt="Custom RMU Logo"
              className="w-12 h-16 object-contain drop-shadow"
            />
          ) : (
            <CrestLogo className="w-12 h-16" />
          )}

          {/* Hover button to change/upload RMU logo */}
          <button
            onClick={() => rmuFileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-500 text-white p-1 rounded-full shadow transition-opacity border border-blue-300"
            title="เปลี่ยนรูปโลโก้ RMU (Upload Logo)"
          >
            <Upload className="w-3 h-3" />
          </button>
        </div>

        {/* Center Title Banner: Smart IoT Monitoring For Electrical Calibration Room */}
        <div className="text-center flex-1 px-4">
          <h1
            className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight ${
              isDark
                ? 'text-blue-400 drop-shadow-[0_2px_10px_rgba(37,99,235,0.6)]'
                : 'text-blue-900 drop-shadow-sm font-black'
            }`}
          >
            Smart IoT Monitoring For Electrical Calibration Room
          </h1>
        </div>

        {/* Top Right Header Space */}
        <div className="w-12 h-12"></div>
      </div>

      {/* Action Navigation Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl border transition-all duration-300 ${
          isDark
            ? 'bg-[#0B1329]/90 border-blue-900/60 shadow-md text-slate-200'
            : 'bg-white border-blue-200 shadow-md text-slate-800'
        }`}
      >
        {/* Left Status Badges */}
        <div className="flex items-center space-x-3 text-xs font-semibold">
          <span
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border ${
              telemetry.status === 'online'
                ? (isDark ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold')
                : (isDark ? 'bg-red-950/80 border-red-600/80 text-red-300' : 'bg-red-50 border-red-300 text-red-800 font-bold')
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${telemetry.status === 'online' ? 'bg-emerald-400' : 'bg-red-500'}`}></span>
            <Wifi className="w-3.5 h-3.5" />
            <span>ESP32 Server: {telemetry.status === 'online' ? 'Online' : 'Offline'}</span>
          </span>

          <span
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full border ${
              isDark
                ? 'bg-blue-950/80 border-blue-700/80 text-blue-300'
                : 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Calibration Active</span>
          </span>
        </div>

        {/* Right Action Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day / Night Auto Mode Selector */}
          <div
            className={`flex items-center p-1 rounded-lg border text-xs ${
              isDark ? 'bg-slate-900 border-slate-700/80' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={() => onThemeModeChange('auto')}
              className={`px-2.5 py-1 rounded font-bold transition ${
                themeMode === 'auto'
                  ? 'bg-blue-600 text-white shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Auto Day/Night
            </button>
            <button
              onClick={() => onThemeModeChange('day')}
              className={`p-1.5 rounded transition ${
                themeMode === 'day'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-amber-500'
              }`}
              title="Day Mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeModeChange('night')}
              className={`p-1.5 rounded transition ${
                themeMode === 'night'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-indigo-400'
              }`}
              title="Night Mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto Export Image Config Button */}
          <button
            onClick={onOpenAutoExport}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 transition shadow-sm"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ตั้งเวลา Export รูปภาพ</span>
            <span className="sm:hidden">Auto Export</span>
          </button>

          {/* ESP32 Connector & Simulator Modal */}
          <button
            onClick={onOpenESP32Modal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white border border-amber-400 transition shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>ESP32 / Sim</span>
          </button>

          {/* Customize UI Layout Button */}
          <button
            onClick={onOpenLayoutModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 transition shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ปรับแต่ง UI</span>
          </button>
        </div>
      </div>
    </header>
  );
};
