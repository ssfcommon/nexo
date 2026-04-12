import React from 'react';

export default function ConfirmModal({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Delete', destructive = true, busy = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-card shadow-modal w-full max-w-[340px] p-5 space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        {message && <p className="text-sm text-ink-500 leading-relaxed">{message}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 h-11 rounded-pill border border-line-medium text-sm font-medium text-ink-500 hover:bg-ink-100/60 transition-all active:scale-[0.97]">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-11 rounded-pill text-sm font-semibold text-white disabled:opacity-60 transition-all active:scale-[0.97] ${destructive ? 'bg-danger hover:bg-[#DC2626]' : 'bg-brand-blue hover:bg-brand-blueDark'}`}
          >
            {busy ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
