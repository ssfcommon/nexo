import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPE_META = {
  assignment:        { icon: '📌', accent: '#5B8CFF' },
  completed:         { icon: '✅', accent: '#22C55E' },
  accepted:          { icon: '👍', accent: '#22C55E' },
  declined:          { icon: '✋', accent: '#EF4444' },
  modified:          { icon: '✏️', accent: '#F59E0B' },
  poke:              { icon: '👆', accent: '#FACC15' },
  reminder:          { icon: '⏰', accent: '#5B8CFF' },
  overdue:           { icon: '⚠️', accent: '#EF4444' },
  optimization:      { icon: '✨', accent: '#A78BFA' },
  mention:           { icon: '💬', accent: '#5B8CFF' },
  project_created:   { icon: '📁', accent: '#5B8CFF' },
  subtask_added:     { icon: '➕', accent: '#5B8CFF' },
  subtask_deleted:   { icon: '🗑️', accent: '#6B7280' },
  subtask_completed: { icon: '✔️', accent: '#22C55E' },
  event_reminder:    { icon: '📅', accent: '#5B8CFF' },
  bug_resolved:      { icon: '🐞', accent: '#22C55E' },
  bug_reopened:      { icon: '🔁', accent: '#F59E0B' },
  bug_confirmed:     { icon: '✅', accent: '#3B82F6' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function AssignmentCard({ n, onChanged }) {
  const [mode, setMode] = useState(null);
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

  const meta = TYPE_META[n.type] || TYPE_META.reminder;
  return (
    <div className="rounded-[14px] p-4 border"
      style={{
        background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(91,140,255,0.06)',
        borderColor: n.read ? 'rgba(255,255,255,0.06)' : 'rgba(91,140,255,0.2)',
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-start gap-3">
        <span className="text-[20px]" style={{ filter: `drop-shadow(0 0 6px ${meta.accent}40)` }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-[14px]" style={{ color: '#E5E7EB' }}>{n.title}</p>
            <span className="text-[10px] flex-shrink-0" style={{ color: '#6B7280' }}>{timeAgo(n.created_at)}</span>
          </div>
          {n.body && <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{n.body}</p>}
          {!mode && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button disabled={busy} onClick={() => respond('accept')}
                className="h-8 px-3 rounded-[10px] text-[12px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}>
                Accept
              </button>
              <button disabled={busy} onClick={() => setMode('modify')}
                className="h-8 px-3 rounded-[10px] text-[12px] font-semibold border"
                style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#FBBF24' }}>
                Modify
              </button>
              <button disabled={busy} onClick={() => setMode('decline')}
                className="h-8 px-3 rounded-[10px] text-[12px] font-semibold border"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#F87171' }}>
                Decline
              </button>
            </div>
          )}
          {mode === 'modify' && (
            <div className="mt-3 space-y-2">
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] text-[13px] border"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#E5E7EB' }} />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => respond('modify', { deadline })}
                  className="h-8 px-3 rounded-[10px] text-[12px] font-semibold text-white"
                  style={{ background: '#4A6CF7' }}>Propose</button>
                <button disabled={busy} onClick={() => setMode(null)}
                  className="h-8 px-3 rounded-[10px] text-[12px]" style={{ color: '#9CA3AF' }}>Cancel</button>
              </div>
            </div>
          )}
          {mode === 'decline' && (
            <div className="mt-3 space-y-2">
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional)"
                className="w-full h-16 px-3 py-2 rounded-[10px] text-[13px] border"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#E5E7EB' }} />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => respond('decline', { note })}
                  className="h-8 px-3 rounded-[10px] text-[12px] font-semibold text-white"
                  style={{ background: '#EF4444' }}>Decline</button>
                <button disabled={busy} onClick={() => setMode(null)}
                  className="h-8 px-3 rounded-[10px] text-[12px]" style={{ color: '#9CA3AF' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotifCard({ n, onChanged, onMarkRead }) {
  if (n.type === 'assignment' && n.subtask_id) return <AssignmentCard n={n} onChanged={onChanged} />;

  const meta = TYPE_META[n.type] || { icon: '🔔', accent: '#6B7280' };
  return (
    <div
      role={n.read ? undefined : 'button'}
      onClick={n.read ? undefined : () => onMarkRead?.(n.id)}
      className={'rounded-[14px] p-4 border transition-all ' + (n.read ? '' : 'cursor-pointer hover:border-opacity-60')}
      style={{
        background: n.read ? 'rgba(255,255,255,0.02)' : `${meta.accent}10`,
        borderColor: n.read ? 'rgba(255,255,255,0.06)' : `${meta.accent}33`,
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-start gap-3">
        <span className="text-[20px]" style={{ filter: `drop-shadow(0 0 6px ${meta.accent}40)` }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-[14px]" style={{ color: '#E5E7EB' }}>{n.title}</p>
            <span className="text-[10px] flex-shrink-0" style={{ color: '#6B7280' }}>{timeAgo(n.created_at)}</span>
          </div>
          {n.body && <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{n.body}</p>}
        </div>
        {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: meta.accent, boxShadow: `0 0 6px ${meta.accent}` }} />}
      </div>
    </div>
  );
}

export default function Notifications({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { setItems(await api.notifications()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.markRead(id); } catch {}
  };

  const markAllRead = async () => {
    const unread = items.filter(n => !n.read);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    for (const n of unread) {
      try { await api.markRead(n.id); } catch {}
    }
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          {onClose && (
            <button onClick={onClose} className="text-ink-500" aria-label="Close" style={{ color: '#9CA3AF' }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
          )}
          <h1 className="text-[26px] font-bold" style={{ color: '#E5E7EB' }}>Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(91,140,255,0.15)', color: '#7EB0FF' }}>{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[12px] font-semibold" style={{ color: '#7EB0FF' }}>
            Mark all read
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {loading && items.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: '#6B7280' }}>Loading…</p>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-[40px] mb-2">🔔</div>
            <p className="text-sm" style={{ color: '#6B7280' }}>All caught up.</p>
          </div>
        )}
        {items.map(n => <NotifCard key={n.id} n={n} onChanged={load} onMarkRead={markRead} />)}
      </div>
    </div>
  );
}
