import React, { useEffect } from 'react';
import { Avatar } from './ui.jsx';
import { CloseIcon, InboxIcon } from './Icons.jsx';

// Mobile-first full-screen sheet for the team activity feed.
// Slides up from the bottom when `open` is true. Tap the backdrop or the ×
// to close. On wider screens, it renders as a centered modal.
//
// The list content is identical to what used to live inline on Home.jsx
// — we just moved it behind a top-bar icon so it doesn't eat Home's scroll space.

export default function ActivitySheet({ open, items = [], loading = false, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Activity feed"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
        style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-lg sm:rounded-[20px] rounded-t-[20px] overflow-hidden flex flex-col animate-[slideUp_220ms_cubic-bezier(0.32,0.72,0,1)]"
        style={{
          maxHeight: '88vh',
          background: 'linear-gradient(180deg, rgba(20,22,28,0.96) 0%, rgba(14,16,22,0.96) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderTopColor: 'rgba(255,255,255,0.16)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Grabber (mobile sheet affordance) */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Activity</h2>
            <p className="text-[11px] text-ink-500 mt-0.5">Latest team updates</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-500 hover:text-ink-700 hover:bg-white/5 transition"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="px-5 py-6 space-y-3">
              {[0,1,2].map(i => (
                <div key={i} className="h-12 rounded-[12px] bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-12 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <span className="text-ink-500"><InboxIcon /></span>
              </div>
              <p className="text-[15px] font-semibold text-ink-900">No activity yet</p>
              <p className="text-[12px] text-ink-500 mt-1">Team updates will show up here.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {items.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                  <Avatar user={{ initials: a.initials, avatar_color: a.color, avatar_url: a.avatar_url, name: a.actor }} size={32} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-ink-700 leading-relaxed">
                      <span className="font-semibold text-ink-900">{a.actor?.split(' ')[0] || 'System'}</span>{' '}
                      {a.text}
                    </p>
                    {a.context && <p className="text-xs text-ink-400 truncate mt-0.5">{a.context}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
