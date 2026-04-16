import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { Avatar } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useBackHandler } from '../hooks/useBackHandler.js';
import { useOnRefresh } from '../hooks/usePullToRefresh.js';
import { ReportBugModal } from '../components/QuickActions.jsx';
import GlassCard from '../components/GlassCard.jsx';
import FilterChip from '../components/FilterChip.jsx';
import {
  SearchIcon,
  FilterIcon,
  MoreIcon,
  DownloadIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  BugIcon,
  CheckIcon,
} from '../components/Icons.jsx';

// ── Stages (status) ─────────────────────────────────────────────
const BUG_STAGES = [
  { id: 'open',        label: 'Open',        color: '#EF4444' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'resolved',    label: 'Resolved',    color: '#22C55E' },
  { id: 'confirmed',   label: 'Confirmed',   color: '#3B82F6' },
];
const statusColor = (s) => (BUG_STAGES.find(x => x.id === s) || BUG_STAGES[0]).color;
const statusLabel = (s) => (BUG_STAGES.find(x => x.id === s) || BUG_STAGES[0]).label;

// ── Priority (H/M/L) ────────────────────────────────────────────
const PRIORITIES = [
  { id: 'high',   label: 'High',   letter: 'H', color: '#EF4444' },
  { id: 'medium', label: 'Medium', letter: 'M', color: '#F59E0B' },
  { id: 'low',    label: 'Low',    letter: 'L', color: '#9CA3AF' },
];
const priorityOf = (bug) => bug?.metadata?.priority || null;

function PriorityChip({ priority }) {
  const p = PRIORITIES.find(x => x.id === priority);
  if (!p) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-[6px] text-[10px] font-bold flex-shrink-0 tabular-nums"
      style={{
        color: p.color,
        background: `${p.color}15`,
        border: `1px solid ${p.color}33`,
      }}
      title={`${p.label} priority`}
    >
      {p.letter}
    </span>
  );
}

// ── Deadline helpers (urgency-colored, matches Home) ───────────
function deadlineLabel(d) {
  if (!d) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d < today) return 'Overdue';
  if (d === today) return 'Today';
  if (d === tomorrow) return 'Tomorrow';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function deadlineColor(d) {
  if (!d) return '#9CA3AF';
  const today = new Date().toISOString().slice(0, 10);
  if (d < today) return '#EF4444';   // overdue
  if (d === today) return '#F59E0B'; // today
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === tomorrow) return '#F59E0B';
  return '#9CA3AF';
}

