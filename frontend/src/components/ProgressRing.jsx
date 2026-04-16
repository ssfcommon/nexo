import React from 'react';
import { spring } from '../lib/motion.js';

// ─── ProgressRing ───────────────────────────────────────────────────
// Circular progress used in place of the old flat bar on project cards.
// Cheap SVG. No libraries.
//
// Props:
//   percent   0–100. Values outside clamp.
//   color     stroke colour (defaults to the sky accent). Pass the
//             project's accent.solid for on-card use.
//   size      pixel diameter of the whole ring (default 40).
//   stroke    stroke width (default 3).
//   showLabel if true, renders the percent number centred inside.
//
// Motion: `stroke-dashoffset` transitions with a bouncy spring when
// percent changes — the ring overshoots slightly then settles. That
// little pop is the delight moment every time a task closes.

export default function ProgressRing({
  percent = 0,
  color = '#5BAAF9',
  size = 40,
  stroke = 3,
  showLabel = true,
}) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // Rotate so stroke starts from 12 o'clock instead of 3.
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track — soft grey so we can see empty rings */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: `stroke-dashoffset 480ms ${spring.bouncy}`,
            filter: clamped > 0 ? `drop-shadow(0 0 4px ${color}66)` : 'none',
          }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ color: clamped > 0 ? '#E5E7EB' : '#6B7280' }}
        >
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}
