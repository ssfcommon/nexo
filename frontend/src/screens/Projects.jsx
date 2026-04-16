import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { AvatarStack, ProgressBar, deptDotColor } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import { fireConfetti } from '../components/Confetti.jsx';
import AlarmModal from '../components/AlarmModal.jsx';
import RowActions from '../components/RowActions.jsx';
import GlassCard from '../components/GlassCard.jsx';
import FilterChip from '../components/FilterChip.jsx';
import { NewProjectModal, QuickTaskModal } from '../components/QuickActions.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useBackHandler } from '../hooks/useBackHandler.js';
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  FolderIcon,
  TrashIcon,
  RepeatIcon,
} from '../components/Icons.jsx';

// Initial visible row caps — the rest is one click away.
const PROJECT_LIMIT = 6;
const TASK_LIMIT = 5;

// Deadline ASC with nulls last. Past dates bubble to the top on their own.
const byDeadline = (a, b) => {
  const da = a?.deadline || null;
  const db = b?.deadline || null;
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.localeCompare(db);
};

// ── Priority → accent bar ────────────────────────────────────

const PRIORITY_ACCENT = {
  'Urgent & Important':        'red',
  'Urgent & Not Important':    'amber',
  'Not Urgent but Important':  'blue',
  'Not Urgent, Not Important': 'none',
};

const PRIORITY_OPTIONS = [
  'Urgent & Important',
  'Urgent & Not Important',
  'Not Urgent but Important',
  'Not Urgent, Not Important',
];

// ── Quick-task helpers ───────────────────────────────────────

function dueLabel(d) {
  if (!d) return '';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today) return 'Today';
  if (d === tomorrow) return 'Tomorrow';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dueColor(d) {
  if (!d) return '#9CA3AF';
  const today = new Date().toISOString().slice(0, 10);
  if (d <= today) return '#EF4444';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === tomorrow) return '#F59E0B';
  return '#9CA3AF';
}

// ── Filter popover ───────────────────────────────────────────

