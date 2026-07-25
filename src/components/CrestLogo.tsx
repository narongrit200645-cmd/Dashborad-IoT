import React from 'react';

export const CrestLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-16' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 200 280" className="w-full h-full filter drop-shadow">
        {/* Crown Spire Top */}
        <polygon points="100,5 92,30 108,30" fill="#EAB308" />
        <ellipse cx="100" cy="35" rx="10" ry="6" fill="#DC2626" />
        <polygon points="100,35 85,80 115,80" fill="#EAB308" />
        <rect x="80" y="80" width="40" height="15" rx="3" fill="#DC2626" />
        
        {/* Flame/Crown Tier elements */}
        <path d="M 70,110 C 60,90 80,95 100,75 C 120,95 140,90 130,110 Z" fill="#EAB308" />
        <path d="M 50,140 C 40,115 70,120 100,95 C 130,120 160,115 150,140 Z" fill="#DC2626" />
        
        {/* Main Emblem Circle */}
        <circle cx="100" cy="190" r="70" fill="#EAB308" stroke="#DC2626" strokeWidth="6" />
        <circle cx="100" cy="190" r="58" fill="#1E3A8A" stroke="#FFFFFF" strokeWidth="4" />
        
        {/* Sunburst Rays inside circle */}
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          return (
            <line
              key={i}
              x1="100"
              y1="190"
              x2={100 + 48 * Math.cos((angle * Math.PI) / 180)}
              y2={190 + 48 * Math.sin((angle * Math.PI) / 180)}
              stroke="#EAB308"
              strokeWidth="3"
            />
          );
        })}
        <circle cx="100" cy="190" r="22" fill="#EAB308" stroke="#1E3A8A" strokeWidth="3" />
        <circle cx="100" cy="190" r="10" fill="#DC2626" />

        {/* Outer Lotus Ring Arc */}
        <path
          d="M 35,190 A 65,65 0 1,0 165,190"
          fill="none"
          stroke="#EAB308"
          strokeWidth="10"
          strokeDasharray="6 4"
        />
      </svg>
    </div>
  );
};
