import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function AssignmentCard({ n, onChanged }) {
  const [mode, setMode] = useState(null); // null | 'modify' | 'decline'
  const [deadline, setDeadline] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const respond = async (action, extra = {}) => {
    if (!n.subtask_id) return;
    setBusy(true);
    try {
      await api.respondSubtask(n.subtask_id, action, extra);
      onChanged?.();
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-card p-4 border border-line-light bg-white">
      <p className="font-semibold text-[14px] text-ink-900">{n.title}</p>
      {n.body && <p className="text-[13px] text-ink-500 mt-1">{n.body}</p>}
      {!mode && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button disabled={busy} onClick={() => respond('accept')} className="pill bg-success text-white">Accept</button>
          <button disabled={busy} onClick={() => setMode('modify')} className="pill pill-outline">Modify timeline</button>
          <button disabled={busy} onClick={() => setMode('decline')} className="pill pill-outline text-danger">Decline</button>
        </div>
      )}
      {mode === 'modify' && (
        <div className="mt-3 space-y-2">
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full h-10 px-3 rounded-[10px] border border-line-light text-[13px]" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => respond('modify', { deadline })} className="pill pill-primary">Propose</button>
            <button disabled={busy} onClick={() => setMode(null)} className="pill pill-outline">Cancel</button>
          </div>
        </div>
      )}
      {mode === 'decline' && (
        <div className="mt-3 space-y-2">
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional)" className="w-full h-16 px-3 py-2 rounded-[10px] border border-line-light text-[13px]" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => respond('decline', { note })} className="pill bg-danger text-white">Decline</button>
            <button disabled={busy} onClick={() => setMode(null)} className="pill pill-outline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotifCard({ n, onChanged }) {
  if (n.type === 'assignment') return <AssignmentCard n={n} onChanged={onChanged} />;

  const style = {
    reminder:     { bg: '#FFFFFF' },
    poke:         { bg: 'rgba(250,204,21,0.08)' },
    overdue:      { bg: 'rgba(239,68,68,0.05)' },
    optimization: { bg: 'linear-gradient(135deg, #F5F3FF, #EEF1FF)' },
    completed:    { bg: '#FFFFFF' },
    declined:     { bg: 'rgba(239,68,68,0.05)' },
    modified:     { bg: 'rgba(245,158,11,0.08)' },
    accepted:     { bg: 'rgba(34,197,94,0.05)' },
  }[n.type] || { bg: '#FFFFFF' };

  return (
    <div className="rounded-card p-4 border border-line-light" style={{ background: style.bg }}>
      {n.type === 'overdue' && (
        <div className="flex items-center gap-2 mb-2">
          <span className="tag bg-danger text-white">OVERDUE</span>
        </div>
      )}
      {n.type === 'poke' && <div className="text-xl mb-1">👆</div>}
      {n.type === 'optimization' && <div className="text-base mb-1">✨</div>}

      <p className="font-semibold text-[14px] text-ink-900">{n.title}</p>
      {n.body && <p className={'text-[13px] mt-1 ' + (n.type === 'overdue' ? 'text-danger' : 'text-ink-500')}>{n.body}</p>}
    </div>
  );
}

export default function Notifications({ onClose }) {
  const [items, setItems] = useState([]);
  const load = () => api.notifications().then(setItems);
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          {onClose && (
            <button onClick={onClose} className="text-ink-500" aria-label="Close">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
          )}
          <h1 className="text-[26px] font-bold text-ink-900">Notifications</h1>
        </div>
      </div>
      <p className="section-label">Recent</p>
      <div className="space-y-3">
        {items.map(n => <NotifCard key={n.id} n={n} onChanged={load} />)}
        {items.length === 0 && <p className="text-ink-300 text-sm">All caught up.</p>}
      </div>
    </div>
  );
}
