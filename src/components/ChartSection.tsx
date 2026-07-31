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
  startKey: number;
  endKey: number;
  peakValue: number;
}

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
        currentSeg = { type: 'max', startKey: pt.hourOffset, endKey: pt.hourOffset, peakValue: val };
      } else {
        currentSeg.endKey = pt.hourOffset;
        currentSeg.peakValue = Math.max(currentSeg.peakValue, val);
      }
    } else if (val < minLimit) {
      if (!currentSeg || currentSeg.type !== 'min') {
        if (currentSeg) segments.push(currentSeg);
        currentSeg = { type: 'min', startKey: pt.hourOffset, endKey: pt.hourOffset, peakValue: val };
      } else {
        currentSeg.endKey = pt.hourOffset;
        currentSeg.peakValue = Math.min(currentSeg.peakValue, val);
      }
    } else {
      if (currentSeg) { segments.push(currentSeg); currentSeg = null; }
    }
  });

  if (currentSeg) segments.push(currentSeg);
  return segments;
};

const dayMap: Record<string, number> = {
  'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6,
  'จ.': 0, 'อ.': 1, 'พ.': 2, 'พฤ.': 3, 'ศ.': 4, 'ส.': 5, 'อา.': 6,
  'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6
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
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 0 });

  const chartData = useMemo(() => {
    const dataPoints: any[] = [];
    const daysWithData = new Set<number>();

    // หาว่าวันไหน (0-6) ที่มีข้อมูลส่งเข้ามาบ้าง
    history.forEach((pt) => {
      daysWithData.add(dayMap[pt.day] ?? 0);
    });

    // 1. เติมกรอบเวลา (Grid) เฉพาะ "วันที่ไม่มีข้อมูล" เพื่อตัดเส้นกราฟไม่ให้ลากข้ามวัน 
    // และบังคับให้กราฟมีจุดหนาแน่นพอที่แกน Y และระบบ Zoom จะทำงานได้ตามปกติ
    for (let day = 0; day < 7; day++) {
      if (!daysWithData.has(day)) {
        for (let hour = 0; hour < 24; hour += 0.5) {
          dataPoints.push({
            hourOffset: day * 24 + hour,
            temperature: null,
            humidity: null,
            time: '',
            day: '',
            dateStr: ''
          });
        }
      }
    }

    // 2. เติมข้อมูลจริงจาก History โดยใช้เวลาเป๊ะๆ (ไม่ปัดเศษ)
    history.forEach((pt) => {
      const dayIdx = dayMap[pt.day] ?? 0;
      const [hh, mm] = (pt.time || '00:00').split(':').map(Number);
      const hourOffset = dayIdx * 24 + (hh || 0) + (mm || 0) / 60;
      
      if (hourOffset >= 0 && hourOffset <= 168) {
        dataPoints.push({
          hourOffset: hourOffset,
          temperature: pt.temperature,
          humidity: pt.humidity,
          time: pt.time,
          day: pt.day,
          dateStr: pt.dateStr
        });
      }
    });

    // ล็อกหัวท้ายตายตัว 0 และ 168 เพื่อบังคับให้แสดงกรอบ 7 วันเสมอ
    dataPoints.push({ hourOffset: 0, temperature: null, humidity: null, time: '', day: '', dateStr: '' });
    dataPoints.push({ hourOffset: 168, temperature: null, humidity: null, time: '', day: '', dateStr: '' });

    // เรียงลำดับจากเวลาน้อยไปมาก
    const sorted = dataPoints.sort((a, b) => a.hourOffset - b.hourOffset);

    // กรองจุดที่เวลาซ้ำกันออก (ป้องกันบั๊กเวลากด Simulator รัวๆ ในนาทีเดียวกัน)
    const unique = [];
    let lastOffset = -1;
    for (const pt of sorted) {
      if (pt.hourOffset !== lastOffset) {
        unique.push(pt);
        lastOffset = pt.hourOffset;
      }
    }

    return unique;
  }, [history]);

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

  const visibleRange = brushRange.endIndex - brushRange.startIndex;
  const isZoomed = chartData.length > 10 && visibleRange < (chartData.length * 0.8);

  const formatAdaptiveXAxisTick = (val: any) => {
    const dayIdx = Math.floor(val / 24);
    const hour = Math.floor(val % 24);
    const labels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์', ''];
    
    if (!isZoomed || (hour === 0 && val % 1 === 0)) {
       return labels[dayIdx] || '';
    }
    return `${String(hour).padStart(2, '0')}:00`;
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
            <button disabled className="px-2 py-1 rounded text-slate-500 cursor-not-allowed opacity-50">
              วันนี้ (Today)
            </button>
            <button className="px-2 py-1 rounded bg-blue-600 text-white font-bold shadow cursor-default">
              7 วัน (1 Week)
            </button>
            <button disabled className="px-2 py-1 rounded text-slate-500 cursor-not-allowed opacity-50">
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
                type="number"
                dataKey="hourOffset" 
                domain={[0, 168]} 
                ticks={[0, 24, 48, 72, 96, 120, 144, 168]}
                tickFormatter={formatAdaptiveXAxisTick} 
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 10, fontWeight: 'bold' }} 
                stroke={isDark ? '#334155' : '#CBD5E1'} 
              />
              <YAxis 
                domain={[18, 32]} 
                ticks={[18, 20, 22, 24, 26, 28, 30, 32]} 
                interval={0}
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 11, fontWeight: 'bold' }} 
                stroke={isDark ? '#334155' : '#CBD5E1'} 
              />
              
              <Tooltip 
                contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: '#2563EB', borderRadius: '8px', color: isDark ? '#FFF' : '#0F172A', fontSize: '12px' }}
                formatter={(val: any) => [`${val} °C`, 'Temperature']}
                labelFormatter={(label, items) => {
                  const pt = items[0]?.payload;
                  if (!pt || !pt.time) return `ชั่วโมงที่: ${label}`;
                  return `⏱️ เวลา: ${pt.time} น. (${pt.day} ${pt.dateStr ? '- ' + pt.dateStr : ''})`;
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
              
              <Brush dataKey="hourOffset" height={25} stroke="#2563EB" fill={isDark ? '#0F172A' : '#F1F5F9'} tickFormatter={() => ''} onChange={(range: any) => setBrushRange(range)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                type="number"
                dataKey="hourOffset" 
                domain={[0, 168]} 
                ticks={[0, 24, 48, 72, 96, 120, 144, 168]}
                tickFormatter={formatAdaptiveXAxisTick} 
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 10, fontWeight: 'bold' }} 
                stroke={isDark ? '#334155' : '#CBD5E1'} 
              />
              <YAxis 
                domain={[30, 90]} 
                ticks={[30, 40, 50, 60, 70, 80, 90]} 
                interval={0}
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 11, fontWeight: 'bold' }} 
                stroke={isDark ? '#334155' : '#CBD5E1'} 
              />
              
              <Tooltip 
                contentStyle={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: '#0284C7', borderRadius: '8px', color: isDark ? '#FFF' : '#0F172A', fontSize: '12px' }}
                formatter={(val: any) => [`${val} %`, 'Humidity']}
                labelFormatter={(label, items) => {
                  const pt = items[0]?.payload;
                  if (!pt || !pt.time) return `ชั่วโมงที่: ${label}`;
                  return `⏱️ เวลา: ${pt.time} น. (${pt.day} ${pt.dateStr ? '- ' + pt.dateStr : ''})`;
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
              
              <Brush dataKey="hourOffset" height={25} stroke="#0284C7" fill={isDark ? '#0F172A' : '#F1F5F9'} tickFormatter={() => ''} onChange={(range: any) => setBrushRange(range)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};