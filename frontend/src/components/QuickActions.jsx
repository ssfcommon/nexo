import React, { useEffect, useState } from 'react';
import Modal, { Field, inputCls } from './Modal.jsx';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

import { PRIORITIES, COMPLEXITIES } from './ui.jsx';
const DEPARTMENTS = ['Operations', "CEO's Office", 'Common'];

function today() { return new Date().toISOString().slice(0, 10); }

export function QuickTaskModal({ open, onClose, onCreated }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(today());
  const [complexity, setComplexity] = useState(COMPLEXITIES[1]);
  const [recurrence, setRecurrence] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setTitle(''); setDeadline(today()); setComplexity(COMPLEXITIES[1]); setRecurrence(''); setDescription(''); setAssignedTo(''); setFiles([]); setLinks([]); setNewLink(''); api.users().then(setUsers); } }, [open]);

  const readFiles = async (fileList) => {
    const result = [];
    for (const f of fileList) {
      const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
      result.push({ filename: f.name, dataUrl });
    }
    return result;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const attachments = await readFiles(files);
      await api.createTask({ title: title.trim(), deadline, complexity, isQuick: true, recurrence: recurrence || null, description: description || null, assignedTo: assignedTo || null, attachments, links });
      onCreated?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to create task', 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick Task">
      <form onSubmit={submit}>
        <Field label="Title">
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required placeholder="Call vendor about packaging" />
        </Field>
        <Field label="Description (optional)">
          <textarea className={inputCls + ' !h-16 py-2'} value={description} onChange={e => setDescription(e.target.value)} placeholder="Details, notes…" />
        </Field>
        <Field label="Assign to">
          <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">Myself</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline">
            <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} required />
          </Field>
          <Field label="Complexity">
            <select className={inputCls} value={complexity} onChange={e => setComplexity(e.target.value)}>
              {COMPLEXITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Attachments">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <span className="pill pill-outline !h-8 !px-3 !text-[12px]">📎 File</span>
                <input type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files || []))} />
              </label>
              <input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="Paste a link…" className="flex-1 h-8 px-3 rounded-[8px] border border-line-light text-[12px]"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newLink.trim()) { setLinks(l => [...l, newLink.trim()]); setNewLink(''); } } }} />
              {newLink && <button type="button" onClick={() => { setLinks(l => [...l, newLink.trim()]); setNewLink(''); }} className="text-[11px] text-brand-blue font-semibold">Add</button>}
            </div>
            {(files.length > 0 || links.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {files.map((f, i) => <span key={`f${i}`} className="text-[11px] bg-line-light rounded-full px-2 py-0.5">📎 {f.name}</span>)}
                {links.map((l, i) => <span key={`l${i}`} className="text-[11px] bg-brand-blueLight text-brand-blue rounded-full px-2 py-0.5 flex items-center gap-1">🔗 {l.length > 30 ? l.slice(0, 30) + '…' : l}<button type="button" onClick={() => setLinks(ls => ls.filter((_, j) => j !== i))} className="text-ink-300 ml-0.5">×</button></span>)}
              </div>
            )}
          </div>
        </Field>
        <Field label="Repeat">
          <select className={inputCls} value={recurrence} onChange={e => setRecurrence(e.target.value)}>
            <option value="">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">
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

  useEffect(() => {
    if (!open) return;
    setTitle(''); setDescription(''); setDeadline(today()); setMemberIds([]); setSteps([]); setNewStep(''); setProjFiles([]); setProjLinks([]); setProjNewLink('');
    api.users().then(setUsers);
    api.templates().then(setTemplates).catch(() => {});
  }, [open]);

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
      project = await api.createProject({ title: title.trim(), department, description, deadline, memberIds });
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

  return (
    <Modal open={open} onClose={onClose} title="New Project">
      {templates.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-ink-500 mb-1.5">START FROM TEMPLATE</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                className="px-3 h-8 rounded-full text-[12px] font-medium bg-[#F3F4F6] text-ink-500 hover:bg-brand-blueLight hover:text-brand-blue transition">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={submit}>
        <Field label="Title">
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required placeholder="Q3 B2B expansion" />
        </Field>
        <Field label="Department">
          <select className={inputCls} value={department} onChange={e => setDepartment(e.target.value)}>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <textarea className={inputCls + ' !h-20 py-2'} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Deadline">
          <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} required />
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
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">
          {busy ? 'Creating…' : 'Create Project'}
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

export function NewEventModal({ open, onClose, onCreated }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [eventType, setEventType] = useState('work');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(''); setDate(today()); setDuration(60); setEventType('work');
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
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setAppName(''); setIssue(''); setScreenshots([]); setPreviews([]); setAssignedTo(''); setDeadline(''); api.users().then(setUsers); } }, [open]);

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
    if (!appName.trim() || !issue.trim()) return;
    setBusy(true);
    try {
      const screenshotDataUrls = await Promise.all(screenshots.map(readFile));
      await api.createBug({ appName: appName.trim(), issue: issue.trim(), screenshots: screenshotDataUrls, assignedTo: assignedTo ? Number(assignedTo) : null, deadline: deadline || null });
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
          <Field label="Assign to">
            <select className={inputCls} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Deadline">
            <input type="date" className={inputCls} value={deadline} onChange={e => setDeadline(e.target.value)} />
          </Field>
        </div>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-danger text-white font-semibold disabled:opacity-60">{busy ? 'Reporting…' : 'Report Bug'}</button>
      </form>
    </Modal>
  );
}
