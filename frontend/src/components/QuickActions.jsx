import React, { useEffect, useState } from 'react';
import Modal, { Field, inputCls } from './Modal.jsx';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  CalendarIcon, UserIcon, MoreIcon, CheckIcon, PaperclipIcon, LinkIcon, CloseIcon,
} from './Icons.jsx';
import { ACCENT_PALETTE, ACCENT_KEYS, EMOJI_CHOICES, DEFAULT_EMOJI } from '../lib/projectAccent.js';
import { spring } from '../lib/motion.js';

import { PRIORITIES, COMPLEXITIES } from './ui.jsx';
const DEPARTMENTS = ['Operations', "CEO's Office", 'Common'];

// Rotating placeholders for the project-title input. Playful but
// credible — drawn from real work. Changes every ~3.5s while empty.
const PROJECT_PLACEHOLDERS = [
  'Mobile redesign',
  'Q2 planning sprint',
  'Launch the new site',
  'Customer onboarding revamp',
  'Retail partnerships push',
];

function today() { return new Date().toISOString().slice(0, 10); }
function isoOffset(days) { return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10); }

// Placeholders rotate every few seconds while the title is empty — subtly
// hints at the variety of things you can quickly capture.
const PLACEHOLDERS = [
  'Call the vendor about packaging',
  'Reply to Alex about the proposal',
  'Review Q1 numbers',
  'Follow up with finance',
  'Book flight to Mumbai',
];

// ── Date preset popover ─────────────────────────────────────────
function DatePresetPopover({ value, presets, onChange, onClear, onClose }) {
  const [customOpen, setCustomOpen] = useState(false);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 left-0 top-[calc(100%+6px)] w-56 rounded-[12px] py-1.5"
        style={{
          background: 'rgba(17,24,39,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {presets.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition"
          >
            <span className="text-[13px] text-ink-900 flex-1">{p.label}</span>
            {value === p.value && <span className="text-brand-blue"><CheckIcon width="12" height="12" /></span>}
          </button>
        ))}
        <div className="mx-2 my-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition"
          >
            <span className="text-[13px] text-ink-900 flex-1">Pick date…</span>
          </button>
        ) : (
          <div className="px-2 py-1.5">
            <input
              type="date"
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              className="w-full h-9 px-2 rounded-[8px] text-[13px] bg-white/5 border border-white/10 text-ink-900"
            />
          </div>
        )}
        <button
          type="button"
          onClick={onClear}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition"
        >
          <span className="text-[13px] text-ink-400 flex-1">No deadline</span>
          {!value && <span className="text-brand-blue"><CheckIcon width="12" height="12" /></span>}
        </button>
      </div>
    </>
  );
}

