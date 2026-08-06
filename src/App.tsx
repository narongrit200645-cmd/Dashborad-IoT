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

// กำหนดขีดจำกัดข้อมูล 7 วัน (1 นาที/จุด) = 10,080 บวกเผื่อ Buffer
const MAX_HISTORY_POINTS = 10500;

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
  // ✅ 1. เพิ่ม chartRef ผูกกับ Element กราฟ (อุดช่องโหว่ getElementById)
  const chartRef = useRef<HTMLDivElement>(null);

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

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastRecordTimeRef = useRef<string | null>(null);

  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [themeMode, setThemeMode] = useState<ThemeMode>('night');
  const [isDark, setIsDark] = useState<boolean>(true);

  const [exportSettings, setExportSettings] = useState<AutoExportSettings>({
    enabled: false,
    intervalMinutes: 5,
    format: 'png',
    autoDownload: false,
  });
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);

  const [isAutoExportOpen, setIsAutoExportOpen] = useState(false);
  const [isESP32ModalOpen, setIsESP32ModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);

  useEffect(() => {
    if (themeMode === 'auto') {
      const hour = new Date().getHours();
      setIsDark(hour < 6 || hour >= 18);
    } else {
      setIsDark(themeMode === 'night');
    }
  }, [themeMode]);

  // ✅ 2. อุดช่องโหว่ความปลอดภัย: ป้องกันการยิงคำสั่ง DELETE จากฝั่ง Frontend
  const handleAutoResetWeekly = async () => {
    try {
      console.log('Weekly Reset Triggered: Clearing local state.');
      setHistory([]);
      lastRecordTimeRef.current = null;
    } catch (err) {
      console.error('Error during weekly auto-reset:', err);
    }
  };

  // ✅ 3. ปรับปรุงระบบดึงข้อมูลแบบฉลาด (ดึงเฉพาะสัปดาห์นี้ + ป้องกันลูปนรก)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) return;

        // คำนวณหาวันและเวลาของ "วันจันทร์" ในสัปดาห์ปัจจุบัน (00:00 น.)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0); 
        const mondayIso = monday.toISOString();

        let allRecords: any[] = [];
        let offset = 0;
        const limit = 1000;
        let keepFetching = true;
        let safetyCounter = 0; // ลิมิตเพื่อไม่ให้ลูปไม่สิ้นสุด

        // กรองข้อมูลเฉพาะตั้งแต่ช่วง 00:00 ของวันจันทร์สัปดาห์นี้
        // วนลูปสูงสุด 11 รอบ (11,000 จุด) ครอบคลุม 10,080 จุด สำหรับ 7 วัน
        while (keepFetching && safetyCounter < 11) {
          const res = await fetch(`${supabaseUrl}/rest/v1/sensor_data?select=*&created_at=gte.${mondayIso}&order=created_at.asc&limit=${limit}&offset=${offset}`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });

          if (res.ok) {
            const records = await res.json();
            allRecords = [...allRecords, ...records];
            
            if (records.length < limit) {
              keepFetching = false;
            } else {
              offset += limit;
            }
          } else {
            keepFetching = false;
          }
          safetyCounter++;
        }

        if (allRecords.length > 0) {
          const historyData = allRecords.map((record: any) => {
            const date = new Date(record.created_at);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return {
              time: date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              day: days[date.getDay()],
              dateStr: date.toLocaleDateString('th-TH'),
              temperature: record.temperature,
              humidity: record.humidity,
            };
          });

          const latest = allRecords[allRecords.length - 1];
          lastRecordTimeRef.current = latest.created_at;

          setTelemetry((prev) => ({
            ...prev,
            temperature: latest.temperature ?? prev.temperature,
            humidity: latest.humidity ?? prev.humidity,
            barometer: latest.barometer ?? prev.barometer,
            v100_ln: latest.v100_ln ?? prev.v100_ln,
            v220_ln: latest.v220_ln ?? prev.v220_ln,
            v100_lg: latest.v100_lg ?? prev.v100_lg,
            v220_lg: latest.v220_lg ?? prev.v220_lg,
            gnd_100v: latest.gnd_100v ?? prev.gnd_100v,
            gnd_220v: latest.gnd_220v ?? prev.gnd_220v,
            status: 'online',
            lastUpdated: new Date().toISOString(),
          }));

          setHistory(historyData); 
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };

    const fetchNewData = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey || !lastRecordTimeRef.current) return;

        const res = await fetch(`${supabaseUrl}/rest/v1/sensor_data?select=*&created_at=gt.${lastRecordTimeRef.current}&order=created_at.asc`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });

        if (res.ok) {
          const records = await res.json();
          if (records && records.length > 0) {
            const newHistoryData = records.map((record: any) => {
              const date = new Date(record.created_at);
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              return {
                time: date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                day: days[date.getDay()],
                dateStr: date.toLocaleDateString('th-TH'),
                temperature: record.temperature,
                humidity: record.humidity,
              };
            });

            const latest = records[records.length - 1];
            lastRecordTimeRef.current = latest.created_at;

            setTelemetry((prev) => ({
              ...prev,
              temperature: latest.temperature ?? prev.temperature,
              humidity: latest.humidity ?? prev.humidity,
              barometer: latest.barometer ?? prev.barometer,
              v100_ln: latest.v100_ln ?? prev.v100_ln,
              v220_ln: latest.v220_ln ?? prev.v220_ln,
              v100_lg: latest.v100_lg ?? prev.v100_lg,
              v220_lg: latest.v220_lg ?? prev.v220_lg,
              gnd_100v: latest.gnd_100v ?? prev.gnd_100v,
              gnd_220v: latest.gnd_220v ?? prev.gnd_220v,
              status: 'online',
              lastUpdated: new Date().toISOString(),
            }));

            // ✅ 4. ตัดการทำงาน Array ขยะ (Memory Optimization) ให้จำกัดที่ 10,500 ข้อมูล
            setHistory((prev) => {
              const updatedHistory = [...prev, ...newHistoryData];
              return updatedHistory.slice(-MAX_HISTORY_POINTS); 
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch new data:', err);
      }
    };

    fetchInitialData();
    const interval = setInterval(fetchNewData, 5000);
    return () => clearInterval(interval);
  }, []);

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggedWidgetId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

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

  useEffect(() => {
    if (!exportSettings.enabled) return;

    const checkAndExport = async () => {
      const now = new Date();

      if (exportSettings.scheduleType === 'sunday_2359') {
        const isSunday = now.getDay() === 0;
        const is2359 = now.getHours() === 23 && now.getMinutes() === 59;
        if (!isSunday || !is2359) return;
      }

      // ดึงค่าการอ้างอิงผ่าน chartRef แทน DOM แบบเก่า
      const chartElement = chartRef.current;
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

        if (exportSettings.autoDownload) {
          const link = document.createElement('a');
          link.download = `IoT_Auto_Export_${Date.now()}.png`;
          link.href = imageData;
          link.click();
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const bucketName = 'chart-exports'; 
        
        if (supabaseUrl && supabaseKey) {
          const base64Response = await fetch(imageData);
          const blob = await base64Response.blob();
          const fileName = `chart_auto_${Date.now()}.png`;
          
          const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'image/png'
            },
            body: blob
          });

          if (uploadRes.ok) {
            console.log(`✅ อัปโหลดรูป ${fileName} ขึ้น Supabase Storage สำเร็จ!`);
          }
        }
      } catch (e) {
        console.error('Auto export chart error:', e);
      }
    };

    const pollTime =
      exportSettings.scheduleType === 'sunday_2359'
        ? 60 * 1000
        : exportSettings.intervalMinutes * 60 * 1000;

    const exportTimer = setInterval(checkAndExport, pollTime);
    return () => clearInterval(exportTimer);
  }, [exportSettings]);

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
  }, []);

  const handleUpdateTelemetry = async (updated: Partial<TelemetryData>) => {
    setTelemetry((prev) => ({ ...prev, ...updated }));
    if (updated.temperature !== undefined || updated.humidity !== undefined) {
      setHistory((prevHistory) => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayStr = days[now.getDay()];
        const dateStr = now.toLocaleDateString('th-TH');

        const newPoint = {
          id: `sim_${Date.now()}`,
          timestamp: now.getTime(),
          time: timeStr,
          day: dayStr,
          dateStr: dateStr,
          temperature: updated.temperature !== undefined ? updated.temperature : telemetry.temperature,
          tempMin: telemetry.tempTarget - telemetry.tempTolerance,
          tempMax: telemetry.tempTarget + telemetry.tempTolerance,
          humidity: updated.humidity !== undefined ? updated.humidity : telemetry.humidity,
          humMin: telemetry.humidityTarget - telemetry.humidityTolerance,
          humMax: telemetry.humidityTarget + telemetry.humidityTolerance,
        };
        // อัปเดตกราฟจำลองพร้อมป้องกัน Memory Leak ด้วย Limit ข้อมูล 7 วัน
        return [...prevHistory, newPoint].slice(-MAX_HISTORY_POINTS);
      });
    }
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-5 space-y-4">
            <ClockCard
              isDark={isDark}
              clockLogoUrl={logoSettings.clockLogoUrl}
              onUpdateClockLogo={(url) => handleUpdateLogoSettings({ clockLogoUrl: url })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {widgets
                .filter((w) => w.visible)
                .map((widget) => {
                  const rawVal = telemetry[widget.key as keyof TelemetryData];
                  const displayVal = typeof rawVal === 'number' ? rawVal.toFixed(1) : (0).toFixed(1);

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

          <div className="lg:col-span-7">
            {/* ✅ 5. ส่งผ่าน containerRef ไปให้ ChartSection จัดการ */}
            <ChartSection
              containerRef={chartRef}
              history={history}
              telemetry={telemetry}
              isDark={isDark}
              onManualExportSaved={handleManualExportSaved}
              onAutoResetWeekly={handleAutoResetWeekly}
            />
          </div>
        </div>
      </div>

      <AutoExportManager
        isOpen={isAutoExportOpen}
        onClose={() => setIsAutoExportOpen(false)}
        exportSettings={exportSettings}
        onUpdateSettings={setExportSettings}
        exportHistory={exportHistory}
        onClearHistory={() => setExportHistory([])}
        onManualExport={() => {
          setIsAutoExportOpen(false);
          const chartElement = chartRef.current;
          if (chartElement) {
            toPng(chartElement, { cacheBust: true, quality: 0.95 }).then((url) => {
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