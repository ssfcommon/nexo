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
const BUG_STAGES = [
  { id: 'open', label: 'Open', color: '#EF4444' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'resolved', label: 'Resolved', color: '#22C55E' },
  { id: 'confirmed', label: 'Confirmed', color: '#3B82F6' },
];

function BugDetailModal({ open, onClose, bug, users, onUpdated, meId }) {
  const showToast = useToast();
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [reopenComment, setReopenComment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  useEffect(() => {
    if (open && bug) {
      setStatus(bug.status);
      setResolution(bug.metadata?.resolution || '');
      setAssignedTo(bug.assigned_to || '');
      setReopenComment('');
      setShowReopen(false);
    }
  }, [open, bug]);

  if (!bug) return null;

  const isReporter = bug.reported_by === meId;
  const isAssignee = bug.assigned_to === meId;
  const currentStage = BUG_STAGES.find(s => s.id === bug.status) || BUG_STAGES[0];

  // Allowed status transitions based on role
  const allowedStatuses = (() => {
    if (bug.status === 'confirmed') return []; // final state
    if (bug.status === 'resolved' && isReporter) return []; // reporter uses confirm/reopen buttons instead
    // Assignee/admin can move through open → in_progress → resolved
    const stages = ['open', 'in_progress', 'resolved'];
    return stages;
  })();

  const save = async () => {
    setBusy(true);
    try {
      const patch = { status };
      if (resolution.trim()) patch.resolution = resolution.trim();
      if (assignedTo !== (bug.assigned_to || '')) patch.assignedTo = assignedTo || null;
      await api.updateBug(bug.id, patch);
      showToast(status === 'resolved' ? 'Bug resolved — awaiting reporter confirmation' : 'Bug updated');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to update bug', 'error'); } finally { setBusy(false); }
  };

  const confirmBug = async () => {
    setBusy(true);
    try {
      await api.updateBug(bug.id, { status: 'confirmed' });
      showToast('Bug confirmed as fixed ✓');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to confirm', 'error'); } finally { setBusy(false); }
  };

  const reopenBug = async () => {
    if (!reopenComment.trim()) return;
    setBusy(true);
    try {
      await api.updateBug(bug.id, { status: 'in_progress', reopenComment: reopenComment.trim() });
      showToast('Bug reopened → back to assignee');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to reopen', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bug Details">
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentStage.color }} />
          <span className="text-[12px] font-bold uppercase text-ink-400">{bug.app_name}</span>
          <span className="ml-auto text-[11px] text-ink-300">Reported by {bug.reporter_name?.split(' ')[0] || '—'}</span>
        </div>

        {/* Stage progress bar */}
        <div className="flex items-center gap-1">
          {BUG_STAGES.map((stage, i) => {
            const stageIdx = BUG_STAGES.findIndex(s => s.id === bug.status);
            const isPast = i <= stageIdx;
            return (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full h-1.5 rounded-full transition-all" style={{ background: isPast ? stage.color : 'rgba(255,255,255,0.08)' }} />
                  <span className="text-[9px] font-semibold" style={{ color: isPast ? stage.color : '#4B5563' }}>{stage.label}</span>
                </div>
              </React.Fragment>
            );
          })}
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

        {/* Resolution display */}
        {bug.metadata?.resolution && (
          <div className="rounded-[10px] p-3 text-[13px]" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
            <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: '#6B7280' }}>Resolution</p>
            <p style={{ color: '#D1D5DB' }}>{bug.metadata.resolution}</p>
          </div>
        )}

        {/* Reopen history */}
        {bug.metadata?.reopen_comments?.length > 0 && (
          <div className="space-y-2">
            {bug.metadata.reopen_comments.map((c, i) => (
              <div key={i} className="rounded-[10px] p-3 text-[13px]" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: '#6B7280' }}>Reopened</p>
                <p style={{ color: '#D1D5DB' }}>{c.text}</p>
              </div>
            ))}
          </div>
        )}

        <hr style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* ── Reporter confirmation mode (when bug is "resolved") ── */}
        {bug.status === 'resolved' && isReporter && (
          <div className="space-y-3">
            <p className="text-[13px] font-medium" style={{ color: '#D1D5DB' }}>
              The assignee marked this as resolved. Is the fix working?
            </p>
            {!showReopen ? (
              <div className="flex gap-2">
                <button onClick={confirmBug} disabled={busy}
                  className="flex-1 h-11 rounded-[10px] text-white font-semibold disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                  style={{ background: '#22C55E' }}>
                  {busy ? 'Confirming…' : '✓ Yes, Confirmed'}
                </button>
                <button onClick={() => setShowReopen(true)}
                  className="flex-1 h-11 rounded-[10px] font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                  ↩ Not Fixed
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  className={inputCls + ' !h-20 py-2'}
                  value={reopenComment}
                  onChange={e => setReopenComment(e.target.value)}
                  placeholder="What's still wrong or missing?"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={reopenBug} disabled={busy || !reopenComment.trim()}
                    className="flex-1 h-10 rounded-[10px] font-semibold text-[13px] disabled:opacity-60 transition-all"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
                    {busy ? 'Reopening…' : 'Reopen Bug'}
                  </button>
                  <button onClick={() => setShowReopen(false)}
                    className="h-10 px-4 rounded-[10px] text-[13px]" style={{ color: '#6B7280' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Normal edit mode (non-reporter, or open/in_progress bugs) ── */}
        {!(bug.status === 'resolved' && isReporter) && bug.status !== 'confirmed' && (
          <>
            {/* Status selector */}
            {allowedStatuses.length > 0 && (
              <Field label="Status">
                <div className="flex gap-2">
                  {allowedStatuses.map(val => {
                    const stage = BUG_STAGES.find(s => s.id === val);
                    return (
                      <button key={val} type="button" onClick={() => setStatus(val)}
                        className="flex-1 h-10 rounded-[10px] text-[13px] font-semibold transition-all border-2"
                        style={{
                          borderColor: status === val ? stage.color : 'transparent',
                          backgroundColor: status === val ? `${stage.color}15` : 'rgba(255,255,255,0.04)',
                          color: status === val ? stage.color : '#6B7280',
                        }}>
                        {stage.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* Assign */}
            <Field label="Assigned to">
              <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>

            {/* Resolution / Notes */}
            <Field label={status === 'resolved' ? 'Resolution (required)' : 'Notes (optional)'}>
              <textarea
                className={inputCls + ' !h-20 py-2'}
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder={status === 'resolved' ? 'How was this bug fixed?' : 'Add notes about progress…'}
              />
            </Field>

            <button
              onClick={save}
              disabled={busy || (status === 'resolved' && !resolution.trim())}
              className="w-full h-11 rounded-[10px] text-white font-semibold disabled:opacity-60 transition-all"
              style={{ background: status === 'resolved' ? '#22C55E' : '#4A6CF7' }}
            >
              {busy ? 'Saving…' : status === 'resolved' ? 'Mark as Resolved' : 'Update Bug'}
            </button>
          </>
        )}

        {/* Confirmed final state */}
        {bug.status === 'confirmed' && (
          <div className="text-center py-2">
            <span className="text-[14px] font-semibold" style={{ color: '#3B82F6' }}>✓ Bug confirmed as fixed</span>
          </div>
        )}
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

  const statusColor = (s) => s === 'open' ? '#EF4444' : s === 'in_progress' ? '#F59E0B' : s === 'resolved' ? '#22C55E' : '#3B82F6';
  const statusLabel = (s) => s === 'open' ? 'Open' : s === 'in_progress' ? 'In Progress' : s === 'resolved' ? 'Resolved' : 'Confirmed';

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
        const openBugs = bugs.filter(b => b.status === 'open' || b.status === 'in_progress');
        const resolvedBugs = bugs.filter(b => b.status === 'resolved');
        const confirmedBugs = bugs.filter(b => b.status === 'confirmed');
        // Show: open/in_progress first, then resolved, then optionally confirmed
        const displayBugs = [...openBugs, ...resolvedBugs, ...(showResolved ? confirmedBugs : [])];

        return (
          <>
            {displayBugs.length === 0 && !confirmedBugs.length && (
              <div className="text-center py-8 text-ink-300 text-[13px]">No bugs reported{filter ? ` for ${filter}` : ''}.</div>
            )}
            {displayBugs.length === 0 && confirmedBugs.length > 0 && !showResolved && (
              <div className="text-center py-8 text-ink-300 text-[13px]">All bugs confirmed fixed! 🎉</div>
            )}

            {/* Bug card renderer */}
            {[
              { label: null, items: openBugs },
              ...(resolvedBugs.length > 0 ? [{ label: `AWAITING CONFIRMATION (${resolvedBugs.length})`, items: resolvedBugs }] : []),
              ...(showResolved && confirmedBugs.length > 0 ? [{ label: `CONFIRMED (${confirmedBugs.length})`, items: confirmedBugs }] : []),
            ].map((group, gi) => (
              <React.Fragment key={gi}>
                {group.label && group.items.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-wide pt-3 pb-1" style={{ color: '#6B7280' }}>{group.label}</p>
                )}
                <div className="space-y-2">
                  {group.items.map((b) => {
                    const isResolved = b.status === 'resolved';
                    const isConfirmed = b.status === 'confirmed';
                    return (
                      <button key={b.id} onClick={() => setDetailBug(b)} className={'card !p-3 transition-all w-full text-left hover:shadow-md ' + (isConfirmed ? 'opacity-40' : '')}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor(b.status) }} />
                              <span className={'text-[11px] font-semibold uppercase text-ink-300'}>{b.app_name}</span>
                              <span className="ml-auto tag" style={{
                                color: statusColor(b.status),
                                backgroundColor: `${statusColor(b.status)}15`,
                              }}>{statusLabel(b.status)}</span>
                            </div>
                            <p className={'text-[13px] ' + (isResolved || isConfirmed ? 'text-ink-400 line-through' : 'text-ink-900')}>{b.issue}</p>
                            {b.metadata?.resolution && (isResolved || isConfirmed) && (
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
              </React.Fragment>
            ))}

            {/* Confirmed toggle */}
            {confirmedBugs.length > 0 && (
              <button
                onClick={() => setShowResolved(v => !v)}
                className="w-full text-center text-[12px] font-medium text-ink-400 hover:text-ink-700 py-2 transition"
              >
                {showResolved ? 'Hide' : 'Show'} {confirmedBugs.length} confirmed bug{confirmedBugs.length !== 1 ? 's' : ''}
              </button>
            )}
          </>
        );
      })()}

      {/* Add Bug Modal (shared) */}
      <ReportBugModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      {/* Bug Detail Modal */}
      <BugDetailModal open={!!detailBug} onClose={() => setDetailBug(null)} bug={detailBug} users={users} onUpdated={load} meId={me?.id} />
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
      <div className="flex gap-1 rounded-full p-0.5 mb-1" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)' }}>
        <button onClick={() => setSection('projects')} className={'flex-1 h-9 rounded-full text-sm font-semibold transition flex items-center justify-center ' + (section === 'projects' ? 'text-ink-900' : 'text-ink-500')}
          style={section === 'projects' ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)' } : {}}>Projects</button>
        <button onClick={() => setSection('bugs')} className={'flex-1 h-9 rounded-full text-sm font-semibold transition flex items-center justify-center ' + (section === 'bugs' ? 'text-ink-900' : 'text-ink-500')}
          style={section === 'bugs' ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)' } : {}}>Bug Tracker</button>
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
        <div className="rounded-[14px]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
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
