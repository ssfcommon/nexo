import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { AvatarStack, PriorityTag, ProgressBar, Pill, deptDotColor } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import { fireConfetti } from '../components/Confetti.jsx';
import { AlarmIcon, CalendarIcon } from '../components/Icons.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ASSET_ORIGIN } from '../api.js';
import { Avatar, COMPLEXITIES } from '../components/ui.jsx';

// ── Bug Tracker ──
function BugTracker({ me, users }) {
  const [bugs, setBugs] = useState([]);
  const [apps, setApps] = useState([]);
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [appName, setAppName] = useState('');
  const [issue, setIssue] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.bugs(filter || undefined).then(setBugs);
    api.bugApps().then(setApps);
  };
  useEffect(() => { load(); }, [filter]);

  const readFile = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  const submit = async (e) => {
    e.preventDefault();
    if (!appName.trim() || !issue.trim()) return;
    setBusy(true);
    try {
      let screenshotDataUrl = null;
      if (screenshot) screenshotDataUrl = await readFile(screenshot);
      await api.createBug({ appName: appName.trim(), issue: issue.trim(), screenshotDataUrl, assignedTo: assignedTo ? Number(assignedTo) : null, deadline: deadline || null });
      setAddOpen(false); setAppName(''); setIssue(''); setScreenshot(null); setAssignedTo(''); setDeadline('');
      load();
    } finally { setBusy(false); }
  };

  const statusColor = (s) => s === 'open' ? '#EF4444' : s === 'in_progress' ? '#F59E0B' : '#22C55E';

  return (
    <div className="space-y-4">
      {/* Filter + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 px-3 text-[13px] rounded-[10px] border border-line-light bg-white flex-1 min-w-[140px]">
          <option value="">All Apps</option>
          {apps.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => {
          const rows = [['#','App','Issue','Status','Assigned','Deadline']];
          bugs.forEach((b,i) => rows.push([i+1, b.app_name, `"${(b.issue||'').replace(/"/g,'""')}"`, b.status, b.assigned_name||'', b.deadline||'']));
          const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `bugs-${filter||'all'}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
        }} className="w-9 h-9 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA]" title="Download CSV">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button onClick={() => setAddOpen(true)} className="pill pill-primary !h-9 !px-3 !text-[12px]">+ Bug</button>
      </div>

      {/* Bug list */}
      {(() => {
        const activeBugs = bugs.filter(b => b.status !== 'resolved');
        const resolvedBugs = bugs.filter(b => b.status === 'resolved');
        const displayBugs = showResolved ? bugs : activeBugs;

        return (
          <>
            {displayBugs.length === 0 && !resolvedBugs.length && (
              <div className="text-center py-8 text-ink-300 text-[13px]">No bugs reported{filter ? ` for ${filter}` : ''}.</div>
            )}
            {displayBugs.length === 0 && resolvedBugs.length > 0 && !showResolved && (
              <div className="text-center py-8 text-ink-300 text-[13px]">All bugs resolved! 🎉</div>
            )}
            <div className="space-y-2">
              {displayBugs.map((b, i) => {
                const isResolved = b.status === 'resolved';
                return (
                  <div key={b.id} className={'card !p-3 transition-opacity ' + (isResolved ? 'opacity-50' : '')}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor(b.status) }} />
                          <span className={'text-[11px] font-semibold uppercase ' + (isResolved ? 'text-ink-300 line-through' : 'text-ink-300')}>{b.app_name}</span>
                          <span className="text-[11px] text-ink-300">#{i + 1}</span>
                          <select value={b.status} onChange={async (e) => { await api.updateBug(b.id, { status: e.target.value }); load(); }}
                            className="inline-control ml-auto h-6 px-1 text-[10px] rounded border border-line-light bg-white">
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                        <p className={'text-[13px] ' + (isResolved ? 'text-ink-400 line-through' : 'text-ink-900')}>{b.issue}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-500">
                          {b.assigned_name && <span className="flex items-center gap-1">
                            <Avatar user={{ initials: b.assigned_initials, avatar_color: b.assigned_color, avatar_url: b.assigned_avatar }} size={16} />
                            {b.assigned_name.split(' ')[0]}
                          </span>}
                          {b.deadline && <span>Due {b.deadline}</span>}
                          <span>by {b.reporter_name?.split(' ')[0]}</span>
                        </div>
                      </div>
              {b.screenshot_url && (
                <a href={ASSET_ORIGIN + b.screenshot_url} target="_blank" rel="noreferrer">
                  <img src={ASSET_ORIGIN + b.screenshot_url} alt="screenshot" className="w-16 h-16 rounded-[6px] object-cover border border-line-light flex-shrink-0" />
                </a>
              )}
            </div>
          </div>
                );
              })}
            </div>

            {/* Resolved toggle */}
            {resolvedBugs.length > 0 && (
              <button
                onClick={() => setShowResolved(v => !v)}
                className="w-full text-center text-[12px] font-medium text-ink-400 hover:text-ink-700 py-2 transition"
              >
                {showResolved ? 'Hide' : 'Show'} {resolvedBugs.length} resolved bug{resolvedBugs.length !== 1 ? 's' : ''}
              </button>
            )}
          </>
        );
      })()}

      {/* Add Bug Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Report a Bug">
        <form onSubmit={submit}>
          <Field label="App Name"><input className={inputCls} value={appName} onChange={e => setAppName(e.target.value)} required autoFocus placeholder="e.g. Nexo, HRM Tool, Website" /></Field>
          <Field label="Issue"><textarea className={inputCls + ' !h-20 py-2'} value={issue} onChange={e => setIssue(e.target.value)} required placeholder="Describe the bug…" /></Field>
          <Field label="Screenshot (optional)">
            <label className="cursor-pointer">
              <span className="pill pill-outline !h-8 !px-3 !text-[12px]">{screenshot ? `📎 ${screenshot.name}` : '📸 Choose image'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setScreenshot(e.target.files?.[0] || null)} />
            </label>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assign to">
              <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Deadline">
              <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} />
            </Field>
          </div>
          <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-danger text-white font-semibold disabled:opacity-60">{busy ? 'Reporting…' : 'Report Bug'}</button>
        </form>
      </Modal>
    </div>
  );
}

// ── Main Projects ──
export default function Projects({ me, unreadCount, onOpenNotifications, deepLink, onSwitchTab }) {
  const showToast = useToast();
  const [scope, setScope] = useState('mine');
  const [projects, setProjects] = useState([]);
  const [quickTasks, setQuickTasks] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [section, setSection] = useState('projects'); // 'projects' | 'bugs'
  const [allUsers, setAllUsers] = useState([]);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  useEffect(() => { api.users().then(setAllUsers); }, []);

  useEffect(() => {
    if (deepLink?.kind === 'project' && deepLink.id) setOpenId(deepLink.id);
  }, [deepLink]);

  const loadProjects = () => api.projects(scope).then(setProjects);

  useEffect(() => {
    api.tasks({ quick: '1', owner: 'me' }).then(setQuickTasks);
  }, []);

  useEffect(() => { loadProjects(); }, [scope]);

  if (openId) {
    return <ProjectDetail projectId={openId} me={me} onBack={() => { setOpenId(null); loadProjects(); }} />;
  }

  const toggleTask = async (t) => {
    const next = t.status === 'done' ? 'pending' : 'done';
    await api.updateTask(t.id, { status: next });
    if (next === 'done') fireConfetti();
    setQuickTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: next } : x));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{section === 'bugs' ? 'Bug Tracker' : 'My Active Projects'}</h1>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} />
      </div>

      {/* Section toggle */}
      <div className="flex gap-1 bg-ink-100 rounded-full p-0.5 mb-1">
        <button onClick={() => setSection('projects')} className={'flex-1 h-9 rounded-full text-sm font-semibold transition ' + (section === 'projects' ? 'card text-ink-900 shadow-sm !p-0 !border-0' : 'text-ink-500')}>Projects</button>
        <button onClick={() => setSection('bugs')} className={'flex-1 h-9 rounded-full text-sm font-semibold transition ' + (section === 'bugs' ? 'card text-ink-900 shadow-sm !p-0 !border-0' : 'text-ink-500')}>Bug Tracker</button>
      </div>

      {section === 'bugs' ? (
        <BugTracker me={me} users={allUsers} />
      ) : <>

      {/* Tabs */}
      <div className="flex gap-2">
        <Pill active={scope === 'mine'} onClick={() => setScope('mine')}>My Projects</Pill>
        <Pill active={scope === 'all'} onClick={() => setScope('all')}>All Projects</Pill>
      </div>

      {/* Ongoing */}
      <div>
        <p className="section-label mb-3">Ongoing Projects</p>
        <div className="space-y-3">
          {projects.map(p => (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="card text-left w-full hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-[16px] text-ink-900">{p.title}</h3>
                <AvatarStack users={p.members || []} max={2} />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: deptDotColor(p.department) }} />
                  <span className="text-[13px] text-ink-500">{p.department}</span>
                </div>
                <PriorityTag priority={p.priority} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1"><ProgressBar percent={p.progress} /></div>
                <span className="text-[13px] font-semibold text-brand-blue">{p.progress}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick tasks */}
      <div>
        <p className="section-label mb-2">Quick Tasks</p>
        <div className="bg-white rounded-card border border-line-light">
          {quickTasks.map((t, i) => (
            <div
              key={t.id}
              className={'flex items-center gap-3 px-4 py-3 ' + (i < quickTasks.length - 1 ? 'border-b border-[#F3F4F6]' : '')}
            >
              <button
                onClick={() => toggleTask(t)}
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: t.status === 'done' ? '#22C55E' : '#D1D5DB', backgroundColor: t.status === 'done' ? '#22C55E' : 'transparent' }}
              >
                {t.status === 'done' && <span className="text-white text-xs">✓</span>}
              </button>
              <span className={'flex-1 text-[14px] flex items-center gap-2 ' + (t.status === 'done' ? 'line-through text-ink-300' : 'text-ink-900')}>
                <span>{t.title}</span>
                {t.recurrence && <span className="text-[11px] text-ink-500" title={`Repeats ${t.recurrence}`}>🔁</span>}
              </span>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const time = prompt('Set alarm time (YYYY-MM-DD HH:MM):', t.deadline ? t.deadline + ' 09:00' : '');
                  if (time) { await api.setAlarm(t.id, time); setQuickTasks(ts => ts.map(x => x.id === t.id ? { ...x, alarm_at: time } : x)); }
                }}
                className={'text-ink-300 hover:text-warn transition ' + (t.alarm_at ? 'text-warn' : '')}
                title={t.alarm_at ? `Alarm: ${t.alarm_at}` : 'Set alarm'}
              ><AlarmIcon /></button>
              <button
                onClick={(e) => { e.stopPropagation(); onSwitchTab?.('calendar', { addEvent: t.title }); }}
                className="text-ink-300 hover:text-brand-blue transition"
                title="Add to calendar"
              ><CalendarIcon /></button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteTaskId(t.id); }} className="text-ink-300 hover:text-danger transition" title="Delete task">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
              <span className="text-[13px]" style={{ color: dueColor(t.deadline) }}>{dueLabel(t.deadline)}</span>
            </div>
          ))}
          {quickTasks.length === 0 && <p className="p-4 text-ink-300 text-sm">No quick tasks.</p>}
        </div>
      </div>
      </>}
      <ConfirmModal
        open={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        onConfirm={async () => {
          await api.deleteTask(deleteTaskId);
          setQuickTasks(ts => ts.filter(t => t.id !== deleteTaskId));
          setDeleteTaskId(null);
          showToast('Task deleted');
        }}
      />
    </div>
  );
}

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
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today || d < today) return '#EF4444';
  if (d === tomorrow) return '#F59E0B';
  return '#6B7280';
}
