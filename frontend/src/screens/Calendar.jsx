import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Avatar, Pill } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import {
  ChevronLeft, ChevronRight, ArrowLeft, PlusIcon, RepeatIcon, LockIcon,
  UmbrellaIcon, CheckIcon, CloseIcon, MoreIcon, CalendarIcon, ClockIcon, UsersIcon,
} from '../components/Icons.jsx';

// ── Date helpers ────────────────────────────────────────────────
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
function eventLocalDate(ev) { return isoDate(new Date(ev.start_time)); }
function leavesOnDate(leaves, iso) { return leaves.filter(l => l.start_date <= iso && l.end_date >= iso); }

// Distinct palette for team member events
const TEAM_COLORS = ['#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#EAB308', '#6366F1'];
function teamColor(userId) { return TEAM_COLORS[(userId || 0) % TEAM_COLORS.length]; }

function accentFor(ev) {
  if (ev._isTeam) return teamColor(ev.owner_id);
  if (ev.event_type === 'personal') return '#9CA3AF';
  if (ev.priority === 'High') return '#F59E0B';
  if (ev.department === 'Operations') return '#22C55E';
  return '#4A6CF7';
}

// ── Recurrence helpers ──────────────────────────────────────────
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function nthWeekdayLabel(date) {
  const d = new Date(date);
  const dayOfMonth = d.getDate();
  const weekday = DAY_NAMES[d.getDay()];
  const nth = Math.ceil(dayOfMonth / 7);
  const ordinal = ['first','second','third','fourth','fifth'][nth - 1] || `${nth}th`;
  return { nth, weekday, label: `On the ${ordinal} ${weekday}` };
}

function recurrenceLabel(rec) {
  if (!rec) return null;
  const freq = rec.freq || rec;
  if (freq === 'daily')   return rec.interval > 1 ? `Every ${rec.interval} days` : 'Daily';
  if (freq === 'weekly') {
    const prefix = rec.interval > 1 ? `Every ${rec.interval} weeks` : 'Weekly';
    return rec.days?.length ? `${prefix} on ${rec.days.join(', ')}` : prefix;
  }
  if (freq === 'monthly') {
    const prefix = rec.interval > 1 ? `Every ${rec.interval} months` : 'Monthly';
    if (rec.monthMode === 'nthWeekday') return `${prefix}, ${rec.nthWeekdayLabel || 'on nth weekday'}`;
    if (rec.monthDay) return `${prefix} on day ${rec.monthDay}`;
    return prefix;
  }
  if (freq === 'yearly') {
    const prefix = rec.interval > 1 ? `Every ${rec.interval} years` : 'Yearly';
    if (rec.yearMonth != null && rec.yearDay) return `${prefix} on ${MONTH_NAMES[rec.yearMonth]} ${rec.yearDay}`;
    return prefix;
  }
  if (freq === 'weekdays') return 'Every weekday (Mon–Fri)';
  return null;
}

/** Expand a single event's recurrence into occurrences within a date range */
function expandRecurrence(event, rangeStart, rangeEnd) {
  const rec = event.metadata?.recurrence;
  if (!rec) return [event];

  const freq = typeof rec === 'string' ? rec : rec.freq;
  const interval = rec.interval || 1;
  const until = rec.until ? new Date(rec.until) : null;
  const customDays = rec.days || [];

  const baseDate = new Date(event.start_time);
  const occurrences = [];
  const maxOccurrences = 365;
  let count = 0;

  function addOccurrence(d) {
    const iso = isoDate(d);
    if (iso < rangeStart || iso > rangeEnd) return;
    if (until && d > until) return;
    const shifted = new Date(d);
    shifted.setHours(baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds());
    occurrences.push({
      ...event,
      id: `${event.id}_${iso}`,
      _originalId: event.id,
      start_time: shifted.toISOString(),
      _isRecurrenceInstance: iso !== isoDate(baseDate),
    });
  }

  if (freq === 'daily') {
    const d = new Date(baseDate);
    while (count < maxOccurrences) {
      addOccurrence(d);
      d.setDate(d.getDate() + interval);
      if (isoDate(d) > rangeEnd) break;
      if (until && d > until) break;
      count++;
    }
  } else if (freq === 'weekly') {
    const d = new Date(baseDate);
    while (count < maxOccurrences) {
      if (customDays.length > 0) {
        const weekStart = startOfWeek(d);
        for (let i = 0; i < 7; i++) {
          const wd = addDays(weekStart, i);
          const dayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i];
          if (customDays.includes(dayName) && wd >= baseDate) addOccurrence(wd);
        }
        d.setDate(d.getDate() + 7 * interval);
      } else {
        addOccurrence(d);
        d.setDate(d.getDate() + 7 * interval);
      }
      if (isoDate(d) > rangeEnd) break;
      if (until && d > until) break;
      count++;
    }
  } else if (freq === 'monthly') {
    if (rec.monthMode === 'nthWeekday' && rec.nthWeekday && rec.nthWeekdayDay) {
      const targetDow = DAY_NAMES.indexOf(rec.nthWeekdayDay);
      let m = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      while (count < maxOccurrences) {
        const firstDay = new Date(m.getFullYear(), m.getMonth(), 1);
        let dayOffset = (targetDow - firstDay.getDay() + 7) % 7;
        const nthDate = 1 + dayOffset + (rec.nthWeekday - 1) * 7;
        if (nthDate <= daysInMonth(m)) {
          const d = new Date(m.getFullYear(), m.getMonth(), nthDate);
          if (d >= baseDate) addOccurrence(d);
        }
        m.setMonth(m.getMonth() + interval);
        if (isoDate(m) > rangeEnd) break;
        if (until && m > until) break;
        count++;
      }
    } else {
      const d = new Date(baseDate);
      while (count < maxOccurrences) {
        addOccurrence(d);
        d.setMonth(d.getMonth() + interval);
        if (isoDate(d) > rangeEnd) break;
        if (until && d > until) break;
        count++;
      }
    }
  } else if (freq === 'yearly') {
    const d = new Date(baseDate);
    const ym = rec.yearMonth != null ? rec.yearMonth : d.getMonth();
    const yd = rec.yearDay || d.getDate();
    while (count < maxOccurrences) {
      const yearDate = new Date(d.getFullYear(), ym, yd);
      if (yearDate >= baseDate) addOccurrence(yearDate);
      d.setFullYear(d.getFullYear() + interval);
      if (isoDate(d) > rangeEnd) break;
      if (until && d > until) break;
      count++;
    }
  } else if (freq === 'weekdays') {
    const d = new Date(baseDate);
    while (count < maxOccurrences) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) addOccurrence(d);
      d.setDate(d.getDate() + 1);
      if (isoDate(d) > rangeEnd) break;
      if (until && d > until) break;
      count++;
    }
  }

  return occurrences.length > 0 ? occurrences : [event];
}

