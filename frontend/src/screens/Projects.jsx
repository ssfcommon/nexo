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
import { ReportBugModal } from '../components/QuickActions.jsx';

// ── Bug Detail Modal ──
function BugDetailModal({ open, onClose, bug, users, onUpdated }) {
  const showToast = useToast();
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && bug) {
      setStatus(bug.status);
      setResolution(bug.metadata?.resolution || '');
      setAssignedTo(bug.assigned_to || '');
    }
  }, [open, bug]);

  const save = async () => {
    setBusy(true);
    try {
      const patch = { status };
      if (resolution.trim()) patch.resolution = resolution.trim();
      if (assignedTo !== (bug.assigned_to || '')) patch.assignedTo = assignedTo ? Number(assignedTo) : null;
      await api.updateBug(bug.id, patch);
      showToast(status === 'resolved' ? 'Bug resolved ✓' : 'Bug updated');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to update bug', 'error'); } finally { setBusy(false); }
  };

  if (!bug) return null;
  const statusColor = bug.status === 'open' ? '#EF4444' : bug.status === 'in_progress' ? '#F59E0B' : '#22C55E';

  return (
    <Modal open={open} onClose={onClose} title="Bug Details">
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor }} />
          <span className="text-[12px] font-bold uppercase text-ink-400">{bug.app_name}</span>
          <span className="ml-auto text-[11px] text-ink-300">Reported by {bug.reporter_name?.split(' ')[0] || '—'}</span>
        </div>

        {/* Issue */}
        <p className="text-[15px] text-ink-900 leading-relaxed">{bug.issue}</p>

        {/* Screenshots */}
        {(() => {
          const allUrls = [bug.screenshot_url, ...(bug.metadata?.extra_screenshots || [])].filter(Boolean);
          if (!allUrls.length) return null;
          return (
            <div className="flex gap-2 flex-wrap">
              {allUrls.map((url, i) => (
                <a key={i} href={url.startsWith('http') ? url : ASSET_ORIGIN + url} target="_blank" rel="noreferrer">
                  <img src={url.startsWith('http') ? url : ASSET_ORIGIN + url} alt={`screenshot ${i + 1}`}
                    className={allUrls.length === 1 ? 'w-full max-h-48 rounded-[10px] object-cover border border-line-light' : 'w-24 h-24 rounded-[8px] object-cover border border-line-light'} />
                </a>
              ))}
            </div>
          );
        })()}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-[12px] text-ink-500">
          {bug.deadline && <span>📅 Due {bug.deadline}</span>}
          <span>🕒 {new Date(bug.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <hr className="border-line-light" />

        {/* Status */}
        <Field label="Status">
          <div className="flex gap-2">
            {[['open', 'Open', '#EF4444'], ['in_progress', 'In Progress', '#F59E0B'], ['resolved', 'Resolved', '#22C55E']].map(([val, label, color]) => (
              <button key={val} type="button" onClick={() => setStatus(val)}
                className="flex-1 h-10 rounded-[10px] text-[13px] font-semibold transition-all border-2"
                style={{
                  borderColor: status === val ? color : 'transparent',
                  backgroundColor: status === val ? `${color}15` : 'rgba(0,0,0,0.03)',
                  color: status === val ? color : '#6B7280',
                }}>
                {label}
              </button>
            ))}
          </div>
        </Field>

        {/* Assign */}
        <Field label="Assigned to">
          <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>

        {/* Resolution comment — show prominently when resolving */}
        <Field label={status === 'resolved' ? 'Resolution (required)' : 'Notes (optional)'}>
          <textarea
            className={inputCls + ' !h-20 py-2'}
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            placeholder={status === 'resolved' ? 'How was this bug fixed?' : 'Add notes about progress…'}
            required={status === 'resolved'}
          />
        </Field>

        {/* Existing resolution display */}
        {bug.metadata?.resolution && bug.status === 'resolved' && status === 'resolved' && (
          <div className="rounded-[10px] p-3 text-[13px]" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
            <p className="text-[11px] font-semibold text-ink-400 mb-1">PREVIOUS RESOLUTION</p>
            <p className="text-ink-700">{bug.metadata.resolution}</p>
          </div>
        )}

        <button
          onClick={save}
          disabled={busy || (status === 'resolved' && !resolution.trim())}
          className="w-full h-11 rounded-[10px] text-white font-semibold disabled:opacity-60 transition-all"
          style={{ background: status === 'resolved' ? '#22C55E' : '#4A6CF7' }}
        >
          {busy ? 'Saving…' : status === 'resolved' ? 'Resolve Bug' : 'Update Bug'}
        </button>
      </div>
    </Modal>
  );
}

