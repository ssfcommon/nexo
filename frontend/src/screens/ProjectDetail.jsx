import React, { useEffect, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { Avatar, AvatarStack, PriorityTag, ProgressBar, deptDotColor, COMPLEXITIES } from '../components/ui.jsx';
import { NewMeetingModal } from '../components/QuickActions.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import { fireConfetti } from '../components/Confetti.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import GanttChart from '../components/GanttChart.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useLiveUpdates from '../hooks/useLiveUpdates.js';

function SubtaskMenu({ s, meId, depth, onEdit, onDelete, onPoke, onAddSub }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const items = [];
  if (s.status !== 'done') {
    items.push({ label: 'Edit', icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z', action: () => { onEdit(); setOpen(false); } });
  }
  if (s.owner_id && s.owner_id !== meId && s.status !== 'done') {
    items.push({ label: 'Poke', emoji: '👆', action: () => { onPoke(); setOpen(false); } });
  }
  if ((depth || 0) < 2 && s.status !== 'done') {
    items.push({ label: 'Add substep', icon: 'M12 5v14M5 12h14', action: () => { onAddSub(); setOpen(false); } });
  }
  items.push({ label: 'Delete', icon: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6', danger: true, action: () => { onDelete(); setOpen(false); } });

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: '#6B7280', background: open ? 'rgba(255,255,255,0.08)' : 'transparent' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-50 min-w-[160px] py-1.5 rounded-xl animate-fade-in"
          style={{ background: 'linear-gradient(160deg, rgba(22,30,50,0.97) 0%, rgba(12,18,32,0.99) 100%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.2)' }}>
          {items.map((item, idx) => (
            <button key={idx} onClick={item.action}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-left transition-colors hover:bg-white/[0.06]"
              style={{ color: item.danger ? '#F87171' : '#D1D5DB' }}>
              {item.icon ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
              ) : <span className="w-[14px] text-center text-[13px]">{item.emoji || ''}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Checklist({ subtasks, members, meId, projectId, onToggle, onAdd, onPoke, onEdit, onDelete, onReorder }) {
  const [newTitle, setNewTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [leaveWarn, setLeaveWarn] = useState(null);
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [subTitle, setSubTitle] = useState('');
  const [subDeadline, setSubDeadline] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editComplexity, setEditComplexity] = useState('');
  const [newComplexity, setNewComplexity] = useState('');
  const [dragId, setDragId] = useState(null);
  const [hoverId, setHoverId] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLeaveWarn(null);
    if (ownerId && deadline) {
      api.checkLeave(ownerId, deadline).then(r => {
        if (!cancel && r.onLeave) setLeaveWarn(r);
      }).catch(() => {});
    }
    return () => { cancel = true; };
  }, [ownerId, deadline]);

  const submit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    // Deadline is mandatory — don't let the form submit without one, and
    // make the gap visually obvious by flashing focus onto the date field.
    if (!deadline) {
      const el = e.currentTarget?.querySelector?.('input[type="date"]');
      if (el) el.focus();
      return;
    }
    onAdd(newTitle.trim(), ownerId || null, deadline, null, newComplexity || null);
    setNewTitle('');
    setOwnerId('');
    setDeadline('');
    setNewComplexity('');
    setLeaveWarn(null);
  };
  return (
    <div className="card !p-0 overflow-visible">
      {subtasks.map((s, i) => (
        <React.Fragment key={s.id}>
        <div
          draggable={s.depth === 0}
          onDragStart={() => setDragId(s.id)}
          onDragEnd={() => { setDragId(null); setHoverId(null); }}
          onDragOver={(e) => { e.preventDefault(); if (s.depth === 0 && s.id !== dragId) setHoverId(s.id); }}
          onDrop={() => { if (dragId && s.id !== dragId && s.depth === 0) { onReorder?.(dragId, s.id); } setDragId(null); setHoverId(null); }}
          className={'flex items-center gap-3 py-3.5 transition ' +
            (i < subtasks.length - 1 ? 'border-b ' : '') +
            (dragId === s.id ? 'opacity-40 ' : '') +
            (hoverId === s.id ? 'bg-brand-blueLight ' : '') +
            (s.depth === 0 ? 'cursor-grab active:cursor-grabbing ' : '')}
          style={{ paddingLeft: `${(s.depth || 0) * 20 + 16}px`, paddingRight: '12px', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {/* Checkbox */}
          <button
            onClick={() => onToggle(s)}
            className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              borderColor: s.status === 'done' ? '#22C55E' : 'rgba(255,255,255,0.2)',
              backgroundColor: s.status === 'done' ? '#22C55E' : 'transparent',
              boxShadow: s.status === 'done' ? '0 0 8px rgba(34,197,94,0.3)' : 'none',
            }}
          >
            {s.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </button>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            {editingId === s.id ? (
              <form onSubmit={(e) => { e.preventDefault(); if (editTitle.trim()) { onEdit(s.id, { title: editTitle.trim(), complexity: editComplexity || undefined }); setEditingId(null); } }} className="space-y-2">
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full h-9 px-3 text-[14px] rounded-lg input-base" autoFocus />
                <div className="flex items-center gap-2">
                  <select value={editComplexity} onChange={e => setEditComplexity(e.target.value)} className="h-8 px-2 text-[12px] rounded-lg input-base">
                    <option value="">Complexity</option>
                    {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="submit" className="h-8 px-3 text-[12px] font-semibold rounded-lg" style={{ background: 'rgba(91,140,255,0.15)', color: '#7EB0FF' }}>Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="h-8 px-3 text-[12px] rounded-lg" style={{ color: '#6B7280' }}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <p className={'text-[14px] leading-snug ' + (s.status === 'done' ? 'line-through' : '')} style={{ color: s.status === 'done' ? '#6B7280' : '#E5E7EB' }}>
                  {s.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {s.complexity && (
                    <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold"
                      style={{ color: s.complexity === 'High Complex' ? '#F87171' : '#4ADE80', backgroundColor: s.complexity === 'High Complex' ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)' }}>
                      {s.complexity === 'High Complex' ? 'HC' : 'LC'}
                    </span>
                  )}
                  {s.assignment_status === 'pending' && (
                    <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold" style={{ color: '#FBBF24', backgroundColor: 'rgba(251,191,36,0.12)' }}>Pending</span>
                  )}
                  {s.assignment_status === 'declined' && (
                    <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold" style={{ color: '#F87171', backgroundColor: 'rgba(248,113,113,0.12)' }}>Declined</span>
                  )}
                  {s.deadline && (
                    <span className="text-[11px]" style={{ color: '#6B7280' }}>
                      Due {new Date(s.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {s.creator_name && s.assigned_by && s.assigned_by !== s.owner_id && (
                    <span
                      className="text-[11px]"
                      style={{ color: '#4B5563' }}
                      title={`Created by ${s.creator_name}`}
                    >
                      · by {s.creator_name.split(' ')[0]}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Avatar */}
          {editingId !== s.id && s.owner_initials && (
            <Avatar
              user={{ initials: s.owner_initials, avatar_color: s.owner_color, avatar_url: s.owner_avatar, name: s.owner_name }}
              size={28}
            />
          )}

          {/* Overflow menu */}
          {editingId !== s.id && (
            <SubtaskMenu
              s={s}
              meId={meId}
              depth={s.depth}
              onEdit={() => { setEditingId(s.id); setEditTitle(s.title); setEditComplexity(s.complexity || ''); }}
              onDelete={() => onDelete?.(s.id)}
              onPoke={() => onPoke(s)}
              onAddSub={() => setAddingSubFor(addingSubFor === s.id ? null : s.id)}
            />
          )}
        </div>

        {/* Inline substep form — deadline required, same as top-level form */}
        {addingSubFor === s.id && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!subTitle.trim()) return;
              if (!subDeadline) {
                const el = e.currentTarget?.querySelector?.('input[type="date"]');
                if (el) el.focus();
                return;
              }
              onAdd(subTitle.trim(), null, subDeadline, s.id);
              setSubTitle('');
              setSubDeadline('');
              setAddingSubFor(null);
            }}
            className="flex flex-wrap items-center gap-2 py-2.5"
            style={{ paddingLeft: `${(s.depth || 0) * 20 + 48}px`, paddingRight: '16px', background: 'rgba(91,140,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,140,255,0.15)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7EB0FF" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <input
              value={subTitle}
              onChange={e => setSubTitle(e.target.value)}
              placeholder="Add a substep…"
              className="flex-1 min-w-[140px] bg-transparent text-[13px] outline-none"
              style={{ color: '#E5E7EB' }}
              autoFocus
            />
            <input
              type="date"
              value={subDeadline}
              onChange={e => setSubDeadline(e.target.value)}
              required
              aria-label="Deadline (required)"
              title="Deadline is required"
              className="h-7 px-2 text-[12px] rounded-lg input-base"
              style={{
                borderColor: subDeadline ? undefined : 'rgba(245,158,11,0.5)',
                boxShadow: subDeadline ? undefined : 'inset 0 0 0 1px rgba(245,158,11,0.25)',
              }}
            />
            <button type="submit" className="h-7 px-2.5 text-[12px] font-semibold rounded-lg" style={{ background: 'rgba(91,140,255,0.15)', color: '#7EB0FF' }}>Add</button>
            <button type="button" onClick={() => { setAddingSubFor(null); setSubDeadline(''); setSubTitle(''); }} className="h-7 px-2 text-[12px] rounded-lg" style={{ color: '#6B7280' }}>Cancel</button>
          </form>
        )}
      </React.Fragment>
      ))}
      <form onSubmit={submit} className="px-4 py-3 space-y-2"
        style={{ borderTop: '1px dashed rgba(91,140,255,0.25)', background: 'linear-gradient(135deg, rgba(91,140,255,0.06) 0%, rgba(91,140,255,0.02) 100%)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(91,140,255,0.2) 0%, rgba(91,140,255,0.1) 100%)', border: '1px solid rgba(91,140,255,0.25)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7EB0FF" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Add a subtask…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#7EB0FF]/50"
            style={{ color: '#E5E7EB' }}
          />
        </div>
        {newTitle && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={ownerId}
                onChange={e => setOwnerId(e.target.value)}
                className="flex-1 min-w-[120px] h-9 px-2 text-[13px] rounded-[8px] input-base"
              >
                <option value="">Assign to me</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>Assign to {m.name.split(' ')[0]}</option>
                ))}
              </select>
              <select
                value={newComplexity}
                onChange={e => setNewComplexity(e.target.value)}
                className="h-9 px-2 text-[12px] rounded-[8px] input-base"
              >
                <option value="">Complexity</option>
                {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                required
                aria-label="Deadline (required)"
                title="Deadline is required"
                className="h-9 px-2 text-[13px] rounded-[8px] input-base"
                style={{
                  borderColor: deadline ? undefined : 'rgba(245,158,11,0.5)',
                  boxShadow: deadline ? undefined : 'inset 0 0 0 1px rgba(245,158,11,0.25)',
                }}
              />
              <button type="submit" className="pill pill-primary !h-9 !px-3 !text-[13px]">Add</button>
            </div>
            {!deadline && (
              <p className="text-[11px]" style={{ color: '#F59E0B' }}>
                Pick a deadline — every subtask needs one so it can surface on Home's "This Week".
              </p>
            )}
            {leaveWarn && (
              <div className="rounded-[8px] px-3 py-2 text-[12px] flex items-start gap-2" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#B45309' }}>
                <span>⚠️</span>
                <span>{members.find(m => m.id === ownerId)?.name.split(' ')[0]} is on leave {leaveWarn.from} → {leaveWarn.to}. You can still assign, but they'll see it on return.</span>
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
}

function renderCommentBody(body) {
  // highlight @Mentions
  const parts = body.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith('@')
      ? <span key={i} className="text-brand-blue font-semibold">{p}</span>
      : <span key={i}>{p}</span>
  );
}

function relTime(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - d.getTime();
  const h = Math.round(diffMs / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function EditProjectModal({ open, onClose, project, onUpdated }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [department, setDepartment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && project) {
      setTitle(project.title || '');
      setDescription(project.description || '');
      setDeadline(project.deadline || '');
      setDepartment(project.department || 'Operations');
    }
  }, [open, project]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.updateProject(project.id, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline || null,
        department,
      });
      onUpdated?.();
    } catch (err) { showToast(err.message || 'Failed to update project', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Project">
      <form onSubmit={submit}>
        <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required /></Field>
        <Field label="Department">
          <select className={inputCls} value={department} onChange={e => setDepartment(e.target.value)}>
            <option>Operations</option><option>CEO's Office</option><option>Common</option>
          </select>
        </Field>
        <Field label="Description"><textarea className={inputCls + ' h-20 resize-none'} value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <Field label="Deadline"><input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Save Changes'}</button>
      </form>
    </Modal>
  );
}

function MentionInput({ value, onChange, onSubmit, members, placeholder, className }) {
  const inputRef = React.useRef(null);
  const [mentionQuery, setMentionQuery] = useState(null); // null | { start, query }
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = React.useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.query.toLowerCase();
    return (members || [])
      .filter(m => m.name?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, members]);

  const detect = (text, caret) => {
    // Look backward from caret for '@' without whitespace in between
    const prefix = text.slice(0, caret);
    const m = prefix.match(/@(\w*)$/);
    if (!m) return null;
    return { start: caret - m[0].length, query: m[1] };
  };

  const handleChange = (e) => {
    const text = e.target.value;
    const caret = e.target.selectionStart || text.length;
    onChange(text);
    setMentionQuery(detect(text, caret));
    setActiveIdx(0);
  };

  const select = (member) => {
    const first = member.name.split(' ')[0];
    const before = value.slice(0, mentionQuery.start);
    const after = value.slice((inputRef.current?.selectionStart) ?? value.length);
    const next = `${before}@${first} ${after}`;
    onChange(next);
    setMentionQuery(null);
    setActiveIdx(0);
    // Restore focus + caret right after the inserted mention
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = before.length + first.length + 2; // @ + name + space
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (mentionQuery != null && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); select(filtered[activeIdx]); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) { e.preventDefault(); onSubmit(); }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setMentionQuery(null), 120)}
        placeholder={placeholder}
        className={className}
      />
      {mentionQuery != null && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 min-w-[220px] max-h-[240px] overflow-auto rounded-xl py-1.5 z-50"
          style={{
            background: 'linear-gradient(160deg, rgba(22,30,50,0.98) 0%, rgba(12,18,32,0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}>
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(m); }}
              onMouseEnter={() => setActiveIdx(i)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{ background: i === activeIdx ? 'rgba(91,140,255,0.12)' : 'transparent' }}>
              <Avatar user={m} size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: '#E5E7EB' }}>{m.name}</p>
                {m.department && <p className="text-[11px] truncate" style={{ color: '#6B7280' }}>{m.department}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail({ projectId, me, onBack }) {
  const showToast = useToast();
  const [p, setP] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailView, setDetailView] = useState('list'); // 'list' | 'board' | 'timeline'
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id, title }

  const load = () => {
    api.project(projectId).then(setP);
    api.projectMeetings(projectId).then(setMeetings).catch(() => setMeetings([]));
  };
  useEffect(() => { load(); }, [projectId]);

  useLiveUpdates({
    'subtask-updated': (data) => { if (data.projectId === projectId) load(); },
    'comment-created': (data) => { if (data.projectId === projectId) load(); },
  });

  const pokeSubtask = async (s) => {
    try {
      const r = await api.poke(s.owner_id, s.id, projectId);
      showToast(r.queuedForReturn ? `Poke sent — ${s.owner_name} is on leave` : `Poked ${s.owner_name?.split(' ')[0]} 👆`);
    } catch (e) {
      showToast(e.status === 429 ? 'Already poked today' : 'Could not send poke', 'warning');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    try {
      if (type === 'project') { await api.deleteProject(id); showToast('Project deleted'); onBack(); return; }
      if (type === 'subtask') { await api.deleteSubtask(id); showToast('Subtask deleted'); }
      if (type === 'comment') { await api.deleteComment(id); showToast('Comment deleted'); }
      load();
    } catch { showToast('Delete failed', 'error'); }
    setConfirmDelete(null);
  };

  if (!p) return <div className="p-4 text-ink-300">Loading…</div>;

  const toggleSubtask = async (s) => {
    try {
      const next = s.status === 'done' ? 'pending' : 'done';
      await api.updateSubtask(s.id, { status: next });
      if (next === 'done') { fireConfetti(); showToast('Subtask completed'); }
      load();
    } catch (err) { showToast(err.message || 'Failed to update subtask', 'error'); }
  };
  const addSubtask = async (title, ownerId, deadline, parentId, complexity) => {
    try {
      await api.createSubtask(projectId, { title, ownerId, deadline, parentId, complexity });
      showToast('Subtask added');
      load();
    } catch (err) { showToast(err.message || 'Failed to add subtask', 'error'); }
  };
  const editSubtask = async (id, patch) => {
    try {
      await api.updateSubtask(id, patch);
      load();
    } catch (err) { showToast(err.message || 'Failed to edit subtask', 'error'); }
  };
  const deleteSubtask = (id) => {
    const s = p.subtasks.find(st => st.id === id);
    setConfirmDelete({ type: 'subtask', id, title: s?.title || 'this subtask' });
  };
  const reorderSubtask = async (draggedId, targetId) => {
    try {
      const dragIdx = p.subtasks.findIndex(s => s.id === draggedId);
      const targetIdx = p.subtasks.findIndex(s => s.id === targetId);
      if (dragIdx < 0 || targetIdx < 0) return;
      const targetOrder = p.subtasks[targetIdx].sort_order;
      await api.updateSubtask(draggedId, { sort_order: targetOrder });
      const dir = dragIdx < targetIdx ? 1 : -1;
      const start = Math.min(dragIdx, targetIdx);
      const end = Math.max(dragIdx, targetIdx);
      for (let i = start; i <= end; i++) {
        if (p.subtasks[i].id !== draggedId) {
          await api.updateSubtask(p.subtasks[i].id, { sort_order: p.subtasks[i].sort_order - dir });
        }
      }
      load();
      showToast('Subtasks reordered');
    } catch (err) { showToast(err.message || 'Failed to reorder subtasks', 'error'); }
  };

  const moveSubtask = async (subtask, newStatus) => {
    try {
      await api.updateSubtask(subtask.id, { status: newStatus });
      if (newStatus === 'done') { fireConfetti(); showToast('Subtask completed'); }
      load();
    } catch (err) { showToast(err.message || 'Failed to move subtask', 'error'); }
  };

  const deleteComment = (id) => {
    setConfirmDelete({ type: 'comment', id, title: 'this comment' });
  };
  const submitComment = async (e) => {
    e?.preventDefault?.();
    if (!newComment.trim() && pendingFiles.length === 0) return;
    try {
      const attachments = await Promise.all(
        pendingFiles.map(async f => ({ filename: f.name, dataUrl: await readFileAsDataURL(f) }))
      );
      await api.createComment(projectId, newComment.trim() || '(attachment)', attachments);
      setNewComment('');
      setPendingFiles([]);
      showToast('Comment posted');
      load();
    } catch (err) { showToast(err.message || 'Failed to post comment', 'error'); }
  };

  const doneCount = p.subtasks.filter(s => s.status === 'done').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="text-ink-500" aria-label="Back">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h1 className="text-[20px] font-bold text-ink-900 flex-1 min-w-0 truncate">{p.title}</h1>
        <button onClick={() => setEditOpen(true)} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-300 hover:text-brand-blue hover:border-brand-blue transition" title="Edit project">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onClick={() => setConfirmDelete({ type: 'project', id: projectId, title: p.title })} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-300 hover:text-danger hover:border-danger transition" title="Delete project">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
        <button onClick={() => window.print()} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-300 hover:text-ink-900 transition" title="Print / Save PDF">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
      </div>

      {/* Meta card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: deptDotColor(p.department) }} />
            <span className="text-[13px] text-ink-500">{p.department}</span>
          </div>
          <PriorityTag priority={p.priority} />
          {p.deadline && (
            <span className="text-[12px] text-ink-500 ml-auto">
              Due {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {p.description && <p className="text-[13px] text-ink-500 mb-3">{p.description}</p>}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1"><ProgressBar percent={p.progress} /></div>
          <span className="text-[13px] font-semibold text-brand-blue">{p.progress}%</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-ink-300">{doneCount} of {p.subtasks.length} subtasks complete</p>
          <AvatarStack users={p.members} max={3} size={26} />
        </div>
      </div>

      {/* Archive ceremony — shows when all subtasks done */}
      {p.progress === 100 && p.subtasks.length > 0 && p.status === 'active' && (
        <div className="card text-center py-5" style={{ background: 'linear-gradient(135deg, #F0FFF4, #EEF1FF)' }}>
          <p className="text-[28px] mb-1">🎉</p>
          <p className="text-[16px] font-bold text-ink-900">All subtasks complete!</p>
          <p className="text-[13px] text-ink-500 mt-1 mb-3">Great work, team. Ready to close this project?</p>
          <button
            onClick={async () => {
              await api.updateProject(projectId, { status: 'completed' });
              fireConfetti(); fireConfetti();
              showToast('Project completed! 🎉');
              load();
            }}
            className="pill bg-success text-white !h-10 !px-5 !text-[13px] font-semibold"
          >
            ✓ Mark as Complete
          </button>
        </div>
      )}
      {p.status === 'completed' && (
        <div className="card flex items-center gap-3 py-3" style={{ backgroundColor: 'rgba(34,197,94,0.06)' }}>
          <span className="text-[18px]">✅</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-success">Project Completed</p>
            <p className="text-[11px] text-ink-500">All tasks finished. This project is archived.</p>
          </div>
          <button
            onClick={async () => {
              await api.updateProject(projectId, { status: 'active' });
              showToast('Project reopened');
              load();
            }}
            className="text-[11px] text-brand-blue font-medium"
          >
            Reopen
          </button>
        </div>
      )}

      {/* Checklist / Board / Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          {['list', 'board', 'timeline'].map(v => (
            <button key={v} onClick={() => setDetailView(v)}
              className={'px-3 h-8 rounded-full text-[12px] font-medium transition ' +
                (detailView === v ? 'bg-brand-blue text-white' : 'bg-[#F3F4F6] text-ink-500 hover:bg-[#E5E7EB]')}>
              {v === 'list' ? 'List' : v === 'board' ? 'Board' : 'Timeline'}
            </button>
          ))}
        </div>
        {detailView === 'list' && (
          <Checklist
            subtasks={p.subtasks}
            members={p.members || []}
            meId={me?.id}
            projectId={projectId}
            onToggle={toggleSubtask}
            onAdd={addSubtask}
            onPoke={pokeSubtask}
            onEdit={editSubtask}
            onDelete={deleteSubtask}
            onReorder={reorderSubtask}
          />
        )}
        {detailView === 'board' && (
          <KanbanBoard subtasks={p.subtasks} onMove={moveSubtask} />
        )}
        {detailView === 'timeline' && (
          <GanttChart projectStart={p.created_at?.slice(0, 10)} projectEnd={p.deadline} subtasks={p.subtasks} />
        )}
      </div>

      {/* Meetings */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Meetings ({meetings.length})</p>
          <button onClick={() => setMeetingModalOpen(true)} className="text-[13px] text-brand-blue font-semibold">+ Schedule</button>
        </div>
        <div className="space-y-2">
          {meetings.map(m => (
            <div key={m.id} className="card !p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-brand-blueLight flex items-center justify-center text-brand-blue">📅</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[14px] text-ink-900 truncate">{m.title}</p>
                <p className="text-[11px] text-ink-500">{m.start_time} · {m.duration_min} min</p>
              </div>
              {m.meet_link && (
                <a href={m.meet_link} target="_blank" rel="noreferrer" className="pill bg-success text-white !h-8 !px-3 !text-[12px]">Join</a>
              )}
            </div>
          ))}
          {meetings.length === 0 && <p className="text-ink-300 text-sm">No meetings scheduled.</p>}
        </div>
      </div>

      <NewMeetingModal
        open={meetingModalOpen}
        onClose={() => setMeetingModalOpen(false)}
        onCreated={() => { load(); showToast('Meeting scheduled'); }}
        projectId={projectId}
        members={p.members || []}
      />

      <EditProjectModal open={editOpen} onClose={() => setEditOpen(false)} project={p} onUpdated={() => { load(); showToast('Project updated'); setEditOpen(false); }} />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={confirmDelete?.type === 'project' ? 'Delete Project' : confirmDelete?.type === 'subtask' ? 'Delete Subtask' : 'Delete Comment'}
        message={`Are you sure you want to delete "${confirmDelete?.title}"? This cannot be undone.`}
      />

      {/* Comments */}
      <div>
        <p className="section-label mb-2">Comments ({p.comments.length})</p>
        <div className="space-y-3">
          {p.comments.map(c => (
            <div key={c.id} className="card flex gap-3 !p-3">
              <Avatar
                user={{ initials: c.author_initials, avatar_color: c.author_color, avatar_url: c.author_avatar, name: c.author_name }}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-ink-900">{c.author_name}</span>
                  <span className="text-[11px] text-ink-300">{relTime(c.created_at)}</span>
                  {c.author_id === me?.id && (
                    <button onClick={() => deleteComment(c.id)} className="text-ink-300 hover:text-danger text-[11px] ml-auto" title="Delete">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-ink-900 mt-0.5 whitespace-pre-wrap">{renderCommentBody(c.body)}</p>
                {c.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {c.attachments.map(a => {
                      const fullUrl = ASSET_ORIGIN + a.url;
                      return a.mime?.startsWith('image/') ? (
                        <a key={a.id} href={fullUrl} target="_blank" rel="noreferrer">
                          <img src={fullUrl} alt={a.filename} className="h-20 w-20 rounded-[8px] object-cover border border-line-light" />
                        </a>
                      ) : (
                        <a key={a.id} href={fullUrl} download={a.filename} className="rounded-[8px] border border-line-light px-2 py-1 text-[12px] text-brand-blue">
                          📎 {a.filename}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {p.comments.length === 0 && <p className="text-ink-300 text-sm">No comments yet.</p>}
        </div>
        <form onSubmit={submitComment} className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={() => submitComment()}
              members={p.members || []}
              placeholder="Add a comment… use @Name to mention"
              className="w-full px-4 h-11 rounded-pill border border-line-light bg-white text-[14px]"
            />
            <label className="pill pill-outline cursor-pointer !px-3" title="Attach files">
              📎
              <input
                type="file"
                multiple
                className="hidden"
                onChange={e => setPendingFiles(Array.from(e.target.files || []))}
              />
            </label>
            <button type="submit" className="pill pill-primary">Post</button>
          </div>
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[12px] text-ink-500">
              {pendingFiles.map((f, i) => (
                <span key={i} className="rounded-full bg-line-light px-2 py-0.5">📎 {f.name}</span>
              ))}
              <button type="button" onClick={() => setPendingFiles([])} className="text-danger">clear</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