// ── Assignee popover ───────────────────────────────────────────
function AssigneePopover({ value, users, onChange, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 left-0 top-[calc(100%+6px)] w-56 rounded-[12px] py-1.5 max-h-[280px] overflow-y-auto"
        style={{
          background: 'rgba(17,24,39,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <button
          type="button"
          onClick={() => onChange('')}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition"
        >
          <span className="text-[13px] text-ink-900 flex-1">Myself</span>
          {!value && <span className="text-brand-blue"><CheckIcon width="12" height="12" /></span>}
        </button>
        <div className="mx-2 my-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        {users.map(u => {
          const active = String(value) === String(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onChange(String(u.id))}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition"
            >
              <span className="text-[13px] text-ink-900 flex-1 truncate">{u.name}</span>
              {active && <span className="text-brand-blue"><CheckIcon width="12" height="12" /></span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Chip ───────────────────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.96] hover:brightness-110"
      style={{
        background: active ? 'rgba(91,140,255,0.14)' : 'rgba(255,255,255,0.04)',
        color: active ? '#A8C4FF' : '#9CA3AF',
        border: `1px solid ${active ? 'rgba(91,140,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {children}
    </button>
  );
}

// ── Quick Task modal ───────────────────────────────────────────
export function QuickTaskModal({ open, onClose, onCreated }) {
  const showToast = useToast();

  // Core state
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(today());
  const [assignedTo, setAssignedTo] = useState('');

  // Secondary state (inside the "More" sheet)
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [calTime, setCalTime] = useState('09:00');
  const [calDuration, setCalDuration] = useState(30);

  // UI state
  const [datePopOpen, setDatePopOpen] = useState(false);
  const [assigneePopOpen, setAssigneePopOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDeadline(today());
    setRecurrence('');
    setDescription('');
    setFiles([]);
    setLinks([]);
    setNewLink('');
    setAddToCalendar(false);
    setCalTime('09:00');
    setCalDuration(30);
    setDatePopOpen(false);
    setAssigneePopOpen(false);
    setMoreOpen(false);
    setPhIdx(0);
    // Smart recency — remember who the user last assigned to.
    const last = typeof window !== 'undefined' ? localStorage.getItem('nexo:qt:last-assignee') || '' : '';
    setAssignedTo(last);
    api.users().then(setUsers);
  }, [open]);

  // Rotate placeholder while empty — pause once the user types.
  useEffect(() => {
    if (!open || title) return;
    const id = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(id);
  }, [open, title]);

  const readFiles = async (fileList) => {
    const result = [];
    for (const f of fileList) {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      result.push({ filename: f.name, dataUrl });
    }
    return result;
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const attachments = await readFiles(files);
      await api.createTask({
        title: title.trim(),
        deadline,
        // Complexity field removed from UI — server default / Medium sentinel.
        complexity: COMPLEXITIES[1],
        isQuick: true,
        recurrence: recurrence || null,
        description: description.trim() || null,
        assignedTo: assignedTo || null,
        attachments,
        links,
      });
      if (addToCalendar) {
        try {
          await api.createEvent({
            title: title.trim(),
            startTime: new Date(`${deadline}T${calTime}:00`).toISOString(),
            durationMin: Number(calDuration),
            eventType: 'work',
          });
        } catch {} // silent — task already created
      }
      if (assignedTo) localStorage.setItem('nexo:qt:last-assignee', assignedTo);
      else localStorage.removeItem('nexo:qt:last-assignee');
      onCreated?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to create task', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Cmd/Ctrl + Enter submits from anywhere (incl. Description)
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  // Human-friendly label for the deadline chip
  const deadlineLabel = (() => {
    if (!deadline) return '+ Deadline';
    const t = today();
    const tmr = isoOffset(1);
    if (deadline === t) return 'Today';
    if (deadline === tmr) return 'Tomorrow';
    return new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  const assigneeLabel = (() => {
    if (!assignedTo) return 'Myself';
    const u = users.find(x => String(x.id) === String(assignedTo));
    if (!u) return 'Myself';
    return u.name.split(' ')[0];
  })();

  // Date presets — "This Friday" / "Next week" / etc.
  const datePresets = (() => {
    const t = today();
    const tmr = isoOffset(1);
    const now = new Date();
    const daysToFri = (5 - now.getDay() + 7) % 7 || 7;
    const fri = isoOffset(daysToFri);
    const nxtWk = isoOffset(7);
    return [
      { label: 'Today', value: t },
      { label: 'Tomorrow', value: tmr },
      { label: 'This Friday', value: fri },
      { label: 'Next week', value: nxtWk },
    ];
  })();

  return (
    <Modal open={open} onClose={onClose} title="Quick task">
      <form onSubmit={submit} onKeyDown={onKeyDown}>
        {/* Hero title — the one thing that matters */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          required
          placeholder={PLACEHOLDERS[phIdx] + '…'}
          className="hero-input"
        />

        {/* Chip row — deadline, assignee, more */}
        <div className="flex items-center gap-2 mt-4 mb-5 flex-wrap">
          <div className="relative">
            <Chip
              active={!!deadline}
              onClick={() => { setDatePopOpen(v => !v); setAssigneePopOpen(false); }}
            >
              {deadline && <CalendarIcon width="12" height="12" />}
              {deadlineLabel}
            </Chip>
            {datePopOpen && (
              <DatePresetPopover
                value={deadline}
                presets={datePresets}
                onChange={(v) => { setDeadline(v); setDatePopOpen(false); }}
                onClear={() => { setDeadline(''); setDatePopOpen(false); }}
                onClose={() => setDatePopOpen(false)}
              />
            )}
          </div>

          <div className="relative">
            <Chip
              active={!!assignedTo}
              onClick={() => { setAssigneePopOpen(v => !v); setDatePopOpen(false); }}
            >
              {assignedTo && <UserIcon width="12" height="12" />}
              {assigneeLabel}
            </Chip>
            {assigneePopOpen && (
              <AssigneePopover
                value={assignedTo}
                users={users}
                onChange={(v) => { setAssignedTo(v); setAssigneePopOpen(false); }}
                onClose={() => setAssigneePopOpen(false)}
              />
            )}
          </div>

          <Chip active={moreOpen} onClick={() => setMoreOpen(v => !v)}>
            <MoreIcon width="12" height="12" />
            {moreOpen ? 'Less' : 'More'}
          </Chip>
        </div>

        {/* More sheet — collapsed by default */}
        {moreOpen && (
          <div className="space-y-3 pt-1 pb-2 border-t animate-fade-in" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <Field label="Description (optional)">
              <textarea
                className={inputCls + ' !h-16 py-2'}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Details, notes…"
              />
            </Field>

            <Field label="Attachments">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <span
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      <PaperclipIcon /> File
                    </span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={e => setFiles(Array.from(e.target.files || []))}
                    />
                  </label>
                  <input
                    value={newLink}
                    onChange={e => setNewLink(e.target.value)}
                    placeholder="Paste a link…"
                    className="flex-1 h-8 px-3 rounded-[8px] text-[12px] bg-white/5 border border-white/10 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-blue/50"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newLink.trim()) { setLinks(l => [...l, newLink.trim()]); setNewLink(''); }
                      }
                    }}
                  />
                </div>
                {(files.length > 0 || links.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {files.map((f, i) => (
                      <span
                        key={`f${i}`}
                        className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#D1D5DB', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <PaperclipIcon /> {f.name}
                      </span>
                    ))}
                    {links.map((l, i) => (
                      <span
                        key={`l${i}`}
                        className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(91,140,255,0.12)', color: '#A8C4FF', border: '1px solid rgba(91,140,255,0.22)' }}
                      >
                        <LinkIcon />
                        {l.length > 28 ? l.slice(0, 28) + '…' : l}
                        <button
                          type="button"
                          onClick={() => setLinks(ls => ls.filter((_, j) => j !== i))}
                          className="ml-0.5 text-ink-400 hover:text-[#F87171] transition"
                        >
                          <CloseIcon width="10" height="10" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field label="Repeat">
              <select
                className={inputCls}
                value={recurrence}
                onChange={e => setRecurrence(e.target.value)}
              >
                <option value="">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>

            {/* Add to Calendar */}
            <div>
              <button
                type="button"
                onClick={() => setAddToCalendar(v => !v)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition text-left"
                style={{
                  background: addToCalendar ? 'rgba(91,140,255,0.10)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${addToCalendar ? 'rgba(91,140,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <span className={addToCalendar ? 'text-[#A8C4FF]' : 'text-ink-400'}>
                  <CalendarIcon width="15" height="15" />
                </span>
                <span className={'flex-1 text-[13px] font-medium ' + (addToCalendar ? 'text-[#A8C4FF]' : 'text-ink-500')}>
                  Add to Calendar
                </span>
                <div
                  className={'w-9 h-5 rounded-full relative transition ' + (addToCalendar ? 'bg-brand-blue' : 'bg-white/10')}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: addToCalendar ? '18px' : '2px' }}
                  />
                </div>
              </button>
              {addToCalendar && (
                <div className="grid grid-cols-2 gap-3 mt-2 ml-7">
                  <div>
                    <label className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Time</label>
                    <input
                      type="time"
                      className={inputCls + ' !h-9 !text-[13px]'}
                      value={calTime}
                      onChange={e => setCalTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Duration</label>
                    <select
                      className={inputCls + ' !h-9 !text-[13px]'}
                      value={calDuration}
                      onChange={e => setCalDuration(e.target.value)}
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="w-full h-11 rounded-[12px] text-white font-semibold text-[14px] tracking-[0.01em] disabled:opacity-50 transition-all duration-200 active:scale-[0.99]"
          style={{
            background: 'linear-gradient(135deg, #5B8CFF 0%, #4A6CF7 100%)',
            boxShadow: '0 6px 20px rgba(74,108,247,0.22), inset 0 1px 0 rgba(255,255,255,0.14)',
          }}
        >
          {busy ? 'Creating…' : 'Create Task'}
        </button>
      </form>
    </Modal>
  );
}

export function NewProjectModal({ open, onClose, onCreated }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(today());
  const [users, setUsers] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState([]);
  const [newStep, setNewStep] = useState('');
  const [projFiles, setProjFiles] = useState([]);
  const [projLinks, setProjLinks] = useState([]);
  const [projNewLink, setProjNewLink] = useState('');
  const [templates, setTemplates] = useState([]);

  // ─── Identity (emoji + accent) ────────────────────────────────
  // Randomised on open so every new project feels like a fresh pick,
  // but the user can override with a tap.
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI);
  const [accentKey, setAccentKey] = useState('sky');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTitle(''); setDescription(''); setDeadline(today()); setMemberIds([]); setSteps([]); setNewStep(''); setProjFiles([]); setProjLinks([]); setProjNewLink('');
    // Random starting identity — feels like a "fresh slate" each open.
    setEmoji(EMOJI_CHOICES[Math.floor(Math.random() * EMOJI_CHOICES.length)]);
    setAccentKey(ACCENT_KEYS[Math.floor(Math.random() * ACCENT_KEYS.length)]);
    setEmojiPickerOpen(false);
    setMoreOpen(false);
    setPhIdx(0);
    api.users().then(setUsers);
    api.templates().then(setTemplates).catch(() => {});
  }, [open]);

  // Rotate the title placeholder every 3.5s while the field is empty.
  useEffect(() => {
    if (!open || title) return;
    const id = setInterval(() => setPhIdx(i => (i + 1) % PROJECT_PLACEHOLDERS.length), 3500);
    return () => clearInterval(id);
  }, [open, title]);

  const applyTemplate = (t) => {
    setTitle(t.name);
    setDepartment(t.department || 'Operations');
    setDescription(t.description || '');
    const subs = Array.isArray(t.subtasks) ? t.subtasks : JSON.parse(t.subtasks || '[]');
    setSteps(subs.map(s => typeof s === 'string' ? { title: s, subs: [] } : s));
  };

  const toggleMember = (id) => {
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      let project;
      project = await api.createProject({
        title: title.trim(), department, description, deadline, memberIds,
        accent: accentKey, emoji,
      });
      // Create checklist steps + substeps
      if (project?.id && steps.length > 0) {
        for (const step of steps) {
          const sub = await api.createSubtask(project.id, { title: step.title, ownerId: step.ownerId || null });
          for (const child of (step.subs || [])) {
            await api.createSubtask(project.id, { title: child.title, ownerId: child.ownerId || null, parentId: sub.id });
          }
        }
      }
      onCreated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to create project', 'error'); } finally { setBusy(false); }
  };

  const accent = ACCENT_PALETTE[accentKey] || ACCENT_PALETTE.sky;

  return (
    <Modal open={open} onClose={onClose} title="New project">
      {templates.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">Start from template</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                className="px-3 h-8 rounded-full text-[12px] font-medium transition"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)' }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={submit}>
        {/* ─── Identity hero: emoji + name ─────────────────────── */}
        <div className="flex flex-col items-center mb-4">
          <button
            type="button"
            onClick={() => setEmojiPickerOpen(v => !v)}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[36px] leading-none mb-3 transition-all active:scale-[0.95]"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${accent.glow} 0%, rgba(255,255,255,0.03) 72%)`,
              border: `1px solid ${accent.solid}44`,
              boxShadow: `0 0 24px ${accent.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
              transition: `background 240ms ${spring.gentle}, border-color 240ms ${spring.gentle}, box-shadow 240ms ${spring.gentle}`,
            }}
            aria-label="Change emoji"
          >
            {emoji}
          </button>
          <p className="text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Tap to change</p>
        </div>

        {/* Emoji picker — 24 curated choices. Opens inline above the
            name input so the user's context isn't broken by another
            modal. Closes on pick. */}
        {emojiPickerOpen && (
          <div
            className="mb-4 p-3 rounded-[12px] grid grid-cols-8 gap-1.5 animate-fade-in"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {EMOJI_CHOICES.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                className="h-9 rounded-[8px] flex items-center justify-center text-[20px] hover:bg-white/5 transition"
                style={emoji === e ? { background: `${accent.solid}22`, outline: `1px solid ${accent.solid}66` } : {}}
                aria-label={`Pick ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Name — hero input, same visual weight as QuickTaskModal. */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          required
          placeholder={PROJECT_PLACEHOLDERS[phIdx] + '…'}
          className="hero-input"
        />

        {/* ─── Color palette ────────────────────────────────────── */}
        <div className="mt-4 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 mb-2">Vibe</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ACCENT_KEYS.map(key => {
              const p = ACCENT_PALETTE[key];
              const active = key === accentKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAccentKey(key)}
                  aria-label={key}
                  className="relative rounded-full transition-all active:scale-[0.92]"
                  style={{
                    width: active ? 26 : 22,
                    height: active ? 26 : 22,
                    background: `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`,
                    boxShadow: active
                      ? `0 0 0 2px #0B0F1A, 0 0 0 3.5px ${p.solid}, 0 0 12px ${p.glow}`
                      : `0 0 6px ${p.glow}`,
                    transition: `width 180ms ${spring.snappy}, height 180ms ${spring.snappy}, box-shadow 180ms ease`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* ─── Deadline + department — the two most-used secondary fields,
               always visible. Everything else hides under "More". */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Deadline">
            <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} required />
          </Field>
          <Field label="Department">
            <select className={inputCls} value={department} onChange={e => setDepartment(e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        {/* ─── More toggle ──────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setMoreOpen(v => !v)}
          className="mb-3 h-8 px-3 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all active:scale-[0.96]"
          style={{
            background: moreOpen ? 'rgba(91,140,255,0.14)' : 'rgba(255,255,255,0.04)',
            color: moreOpen ? '#A8C4FF' : '#9CA3AF',
            border: `1px solid ${moreOpen ? 'rgba(91,140,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <MoreIcon width="12" height="12" />
          {moreOpen ? 'Less' : 'More — description, members, checklist'}
        </button>

        {/* ─── More sheet ───────────────────────────────────────── */}
        {moreOpen && (
          <div className="space-y-3 pt-1 pb-2 border-t animate-fade-in" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Field label="Description">
          <textarea className={inputCls + ' !h-20 py-2'} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Attachments">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <span className="pill pill-outline !h-8 !px-3 !text-[12px]">📎 File</span>
                <input type="file" multiple className="hidden" onChange={e => setProjFiles(Array.from(e.target.files || []))} />
              </label>
              <input value={projNewLink} onChange={e => setProjNewLink(e.target.value)} placeholder="Paste a link…" className="flex-1 h-8 px-3 rounded-[8px] border border-line-light text-[12px]"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (projNewLink.trim()) { setProjLinks(l => [...l, projNewLink.trim()]); setProjNewLink(''); } } }} />
              {projNewLink && <button type="button" onClick={() => { setProjLinks(l => [...l, projNewLink.trim()]); setProjNewLink(''); }} className="text-[11px] text-brand-blue font-semibold">Add</button>}
            </div>
            {(projFiles.length > 0 || projLinks.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {projFiles.map((f, i) => <span key={`f${i}`} className="text-[11px] bg-line-light rounded-full px-2 py-0.5">📎 {f.name}</span>)}
                {projLinks.map((l, i) => <span key={`l${i}`} className="text-[11px] bg-brand-blueLight text-brand-blue rounded-full px-2 py-0.5 flex items-center gap-1">🔗 {l.length > 30 ? l.slice(0, 30) + '…' : l}<button type="button" onClick={() => setProjLinks(ls => ls.filter((_, j) => j !== i))} className="text-ink-300 ml-0.5">×</button></span>)}
              </div>
            )}
          </div>
        </Field>
        {/* Checklist builder */}
        <Field label="Checklist (optional)">
          <div className="space-y-2">
            {steps.map((step, si) => (
              <div key={si} className="border border-line-light rounded-[8px] p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] text-ink-900 flex-1">{step.title}</span>
                  <select value={step.complexity || ''} onChange={e => {
                    const next = [...steps]; next[si] = { ...step, complexity: e.target.value }; setSteps(next);
                  }} className="h-7 px-1 text-[10px] rounded border border-line-light bg-white">
                    <option value="">Complexity</option>
                    {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={step.ownerId || ''} onChange={e => {
                    const next = [...steps]; next[si] = { ...step, ownerId: e.target.value ? Number(e.target.value) : null }; setSteps(next);
                  }} className="h-7 px-1 text-[11px] rounded border border-line-light bg-white">
                    <option value="">Owner</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>)}
                  </select>
                  <button type="button" onClick={() => setSteps(steps.filter((_, i) => i !== si))} className="text-ink-300 text-sm">×</button>
                </div>
                {/* Substeps */}
                {(step.subs || []).map((sub, ci) => (
                  <div key={ci} className="flex items-center gap-2 ml-5 mt-1 flex-wrap">
                    <span className="text-[12px] text-ink-500 flex-1">↳ {sub.title}</span>
                    <select value={sub.complexity || ''} onChange={e => {
                      const next = [...steps]; const subs = [...(next[si].subs || [])]; subs[ci] = { ...sub, complexity: e.target.value }; next[si] = { ...next[si], subs }; setSteps(next);
                    }} className="h-6 px-1 text-[9px] rounded border border-line-light bg-white">
                      <option value="">Complexity</option>
                      {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={sub.ownerId || ''} onChange={e => {
                      const next = [...steps]; const subs = [...(next[si].subs || [])]; subs[ci] = { ...sub, ownerId: e.target.value ? Number(e.target.value) : null }; next[si] = { ...next[si], subs }; setSteps(next);
                    }} className="h-6 px-1 text-[9px] rounded border border-line-light bg-white">
                      <option value="">Owner</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>)}
                    </select>
                    <button type="button" onClick={() => { const next = [...steps]; next[si] = { ...next[si], subs: (next[si].subs || []).filter((_, i) => i !== ci) }; setSteps(next); }} className="text-ink-300 text-xs">×</button>
                  </div>
                ))}
                {step.addingSub ? (
                  <div className="flex items-center gap-2 ml-5 mt-1">
                    <span className="text-ink-300 text-[11px]">↳</span>
                    <input
                      value={step.newSubTitle || ''}
                      onChange={e => { const next = [...steps]; next[si] = { ...step, newSubTitle: e.target.value }; setSteps(next); }}
                      placeholder="Substep title…"
                      className="flex-1 h-7 px-2 text-[12px] rounded border border-line-light bg-white"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if ((step.newSubTitle || '').trim()) {
                            const next = [...steps];
                            next[si] = { ...step, subs: [...(step.subs || []), { title: step.newSubTitle.trim(), ownerId: null }], addingSub: false, newSubTitle: '' };
                            setSteps(next);
                          }
                        } else if (e.key === 'Escape') {
                          const next = [...steps]; next[si] = { ...step, addingSub: false, newSubTitle: '' }; setSteps(next);
                        }
                      }}
                    />
                    <button type="button" onClick={() => {
                      if ((step.newSubTitle || '').trim()) {
                        const next = [...steps];
                        next[si] = { ...step, subs: [...(step.subs || []), { title: step.newSubTitle.trim(), ownerId: null }], addingSub: false, newSubTitle: '' };
                        setSteps(next);
                      }
                    }} className="text-[11px] text-brand-blue font-semibold">Add</button>
                    <button type="button" onClick={() => { const next = [...steps]; next[si] = { ...step, addingSub: false, newSubTitle: '' }; setSteps(next); }} className="text-[11px] text-ink-300">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => {
                    const next = [...steps]; next[si] = { ...step, addingSub: true, newSubTitle: '' }; setSteps(next);
                  }} className="text-[11px] text-brand-blue mt-1 ml-5">+ substep</button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input value={newStep} onChange={e => setNewStep(e.target.value)}
                placeholder="Add a step…"
                className="flex-1 h-9 px-3 rounded-[8px] border border-line-light text-[13px]"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newStep.trim()) { setSteps([...steps, { title: newStep.trim(), ownerId: null, subs: [] }]); setNewStep(''); } } }}
              />
              {newStep && <button type="button" onClick={() => { setSteps([...steps, { title: newStep.trim(), ownerId: null, subs: [] }]); setNewStep(''); }} className="text-[12px] text-brand-blue font-semibold">Add</button>}
            </div>
          </div>
        </Field>

        <Field label="Members">
          <div className="flex flex-wrap gap-2">
            {users.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleMember(u.id)}
                className={'pill ' + (memberIds.includes(u.id) ? 'pill-primary' : 'pill-outline')}
              >
                {u.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </Field>
          </div>
        )}

        {/* ─── Launch ──────────────────────────────────────────── */}
        <button
          disabled={busy || !title.trim()}
          type="submit"
          className="w-full h-11 rounded-[12px] text-white font-semibold text-[14px] tracking-[0.01em] disabled:opacity-50 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-1.5"
          style={{
            background: `linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`,
            boxShadow: `0 6px 20px ${accent.glow}, inset 0 1px 0 rgba(255,255,255,0.14)`,
            transition: `background 240ms ${spring.gentle}, box-shadow 240ms ease, transform 120ms ${spring.snappy}`,
          }}
        >
          {busy ? 'Launching…' : <>Launch {emoji}</>}
        </button>
      </form>
    </Modal>
  );
}

export function NewMeetingModal({ open, onClose, onCreated, projectId, members = [] }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [attendeeIds, setAttendeeIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setTitle(''); setDate(today()); setTime('10:00'); setDuration(30); setResult(null);
      setAttendeeIds(members.map(m => m.id));
    }
  }, [open, members]);

  const toggle = (id) => setAttendeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const meeting = await api.createMeeting(projectId, {
        title: title.trim(), startTime: `${date} ${time}`, durationMin: Number(duration), attendeeIds,
      });
      setResult(meeting);
      onCreated?.();
    } catch (err) { showToast(err.message || 'Failed to schedule meeting', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule Meeting">
      {result ? (
        <div className="space-y-3">
          <p className="text-[14px] text-ink-900">Meeting created. Google Meet link:</p>
          <div className="rounded-[10px] border border-line-light p-3 break-all">
            <a href={result.meet_link} target="_blank" rel="noreferrer" className="text-brand-blue text-[13px] underline">{result.meet_link}</a>
          </div>
          <button onClick={onClose} className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold">Done</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Field label="Title">
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required placeholder="Retail launch sync" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required />
            </Field>
            <Field label="Time">
              <input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required />
            </Field>
          </div>
          <Field label="Duration (min)">
            <input type="number" min="15" step="15" className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} />
          </Field>
          <Field label="Attendees">
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={'pill ' + (attendeeIds.includes(m.id) ? 'pill-primary' : 'pill-outline')}
                >
                  {m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </Field>
          <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">
            {busy ? 'Scheduling…' : 'Schedule & Generate Meet Link'}
          </button>
        </form>
      )}
    </Modal>
  );
}

