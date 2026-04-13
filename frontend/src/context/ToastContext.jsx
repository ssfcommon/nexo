import React, { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const styles = {
    success: { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.3)', icon: '✓' },
    error:   { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.3)', icon: '✕' },
    warning: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.3)', icon: '⚠' },
    info:    { bg: 'rgba(91,140,255,0.2)', border: 'rgba(91,140,255,0.3)', icon: 'ℹ' },
  };

  const s = styles[toast?.type] || styles.success;

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 text-sm font-medium px-5 py-2.5 rounded-pill z-[60] flex items-center gap-2.5 animate-slide-up"
          style={{ backgroundColor: s.bg, backdropFilter: 'blur(20px)', border: `1px solid ${s.border}`, color: '#E5E7EB', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">{s.icon}</span>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
