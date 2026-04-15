import React from 'react';

// ─── FilterChip ──────────────────────────────────────────────
// A small dismissible pill for showing an active filter.
//   <FilterChip label="All" onRemove={...} />
//   <FilterChip label="Operations" onRemove={...} />
//
// If onRemove is omitted, the chip is read-only (no × button).

export default function FilterChip({ label, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full text-[11px] font-semibold"
      style={{
        background: 'rgba(91,140,255,0.10)',
        color: '#A8C4FF',
        border: '1px solid rgba(91,140,255,0.22)',
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Clear ${label}`}
          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  );
}
