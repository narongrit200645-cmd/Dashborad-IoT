import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ClockCard } from './components/ClockCard';
import { SensorCard } from './components/SensorCard';
import { ChartSection } from './components/ChartSection';
import { AutoExportManager } from './components/AutoExportManager';
import { ESP32Modal } from './components/ESP32Modal';
import { LayoutEditorModal } from './components/LayoutEditorModal';
import {
  TelemetryData,
  HistoryPoint,
  WidgetConfig,
  ThemeMode,
  AutoExportSettings,
  ExportHistoryItem,
  LogoSettings,
} from './types';
import { toPng } from 'html-to-image';

// Initial default widgets configuration matching screenshot 100%
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'v100_ln', title: '100V L-N', key: 'v100_ln', unit: 'V', iconType: 'bolt', visible: true, order: 0, gridSpan: 'col-span-1' },
  { id: 'v220_ln', title: '220V L-N', key: 'v220_ln', unit: 'V', iconType: 'bolt', visible: true, order: 1, gridSpan: 'col-span-1' },
  { id: 'temperature', title: 'Temperature', key: 'temperature', unit: '°C', iconType: 'thermometer', visible: true, order: 2, gridSpan: 'col-span-1' },
  { id: 'v100_lg', title: '100V L-G', key: 'v100_lg', unit: 'V', iconType: 'bolt', visible: true, order: 3, gridSpan: 'col-span-1' },
  { id: 'v220_lg', title: '220V L-G', key: 'v220_lg', unit: 'V', iconType: 'bolt', visible: true, order: 4, gridSpan: 'col-span-1' },
  { id: 'humidity', title: 'Humidity', key: 'humidity', unit: '%', iconType: 'droplet', visible: true, order: 5, gridSpan: 'col-span-1' },
  { id: 'gnd_100v', title: 'GND 100V', key: 'gnd_100v', unit: 'V', iconType: 'ground', visible: true, order: 6, gridSpan: 'col-span-1' },
  { id: 'gnd_220v', title: 'GND 220V', key: 'gnd_220v', unit: 'V', iconType: 'ground', visible: true, order: 7, gridSpan: 'col-span-1' },
  { id: 'barometer', title: 'Barometer', key: 'barometer', unit: 'hPa', iconType: 'cloud', visible: true, order: 8, gridSpan: 'col-span-1' },
];

