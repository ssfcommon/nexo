import React from 'react';

// ─── GlassCard ───────────────────────────────────────────────
// One source of truth for the dark-glass card surface used across Home.
// Keeps border/blur/inset-highlight consistent everywhere.
//
// Props:
//   accent    'red' | 'amber' | 'blue' | 'green' | 'none' (default 'none')
//             → paints a 3px left edge bar for urgency.
//   tint      same keys + 'none' (default 'none')
//             → optional soft full-card tint. Use sparingly — prefer the bar.
//   as        element to render (default 'div'). Pass 'button' for pressable cards.
//   className extra classes (padding, flex layout, etc.)
//   style     merged with computed styles (class-level style wins for what we set).

const ACCENTS = {
  red:    { bar: '#EF4444', tintFrom: 'rgba(239,68,68,0.10)', tintTo: 'rgba(239,68,68,0.03)', glow: 'rgba(239,68,68,0.10)' },
  amber:  { bar: '#F59E0B', tintFrom: 'rgba(245,158,11,0.10)', tintTo: 'rgba(245,158,11,0.03)', glow: 'rgba(245,158,11,0.08)' },
  blue:   { bar: '#5B8CFF', tintFrom: 'rgba(91,140,255,0.10)', tintTo: 'rgba(91,140,255,0.03)', glow: 'rgba(91,140,255,0.08)' },
  green:  { bar: '#10B981', tintFrom: 'rgba(16,185,129,0.10)', tintTo: 'rgba(16,185,129,0.03)', glow: 'rgba(16,185,129,0.08)' },
  none:   { bar: null,      tintFrom: 'rgba(255,255,255,0.07)', tintTo: 'rgba(255,255,255,0.02)', glow: 'transparent' },
};

export default function GlassCard({
  as: Tag = 'div',
  accent = 'none',
  tint = 'none',
  className = '',
  style = {},
  children,
  ...rest
}) {
  const a = ACCENTS[accent] || ACCENTS.none;
  const t = ACCENTS[tint] || ACCENTS.none;
  const showBar = !!a.bar;

  const merged = {
    position: 'relative',
    background: `linear-gradient(135deg, ${t.tintFrom} 0%, ${t.tintTo} 100%)`,
    border: '1px solid rgba(255,255,255,0.10)',
    borderTopColor: 'rgba(255,255,255,0.16)',
    borderLeftColor: showBar ? 'transparent' : 'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: `0 2px 16px rgba(0,0,0,0.28), 0 0 10px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
    borderRadius: 14,
    overflow: 'hidden',
    ...style,
  };

  return (
    <Tag className={className} style={merged} {...rest}>
      {showBar && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: 3,
            background: a.bar,
            boxShadow: `0 0 8px ${a.bar}88`,
          }}
        />
      )}
      {children}
    </Tag>
  );
}
