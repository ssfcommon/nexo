import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { COMPLEXITIES } from './ui.jsx';

const BREAK_THRESHOLD_MIN = 90;

export default function FocusTracker() {
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showBreak, setShowBreak] = useState(false);
  const [complexity, setComplexity] = useState(COMPLEXITIES[0]);
  const timer = useRef(null);

  const load = async () => {
    const [active, st] = await Promise.all([api.focusActive(), api.focusStats()]);
    setSession(active);
    setStats(st);
    if (st?.breakRecommended) setShowBreak(true);
    if (active) {
      const started = new Date(active.started_at.includes('T') ? active.started_at : active.started_at + 'Z');
      setElapsed(Math.floor((Date.now() - started.getTime()) / 1000));
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (session) {
      timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
      return () => clearInterval(timer.current);
    } else {
      setElapsed(0);
    }
  }, [session]);

  // Check break threshold every minute
  useEffect(() => {
    if (session && session.complexity === 'High Complex' && elapsed >= BREAK_THRESHOLD_MIN * 60) {
      setShowBreak(true);
    }
  }, [elapsed, session]);

  const start = async () => {
    const s = await api.focusStart(complexity);
    setSession(s);
    setShowBreak(false);
  };
  const stop = async () => {
    await api.focusStop();
    setSession(null);
    load();
  };

  const fmtTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-3">
      {/* Break reminder */}
      {showBreak && session && (
        <div className="rounded-card p-3 flex items-start gap-2" style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
          <span className="text-lg">⏰</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-danger">Time for a break</p>
            <p className="text-[12px] text-ink-500">You've been on complex work for {fmtTime(elapsed)}. Take 10 min — stretch, hydrate, or switch to a low-complexity task.</p>
          </div>
          <button onClick={() => setShowBreak(false)} className="text-[11px] text-ink-300">Dismiss</button>
        </div>
      )}

      {/* Active session */}
      <div className="card">
        {session ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center animate-pulse"
              style={{ backgroundColor: session.complexity === 'High Complex' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)' }}>
              <span className="text-lg">{session.complexity === 'High Complex' ? '🔴' : '🟢'}</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-ink-900">{session.complexity}</p>
              <p className="text-[20px] font-bold text-ink-900 tabular-nums">{fmtTime(elapsed)}</p>
            </div>
            <button onClick={stop} className="pill bg-danger text-white !h-9 !px-3 !text-[12px]">Stop</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <select value={complexity} onChange={e => setComplexity(e.target.value)}
              className="h-9 px-2 text-[13px] rounded-[8px] border border-line-light bg-white">
              {COMPLEXITIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={start} className="pill pill-primary !h-9 !px-3 !text-[12px]">Start focus</button>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card border border-line-light px-3 py-2 text-center">
            <p className="text-[16px] font-bold text-danger">{stats.today.high}<span className="text-[11px] font-normal text-ink-300"> min</span></p>
            <p className="text-[10px] text-ink-500">Complex today</p>
          </div>
          <div className="rounded-card border border-line-light px-3 py-2 text-center">
            <p className="text-[16px] font-bold text-success">{stats.today.low}<span className="text-[11px] font-normal text-ink-300"> min</span></p>
            <p className="text-[10px] text-ink-500">Light today</p>
          </div>
          <div className="rounded-card border border-line-light px-3 py-2 text-center">
            <p className="text-[16px] font-bold text-ink-900">{stats.weekAvg.high}<span className="text-[11px] font-normal text-ink-300"> min/day</span></p>
            <p className="text-[10px] text-ink-500">Avg complex (7d)</p>
          </div>
          <div className="rounded-card border border-line-light px-3 py-2 text-center">
            <p className="text-[16px] font-bold text-ink-900">{stats.weekAvg.low}<span className="text-[11px] font-normal text-ink-300"> min/day</span></p>
            <p className="text-[10px] text-ink-500">Avg light (7d)</p>
          </div>
        </div>
      )}
    </div>
  );
}
