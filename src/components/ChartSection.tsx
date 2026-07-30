import React, { useRef, useState } from 'react';
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

// Custom renderers for MIN (below line) and MAX (above line) labels to prevent any overlapping
const renderMaxLabel = (props: any) => {
  const { viewBox } = props;
  if (!viewBox) return null;
  return (
    <text
      x={viewBox.x + 12}
      y={viewBox.y - 6}
      fill="#EF4444"
      fontSize={11}
      fontWeight="bold"
      textAnchor="start"
    >
      MAX
    </text>
  );
};

const renderMinLabel = (props: any) => {
  const { viewBox } = props;
  if (!viewBox) return null;
  return (
    <text
      x={viewBox.x + 12}
      y={viewBox.y + 16}
      fill="#EF4444"
      fontSize={11}
      fontWeight="bold"
      textAnchor="start"
    >
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

// Calculate contiguous time periods where value exceeds max limit or falls below min limit
const getBoundsSegments = (
  data: any[],
  key: string,
  minLimit: number,
  maxLimit: number
): BoundsSegment[] => {
  const segments: BoundsSegment[] = [];
  let currentSeg: BoundsSegment | null = null;

  data.forEach((pt) => {
    const val = pt[key];
    if (val === null || val === undefined) {
      if (currentSeg) {
        segments.push(currentSeg);
        currentSeg = null;
      }
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
      if (currentSeg) {
        segments.push(currentSeg);
        currentSeg = null;
      }
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

  // Filter history based on timeRange
  const filteredHistory = React.useMemo(() => {
    let baseData = history;
    if (timeRange === 'today') {
      baseData = history.slice(-24);
    } else if (timeRange === 'week') {
      baseData = history.slice(-7 * 24 > history.length ? -history.length : -168);
    }
    return baseData;
  }, [history, timeRange]);

  // Enrich data with unique xKeys and handle Data Gaps (> 15 mins)
  const chartData = React.useMemo(() => {
    const dataWithGaps: any[] = [];
    filteredHistory.forEach((pt, idx) => {
      dataWithGaps.push({ ...pt, xKey: `k_${idx}_${pt.day}` });
      
      // เช็คว่าถ้าไม่ใช่ข้อมูลจุดสุดท้าย ให้เปรียบเทียบเวลากับจุดถัดไป
      if (idx < filteredHistory.length - 1) {
        const nextPt = filteredHistory[idx + 1];
        const t1 = new Date(`${pt.dateStr} ${pt.time}`).getTime();
        const t2 = new Date(`${nextPt.dateStr} ${nextPt.time}`).getTime();
        
        // หากเวลาห่างกันเกิน 15 นาที ให้แทรกค่า null เพื่อให้กราฟขาด
        if ((t2 - t1) > 15 * 60 * 1000) {
          dataWithGaps.push({ xKey: `gap_${idx}`, temperature: null, humidity: null });
        }
      }
    });
    return dataWithGaps;
  }, [filteredHistory]);

  // Temperature target & boundaries
  const tempTarget = telemetry.tempTarget || 23;
  const tempTol = telemetry.tempTolerance || 3;
  const tempMin = tempTarget - tempTol; // 20°C
  const tempMax = tempTarget + tempTol; // 26°C

  // Humidity target & boundaries
  const humTarget = telemetry.humidityTarget || 55;
  const humTol = telemetry.humidityTolerance || 15;
  const humMin = humTarget - humTol; // 40%
  const humMax = humTarget + humTol; // 70%

  // Compute bound segments for temperature and humidity
  const tempSegments = React.useMemo(() => {
    return getBoundsSegments(chartData, 'temperature', tempMin, tempMax);
  }, [chartData, tempMin, tempMax]);

  const humSegments = React.useMemo(() => {
    return getBoundsSegments(chartData, 'humidity', humMin, humMax);
  }, [chartData, humMin, humMax]);

  // Odoo direct link click
  const handleOdooClick = () => {
    window.open(
      'https://erp.nacal.co.th/web#action=514&cids=1&menu_id=368&model=job.order&view_type=list',
      '_blank'
    );
  };

  // Manual export chart image function
  const handleExportImage = async (format: 'png' | 'jpeg' = 'png') => {
    if (!chartContainerRef.current) return;
    setIsExporting(true);
    setExportSuccessMsg(null);

    try {
      const dataUrl =
        format === 'png'
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
      <div
        className={`flex flex-wrap items-center justify-between gap-2 pb-4 mb-3 border-b ${
          isDark ? 'border-blue-900/40' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
              isDark
                ? 'bg-blue-950 border-blue-700 text-blue-300'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
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

        {/* Action buttons: Odoo, Date Filters, Auto, Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div
            className={`flex items-center p-0.5 rounded-lg border text-xs font-semibold ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'
            }`}
          >
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2 py-1 rounded ${
                timeRange === 'today'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              วันนี้ (Today)
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-2 py-1 rounded ${
                timeRange === 'week'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 วัน (1 Week)
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-2 py-1 rounded ${
                timeRange === 'month'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 วัน (1 Month)
            </button>
          </div>

          {/* Odoo Direct Link Button */}
          <button
            onClick={handleOdooClick}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-600 text-white border border-blue-400 transition-all shadow-sm cursor-pointer"
            title="Open Odoo Job Order System"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Odoo</span>
          </button>

          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm ${
              autoMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Auto</span>
          </button>

          {/* Export Graph Image Button */}
          <button
            onClick={() => handleExportImage('png')}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Export Graph Image (.PNG)"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Graph Image'}</span>
          </button>
        </div>
      </div>

      {/* CHART 1: Temperature */}
      <div className="mb-6">
        {/* Chart Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2">
            <h4
              className={`text-xl font-bold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Temperature <span className="text-xl">🌡️</span>{' '}
              <span
                className={`font-extrabold ${
                  isDark ? 'text-blue-300' : 'text-blue-700'
                }`}
              >
                {tempTarget} ±{tempTol}°C
              </span>
            </h4>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-2.5 rounded bg-blue-600"></span>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                Temperature (°C)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 bg-red-500"></span>
              <span className="text-red-500 font-bold">MIN ({tempMin}°C)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 bg-red-500"></span>
              <span className="text-red-500 font-bold">MAX ({tempMax}°C)</span>
            </div>
          </div>
        </div>

        {/* Temperature Recharts Area */}
        <div
          className={`w-full h-64 rounded-lg p-2 border transition-colors ${
            isDark
              ? 'bg-[#070D1E] border-blue-900/50'
              : 'bg-slate-50 border-slate-300'
          }`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 30, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#1E293B' : '#E2E8F0'}
                opacity={0.8}
              />
              <XAxis
                dataKey="xKey"
                tickFormatter={(val, index) => {
                  if (typeof val === 'string' && val.includes('gap')) return '';
                  const pt = chartData[index];
                  if (pt && pt.time) {
                    return `${pt.day} (${pt.time})`;
                  }
                  return pt ? pt.day : val;
                }}
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 10, fontWeight: 'bold' }}
                stroke={isDark ? '#334155' : '#CBD5E1'}
              />
              <YAxis
                domain={[18, 34]}
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 11, fontWeight: 'bold' }}
                stroke={isDark ? '#334155' : '#CBD5E1'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                  borderColor: '#2563EB',
                  borderRadius: '8px',
                  color: isDark ? '#FFF' : '#0F172A',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                formatter={(val: any) => [`${val} °C`, 'Temperature']}
                labelFormatter={(label, items) => {
                  const pt = items[0]?.payload;
                  return pt && pt.time ? `⏱️ เวลา: ${pt.time} น. (${pt.day} - ${pt.dateStr})` : label;
                }}
              />
              
              {/* Red/Blue Bounding Frame Area across time periods exceeding limits */}
              {tempSegments.map((seg, idx) => (
                <React.Fragment key={`temp-seg-${idx}`}>
                  <ReferenceArea
                    x1={seg.startKey}
                    x2={seg.endKey}
                    fill={seg.type === 'max' ? '#EF4444' : '#3B82F6'}
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={seg.startKey}
                    x2={seg.endKey}
                    y1={seg.type === 'max' ? tempMax : tempMin}
                    y2={seg.type === 'max' ? Math.min(seg.peakValue + 1.8, 33.5) : Math.max(seg.peakValue - 1.8, 18.5)}
                    stroke={seg.type === 'max' ? '#EF4444' : '#3B82F6'}
                    strokeWidth={2}
                    fill="none"
                    label={{
                      position: seg.type === 'max' ? 'top' : 'bottom',
                      value: 'No Activity',
                      fill: seg.type === 'max' ? '#EF4444' : '#3B82F6',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}
                  />
                </React.Fragment>
              ))}

              {/* Threshold Reference Lines MIN (label below line) and MAX (label above line) */}
              <ReferenceLine
                y={tempMin}
                stroke="#EF4444"
                strokeWidth={2}
                label={renderMinLabel}
              />
              <ReferenceLine
                y={tempMax}
                stroke="#EF4444"
                strokeWidth={2}
                label={renderMaxLabel}
              />
              <Line
                type="monotone"
                connectNulls={false}
                dataKey="temperature"
                stroke="#2563EB"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#60A5FA' }}
              />

              {/* ແถบลากซูมดูกราฟ (Brush) */}
              <Brush dataKey="xKey" height={25} stroke="#2563EB" fill={isDark ? '#0F172A' : '#F1F5F9'} tickFormatter={() => ''} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART 2: Humidity */}
      <div>
        {/* Chart Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2">
            <h4
              className={`text-xl font-bold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Humidity <span className="text-xl">💧</span>{' '}
              <span
                className={`font-extrabold ${
                  isDark ? 'text-blue-300' : 'text-blue-700'
                }`}
              >
                {humTarget} ±{humTol}%
              </span>
            </h4>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-2.5 rounded bg-blue-600"></span>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                Humidity (%)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 bg-red-500"></span>
              <span className="text-red-500 font-bold">MIN ({humMin}%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-0.5 bg-red-500"></span>
              <span className="text-red-500 font-bold">MAX ({humMax}%)</span>
            </div>
          </div>
        </div>

        {/* Humidity Recharts Area */}
        <div
          className={`w-full h-64 rounded-lg p-2 border transition-colors ${
            isDark
              ? 'bg-[#070D1E] border-blue-900/50'
              : 'bg-slate-50 border-slate-300'
          }`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 30, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#1E293B' : '#E2E8F0'}
                opacity={0.8}
              />
              <XAxis
                dataKey="xKey"
                tickFormatter={(val, index) => {
                  if (typeof val === 'string' && val.includes('gap')) return '';
                  const pt = chartData[index];
                  if (pt && pt.time) {
                    return `${pt.day} (${pt.time})`;
                  }
                  return pt ? pt.day : val;
                }}
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 10, fontWeight: 'bold' }}
                stroke={isDark ? '#334155' : '#CBD5E1'}
              />
              <YAxis
                domain={[30, 95]}
                tick={{ fill: isDark ? '#94A3B8' : '#334155', fontSize: 11, fontWeight: 'bold' }}
                stroke={isDark ? '#334155' : '#CBD5E1'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                  borderColor: '#0284C7',
                  borderRadius: '8px',
                  color: isDark ? '#FFF' : '#0F172A',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                formatter={(val: any) => [`${val} %`, 'Humidity']}
                labelFormatter={(label, items) => {
                  const pt = items[0]?.payload;
                  return pt && pt.time ? `⏱️ เวลา: ${pt.time} น. (${pt.day} - ${pt.dateStr})` : label;
                }}
              />

              {/* Red/Blue Bounding Frame Area across time periods exceeding limits */}
              {humSegments.map((seg, idx) => (
                <React.Fragment key={`hum-seg-${idx}`}>
                  <ReferenceArea
                    x1={seg.startKey}
                    x2={seg.endKey}
                    fill={seg.type === 'max' ? '#EF4444' : '#3B82F6'}
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={seg.startKey}
                    x2={seg.endKey}
                    y1={seg.type === 'max' ? humMax : humMin}
                    y2={seg.type === 'max' ? Math.min(seg.peakValue + 4, 94) : Math.max(seg.peakValue - 4, 31)}
                    stroke={seg.type === 'max' ? '#EF4444' : '#3B82F6'}
                    strokeWidth={2}
                    fill="none"
                    label={{
                      position: seg.type === 'max' ? 'top' : 'bottom',
                      value: 'No Activity',
                      fill: seg.type === 'max' ? '#EF4444' : '#3B82F6',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}
                  />
                </React.Fragment>
              ))}

              {/* Threshold Reference Lines MIN (label below line) and MAX (label above line) */}
              <ReferenceLine
                y={humMin}
                stroke="#EF4444"
                strokeWidth={2}
                label={renderMinLabel}
              />
              <ReferenceLine
                y={humMax}
                stroke="#EF4444"
                strokeWidth={2}
                label={renderMaxLabel}
              />
              <Line
                type="monotone"
                connectNulls={false}
                dataKey="humidity"
                stroke="#0284C7"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#7DD3FC' }}
              />

              {/* แถบลากซูมดูกราฟ (Brush) */}
              <Brush dataKey="xKey" height={25} stroke="#0284C7" fill={isDark ? '#0F172A' : '#F1F5F9'} tickFormatter={() => ''} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};