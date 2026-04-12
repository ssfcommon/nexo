import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const TEAM_ACCOUNTS = [
  { phone: '7002857682', name: 'Shaubhik Das',      role: "CEO's Office", initials: 'SD', color: '#4A6CF7' },
  { phone: '6001789483', name: 'Prabal Parashar',    role: 'Operations',   initials: 'PP', color: '#10B981' },
  { phone: '9735005949', name: 'Tanbir Islam',       role: 'Operations',   initials: 'TI', color: '#F59E0B' },
  { phone: '7002861289', name: 'Shuhel Amin Laskar', role: 'Operations',   initials: 'SL', color: '#EF4444' },
];

export default function Login() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const email = `${phone.replace(/\D/g, '')}@farm.app`;
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Invalid phone number or password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-5">
      <div className="w-full max-w-[380px] animate-fade-in">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Nexo" className="w-14 h-14 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
          <p className="text-sm text-ink-500 mt-1">Sign in to continue to Nexo</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="card space-y-4 !p-5">
          <div>
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 7002857682"
              className="input-base mt-1.5"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-base mt-1.5"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-danger bg-danger/5 rounded-input px-3 py-2 border border-danger/10">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-pill bg-brand-blue text-white font-semibold text-base disabled:opacity-60 transition-all hover:bg-brand-blueDark active:scale-[0.98]"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Team accounts */}
        <div className="mt-6">
          <p className="section-label text-center mb-3">Quick access</p>
          <div className="space-y-2">
            {TEAM_ACCOUNTS.map(a => (
              <button
                key={a.phone}
                onClick={() => setPhone(a.phone)}
                className="w-full card card-hover !p-3.5 text-left flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0" style={{ backgroundColor: a.color }}>
                  {a.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{a.name}</p>
                  <p className="text-xs text-ink-400">{a.phone} · {a.role}</p>
                </div>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-300 flex-shrink-0" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ink-400 mt-8">Nexo · Know What's Next to Do</p>
      </div>
    </div>
  );
}
