import React from 'react';

// ─── MomentumChip ───────────────────────────────────────────────────
// Tiny pill on the Project card's bottom row. Tells the user "is this
// project alive?" at a glance.
//
// Four states (see lib/projectAccent.js → getMomentum):
//   fire     🔥 On fire   — amber, has a subtle flame wiggle every 8s
//   building 📈 Building   — sky blue, static
//   quiet    😴 Quiet      — slate, static
//   clear    ✨ All clear  — emerald, static
//
// The wiggle lives in index.css (`@keyframes flame-wiggle`). We only
// attach the animation class for "fire" so we don't pay animation cost
// on the 80% of cards that aren't actively burning.

export default function MomentumChip({ momentum }) {
  if (!momentum) return null;
  const { state, emoji, label, chipColor, chipBg } = momentum;
  const isFire = state === 'fire';

  return (
    <span
      className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{
        color: chipColor,
        background: chipBg,
        border: `1px solid ${chipColor}33`,
      }}
    >
      <span
        aria-hidden
        className={isFire ? 'flame-wiggle' : ''}
        style={{ display: 'inline-block', fontSize: 11, lineHeight: 1 }}
      >
        {emoji}
      </span>
      {label}
    </span>
  );
}