export default function App() {
  // Telemetry state initialized matching screenshot values
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    v100_ln: 0.0,
    v220_ln: 0.0,
    temperature: 24.8,
    v100_lg: 0.0,
    v220_lg: 0.0,
    humidity: 50.3,
    gnd_100v: 0.0,
    gnd_220v: 0.0,
    barometer: 1010.09,
    lastUpdated: new Date().toISOString(),
    status: 'online',
    tempTarget: 23,
    tempTolerance: 3,
    humidityTarget: 55,
    humidityTolerance: 15,
  });

  // Logo Settings state
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(() => {
    try {
      const saved = localStorage.getItem('iot_logo_settings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleUpdateLogoSettings = (updated: Partial<LogoSettings>) => {
    setLogoSettings((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('iot_logo_settings', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save logo settings:', e);
      }
      return next;
    });
  };

  // Chart history data
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  // Widget customizer & reordering state
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);

  // Theme Mode: 'auto' | 'day' | 'night'
  const [themeMode, setThemeMode] = useState<ThemeMode>('night'); // Default dark navy theme matching screenshot
  const [isDark, setIsDark] = useState<boolean>(true);

  // Auto Export settings & logs
  const [exportSettings, setExportSettings] = useState<AutoExportSettings>({
    enabled: false,
    intervalMinutes: 5,
    format: 'png',
    autoDownload: false,
  });
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);

  // Modals state
  const [isAutoExportOpen, setIsAutoExportOpen] = useState(false);
  const [isESP32ModalOpen, setIsESP32ModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);

  // Handle Day/Night Theme Auto logic
  useEffect(() => {
    if (themeMode === 'auto') {
      const hour = new Date().getHours();
      // Day time: 06:00 to 18:00
      setIsDark(hour < 6 || hour >= 18);
    } else {
      setIsDark(themeMode === 'night');
    }
  }, [themeMode]);

  // Fetch initial data and setup polling every 3 seconds
  // เชื่อมต่อรับค่าจริงแบบ Real-time 100% (Server-Sent Events)
  useEffect(() => {
    // 1. ดึงข้อมูลประวัติย้อนหลังครั้งแรกตอนโหลดหน้าเว็บ
    const fetchInitialData = async () => {
      try {
        const res = await fetch('/api/iot/data');
        if (res.ok) {
          const data = await res.json();
          if (data.telemetry) setTelemetry((prev) => ({ ...prev, ...data.telemetry }));
          if (data.history) setHistory(data.history);
        }
      } catch (err) {
        console.error('Failed to fetch initial IoT telemetry:', err);
      }
    };

    fetchInitialData();

    // 2. เปิดท่อรับการสตรีมข้อมูลเรียลไทม์จากเซิร์ฟเวอร์
    const eventSource = new EventSource('/api/iot/stream');

    eventSource.onmessage = (event) => {
      try {
        const realTimeData = JSON.parse(event.data);
        
        // เมื่อมีค่าใหม่จากบอร์ด ESP32 เข้ามา ให้เปลี่ยนตัวเลขบนหน้าปัดทันที
        if (realTimeData.telemetry) {
          setTelemetry((prev) => ({
            ...prev,
            ...realTimeData.telemetry,
            status: 'online',
            lastUpdated: new Date().toISOString(),
          }));

          // อัปเดตจุดของอุณหภูมิและความชื้นลงในกราฟทันที
          setHistory((prevHistory) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayStr = days[now.getDay()];
            const dateStr = now.toLocaleDateString('th-TH');

            const newPoint = {
              time: timeStr,
              day: dayStr,
              dateStr: dateStr,
              temperature: realTimeData.telemetry.temperature,
              humidity: realTimeData.telemetry.humidity,
            };

            // เก็บประวัติจุดบนกราฟย้อนหลังไม่เกิน 200 จุด เพื่อไม่ให้เบราว์เซอร์ช้า
            return [...prevHistory, newPoint].slice(-200);
          });
        }
      } catch (err) {
        console.error('Error parsing real-time stream:', err);
      }
    };

    eventSource.onerror = () => {
      // หากเซิร์ฟเวอร์หลุด ให้เปลี่ยนสถานะเป็น offline
      setTelemetry((prev) => ({ ...prev, status: 'offline' }));
    };

    // ปิดการเชื่อมต่อเมื่อเปลี่ยนหน้าหรือปิดเว็บ
    return () => {
      eventSource.close();
    };
  }, []);

  // Drag and Drop card reordering state
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    setDraggedWidgetId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedWidgetId || draggedWidgetId === targetId) return;

    const sourceIdx = widgets.findIndex((w) => w.id === draggedWidgetId);
    const targetIdx = widgets.findIndex((w) => w.id === targetId);

    if (sourceIdx < 0 || targetIdx < 0) return;

    const reordered = [...widgets];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const reIndexed = reordered.map((w, idx) => ({ ...w, order: idx }));
    setWidgets(reIndexed);
    setDraggedWidgetId(null);
  };

  // Automatic Chart Image Export Timer Hook (Interval or Sunday 23:59)
  useEffect(() => {
    if (!exportSettings.enabled) return;

    const checkAndExport = async () => {
      const now = new Date();

      if (exportSettings.scheduleType === 'sunday_2359') {
        const isSunday = now.getDay() === 0;
        const is2359 = now.getHours() === 23 && now.getMinutes() === 59;
        if (!isSunday || !is2359) return;
      }

      const chartElement = document.getElementById('iot-chart-section');
      if (!chartElement) return;

      try {
        const imageData = await toPng(chartElement, { cacheBust: true, quality: 0.95 });
        const nowStr = now.toLocaleString('th-TH');

        const titleStr =
          exportSettings.scheduleType === 'sunday_2359'
            ? 'Weekly Sunday 23:59 Auto Export'
            : `Auto Export (${exportSettings.intervalMinutes}m)`;

        const newExportItem: ExportHistoryItem = {
          id: `auto_${Date.now()}`,
          timestamp: nowStr,
          type: 'auto',
          title: titleStr,
          imageData,
        };

        setExportHistory((prev) => [newExportItem, ...prev].slice(0, 20));

        // Save to backend server
        fetch('/api/iot/export-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newExportItem),
        }).catch((e) => console.error('Failed to save export:', e));

        // Optional Browser Auto-Download
        if (exportSettings.autoDownload) {
          const link = document.createElement('a');
          link.download = `IoT_Auto_Export_${Date.now()}.png`;
          link.href = imageData;
          link.click();
        }
      } catch (e) {
        console.error('Auto export chart error:', e);
      }
    };

    // Check interval: every 60s for sunday_2359, or custom intervalMinutes
    const pollTime =
      exportSettings.scheduleType === 'sunday_2359'
        ? 60 * 1000
        : exportSettings.intervalMinutes * 60 * 1000;

    const exportTimer = setInterval(checkAndExport, pollTime);

    return () => clearInterval(exportTimer);
  }, [exportSettings]);

  // Handle Manual Export from Chart section
  const handleManualExportSaved = useCallback((imageData: string, title: string) => {
    const nowStr = new Date().toLocaleString('th-TH');
    const newExportItem: ExportHistoryItem = {
      id: `manual_${Date.now()}`,
      timestamp: nowStr,
      type: 'manual',
      title,
      imageData,
    };

    setExportHistory((prev) => [newExportItem, ...prev].slice(0, 20));

    fetch('/api/iot/export-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExportItem),
    }).catch((e) => console.error('Failed to save manual export:', e));
  }, []);

  // Update telemetry locally & broadcast
  const handleUpdateTelemetry = async (updated: Partial<TelemetryData>) => {
    setTelemetry((prev) => ({ ...prev, ...updated }));
    try {
      await fetch('/api/iot/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error('Update telemetry error:', e);
    }
  };

  // Reset layout to 100% original screenshot state
  const handleResetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
    setTelemetry((prev) => ({
      ...prev,
      tempTarget: 23,
      tempTolerance: 3,
      humidityTarget: 55,
      humidityTolerance: 15,
    }));
  };

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-300 font-sans p-2 sm:p-4 md:p-6 ${
        isDark ? 'bg-[#050A18] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* Top Header & Navigation */}
        <Header
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
          isDark={isDark}
          onOpenAutoExport={() => setIsAutoExportOpen(true)}
          onOpenESP32Modal={() => setIsESP32ModalOpen(true)}
          onOpenLayoutModal={() => setIsLayoutModalOpen(true)}
          telemetry={telemetry}
          logoSettings={logoSettings}
          onUpdateLogoSettings={handleUpdateLogoSettings}
        />

        {/* Main Dashboard Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT SECTION (5 Columns on Large Screens) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Box 1 Top Left: Clock & Company Card */}
            <ClockCard
              isDark={isDark}
              clockLogoUrl={logoSettings.clockLogoUrl}
              onUpdateClockLogo={(url) => handleUpdateLogoSettings({ clockLogoUrl: url })}
            />

            {/* 3x3 Sensor Cards Grid matching Screenshot 100% */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {widgets
                .filter((w) => w.visible)
                .map((widget) => {
                  const rawVal = telemetry[widget.key as keyof TelemetryData];
                  const displayVal = typeof rawVal === 'number' ? rawVal : rawVal || 0;

                  // Check if values exceed alarm boundaries
                  let isAlert = false;
                  if (widget.key === 'temperature') {
                    const min = telemetry.tempTarget - telemetry.tempTolerance;
                    const max = telemetry.tempTarget + telemetry.tempTolerance;
                    if (typeof displayVal === 'number' && (displayVal < min || displayVal > max)) {
                      isAlert = true;
                    }
                  } else if (widget.key === 'humidity') {
                    const min = telemetry.humidityTarget - telemetry.humidityTolerance;
                    const max = telemetry.humidityTarget + telemetry.humidityTolerance;
                    if (typeof displayVal === 'number' && (displayVal < min || displayVal > max)) {
                      isAlert = true;
                    }
                  }

                  return (
                    <SensorCard
                      key={widget.id}
                      id={widget.id}
                      title={widget.title}
                      value={displayVal}
                      unit={widget.unit}
                      iconType={widget.iconType}
                      isDark={isDark}
                      customColor={widget.customColor}
                      isAlert={isAlert}
                      onDragStart={() => handleDragStart(widget.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(widget.id)}
                    />
                  );
                })}
            </div>
          </div>

          {/* RIGHT SECTION (7 Columns on Large Screens): Temperature & Humidity Charts */}
          <div className="lg:col-span-7">
            <ChartSection
              history={history}
              telemetry={telemetry}
              isDark={isDark}
              onManualExportSaved={handleManualExportSaved}
            />
          </div>
        </div>
      </div>

      {/* MODALS */}
      <AutoExportManager
        isOpen={isAutoExportOpen}
        onClose={() => setIsAutoExportOpen(false)}
        exportSettings={exportSettings}
        onUpdateSettings={setExportSettings}
        exportHistory={exportHistory}
        onClearHistory={() => setExportHistory([])}
        onManualExport={() => {
          setIsAutoExportOpen(false);
          const chartElement = document.getElementById('iot-chart-section');
          if (chartElement) {
            toPng(chartElement).then((url) => {
              handleManualExportSaved(url, 'Manual Export from Manager');
            });
          }
        }}
      />

      <ESP32Modal
        isOpen={isESP32ModalOpen}
        onClose={() => setIsESP32ModalOpen(false)}
        telemetry={telemetry}
        onUpdateTelemetry={handleUpdateTelemetry}
      />

      <LayoutEditorModal
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        widgets={widgets}
        onUpdateWidgets={setWidgets}
        telemetry={telemetry}
        onUpdateTelemetry={handleUpdateTelemetry}
        logoSettings={logoSettings}
        onUpdateLogoSettings={handleUpdateLogoSettings}
        onResetLayout={handleResetLayout}
      />
    </div>
  );
}