function FilterPopover({ open, onClose, scope, setScope, departments, department, setDepartment, priority, setPriority }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-[12px] p-3 space-y-3"
        style={{
          background: 'linear-gradient(180deg, rgba(22,24,32,0.98) 0%, rgba(16,18,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderTopColor: 'rgba(255,255,255,0.16)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Scope</p>
          <div className="flex gap-1.5">
            {[{ id: 'mine', label: 'Mine' }, { id: 'all', label: 'All' }].map(s => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className="flex-1 h-8 rounded-md text-[12px] font-semibold transition"
                style={{
                  background: scope === s.id ? 'rgba(91,140,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: scope === s.id ? '#A8C4FF' : '#9CA3AF',
                  border: scope === s.id ? '1px solid rgba(91,140,255,0.30)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Department</p>
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="w-full h-9 px-2.5 rounded-[8px] text-[13px] bg-white/5 text-ink-900 border border-white/10 focus:outline-none focus:border-brand-blue/50"
          >
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Priority</p>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="w-full h-9 px-2.5 rounded-[8px] text-[13px] bg-white/5 text-ink-900 border border-white/10 focus:outline-none focus:border-brand-blue/50"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}

// ── Project card ─────────────────────────────────────────────

function ProjectCard({ project, onOpen }) {
  const accent = PRIORITY_ACCENT[project.priority] || 'none';
  return (
    <GlassCard as="button" accent={accent} onClick={onOpen} className="w-full text-left pl-4 pr-4 py-3.5 hover:bg-white/[0.02] transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-[15px] text-ink-900 leading-snug">{project.title}</h3>
        <AvatarStack users={project.members || []} max={2} />
      </div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: deptDotColor(project.department) }} />
        <span className="text-[12px] text-ink-500">{project.department}</span>
      </div>
      <ProgressBar percent={project.progress} />
    </GlassCard>
  );
}

// ── Quick-task row ───────────────────────────────────────────

function QuickTaskRow({ task, isLast, onToggle, onSetAlarm, onAddToCal, onDelete }) {
  const done = task.status === 'done';
  return (
    <div
      className={'flex items-center gap-3 pl-4 pr-3 py-3 ' + (isLast ? '' : 'border-b')}
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={onToggle}
        aria-label={done ? `Mark ${task.title} pending` : `Complete ${task.title}`}
        className="flex-shrink-0 w-10 h-10 -ml-2 rounded-full flex items-center justify-center group transition-all active:scale-90"
      >
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all group-hover:scale-110"
          style={{
            border: `2px solid ${done ? '#22C55E' : 'rgba(255,255,255,0.35)'}`,
            background: done ? '#22C55E' : 'transparent',
          }}
        >
          {done ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-[13px] h-[13px]">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-[13px] h-[13px] opacity-40 group-hover:opacity-100 transition-opacity">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
      </button>

      <div className={'flex-1 min-w-0 flex flex-col ' + (done ? 'line-through text-ink-400' : 'text-ink-900')}>
        <span className="flex items-center gap-1.5 truncate text-[14px]">
          <span className="truncate">{task.title}</span>
          {task.recurrence && (
            <span className="text-ink-500 flex-shrink-0" title={`Repeats ${task.recurrence}`}>
              <RepeatIcon />
            </span>
          )}
        </span>
        {task.creator_name && task.assigned_by && task.assigned_by !== task.owner_id && (
          <span className="text-[11px] text-ink-500 truncate mt-0.5" title={`Assigned by ${task.creator_name}`}>
            by {task.creator_name.split(' ')[0]}
          </span>
        )}
      </div>

      {!done && (
        <RowActions
          item={task}
          onSetAlarm={onSetAlarm}
          onAddToCal={onAddToCal}
        />
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete ${task.title}`}
        title="Delete task"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-400 hover:text-[#F87171] hover:bg-[#EF4444]/12 transition"
      >
        <TrashIcon />
      </button>

      <span className="text-[12px] font-semibold tabular-nums min-w-[44px] text-right" style={{ color: dueColor(task.deadline) }}>
        {dueLabel(task.deadline)}
      </span>
    </div>
  );
}

// ── Main Projects screen ─────────────────────────────────────

export default function Projects({ me, unreadCount, onOpenNotifications, deepLink, onSwitchTab }) {
  const showToast = useToast();
  const [scope, setScope] = useState('mine');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('');
  const [query, setQuery] = useState('');

  const [projects, setProjects] = useState([]);
  const [quickTasks, setQuickTasks] = useState([]);
  const [openId, setOpenId] = useState(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [alarmTask, setAlarmTask] = useState(null);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const filterWrap = useRef(null);

  useEffect(() => {
    if (deepLink?.kind === 'project' && deepLink.id) setOpenId(deepLink.id);
  }, [deepLink]);

  useBackHandler('project-detail', !!openId, () => { setOpenId(null); loadProjects(); });

  const loadProjects = () => api.projects(scope).then(setProjects);
  const loadTasks = () => api.tasks({ quick: '1', owner: 'me' }).then(setQuickTasks);

  useEffect(() => { loadProjects(); }, [scope]);
  useEffect(() => { loadTasks(); }, []);

  // Client-side filter the fetched list. Project counts are small; DB-side
  // filtering would be premature optimisation.
  //
  // IMPORTANT: these memos must stay above the `if (openId)` early return
  // below. Moving them after the return violates the Rules of Hooks —
  // React will throw "Rendered fewer hooks than expected" when you click
  // a project (openId flips and the memo calls get skipped).
  const departments = useMemo(
    () => Array.from(new Set(projects.map(p => p.department).filter(Boolean))).sort(),
    [projects]
  );

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = projects.filter(p => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (department && p.department !== department) return false;
      if (priority && p.priority !== priority) return false;
      return true;
    });
    // Deadline-urgency ASC; no-deadline last. Tight deadlines surface to the top.
    return [...filtered].sort(byDeadline);
  }, [projects, query, department, priority]);

  // Pending tasks first, then done, each group sorted by deadline ASC (nulls last).
  const sortedTasks = useMemo(() => {
    const pending = [];
    const done = [];
    quickTasks.forEach(t => (t.status === 'done' ? done : pending).push(t));
    pending.sort(byDeadline);
    done.sort(byDeadline);
    return [...pending, ...done];
  }, [quickTasks]);

  if (openId) {
    return <ProjectDetail projectId={openId} me={me} onBack={() => { setOpenId(null); loadProjects(); }} onSwitchTab={onSwitchTab} />;
  }

  const toggleTask = async (t) => {
    try {
      const next = t.status === 'done' ? 'pending' : 'done';
      await api.updateTask(t.id, { status: next });
      if (next === 'done') fireConfetti();
      setQuickTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: next } : x));
    } catch (err) { showToast(err.message || 'Failed to update task', 'error'); }
  };

  // Low-risk delete → optimistic removal + 5s undo toast. DB delete fires on expire.
  const deleteTask = (task) => {
    const prev = quickTasks;
    setQuickTasks(ts => ts.filter(t => t.id !== task.id));
    showToast('Task deleted', {
      action: {
        label: 'Undo',
        onClick: () => setQuickTasks(prev),
      },
      onExpire: async () => {
        try { await api.deleteTask(task.id); }
        catch (err) {
          setQuickTasks(prev);
          showToast(err.message || 'Failed to delete task', 'error');
        }
      },
    });
  };

  const pendingTaskCount = quickTasks.filter(t => t.status !== 'done').length;

  // Chips shown for non-default filters (Mine is default → no chip).
  const chips = [];
  if (scope !== 'mine') chips.push({ label: 'All projects', clear: () => setScope('mine') });
  if (department) chips.push({ label: department, clear: () => setDepartment('') });
  if (priority) chips.push({ label: priority, clear: () => setPriority('') });

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-3xl font-bold text-ink-900 tracking-tight leading-tight">Projects</h1>
          <p className="text-[13px] text-ink-500 mt-1">
            {visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}
            {pendingTaskCount > 0 && <> · {pendingTaskCount} quick {pendingTaskCount === 1 ? 'task' : 'tasks'}</>}
          </p>
        </div>
        <HeaderActions
          me={me}
          unreadCount={unreadCount}
          onOpenNotifications={onOpenNotifications}
          onOpenProfile={() => onSwitchTab?.('profile')}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
            <SearchIcon width="16" height="16" />
          </span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full h-10 pl-9 pr-3 rounded-[10px] text-[13px] bg-white/5 text-ink-900 placeholder:text-ink-400 border border-white/10 focus:outline-none focus:border-brand-blue/50 transition"
          />
        </div>

        <div className="relative" ref={filterWrap}>
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="h-10 px-3 rounded-[10px] text-[13px] font-medium text-ink-700 bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5"
            aria-label="Filter projects"
          >
            <FilterIcon />
            {chips.length > 0 ? <span className="text-brand-blue">· {chips.length}</span> : null}
          </button>
          <FilterPopover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            scope={scope}
            setScope={setScope}
            departments={departments}
            department={department}
            setDepartment={setDepartment}
            priority={priority}
            setPriority={setPriority}
          />
        </div>

        <button
          onClick={() => setAddProjectOpen(true)}
          className="h-10 px-3 rounded-[10px] text-[13px] font-semibold flex items-center gap-1.5 transition"
          style={{
            background: 'linear-gradient(135deg, rgba(91,140,255,0.22) 0%, rgba(91,140,255,0.10) 100%)',
            color: '#A8C4FF',
            border: '1px solid rgba(91,140,255,0.30)',
            boxShadow: '0 0 10px rgba(91,140,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <PlusIcon width="14" height="14" /> Project
        </button>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => <FilterChip key={i} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      {/* Ongoing Projects */}
      <section>
        <p className="section-label mb-3">Ongoing</p>
        {visibleProjects.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <span className="text-ink-400"><FolderIcon /></span>
            </div>
            <p className="text-[15px] font-semibold text-ink-900">
              {projects.length === 0 ? 'No projects yet' : 'No projects match'}
            </p>
            <p className="text-[12px] text-ink-500 mt-1">
              {projects.length === 0 ? 'Create your first project to get started.' : 'Try a different search or adjust the filters.'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setAddProjectOpen(true)}
                className="mt-4 h-9 px-4 rounded-lg text-[12px] font-semibold transition"
                style={{ background: 'rgba(91,140,255,0.15)', color: '#A8C4FF', border: '1px solid rgba(91,140,255,0.30)' }}
              >
                + New project
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {(showAllProjects ? visibleProjects : visibleProjects.slice(0, PROJECT_LIMIT)).map(p => (
              <ProjectCard key={p.id} project={p} onOpen={() => setOpenId(p.id)} />
            ))}
            {visibleProjects.length > PROJECT_LIMIT && (
              <button
                onClick={() => setShowAllProjects(v => !v)}
                className="w-full text-[12px] text-brand-blue text-center pt-1 font-medium hover:underline"
              >
                {showAllProjects ? 'Show less' : `Show all ${visibleProjects.length}`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Quick Tasks */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Quick tasks</p>
          <button
            onClick={() => setAddTaskOpen(true)}
            className="h-7 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition"
            style={{
              background: 'rgba(91,140,255,0.10)',
              color: '#A8C4FF',
              border: '1px solid rgba(91,140,255,0.22)',
            }}
          >
            <PlusIcon width="12" height="12" /> Task
          </button>
        </div>

        {sortedTasks.length === 0 ? (
          <GlassCard className="py-6 text-center">
            <p className="text-[13px] text-ink-500">No quick tasks yet.</p>
          </GlassCard>
        ) : (() => {
          const displayed = showAllTasks ? sortedTasks : sortedTasks.slice(0, TASK_LIMIT);
          return (
            <>
              <GlassCard className="overflow-hidden">
                {displayed.map((t, i) => (
                  <QuickTaskRow
                    key={t.id}
                    task={t}
                    isLast={i === displayed.length - 1}
                    onToggle={() => toggleTask(t)}
                    onSetAlarm={(task) => setAlarmTask(task)}
                    onAddToCal={(task) => {
                      onSwitchTab?.('calendar', { addEvent: task.title });
                      showToast('Opening calendar — add the details');
                    }}
                    onDelete={() => deleteTask(t)}
                  />
                ))}
              </GlassCard>
              {sortedTasks.length > TASK_LIMIT && (
                <button
                  onClick={() => setShowAllTasks(v => !v)}
                  className="w-full text-[12px] text-brand-blue text-center pt-2 font-medium hover:underline"
                >
                  {showAllTasks ? 'Show less' : `Show all ${sortedTasks.length}`}
                </button>
              )}
            </>
          );
        })()}
      </section>

      {/* Modals */}
      <NewProjectModal
        open={addProjectOpen}
        onClose={() => setAddProjectOpen(false)}
        onCreated={() => { showToast('Project created'); loadProjects(); setAddProjectOpen(false); }}
      />

      <QuickTaskModal
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onCreated={() => { showToast('Task added'); loadTasks(); setAddTaskOpen(false); }}
      />

      <AlarmModal
        open={!!alarmTask}
        item={alarmTask}
        kind="task"
        onClose={() => setAlarmTask(null)}
        onSaved={(ts) => setQuickTasks(xs => xs.map(x => x.id === alarmTask.id ? { ...x, alarm_at: ts } : x))}
      />
    </div>
  );
}
