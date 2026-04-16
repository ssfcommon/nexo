import React, { useState, useEffect, useCallback } from 'react';
import { QuickTaskModal, NewProjectModal, NewEventModal, ReportBugModal } from './QuickActions.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Clean, monochrome outline icons (1.75px stroke) — lucide-style
const IconTask = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IconProject = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconEvent = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconBug = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M8 2l1.88 1.88" />
    <path d="M14.12 3.88L16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
    <path d="M12 20v-9" />
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
    <path d="M6 13H2" />
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
    <path d="M22 13h-4" />
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </svg>
);

const actions = [
  { id: 'task',    label: 'Task',    Icon: IconTask,    color: '#4A6CF7' },
  { id: 'project', label: 'Project', Icon: IconProject, color: '#10B981' },
  { id: 'event',   label: 'Event',   Icon: IconEvent,   color: '#F59E0B' },
  { id: 'bug',     label: 'Bug',     Icon: IconBug,     color: '#EF4444' },
];

export default function FAB({ tab = 'home' }) {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [closing, setClosing] = useState(false);
  // Hide-on-scroll state (only used in minimal mode)
  const [hidden, setHidden] = useState(false);

  // Home keeps the full-weight hero FAB. Other screens get a muted glass
  // variant that also hides on downward scroll so it doesn't sit on top
  // of content — addresses the "too distracting everywhere" complaint.
  const minimal = tab !== 'home';

  const toggle = useCallback(() => {
    if (open) {
      setClosing(true);
      setTimeout(() => { setOpen(false); setClosing(false); }, 250);
    } else {
      setOpen(true);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && open) toggle(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, toggle]);

  // Reset visibility whenever the tab changes
  useEffect(() => { setHidden(false); }, [tab]);

  // Hide on scroll-down / show on scroll-up (minimal mode only).
  // The scrollable surface is the <main> element in App.jsx for both
  // mobile and desktop layouts.
  useEffect(() => {
    if (!minimal) return;
    const main = document.querySelector('main');
    if (!main) return;
    let lastY = main.scrollTop;
    const THRESH = 18; // ignore micro-scrolls
    const onScroll = () => {
      const y = main.scrollTop;
      const delta = y - lastY;
      if (y < 40) { setHidden(false); lastY = y; return; }
      if (delta > THRESH) { setHidden(true); lastY = y; }
      else if (delta < -THRESH) { setHidden(false); lastY = y; }
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [minimal]);

  const pickAction = (id) => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setModal(id);
    }, 200);
  };

  const isExpanded = open && !closing;
  // Always show the FAB while the fan is open, even mid-scroll.
  const effectivelyHidden = hidden && !isExpanded;

  // Fan geometry: anchor at FAB center, arc from straight-up (90°) to straight-left (180°)
  // Buttons sit on inner arc; labels sit on outer arc (radially outward), so a label
  // never lands on top of a neighbor button.
  const BTN_RADIUS = 100;
  const LABEL_RADIUS = 168;
  const startAngle = 90;
  const endAngle = 180;
  const total = actions.length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[70] transition-opacity duration-250"
          style={{
            backgroundColor: isExpanded ? 'rgba(8,10,20,0.55)' : 'transparent',
            backdropFilter: isExpanded ? 'blur(4px)' : 'none',
            WebkitBackdropFilter: isExpanded ? 'blur(4px)' : 'none',
          }}
          onClick={toggle}
        />
      )}

      {/* FAB Container — exactly sized to the main button; actions position-absolute relative to it.
          Minimal mode: 48x48 (vs 56x56) and hides on scroll. */}
      <div
        className={
          'fixed z-[71] right-5 md:right-8 transition-transform duration-300 ease-out ' +
          (minimal
            ? 'bottom-[90px] md:bottom-8 w-12 h-12'
            : 'bottom-[90px] md:bottom-8 w-14 h-14')
        }
        style={{
          transform: effectivelyHidden ? 'translate(0, 120%) scale(0.85)' : 'translate(0, 0) scale(1)',
          opacity: effectivelyHidden ? 0 : 1,
          pointerEvents: effectivelyHidden ? 'none' : 'auto',
        }}
      >
        {/* Main FAB Button */}
        <button
          onClick={toggle}
          aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
          className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-300 ease-out active:scale-90"
          style={
            isExpanded
              ? {
                  // Same "open" treatment on both modes — the user is interacting
                  background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06)',
                }
              : minimal
              ? {
                  // Muted glass — no bright color, no glow, no outer ring
                  background: 'rgba(17,24,39,0.72)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                }
              : {
                  // Home: original hero treatment
                  background: 'linear-gradient(135deg, #4A6CF7 0%, #3B5DE7 100%)',
                  boxShadow: '0 8px 32px rgba(74,108,247,0.4), 0 0 0 4px rgba(74,108,247,0.1)',
                }
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke={minimal && !isExpanded ? 'rgba(229,231,235,0.85)' : 'white'}
            strokeWidth={minimal && !isExpanded ? '2' : '2.5'}
            strokeLinecap="round"
            className={minimal && !isExpanded ? 'w-5 h-5 transition-transform duration-300 ease-out' : 'w-6 h-6 transition-transform duration-300 ease-out'}
            style={{ transform: isExpanded ? 'rotate(135deg)' : 'rotate(0deg)' }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>

          {/* Breathing glow ring — only when closed AND in Home (hero) mode */}
          {!open && !minimal && (
            <span className="absolute inset-[-3px] rounded-full fab-breathe pointer-events-none" />
          )}
        </button>

        {/* Fan actions — button on inner arc, label on outer arc (radially aligned) */}
        {open && actions.map((a, i) => {
          const t = total === 1 ? 0 : i / (total - 1);
          const angle = startAngle + (endAngle - startAngle) * t;
          const rad = (angle * Math.PI) / 180;
          const bdx = Math.cos(rad) * BTN_RADIUS;
          const bdy = -Math.sin(rad) * BTN_RADIUS;
          const ldx = Math.cos(rad) * LABEL_RADIUS;
          const ldy = -Math.sin(rad) * LABEL_RADIUS;
          const delay = isExpanded ? i * 45 : (total - 1 - i) * 25;

          return (
            <React.Fragment key={a.id}>
              {/* Action button — anchored so its centre sits at FAB centre when collapsed,
                  then translates along the button arc when expanded */}
              <button
                onClick={() => pickAction(a.id)}
                aria-label={a.label}
                className="absolute w-12 h-12 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95"
                style={{
                  right: 4,
                  bottom: 4,
                  background: `linear-gradient(135deg, ${a.color} 0%, ${a.color}cc 100%)`,
                  boxShadow: `0 6px 22px ${a.color}55, inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.08)`,
                  transformOrigin: '50% 50%',
                  transform: isExpanded
                    ? `translate(${bdx}px, ${bdy}px) scale(1)`
                    : 'translate(0px, 0px) scale(0.4)',
                  opacity: isExpanded ? 1 : 0,
                  transition: `transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity 220ms ease ${delay}ms, background 150ms ease, box-shadow 150ms ease`,
                  pointerEvents: isExpanded ? 'auto' : 'none',
                  willChange: 'transform, opacity',
                }}
              >
                <a.Icon className="w-[22px] h-[22px]" />
              </button>

              {/* Label — positioned on outer arc, radially outward from its button.
                  top/left anchor it at FAB centre; translate(-50%,-50%) centres the bubble
                  on that point; adding (ldx, ldy) moves the centre along the outer arc. */}
              <span
                className="absolute text-[12px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none"
                style={{
                  top: 28,
                  left: 28,
                  backgroundColor: 'rgba(17,24,39,0.85)',
                  color: '#E5E7EB',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transform: isExpanded
                    ? `translate(calc(-50% + ${ldx}px), calc(-50% + ${ldy}px)) scale(1)`
                    : 'translate(-50%, -50%) scale(0.4)',
                  opacity: isExpanded ? 1 : 0,
                  transition: `transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay + 40}ms, opacity 220ms ease ${delay + 40}ms`,
                  willChange: 'transform, opacity',
                }}
              >
                {a.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Modals */}
      <QuickTaskModal  open={modal === 'task'}    onClose={() => setModal(null)} onCreated={() => { showToast('Task created'); }} />
      <NewProjectModal open={modal === 'project'} onClose={() => setModal(null)} onCreated={() => { showToast('Project created'); }} />
      <NewEventModal   open={modal === 'event'}   onClose={() => setModal(null)} onCreated={() => { showToast('Event created'); }} />
      <ReportBugModal  open={modal === 'bug'}     onClose={() => setModal(null)} onCreated={() => { showToast('Bug reported'); }} />
    </>
  );
}