function getExpandRange(view, date) {
  if (view === 'today') return [isoDate(date), isoDate(date)];
  if (view === 'week') {
    const ws = startOfWeek(date);
    return [isoDate(ws), isoDate(addDays(ws, 6))];
  }
  if (view === 'month') {
    const ms = startOfMonth(date);
    return [isoDate(ms), isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  }
  // 'upcoming' — 14 days from the selected date
  return [isoDate(date), isoDate(addDays(date, 13))];
}

// ── Date Jump Picker ────────────────────────────────────────────
function DateJumpPicker({ date, onJump, onClose }) {
  const [viewMonth, setViewMonth] = useState(new Date(date.getFullYear(), date.getMonth(), 1));
  const total = daysInMonth(viewMonth);
  const rawDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const leadingBlanks = rawDay === 0 ? 6 : rawDay - 1;
  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  const today = isoDate(new Date());
  const selectedIso = isoDate(date);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute top-full left-0 mt-2 z-40 rounded-xl p-3 w-[280px]"
        style={{
          background: 'rgba(17,24,39,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setViewMonth(d => { const r = new Date(d); r.setMonth(r.getMonth() - 1); return r; })} className="w-7 h-7 rounded-full hover:bg-white/8 flex items-center justify-center text-ink-500"><ChevronLeft /></button>
          <span className="text-[13px] font-semibold text-ink-900">{viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setViewMonth(d => { const r = new Date(d); r.setMonth(r.getMonth() + 1); return r; })} className="w-7 h-7 rounded-full hover:bg-white/8 flex items-center justify-center text-ink-500"><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className="text-center text-[10px] text-ink-400 font-semibold py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const iso = isoDate(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
            const isToday = iso === today;
            const isSelected = iso === selectedIso;
            return (
              <button key={d} onClick={() => { onJump(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)); onClose(); }}
                className={'h-8 rounded-lg text-[12px] font-medium transition ' +
                  (isSelected ? 'bg-brand-blue text-white' : isToday ? 'text-brand-blue font-bold' : 'text-ink-700 hover:bg-white/8')}
                style={isToday && !isSelected ? { background: 'rgba(91,140,255,0.14)' } : {}}>
                {d}
              </button>
            );
          })}
        </div>
        <button onClick={() => { onJump(new Date()); onClose(); }} className="w-full mt-2 h-8 rounded-lg text-[12px] text-brand-blue font-semibold hover:bg-white/8 transition">Go to today</button>
      </div>
    </>
  );
}

