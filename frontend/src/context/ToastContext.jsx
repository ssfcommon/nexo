import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckIcon, CloseIcon } from '../components/Icons.jsx';

// ── Icons local to toast (warning + info don't warrant global exports) ──
const WarningIcon = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const InfoIcon = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const STYLES = {
  success: { bg: 'rgba(34,197,94,0.18)',  border: 'rgba(34,197,94,0.35)',  iconColor: '#4ADE80', Icon: CheckIcon },
  error:   { bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.35)',  iconColor: '#F87171', Icon: CloseIcon },
  warning: { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)', iconColor: '#FBBF24', Icon: WarningIcon },
  info:    { bg: 'rgba(91,140,255,0.18)', border: 'rgba(91,140,255,0.35)', iconColor: '#7EB0FF', Icon: InfoIcon },
};

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/**
 * showToast(message, typeOrOptions?)
 *  - Backward compatible: showToast('Saved')        → success, 2.5s
 *                        showToast('Boom', 'error') → error,   2.5s
 *  - Options shape:
 *      { type, duration, action: { label, onClick }, onExpire }
 *    `action.onClick` fires on click and dismisses the toast (timer cancelled,
 *     onExpire is NOT called — this is the Undo path).
 *    `onExpire` fires once when the toast times out without action interaction
 *     (this is where you execute the deferred DB delete).
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const remainingRef = useRef(0);
  const onExpireRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const armTimer = (ms) => {
    clearTimer();
    startRef.current = Date.now();
    remainingRef.current = ms;
    timerRef.current = setTimeout(() => {
      const fn = onExpireRef.current;
      onExpireRef.current = null;
      timerRef.current = null;
      setToast(null);
      if (fn) fn();
    }, ms);
  };

  const dismiss = useCallback((runExpire = false) => {
    clearTimer();
    const fn = onExpireRef.current;
    onExpireRef.current = null;
    setToast(null);
    if (runExpire && fn) fn();
  }, []);

  const showToast = useCallback((message, typeOrOptions = 'success') => {
    // Running expire of the outgoing toast would be surprising — we just drop it
    // and let the new one take over.
    clearTimer();
    onExpireRef.current = null;

    const opts = typeof typeOrOptions === 'string' ? { type: typeOrOptions } : (typeOrOptions || {});
    const type     = opts.type || 'success';
    const duration = opts.duration ?? (opts.action ? 5000 : 2500);
    const action   = opts.action || null;
    onExpireRef.current = opts.onExpire || null;

    setToast({ message, type, action, id: Date.now() });
    armTimer(duration);
  }, []);

  // Pause/resume on hover so fast readers don't miss long messages.
  const pause = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const elapsed = Date.now() - startRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  };

  const resume = () => {
    if (timerRef.current || !toast) return;
    armTimer(remainingRef.current);
  };

  useEffect(() => () => clearTimer(), []);

  const s = STYLES[toast?.type] || STYLES.success;
  const Icon = s.Icon;

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          onMouseEnter={pause}
          onMouseLeave={resume}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 pl-3.5 pr-1.5 py-1.5 rounded-pill animate-slide-up"
          style={{
            backgroundColor: s.bg,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${s.border}`,
            color: '#E5E7EB',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: 'min(92vw, 480px)',
          }}
        >
          <span
            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full"
            style={{ color: s.iconColor, background: 'rgba(255,255,255,0.10)' }}
          >
            <Icon width="11" height="11" />
          </span>

          <span className="text-[13px] font-medium min-w-0 truncate">{toast.message}</span>

          {toast.action && (
            <button
              onClick={() => {
                try { toast.action.onClick(); } catch {}
                dismiss(false); // undo path — skip onExpire
              }}
              className="flex-shrink-0 px-2.5 h-7 rounded-pill text-[12px] font-semibold transition hover:brightness-110 active:scale-95"
              style={{
                color: '#FFFFFF',
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              {toast.action.label}
            </button>
          )}

          <button
            onClick={() => dismiss(true)}  // manual dismiss should still commit expire work
            aria-label="Dismiss"
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-100 hover:bg-white/10 transition"
          >
            <CloseIcon width="12" height="12" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
