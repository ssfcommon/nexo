import React, { useEffect, useRef, useState } from 'react';
import { AlarmIcon, CalendarIcon, TrashIcon } from './Icons.jsx';

// ─── TaskRowMenu ───────────────────────────────────────────────
// Compact kebab + popover for task-row actions. Collapses 2–3 inline
// icons into a single affordance so the title gets its space back.
//
// Mobile task rows were losing ~140–170px to trailing icons+date,
// truncating titles to ~8 characters. This hides the icons behind a
// tap and preserves the alarm-on signal by tinting the kebab amber.
//
// Props:
//   item         — row (must have id, title, optional alarm_at)
//   onSetAlarm   — (item) => void   optional
//   onAddToCal   — (item) => void   optional
//   onDelete     — (item) => void   optional (shown with danger style)
//   size         — 'sm' (24px, default on busy rows) or 'md' (28px)
//   labelPrefix  — override "Set alarm" → "Set subtask alarm" etc.

export default function TaskRowMenu({
  item,
  onSetAlarm,
  onAddToCal,
  onDelete,
  size = 'md',
  labelPrefix = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dim = size === 'sm' ? 24 : 28;
  const alarmOn = !!item?.alarm_at;

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // stopPropagation: these rows often sit inside tappable parents.
  const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn?.(item); };

  const items = [];
  if (onSetAlarm) {
    items.push({
      label: alarmOn ? (labelPrefix ? `Change ${labelPrefix} alarm` : 'Change alarm') : (labelPrefix ? `Set ${labelPrefix} alarm` : 'Set alarm'),
      icon: <AlarmIcon width="14" height="14" />,
      tint: alarmOn ? '#F59E0B' : undefined,
      action: run(onSetAlarm),
    });
  }
  if (onAddToCal) {
    items.push({
      label: 'Add to calendar',
      icon: <CalendarIcon width="14" height="14" />,
      action: run(onAddToCal),
    });
  }
  if (onDelete) {
    items.push({
      label: 'Delete',
      icon: <TrashIcon width="14" height="14" />,
      danger: true,
      action: run(onDelete),
    });
  }

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg flex items-center justify-center transition hover:bg-white/10 active:scale-95 relative"
        style={{
          width: dim,
          height: dim,
          // Tint the kebab amber when the alarm is armed so the signal
          // survives even when the icon row is collapsed.
          color: alarmOn ? '#F59E0B' : '#9CA3AF',
          background: open
            ? 'rgba(255,255,255,0.10)'
            : alarmOn ? 'rgba(245,158,11,0.10)' : 'transparent',
          border: alarmOn ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
        }}
        title={alarmOn ? `Alarm: ${item.alarm_at}` : 'Actions'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[172px] py-1.5 rounded-xl animate-fade-in"
          style={{
            background: 'linear-gradient(160deg, rgba(22,30,50,0.97) 0%, rgba(12,18,32,0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.2)',
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={it.action}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-left hover:bg-white/[0.06] transition"
              style={{ color: it.danger ? '#F87171' : (it.tint || '#D1D5DB') }}
            >
              <span className="w-[14px] flex items-center justify-center" style={{ color: it.tint || 'currentColor' }}>
                {it.icon}
              </span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