// ── Custom Recurrence Modal ─────────────────────────────────────
function CustomRecurrenceModal({ open, onClose, onSave, eventDate }) {
  const [freq, setFreq] = useState('weekly');
  const [interval, setInterval] = useState(1);
  const [days, setDays] = useState([]);
  const [monthMode, setMonthMode] = useState('date');
  const [yearMonth, setYearMonth] = useState(0);
  const [yearDay, setYearDay] = useState(1);
  const [until, setUntil] = useState('');

  useEffect(() => {
    if (open && eventDate) {
      const d = new Date(eventDate + 'T00:00:00');
      setFreq('weekly'); setInterval(1); setUntil('');
      setDays([DAY_NAMES[d.getDay()]]);
      setMonthMode('date');
      setYearMonth(d.getMonth());
      setYearDay(d.getDate());
    }
  }, [open, eventDate]);

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const evDate = eventDate ? new Date(eventDate + 'T00:00:00') : new Date();
  const nthInfo = nthWeekdayLabel(evDate);

  return (
    <Modal open={open} onClose={onClose} title="Custom Recurrence">
      <div className="space-y-4">
        <Field label="Repeat every">
          <div className="flex gap-2">
            <input type="number" min="1" max="99" className={inputCls + ' !w-20'} value={interval} onChange={e => setInterval(Number(e.target.value))} />
            <select className={inputCls} value={freq} onChange={e => setFreq(e.target.value)}>
              <option value="daily">day(s)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
              <option value="yearly">year(s)</option>
            </select>
          </div>
        </Field>

        {freq === 'weekly' && (
          <Field label="Repeat on">
            <div className="flex gap-1.5">
              {DAY_NAMES.map((d, i) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={'h-9 w-9 rounded-full text-[12px] font-semibold transition ' + (days.includes(d) ? 'bg-brand-blue text-white' : 'bg-white/8 text-ink-500 hover:bg-white/14')}>
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
          </Field>
        )}

        {freq === 'monthly' && (
          <Field label="Repeat on">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="monthMode" checked={monthMode === 'date'} onChange={() => setMonthMode('date')} className="accent-brand-blue" />
                <span className="text-[13px] text-ink-900">Day {evDate.getDate()} of every month</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="monthMode" checked={monthMode === 'nthWeekday'} onChange={() => setMonthMode('nthWeekday')} className="accent-brand-blue" />
                <span className="text-[13px] text-ink-900">{nthInfo.label} of every month</span>
              </label>
            </div>
          </Field>
        )}

        {freq === 'yearly' && (
          <Field label="On date">
            <div className="flex gap-2">
              <select className={inputCls} value={yearMonth} onChange={e => setYearMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <input type="number" min="1" max="31" className={inputCls + ' !w-20'} value={yearDay} onChange={e => setYearDay(Number(e.target.value))} />
            </div>
          </Field>
        )}

        <Field label="Ends">
          <input type="date" className={inputCls} value={until} onChange={e => setUntil(e.target.value)} />
          {!until && <p className="text-[11px] text-ink-400 mt-1">Leave blank to repeat forever</p>}
        </Field>

        <button type="button" onClick={() => {
          const rec = { freq, interval };
          if (freq === 'weekly' && days.length) rec.days = days;
          if (freq === 'monthly') {
            rec.monthMode = monthMode;
            if (monthMode === 'date') rec.monthDay = evDate.getDate();
            else { rec.nthWeekday = nthInfo.nth; rec.nthWeekdayDay = nthInfo.weekday; rec.nthWeekdayLabel = nthInfo.label; }
          }
          if (freq === 'yearly') { rec.yearMonth = yearMonth; rec.yearDay = yearDay; }
          if (until) rec.until = until;
          onSave(rec);
          onClose();
        }} className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold">Done</button>
      </div>
    </Modal>
  );
}

// ── Recurrence Picker ───────────────────────────────────────────
function RecurrencePicker({ value, onChange, eventDate }) {
  const [customOpen, setCustomOpen] = useState(false);
  const current = (() => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return 'custom';
  })();
  const evDate = eventDate ? new Date(eventDate + 'T00:00:00') : new Date();
  const dayName = DAY_NAMES[evDate.getDay()];

  const options = [
    { value: '', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: `Weekly on ${dayName}` },
    { value: 'monthly', label: `Monthly on day ${evDate.getDate()}` },
    { value: 'yearly', label: `Annually on ${MONTH_NAMES[evDate.getMonth()]} ${evDate.getDate()}` },
    { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
    { value: 'custom', label: 'Custom…' },
  ];

  const handleChange = (v) => {
    if (v === 'custom') { setCustomOpen(true); return; }
    if (!v) { onChange(null); return; }
    if (v === 'daily') { onChange({ freq: 'daily', interval: 1 }); return; }
    if (v === 'weekly') { onChange({ freq: 'weekly', interval: 1, days: [dayName] }); return; }
    if (v === 'monthly') { onChange({ freq: 'monthly', interval: 1, monthMode: 'date', monthDay: evDate.getDate() }); return; }
    if (v === 'yearly') { onChange({ freq: 'yearly', interval: 1, yearMonth: evDate.getMonth(), yearDay: evDate.getDate() }); return; }
    onChange(v);
  };

  return (
    <>
      <Field label="Repeat">
        <select className={inputCls} value={current} onChange={e => handleChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {value && typeof value === 'object' && current === 'custom' && (
          <p className="text-[11px] text-brand-blue mt-1 flex items-center gap-1">
            <RepeatIcon width="11" height="11" />
            {recurrenceLabel(value)}{value.until ? ` · until ${value.until}` : ''}
          </p>
        )}
      </Field>

      {value && typeof value === 'object' && (value.freq === 'weekly') && current !== 'custom' && (
        <div className="-mt-2 mb-3">
          <p className="text-[11px] text-ink-400 mb-1.5">Repeat on</p>
          <div className="flex gap-1.5">
            {DAY_NAMES.map((d, i) => (
              <button key={d} type="button" onClick={() => {
                const cur = value.days || [];
                const next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
                if (next.length === 0) return;
                onChange({ ...value, days: next });
              }}
                className={'h-8 w-8 rounded-full text-[11px] font-semibold transition ' +
                  ((value.days || []).includes(d) ? 'bg-brand-blue text-white' : 'bg-white/8 text-ink-500 hover:bg-white/14')}>
                {DAY_LABELS[i]}
              </button>
            ))}
          </div>
        </div>
      )}

      <CustomRecurrenceModal open={customOpen} onClose={() => setCustomOpen(false)} onSave={onChange} eventDate={eventDate} />
    </>
  );
}

// ── Add Event / Add Leave Modals ────────────────────────────────
function AddEventModal({ open, onClose, onCreated, date, prefillTitle = '' }) {
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(date);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(prefillTitle || '');
      setEventDate(date);
      setRecurrence(null);
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      setTime(`${String(nextHour.getHours()).padStart(2, '0')}:00`);
      setDuration(60);
    }
  }, [open, prefillTitle, date]);

  const submit = async (e) => {
    e.preventDefault(); if (!title.trim()) return; setBusy(true);
    try {
      await api.createEvent({
        title: title.trim(),
        startTime: new Date(`${eventDate}T${time}:00`).toISOString(),
        durationMin: Number(duration),
        eventType: 'work',
        recurrence: recurrence || undefined,
      });
      onCreated?.(); onClose();
    } catch (err) { showToast(err.message || 'Failed to create event', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to Calendar">
      <form onSubmit={submit}>
        <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={eventDate} onChange={e => setEventDate(e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time"><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required /></Field>
          <Field label="Duration (min)"><input type="number" min="15" step="15" className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} /></Field>
        </div>
        <RecurrencePicker value={recurrence} onChange={setRecurrence} eventDate={eventDate} />
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Adding…' : 'Add Event'}</button>
      </form>
    </Modal>
  );
}

function AddLeaveModal({ open, onClose, onCreated, date }) {
  const showToast = useToast();
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
    catch (err) { showToast(err.message || 'Failed to add leave', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Leave">
      <form onSubmit={submit}>
        <Field label="Member">
          <select className={inputCls} value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Myself</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} required /></Field>
          <Field label="To"><input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} required /></Field>
        </div>
        <Field label="Type">
          <select className={inputCls} value={type} onChange={e => setType(e.target.value)}>
            <option value="PL">Privilege Leave (PL)</option>
            <option value="SL">Sick Leave (SL)</option>
            <option value="CL">Casual Leave (CL)</option>
            <option value="FL">Flexi Leave (FL)</option>
          </select>
        </Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Adding…' : 'Add Leave'}</button>
      </form>
    </Modal>
  );
}

// ── Recurrence Scope Dialog (edit/delete scope chooser) ─────────
function RecurrenceScopeDialog({ open, onClose, onChoose, action }) {
  if (!open) return null;
  const verb = action === 'delete' ? 'Delete' : 'Save changes';
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div className="relative rounded-card w-full max-w-[340px] p-5 space-y-3"
        style={{
          background: 'rgba(17,24,39,0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink-900">{verb} recurring event</h2>
        <p className="text-sm text-ink-500 leading-relaxed">Which occurrences should this apply to?</p>
        <div className="space-y-2 pt-1">
          {[
            { id: 'this',    label: 'This event only',       desc: 'Only the selected occurrence' },
            { id: 'future',  label: 'This and future',       desc: 'Keep past occurrences, change from this one forward' },
            { id: 'all',     label: 'All events in series',  desc: 'Apply to every occurrence, past and future' },
          ].map(opt => (
            <button key={opt.id} onClick={() => onChoose(opt.id)}
              className="w-full text-left p-3 rounded-[10px] transition hover:bg-white/8"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[13px] font-semibold text-ink-900">{opt.label}</p>
              <p className="text-[11px] text-ink-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
          <button onClick={onClose} className="w-full h-10 rounded-[10px] text-[13px] text-ink-400 border border-white/10 mt-2">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Unified Event Modal (edit + complete + reschedule + follow-up + delete) ─
function EventModal({ open, onClose, event, onUpdated, onChanged, onRequestDelete }) {
  const showToast = useToast();
  const [step, setStep] = useState('view'); // view | edit | complete | reschedule | partial
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState(null);
  const [busy, setBusy] = useState(false);
  const [linkSubtaskId, setLinkSubtaskId] = useState('');
  const [pendingSubs, setPendingSubs] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newDuration, setNewDuration] = useState(60);

  const realEvent = event?._originalId ? { ...event, id: event._originalId } : event;
  const isCompleted = event?.status === 'completed';
  const isPartial = event?.status === 'partial';
  const isRecurring = !!event?.metadata?.recurrence;

  useEffect(() => {
    if (open && event) {
      setStep('view');
      setTitle(event.title || '');
      const d = new Date(event.start_time);
      setDate(isoDate(d));
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setDuration(event.duration_min || 60);
      setRecurrence(event.metadata?.recurrence || null);
      setLinkSubtaskId('');
      const next = new Date(d); next.setDate(next.getDate() + 1);
      setNewDate(isoDate(next));
      setNewTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setNewDuration(event.duration_min || 60);
    }
  }, [open, event]);

  const loadSubs = async () => { try { setPendingSubs(await api.myPendingSubtasks()); } catch {} };

  const saveEdit = async (e) => {
    e?.preventDefault?.(); if (!title.trim() || !realEvent) return; setBusy(true);
    try {
      await api.updateEvent(realEvent.id, {
        title: title.trim(),
        startTime: new Date(`${date}T${time}:00`).toISOString(),
        durationMin: Number(duration),
        recurrence: recurrence || null,
      });
      onUpdated?.(); onClose();
    } catch (err) { showToast(err.message || 'Failed to update event', 'error'); } finally { setBusy(false); }
  };

  const doComplete = async () => {
    if (!realEvent) return; setBusy(true);
    try {
      await api.completeEvent(realEvent.id, { linkedSubtaskId: linkSubtaskId || null });
      showToast(linkSubtaskId ? 'Event completed & task marked done' : 'Event marked complete');
      onChanged?.(); onClose();
    } catch (err) { showToast(err.message || 'Failed to complete', 'error'); }
    finally { setBusy(false); }
  };

  const doReschedule = async () => {
    if (!realEvent) return; setBusy(true);
    try {
      const iso = new Date(`${newDate}T${newTime}:00`).toISOString();
      await api.rescheduleEvent(realEvent.id, iso);
      showToast('Event rescheduled');
      onChanged?.(); onClose();
    } catch (err) { showToast(err.message || 'Failed to reschedule', 'error'); }
    finally { setBusy(false); }
  };

  const doPartial = async () => {
    if (!realEvent) return; setBusy(true);
    try {
      const iso = new Date(`${newDate}T${newTime}:00`).toISOString();
      await api.partialEvent(realEvent.id, { startTime: iso, durationMin: Number(newDuration), title: realEvent.title });
      showToast('Follow-up session scheduled');
      onChanged?.(); onClose();
    } catch (err) { showToast(err.message || 'Failed to create follow-up', 'error'); }
    finally { setBusy(false); }
  };

  if (!event) return null;

  const ActionRow = ({ icon, label, desc, color, onClick, danger }) => (
    <button onClick={onClick} disabled={busy}
      className="w-full flex items-center gap-3 p-3 rounded-[12px] transition text-left hover:bg-white/5 disabled:opacity-50"
      style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={'font-semibold text-[14px] ' + (danger ? 'text-danger' : 'text-ink-900')}>{label}</p>
        <p className="text-[11px] text-ink-400 mt-0.5">{desc}</p>
      </div>
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title={step === 'edit' ? 'Edit event' : (event.title || 'Event')}>
      {isCompleted && step === 'view' && (
        <div className="mb-3 px-3 py-2 rounded-[10px] text-[12px] font-medium flex items-center gap-1.5" style={{ background: 'rgba(34,197,94,0.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.3)' }}>
          <CheckIcon width="12" height="12" /> Completed
        </div>
      )}
      {isPartial && step === 'view' && (
        <div className="mb-3 px-3 py-2 rounded-[10px] text-[12px] font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.3)' }}>
          Partial — follow-up scheduled
        </div>
      )}
      {step === 'view' && event.linked_subtask?.status === 'done' && !isCompleted && !isPartial && (
        <div className="mb-3 px-3 py-2 rounded-[10px] text-[12px] font-medium flex items-center gap-1.5" style={{ background: 'rgba(34,197,94,0.1)', color: '#86EFAC', border: '1px solid rgba(34,197,94,0.25)' }}>
          <CheckIcon width="12" height="12" /> Linked task <span className="font-semibold">"{event.linked_subtask.title}"</span> already done
        </div>
      )}

      {step === 'view' && (
        <div className="space-y-3">
          {/* Meta */}
          <div className="flex items-center gap-2 text-[12px] text-ink-400 pb-1">
            <ClockIcon width="13" height="13" />
            <span>{fmtTime(event.start_time)} · {event.duration_min} min</span>
            {isRecurring && <span className="flex items-center gap-1 ml-2"><RepeatIcon width="11" height="11" /> {recurrenceLabel(event.metadata.recurrence)}</span>}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {!isCompleted && <ActionRow icon={<CheckIcon width="16" height="16" />} label="Mark complete" desc="Done for this session" color="#22C55E" onClick={() => { loadSubs(); setStep('complete'); }} />}
            {!isCompleted && <ActionRow icon={<CalendarIcon width="16" height="16" />} label="Reschedule" desc="Move to another date or time" color="#5B8CFF" onClick={() => setStep('reschedule')} />}
            {!isCompleted && <ActionRow icon={<ClockIcon width="16" height="16" />} label="Continue later" desc="Mark partial + schedule a follow-up" color="#F59E0B" onClick={() => setStep('partial')} />}
            <ActionRow icon={<MoreIcon width="16" height="16" />} label="Edit details" desc="Title, time, duration, recurrence" color="#A78BFA" onClick={() => setStep('edit')} />
            <ActionRow icon={<CloseIcon width="16" height="16" />} label="Delete" desc={isRecurring ? 'Remove occurrence or series' : 'Remove this event'} color="#EF4444" danger onClick={() => { onRequestDelete?.(realEvent); onClose(); }} />
          </div>
        </div>
      )}

      {step === 'edit' && (
        <form onSubmit={saveEdit}>
          <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required /></Field>
            <Field label="Time"><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required /></Field>
          </div>
          <Field label="Duration (min)"><input type="number" min="15" step="15" className={inputCls} value={duration} onChange={e => setDuration(e.target.value)} /></Field>
          <RecurrencePicker value={recurrence} onChange={setRecurrence} eventDate={date} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('view')} className="flex-1 h-11 rounded-[10px] border border-white/10 text-[13px]" style={{ color: '#9CA3AF' }}>Back</button>
            <button disabled={busy} type="submit" className="flex-1 h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {step === 'complete' && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-400">Also mark a task as done? (optional)</p>
          <select value={linkSubtaskId} onChange={e => setLinkSubtaskId(e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {pendingSubs.map(s => <option key={s.id} value={s.id}>{s.title}{s.project_title ? ` · ${s.project_title}` : ''}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setStep('view')} className="flex-1 h-11 rounded-[10px] border border-white/10 text-[13px]" style={{ color: '#9CA3AF' }}>Back</button>
            <button onClick={doComplete} disabled={busy} className="flex-1 h-11 rounded-[10px] text-white font-semibold disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}>{busy ? 'Saving…' : 'Mark complete'}</button>
          </div>
        </div>
      )}

      {step === 'reschedule' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="New date"><input type="date" className={inputCls} value={newDate} onChange={e => setNewDate(e.target.value)} /></Field>
            <Field label="New time"><input type="time" className={inputCls} value={newTime} onChange={e => setNewTime(e.target.value)} /></Field>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('view')} className="flex-1 h-11 rounded-[10px] border border-white/10 text-[13px]" style={{ color: '#9CA3AF' }}>Back</button>
            <button onClick={doReschedule} disabled={busy} className="flex-1 h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Reschedule'}</button>
          </div>
        </div>
      )}

      {step === 'partial' && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-400">Schedule a follow-up session to continue this work.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={newDate} onChange={e => setNewDate(e.target.value)} /></Field>
            <Field label="Time"><input type="time" className={inputCls} value={newTime} onChange={e => setNewTime(e.target.value)} /></Field>
          </div>
          <Field label="Duration (min)"><input type="number" min="15" step="15" className={inputCls} value={newDuration} onChange={e => setNewDuration(e.target.value)} /></Field>
          <div className="flex gap-2">
            <button onClick={() => setStep('view')} className="flex-1 h-11 rounded-[10px] border border-white/10 text-[13px]" style={{ color: '#9CA3AF' }}>Back</button>
            <button onClick={doPartial} disabled={busy} className="flex-1 h-11 rounded-[10px] text-white font-semibold disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>{busy ? 'Saving…' : 'Create follow-up'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Team Toggle (dark glass) ────────────────────────────────────
function TeamToggle({ users, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!users || users.length === 0) return null;
  const activeCount = selected.length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="h-9 px-3 rounded-[10px] text-[12px] font-medium transition flex items-center gap-1.5"
        style={{
          background: activeCount > 0 ? 'rgba(91,140,255,0.15)' : 'rgba(255,255,255,0.05)',
          color: activeCount > 0 ? '#A8C4FF' : '#9CA3AF',
          border: `1px solid ${activeCount > 0 ? 'rgba(91,140,255,0.30)' : 'rgba(255,255,255,0.10)'}`,
        }}
        aria-label="Team overlay">
        <UsersIcon width="14" height="14" />
        {activeCount > 0 && <span className="tabular-nums">{activeCount}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-30 rounded-xl py-1.5 min-w-[220px]"
            style={{
              background: 'rgba(17,24,39,0.95)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
            <p className="px-3 py-1.5 text-[10px] text-ink-400 uppercase tracking-wide font-semibold">View teammates</p>
            {users.map(u => {
              const active = selected.includes(u.id);
              return (
                <button key={u.id} onClick={() => onToggle(u.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition text-left">
                  <Avatar user={u} size={24} />
                  <span className="flex-1 text-[13px] text-ink-900">{u.name}</span>
                  <div className={'w-4 h-4 rounded border-2 flex items-center justify-center transition ' + (active ? 'bg-brand-blue border-brand-blue' : 'border-white/20')}>
                    {active && <CheckIcon width="10" height="10" style={{ color: 'white' }} />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Overflow Menu (rare actions: planning views, leave, jump) ───
function OverflowMenu({ onAddLeave, onJumpToday, onShowWeek, onShowMonth }) {
  const [open, setOpen] = useState(false);
  const MenuItem = ({ icon, label, hint, onClick }) => (
    <button onClick={() => { onClick?.(); setOpen(false); }}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition text-left">
      <span className="text-ink-400 flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-ink-900">{label}</span>
        {hint && <span className="block text-[10px] text-ink-400">{hint}</span>}
      </span>
    </button>
  );
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="h-9 w-9 rounded-[10px] flex items-center justify-center transition"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.10)' }}
        aria-label="More options">
        <MoreIcon width="16" height="16" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-30 rounded-xl py-1.5 min-w-[220px]"
            style={{
              background: 'rgba(17,24,39,0.95)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
            <p className="px-3 py-1.5 text-[10px] text-ink-400 uppercase tracking-wide font-semibold">Planning views</p>
            <MenuItem icon={<CalendarIcon width="14" height="14" />} label="Week view" hint="Scan the week at a glance" onClick={onShowWeek} />
            <MenuItem icon={<CalendarIcon width="14" height="14" />} label="Month view" hint="Plan vacations, spot gaps" onClick={onShowMonth} />

            <div className="my-1 mx-3 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

            <MenuItem icon={<UmbrellaIcon width="14" height="14" />} label="Add leave" onClick={onAddLeave} />
            <MenuItem icon={<CalendarIcon width="14" height="14" />} label="Jump to today" onClick={onJumpToday} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Leave banner — single unified treatment ─────────────────────
function LeaveBanner({ leave, onRemove }) {
  return (
    <div className="rounded-[12px] pl-3 pr-2 py-2 flex items-center gap-2.5"
      style={{
        background: 'linear-gradient(90deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderLeft: '3px solid #EF4444',
      }}>
      <span className="flex-shrink-0 text-[#F87171]"><UmbrellaIcon width="14" height="14" /></span>
      <span className="text-[12px] text-ink-900 flex-1 min-w-0 truncate">
        <span className="font-semibold">{leave.name}</span>
        <span className="text-ink-400"> · on leave ({leave.type})</span>
      </span>
      {onRemove && (
        <button onClick={onRemove} className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:text-[#F87171] hover:bg-white/5 transition" aria-label="Remove leave">
          <CloseIcon width="12" height="12" />
        </button>
      )}
    </div>
  );
}

// ── Helper: stale linked task hint ─────────────────────────────
function hasStaleLink(ev) {
  return ev?.status === 'scheduled' && ev?.linked_subtask?.status === 'done';
}

// ── Pack overlapping events into columns for side-by-side rendering ─
function packEvents(events) {
  const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const occupied = []; // [{ endTime: Date, col: number }]
  let maxCol = 0;
  sorted.forEach(ev => {
    const start = new Date(ev.start_time);
    const end = new Date(start.getTime() + (ev.duration_min || 60) * 60000);
    // free up columns whose events have ended
    for (let i = occupied.length - 1; i >= 0; i--) {
      if (occupied[i].endTime <= start) occupied.splice(i, 1);
    }
    const used = new Set(occupied.map(o => o.col));
    let col = 0;
    while (used.has(col)) col++;
    occupied.push({ endTime: end, col });
    ev._col = col;
    if (col > maxCol) maxCol = col;
  });
  const total = maxCol + 1;
  sorted.forEach(ev => { ev._colTotal = total; });
  return sorted;
}

// ── Week view (tucked-away planning view — 7 columns, read-only) ─
function WeekView({ date, allEvents, leaves, onDayClick }) {
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = isoDate(new Date());

  return (
    <div className="overflow-x-auto -mx-1 pb-1">
      <div className="flex gap-1.5 px-1" style={{ minWidth: 640 }}>
        {days.map(d => {
          const iso = isoDate(d);
          const dayEvents = allEvents
            .filter(e => eventLocalDate(e) === iso)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const dayLeaves = leavesOnDate(leaves, iso);
          const isT = iso === today;
          return (
            <button
              key={iso}
              onClick={() => onDayClick(d)}
              className="flex-1 min-w-[92px] text-left rounded-[12px] p-2 transition hover:bg-white/5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isT ? 'rgba(91,140,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: isT ? '0 0 12px rgba(91,140,255,0.15)' : 'none',
              }}
            >
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">
                  {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </p>
                <p className={'text-[17px] font-bold mt-0.5 ' + (isT ? 'text-brand-blue' : 'text-ink-900')}>
                  {d.getDate()}
                </p>
              </div>
              <div className="space-y-1 min-h-[64px]">
                {dayLeaves.slice(0, 1).map(l => (
                  <div key={l.id} className="text-[9px] px-1.5 py-0.5 rounded truncate"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.22)' }}>
                    {l.initials} leave
                  </div>
                ))}
                {dayEvents.slice(0, 3).map(ev => {
                  const c = accentFor(ev);
                  return (
                    <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded truncate"
                      style={{
                        background: `${c}22`,
                        color: '#E5E7EB',
                        borderLeft: `2px solid ${c}`,
                        opacity: ev._isTeam ? 0.7 : 1,
                      }}>
                      {ev._isTeam && ev._busyOnly ? 'Busy' : ev.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[9px] text-ink-400">+{dayEvents.length - 3} more</p>
                )}
                {dayEvents.length === 0 && dayLeaves.length === 0 && (
                  <p className="text-[9px] text-ink-400/60">—</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Month view (tucked-away planning view — vacation scan) ──────
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
          <div key={d} className="text-center text-[10px] text-ink-400 py-1.5 font-semibold uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} className="min-h-[72px]" style={{ background: 'rgba(17,24,39,0.4)' }} />;
          const iso = isoDate(d);
          const dayEvents = allEvents.filter(e => eventLocalDate(e) === iso);
          const dayLeaves = leavesOnDate(leaves, iso);
          const isT = iso === today;
          return (
            <button
              key={iso}
              onClick={() => onDayClick(d)}
              className="min-h-[72px] p-1.5 text-left align-top transition hover:bg-white/5 relative"
              style={{
                background: 'rgba(17,24,39,0.7)',
                outline: isT ? '2px solid #5B8CFF' : 'none',
                outlineOffset: isT ? '-2px' : 0,
              }}
            >
              <p className={'text-[11px] font-semibold mb-1 ' + (isT ? 'text-brand-blue' : 'text-ink-900')}>
                {d.getDate()}
              </p>
              {dayLeaves.length > 0 && (
                <div className="h-[3px] w-full rounded-full mb-1" style={{ background: 'rgba(239,68,68,0.7)' }} title={dayLeaves.map(l => `${l.initials} (${l.type})`).join(', ')} />
              )}
              {dayEvents.slice(0, 2).map(ev => {
                const c = accentFor(ev);
                return (
                  <div key={ev.id} className="text-[9px] rounded px-1 truncate leading-tight mb-0.5"
                    style={{
                      background: `${c}33`,
                      color: '#E5E7EB',
                      borderLeft: `2px solid ${c}`,
                      opacity: ev._isTeam ? 0.7 : 1,
                    }}>
                    {ev._isTeam && ev._busyOnly ? 'Busy' : ev.title}
                  </div>
                );
              })}
              {dayEvents.length > 2 && <p className="text-[9px] text-ink-400">+{dayEvents.length - 2}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day view: time grid + now-line + simplified cards ───────────
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 22;
const HOUR_HEIGHT = 56;
const TIME_COL_WIDTH = 52;

function DayView({ events, leaves, date, onEventClick, onDeleteLeave, onQuickComplete }) {
  const iso = isoDate(date);
  const isTodayView = iso === isoDate(new Date());
  const onLeave = leavesOnDate(leaves, iso);

  // Events that fall inside the grid vs outside (early morning / late night)
  const { inGrid, outOfGrid } = useMemo(() => {
    const inG = [], outG = [];
    events.forEach(ev => {
      const h = new Date(ev.start_time).getHours();
      if (h >= GRID_START_HOUR && h < GRID_END_HOUR) inG.push(ev);
      else outG.push(ev);
    });
    return { inGrid: packEvents(inG), outOfGrid: outG.sort((a, b) => a.start_time.localeCompare(b.start_time)) };
  }, [events]);

  // Live "now" indicator — only visible when viewing today
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isTodayView) return;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [isTodayView]);

  const nowMinsFromGridStart = (now.getHours() + now.getMinutes() / 60 - GRID_START_HOUR) * 60;
  const nowTop = (nowMinsFromGridStart / 60) * HOUR_HEIGHT;
  const nowVisible = isTodayView && nowTop >= 0 && nowTop <= (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;

  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);
  const gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;

  const empty = events.length === 0 && onLeave.length === 0;

  return (
    <div className="space-y-3">
      {/* Leave banners — unified treatment */}
      {onLeave.map(l => (
        <LeaveBanner key={l.id} leave={l} onRemove={() => onDeleteLeave?.(l.id)} />
      ))}

      {empty && <EmptyDay />}

      {/* Out-of-grid events (before 7am / after 10pm) */}
      {outOfGrid.length > 0 && (
        <div className="space-y-1.5">
          {outOfGrid.map(ev => (
            <DayEventRow key={ev.id} event={ev} onClick={() => !ev._isTeam && onEventClick?.(ev)} onQuickComplete={onQuickComplete} />
          ))}
        </div>
      )}

      {/* Time grid */}
      {events.length > 0 && (
        <div className="relative" style={{ height: gridHeight }}>
          {/* Hour markers */}
          {hours.map((h, i) => (
            <div key={h} className="absolute left-0 right-0 flex items-start pointer-events-none" style={{ top: i * HOUR_HEIGHT }}>
              <div style={{ width: TIME_COL_WIDTH }} className="pr-2 text-right text-[10px] text-ink-400 tabular-nums -mt-1.5">
                {fmtHour12(h)}
              </div>
              <div className="flex-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            </div>
          ))}

          {/* Now line */}
          {nowVisible && (
            <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
              <div style={{ width: TIME_COL_WIDTH }} className="pr-2 text-right text-[10px] font-bold tabular-nums -mt-1.5" aria-label="Current time">
                <span className="px-1 rounded" style={{ color: '#EF4444' }}>{fmtTime(now.toISOString())}</span>
              </div>
              <div className="relative flex-1">
                <div className="absolute left-0 w-2 h-2 rounded-full -translate-y-1/2" style={{ background: '#EF4444', boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
                <div className="h-[2px]" style={{ background: '#EF4444', boxShadow: '0 0 4px rgba(239,68,68,0.5)' }} />
              </div>
            </div>
          )}

          {/* Events positioned on the grid */}
          <div className="absolute top-0 bottom-0" style={{ left: TIME_COL_WIDTH, right: 0 }}>
            {inGrid.map(ev => (
              <TimeGridEvent key={ev.id} event={ev} onClick={() => !ev._isTeam && onEventClick?.(ev)} onQuickComplete={onQuickComplete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="py-14 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <span className="text-ink-400"><CalendarIcon width="20" height="20" /></span>
      </div>
      <p className="text-[14px] font-semibold text-ink-900">Nothing scheduled</p>
      <p className="text-[12px] text-ink-400 mt-1">Tap “+” to add an event.</p>
    </div>
  );
}

// Compact row for out-of-grid events (early morning / late night)
function DayEventRow({ event, onClick, onQuickComplete }) {
  const ev = event;
  const isTeam = !!ev._isTeam;
  const title = isTeam && ev._busyOnly ? 'Busy' : ev.title;
  return (
    <button onClick={onClick} disabled={isTeam}
      className={'w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-left transition ' + (isTeam ? '' : 'hover:bg-white/5')}
      style={{
        background: isTeam ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        border: isTeam ? '1px dashed rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.10)',
        borderLeft: `3px solid ${accentFor(ev)}`,
      }}>
      <span className="text-[11px] text-ink-400 tabular-nums" style={{ width: 44 }}>{fmtTime(ev.start_time)}</span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {ev.event_type === 'personal' && <span className="text-ink-400 flex-shrink-0"><LockIcon /></span>}
        <span className="text-[13px] font-medium text-ink-900 truncate">{title}</span>
        {ev.metadata?.recurrence && <span className="text-ink-400 flex-shrink-0"><RepeatIcon /></span>}
      </div>
      <span className="text-[10px] text-ink-400 flex-shrink-0">{ev.duration_min}m</span>
    </button>
  );
}

// Grid-positioned event block
function TimeGridEvent({ event, onClick, onQuickComplete }) {
  const ev = event;
  const start = new Date(ev.start_time);
  const offsetMin = (start.getHours() + start.getMinutes() / 60 - GRID_START_HOUR) * 60;
  const duration = ev.duration_min || 60;
  const top = (offsetMin / 60) * HOUR_HEIGHT;
  const height = Math.max(28, (duration / 60) * HOUR_HEIGHT - 2);
  const total = ev._colTotal || 1;
  const col = ev._col || 0;
  const widthPct = 100 / total;
  const leftPct = col * widthPct;
  const isTeam = !!ev._isTeam;
  const isCompact = height < 48;
  const title = isTeam && ev._busyOnly ? 'Busy' : ev.title;
  const accent = accentFor(ev);
  const stale = hasStaleLink(ev);

  return (
    <button
      onClick={onClick}
      disabled={isTeam}
      className={'absolute text-left rounded-[8px] transition overflow-hidden ' + (isTeam ? '' : 'hover:brightness-110 active:scale-[0.99]')}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: isTeam
          ? 'rgba(255,255,255,0.03)'
          : `linear-gradient(180deg, ${accent}22 0%, ${accent}10 100%)`,
        border: isTeam ? '1px dashed rgba(255,255,255,0.15)' : `1px solid ${accent}40`,
        borderLeft: `3px solid ${accent}`,
        backdropFilter: 'blur(8px)',
        padding: isCompact ? '4px 8px' : '6px 8px',
      }}
    >
      <div className="flex items-center gap-1 min-w-0">
        {ev.event_type === 'personal' && <span className="text-ink-400 flex-shrink-0"><LockIcon /></span>}
        <p className={'font-semibold text-ink-900 truncate ' + (isCompact ? 'text-[11px]' : 'text-[12px]')}>{title}</p>
        {ev.metadata?.recurrence && <span className="text-ink-400 flex-shrink-0"><RepeatIcon /></span>}
        {ev.status === 'completed' && <span className="flex-shrink-0" style={{ color: '#4ADE80' }}><CheckIcon width="11" height="11" /></span>}
      </div>
      {!isCompact && (
        <p className="text-[10px] text-ink-400 mt-0.5 truncate">
          {fmtTime(ev.start_time)} · {ev.duration_min}m
          {isTeam ? ` · ${ev._teamName}` : ev.department ? ` · ${ev.department}` : ''}
        </p>
      )}
      {stale && !isCompact && (
        <button onClick={e => { e.stopPropagation(); onQuickComplete?.(ev); }}
          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(34,197,94,0.18)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.3)' }}>
          <CheckIcon width="9" height="9" /> Complete
        </button>
      )}
    </button>
  );
}

// ── Upcoming (Agenda) view — 14 days ────────────────────────────
function UpcomingView({ allEvents, leaves, date, onEventClick, onDeleteLeave, onQuickComplete }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i));
  const daysWithContent = days.filter(d => {
    const iso = isoDate(d);
    return allEvents.some(e => eventLocalDate(e) === iso) || leavesOnDate(leaves, iso).length > 0;
  });

  if (daysWithContent.length === 0) {
    return (
      <div className="py-14 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <span className="text-ink-400"><CalendarIcon width="20" height="20" /></span>
        </div>
        <p className="text-[14px] font-semibold text-ink-900">Nothing in the next 14 days</p>
        <p className="text-[12px] text-ink-400 mt-1">Clear skies ahead.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {daysWithContent.map(d => {
        const iso = isoDate(d);
        const dayEvents = allEvents.filter(e => eventLocalDate(e) === iso).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const dayLeaves = leavesOnDate(leaves, iso);
        const isTodayHeader = iso === isoDate(new Date());
        return (
          <div key={iso}>
            <div className="flex items-center gap-2 mb-2.5">
              {isTodayHeader && <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />}
              <p className={'text-[13px] font-semibold ' + (isTodayHeader ? 'text-brand-blue' : 'text-ink-900')}>
                {d.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
                {isTodayHeader && <span className="text-[11px] font-normal text-brand-blue/60 ml-1.5">Today</span>}
              </p>
            </div>
            <div className="space-y-1.5">
              {dayLeaves.map(l => (
                <LeaveBanner key={l.id} leave={l} onRemove={() => onDeleteLeave?.(l.id)} />
              ))}
              {dayEvents.map(ev => (
                <DayEventRow key={ev.id} event={ev} onClick={() => !ev._isTeam && onEventClick?.(ev)} onQuickComplete={onQuickComplete} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Calendar ───────────────────────────────────────────────
export default function Calendar({ me, unreadCount, onOpenNotifications, onSwitchTab, deepLink }) {
  const showToast = useToast();
  const [view, setView] = useState('today'); // 'today' | 'upcoming'
  const [date, setDate] = useState(new Date());
  const [rawEvents, setRawEvents] = useState([]);
  const [allRawEvents, setAllRawEvents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [prefillTitle, setPrefillTitle] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Recurrence scope choice state
  const [recScope, setRecScope] = useState(null); // { action: 'delete'|'edit', event } | null

  // Team overlay
  const [teamUsers, setTeamUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState([]);
  const [teamRawEvents, setTeamRawEvents] = useState([]);

  const loadDay = (d) => api.events(isoDate(d)).then(setRawEvents);
  const loadAll = () => api.events().then(setAllRawEvents);
  const loadLeaves = () => api.leaves().then(setLeaves);

  useEffect(() => {
    loadDay(date); loadAll(); loadLeaves();
    api.users().then(u => setTeamUsers(u.filter(x => x.id !== me?.id && (x.role === 'admin' || x.role === 'manager'))));
  }, []);
  useEffect(() => { loadDay(date); }, [date]);

  useEffect(() => {
    if (selectedTeam.length === 0) { setTeamRawEvents([]); return; }
    api.teamEvents().then(evts => {
      const filtered = evts.filter(e => selectedTeam.includes(e.owner_id) && e.owner_id !== me?.id);
      setTeamRawEvents(filtered);
    });
  }, [selectedTeam, me?.id]);

  const toggleTeamMember = (uid) => setSelectedTeam(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const [rangeStart, rangeEnd] = getExpandRange(view, date);

  const events = useMemo(() => {
    const expanded = rawEvents.flatMap(e => expandRecurrence(e, rangeStart, rangeEnd));
    return expanded.filter(e => eventLocalDate(e) === isoDate(date));
  }, [rawEvents, rangeStart, rangeEnd, date]);

  const allEvents = useMemo(() => {
    const ownExpanded = allRawEvents.flatMap(e => expandRecurrence(e, rangeStart, rangeEnd));
    const teamExpanded = teamRawEvents.flatMap(e => {
      const vis = e.calendarVisibility || 'full';
      const expanded = expandRecurrence(e, rangeStart, rangeEnd);
      return expanded.map(occ => ({
        ...occ,
        _isTeam: true,
        _teamName: e.owner_name,
        _teamInitials: e.owner_initials,
        _teamColor: e.owner_avatar_color,
        _busyOnly: vis === 'busy',
        title: vis === 'busy' ? 'Busy' : occ.title,
      }));
    });
    return [...ownExpanded, ...teamExpanded].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [allRawEvents, teamRawEvents, rangeStart, rangeEnd]);

  // Deep link: "addEvent" from other screens
  const [handledDeepLink, setHandledDeepLink] = useState(null);
  useEffect(() => {
    if (deepLink?.kind === 'addEvent' && deepLink.title && deepLink.ts !== handledDeepLink) {
      setPrefillTitle(deepLink.title); setAddOpen(true); setHandledDeepLink(deepLink.ts);
    }
  }, [deepLink, handledDeepLink]);

  const nav = (dir) => {
    if (view === 'today') setDate(d => addDays(d, dir));
    else if (view === 'week') setDate(d => addDays(d, dir * 7));
    else if (view === 'month') setDate(d => { const r = new Date(d); r.setMonth(r.getMonth() + dir); return r; });
    else setDate(d => addDays(d, dir * 7)); // upcoming
  };
  const jumpToToday = () => setDate(new Date());
  // Clicking a day in Week/Month drills into Today view for that day.
  const switchToDay = (d) => { setDate(d); setView('today'); };

  const todayIso = isoDate(new Date());
  const isViewingToday = view === 'today' ? isoDate(date) === todayIso : isoDate(date) <= todayIso;

  const headerLabel = view === 'today'
    ? date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
    : view === 'week'
      ? `Week of ${startOfWeek(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`
      : view === 'month'
        ? date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'Next 14 days';
  const headerSub = view === 'today'
    ? `${events.length} event${events.length !== 1 ? 's' : ''}${selectedTeam.length > 0 ? ` · ${selectedTeam.length} teammate${selectedTeam.length > 1 ? 's' : ''}` : ''}`
    : view === 'week'
      ? `Weekly overview${selectedTeam.length > 0 ? ` · ${selectedTeam.length} teammate${selectedTeam.length > 1 ? 's' : ''}` : ''}`
      : view === 'month'
        ? `Monthly planner${selectedTeam.length > 0 ? ` · ${selectedTeam.length} teammate${selectedTeam.length > 1 ? 's' : ''}` : ''}`
        : `Starting ${date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}${selectedTeam.length > 0 ? ` · ${selectedTeam.length} teammate${selectedTeam.length > 1 ? 's' : ''}` : ''}`;

  const refresh = () => { loadDay(date); loadAll(); };

  const quickComplete = async (ev) => {
    const id = ev._originalId || ev.id;
    try {
      await api.completeEvent(id);
      showToast('Event marked complete');
      refresh();
    } catch (err) { showToast(err.message || 'Failed to complete event', 'error'); }
  };

  // ── Undo-pattern deletes ──
  const deleteLeaveWithUndo = (leaveId) => {
    const prev = leaves;
    setLeaves(ls => ls.filter(l => l.id !== leaveId));
    showToast('Leave removed', {
      action: { label: 'Undo', onClick: () => setLeaves(prev) },
      onExpire: async () => {
        try { await api.deleteLeave(leaveId); }
        catch (err) { setLeaves(prev); showToast(err.message || 'Failed to remove leave', 'error'); }
      },
    });
  };

  const performEventDelete = (ev, _scope /* reserved for API once backend supports it */) => {
    const id = ev._originalId || ev.id;
    const prevRaw = rawEvents;
    const prevAll = allRawEvents;
    setRawEvents(es => es.filter(e => e.id !== id));
    setAllRawEvents(es => es.filter(e => e.id !== id));
    const isRecurring = !!ev.metadata?.recurrence;
    showToast(isRecurring ? 'Event series deleted' : 'Event deleted', {
      action: {
        label: 'Undo',
        onClick: () => { setRawEvents(prevRaw); setAllRawEvents(prevAll); },
      },
      onExpire: async () => {
        try { await api.deleteEvent(id); }
        catch (err) {
          setRawEvents(prevRaw); setAllRawEvents(prevAll);
          showToast(err.message || 'Failed to delete event', 'error');
        }
      },
    });
  };

  const deleteEventWithUndo = (ev) => {
    if (ev?.metadata?.recurrence) {
      // Ask scope before deleting
      setRecScope({ action: 'delete', event: ev });
      return;
    }
    performEventDelete(ev, 'this');
  };

  // ── Keyboard shortcuts (desktop) ──
  const onKey = useCallback((e) => {
    // Skip shortcuts when the user is typing in an input/textarea/contentEditable
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 't' || e.key === 'T') { e.preventDefault(); setDate(new Date()); }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); setAddOpen(true); }
    else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); setView('today'); }
    else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); setView('upcoming'); }
    else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); setView('week'); }
    else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setView('month'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); nav(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nav(1); }
  }, [view]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // Combined events for DayView: own + team
  const dayViewEvents = useMemo(() => (
    [...events, ...allEvents.filter(e => e._isTeam && eventLocalDate(e) === isoDate(date))]
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  ), [events, allEvents, date]);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between pt-1 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 relative">
            <button onClick={() => nav(-1)} aria-label="Previous" className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-white/5 transition">
              <ChevronLeft />
            </button>
            <button onClick={() => setDatePickerOpen(o => !o)} className="text-left hover:bg-white/5 px-2 py-1 rounded-lg transition">
              <h1 className="text-[20px] font-bold text-ink-900 tracking-tight flex items-center gap-1.5">
                {headerLabel}
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-ink-400"><polyline points="6 9 12 15 18 9"/></svg>
              </h1>
            </button>
            <button onClick={() => nav(1)} aria-label="Next" className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-white/5 transition">
              <ChevronRight />
            </button>
            {datePickerOpen && <DateJumpPicker date={date} onJump={(d) => setDate(d)} onClose={() => setDatePickerOpen(false)} />}
          </div>
          <p className="text-[12px] text-ink-400 mt-0.5 ml-0.5">
            {headerSub}
            {!isViewingToday && view === 'today' && (
              <button onClick={jumpToToday} className="text-brand-blue hover:underline ml-2">Jump to today</button>
            )}
          </p>
        </div>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} onOpenProfile={() => onSwitchTab?.('profile')} />
      </div>

      {/* Toolbar: view tabs + team + overflow + add */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Segmented view toggle */}
        <div className="inline-flex p-0.5 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {[{ id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' }].map(v => {
            const active = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className="px-3 h-8 rounded-md text-[12px] font-semibold transition"
                style={{
                  background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                  color: active ? '#F3F4F6' : '#9CA3AF',
                  border: active ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
                  boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                }}>
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Planning-mode chip — only visible when Week/Month is active */}
        {(view === 'week' || view === 'month') && (
          <span
            className="inline-flex items-center gap-1 pl-2.5 pr-1 h-8 rounded-[10px] text-[11px] font-semibold"
            style={{
              background: 'rgba(168,139,250,0.14)',
              color: '#C4B5FD',
              border: '1px solid rgba(168,139,250,0.28)',
            }}
          >
            {view === 'week' ? 'Week view' : 'Month view'}
            <button
              onClick={() => setView('today')}
              aria-label={`Exit ${view} view`}
              className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition"
            >
              <CloseIcon width="11" height="11" />
            </button>
          </span>
        )}

        <div className="flex-1" />

        <TeamToggle users={teamUsers} selected={selectedTeam} onToggle={toggleTeamMember} />
        <OverflowMenu
          onAddLeave={() => setLeaveOpen(true)}
          onJumpToday={jumpToToday}
          onShowWeek={() => setView('week')}
          onShowMonth={() => setView('month')}
        />

        <button
          onClick={() => setAddOpen(true)}
          className="h-9 px-3 rounded-[10px] text-[13px] font-semibold flex items-center gap-1.5 transition"
          style={{
            background: 'linear-gradient(135deg, rgba(91,140,255,0.22) 0%, rgba(91,140,255,0.10) 100%)',
            color: '#A8C4FF',
            border: '1px solid rgba(91,140,255,0.30)',
            boxShadow: '0 0 10px rgba(91,140,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
          aria-label="Add event">
          <PlusIcon width="14" height="14" /> Event
        </button>
      </div>

      {/* View body */}
      {view === 'today' && (
        <DayView
          events={dayViewEvents}
          leaves={leaves}
          date={date}
          onEventClick={setSelectedEvent}
          onDeleteLeave={deleteLeaveWithUndo}
          onQuickComplete={quickComplete}
        />
      )}
      {view === 'upcoming' && (
        <UpcomingView
          allEvents={allEvents}
          leaves={leaves}
          date={date}
          onEventClick={setSelectedEvent}
          onDeleteLeave={deleteLeaveWithUndo}
          onQuickComplete={quickComplete}
        />
      )}
      {view === 'week' && (
        <WeekView date={date} allEvents={allEvents} leaves={leaves} onDayClick={switchToDay} />
      )}
      {view === 'month' && (
        <MonthView date={date} allEvents={allEvents} leaves={leaves} onDayClick={switchToDay} />
      )}

      {/* Modals */}
      <AddEventModal open={addOpen} onClose={() => { setAddOpen(false); setPrefillTitle(''); }} onCreated={() => { refresh(); showToast('Event created'); }} date={isoDate(date)} prefillTitle={prefillTitle} />
      <AddLeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onCreated={() => { loadLeaves(); showToast('Leave added'); }} date={isoDate(date)} />

      {/* Unified event view/edit/actions modal */}
      <EventModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        onUpdated={() => { refresh(); showToast('Event updated'); }}
        onChanged={() => { refresh(); }}
        onRequestDelete={deleteEventWithUndo}
      />

      {/* Recurrence scope chooser */}
      <RecurrenceScopeDialog
        open={!!recScope}
        action={recScope?.action}
        onClose={() => setRecScope(null)}
        onChoose={(scope) => {
          const { event, action } = recScope;
          setRecScope(null);
          if (action === 'delete') performEventDelete(event, scope);
        }}
      />
    </div>
  );
}