// ── Stepper (replaces 4-bar ladder in modal) ───────────────────
function StageStepper({ status }) {
  const currentIdx = BUG_STAGES.findIndex(s => s.id === status);
  return (
    <div className="flex items-center">
      {BUG_STAGES.map((stage, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;
        const dotColor = isFuture ? 'rgba(255,255,255,0.15)' : stage.color;
        return (
          <React.Fragment key={stage.id}>
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 60 }}>
              <span
                className="w-3 h-3 rounded-full transition-all"
                style={{
                  background: dotColor,
                  boxShadow: isCurrent ? `0 0 0 3px ${stage.color}33, 0 0 8px ${stage.color}80` : 'none',
                }}
              />
              <span
                className="text-[10px] font-semibold whitespace-nowrap"
                style={{ color: isFuture ? '#6B7280' : stage.color, opacity: isPast ? 0.7 : 1 }}
              >
                {stage.label}
              </span>
            </div>
            {i < BUG_STAGES.length - 1 && (
              <div className="flex-1 h-px mb-4"
                style={{ background: i < currentIdx ? BUG_STAGES[i].color : 'rgba(255,255,255,0.08)' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Bug Detail Modal ───────────────────────────────────────────
function BugDetailModal({ open, onClose, bug, users, onUpdated, meId }) {
  const showToast = useToast();
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [reopenComment, setReopenComment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  useEffect(() => {
    if (open && bug) {
      setStatus(bug.status);
      setResolution(bug.metadata?.resolution || '');
      setAssignedTo(bug.assigned_to || '');
      setPriority(bug.metadata?.priority || 'medium');
      setReopenComment('');
      setShowReopen(false);
    }
  }, [open, bug]);

  if (!bug) return null;

  const isReporter = bug.reported_by === meId;
  const allowedStatuses = (() => {
    if (bug.status === 'confirmed') return [];
    if (bug.status === 'resolved' && isReporter) return [];
    return ['open', 'in_progress', 'resolved'];
  })();

  const save = async () => {
    setBusy(true);
    try {
      const patch = { status };
      if (resolution.trim()) patch.resolution = resolution.trim();
      if (assignedTo !== (bug.assigned_to || '')) patch.assignedTo = assignedTo || null;
      if (priority !== (bug.metadata?.priority || 'medium')) patch.priority = priority;
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
      showToast('Bug confirmed as fixed');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to confirm', 'error'); } finally { setBusy(false); }
  };

  const reopenFromConfirmed = async () => {
    setBusy(true);
    try {
      await api.updateBug(bug.id, { status: 'in_progress', reopenComment: 'Reopened from archive' });
      showToast('Bug reopened');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to reopen', 'error'); } finally { setBusy(false); }
  };

  const reopenBug = async () => {
    if (!reopenComment.trim()) return;
    setBusy(true);
    try {
      await api.updateBug(bug.id, { status: 'in_progress', reopenComment: reopenComment.trim() });
      showToast('Bug reopened — back to assignee');
      onUpdated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to reopen', 'error'); } finally { setBusy(false); }
  };

  // Modal title = first chunk of the issue, fallback to app name
  const title = (bug.issue || '').trim().slice(0, 60) || `${bug.app_name} bug`;
  const truncated = (bug.issue || '').length > 60;

  return (
    <Modal open={open} onClose={onClose} title={title + (truncated ? '…' : '')}>
      <div className="space-y-4">
        {/* Meta row */}
        <div className="flex items-center gap-2 text-[11px] text-ink-400">
          <span className="font-bold uppercase tracking-wide">{bug.app_name}</span>
          <PriorityChip priority={priorityOf(bug)} />
          <span className="ml-auto">Reported by {bug.reporter_name?.split(' ')[0] || '—'}</span>
        </div>

        {/* Stage stepper */}
        <StageStepper status={bug.status} />

        {/* Full issue text (only shown if title was truncated) */}
        {truncated && (
          <p className="text-[14px] text-ink-700 leading-relaxed">{bug.issue}</p>
        )}

        {/* Screenshots */}
        {(() => {
          const allUrls = [bug.screenshot_url, ...(bug.metadata?.extra_screenshots || [])].filter(Boolean);
          if (!allUrls.length) return null;
          return (
            <div className="flex gap-2 flex-wrap">
              {allUrls.map((url, i) => (
                <a key={i} href={url.startsWith('http') ? url : ASSET_ORIGIN + url} target="_blank" rel="noreferrer">
                  <img src={url.startsWith('http') ? url : ASSET_ORIGIN + url} alt={`screenshot ${i + 1}`}
                    className={allUrls.length === 1 ? 'w-full max-h-48 rounded-[10px] object-cover border border-white/10' : 'w-24 h-24 rounded-[8px] object-cover border border-white/10'} />
                </a>
              ))}
            </div>
          );
        })()}

        <div className="flex items-center gap-4 text-[12px] text-ink-500">
          {bug.deadline && (
            <span className="flex items-center gap-1.5" style={{ color: deadlineColor(bug.deadline) }}>
              <CalendarIcon width="13" height="13" /> Due {deadlineLabel(bug.deadline)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <ClockIcon width="13" height="13" />
            {new Date(bug.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {bug.metadata?.resolution && (
          <div className="rounded-[10px] p-3 text-[13px]" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
            <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: '#6B7280' }}>Resolution</p>
            <p style={{ color: '#D1D5DB' }}>{bug.metadata.resolution}</p>
          </div>
        )}

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

        {/* Reporter confirmation mode */}
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
                  <CheckIcon width="16" height="16" /> {busy ? 'Confirming…' : 'Yes, confirmed'}
                </button>
                <button onClick={() => setShowReopen(true)}
                  className="flex-1 h-11 rounded-[10px] font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                  Not fixed
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
                    {busy ? 'Reopening…' : 'Reopen bug'}
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

        {/* Normal edit mode */}
        {!(bug.status === 'resolved' && isReporter) && bug.status !== 'confirmed' && (
          <>
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

            <Field label="Priority">
              <div className="flex gap-2">
                {PRIORITIES.map(p => {
                  const active = priority === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                      className="flex-1 h-10 rounded-[10px] text-[13px] font-semibold transition-all border-2"
                      style={{
                        borderColor: active ? p.color : 'transparent',
                        backgroundColor: active ? `${p.color}15` : 'rgba(255,255,255,0.04)',
                        color: active ? p.color : '#6B7280',
                      }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Assigned to">
              <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>

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
              {busy ? 'Saving…' : status === 'resolved' ? 'Mark as resolved' : 'Update bug'}
            </button>
          </>
        )}

        {/* Confirmed — archive; reopening still possible */}
        {bug.status === 'confirmed' && (
          <div className="space-y-3">
            <div className="text-center py-1">
              <span className="text-[14px] font-semibold inline-flex items-center gap-1.5" style={{ color: '#3B82F6' }}>
                <CheckIcon width="16" height="16" /> Confirmed fixed · archived
              </span>
            </div>
            <button onClick={reopenFromConfirmed} disabled={busy}
              className="w-full h-10 rounded-[10px] text-[13px] font-semibold transition-all disabled:opacity-60"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              {busy ? 'Reopening…' : 'Reopen bug'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Filter popover (3 dimensions) ───────────────────────────────
// Positioning: `position: fixed` so we can clamp the popover inside the
// viewport regardless of where the filter button sits. We measure the
// trigger (the filter button) and compute a left/top that never clips
// either edge on any screen width.
function FilterPopover({ open, onClose, triggerRef, apps, appFilter, setAppFilter, priorityFilter, setPriorityFilter, scope, setScope }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 });

  useLayoutEffect(() => {
    if (!open || !triggerRef?.current) return;
    const computePos = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const desired = 280;
      const pad = 12;
      const width = Math.min(desired, vw - pad * 2);
      // Align the popover's right edge with the trigger's right edge by default,
      // then clamp the left so the popover never leaves the viewport.
      let left = rect.right - width;
      left = Math.max(pad, Math.min(left, vw - width - pad));
      setPos({ top: rect.bottom + 6, left, width });
    };
    computePos();
    window.addEventListener('resize', computePos);
    return () => window.removeEventListener('resize', computePos);
  }, [open, triggerRef]);

  if (!open) return null;

  const scopes = [
    { id: 'all',      label: 'All' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'reported', label: 'Reported' },
  ];
  const priorityChoices = [
    { id: '',       label: 'All',  color: '#9CA3AF' },
    { id: 'high',   label: 'High', color: '#EF4444' },
    { id: 'medium', label: 'Med',  color: '#F59E0B' },
    { id: 'low',    label: 'Low',  color: '#9CA3AF' },
  ];

  // Shared chip styles — min-w-0 + overflow-hidden let flex-1 actually
  // shrink the buttons instead of letting the label push the popover wide.
  const chipCls = 'flex-1 min-w-0 h-8 rounded-md text-[11px] font-semibold transition overflow-hidden text-ellipsis whitespace-nowrap px-1';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-[12px] p-3 space-y-3 overflow-hidden"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          background: 'linear-gradient(180deg, rgba(22,24,32,0.98) 0%, rgba(16,18,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderTopColor: 'rgba(255,255,255,0.16)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Scope</p>
          <div className="flex gap-1.5">
            {scopes.map(s => {
              const active = scope === s.id;
              return (
                <button key={s.id} onClick={() => setScope(s.id)}
                  className={chipCls}
                  style={{
                    background: active ? 'rgba(91,140,255,0.15)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#A8C4FF' : '#9CA3AF',
                    border: active ? '1px solid rgba(91,140,255,0.30)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">App</p>
          <select
            value={appFilter}
            onChange={e => setAppFilter(e.target.value)}
            className="w-full h-9 px-2.5 rounded-[8px] text-[13px] bg-white/5 text-ink-900 border border-white/10 focus:outline-none focus:border-brand-blue/50"
          >
            <option value="">All apps</option>
            {apps.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Priority</p>
          <div className="flex gap-1.5">
            {priorityChoices.map(p => {
              const active = priorityFilter === p.id;
              return (
                <button key={p.id || 'all'} onClick={() => setPriorityFilter(p.id)}
                  className={chipCls}
                  style={{
                    background: active ? `${p.color}15` : 'rgba(255,255,255,0.04)',
                    color: active ? p.color : '#9CA3AF',
                    border: active ? `1px solid ${p.color}55` : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Overflow menu ──────────────────────────────────────────────
function OverflowMenu({ open, onClose, onExportCsv }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-[calc(100%+6px)] z-50 w-48 rounded-[12px] py-1.5 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(22,24,32,0.98) 0%, rgba(16,18,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderTopColor: 'rgba(255,255,255,0.16)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={() => { onExportCsv(); onClose(); }}
          className="w-full px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-white/5 flex items-center gap-2.5"
        >
          <span className="text-ink-500"><DownloadIcon /></span>
          Export CSV
        </button>
      </div>
    </>
  );
}

// ── Bug card ───────────────────────────────────────────────────
function BugCard({ bug, onOpen, onInlineConfirm, onInlineReopen, meId, busy }) {
  const isReporter = bug.reported_by === meId;
  const isAssignee = bug.assigned_to === meId;
  const isAwaitingMyConfirm = bug.status === 'resolved' && isReporter;
  const isConfirmed = bug.status === 'confirmed';
  const isResolved = bug.status === 'resolved';

  const accent =
    isConfirmed ? 'none' :
    isAwaitingMyConfirm ? 'green' :
    isResolved ? 'none' :
    bug.status === 'in_progress' ? 'amber' :
    'red';

  // Status is encoded in the accent bar + section; show status text inline
  // next to the app name only when the distinction matters within a section
  // (Active section: open vs in_progress).
  const showInlineStatus = bug.status === 'open' || bug.status === 'in_progress';

  const subtle = isConfirmed ? 'opacity-50' : '';

  return (
    <GlassCard accent={accent} className={'w-full ' + subtle}>
      <button
        onClick={onOpen}
        className="w-full text-left flex items-start gap-3 pl-4 pr-3 py-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400 truncate">
              {bug.app_name}
              {showInlineStatus && (
                <span className="text-ink-500 font-semibold normal-case tracking-normal"> · {statusLabel(bug.status).toLowerCase()}</span>
              )}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <PriorityChip priority={priorityOf(bug)} />
            </span>
          </div>

          <p className={'text-[14px] leading-snug ' + (isConfirmed || isResolved ? 'text-ink-400' : 'text-ink-900 font-medium')}
            style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {bug.issue}
          </p>

          {bug.metadata?.resolution && (isConfirmed || isResolved) && (
            <p className="text-[11px] text-ink-500 mt-1 truncate flex items-center gap-1">
              <CheckIcon width="10" height="10" />
              <span className="truncate">{bug.metadata.resolution}</span>
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-500">
            {bug.assigned_name && !isAssignee && (
              <span className="flex items-center gap-1.5">
                <Avatar user={{ initials: bug.assigned_initials, avatar_color: bug.assigned_color, avatar_url: bug.assigned_avatar }} size={16} />
                {bug.assigned_name.split(' ')[0]}
              </span>
            )}
            {isAssignee && (
              <span className="text-ink-400 font-semibold">Assigned to you</span>
            )}
            {bug.deadline && (
              <span
                className="flex items-center gap-1 tabular-nums"
                style={{ color: deadlineColor(bug.deadline), fontWeight: deadlineColor(bug.deadline) === '#EF4444' ? 700 : 500 }}
              >
                <CalendarIcon width="12" height="12" /> {deadlineLabel(bug.deadline)}
              </span>
            )}
            {!isReporter && bug.reporter_name && (
              <span>by {bug.reporter_name.split(' ')[0]}</span>
            )}
          </div>
        </div>

        {bug.screenshot_url && (() => {
          const extraCount = (bug.metadata?.extra_screenshots || []).length;
          const url = bug.screenshot_url.startsWith('http') ? bug.screenshot_url : ASSET_ORIGIN + bug.screenshot_url;
          return (
            <div className="relative flex-shrink-0">
              <img src={url} alt="screenshot" className="w-14 h-14 rounded-[6px] object-cover border border-white/10" />
              {extraCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-blue text-white text-[9px] font-bold flex items-center justify-center shadow-sm">+{extraCount}</span>
              )}
            </div>
          );
        })()}
      </button>

      {/* Inline confirm action row — only when this bug is awaiting MY confirmation */}
      {isAwaitingMyConfirm && (
        <div className="px-4 pt-0 pb-3 flex items-center gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] text-ink-500 flex-1 pr-1 pt-3">Is the fix working?</p>
          <button
            onClick={(e) => { e.stopPropagation(); onInlineConfirm(bug); }}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-all mt-2 disabled:opacity-60 flex items-center gap-1.5"
            style={{ background: '#22C55E', color: 'white' }}
          >
            <CheckIcon width="13" height="13" /> Confirm
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onInlineReopen(bug); }}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-all mt-2 disabled:opacity-60"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            Not fixed
          </button>
        </div>
      )}
    </GlassCard>
  );
}

// ── Section — compact, consistent label ────────────────────────
function Section({ title, count, color, children }) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5"
        style={{ color: color || '#9CA3AF' }}>
        {title}
        {count > 0 && <span className="tabular-nums opacity-80">· {count}</span>}
      </p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// Sort by deadline ASC with nulls last (matches Projects)
const byDeadline = (a, b) => {
  const da = a?.deadline || null;
  const db = b?.deadline || null;
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.localeCompare(db);
};

// ── Bugs screen ────────────────────────────────────────────────
export default function Bugs({ me, unreadCount, onOpenNotifications, onSwitchTab }) {
  const showToast = useToast();
  const [bugs, setBugs] = useState([]);
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [scope, setScope] = useState('all'); // 'all' | 'assigned' | 'reported'
  const [addOpen, setAddOpen] = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [detailBug, setDetailBug] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [inlineBusy, setInlineBusy] = useState(false);

  const filterWrap = useRef(null);
  const filterButtonRef = useRef(null);
  const moreWrap = useRef(null);
  const searchInputRef = useRef(null);

  // Back-button integration
  useBackHandler('bug-detail', !!detailBug, () => setDetailBug(null));
  useBackHandler('add-bug', addOpen, () => setAddOpen(false));

  // Pull-to-refresh subscriber
  useOnRefresh(() => { load(); });

  // Notify the shell when the bug detail modal closes so it can restore
  // Notifications if the user entered via a notification tap.
  const prevDetailRef = useRef(detailBug);
  useEffect(() => {
    if (prevDetailRef.current && !detailBug) {
      window.dispatchEvent(new Event('nexo:detail-closed'));
    }
    prevDetailRef.current = detailBug;
  }, [detailBug]);

  const load = () => {
    api.bugs(appFilter || undefined).then(setBugs);
    api.bugApps().then(setApps);
  };
  useEffect(() => { load(); }, [appFilter]);
  useEffect(() => { api.users().then(setUsers); }, []);

  const meId = me?.id;

  // Apply all filters: search, scope, priority (app is server-side via appFilter)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bugs.filter(b => {
      if (q && !b.issue.toLowerCase().includes(q) && !b.app_name.toLowerCase().includes(q)) return false;
      if (priorityFilter && priorityOf(b) !== priorityFilter) return false;
      if (scope === 'assigned' && b.assigned_to !== meId) return false;
      if (scope === 'reported' && b.reported_by !== meId) return false;
      return true;
    });
  }, [bugs, query, priorityFilter, scope, meId]);

  const awaitingMine    = useMemo(() => visible.filter(b => b.status === 'resolved' && b.reported_by === meId).sort(byDeadline), [visible, meId]);
  const openBugs        = useMemo(() => visible.filter(b => b.status === 'open' || b.status === 'in_progress').sort(byDeadline), [visible]);
  const awaitingOthers  = useMemo(() => visible.filter(b => b.status === 'resolved' && b.reported_by !== meId).sort(byDeadline), [visible, meId]);
  const confirmedBugs   = useMemo(() => visible.filter(b => b.status === 'confirmed').sort(byDeadline), [visible]);

  const exportCsv = () => {
    const rows = [['#','App','Issue','Status','Priority','Assigned','Deadline']];
    visible.forEach((b,i) => rows.push([i+1, b.app_name, `"${(b.issue||'').replace(/"/g,'""')}"`, b.status, priorityOf(b) || '', b.assigned_name||'', b.deadline||'']));
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bugs-${appFilter||'all'}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const inlineConfirm = async (bug) => {
    setInlineBusy(true);
    try {
      await api.updateBug(bug.id, { status: 'confirmed' });
      showToast('Bug confirmed as fixed');
      load();
    } catch (err) {
      showToast(err.message || 'Failed to confirm', 'error');
    } finally {
      setInlineBusy(false);
    }
  };

  // Inline "Not fixed" opens the detail modal with reopen UI primed —
  // we need a comment, so don't fake a shortcut.
  const inlineReopen = (bug) => { setDetailBug(bug); };

  const hasAny = visible.length > 0 || confirmedBugs.length > 0;

  // ── Keyboard shortcuts (desktop) ──
  const onKey = useCallback((e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
      // "/" focuses search even from other keypress origins — already blocked by input/textarea guard,
      // but nothing to do here.
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setAddOpen(true); }
    else if (e.key === '/') { e.preventDefault(); searchInputRef.current?.focus(); }
    else if (e.key === 'c' || e.key === 'C') {
      if (awaitingMine.length > 0 && !inlineBusy) { e.preventDefault(); inlineConfirm(awaitingMine[0]); }
    }
  }, [awaitingMine, inlineBusy]);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // Chips for active filters (scope="all" + empty app/priority/query = no chips)
  const chips = [];
  if (scope !== 'all') {
    const label = scope === 'assigned' ? 'Assigned to me' : 'Reported by me';
    chips.push({ label, clear: () => setScope('all') });
  }
  if (appFilter) chips.push({ label: appFilter, clear: () => setAppFilter('') });
  if (priorityFilter) {
    const p = PRIORITIES.find(x => x.id === priorityFilter);
    chips.push({ label: `${p?.label || priorityFilter} priority`, clear: () => setPriorityFilter('') });
  }

  // Subtitle: active / to confirm / archived — each segment muted when 0
  const subtitleSegments = [
    { label: `${openBugs.length} active`, strong: openBugs.length > 0 },
    { label: `${awaitingMine.length} to confirm`, strong: awaitingMine.length > 0 },
    { label: `${confirmedBugs.length} archived`, strong: false },
  ];

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-3xl font-bold text-ink-900 tracking-tight leading-tight">Bugs</h1>
          <p className="text-[13px] text-ink-400 mt-1">
            {subtitleSegments.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-ink-400 mx-1">·</span>}
                <span className={s.strong ? 'text-ink-700 font-medium' : 'text-ink-400'}>{s.label}</span>
              </React.Fragment>
            ))}
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
        {/* Search */}
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
            <SearchIcon width="16" height="16" />
          </span>
          <input
            ref={searchInputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search bugs…"
            className="w-full h-10 pl-9 pr-3 rounded-[10px] text-[13px] bg-white/5 text-ink-900 placeholder:text-ink-400 border border-white/10 focus:outline-none focus:border-brand-blue/50 transition"
          />
        </div>

        {/* Filter */}
        <div className="relative" ref={filterWrap}>
          <button
            ref={filterButtonRef}
            onClick={() => { setFilterOpen(v => !v); setMoreOpen(false); }}
            className="h-10 px-3 rounded-[10px] text-[13px] font-medium text-ink-700 bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5"
            aria-label="Filter bugs"
          >
            <FilterIcon />
            {chips.length > 0 ? <span className="text-brand-blue">· {chips.length}</span> : null}
          </button>
          <FilterPopover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            triggerRef={filterButtonRef}
            apps={apps}
            appFilter={appFilter}
            setAppFilter={setAppFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            scope={scope}
            setScope={setScope}
          />
        </div>

        {/* + Bug */}
        <button
          onClick={() => setAddOpen(true)}
          className="h-10 px-3 rounded-[10px] text-[13px] font-semibold flex items-center gap-1.5 transition"
          style={{
            background: 'linear-gradient(135deg, rgba(91,140,255,0.22) 0%, rgba(91,140,255,0.10) 100%)',
            color: '#A8C4FF',
            border: '1px solid rgba(91,140,255,0.30)',
            boxShadow: '0 0 10px rgba(91,140,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <PlusIcon width="14" height="14" /> Bug
        </button>

        {/* Overflow */}
        <div className="relative" ref={moreWrap}>
          <button
            onClick={() => { setMoreOpen(v => !v); setFilterOpen(false); }}
            className="h-10 w-10 rounded-[10px] text-ink-500 bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
            aria-label="More actions"
          >
            <MoreIcon />
          </button>
          <OverflowMenu
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            onExportCsv={exportCsv}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => <FilterChip key={i} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      {/* Empty state */}
      {!hasAny && (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span className="text-ink-400"><BugIcon /></span>
          </div>
          <p className="text-[15px] font-semibold text-ink-900">
            {chips.length > 0 || query ? 'No bugs match' : 'No bugs reported'}
          </p>
          <p className="text-[12px] text-ink-500 mt-1">
            {chips.length > 0 || query ? 'Try a different search or clear the filters.' : 'Nothing to triage — nice.'}
          </p>
        </div>
      )}

      {/* Sections */}
      {awaitingMine.length > 0 && (
        <Section title="Confirm fix" count={awaitingMine.length} color="#22C55E">
          {awaitingMine.map(b => (
            <BugCard key={b.id} bug={b} meId={meId} onOpen={() => setDetailBug(b)} onInlineConfirm={inlineConfirm} onInlineReopen={inlineReopen} busy={inlineBusy} />
          ))}
        </Section>
      )}

      {openBugs.length > 0 && (
        <Section title="Active" count={openBugs.length}>
          {openBugs.map(b => (
            <BugCard key={b.id} bug={b} meId={meId} onOpen={() => setDetailBug(b)} onInlineConfirm={inlineConfirm} onInlineReopen={inlineReopen} busy={inlineBusy} />
          ))}
        </Section>
      )}

      {awaitingOthers.length > 0 && (
        <Section title="Awaiting reporter" count={awaitingOthers.length}>
          {awaitingOthers.map(b => (
            <BugCard key={b.id} bug={b} meId={meId} onOpen={() => setDetailBug(b)} onInlineConfirm={inlineConfirm} onInlineReopen={inlineReopen} busy={inlineBusy} />
          ))}
        </Section>
      )}

      {confirmedBugs.length > 0 && (
        <section>
          <button
            onClick={() => setShowConfirmed(v => !v)}
            className="w-full text-[11px] font-bold uppercase tracking-wide text-ink-400 hover:text-ink-700 py-2 transition flex items-center justify-between"
          >
            <span>Confirmed · {confirmedBugs.length}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={'transition ' + (showConfirmed ? 'rotate-180' : '')}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showConfirmed && (
            <div className="space-y-2 mt-1">
              {confirmedBugs.map(b => (
                <BugCard key={b.id} bug={b} meId={meId} onOpen={() => setDetailBug(b)} onInlineConfirm={inlineConfirm} onInlineReopen={inlineReopen} busy={inlineBusy} />
              ))}
            </div>
          )}
        </section>
      )}

      <ReportBugModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
      <BugDetailModal open={!!detailBug} onClose={() => setDetailBug(null)} bug={detailBug} users={users} onUpdated={load} meId={meId} />
    </div>
  );
}
