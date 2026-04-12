import React, { useEffect, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { AvatarStack, Pill } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import { ChevronLeft, ChevronRight, ArrowLeft } from '../components/Icons.jsx';

function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function fmtTime(iso) {
  const d = new Date(iso);
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
function fmtHour12(h24) { const ampm = h24 >= 12 ? 'PM' : 'AM'; const h = h24 % 12 || 12; return `${h} ${ampm}`; }
function parseHour(iso) { return new Date(iso).getHours(); }
function eventLocalDate(ev) { return isoDate(new Date(ev.start_time)); }
function leavesOnDate(leaves, iso) { return leaves.filter(l => l.start_date <= iso && l.end_date >= iso); }

function accentFor(ev) {
  if (ev.event_type === 'personal') return '#9CA3AF';
  if (ev.priority === 'High') return '#F59E0B';
  if (ev.department === 'Operations') return '#22C55E';
  return '#4A6CF7';
}

// ── Modals ──
function AddEventModal({ open, onClose, onCreated, date, prefillTitle = '' }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setTitle(prefillTitle || '');
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      setTime(`${String(nextHour.getHours()).padStart(2, '0')}:00`);
      setDuration(60);
    }
  }, [open, prefillTitle]);
  const submit = async (e) => {
    e.preventDefault(); if (!title.trim()) return; setBusy(true);
    try { await api.createEvent({ title: title.trim(), startTime: new Date(`${date}T${time}:00`).toISOString(), durationMin: Number(duration), eventType: 'work' }); onCreated?.(); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add to Calendar">
      <form onSubmit={submit}>
        <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time"><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required /></Field>
          <Field label="Duration (min)"><input type="number" min="15" step="15" className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} /></Field>
        </div>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Adding…' : 'Add Event'}</button>
      </form>
    </Modal>
  );
}

function AddLeaveModal({ open, onClose, onCreated, date }) {
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('PL');
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStartDate(date); setEndDate(date); setType('PL'); setUserId(''); api.users().then(setUsers); } }, [open, date]);
  const submit = async (e) => {
    e.preventDefault(); if (!startDate || !endDate) return; setBusy(true);
    try { await api.addLeave({ userId: userId ? Number(userId) : undefined, startDate, endDate, type }); onCreated?.(); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Leave">
      <form onSubmit={submit}>
        <Field label="Member">
          <select className={inputCls} value={userId} onChange={e => setUserId(e.target.value)}><option value="">Myself</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} required /></Field>
          <Field label="To"><input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} required /></Field>
        </div>
        <Field label="Type">
          <select className={inputCls} value={type} onChange={e => setType(e.target.value)}>
            <option value="PL">Privilege Leave (PL)</option><option value="SL">Sick Leave (SL)</option><option value="CL">Casual Leave (CL)</option><option value="FL">Flexi Leave (FL)</option>
          </select>
        </Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Adding…' : 'Add Leave'}</button>
      </form>
    </Modal>
  );
}

// ── Edit Event Modal ──
function EditEventModal({ open, onClose, event, onUpdated, onDeleted }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && event) {
      setTitle(event.title || '');
      const d = new Date(event.start_time);
      setDate(isoDate(d));
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setDuration(event.duration_min || 60);
      setConfirmDelete(false);
    }
  }, [open, event]);

  const submit = async (e) => {
    e.preventDefault(); if (!title.trim() || !event) return; setBusy(true);
    try {
      await api.updateEvent(event.id, { title: title.trim(), startTime: new Date(`${date}T${time}:00`).toISOString(), durationMin: Number(duration) });
      onUpdated?.(); onClose();
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteEvent(event.id); onDeleted?.(); onClose(); }
    finally { setBusy(false); }
  };

  if (!event) return null;
  return (
    <Modal open={open} onClose={onClose} title="Edit Event">
      <form onSubmit={submit}>
        <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required /></Field>
          <Field label="Time"><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required /></Field>
        </div>
        <Field label="Duration (min)"><input type="number" min="15" step="15" className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} /></Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60 mb-2">{busy ? 'Saving…' : 'Save Changes'}</button>
      </form>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="w-full h-10 rounded-[10px] text-[13px] text-danger font-medium hover:bg-[#FEF2F2]">Delete Event</button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 rounded-[10px] border border-line-light text-[13px] text-ink-500">Cancel</button>
          <button onClick={doDelete} disabled={busy} className="flex-1 h-10 rounded-[10px] bg-danger text-white text-[13px] font-semibold disabled:opacity-60">Confirm Delete</button>
        </div>
      )}
    </Modal>
  );
}

