import React, { useEffect, useRef, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { Avatar } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
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
  CloseIcon,
} from '../components/Icons.jsx';

// ── Stages shared by BugDetailModal and status rendering ─────

const BUG_STAGES = [
  { id: 'open',        label: 'Open',        color: '#EF4444' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'resolved',    label: 'Resolved',    color: '#22C55E' },
  { id: 'confirmed',   label: 'Confirmed',   color: '#3B82F6' },
];

const statusColor = (s) => (BUG_STAGES.find(x => x.id === s) || BUG_STAGES[0]).color;
const statusLabel = (s) => (BUG_STAGES.find(x => x.id === s) || BUG_STAGES[0]).label;

// ── Bug Detail Modal ─────────────────────────────────────────

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
  const currentStage = BUG_STAGES.find(s => s.id === bug.status) || BUG_STAGES[0];

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

  return (
    <Modal open={open} onClose={onClose} title="Bug Details">
      <div className="space-y-4">
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
              <div key={stage.id} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full h-1.5 rounded-full transition-all" style={{ background: isPast ? stage.color : 'rgba(255,255,255,0.08)' }} />
                <span className="text-[9px] font-semibold" style={{ color: isPast ? stage.color : '#4B5563' }}>{stage.label}</span>
              </div>
            );
          })}
        </div>

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

        <div className="flex items-center gap-4 text-[12px] text-ink-500">
          {bug.deadline && <span className="flex items-center gap-1.5"><CalendarIcon width="13" height="13" /> Due {bug.deadline}</span>}
          <span className="flex items-center gap-1.5"><ClockIcon width="13" height="13" /> {new Date(bug.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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

        {bug.status === 'confirmed' && (
          <div className="text-center py-2">
            <span className="text-[14px] font-semibold inline-flex items-center gap-1.5" style={{ color: '#3B82F6' }}>
              <CheckIcon width="16" height="16" /> Bug confirmed as fixed
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Filter popover ───────────────────────────────────────────

function FilterPopover({ open, onClose, apps, appFilter, onAppFilterChange }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 rounded-[12px] p-3"
        style={{
          background: 'linear-gradient(180deg, rgba(22,24,32,0.98) 0%, rgba(16,18,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderTopColor: 'rgba(255,255,255,0.16)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">App</p>
        <select
          value={appFilter}
          onChange={e => onAppFilterChange(e.target.value)}
          className="w-full h-9 px-2.5 rounded-[8px] text-[13px] bg-white/5 text-ink-900 border border-white/10 focus:outline-none focus:border-brand-blue/50"
        >
          <option value="">All apps</option>
          {apps.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </>
  );
}

// ── Overflow menu ────────────────────────────────────────────

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

// ── Bug card ─────────────────────────────────────────────────

function BugCard({ bug, onOpen, onInlineConfirm, onInlineReopen, meId, busy }) {
  const isReporter = bug.reported_by === meId;
  const isAwaitingMyConfirm = bug.status === 'resolved' && isReporter;
  const isConfirmed = bug.status === 'confirmed';

  const accent =
    isConfirmed ? 'none' :
    isAwaitingMyConfirm ? 'green' :
    bug.status === 'resolved' ? 'none' :
    bug.status === 'in_progress' ? 'amber' :
    'red';

  const tagColor = statusColor(bug.status);
  const tagLabel = isAwaitingMyConfirm ? 'Confirm?' : statusLabel(bug.status);

  const subtle = isConfirmed ? 'opacity-50' : '';

  return (
    <GlassCard accent={accent} className={'w-full ' + subtle}>
      <button
        onClick={onOpen}
        className="w-full text-left flex items-start gap-3 pl-4 pr-3 py-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{bug.app_name}</span>
            <span
              className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: tagColor, background: `${tagColor}20`, border: `1px solid ${tagColor}33` }}
            >
              {tagLabel}
            </span>
          </div>
          <p className={'text-[14px] leading-snug ' + (isConfirmed || bug.status === 'resolved' ? 'text-ink-400' : 'text-ink-900 font-medium')}>
            {bug.issue}
          </p>
          {bug.metadata?.resolution && (isConfirmed || bug.status === 'resolved') && (
            <p className="text-[11px] text-ink-500 mt-1 italic truncate">✓ {bug.metadata.resolution}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-500">
            {bug.assigned_name && (
              <span className="flex items-center gap-1.5">
                <Avatar user={{ initials: bug.assigned_initials, avatar_color: bug.assigned_color, avatar_url: bug.assigned_avatar }} size={16} />
                {bug.assigned_name.split(' ')[0]}
              </span>
            )}
            {bug.deadline && <span className="flex items-center gap-1"><CalendarIcon width="12" height="12" /> {bug.deadline}</span>}
            <span>by {bug.reporter_name?.split(' ')[0]}</span>
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

// ── Bugs screen ──────────────────────────────────────────────

export default function Bugs({ me, unreadCount, onOpenNotifications, onSwitchTab }) {
  const showToast = useToast();
  const [bugs, setBugs] = useState([]);
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [detailBug, setDetailBug] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [inlineBusy, setInlineBusy] = useState(false);

  const filterWrap = useRef(null);
  const moreWrap = useRef(null);

  const load = () => {
    api.bugs(appFilter || undefined).then(setBugs);
    api.bugApps().then(setApps);
  };
  useEffect(() => { load(); }, [appFilter]);
  useEffect(() => { api.users().then(setUsers); }, []);

  // Filter by query (issue text)
  const visible = bugs.filter(b =>
    !query.trim() || b.issue.toLowerCase().includes(query.toLowerCase()) || b.app_name.toLowerCase().includes(query.toLowerCase())
  );

  const meId = me?.id;
  const awaitingMine = visible.filter(b => b.status === 'resolved' && b.reported_by === meId);
  const openBugs = visible.filter(b => b.status === 'open' || b.status === 'in_progress');
  const awaitingOthers = visible.filter(b => b.status === 'resolved' && b.reported_by !== meId);
  const confirmedBugs = visible.filter(b => b.status === 'confirmed');

  const exportCsv = () => {
    const rows = [['#','App','Issue','Status','Assigned','Deadline']];
    visible.forEach((b,i) => rows.push([i+1, b.app_name, `"${(b.issue||'').replace(/"/g,'""')}"`, b.status, b.assigned_name||'', b.deadline||'']));
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'});
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

  // Inline "Not fixed" opens the detail modal with reopen UI primed,
  // since we need a comment — don't fake a shortcut.
  const inlineReopen = (bug) => { setDetailBug(bug); };

  const hasAny = visible.length > 0 || confirmedBugs.length > 0;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-3xl font-bold text-ink-900 tracking-tight leading-tight">Bugs</h1>
          <p className="text-[13px] text-ink-500 mt-1">
            {openBugs.length} open{awaitingMine.length > 0 ? ` · ${awaitingMine.length} to confirm` : ''}
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
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search bugs…"
            className="w-full h-10 pl-9 pr-3 rounded-[10px] text-[13px] bg-white/5 text-ink-900 placeholder:text-ink-400 border border-white/10 focus:outline-none focus:border-brand-blue/50 transition"
          />
        </div>

        {/* Filter */}
        <div className="relative" ref={filterWrap}>
          <button
            onClick={() => { setFilterOpen(v => !v); setMoreOpen(false); }}
            className="h-10 px-3 rounded-[10px] text-[13px] font-medium text-ink-700 bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5"
            aria-label="Filter bugs"
          >
            <FilterIcon />
            {appFilter ? <span className="text-brand-blue">· 1</span> : null}
          </button>
          <FilterPopover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            apps={apps}
            appFilter={appFilter}
            onAppFilterChange={(v) => { setAppFilter(v); setFilterOpen(false); }}
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
      {appFilter && (
        <div className="flex flex-wrap gap-2">
          <FilterChip label={appFilter} onRemove={() => setAppFilter('')} />
        </div>
      )}

      {/* Empty state */}
      {!hasAny && (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <span className="text-ink-400"><BugIcon /></span>
          </div>
          <p className="text-[15px] font-semibold text-ink-900">
            {query || appFilter ? 'No bugs match' : 'No bugs reported'}
          </p>
          <p className="text-[12px] text-ink-500 mt-1">
            {query || appFilter ? 'Try a different search or clear the filter.' : 'Nothing to triage — nice.'}
          </p>
        </div>
      )}

      {/* Awaiting your confirmation */}
      {awaitingMine.length > 0 && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#22C55E] mb-2">
            Awaiting your confirmation · {awaitingMine.length}
          </p>
          <div className="space-y-2">
            {awaitingMine.map(b => (
              <BugCard
                key={b.id}
                bug={b}
                meId={meId}
                onOpen={() => setDetailBug(b)}
                onInlineConfirm={inlineConfirm}
                onInlineReopen={inlineReopen}
                busy={inlineBusy}
              />
            ))}
          </div>
        </section>
      )}

      {/* Open / In Progress */}
      {openBugs.length > 0 && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2">
            Active · {openBugs.length}
          </p>
          <div className="space-y-2">
            {openBugs.map(b => (
              <BugCard
                key={b.id}
                bug={b}
                meId={meId}
                onOpen={() => setDetailBug(b)}
                onInlineConfirm={inlineConfirm}
                onInlineReopen={inlineReopen}
                busy={inlineBusy}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resolved (not mine to confirm) */}
      {awaitingOthers.length > 0 && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2">
            Resolved · waiting on reporter · {awaitingOthers.length}
          </p>
          <div className="space-y-2">
            {awaitingOthers.map(b => (
              <BugCard
                key={b.id}
                bug={b}
                meId={meId}
                onOpen={() => setDetailBug(b)}
                onInlineConfirm={inlineConfirm}
                onInlineReopen={inlineReopen}
                busy={inlineBusy}
              />
            ))}
          </div>
        </section>
      )}

      {/* Confirmed (toggleable) */}
      {confirmedBugs.length > 0 && (
        <section>
          <button
            onClick={() => setShowConfirmed(v => !v)}
            className="w-full text-[12px] font-medium text-ink-400 hover:text-ink-700 py-2 transition"
          >
            {showConfirmed ? 'Hide' : 'Show'} {confirmedBugs.length} confirmed bug{confirmedBugs.length !== 1 ? 's' : ''}
          </button>
          {showConfirmed && (
            <div className="space-y-2 mt-1">
              {confirmedBugs.map(b => (
                <BugCard
                  key={b.id}
                  bug={b}
                  meId={meId}
                  onOpen={() => setDetailBug(b)}
                  onInlineConfirm={inlineConfirm}
                  onInlineReopen={inlineReopen}
                  busy={inlineBusy}
                />
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
