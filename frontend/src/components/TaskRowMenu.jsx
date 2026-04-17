import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // Menu position is computed from the button's bounding rect so the
  // popover can render with `position: fixed`. This is the only reliable
  // way to escape parent `overflow: hidden` on cards — without it, the
  // popover gets clipped by the GlassCard shell.
  const [menuPos, setMenuPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const dim = size === 'sm' ? 24 : 28;
  const alarmOn = !!item?.alarm_at;

  // Recompute menu position when opened. Right-align to the button,
  // flip above if there isn't room below.
  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return setOpen(true);
    const MENU_H_EST = 160; // generous — taller is fine, shorter just wastes space
    const flipAbove = rect.bottom + MENU_H_EST > window.innerHeight - 8;
    setMenuPos({
      top: flipAbove ? rect.top - 6 : rect.bottom + 6,
      right: window.innerWidth - rect.right,
      flipAbove,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      // Dismiss on any click/tap outside the button OR the floating menu.
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    // We deliberately don't close on scroll — browsers fire a scroll
    // event when a newly-mounted button gets focus scrolled-into-view,
    // which would slam the menu shut before the user can read it.
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
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
    <div ref={ref} className="flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg flex items-center justify-center transition hover:bg-white/10 active:scale-95"
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
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="min-w-[172px] py-1.5 rounded-xl animate-fade-in"
          style={{
            // Portal mounts at body, so `fixed` is truly viewport-relative.
            // This is the only reliable escape from ancestor containing
            // blocks created by `backdrop-filter`, `transform`, etc.
            position: 'fixed',
            top: menuPos.flipAbove ? undefined : menuPos.top,
            bottom: menuPos.flipAbove ? window.innerHeight - menuPos.top : undefined,
            right: menuPos.right,
            zIndex: 100,
            background: 'linear-gradient(160deg, rgba(22,30,50,0.97) 0%, rgba(12,18,32,0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
          onClick={e => e.stopPropagation()}
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
        </div>,
        document.body
      )}
    </div>
  );
}
