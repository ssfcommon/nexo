import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { SectionHeader } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import useLiveUpdates from '../hooks/useLiveUpdates.js';
import { useOnRefresh } from '../hooks/usePullToRefresh.js';
import { useToast } from '../context/ToastContext.jsx';
import AlarmModal from '../components/AlarmModal.jsx';
import RowActions from '../components/RowActions.jsx';
import GlassCard from '../components/GlassCard.jsx';
import { BugIcon, UmbrellaIcon, CheckIcon, FolderIcon } from '../components/Icons.jsx';

// ── Helpers ──────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function fmtRange(a, b) {
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(a)}–${fmt(b).split(' ').pop()}`;
}

function urgencyOf(deadline) {
  if (!deadline) return 'none';
  const today = new Date().toISOString().slice(0, 10);
  if (deadline < today) return 'overdue';
  if (deadline === today) return 'due';
  return 'upcoming';
}

// Map urgency → GlassCard accent + time-chip color.
const URGENCY_STYLES = {
  overdue:  { accent: 'red',   chipColor: '#EF4444', pulse: true  },
  due:      { accent: 'amber', chipColor: '#F59E0B', pulse: false },
  upcoming: { accent: 'none',  chipColor: '#9CA3AF', pulse: false },
  none:     { accent: 'none',  chipColor: '#9CA3AF', pulse: false },
};

// ── Task card ────────────────────────────────────────────────

function TaskCard({ task, onComplete, completing, onSetAlarm, onAddToCal }) {
  const urgency = urgencyOf(task.deadline);
  const s = URGENCY_STYLES[urgency];
  const fromCrossAssign = task.creator_name && task.assigned_by && task.assigned_by !== task.owner_id;

  return (
    <GlassCard
      accent={s.accent}
      className={'flex items-center gap-3 pl-4 pr-3.5 py-3 ' + (s.pulse ? 'overdue-pulse' : '') + (completing ? ' opacity-50' : '')}
    >
      {/* Checkbox — 40px tap target, always-visible ring, tick fills on press */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!completing) onComplete(task); }}
        aria-label={`Mark ${task.title} complete`}
        disabled={completing}
        className="flex-shrink-0 w-10 h-10 -ml-2 rounded-full flex items-center justify-center group transition-all active:scale-90"
        style={{ background: 'transparent' }}
      >
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all group-hover:scale-110"
          style={{
            border: `2px solid ${urgency === 'overdue' ? '#EF4444' : urgency === 'due' ? '#F59E0B' : 'rgba(255,255,255,0.35)'}`,
            background: 'transparent',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={urgency === 'overdue' ? '#EF4444' : urgency === 'due' ? '#F59E0B' : 'rgba(255,255,255,0.85)'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[13px] h-[13px] opacity-40 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-ink-900 truncate leading-snug">{task.title}</p>
        {(task.project_title || fromCrossAssign) && (
          <p className="text-[11px] text-ink-500 truncate mt-0.5 flex items-center gap-1.5">
            {task.project_title && (
              <>
                <span className="text-ink-400"><FolderIcon width="12" height="12" /></span>
                <span className="truncate">{task.project_title}</span>
              </>
            )}
            {fromCrossAssign && (
              <span className="truncate" title={`Assigned by ${task.creator_name}`}>
                {task.project_title ? '· ' : ''}by {task.creator_name.split(' ')[0]}
              </span>
            )}
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

      <span
        className="text-[11px] font-semibold flex-shrink-0 tabular-nums"
        style={{ color: s.chipColor }}
      >
        {relLabel(task.deadline)}
      </span>
    </GlassCard>
  );
}

// ── Bug row ──────────────────────────────────────────────────

function BugRow({ bug, intent, onClick }) {
  // intent: 'open' | 'confirm'
  const accent = intent === 'confirm' ? 'green' : (bug.status === 'open' ? 'red' : 'amber');
  const tagColor = intent === 'confirm' ? '#22C55E' : (bug.status === 'open' ? '#EF4444' : '#F59E0B');
  const tagBg = intent === 'confirm' ? 'rgba(34,197,94,0.12)' : (bug.status === 'open' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)');
  const tagLabel = intent === 'confirm' ? 'Confirm?' : (bug.status === 'open' ? 'Open' : 'In Progress');
  const sub = intent === 'confirm'
    ? `${bug.app_name}${bug.assigned_name ? ` · Fixed by ${bug.assigned_name.split(' ')[0]}` : ''}`
    : `${bug.app_name}${bug.deadline ? ` · Due ${bug.deadline}` : ''}`;

  return (
    <GlassCard
      as="button"
      accent={accent}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 pl-4 pr-3.5 py-3"
    >
      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <span className="text-ink-700"><BugIcon width="16" height="16" /></span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-ink-900 truncate leading-snug">{bug.issue}</p>
        <p className="text-[11px] text-ink-500 truncate mt-0.5">{sub}</p>
      </div>
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ color: tagColor, background: tagBg, border: `1px solid ${tagBg.replace('0.12', '0.20')}` }}
      >
        {tagLabel}
      </span>
    </GlassCard>
  );
}

// ── All-clear card ───────────────────────────────────────────

function AllClearCard({ onGoToTasks }) {
  return (
    <GlassCard accent="green" tint="green" className="px-5 py-7 text-center">
      <div
        className="w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-3"
        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
      >
        <span className="text-[#10B981]"><CheckIcon /></span>
      </div>
      <p className="text-[15px] font-semibold text-ink-900">You're all clear for the week</p>
      <p className="text-[12px] text-ink-500 mt-1">No tasks due in the next 7 days.</p>
      <button
        onClick={onGoToTasks}
        className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12px] font-semibold transition-all hover:scale-[1.02] active:scale-95"
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
    </GlassCard>
  );
}

// ── Segmented control ────────────────────────────────────────

function Segmented({ value, onChange, segments }) {
  // segments: [{ id, label, count }]
  return (
    <div
      className="inline-flex p-0.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      {segments.map(seg => {
        const active = seg.id === value;
        return (
          <button
            key={seg.id}
            onClick={() => onChange(seg.id)}
            className="px-2.5 h-7 rounded-md text-[11px] font-semibold transition-all"
            style={{
              background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: active ? '#F3F4F6' : '#9CA3AF',
              border: active ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
              boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
            }}
          >
            {seg.label}
            <span className="ml-1.5 tabular-nums opacity-80">{seg.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Home ─────────────────────────────────────────────────────

export default function Home({ me, unreadCount, onOpenNotifications, onSwitchTab }) {
  const showToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [myBugs, setMyBugs] = useState([]);
  const [bugsToConfirm, setBugsToConfirm] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllUrgent, setShowAllUrgent] = useState(false);
  const [completingIds, setCompletingIds] = useState(() => new Set());
  const [alarmItem, setAlarmItem] = useState(null);

  // Bugs segmented state — default to whichever has items.
  const [bugSeg, setBugSeg] = useState('open');
  useEffect(() => {
    if (myBugs.length === 0 && bugsToConfirm.length > 0) setBugSeg('confirm');
    else if (myBugs.length > 0) setBugSeg('open');
  }, [myBugs.length, bugsToConfirm.length]);

  const reloadTasks = () => api.homeTasks().then(setTasks);
  useLiveUpdates({
    'subtask-updated': reloadTasks,
  });

  // Pull-to-refresh: reload everything on Home
  useOnRefresh(() => {
    api.homeTasks().then(setTasks).catch(() => {});
    api.leaves().then(setLeaves).catch(() => {});
    api.myBugs().then(r => { setMyBugs(r.assigned || []); setBugsToConfirm(r.awaitingConfirm || []); }).catch(() => {});
  });

  useEffect(() => {
    Promise.all([
      api.homeTasks().then(setTasks),
      api.leaves().then(setLeaves),
      api.myBugs().then(result => { setMyBugs(result.assigned || []); setBugsToConfirm(result.awaitingConfirm || []); }).catch(() => { setMyBugs([]); setBugsToConfirm([]); }),
    ]).finally(() => setLoading(false));
  }, []);

  const handleComplete = async (item) => {
    const key = `${item.kind}:${item.id}`;
    setCompletingIds(prev => { const n = new Set(prev); n.add(key); return n; });
    try {
      await api.completeHomeItem(item);
      setTasks(prev => prev.filter(t => !(t.id === item.id && t.kind === item.kind)));
      showToast(item.kind === 'subtask' ? 'Subtask completed' : 'Task completed');
    } catch {
      showToast('Could not mark complete', 'error');
      reloadTasks();
    } finally {
      setCompletingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  // Surface someone-else's leave only if it's currently ongoing or upcoming.
  // Past leaves (end_date < today) are filtered out so the banner doesn't
  // linger after the leave has ended. Prefer the one starting soonest.
  const upcomingLeave = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const eligible = leaves
      .filter(l => l.user_id !== me?.id && l.end_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return eligible[0] || null;
  })();

  const hasBugs = myBugs.length > 0 || bugsToConfirm.length > 0;
  const bothBugSegments = myBugs.length > 0 && bugsToConfirm.length > 0;
  const bugList = bugSeg === 'open' ? myBugs : bugsToConfirm;

  return (
    <div className="space-y-6 pb-24">
      {/* Greeting */}
      <div className="flex items-start justify-between pt-1 gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-3xl font-bold text-ink-900 tracking-tight leading-tight">
            {greeting()}{me ? `, ${me.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-[13px] text-ink-500 mt-1">
            {liveDate()}
            {tasks.length > 0 ? (
              <> · <span className="text-ink-700 font-medium">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span> this week</>
            ) : ' · all clear'}
          </p>
        </div>
        <HeaderActions
          me={me}
          unreadCount={unreadCount}
          onOpenNotifications={onOpenNotifications}
          onOpenProfile={() => onSwitchTab?.('profile')}
        />
      </div>

      {/* This Week */}
      <section>
        <SectionHeader
          title="This Week"
          action={tasks.length > 3 && !showAllUrgent ? 'View all' : null}
          onAction={() => setShowAllUrgent(true)}
        />
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
            <button onClick={() => setShowAllUrgent(false)} className="text-[12px] text-brand-blue w-full text-center pt-1 font-medium">
              Show less
            </button>
          )}
        </div>
      </section>

      {/* Bugs — single merged section with segmented tabs */}
      {hasBugs && (
        <section>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-lg font-semibold text-ink-900">Bugs</h2>
            {bothBugSegments ? (
              <Segmented
                value={bugSeg}
                onChange={setBugSeg}
                segments={[
                  { id: 'open',    label: 'Open',       count: myBugs.length },
                  { id: 'confirm', label: 'To confirm', count: bugsToConfirm.length },
                ]}
              />
            ) : (
              <span className="text-[11px] text-ink-500">
                {myBugs.length > 0 ? `${myBugs.length} open` : `${bugsToConfirm.length} to confirm`}
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {bugList.slice(0, 3).map(b => (
              <BugRow
                key={b.id}
                bug={b}
                intent={bugSeg === 'confirm' ? 'confirm' : 'open'}
                onClick={() => onSwitchTab?.('bugs')}
              />
            ))}
            {bugList.length > 3 && (
              <button
                onClick={() => onSwitchTab?.('bugs')}
                className="text-[12px] text-brand-blue w-full text-center pt-1 font-medium"
              >
                View all {bugList.length}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Leave banner */}
      {upcomingLeave && (
        <GlassCard accent="green" className="px-4 py-3 flex items-center gap-3 text-sm">
          <span className="flex-shrink-0 text-[#10B981]"><UmbrellaIcon /></span>
          <span className="text-ink-700">
            <span className="font-semibold text-ink-900">{upcomingLeave.name?.split(' ')[0]}</span> is on leave {fmtRange(upcomingLeave.start_date, upcomingLeave.end_date)}
            <span className="text-ink-400"> · {cap(upcomingLeave.type)}</span>
          </span>
        </GlassCard>
      )}

      {/* Modals / Sheets */}
      <AlarmModal
        open={!!alarmItem}
        item={alarmItem}
        kind={alarmItem?.kind === 'subtask' ? 'subtask' : 'task'}
        onClose={() => setAlarmItem(null)}
        onSaved={(ts) => {
          setTasks(prev => prev.map(t =>
            t.id === alarmItem.id && t.kind === alarmItem.kind ? { ...t, alarm_at: ts } : t
          ));
        }}
      />

    </div>
  );
}
