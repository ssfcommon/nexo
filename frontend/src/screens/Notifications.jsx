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
  deadline_soon:     { icon: '⏳', accent: '#F59E0B' },
  project_completed: { icon: '🎉', accent: '#22C55E' },
  daily_summary:     { icon: '📊', accent: '#A78BFA' },
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

// Small circular button on every card: filled when unread, empty ring when read.
// Click toggles between states. Uses stopPropagation so it doesn't also fire the
// card's own click handler (navigate / mark-read).
function ReadToggle({ read, onToggle, accent = '#5B8CFF' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={read ? 'Mark as unread' : 'Mark as read'}
      title={read ? 'Mark as unread' : 'Mark as read'}
      className="flex-shrink-0 w-3 h-3 rounded-full mt-1.5 transition-all hover:scale-125 active:scale-90"
      style={{
        background: read ? 'transparent' : accent,
        border: read ? '1.5px solid rgba(255,255,255,0.22)' : `1.5px solid ${accent}`,
        boxShadow: read ? 'none' : `0 0 6px ${accent}`,
      }}
    />
  );
}

function AssignmentCard({ n, onChanged, onNavigate, onToggleRead }) {
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
  const canNav = !!(n.project_id || n.subtask_id);
  const navigate = () => { if (canNav) onNavigate?.('projects', { kind: 'project', id: n.project_id }); };
  return (
    <div className="rounded-[14px] p-4 border transition-opacity"
      style={{
        background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(91,140,255,0.06)',
        borderColor: n.read ? 'rgba(255,255,255,0.06)' : 'rgba(91,140,255,0.2)',
        backdropFilter: 'blur(12px)',
        opacity: n.read ? 0.62 : 1,
      }}>
      <div className="flex items-start gap-3">
        <span className="text-[20px]" style={{ filter: `drop-shadow(0 0 6px ${meta.accent}40)` }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div
            role={canNav ? 'button' : undefined}
            onClick={canNav ? navigate : undefined}
            className={canNav ? 'cursor-pointer' : ''}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[14px]" style={{ color: '#E5E7EB' }}>{n.title}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px]" style={{ color: '#6B7280' }}>{timeAgo(n.created_at)}</span>
                <ReadToggle read={n.read} onToggle={() => onToggleRead?.(n)} accent={meta.accent} />
              </div>
            </div>
            {n.body && <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{n.body}</p>}
          </div>
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

function DailySummaryCard({ n, onMarkRead, onToggleRead }) {
  const meta = TYPE_META.daily_summary;
  const m = n.meta || {};
  const handleClick = () => { if (!n.read) onMarkRead?.(n.id); };
  return (
    <div
      role={n.read ? undefined : 'button'}
      onClick={n.read ? undefined : handleClick}
      className={'rounded-[16px] p-5 border transition-all ' + (n.read ? '' : 'cursor-pointer')}
      style={{
        background: n.read
          ? 'rgba(255,255,255,0.03)'
          : 'linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(91,140,255,0.06) 100%)',
        borderColor: n.read ? 'rgba(255,255,255,0.08)' : 'rgba(167,139,250,0.3)',
        backdropFilter: 'blur(12px)',
        boxShadow: n.read ? 'none' : '0 0 24px rgba(167,139,250,0.12)',
        opacity: n.read ? 0.62 : 1,
      }}>
      <div className="flex items-start gap-3">
        <span className="text-[24px]" style={{ filter: `drop-shadow(0 0 8px ${meta.accent}60)` }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-[15px]" style={{ color: '#E5E7EB' }}>{n.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px]" style={{ color: '#6B7280' }}>{timeAgo(n.created_at)}</span>
              <ReadToggle read={n.read} onToggle={() => onToggleRead?.(n)} accent={meta.accent} />
            </div>
          </div>
          {(m.done != null || m.pending != null || m.upcoming != null) && (
            <div className="flex gap-2 mt-2">
              {m.done != null && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#86EFAC' }}>
                  ✅ {m.done} done
                </span>
              )}
              {m.pending != null && m.pending > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}>
                  ⚠️ {m.pending} pending
                </span>
              )}
              {m.upcoming != null && m.upcoming > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(91,140,255,0.15)', color: '#93C5FD' }}>
                  📅 {m.upcoming} tomorrow
                </span>
              )}
            </div>
          )}
          {n.body && (
            <pre className="text-[12.5px] mt-3 whitespace-pre-wrap font-sans leading-relaxed"
              style={{ color: '#CBD5E1', fontFamily: 'inherit' }}>{n.body}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function NotifCard({ n, onChanged, onMarkRead, onToggleRead, onNavigate }) {
  if (n.type === 'assignment' && n.subtask_id) return <AssignmentCard n={n} onChanged={onChanged} onNavigate={onNavigate} onToggleRead={onToggleRead} />;
  if (n.type === 'daily_summary') return <DailySummaryCard n={n} onMarkRead={onMarkRead} onToggleRead={onToggleRead} />;

  const meta = TYPE_META[n.type] || { icon: '🔔', accent: '#6B7280' };
  const canNav = !!(n.project_id || n.subtask_id);
  const handleClick = () => {
    if (!n.read) onMarkRead?.(n.id);
    if (canNav) onNavigate?.('projects', { kind: 'project', id: n.project_id });
  };
  const interactive = canNav || !n.read;
  return (
    <div
      role={interactive ? 'button' : undefined}
      onClick={interactive ? handleClick : undefined}
      className={'rounded-[14px] p-4 border transition-all ' + (interactive ? 'cursor-pointer hover:border-opacity-60' : '')}
      style={{
        background: n.read ? 'rgba(255,255,255,0.02)' : `${meta.accent}10`,
        borderColor: n.read ? 'rgba(255,255,255,0.06)' : `${meta.accent}33`,
        backdropFilter: 'blur(12px)',
        opacity: n.read ? 0.62 : 1,
      }}>
      <div className="flex items-start gap-3">
        <span className="text-[20px]" style={{ filter: `drop-shadow(0 0 6px ${meta.accent}40)` }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-[14px]" style={{ color: '#E5E7EB' }}>{n.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px]" style={{ color: '#6B7280' }}>{timeAgo(n.created_at)}</span>
              <ReadToggle read={n.read} onToggle={() => onToggleRead?.(n)} accent={meta.accent} />
            </div>
          </div>
          {n.body && <p className="text-[13px] mt-1" style={{ color: '#9CA3AF' }}>{n.body}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Notifications({ onClose, onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const load = async () => {
    setLoading(true);
    try { setItems(await api.notifications()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.markRead(id); } catch {}
  };

  // Toggle a single notification's read/unread state. Called from ReadToggle
  // on every card type.
  const toggleRead = async (n) => {
    const next = !n.read;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: next } : x));
    try {
      if (next) await api.markRead(n.id);
      else await api.markUnread(n.id);
    } catch {
      // Revert on error
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: !next } : x));
    }
  };

  const markAllRead = async () => {
    const unread = items.filter(n => !n.read);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    for (const n of unread) {
      try { await api.markRead(n.id); } catch {}
    }
  };

  const unreadCount = items.filter(n => !n.read).length;
  const visible = filter === 'unread' ? items.filter(n => !n.read) : items;

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

      {/* Filter tabs: All / Unread */}
      <div
        className="inline-flex gap-1 p-1 rounded-[12px]"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {[
          { id: 'all', label: 'All', count: items.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
        ].map(tab => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="h-7 px-3 rounded-[8px] text-[12px] font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: active ? 'rgba(91,140,255,0.18)' : 'transparent',
                color: active ? '#7EB0FF' : '#9CA3AF',
                boxShadow: active ? 'inset 0 0 0 1px rgba(91,140,255,0.28)' : 'none',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(91,140,255,0.22)' : 'rgba(255,255,255,0.06)',
                    color: active ? '#7EB0FF' : '#6B7280',
                    minWidth: '18px',
                    textAlign: 'center',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
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
        {!loading && items.length > 0 && visible.length === 0 && (
          <div className="text-center py-10">
            <div className="text-[32px] mb-2">✨</div>
            <p className="text-sm" style={{ color: '#6B7280' }}>No unread notifications.</p>
          </div>
        )}
        {visible.map(n => (
          <NotifCard
            key={n.id}
            n={n}
            onChanged={load}
            onMarkRead={markRead}
            onToggleRead={toggleRead}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
