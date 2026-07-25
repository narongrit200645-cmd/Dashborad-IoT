import React from 'react';

interface NALogoProps {
  className?: string;
  showText?: boolean;
}

export const NALogo: React.FC<NALogoProps> = ({ className = 'w-24 h-16', showText = false }) => {
  return (
    <div className={`relative flex items-center justify-center p-1 ${className}`}>
      <svg viewBox="-10 -10 320 195" className="w-full h-full drop-shadow-md">
        {/* Red swoosh ellipse arc behind and under text */}
        <path
          d="M 30,85 C 20,40 100,20 180,45 C 240,65 265,110 210,135 C 140,165 40,140 80,95 C 100,75 180,90 230,115"
          fill="none"
          stroke="#DC2626"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {/* Thick white outline around NA letters for high legibility */}
        <text
          x="145"
          y="125"
          textAnchor="middle"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="14"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="900"
          fontSize="110"
          letterSpacing="-2"
        >
          NA
        </text>
        {/* Dark Navy Blue NA text */}
        <text
          x="145"
          y="125"
          textAnchor="middle"
          fill="#1B2B6B"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="900"
          fontSize="110"
          letterSpacing="-2"
        >
          NA
        </text>
      </svg>
      {showText && (
        <span className="text-xs font-semibold text-blue-300 ml-2 whitespace-nowrap">
          NA Caltechnologies Co.,Ltd.
        </span>
      )}
    </div>
  );
};
