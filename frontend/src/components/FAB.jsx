import React, { useState, useEffect, useCallback } from 'react';
import { QuickTaskModal, NewProjectModal, NewEventModal, ReportBugModal } from './QuickActions.jsx';
import { useToast } from '../context/ToastContext.jsx';

const actions = [
  { id: 'task',    label: 'Task',    icon: '⚡', color: '#4A6CF7', angle: 0 },
  { id: 'project', label: 'Project', icon: '📁', color: '#10B981', angle: 1 },
  { id: 'event',   label: 'Event',   icon: '📅', color: '#F59E0B', angle: 2 },
  { id: 'bug',     label: 'Bug',     icon: '🐛', color: '#EF4444', angle: 3 },
];

export default function FAB() {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [closing, setClosing] = useState(false);

  const toggle = useCallback(() => {
    if (open) {
      setClosing(true);
      setTimeout(() => { setOpen(false); setClosing(false); }, 200);
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
    }, 150);
  };

  const isExpanded = open && !closing;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[70] transition-opacity duration-200"
          style={{ backgroundColor: isExpanded ? 'rgba(0,0,0,0.2)' : 'transparent', backdropFilter: isExpanded ? 'blur(2px)' : 'none' }}
          onClick={toggle}
        />
      )}

      {/* FAB Container */}
      <div className="fixed z-[71] bottom-[90px] right-5 md:bottom-8 md:right-8 flex flex-col-reverse items-center gap-3">
        {/* Main FAB Button */}
        <button
          onClick={toggle}
          className="fab-main group relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ease-out active:scale-90"
          style={{
            background: isExpanded
              ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
              : 'linear-gradient(135deg, #4A6CF7 0%, #3B5DE7 100%)',
            boxShadow: isExpanded
              ? '0 8px 32px rgba(239,68,68,0.4), 0 0 0 4px rgba(239,68,68,0.1)'
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
            style={{ transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)' }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>

          {/* Breathing glow ring — only when closed */}
          {!open && (
            <span className="absolute inset-[-3px] rounded-full fab-breathe" />
          )}
        </button>

        {/* Action Buttons */}
        {open && actions.map((a, i) => {
          const delay = isExpanded ? i * 50 : (actions.length - 1 - i) * 30;
          return (
            <div
              key={a.id}
              className="flex items-center gap-2.5 transition-all ease-out"
              style={{
                transitionDuration: '250ms',
                transitionDelay: `${delay}ms`,
                opacity: isExpanded ? 1 : 0,
                transform: isExpanded ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.8)',
                pointerEvents: isExpanded ? 'auto' : 'none',
              }}
            >
              {/* Label */}
              <span
                className="fab-label text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--fab-label-bg, white)',
                  color: 'var(--fab-label-color, #374151)',
                  border: '1px solid var(--fab-label-border, rgba(0,0,0,0.06))',
                }}
              >
                {a.label}
              </span>
              {/* Circle Button */}
              <button
                onClick={() => pickAction(a.id)}
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-md transition-all duration-150 hover:scale-110 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${a.color}, ${a.color}dd)`,
                  boxShadow: `0 4px 20px ${a.color}55, 0 0 0 3px ${a.color}15`,
                }}
              >
                <span className="drop-shadow-sm">{a.icon}</span>
              </button>
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
