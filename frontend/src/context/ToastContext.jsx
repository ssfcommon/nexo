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
    success: { bg: '#111827', icon: '✓' },
    error:   { bg: '#DC2626', icon: '✕' },
    warning: { bg: '#D97706', icon: '⚠' },
    info:    { bg: '#4A6CF7', icon: 'ℹ' },
  };

  const s = styles[toast?.type] || styles.success;

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 text-white text-sm font-medium px-5 py-2.5 rounded-pill z-[60] flex items-center gap-2.5 animate-slide-up"
          style={{ backgroundColor: s.bg, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">{s.icon}</span>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