// ── Bug Tracker ──
function BugTracker({ me, users }) {
  const showToast = useToast();
  const [bugs, setBugs] = useState([]);
  const [apps, setApps] = useState([]);
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [detailBug, setDetailBug] = useState(null);

  const load = () => {
    api.bugs(filter || undefined).then(setBugs);
    api.bugApps().then(setApps);
  };
  useEffect(() => { load(); }, [filter]);

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
                  <button key={b.id} onClick={() => setDetailBug(b)} className={'card !p-3 transition-all w-full text-left hover:shadow-md ' + (isResolved ? 'opacity-50' : '')}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor(b.status) }} />
                          <span className={'text-[11px] font-semibold uppercase ' + (isResolved ? 'text-ink-300 line-through' : 'text-ink-300')}>{b.app_name}</span>
                          <span className="text-[11px] text-ink-300">#{i + 1}</span>
                          <span className="ml-auto tag" style={{
                            color: statusColor(b.status),
                            backgroundColor: b.status === 'open' ? 'rgba(239,68,68,0.08)' : b.status === 'in_progress' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                          }}>{b.status === 'open' ? 'Open' : b.status === 'in_progress' ? 'In Progress' : 'Resolved'}</span>
                        </div>
                        <p className={'text-[13px] ' + (isResolved ? 'text-ink-400 line-through' : 'text-ink-900')}>{b.issue}</p>
                        {b.metadata?.resolution && isResolved && (
                          <p className="text-[11px] text-ink-400 mt-1 italic truncate">✓ {b.metadata.resolution}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-500">
                          {b.assigned_name && <span className="flex items-center gap-1">
                            <Avatar user={{ initials: b.assigned_initials, avatar_color: b.assigned_color, avatar_url: b.assigned_avatar }} size={16} />
                            {b.assigned_name.split(' ')[0]}
                          </span>}
                          {b.deadline && <span>Due {b.deadline}</span>}
                          <span>by {b.reporter_name?.split(' ')[0]}</span>
                        </div>
                      </div>
                      {b.screenshot_url && (() => {
                        const extraCount = (b.metadata?.extra_screenshots || []).length;
                        const url = b.screenshot_url.startsWith('http') ? b.screenshot_url : ASSET_ORIGIN + b.screenshot_url;
                        return (
                          <div className="relative flex-shrink-0">
                            <img src={url} alt="screenshot" className="w-16 h-16 rounded-[6px] object-cover border border-line-light" />
                            {extraCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-blue text-white text-[9px] font-bold flex items-center justify-center shadow-sm">+{extraCount}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </button>
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

      {/* Add Bug Modal (shared) */}
      <ReportBugModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      {/* Bug Detail Modal */}
      <BugDetailModal open={!!detailBug} onClose={() => setDetailBug(null)} bug={detailBug} users={users} onUpdated={load} />
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
    if (deepLink?.kind === 'bugs') setSection('bugs');
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
    try {
      const next = t.status === 'done' ? 'pending' : 'done';
      await api.updateTask(t.id, { status: next });
      if (next === 'done') fireConfetti();
      setQuickTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: next } : x));
    } catch (err) { showToast(err.message || 'Failed to update task', 'error'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{section === 'bugs' ? 'Bug Tracker' : 'My Active Projects'}</h1>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} onOpenProfile={() => onSwitchTab?.('profile')} />
      </div>

      {/* Section toggle */}
      <div className="flex gap-1 rounded-full p-0.5 mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <button onClick={() => setSection('projects')} className={'flex-1 h-9 rounded-full text-sm font-semibold transition flex items-center justify-center ' + (section === 'projects' ? 'text-ink-900' : 'text-ink-500')}
          style={section === 'projects' ? { background: 'rgba(255,255,255,0.10)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' } : {}}>Projects</button>
        <button onClick={() => setSection('bugs')} className={'flex-1 h-9 rounded-full text-sm font-semibold transition flex items-center justify-center ' + (section === 'bugs' ? 'text-ink-900' : 'text-ink-500')}
          style={section === 'bugs' ? { background: 'rgba(255,255,255,0.10)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' } : {}}>Bug Tracker</button>
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
        <div className="rounded-[14px]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
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
          try {
            await api.deleteTask(deleteTaskId);
            setQuickTasks(ts => ts.filter(t => t.id !== deleteTaskId));
            setDeleteTaskId(null);
            showToast('Task deleted');
          } catch (err) { showToast(err.message || 'Failed to delete task', 'error'); setDeleteTaskId(null); }
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
