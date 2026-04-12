import React, { useEffect } from 'react';

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onEsc); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-white rounded-t-[20px] sm:rounded-[16px] p-5 pb-6 shadow-modal max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-ink-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors" aria-label="Close">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputCls = 'input-base';
