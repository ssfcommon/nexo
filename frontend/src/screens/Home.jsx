import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, SectionHeader } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import { SkeletonCard, EmptyState } from '../components/Skeleton.jsx';
import useLiveUpdates from '../hooks/useLiveUpdates.js';
import { useToast } from '../context/ToastContext.jsx';
import AlarmModal from '../components/AlarmModal.jsx';
import RowActions from '../components/RowActions.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function liveDate() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
}

function relLabel(deadline) {
  if (!deadline) return '';
  const now = new Date();
  const end = new Date(deadline + 'T23:59:59');
  let diffMs = end - now;
  const past = diffMs < 0;
  diffMs = Math.abs(diffMs);
  const mins = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);
  const pretty = mins < 60 ? `${mins}m` : hours < 24 ? `${hours}h` : `${days}d`;
  return past ? `${pretty} ago` : `in ${pretty}`;
}

function TaskCard({ task, onComplete, completing, onSetAlarm, onAddToCal }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = task.deadline && task.deadline < today;
  const dueToday = task.deadline === today;
  const state = overdue ? 'overdue' : dueToday ? 'due' : 'upcoming';
  const styles = {
    overdue:  { dot: '#EF4444', bgFrom: 'rgba(239,68,68,0.14)', bgTo: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.20)', borderTop: 'rgba(239,68,68,0.30)', glow: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'Overdue' },
    due:      { dot: '#F59E0B', bgFrom: 'rgba(245,158,11,0.14)', bgTo: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.20)', borderTop: 'rgba(245,158,11,0.30)', glow: 'rgba(245,158,11,0.12)', text: '#D97706', label: 'Due Today' },
    upcoming: { dot: '#5B8CFF', bgFrom: 'rgba(91,140,255,0.12)', bgTo: 'rgba(91,140,255,0.04)', border: 'rgba(91,140,255,0.18)', borderTop: 'rgba(91,140,255,0.28)', glow: 'rgba(91,140,255,0.10)', text: '#5B8CFF', label: 'Upcoming' },
  }[state];

  return (
    <div
      className={'rounded-[14px] p-3.5 flex items-center gap-3 transition-all ' + (overdue ? 'overdue-pulse' : '') + (completing ? ' opacity-50' : '')}
      style={{
        background: `linear-gradient(135deg, ${styles.bgFrom} 0%, ${styles.bgTo} 100%)`,
        border: `1px solid ${styles.border}`,
        borderTopColor: styles.borderTop,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 16px ${styles.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Complete button — circular checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!completing) onComplete(task); }}
        aria-label={`Mark ${task.title} complete`}
        disabled={completing}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
        style={{
          borderColor: styles.dot,
          backgroundColor: 'transparent',
        }}
      >
        {/* Check mark appears on hover */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={styles.dot}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: styles.text }}>
          {styles.label}: {task.title}
        </p>
        {task.project_title && (
          <p className="text-[11px] truncate mt-0.5 flex items-center gap-1" style={{ color: styles.text, opacity: 0.65 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="truncate">{task.project_title}</span>
          </p>
        )}
      </div>
      {(onSetAlarm || onAddToCal) && (
        <RowActions
          item={task}
          size="sm"
          onSetAlarm={onSetAlarm}
          onAddToCal={onAddToCal}
        />
      )}
      <span className="text-xs font-medium flex-shrink-0 opacity-70" style={{ color: styles.text }}>{relLabel(task.deadline)}</span>
    </div>
  );
}

function AllClearCard({ onGoToTasks }) {
  return (
    <div
      className="rounded-[16px] px-5 py-7 text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.03) 100%)',
        border: '1px solid rgba(16,185,129,0.18)',
        borderTopColor: 'rgba(16,185,129,0.26)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25), 0 0 20px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div className="w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <p className="text-[15px] font-semibold text-ink-900">You're all clear for the week</p>
      <p className="text-[12px] text-ink-500 mt-1">No tasks due in the next 7 days.</p>
      <button
        onClick={onGoToTasks}
        className="mt-4 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] font-semibold transition-all hover:scale-[1.02] active:scale-95"
        style={{
          backgroundColor: 'rgba(91,140,255,0.12)',
          color: '#5B8CFF',
          border: '1px solid rgba(91,140,255,0.25)',
        }}
      >
        Go to All Tasks
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

export default function Home({ me, unreadCount, onOpenNotifications, onSwitchTab }) {
  const showToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [activity, setActivity] = useState([]);
  const [myBugs, setMyBugs] = useState([]);
  const [bugsToConfirm, setBugsToConfirm] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllUrgent, setShowAllUrgent] = useState(false);
  const [completingIds, setCompletingIds] = useState(() => new Set());
  const [alarmItem, setAlarmItem] = useState(null); // { id, title, deadline, alarm_at, kind }

  const reloadTasks = () => api.homeTasks().then(setTasks);
  const reloadActivity = () => api.activity(8).then(setActivity);
  useLiveUpdates({
    'subtask-updated': () => { reloadActivity(); reloadTasks(); },
    'comment-created': reloadActivity,
    'project-created': reloadActivity,
  });

  useEffect(() => {
    Promise.all([
      api.homeTasks().then(setTasks),
      api.leaves().then(setLeaves),
      api.activity(8).then(setActivity),
      api.myBugs().then(result => { setMyBugs(result.assigned || []); setBugsToConfirm(result.awaitingConfirm || []); }).catch(() => { setMyBugs([]); setBugsToConfirm([]); }),
    ]).finally(() => setLoading(false));
  }, []);

  const handleComplete = async (item) => {
    const key = `${item.kind}:${item.id}`;
    setCompletingIds(prev => { const n = new Set(prev); n.add(key); return n; });
    try {
      await api.completeHomeItem(item);
      // Optimistic: drop from list immediately
      setTasks(prev => prev.filter(t => !(t.id === item.id && t.kind === item.kind)));
      showToast(item.kind === 'subtask' ? 'Subtask completed' : 'Task completed');
    } catch (e) {
      showToast('Could not mark complete', 'error');
      // Reload to recover truth
      reloadTasks();
    } finally {
      setCompletingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const upcomingLeave = leaves.find(l => l.user_id !== me?.id);

  return (
    <div className="space-y-7">
      {/* Greeting */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
            {greeting()}{me ? `,` : ''}
            {me && <br />}
            {me && <span>{me.name.split(' ')[0]}</span>}
          </h1>
          <p className="text-sm text-ink-500 mt-1.5">
            {liveDate()}{tasks.length > 0 ? (<> · <span className="text-ink-700 font-medium">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span> need attention</>) : ' · all clear for now'}
          </p>
        </div>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} onOpenProfile={() => onSwitchTab?.('profile')} />
      </div>

      {/* This week */}
      <div>
        <SectionHeader title="This Week" action={tasks.length > 3 && !showAllUrgent ? 'View All' : null} onAction={() => setShowAllUrgent(true)} />
        <div className="space-y-2.5">
          {loading && tasks.length === 0 ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : tasks.length === 0 ? (
            <AllClearCard onGoToTasks={() => onSwitchTab?.('projects')} />
          ) : (
            (showAllUrgent ? tasks : tasks.slice(0, 3)).map(t => (
              <TaskCard
                key={`${t.kind}:${t.id}`}
                task={t}
                onComplete={handleComplete}
                completing={completingIds.has(`${t.kind}:${t.id}`)}
                onSetAlarm={(item) => setAlarmItem(item)}
                onAddToCal={(item) => {
                  onSwitchTab?.('calendar', { addEvent: item.title });
                  showToast('Opening calendar — add the details');
                }}
              />
            ))
          )}
          {showAllUrgent && tasks.length > 3 && (
            <button onClick={() => setShowAllUrgent(false)} className="text-xs text-brand-blue w-full text-center pt-1 font-medium">Show less</button>
          )}
        </div>
      </div>


      {/* Assigned Bugs */}
      {myBugs.length > 0 && (
        <div>
          <SectionHeader title="Bugs Assigned to You" />
          <div className="space-y-2.5">
            {myBugs.slice(0, 3).map(b => (
              <button
                key={b.id}
                onClick={() => onSwitchTab?.('projects', { kind: 'bugs' })}
                className="w-full text-left rounded-[14px] p-3.5 flex items-center gap-3 transition-all"
                style={{
                  background: b.status === 'open'
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0.05) 100%)'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.05) 100%)',
                  border: `1px solid ${b.status === 'open' ? 'rgba(239,68,68,0.20)' : 'rgba(245,158,11,0.20)'}`,
                  borderTopColor: b.status === 'open' ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${b.status === 'open' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                }}
              >
                <span className="text-base">🐛</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">{b.issue}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{b.app_name}{b.deadline ? ` · Due ${b.deadline}` : ''}</p>
                </div>
                <span className="tag" style={{
                  color: b.status === 'open' ? '#EF4444' : '#F59E0B',
                  backgroundColor: b.status === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                }}>{b.status === 'open' ? 'Open' : 'In Progress'}</span>
              </button>
            ))}
            {myBugs.length > 3 && (
              <button onClick={() => onSwitchTab?.('projects', { kind: 'bugs' })} className="text-xs text-brand-blue w-full text-center pt-1 font-medium">View all {myBugs.length} bugs</button>
            )}
          </div>
        </div>
      )}

      {/* Bugs Awaiting Confirmation */}
      {bugsToConfirm.length > 0 && (
        <div>
          <SectionHeader title="Bugs Awaiting Your Confirmation" />
          <div className="space-y-2.5">
            {bugsToConfirm.slice(0, 3).map(b => (
              <button
                key={b.id}
                onClick={() => onSwitchTab?.('projects', { kind: 'bugs' })}
                className="w-full text-left rounded-[14px] p-3.5 flex items-center gap-3 transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(34,197,94,0.05) 100%)',
                  border: '1px solid rgba(34,197,94,0.20)',
                  borderTopColor: 'rgba(34,197,94,0.30)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 12px rgba(34,197,94,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <span className="text-base">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">{b.issue}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{b.app_name}{b.assigned_name ? ` · Fixed by ${b.assigned_name.split(' ')[0]}` : ''}</p>
                </div>
                <span className="tag" style={{ color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)' }}>Confirm?</span>
              </button>
            ))}
            {bugsToConfirm.length > 3 && (
              <button onClick={() => onSwitchTab?.('projects', { kind: 'bugs' })} className="text-xs text-brand-blue w-full text-center pt-1 font-medium">View all {bugsToConfirm.length} bugs</button>
            )}
          </div>
        </div>
      )}

      {/* Leave banner */}
      {upcomingLeave && (
        <div className="rounded-[14px] px-4 py-3 flex items-center gap-2.5 text-sm" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(16,185,129,0.20)', borderTopColor: 'rgba(16,185,129,0.30)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 12px rgba(16,185,129,0.10), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <span className="text-base">🏖️</span>
          <span className="text-ink-700">
            <span className="font-medium text-ink-900">{upcomingLeave.name?.split(' ')[0]}</span> is on leave {fmtRange(upcomingLeave.start_date, upcomingLeave.end_date)}
            <span className="text-ink-400"> · {cap(upcomingLeave.type)}</span>
          </span>
        </div>
      )}

      {/* Activity feed */}
      <div>
        <SectionHeader title="Activity Feed" action={activity.length > 3 && !showAllActivity ? 'View All' : null} onAction={() => setShowAllActivity(true)} />
        <div className="space-y-3">
          {loading && activity.length === 0 ? (
            <><SkeletonCard lines={1} /><SkeletonCard lines={1} /></>
          ) : activity.length === 0 ? (
            <EmptyState icon="📭" title="No activity yet" subtitle="Team updates will show up here." />
          ) : (
            <div className="rounded-[14px] divide-y divide-white/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(16px)', boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              {(showAllActivity ? activity : activity.slice(0, 3)).map(a => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar user={{ initials: a.initials, avatar_color: a.color, avatar_url: a.avatar_url, name: a.actor }} size={30} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-ink-700 leading-relaxed">
                      <span className="font-semibold text-ink-900">{a.actor?.split(' ')[0] || 'System'}</span>{' '}
                      {a.text}
                    </p>
                    {a.context && <p className="text-xs text-ink-400 truncate mt-0.5">{a.context}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {showAllActivity && activity.length > 3 && (
            <button onClick={() => setShowAllActivity(false)} className="text-xs text-brand-blue w-full text-center pt-1 font-medium">Show less</button>
          )}
        </div>
      </div>

      <AlarmModal
        open={!!alarmItem}
        item={alarmItem}
        kind={alarmItem?.kind === 'subtask' ? 'subtask' : 'task'}
        onClose={() => setAlarmItem(null)}
        onSaved={(ts) => {
          // Patch the row in place so the amber accent appears immediately.
          setTasks(prev => prev.map(t =>
            t.id === alarmItem.id && t.kind === alarmItem.kind ? { ...t, alarm_at: ts } : t
          ));
        }}
      />
    </div>
  );
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function fmtRange(a, b) {
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(a)}–${fmt(b).split(' ').pop()}`;
}
