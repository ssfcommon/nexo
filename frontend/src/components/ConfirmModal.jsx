import React, { useEffect, useId, useRef } from 'react';

/**
 * Accessible confirmation dialog.
 *  - role="dialog" + aria-modal, labelled by the title
 *  - Focus trap between Cancel/Confirm
 *  - Esc closes, Enter confirms (except when Cancel is focused)
 *  - Initial focus lands on Cancel (safer default for destructive actions)
 *  - Busy copy adapts to destructive flag
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();
  const messageId = useId();

  // Focus management: remember previously-focused element, focus Cancel, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const t = setTimeout(() => cancelRef.current?.focus(), 20);
    return () => {
      clearTimeout(t);
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch {}
      }
    };
  }, [open]);

  // Keyboard: Esc to close, Enter to confirm (unless Cancel is focused), Tab focus trap.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === 'Enter') {
        if (document.activeElement !== cancelRef.current && !busy) {
          e.preventDefault();
          onConfirm?.();
        }
      } else if (e.key === 'Tab') {
        const nodes = dialogRef.current?.querySelectorAll('button:not([disabled])');
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last  = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, onConfirm, busy]);

  if (!open) return null;

  const busyCopy = destructive ? 'Deleting…' : 'Saving…';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="relative rounded-card w-full max-w-[340px] p-5 space-y-4 animate-scale-in"
        style={{
          background: 'rgba(17,24,39,0.9)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-ink-900">{title}</h2>
        {message && <p id={messageId} className="text-sm text-ink-500 leading-relaxed">{message}</p>}
        <div className="flex gap-3 pt-1">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="flex-1 h-11 rounded-pill text-sm font-medium transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF' }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-11 rounded-pill text-sm font-semibold text-white disabled:opacity-60 transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${destructive ? 'bg-danger' : 'bg-brand-blue'}`}
            style={{ boxShadow: destructive ? '0 0 16px rgba(239,68,68,0.3)' : '0 0 16px rgba(91,140,255,0.35)' }}
          >
            {busy ? busyCopy : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