// ── Day view ──
function DayView({ events, leaves, date, onEventClick, onDeleteLeave }) {
  const iso = isoDate(date);
  const onLeave = leavesOnDate(leaves, iso);
  return (
    <div className="space-y-2">
      {onLeave.map(l => (
        <div key={l.id} className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ backgroundColor: '#FEE2E2' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: l.avatar_color }}>{l.initials}</div>
          <span className="flex-1 text-[12px] text-ink-900">{l.name} — <span className="text-danger">On Leave ({l.type})</span></span>
          <button onClick={() => onDeleteLeave?.(l.id)} className="text-ink-300 hover:text-danger text-[11px]" title="Remove leave">✕</button>
        </div>
      ))}
      {events.length === 0 && onLeave.length === 0 && <p className="text-center text-ink-300 text-sm py-6">No events.</p>}
      {events.map(ev => (
        <div key={ev.id} className="flex gap-3 cursor-pointer" onClick={() => onEventClick?.(ev)}>
          <div className="w-12 pt-3 text-[13px] text-ink-300 flex-shrink-0">{fmtTime(ev.start_time)}</div>
          <div className="flex-1 bg-white rounded-[10px] p-3 border border-line-light hover:shadow-md transition" style={{ borderLeft: `4px solid ${accentFor(ev)}` }}>
            <p className="font-semibold text-[14px] text-ink-900">{ev.event_type === 'personal' ? '🔒 ' : ''}{ev.title}</p>
            <p className="text-[11px] text-ink-500">{ev.department || (ev.event_type === 'personal' ? 'Personal' : '')} · {ev.duration_min} min</p>
            {ev.meet_link && <a href={ev.meet_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-block mt-1 pill bg-success text-white !h-7 !px-3 !text-[11px]">Join</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Week view (Google Calendar style — time grid) ──
function WeekView({ date, allEvents, leaves, onDayClick }) {
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = isoDate(new Date());
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-line-light sticky top-0 bg-page z-10">
          <div />
          {days.map(d => {
            const iso = isoDate(d);
            const isT = iso === today;
            const dayLeaves = leavesOnDate(leaves, iso);
            return (
              <button key={iso} onClick={() => onDayClick(d)} className={'text-center py-2 border-l border-line-light ' + (isT ? 'bg-brand-blueLight' : dayLeaves.length ? 'bg-[#FEE2E2]' : '')}>
                <p className="text-[10px] text-ink-500">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                <p className={'text-[16px] font-bold ' + (isT ? 'text-brand-blue' : 'text-ink-900')}>{d.getDate()}</p>
                {dayLeaves.length > 0 && <p className="text-[8px] text-danger">{dayLeaves.map(l => l.initials).join(', ')}</p>}
              </button>
            );
          })}
        </div>
        {/* Time grid */}
        <div className="relative">
          {hours.map(h => (
            <div key={h} className="grid grid-cols-[48px_repeat(7,1fr)] h-14 border-b border-[#F3F4F6]">
              <div className="text-[10px] text-ink-300 pr-2 text-right pt-1">{fmtHour12(h)}</div>
              {days.map(d => {
                const iso = isoDate(d);
                const eventsInHour = allEvents.filter(e => eventLocalDate(e) === iso && parseHour(e.start_time) === h);
                return (
                  <div key={iso} className="border-l border-[#F3F4F6] relative px-0.5">
                    {eventsInHour.map(ev => (
                      <div key={ev.id} className="absolute inset-x-0.5 rounded-[4px] px-1.5 py-0.5 text-[10px] text-white truncate z-[1]"
                        style={{ backgroundColor: accentFor(ev), top: 1, minHeight: Math.max(20, (ev.duration_min / 60) * 56 - 4) }}>
                        {ev.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Month view (expanded, events visible) ──
function MonthView({ date, allEvents, leaves, onDayClick }) {
  const monthStart = startOfMonth(date);
  const total = daysInMonth(date);
  const rawDay = monthStart.getDay();
  const leadingBlanks = rawDay === 0 ? 6 : rawDay - 1;
  const today = isoDate(new Date());
  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(date.getFullYear(), date.getMonth(), d));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-center text-[10px] text-ink-300 py-1 font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-line-light">
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} className="bg-page min-h-[80px]" />;
          const iso = isoDate(d);
          const dayEvents = allEvents.filter(e => eventLocalDate(e) === iso);
          const dayLeaves = leavesOnDate(leaves, iso);
          const isToday = iso === today;
          return (
            <button key={iso} onClick={() => onDayClick(d)}
              className={'bg-white min-h-[80px] p-1 text-left align-top transition hover:bg-[#F7F8FA] ' + (isToday ? 'ring-2 ring-inset ring-brand-blue' : '') + (dayLeaves.length ? ' bg-[#FEF2F2]' : '')}>
              <p className={'text-[12px] font-medium mb-0.5 ' + (isToday ? 'text-brand-blue font-bold' : 'text-ink-900')}>{d.getDate()}</p>
              {dayLeaves.map(l => (
                <div key={l.id} className="text-[9px] text-danger bg-[#FEE2E2] rounded px-1 py-px mb-0.5 truncate">{l.initials} {l.type}</div>
              ))}
              {dayEvents.slice(0, 2).map(ev => (
                <div key={ev.id} className="text-[9px] rounded px-1 py-px mb-0.5 truncate text-white" style={{ backgroundColor: accentFor(ev) }}>
                  {fmtTime(ev.start_time)} {ev.title}
                </div>
              ))}
              {dayEvents.length > 2 && <p className="text-[9px] text-ink-300">+{dayEvents.length - 2} more</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Schedule (Agenda) view ──
function ScheduleView({ allEvents, leaves, date, onEventClick }) {
  // Next 14 days from current date
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i));
  const daysWithContent = days.filter(d => {
    const iso = isoDate(d);
    return allEvents.some(e => eventLocalDate(e) === iso) || leavesOnDate(leaves, iso).length > 0;
  });

  if (daysWithContent.length === 0) return <p className="text-center text-ink-300 text-sm py-8">No events in the next 14 days.</p>;

  return (
    <div className="space-y-4">
      {daysWithContent.map(d => {
        const iso = isoDate(d);
        const dayEvents = allEvents.filter(e => eventLocalDate(e) === iso);
        const dayLeaves = leavesOnDate(leaves, iso);
        const isToday = iso === isoDate(new Date());
        return (
          <div key={iso}>
            <div className="flex items-center gap-2 mb-2">
              {isToday && <span className="w-2 h-2 rounded-full bg-brand-blue" />}
              <p className={'text-[13px] font-semibold ' + (isToday ? 'text-brand-blue' : 'text-ink-900')}>
                {d.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="space-y-1.5 ml-4">
              {dayLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-2 rounded-[6px] px-3 py-2" style={{ backgroundColor: '#FEE2E2' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px]" style={{ backgroundColor: l.avatar_color }}>{l.initials}</div>
                  <span className="text-[12px] text-ink-900">{l.name} — <span className="text-danger">{l.type}</span></span>
                </div>
              ))}
              {dayEvents.map(ev => (
                <div key={ev.id} onClick={() => onEventClick?.(ev)} className="flex items-center gap-3 rounded-[6px] bg-white border border-line-light px-3 py-2 cursor-pointer hover:shadow-md transition">
                  <span className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: accentFor(ev) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900 truncate">{ev.title}</p>
                    <p className="text-[11px] text-ink-500">{fmtTime(ev.start_time)} · {ev.duration_min} min{ev.department ? ` · ${ev.department}` : ''}</p>
                  </div>
                  {ev.meet_link && <a href={ev.meet_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[11px] text-success font-semibold">Join</a>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Calendar ──
export default function Calendar({ me, unreadCount, onOpenNotifications, deepLink }) {
  const showToast = useToast();
  const [view, setView] = useState('Day');
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [deleteLeaveId, setDeleteLeaveId] = useState(null);
  const [mood, setMood] = useState(null);
  const [optimized, setOptimized] = useState(false);
  const [prevView, setPrevView] = useState(null);
  const [prefillTitle, setPrefillTitle] = useState('');

  const loadDay = (d) => api.events(isoDate(d)).then(setEvents);
  const loadAll = () => api.events().then(setAllEvents);
  const loadLeaves = () => api.leaves().then(setLeaves);

  useEffect(() => { loadDay(date); loadAll(); loadLeaves(); }, []);
  useEffect(() => { loadDay(date); }, [date]);

  const [handledDeepLink, setHandledDeepLink] = useState(null);
  useEffect(() => {
    if (deepLink?.kind === 'addEvent' && deepLink.title && deepLink.ts !== handledDeepLink) {
      setPrefillTitle(deepLink.title); setAddOpen(true); setHandledDeepLink(deepLink.ts);
    }
  }, [deepLink, handledDeepLink]);

  const nav = (dir) => {
    if (view === 'Day') setDate(d => addDays(d, dir));
    else if (view === 'Week') setDate(d => addDays(d, dir * 7));
    else if (view === 'Schedule') setDate(d => addDays(d, dir * 14));
    else setDate(d => { const r = new Date(d); r.setMonth(r.getMonth() + dir); return r; });
  };
  const switchToDay = (d) => { setPrevView(view); setDate(d); setView('Day'); };

  const applyOptimization = () => {
    const sorted = [...events].sort((a, b) => {
      const wA = a.priority === 'High' ? 0 : 1;
      const wB = b.priority === 'High' ? 0 : 1;
      return mood === 'Low Energy' ? wB - wA : wA - wB;
    });
    let cursor = 9 * 60;
    setEvents(sorted.map(ev => {
      const h = String(Math.floor(cursor / 60)).padStart(2, '0');
      const m = String(cursor % 60).padStart(2, '0');
      cursor += ev.duration_min + 15;
      return { ...ev, start_time: `${isoDate(date)} ${h}:${m}` };
    }));
    setOptimized(true);
  };

  const headerLabel = view === 'Month' ? date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : view === 'Week' ? `Week of ${addDays(startOfWeek(date), 0).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`
    : view === 'Schedule' ? 'Schedule'
    : date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <div className="flex items-center gap-2">
            {view === 'Day' && prevView && (
              <button onClick={() => { setView(prevView); setPrevView(null); }} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA]"><ArrowLeft /></button>
            )}
            <button onClick={() => nav(-1)} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA]"><ChevronLeft /></button>
            <h1 className="text-[20px] font-bold text-ink-900">{headerLabel}</h1>
            <button onClick={() => nav(1)} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA]"><ChevronRight /></button>
          </div>
          <p className="text-[12px] text-ink-500 mt-0.5">{events.length} events{view === 'Day' ? ' today' : ''}</p>
        </div>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} />
      </div>

      {/* View toggle + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {['Day', 'Week', 'Month', 'Schedule'].map(v => (
          <Pill key={v} active={view === v} onClick={() => { setView(v); setPrevView(null); }}>{v}</Pill>
        ))}
        <div className="flex-1" />
        <button onClick={() => setDate(new Date())} className="pill pill-outline !h-9 !px-3 !text-[12px]">Today</button>
        <button onClick={() => setLeaveOpen(true)} className="pill pill-outline !h-9 !px-3 !text-[12px]">🏖️ Leave</button>
        <button onClick={() => setAddOpen(true)} className="pill pill-primary !h-9 !px-3 !text-[12px]">+ Event</button>
      </div>

      {/* Energy optimizer (Day only) */}
      {view === 'Day' && !optimized && (
        <div className="rounded-card p-3" style={{ background: 'linear-gradient(135deg, #F5F3FF, #EEF1FF)' }}>
          <p className="font-semibold text-[13px] text-ink-900 mb-2">✨ Optimize your day</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {['Productive', 'Moderate', 'Low Energy'].map(m => <Pill key={m} active={mood === m} onClick={() => setMood(m)}>{m}</Pill>)}
          </div>
          {mood && <button onClick={applyOptimization} className="pill bg-success text-white !h-8 !text-[12px]">Apply</button>}
        </div>
      )}
      {view === 'Day' && optimized && (
        <div className="rounded-card px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.08)' }}>
          <span className="text-[12px]">✅ Optimized for <strong>{mood}</strong>.</span>
          <button onClick={() => { setOptimized(false); setMood(null); loadDay(date); }} className="ml-auto text-[11px] text-brand-blue">Reset</button>
        </div>
      )}

      {/* View body */}
      {view === 'Day' && <DayView events={events} leaves={leaves} date={date} onEventClick={setEditEvent} onDeleteLeave={setDeleteLeaveId} />}
      {view === 'Week' && <WeekView date={date} allEvents={allEvents} leaves={leaves} onDayClick={switchToDay} />}
      {view === 'Month' && <MonthView date={date} allEvents={allEvents} leaves={leaves} onDayClick={switchToDay} />}
      {view === 'Schedule' && <ScheduleView allEvents={allEvents} leaves={leaves} date={date} onEventClick={setEditEvent} />}

      <AddEventModal open={addOpen} onClose={() => { setAddOpen(false); setPrefillTitle(''); }} onCreated={() => { loadDay(date); loadAll(); showToast('Event created'); }} date={isoDate(date)} prefillTitle={prefillTitle} />
      <AddLeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onCreated={() => { loadLeaves(); showToast('Leave added'); }} date={isoDate(date)} />
      <ConfirmModal
        open={!!deleteLeaveId}
        onClose={() => setDeleteLeaveId(null)}
        title="Remove Leave"
        message="Are you sure you want to remove this leave entry?"
        onConfirm={async () => {
          await api.deleteLeave(deleteLeaveId);
          setDeleteLeaveId(null);
          loadLeaves();
          showToast('Leave removed');
        }}
      />
      <EditEventModal open={!!editEvent} onClose={() => setEditEvent(null)} event={editEvent}
        onUpdated={() => { loadDay(date); loadAll(); showToast('Event updated'); }}
        onDeleted={() => { loadDay(date); loadAll(); showToast('Event deleted'); }}
      />
    </div>
  );
}