const RECURRENCE_QUICK = [
  { value: '', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
];

export function NewEventModal({ open, onClose, onCreated }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [eventType, setEventType] = useState('work');
  const [recurrence, setRecurrence] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(''); setDate(today()); setDuration(60); setEventType('work'); setRecurrence('');
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      setTime(`${String(nextHour.getHours()).padStart(2, '0')}:00`);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.createEvent({
        title: title.trim(),
        startTime: (() => { const d = new Date(`${date}T${time}:00`); return d.toISOString(); })(),
        durationMin: Number(duration),
        eventType,
        recurrence: recurrence || undefined,
      });
      onCreated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to create event', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Event">
      <form onSubmit={submit}>
        <Field label="Title">
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required placeholder="Farm visit check-in" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required />
          </Field>
          <Field label="Time">
            <input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)">
            <input type="number" min="15" step="15" className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={eventType} onChange={e => setEventType(e.target.value)}>
              <option value="work">Work</option>
              <option value="personal">Personal (Busy)</option>
            </select>
          </Field>
        </div>
        <Field label="Repeat">
          <select className={inputCls} value={recurrence} onChange={e => setRecurrence(e.target.value)}>
            {RECURRENCE_QUICK.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">
          {busy ? 'Creating…' : 'Create Event'}
        </button>
      </form>
    </Modal>
  );
}

