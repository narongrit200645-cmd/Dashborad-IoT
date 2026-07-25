import React from 'react';
import { Zap, Thermometer, Droplets, Cloud, Compass, GripVertical, Settings } from 'lucide-react';

interface SensorCardProps {
  id?: string;
  title: string;
  value: number | string;
  unit: string;
  iconType: 'bolt' | 'thermometer' | 'droplet' | 'ground' | 'cloud' | string;
  isDark?: boolean;
  isEditMode?: boolean;
  onEditClick?: () => void;
  customColor?: string;
  isAlert?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  id,
  title,
  value,
  unit,
  iconType,
  isDark = true,
  isEditMode = false,
  onEditClick,
  customColor,
  isAlert = false,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const getIcon = () => {
    switch (iconType) {
      case 'bolt':
        return <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 fill-amber-400/20" />;
      case 'thermometer':
        return <Thermometer className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" />;
      case 'droplet':
        return <Droplets className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 fill-cyan-400/20" />;
      case 'ground':
        return (
          <span className="text-lg sm:text-xl font-bold text-emerald-400 leading-none">⏚</span>
        );
      case 'cloud':
        return <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 fill-sky-400/20" />;
      default:
        return <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />;
    }
  };

  const valStr = String(value);
  const isLongVal = valStr.length > 5;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all duration-300 cursor-grab active:cursor-grabbing select-none ${
        isAlert
          ? 'border-red-500 bg-red-950/40 animate-pulse text-white'
          : isDark
          ? 'bg-[#0B1329]/90 border-blue-600/60 shadow-[0_4px_12px_rgba(15,23,42,0.6)] hover:border-blue-400 text-white'
          : 'bg-white border-blue-200 shadow-md hover:border-blue-400 text-slate-900'
      }`}
      style={customColor ? { borderColor: customColor } : undefined}
    >
      {/* Edit Mode & Drag Handle */}
      {isEditMode && (
        <div className="absolute top-2 right-2 flex items-center space-x-1 bg-slate-800/80 p-1 rounded border border-slate-600 z-10">
          <button
            onClick={onEditClick}
            className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Configure Widget"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
        </div>
      )}

      {/* Header Title & Icon */}
      <div className="flex items-center justify-between space-x-2">
        <h3
          className={`text-base sm:text-lg font-extrabold tracking-tight truncate ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}
        >
          {title}
        </h3>
        <div
          className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${
            isDark ? 'bg-slate-800/50' : 'bg-blue-50 border border-blue-200/80'
          }`}
        >
          {getIcon()}
        </div>
      </div>

      {/* Metric Value Display with Adaptive Sizing to Prevent Overflow */}
      <div className="my-2.5 text-center flex items-baseline justify-center flex-wrap gap-1">
        <span
          className={`font-black tracking-tight ${
            isLongVal
              ? 'text-lg sm:text-xl lg:text-2xl'
              : 'text-xl sm:text-2xl lg:text-3xl'
          } ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {valStr}
        </span>
        {unit && (
          <span
            className={`font-bold ${
              isLongVal ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            } ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Status Bar / Indicator */}
      <div
        className={`flex items-center justify-between text-xs pt-2 border-t ${
          isDark
            ? 'border-slate-700/40 text-slate-400'
            : 'border-slate-200 text-slate-600 font-medium'
        }`}
      >
        <span className="inline-flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span
            className={`font-semibold ml-1 ${
              isDark ? 'text-emerald-400/90' : 'text-emerald-700'
            }`}
          >
            Live Feed
          </span>
        </span>
        <span
          className={`font-mono text-[11px] ${
            isDark ? 'text-slate-400' : 'text-slate-600 font-bold'
          }`}
        >
          ESP32 #01
        </span>
      </div>
    </div>
  );
};
