import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Brush
} from 'recharts';
import { Globe, Clock, Camera, CheckCircle2 } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { HistoryPoint, TelemetryData } from '../types';

interface ChartSectionProps {
  history: HistoryPoint[];
  telemetry: TelemetryData;
  isDark?: boolean;
  onManualExportSaved?: (imageData: string, title: string) => void;
}

// Map English days to Thai abbreviations
const THAI_DAYS: Record<string, string> = {
  Sun: 'อา.', Mon: 'จ.', Tue: 'อ.', Wed: 'พ.', Thu: 'พฤ.', Fri: 'ศ.', Sat: 'ส.'
};

// Custom renderers for MIN and MAX labels
const renderMaxLabel = (props: any) => {
  const { viewBox } = props;
  if (!viewBox) return null;
  return (
    <text x={viewBox.x + 12} y={viewBox.y - 6} fill="#EF4444" fontSize={11} fontWeight="bold" textAnchor="start">
      MAX
    </text>
  );
};

const renderMinLabel = (props: any) => {
  const { viewBox } = props;
  if (!viewBox) return null;
  return (
    <text x={viewBox.x + 12} y={viewBox.y + 16} fill="#EF4444" fontSize={11} fontWeight="bold" textAnchor="start">
      MIN
    </text>
  );
};

interface BoundsSegment {
  type: 'max' | 'min';
  startKey: string;
  endKey: string;
  peakValue: number;
}

// Calculate time periods exceeding max or falling below min
const getBoundsSegments = (data: any[], key: string, minLimit: number, maxLimit: number): BoundsSegment[] => {
  const segments: BoundsSegment[] = [];
  let currentSeg: BoundsSegment | null = null;

  data.forEach((pt) => {
    const val = pt[key];
    if (val === null || val === undefined) {
      if (currentSeg) { segments.push(currentSeg); currentSeg = null; }
      return;
    }
    
    if (val > maxLimit) {
      if (!currentSeg || currentSeg.type !== 'max') {
        if (currentSeg) segments.push(currentSeg);
        currentSeg = { type: 'max', startKey: pt.xKey, endKey: pt.xKey, peakValue: val };
      } else {
        currentSeg.endKey = pt.xKey;
        currentSeg.peakValue = Math.max(currentSeg.peakValue, val);
      }
    } else if (val < minLimit) {
      if (!currentSeg || currentSeg.type !== 'min') {
        if (currentSeg) segments.push(currentSeg);
        currentSeg = { type: 'min', startKey: pt.xKey, endKey: pt.xKey, peakValue: val };
      } else {
        currentSeg.endKey = pt.xKey;
        currentSeg.peakValue = Math.min(currentSeg.peakValue, val);
      }
    } else {
      if (currentSeg) { segments.push(currentSeg); currentSeg = null; }
    }
  });

  if (currentSeg) segments.push(currentSeg);
  return segments;
};