export function ReportBugModal({ open, onClose, onCreated }) {
  const showToast = useToast();
  const [appName, setAppName] = useState('');
  const [issue, setIssue] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('medium');
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setAppName(''); setIssue(''); setScreenshots([]); setPreviews([]); setAssignedTo(''); setDeadline(''); setPriority('medium'); api.users().then(setUsers); } }, [open]);

  const readFile = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList);
    setScreenshots(prev => [...prev, ...newFiles]);
    setPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
  };

  const removeFile = (index) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => { URL.revokeObjectURL(prev[index]); return prev.filter((_, i) => i !== index); });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!appName.trim() || !issue.trim() || !assignedTo) return;
    setBusy(true);
    try {
      const screenshotDataUrls = await Promise.all(screenshots.map(readFile));
      await api.createBug({ appName: appName.trim(), issue: issue.trim(), screenshots: screenshotDataUrls, assignedTo: assignedTo || null, deadline: deadline || null, priority });
      onCreated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to report bug', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report a Bug">
      <form onSubmit={submit}>
        <Field label="App Name">
          <select className={inputCls} value={appName} onChange={e => setAppName(e.target.value)} required autoFocus>
            <option value="">Select app…</option>
            <option value="Farlo">Farlo</option>
            <option value="XPNS">XPNS</option>
            <option value="Nexo">Nexo</option>
            <option value="Milaan">Milaan</option>
            <option value="CEO Dashboard">CEO Dashboard</option>
          </select>
        </Field>
        <Field label="Issue"><textarea className={inputCls + ' !h-20 py-2'} value={issue} onChange={e => setIssue(e.target.value)} required placeholder="Describe the bug…" /></Field>
        <Field label="Screenshots (optional)">
          <div className="space-y-2">
            <label className="cursor-pointer inline-block">
              <span className="pill pill-outline !h-8 !px-3 !text-[12px]">📸 Add images</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt={`screenshot ${i + 1}`} className="w-16 h-16 rounded-[8px] object-cover border border-line-light" />
                    <button type="button" onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assign to *">
            <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)} required>
              <option value="">Select assignee…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Deadline">
            <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} />
          </Field>
        </div>
        <Field label="Priority">
          <div className="flex gap-2">
            {[
              { id: 'high',   label: 'High',   color: '#EF4444' },
              { id: 'medium', label: 'Medium', color: '#F59E0B' },
              { id: 'low',    label: 'Low',    color: '#6B7280' },
            ].map(p => {
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
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-danger text-white font-semibold disabled:opacity-60">{busy ? 'Reporting…' : 'Report Bug'}</button>
      </form>
    </Modal>
  );
}
