import React from 'react';

/**
 * Professional AI Trading Bot Icon
 * Scalable SVG with glassmorphism-friendly design
 * Matches TK AI FINANCE brand (purple/blue, dark theme)
 */
export default function BotIcon({ size = 32, className = '', animated = false }) {
  const sizeMap = {
    xs: 20,
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
    '2xl': 80,
  };

  const finalSize = typeof size === 'string' ? sizeMap[size] || 32 : size;

  return (
    <svg
      width={finalSize}
      height={finalSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animated ? 'animate-pulse' : ''}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="botGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="botGradientLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
        </linearGradient>
        <filter id="botGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main body: rounded rectangle with gradient */}
      <rect
        x="12"
        y="16"
        width="40"
        height="36"
        rx="6"
        ry="6"
        fill="url(#botGradient)"
        opacity="0.15"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
      />

      {/* Head: circle with gradient border */}
      <circle
        cx="32"
        cy="20"
        r="8"
        fill="none"
        stroke="url(#botGradient)"
        strokeWidth="1.5"
        filter="url(#botGlow)"
      />

      {/* Left eye: small circle with glow */}
      <circle
        cx="27"
        cy="19"
        r="2"
        fill="url(#botGradient)"
        filter="url(#botGlow)"
      />

      {/* Right eye: small circle with glow */}
      <circle
        cx="37"
        cy="19"
        r="2"
        fill="url(#botGradient)"
        filter="url(#botGlow)"
      />

      {/* Antenna left: thin line with dot */}
      <line
        x1="24"
        y1="12"
        x2="22"
        y2="6"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="22" cy="5" r="1.2" fill="url(#botGradient)" />

      {/* Antenna right: thin line with dot */}
      <line
        x1="40"
        y1="12"
        x2="42"
        y2="6"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="42" cy="5" r="1.2" fill="url(#botGradient)" />

      {/* Torso: vertical rectangle */}
      <rect
        x="26"
        y="30"
        width="12"
        height="14"
        rx="2"
        ry="2"
        fill="none"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
      />

      {/* Left arm: line with circle joint */}
      <line
        x1="26"
        y1="36"
        x2="16"
        y2="36"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="15" cy="36" r="1.8" fill="url(#botGradient)" />

      {/* Right arm: line with circle joint */}
      <line
        x1="38"
        y1="36"
        x2="48"
        y2="36"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="49" cy="36" r="1.8" fill="url(#botGradient)" />

      {/* Left leg: line with circle joint */}
      <line
        x1="28"
        y1="44"
        x2="24"
        y2="52"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="53" r="1.5" fill="url(#botGradient)" />

      {/* Right leg: line with circle joint */}
      <line
        x1="36"
        y1="44"
        x2="40"
        y2="52"
        stroke="url(#botGradient)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="40" cy="53" r="1.5" fill="url(#botGradient)" />

      {/* Chest panel: small rectangle with accent */}
      <rect
        x="28"
        y="33"
        width="8"
        height="6"
        rx="1"
        ry="1"
        fill="none"
        stroke="url(#botGradient)"
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* Center dot: power indicator */}
      <circle
        cx="32"
        cy="36"
        r="1"
        fill="url(#botGradient)"
        opacity="0.8"
      />

      {/* Subtle glow ring around entire icon */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="url(#botGradient)"
        strokeWidth="0.6"
        opacity="0.1"
      />
    </svg>
  );
}
