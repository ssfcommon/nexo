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

export default function FAB() {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [closing, setClosing] = useState(false);

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

  const pickAction = (id) => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setModal(id);
    }, 200);
  };

  const isExpanded = open && !closing;

  // Fan geometry: anchor at FAB center, arc from straight-up (90°) to straight-left (180°)
  const RADIUS = 110;
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

      {/* FAB Container — exactly sized to the main button; actions position-absolute relative to it */}
      <div className="fixed z-[71] bottom-[90px] right-5 md:bottom-8 md:right-8 w-14 h-14">
        {/* Main FAB Button */}
        <button
          onClick={toggle}
          aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
          className="absolute inset-0 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-out active:scale-90"
          style={{
            background: isExpanded
              ? 'linear-gradient(135deg, #1F2937 0%, #111827 100%)'
              : 'linear-gradient(135deg, #4A6CF7 0%, #3B5DE7 100%)',
            boxShadow: isExpanded
              ? '0 10px 40px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06)'
              : '0 8px 32px rgba(74,108,247,0.4), 0 0 0 4px rgba(74,108,247,0.1)',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="w-6 h-6 transition-transform duration-300 ease-out"
            style={{ transform: isExpanded ? 'rotate(135deg)' : 'rotate(0deg)' }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>

          {/* Breathing glow ring — only when closed */}
          {!open && (
            <span className="absolute inset-[-3px] rounded-full fab-breathe pointer-events-none" />
          )}
        </button>

        {/* Fan actions — anchored to FAB center via right/bottom = 4px (FAB_half 28 − circle_half 24) */}
        {open && actions.map((a, i) => {
          const t = total === 1 ? 0 : i / (total - 1);
          const angle = startAngle + (endAngle - startAngle) * t;
          const rad = (angle * Math.PI) / 180;
          const dx = Math.cos(rad) * RADIUS;   // negative as angle → 180
          const dy = -Math.sin(rad) * RADIUS;  // negative (upward) since sin(90..180) > 0
          const delay = isExpanded ? i * 45 : (total - 1 - i) * 25;

          return (
            <div
              key={a.id}
              className="absolute flex items-center gap-3 flex-row-reverse"
              style={{
                right: 4,
                bottom: 4,
                transformOrigin: '100% 100%',
                transform: isExpanded
                  ? `translate(${dx}px, ${dy}px) scale(1)`
                  : 'translate(0px, 0px) scale(0.4)',
                opacity: isExpanded ? 1 : 0,
                transition: `transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity 220ms ease ${delay}ms`,
                pointerEvents: isExpanded ? 'auto' : 'none',
                willChange: 'transform, opacity',
              }}
            >
              <button
                onClick={() => pickAction(a.id)}
                aria-label={a.label}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-150 hover:scale-110 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${a.color} 0%, ${a.color}cc 100%)`,
                  boxShadow: `0 6px 22px ${a.color}55, inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.08)`,
                }}
              >
                <a.Icon className="w-[22px] h-[22px]" />
              </button>
              <span
                className="text-[12px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
                style={{
                  backgroundColor: 'rgba(17,24,39,0.85)',
                  color: '#E5E7EB',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {a.label}
              </span>
            </div>
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
