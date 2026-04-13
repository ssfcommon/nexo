import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, SectionHeader } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import { SkeletonCard, EmptyState } from '../components/Skeleton.jsx';
import useLiveUpdates from '../hooks/useLiveUpdates.js';

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

function TaskCard({ task }) {
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
      className={'rounded-[14px] p-3.5 flex items-center gap-3 transition-all ' + (overdue ? 'overdue-pulse' : '')}
      style={{
        background: `linear-gradient(135deg, ${styles.bgFrom} 0%, ${styles.bgTo} 100%)`,
        border: `1px solid ${styles.border}`,
        borderTopColor: styles.borderTop,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 16px ${styles.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: styles.dot, boxShadow: `0 0 8px ${styles.dot}60` }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: styles.text }}>
          {styles.label}: {task.title}
        </p>
      </div>
      <span className="text-xs font-medium flex-shrink-0 opacity-70" style={{ color: styles.text }}>{relLabel(task.deadline)}</span>
    </div>
  );
}

export default function Home({ me, unreadCount, onOpenNotifications, onSwitchTab }) {
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [activity, setActivity] = useState([]);
  const [myBugs, setMyBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllUrgent, setShowAllUrgent] = useState(false);

  const reloadUrgent = () => api.urgentTasks().then(setTasks);
  const reloadActivity = () => api.activity(8).then(setActivity);
  useLiveUpdates({
    'subtask-updated': reloadActivity,
    'comment-created': reloadActivity,
    'project-created': reloadActivity,
  });

  useEffect(() => {
    Promise.all([
      api.urgentTasks().then(setTasks),
      api.leaves().then(setLeaves),
      api.activity(8).then(setActivity),
      api.myBugs().then(setMyBugs).catch(() => setMyBugs([])),
    ]).finally(() => setLoading(false));
  }, []);

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
            {liveDate()} · <span className="text-ink-700 font-medium">{tasks.length} tasks</span> need attention
          </p>
        </div>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} onOpenProfile={() => onSwitchTab?.('profile')} />
      </div>

      {/* Urgent tasks */}
      <div>
        <SectionHeader title="Urgent Tasks" action={tasks.length > 3 && !showAllUrgent ? 'View All' : null} onAction={() => setShowAllUrgent(true)} />
        <div className="space-y-2.5">
          {loading && tasks.length === 0 ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : tasks.length === 0 ? (
            <EmptyState icon="🎉" title="All caught up" subtitle="No urgent tasks right now." />
          ) : (
            (showAllUrgent ? tasks : tasks.slice(0, 3)).map(t => <TaskCard key={t.id} task={t} />)
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
    </div>
  );
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function fmtRange(a, b) {
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(a)}–${fmt(b).split(' ').pop()}`;
}
