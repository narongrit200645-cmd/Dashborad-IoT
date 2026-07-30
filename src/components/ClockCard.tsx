import React, { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';

interface ClockCardProps {
  isDark?: boolean;
  clockLogoUrl?: string;
  onUpdateClockLogo?: (url: string) => void;
}

export const ClockCard: React.FC<ClockCardProps> = ({
  isDark = true,
  clockLogoUrl,
  onUpdateClockLogo,
}) => {
  const [timeStr, setTimeStr] = useState<string>('17:32:21');
  const [dateStr, setDateStr] = useState<string>('Friday : 24-JUL-2026');
  const clockFileInputRef = useRef<HTMLInputElement>(null);

  const handleClockLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateClockLogo) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateClockLogo(String(event.target.result));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}:${secs}`);

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[now.getDay()];

      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthStr = months[now.getMonth()];
      const dayNum = String(now.getDate()).padStart(2, '0');
      const yearStr = now.getFullYear();

      setDateStr(`${dayName} : ${dayNum}-${monthStr}-${yearStr}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={`relative flex flex-col md:flex-row items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
        isDark
          ? 'bg-[#0B1329]/90 border-blue-900/60 text-white shadow-[0_0_15px_rgba(30,58,138,0.35)]'
          : 'bg-white border-blue-300 text-slate-900 shadow-lg'
      }`}
    >
      <input
        type="file"
        ref={clockFileInputRef}
        onChange={handleClockLogoUpload}
        accept="image/*"
        className="hidden"
      />

      <div className="relative group flex items-center justify-center mb-3 md:mb-0 md:mr-6 w-full md:w-auto h-24">
        <img
          src={clockLogoUrl || "/Logo NA.png"}
          alt="Logo NA"
          className="w-auto h-full max-h-24 object-contain"
        />

        <button
          onClick={() => clockFileInputRef.current?.click()}
          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-1 text-white text-xs font-bold rounded-lg transition-opacity"
          title="เปลี่ยนรูปโลโก้หน้าเวลา (Upload Custom Clock Logo)"
        >
          <Upload className="w-4 h-4" />
          <span>เปลี่ยนโลโก้</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left justify-center">
        <div
          className={`font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-wider ${
            isDark
              ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]'
              : 'text-blue-700 drop-shadow-sm'
          }`}
        >
          {timeStr}
        </div>
        <div
          className={`text-lg sm:text-xl font-bold tracking-wide mt-1 ${
            isDark ? 'text-blue-200' : 'text-slate-800'
          }`}
        >
          {dateStr}
        </div>
        <div
          className={`text-base sm:text-lg font-bold tracking-wide mt-0.5 ${
            isDark ? 'text-indigo-400' : 'text-blue-900'
          }`}
        >
          NA Caltechnologies Co.,Ltd.
        </div>
      </div>
    </div>
  );
};