import React, { useRef } from 'react';
import { LayoutGrid, Eye, EyeOff, RotateCcw, Sliders, Check, ArrowUp, ArrowDown, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { WidgetConfig, TelemetryData, LogoSettings } from '../types';

interface LayoutEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: WidgetConfig[];
  onUpdateWidgets: (updated: WidgetConfig[]) => void;
  telemetry: TelemetryData;
  onUpdateTelemetry: (updated: Partial<TelemetryData>) => void;
  logoSettings: LogoSettings;
  onUpdateLogoSettings: (updated: Partial<LogoSettings>) => void;
  onResetLayout: () => void;
}

export const LayoutEditorModal: React.FC<LayoutEditorModalProps> = ({
  isOpen,
  onClose,
  widgets,
  onUpdateWidgets,
  telemetry,
  onUpdateTelemetry,
  logoSettings,
  onUpdateLogoSettings,
  onResetLayout,
}) => {
  const modalRmuFileInputRef = useRef<HTMLInputElement>(null);
  const modalClockFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleModalFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'headerRmuLogoUrl' | 'clockLogoUrl'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateLogoSettings({ [key]: String(event.target.result) });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleVisibility = (id: string) => {
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );
    onUpdateWidgets(updated);
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const newWidgets = [...widgets];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newWidgets.length) return;

    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    // re-index order
    const reordered = newWidgets.map((w, idx) => ({ ...w, order: idx }));
    onUpdateWidgets(reordered);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={modalRmuFileInputRef}
        onChange={(e) => handleModalFileUpload(e, 'headerRmuLogoUrl')}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={modalClockFileInputRef}
        onChange={(e) => handleModalFileUpload(e, 'clockLogoUrl')}
        accept="image/*"
        className="hidden"
      />

      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-blue-600/70 rounded-2xl shadow-2xl text-white overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E293B] border-b border-blue-900/60">
          <div className="flex items-center space-x-2">
            <LayoutGrid className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">
              ปรับแต่งเลย์เอาต์หน้าจอและเกณฑ์เตือนภัย (UI Customizer)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Logo Customization */}
          <div className="p-4 rounded-xl bg-[#1B2745] border border-blue-900/50 space-y-4">
            <h3 className="text-sm font-bold text-blue-200 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              เปลี่ยนรูปภาพโลโก้ระบบ (Custom Logo Manager)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Header RMU Logo */}
              <div className="p-3 bg-[#0F172A] rounded-lg border border-slate-700/80 space-y-2">
                <label className="block text-xs text-slate-300 font-semibold">
                  1. โลโก้ RMU (ด้านซ้าย Header):
                </label>
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-12 bg-slate-900 rounded border border-slate-700 flex items-center justify-center p-1">
                    {logoSettings.headerRmuLogoUrl ? (
                      <img
                        src={logoSettings.headerRmuLogoUrl}
                        alt="RMU Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-blue-400 font-bold">RMU Crest</span>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => modalRmuFileInputRef.current?.click()}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition"
                    >
                      <Upload className="w-3 h-3" />
                      <span>อัปโหลดรูป</span>
                    </button>
                    {logoSettings.headerRmuLogoUrl && (
                      <button
                        onClick={() => onUpdateLogoSettings({ headerRmuLogoUrl: undefined })}
                        className="flex items-center space-x-1 px-2 py-0.5 text-rose-400 hover:text-rose-300 text-[11px] font-semibold"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>ลบรูป คืนค่าเดิม</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Clock Card Logo */}
              <div className="p-3 bg-[#0F172A] rounded-lg border border-slate-700/80 space-y-2">
                <label className="block text-xs text-slate-300 font-semibold">
                  2. โลโก้หน้าเวลา (Clock Card):
                </label>
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-12 bg-slate-900 rounded border border-slate-700 flex items-center justify-center p-1">
                    {logoSettings.clockLogoUrl ? (
                      <img
                        src={logoSettings.clockLogoUrl}
                        alt="Clock Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">NA Logo</span>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => modalClockFileInputRef.current?.click()}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition"
                    >
                      <Upload className="w-3 h-3" />
                      <span>อัปโหลดรูป</span>
                    </button>
                    {logoSettings.clockLogoUrl && (
                      <button
                        onClick={() => onUpdateLogoSettings({ clockLogoUrl: undefined })}
                        className="flex items-center space-x-1 px-2 py-0.5 text-rose-400 hover:text-rose-300 text-[11px] font-semibold"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>ลบรูป คืนค่าเดิม</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Temperature & Humidity Calibration Target Boundaries */}
          <div className="p-4 rounded-xl bg-[#1B2745] border border-blue-900/50 space-y-4">
            <h3 className="text-sm font-bold text-blue-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              กำหนดค่าเป้าหมายและช่วงเกณฑ์ยอมรับ (Calibration Targets & Tolerance)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">
                  เป้าหมาย Temperature Target (°C):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={telemetry.tempTarget}
                    onChange={(e) =>
                      onUpdateTelemetry({ tempTarget: Number(e.target.value) })
                    }
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                  <span className="text-xs text-slate-400">±</span>
                  <input
                    type="number"
                    value={telemetry.tempTolerance}
                    onChange={(e) =>
                      onUpdateTelemetry({ tempTolerance: Number(e.target.value) })
                    }
                    className="w-20 bg-[#0F172A] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  />
                  <span className="text-xs text-slate-400">°C</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  MIN: {telemetry.tempTarget - telemetry.tempTolerance}°C | MAX:{' '}
                  {telemetry.tempTarget + telemetry.tempTolerance}°C
                </p>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">
                  เป้าหมาย Humidity Target (%):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={telemetry.humidityTarget}
                    onChange={(e) =>
                      onUpdateTelemetry({ humidityTarget: Number(e.target.value) })
                    }
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                  <span className="text-xs text-slate-400">±</span>
                  <input
                    type="number"
                    value={telemetry.humidityTolerance}
                    onChange={(e) =>
                      onUpdateTelemetry({ humidityTolerance: Number(e.target.value) })
                    }
                    className="w-20 bg-[#0F172A] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  MIN: {telemetry.humidityTarget - telemetry.humidityTolerance}% | MAX:{' '}
                  {telemetry.humidityTarget + telemetry.humidityTolerance}%
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Reorder & Show/Hide Widgets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                จัดลำดับและแสดง/ซ่อนการ์ดเซนเซอร์ (Widget Cards)
              </h3>
              <button
                onClick={onResetLayout}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>รีเซ็ตตามรูปแบบเดิม 100%</span>
              </button>
            </div>

            <div className="space-y-2">
              {widgets.map((widget, idx) => (
                <div
                  key={widget.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    widget.visible
                      ? 'bg-[#1E293B] border-blue-900/60 text-white'
                      : 'bg-slate-900/50 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleVisibility(widget.id)}
                      className={`p-1.5 rounded-lg border transition ${
                        widget.visible
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {widget.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <h4 className="text-sm font-bold">{widget.title}</h4>
                      <p className="text-[11px] text-slate-400">หน่วย: {widget.unit || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => moveWidget(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveWidget(idx, 'down')}
                      disabled={idx === widgets.length - 1}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#1E293B] border-t border-blue-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-lg transition"
          >
            บันทึกการปรับแต่ง
          </button>
        </div>
      </div>
    </div>
  );
};