export const ChartSection: React.FC<ChartSectionProps> = ({
  history,
  telemetry,
  isDark = true,
  onManualExportSaved,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 0 });

  // Filter history based on timeRange
  const filteredHistory = useMemo(() => {
    let baseData = history;
    if (timeRange === 'today') {
      baseData = history.slice(-24);
    } else if (timeRange === 'week') {
      baseData = history.slice(-7 * 24 > history.length ? -history.length : -168);
    }
    return baseData;
  }, [history, timeRange]);

  // Enrich data with unique xKeys and handle Data Gaps (> 15 mins)
  const chartData = useMemo(() => {
    const dataWithGaps: any[] = [];
    filteredHistory.forEach((pt, idx) => {
      dataWithGaps.push({ ...pt, xKey: `k_${idx}_${pt.day}` });
      
      if (idx < filteredHistory.length - 1) {
        const nextPt = filteredHistory[idx + 1];
        const t1 = new Date(`${pt.dateStr} ${pt.time}`).getTime();
        const t2 = new Date(`${nextPt.dateStr} ${nextPt.time}`).getTime();
        
        if ((t2 - t1) > 15 * 60 * 1000) {
          dataWithGaps.push({ xKey: `gap_${idx}`, temperature: null, humidity: null });
        }
      }
    });
    return dataWithGaps;
  }, [filteredHistory]);

  // Reset Brush Range when chart data size changes (e.g. initial load or range change)
  useEffect(() => {
    if (chartData.length > 0) {
      setBrushRange({ startIndex: 0, endIndex: chartData.length - 1 });
    }
  }, [chartData.length]);

  const tempTarget = telemetry.tempTarget || 23;
  const tempTol = telemetry.tempTolerance || 3;
  const tempMin = tempTarget - tempTol;
  const tempMax = tempTarget + tempTol;

  const humTarget = telemetry.humidityTarget || 55;
  const humTol = telemetry.humidityTolerance || 15;
  const humMin = humTarget - humTol;
  const humMax = humTarget + humTol;

  const tempSegments = useMemo(() => getBoundsSegments(chartData, 'temperature', tempMin, tempMax), [chartData, tempMin, tempMax]);
  const humSegments = useMemo(() => getBoundsSegments(chartData, 'humidity', humMin, humMax), [chartData, humMin, humMax]);

  const handleOdooClick = () => {
    window.open('https://erp.nacal.co.th/web#action=514&cids=1&menu_id=368&model=job.order&view_type=list', '_blank');
  };

  const handleExportImage = async (format: 'png' | 'jpeg' = 'png') => {
    if (!chartContainerRef.current) return;
    setIsExporting(true);
    setExportSuccessMsg(null);

    try {
      const dataUrl = format === 'png'
          ? await toPng(chartContainerRef.current, { cacheBust: true, quality: 0.95 })
          : await toJpeg(chartContainerRef.current, { cacheBust: true, quality: 0.95 });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `IoT_Calibration_Graph_${timestamp}.${format}`;
      link.href = dataUrl;
      link.click();

      if (onManualExportSaved) {
        onManualExportSaved(dataUrl, `Manual Chart Export (${format.toUpperCase()})`);
      }

      setExportSuccessMsg(`ส่งออกรูปภาพสำเร็จ (${format.toUpperCase()})`);
      setTimeout(() => setExportSuccessMsg(null), 3500);
    } catch (error) {
      console.error('Export chart failed:', error);
      alert('เกิดข้อผิดพลาดในการส่งออกรูปภาพกราฟ');
    } finally {
      setIsExporting(false);
    }
  };

  // Smart tick formatter for adaptive XAxis (Zoomed vs Unzoomed)
  const formatAdaptiveXAxisTick = (val: any, index: number) => {
    if (typeof val === 'string' && val.includes('gap')) return '';
    const pt = chartData[index];
    if (!pt || !pt.time) return '';

    const visibleCount = brushRange.endIndex - brushRange.startIndex;
    const totalCount = chartData.length;
    
    // หากซูมเข้ามาลึกเกิน 40% ของข้อมูลทั้งหมด จะถือว่าอยู่ในโหมด "ซูมดูรายละเอียด"
    const isZoomed = totalCount > 0 && visibleCount < (totalCount * 0.4);
    
    const dayTh = THAI_DAYS[pt.day] || pt.day;
    const timeShort = pt.time.substring(0, 5); // "17:32"

    if (isZoomed) {
      // โหมดซูม: แสดง วัน + เวลาละเอียด หรือเฉพาะเวลาถ้าซูมลึกมาก
      if (visibleCount < totalCount * 0.15) return timeShort;
      return `${dayTh} ${timeShort}`;
    } else {
      // โหมดปกติ (ไม่ซูม): ล็อกแสดงเฉพาะ วัน(จ.,อ.,...) และเวลา 06:00, 12:00, 18:00
      const hour = parseInt(pt.time.split(':')[0], 10);
      const prevPt = index > 0 ? chartData[index - 1] : null;
      const prevHour = prevPt && prevPt.time ? parseInt(prevPt.time.split(':')[0], 10) : -1;
      
      const isNewDay = index === 0 || (prevPt && pt.day !== prevPt.day);
      
      if (isNewDay) return dayTh;
      if (prevHour < 6 && hour >= 6) return '06:00';
      if (prevHour < 12 && hour >= 12) return '12:00';
      if (prevHour < 18 && hour >= 18) return '18:00';
      
      return ''; // ซ่อน Tick อื่นๆ เพื่อให้กราฟดูคลีนเหมือนในรูปตัวอย่าง
    }
  };

  return (
    <div
      ref={chartContainerRef}
      id="iot-chart-section"
      className={`flex flex-col p-5 rounded-xl border transition-all duration-300 ${
        isDark
          ? 'bg-[#0B1329]/95 border-blue-600/60 shadow-[0_4px_20px_rgba(15,23,42,0.7)] text-white'
          : 'bg-white border-blue-200 shadow-xl text-slate-900'
      }`}
    >
      {/* Top Controls Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pb-4 mb-3 border-b ${isDark ? 'border-blue-900/40' : 'border-slate-200'}`}>
        <div className="flex items-center space-x-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${isDark ? 'bg-blue-950 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-900'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Realtime Chart Stream
          </span>
          {exportSuccessMsg && (
            <span className="text-xs font-semibold px-3 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1.5 animate-bounce">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {exportSuccessMsg}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center p-0.5 rounded-lg border text-xs font-semibold ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
            <button onClick={() => setTimeRange('today')} className={`px-2 py-1 rounded ${timeRange === 'today' ? 'bg-blue-600 text-white font-bold shadow' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              วันนี้ (Today)
            </button>
            <button onClick={() => setTimeRange('week')} className={`px-2 py-1 rounded ${timeRange === 'week' ? 'bg-blue-600 text-white font-bold shadow' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              7 วัน (1 Week)
            </button>
            <button onClick={() => setTimeRange('month')} className={`px-2 py-1 rounded ${timeRange === 'month' ? 'bg-blue-600 text-white font-bold shadow' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
              30 วัน (1 Month)
            </button>
          </div>

          <button onClick={handleOdooClick} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-600 text-white border border-blue-400 transition-all shadow-sm">
            <Globe className="w-3.5 h-3.5" />
            <span>Odoo</span>
          </button>

          <button onClick={() => setAutoMode(!autoMode)} className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm ${autoMode ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>Auto</span>
          </button>

          <button onClick={() => handleExportImage('png')} disabled={isExporting} className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-md transition-all active:scale-95 disabled:opacity-50">
            <Camera className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Graph Image'}</span>
          </button>
        </div>
      </div>

      {/* CHART 1: Temperature */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2">
            <h4 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Temperature <span className="text-xl">🌡️</span> <span className={`font-extrabold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{tempTarget} ±{tempTol}°C</span>
            </h4>
          </div>
          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5"><span className="w-3.5 h-2.5 rounded bg-blue-600"></span><span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Temperature (°C)</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-3 h-0.5 bg-red-500"></span><span className="text-red-500 font-bold">MIN ({tempMin}°C)</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-3 h-0.5 bg-red-500"></span><span className="text-red-500 font-bold">MAX ({tempMax}°C)</span></div>
          </div>
        </div>

        <div className={`w-full h-64 rounded-lg p-2 border transition-colors ${isDark ? 'bg-[#070D1E] border-blue-900/50' : 'bg-slate-50 border-slate-300'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 30, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} opacity={0.8} />
              
              <XAxis 
                dataKey="xKey" 
                reversed={true} /* เพิ่มคำสั่งสลับทิศทาง ขวาไปซ้าย */
                tickFormatter={formatAdaptiveXAxisTick} 
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 10, fontWeight: 'bold' }} 
                stroke={isDark ? '#334155' : '#CBD5E1'} 
                minTickGap={10} 
              />
              <YAxis domain={[18, 34]} tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 11, fontWeight: 'bold' }} stroke={isDark ? '#334155' : '#CBD5E1'} />
              
              <Tooltip 
                contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: '#2563EB', borderRadius: '8px', color: isDark ? '#FFF' : '#0F172A', fontSize: '12px' }}
                formatter={(val: any) => [`${val} °C`, 'Temperature']}
                labelFormatter={(label, items) => {
                  const pt = items[0]?.payload;
                  return pt && pt.time ? `⏱️ เวลา: ${pt.time} น. (${pt.day} - ${pt.dateStr})` : label;
                }}
              />
              
              {tempSegments.map((seg, idx) => (
                <React.Fragment key={`temp-seg-${idx}`}>
                  <ReferenceArea x1={seg.startKey} x2={seg.endKey} fill={seg.type === 'max' ? '#EF4444' : '#3B82F6'} fillOpacity={0.15} />
                  <ReferenceArea
                    x1={seg.startKey} x2={seg.endKey}
                    y1={seg.type === 'max' ? tempMax : tempMin}
                    y2={seg.type === 'max' ? Math.min(seg.peakValue + 1.8, 33.5) : Math.max(seg.peakValue - 1.8, 18.5)}
                    stroke={seg.type === 'max' ? '#EF4444' : '#3B82F6'} strokeWidth={2} fill="none"
                    label={{ position: seg.type === 'max' ? 'top' : 'bottom', value: 'No Activity', fill: seg.type === 'max' ? '#EF4444' : '#3B82F6', fontSize: 12, fontWeight: 'bold' }}
                  />
                </React.Fragment>
              ))}

              <ReferenceLine y={tempMin} stroke="#EF4444" strokeWidth={2} label={renderMinLabel} />
              <ReferenceLine y={tempMax} stroke="#EF4444" strokeWidth={2} label={renderMaxLabel} />
              
              <Line type="monotone" connectNulls={false} dataKey="temperature" stroke="#2563EB" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#60A5FA' }} />
              
              <Brush dataKey="xKey" height={25} stroke="#2563EB" fill={isDark ? '#0F172A' : '#F1F5F9'} tickFormatter={() => ''} onChange={(range: any) => setBrushRange(range)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART 2: Humidity */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2">
            <h4 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Humidity <span className="text-xl">💧</span> <span className={`font-extrabold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{humTarget} ±{humTol}%</span>
            </h4>
          </div>
          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5"><span className="w-3.5 h-2.5 rounded bg-blue-600"></span><span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Humidity (%)</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-3 h-0.5 bg-red-500"></span><span className="text-red-500 font-bold">MIN ({humMin}%)</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-3 h-0.5 bg-red-500"></span><span className="text-red-500 font-bold">MAX ({humMax}%)</span></div>
          </div>
        </div>

        <div className={`w-full h-64 rounded-lg p-2 border transition-colors ${isDark ? 'bg-[#070D1E] border-blue-900/50' : 'bg-slate-50 border-slate-300'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 30, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} opacity={0.8} />
              
              <XAxis 
                dataKey="xKey" 
                reversed={true} /* เพิ่มคำสั่งสลับทิศทาง ขวาไปซ้าย */
                tickFormatter={formatAdaptiveXAxisTick} 
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 10, fontWeight: 'bold' }} 
                stroke={isDark ? '#334155' : '#CBD5E1'} 
                minTickGap={10} 
              />
              <YAxis domain={[30, 95]} tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 11, fontWeight: 'bold' }} stroke={isDark ? '#334155' : '#CBD5E1'} />
              
              <Tooltip 
                contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: '#0284C7', borderRadius: '8px', color: isDark ? '#FFF' : '#0F172A', fontSize: '12px' }}
                formatter={(val: any) => [`${val} %`, 'Humidity']}
                labelFormatter={(label, items) => {
                  const pt = items[0]?.payload;
                  return pt && pt.time ? `⏱️ เวลา: ${pt.time} น. (${pt.day} - ${pt.dateStr})` : label;
                }}
              />

              {humSegments.map((seg, idx) => (
                <React.Fragment key={`hum-seg-${idx}`}>
                  <ReferenceArea x1={seg.startKey} x2={seg.endKey} fill={seg.type === 'max' ? '#EF4444' : '#3B82F6'} fillOpacity={0.15} />
                  <ReferenceArea
                    x1={seg.startKey} x2={seg.endKey}
                    y1={seg.type === 'max' ? humMax : humMin}
                    y2={seg.type === 'max' ? Math.min(seg.peakValue + 4, 94) : Math.max(seg.peakValue - 4, 31)}
                    stroke={seg.type === 'max' ? '#EF4444' : '#3B82F6'} strokeWidth={2} fill="none"
                    label={{ position: seg.type === 'max' ? 'top' : 'bottom', value: 'No Activity', fill: seg.type === 'max' ? '#EF4444' : '#3B82F6', fontSize: 12, fontWeight: 'bold' }}
                  />
                </React.Fragment>
              ))}

              <ReferenceLine y={humMin} stroke="#EF4444" strokeWidth={2} label={renderMinLabel} />
              <ReferenceLine y={humMax} stroke="#EF4444" strokeWidth={2} label={renderMaxLabel} />
              
              <Line type="monotone" connectNulls={false} dataKey="humidity" stroke="#0284C7" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#7DD3FC' }} />
              
              <Brush dataKey="xKey" height={25} stroke="#0284C7" fill={isDark ? '#0F172A' : '#F1F5F9'} tickFormatter={() => ''} onChange={(range: any) => setBrushRange(range)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};