import React, { useState, useEffect } from 'react';
import { Camera, Clock, Download, Image as ImageIcon, Trash2, Check, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AutoExportSettings, ExportHistoryItem } from '../types';

interface AutoExportManagerProps {
  isOpen: boolean;
  onClose: () => void;
  exportSettings: AutoExportSettings;
  onUpdateSettings: (settings: AutoExportSettings) => void;
  exportHistory: ExportHistoryItem[];
  onClearHistory: () => void;
  onManualExport: () => void;
}

export const AutoExportManager: React.FC<AutoExportManagerProps> = ({
  isOpen,
  onClose,
  exportSettings,
  onUpdateSettings,
  exportHistory,
  onClearHistory,
  onManualExport,
}) => {
  const [selectedPreview, setSelectedPreview] = useState<ExportHistoryItem | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0F172A] border border-blue-600/70 rounded-2xl shadow-2xl text-white overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E293B] border-b border-blue-900/60">
          <div className="flex items-center space-x-2">
            <Camera className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">
              ระบบตั้งเวลาส่งออกรูปภาพกราฟอัตโนมัติ (Auto Chart Image Export)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Settings Section */}
          <div className="p-5 rounded-xl bg-[#1B2745] border border-blue-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-blue-200 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  การตั้งเวลา Export กราฟอัตโนมัติ
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  ระบบจะจับภาพหน้าจอกราฟ Temperature & Humidity เป็นไฟล์รูปภาพ PNG โดยอัตโนมัติตามเวลาที่กำหนด
                </p>
              </div>

              {/* Enable / Disable Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.enabled}
                  onChange={(e) =>
                    onUpdateSettings({ ...exportSettings, enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Config Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/60">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  รูปแบบการตั้งเวลา Export (Schedule Mode):
                </label>
                <select
                  value={exportSettings.scheduleType || 'sunday_2359'}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...exportSettings,
                      scheduleType: e.target.value as 'interval' | 'sunday_2359',
                    })
                  }
                  className="w-full bg-[#0F172A] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400 font-medium"
                >
                  <option value="sunday_2359">
                    ⭐ ทุกๆ วันอาทิตย์ เวลา 23:59 น. (Weekly Every Sunday 23:59)
                  </option>
                  <option value="interval">
                    ⏱️ กำหนดช่วงเวลานาที/ชั่วโมง (Custom Interval)
                  </option>
                </select>
              </div>

              {exportSettings.scheduleType === 'interval' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ระยะเวลาที่ต้องการ Export (Interval):
                  </label>
                  <select
                    value={exportSettings.intervalMinutes}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...exportSettings,
                        intervalMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#0F172A] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                  >
                    <option value={1}>ทุกๆ 1 นาที (1 minute - Testing)</option>
                    <option value={5}>ทุกๆ 5 นาที (5 minutes)</option>
                    <option value={15}>ทุกๆ 15 นาที (15 minutes)</option>
                    <option value={30}>ทุกๆ 30 นาที (30 minutes)</option>
                    <option value={60}>ทุกๆ 1 ชั่วโมง (1 hour)</option>
                    <option value={360}>ทุกๆ 6 ชั่วโมง (6 hours)</option>
                    <option value={1440}>ทุกๆ 24 ชั่วโมง (1 day)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    เวลาที่ระบบจะส่งออกถัดไป (Next Sunday Schedule):
                  </label>
                  <div className="w-full bg-[#0F172A] border border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-emerald-300 font-mono font-bold flex items-center justify-between">
                    <span>อาทิตย์นี้ 23:59 น. (Sunday 23:59:00)</span>
                    <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
                      ACTIVE
                    </span>
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  รูปแบบไฟล์รูปภาพ:
                </label>
                <select
                  value={exportSettings.format}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...exportSettings,
                      format: e.target.value as 'png' | 'jpeg',
                    })
                  }
                  className="w-full bg-[#0F172A] border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="png">PNG Image (.png - High Quality 100%)</option>
                  <option value="jpeg">JPEG Image (.jpg)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.autoDownload}
                  onChange={(e) =>
                    onUpdateSettings({ ...exportSettings, autoDownload: e.target.checked })
                  }
                  className="rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800"
                />
                <span>ดาวน์โหลดไฟล์รูปภาพลงเครื่องคอมพิวเตอร์ทันทีเมื่อ Export (Auto-Download)</span>
              </label>

              <button
                onClick={onManualExport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-md"
              >
                <Camera className="w-4 h-4" />
                <span>Export ทันทีตอนนี้ (Manual Now)</span>
              </button>
            </div>
          </div>

          {/* Export History / Gallery */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                ประวัติการส่งออกรูปภาพ ({exportHistory.length} ไฟล์)
              </h3>
              {exportHistory.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างประวัติทั้งหมด</span>
                </button>
              )}
            </div>

            {exportHistory.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-sm">
                ยังไม่มีประวัติการ Export รูปภาพกราฟ
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {exportHistory.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-[#1E293B] border border-blue-900/50 rounded-xl overflow-hidden hover:border-blue-500 transition shadow-md flex flex-col"
                  >
                    {/* Image Preview Thumbnail */}
                    <div
                      onClick={() => setSelectedPreview(item)}
                      className="h-28 bg-slate-950 overflow-hidden cursor-pointer relative"
                    >
                      <img
                        src={item.imageData}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-bold text-white">
                        คลิกเพื่อดูรูปขยาย
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              item.type === 'auto'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-blue-950 text-blue-400 border border-blue-800'
                            }`}
                          >
                            {item.type === 'auto' ? 'AUTO' : 'MANUAL'}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {item.timestamp}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200 truncate">
                          {item.title}
                        </h4>
                      </div>

                      {/* Download Button */}
                      <a
                        href={item.imageData}
                        download={`IoT_Graph_Export_${item.id}.png`}
                        className="mt-2 w-full py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-bold rounded flex items-center justify-center space-x-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ดาวน์โหลด</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#1E293B] border-t border-blue-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-lg transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Image Zoom Preview Overlay */}
      {selectedPreview && (
        <div
          onClick={() => setSelectedPreview(null)}
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full bg-[#0F172A] border border-blue-500 rounded-xl overflow-hidden p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h4 className="font-bold text-sm text-white">{selectedPreview.title} - {selectedPreview.timestamp}</h4>
              <button
                onClick={() => setSelectedPreview(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                &times;
              </button>
            </div>
            <img
              src={selectedPreview.imageData}
              alt="Preview"
              className="w-full max-h-[70vh] object-contain rounded border border-slate-800"
            />
            <div className="flex justify-end">
              <a
                href={selectedPreview.imageData}
                download={`IoT_Graph_Export_${selectedPreview.id}.png`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดรูปภาพ</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
