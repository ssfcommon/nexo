import React from 'react';

export default function ConfirmModal({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Delete', destructive = true, busy = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div className="relative rounded-card w-full max-w-[340px] p-5 space-y-4 animate-scale-in"
        style={{
          background: 'rgba(17,24,39,0.9)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        {message && <p className="text-sm text-ink-500 leading-relaxed">{message}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 h-11 rounded-pill text-sm font-medium transition-all active:scale-[0.97]"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-11 rounded-pill text-sm font-semibold text-white disabled:opacity-60 transition-all active:scale-[0.97] ${destructive ? 'bg-danger' : 'bg-brand-blue'}`}
            style={{ boxShadow: destructive ? '0 0 16px rgba(239,68,68,0.3)' : '0 0 16px rgba(91,140,255,0.35)' }}
          >
            {busy ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
