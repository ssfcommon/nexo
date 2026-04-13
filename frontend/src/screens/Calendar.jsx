import React, { useEffect, useState, useMemo } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { Avatar, AvatarStack, Pill } from '../components/ui.jsx';
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

// Distinct palette for team member events (avoids confusion with own event colors)
const TEAM_COLORS = ['#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#EAB308', '#6366F1'];
function teamColor(userId) { return TEAM_COLORS[(userId || 0) % TEAM_COLORS.length]; }

function accentFor(ev) {
  if (ev._isTeam) return teamColor(ev.owner_id);
  if (ev.event_type === 'personal') return '#9CA3AF';
  if (ev.priority === 'High') return '#F59E0B';
  if (ev.department === 'Operations') return '#22C55E';
  return '#4A6CF7';
}

// ── Recurrence helpers ──

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { value: 'custom', label: 'Custom…' },
];

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
  if (freq === 'daily') return rec.interval > 1 ? `Every ${rec.interval} days` : 'Daily';
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
  if (rec.interval && rec.interval > 1) return `Every ${rec.interval} ${rec.freq}s`;
  return null;
}

// ── Date Jump Picker (click header to jump to any date) ──
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
      <div className="absolute top-full left-0 mt-2 z-40 rounded-xl p-3 w-[280px]" style={{ background: 'rgba(17,24,39,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setViewMonth(d => { const r = new Date(d); r.setMonth(r.getMonth() - 1); return r; })} className="w-7 h-7 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"><ChevronLeft /></button>
          <span className="text-[13px] font-semibold text-ink-900">{viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setViewMonth(d => { const r = new Date(d); r.setMonth(r.getMonth() + 1); return r; })} className="w-7 h-7 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"><ChevronRight /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className="text-center text-[10px] text-ink-300 font-semibold py-1">{d}</div>)}
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
                  (isSelected ? 'bg-brand-blue text-white' : isToday ? 'bg-brand-blueLight text-brand-blue font-bold' : 'text-ink-700 hover:bg-ink-100')}>
                {d}
              </button>
            );
          })}
        </div>
        <button onClick={() => { onJump(new Date()); onClose(); }} className="w-full mt-2 h-8 rounded-lg text-[12px] text-brand-blue font-semibold hover:bg-brand-blueLight transition">Go to today</button>
      </div>
    </>
  );
}

/** Expand a single event's recurrence into occurrences within a date range */
function expandRecurrence(event, rangeStart, rangeEnd) {
  const rec = event.metadata?.recurrence;
  if (!rec) return [event];

  const freq = typeof rec === 'string' ? rec : rec.freq;
  const interval = rec.interval || 1;
  const until = rec.until ? new Date(rec.until) : null;
  const customDays = rec.days || []; // e.g., ['Mon', 'Wed', 'Fri']
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  const baseDate = new Date(event.start_time);
  const occurrences = [];
  const maxOccurrences = 365; // safety limit
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
        // Custom weekly: specific days
        const weekStart = startOfWeek(d);
        for (let i = 0; i < 7; i++) {
          const wd = addDays(weekStart, i);
          const dayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i];
          if (customDays.includes(dayName) && wd >= baseDate) {
            addOccurrence(wd);
          }
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
      // Repeat on nth weekday of month (e.g., "second Monday")
      const targetDow = DAY_NAMES.indexOf(rec.nthWeekdayDay); // 0=Sun...6=Sat
      let m = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      while (count < maxOccurrences) {
        // Find the nth occurrence of targetDow in this month
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
  if (view === 'Day') return [isoDate(date), isoDate(date)];
  if (view === 'Week') {
    const ws = startOfWeek(date);
    return [isoDate(ws), isoDate(addDays(ws, 6))];
  }
  if (view === 'Month') {
    const ms = startOfMonth(date);
    return [isoDate(ms), isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  }
  // Schedule: 14 days
  return [isoDate(date), isoDate(addDays(date, 13))];
}

// ── Custom Recurrence Modal ──
function CustomRecurrenceModal({ open, onClose, onSave, eventDate }) {
  const [freq, setFreq] = useState('weekly');
  const [interval, setInterval] = useState(1);
  const [days, setDays] = useState([]);
  const [monthMode, setMonthMode] = useState('date'); // 'date' | 'nthWeekday'
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

        {/* Weekly: day-of-week toggles */}
        {freq === 'weekly' && (
          <Field label="Repeat on">
            <div className="flex gap-1.5">
              {DAY_NAMES.map((d, i) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={'h-9 w-9 rounded-full text-[12px] font-semibold transition ' + (days.includes(d) ? 'bg-brand-blue text-white shadow-sm' : 'bg-ink-100 text-ink-500 hover:bg-ink-200')}>
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Monthly: date vs nth weekday */}
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

        {/* Yearly: month + day */}
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
          {!until && <p className="text-[11px] text-ink-300 mt-1">Leave blank to repeat forever</p>}
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

// ── Recurrence Picker (Google Calendar style — inline options per frequency) ──
function RecurrencePicker({ value, onChange, eventDate }) {
  const [customOpen, setCustomOpen] = useState(false);

  // Determine current selection for the dropdown
  const current = (() => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    // It's a custom object
    return 'custom';
  })();

  const evDate = eventDate ? new Date(eventDate + 'T00:00:00') : new Date();
  const dayName = DAY_NAMES[evDate.getDay()];
  const nthInfo = nthWeekdayLabel(evDate);

  // Build context-aware options like Google Calendar
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
    // Build smart default recurrence object
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
        {/* Show summary for custom recurrence */}
        {value && typeof value === 'object' && current === 'custom' && (
          <p className="text-[11px] text-brand-blue mt-1 flex items-center gap-1">
            <span>🔁</span>
            {recurrenceLabel(value)}{value.until ? ` · until ${value.until}` : ''}
          </p>
        )}
      </Field>

      {/* Inline day-of-week toggles when weekly is selected */}
      {value && typeof value === 'object' && (value.freq === 'weekly') && current !== 'custom' && (
        <div className="-mt-2 mb-3">
          <p className="text-[11px] text-ink-400 mb-1.5">Repeat on</p>
          <div className="flex gap-1.5">
            {DAY_NAMES.map((d, i) => (
              <button key={d} type="button" onClick={() => {
                const cur = value.days || [];
                const next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
                if (next.length === 0) return; // must have at least one day
                onChange({ ...value, days: next });
              }}
                className={'h-8 w-8 rounded-full text-[11px] font-semibold transition ' +
                  ((value.days || []).includes(d) ? 'bg-brand-blue text-white shadow-sm' : 'bg-ink-100 text-ink-500 hover:bg-ink-200')}>
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

// ── Modals ──
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
    }
    catch (err) { showToast(err.message || 'Failed to create event', 'error'); }
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
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const realEvent = event?._originalId ? { ...event, id: event._originalId } : event;

  useEffect(() => {
    if (open && event) {
      setTitle(event.title || '');
      const d = new Date(event.start_time);
      setDate(isoDate(d));
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setDuration(event.duration_min || 60);
      setRecurrence(event.metadata?.recurrence || null);
      setConfirmDelete(false);
    }
  }, [open, event]);

  const submit = async (e) => {
    e.preventDefault(); if (!title.trim() || !realEvent) return; setBusy(true);
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

  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteEvent(realEvent.id); onDeleted?.(); onClose(); }
    catch (err) { showToast(err.message || 'Failed to delete event', 'error'); }
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
        <RecurrencePicker value={recurrence} onChange={setRecurrence} eventDate={date} />
        {event.metadata?.recurrence && (
          <p className="text-[11px] text-ink-400 -mt-2 mb-3 flex items-center gap-1">
            <span>🔁</span> Changes apply to all occurrences of this event
          </p>
        )}
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60 mb-2">{busy ? 'Saving…' : 'Save Changes'}</button>
      </form>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="w-full h-10 rounded-[10px] text-[13px] text-danger font-medium hover:bg-[#FEF2F2]">Delete Event</button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 rounded-[10px] border border-line-light text-[13px] text-ink-500">Cancel</button>
          <button onClick={doDelete} disabled={busy} className="flex-1 h-10 rounded-[10px] bg-danger text-white text-[13px] font-semibold disabled:opacity-60">
            {event.metadata?.recurrence ? 'Delete All Occurrences' : 'Confirm Delete'}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Compact team calendar toggle ──
function TeamToggle({ users, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!users || users.length === 0) return null;
  const activeCount = selected.length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={'flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium transition border ' +
          (activeCount > 0 ? 'bg-brand-blue/10 border-brand-blue/30 text-brand-blue' : 'bg-white border-line-light text-ink-500 hover:bg-ink-50')}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Team{activeCount > 0 ? ` (${activeCount})` : ''}</span>
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={'transition ' + (open ? 'rotate-180' : '')}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-11 left-0 z-30 bg-white rounded-xl border border-line-light shadow-lg py-1.5 min-w-[200px]">
            <p className="px-3 py-1.5 text-[10px] text-ink-300 uppercase tracking-wide font-semibold">View teammate's calendar</p>
            {users.map(u => {
              const active = selected.includes(u.id);
              return (
                <button key={u.id} onClick={() => onToggle(u.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50 transition text-left">
                  <Avatar user={u} size={24} />
                  <span className="flex-1 text-[13px] text-ink-900">{u.name}</span>
                  <div className={'w-4 h-4 rounded border-2 flex items-center justify-center transition ' + (active ? 'bg-brand-blue border-brand-blue' : 'border-ink-200')}>
                    {active && <svg width="10" height="10" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
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

// ── Day view ──
function DayView({ events, leaves, date, onEventClick, onDeleteLeave }) {
  const iso = isoDate(date);
  const onLeave = leavesOnDate(leaves, iso);
  return (
    <div className="space-y-2">
      {onLeave.map(l => (
        <div key={l.id} className="flex items-center gap-2 rounded-[10px] px-3 py-2.5" style={{ backgroundColor: '#FEE2E2' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: l.avatar_color }}>{l.initials}</div>
          <span className="flex-1 text-[12px] text-ink-900">{l.name} — <span className="text-danger">On Leave ({l.type})</span></span>
          <button onClick={() => onDeleteLeave?.(l.id)} className="text-ink-300 hover:text-danger text-[11px]" title="Remove leave">✕</button>
        </div>
      ))}
      {events.length === 0 && onLeave.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[40px] mb-2">📅</p>
          <p className="text-ink-300 text-sm">No events scheduled</p>
          <p className="text-ink-300 text-[12px] mt-0.5">Tap "+ Event" to add one</p>
        </div>
      )}
      {events.map(ev => (
        <div key={ev.id} className={'flex gap-3 ' + (ev._isTeam ? '' : 'cursor-pointer')} onClick={() => !ev._isTeam && onEventClick?.(ev)}>
          <div className="w-14 pt-3 text-[12px] text-ink-400 flex-shrink-0 text-right">{fmtTime(ev.start_time)}</div>
          <div className={'flex-1 rounded-[12px] p-3.5 transition'}
            style={{
              background: ev._isTeam ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
              border: ev._isTeam ? '1px dashed rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.12)',
              borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: accentFor(ev),
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[14px] text-ink-900 flex-1">
                {ev.event_type === 'personal' ? '🔒 ' : ''}
                {ev._isTeam && ev._busyOnly ? 'Busy' : ev.title}
              </p>
              {ev.metadata?.recurrence && <span className="text-ink-300 text-[11px]" title={recurrenceLabel(ev.metadata.recurrence)}>🔁</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[11px] text-ink-500 flex-1">
                {ev._isTeam ? ev._teamName : (ev.department || (ev.event_type === 'personal' ? 'Personal' : ''))}
                {ev._isTeam ? '' : ` · ${ev.duration_min} min`}
              </p>
              {ev._isTeam && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px]" style={{ backgroundColor: ev._teamColor || '#9CA3AF' }}>
                  {ev._teamInitials}
                </div>
              )}
            </div>
            {ev.meet_link && <a href={ev.meet_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-block mt-2 pill bg-success text-white !h-7 !px-3 !text-[11px]">Join</a>}
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
    <div className="overflow-x-auto -mx-1">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-line-light sticky top-0 bg-page z-10">
          <div />
          {days.map(d => {
            const iso = isoDate(d);
            const isT = iso === today;
            const dayLeaves = leavesOnDate(leaves, iso);
            return (
              <button key={iso} onClick={() => onDayClick(d)} className={'text-center py-2.5 border-l border-line-light transition hover:bg-ink-50 ' + (isT ? 'bg-brand-blueLight' : dayLeaves.length ? 'bg-[#FEE2E2]' : '')}>
                <p className="text-[10px] text-ink-500 uppercase tracking-wide">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                <p className={'text-[18px] font-bold mt-0.5 ' + (isT ? 'text-brand-blue' : 'text-ink-900')}>{d.getDate()}</p>
                {dayLeaves.length > 0 && <p className="text-[8px] text-danger mt-0.5">{dayLeaves.map(l => l.initials).join(', ')}</p>}
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
                        style={{ backgroundColor: accentFor(ev), top: 1, minHeight: Math.max(20, (ev.duration_min / 60) * 56 - 4), opacity: ev._isTeam ? 0.7 : 1 }}>
                        {ev._isTeam && ev._busyOnly ? 'Busy' : ev.title}
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
          <div key={d} className="text-center text-[10px] text-ink-400 py-1.5 font-semibold uppercase tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} className="bg-page min-h-[80px]" />;
          const iso = isoDate(d);
          const dayEvents = allEvents.filter(e => eventLocalDate(e) === iso);
          const dayLeaves = leavesOnDate(leaves, iso);
          const isToday = iso === today;
          return (
            <button key={iso} onClick={() => onDayClick(d)}
              className={'min-h-[80px] p-1.5 text-left align-top transition ' + (isToday ? 'ring-2 ring-inset ring-brand-blue' : '')}
              style={{ background: dayLeaves.length ? 'rgba(239,68,68,0.12)' : '#0E1322' }}>
              <p className={'text-[12px] font-medium mb-0.5 ' + (isToday ? 'text-brand-blue font-bold' : 'text-ink-900')}>{d.getDate()}</p>
              {dayLeaves.map(l => (
                <div key={l.id} className="text-[9px] text-danger bg-[#FEE2E2] rounded px-1 py-px mb-0.5 truncate">{l.initials} {l.type}</div>
              ))}
              {dayEvents.slice(0, 2).map(ev => (
                <div key={ev.id} className={'text-[9px] rounded px-1 py-px mb-0.5 truncate text-white ' + (ev._isTeam ? 'opacity-70' : '')} style={{ backgroundColor: accentFor(ev) }}>
                  {fmtTime(ev.start_time)} {ev._isTeam && ev._busyOnly ? 'Busy' : ev.title}
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
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i));
  const daysWithContent = days.filter(d => {
    const iso = isoDate(d);
    return allEvents.some(e => eventLocalDate(e) === iso) || leavesOnDate(leaves, iso).length > 0;
  });

  if (daysWithContent.length === 0) return (
    <div className="text-center py-12">
      <p className="text-[40px] mb-2">📋</p>
      <p className="text-ink-300 text-sm">No events in the next 14 days</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {daysWithContent.map(d => {
        const iso = isoDate(d);
        const dayEvents = allEvents.filter(e => eventLocalDate(e) === iso);
        const dayLeaves = leavesOnDate(leaves, iso);
        const isToday = iso === isoDate(new Date());
        return (
          <div key={iso}>
            <div className="flex items-center gap-2 mb-2.5">
              {isToday && <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />}
              <p className={'text-[13px] font-semibold ' + (isToday ? 'text-brand-blue' : 'text-ink-900')}>
                {d.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
                {isToday && <span className="text-[11px] font-normal text-brand-blue/60 ml-1.5">Today</span>}
              </p>
            </div>
            <div className="space-y-1.5 ml-4">
              {dayLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-2 rounded-[8px] px-3 py-2.5" style={{ backgroundColor: '#FEE2E2' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px]" style={{ backgroundColor: l.avatar_color }}>{l.initials}</div>
                  <span className="text-[12px] text-ink-900">{l.name} — <span className="text-danger">{l.type}</span></span>
                </div>
              ))}
              {dayEvents.map(ev => (
                <div key={ev.id} onClick={() => !ev._isTeam && onEventClick?.(ev)}
                  className={'flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition ' + (ev._isTeam ? 'opacity-80' : 'cursor-pointer')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(16px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                  <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: accentFor(ev) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-ink-900 truncate">{ev._isTeam && ev._busyOnly ? 'Busy' : ev.title}</p>
                      {ev.metadata?.recurrence && <span className="text-[10px] text-ink-300">🔁</span>}
                    </div>
                    <p className="text-[11px] text-ink-500">
                      {fmtTime(ev.start_time)} · {ev.duration_min} min
                      {ev._isTeam ? ` · ${ev._teamName}` : ev.department ? ` · ${ev.department}` : ''}
                    </p>
                  </div>
                  {ev._isTeam && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px]" style={{ backgroundColor: ev._teamColor || '#9CA3AF' }}>
                      {ev._teamInitials}
                    </div>
                  )}
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
export default function Calendar({ me, unreadCount, onOpenNotifications, onSwitchTab, deepLink }) {
  const showToast = useToast();
  const [view, setView] = useState('Day');
  const [date, setDate] = useState(new Date());
  const [rawEvents, setRawEvents] = useState([]);
  const [allRawEvents, setAllRawEvents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [deleteLeaveId, setDeleteLeaveId] = useState(null);
  const [prevView, setPrevView] = useState(null);
  const [prefillTitle, setPrefillTitle] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Team calendar state
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

  // Load team events when team members are selected
  useEffect(() => {
    if (selectedTeam.length === 0) { setTeamRawEvents([]); return; }
    api.teamEvents().then(evts => {
      const filtered = evts.filter(e => selectedTeam.includes(e.owner_id) && e.owner_id !== me?.id);
      setTeamRawEvents(filtered);
    });
  }, [selectedTeam, me?.id]);

  const toggleTeamMember = (uid) => {
    setSelectedTeam(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  // Expand recurring events
  const [rangeStart, rangeEnd] = getExpandRange(view, date);

  const events = useMemo(() => {
    const expanded = rawEvents.flatMap(e => expandRecurrence(e, rangeStart, rangeEnd));
    return expanded.filter(e => eventLocalDate(e) === isoDate(date));
  }, [rawEvents, rangeStart, rangeEnd, date]);

  const allEvents = useMemo(() => {
    const ownExpanded = allRawEvents.flatMap(e => expandRecurrence(e, rangeStart, rangeEnd));
    // Merge team events
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

  // View-aware "today" check — for week view, check if today falls within displayed week
  const todayIso = isoDate(new Date());
  const isViewingToday = (() => {
    if (view === 'Day') return isoDate(date) === todayIso;
    if (view === 'Week') {
      const ws = startOfWeek(date);
      return todayIso >= isoDate(ws) && todayIso <= isoDate(addDays(ws, 6));
    }
    if (view === 'Month') return date.getFullYear() === new Date().getFullYear() && date.getMonth() === new Date().getMonth();
    return isoDate(date) === todayIso; // Schedule
  })();

  const headerLabel = view === 'Month' ? date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : view === 'Week' ? `Week of ${addDays(startOfWeek(date), 0).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`
    : view === 'Schedule' ? 'Schedule'
    : date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const refresh = () => { loadDay(date); loadAll(); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 relative">
            {view === 'Day' && prevView && (
              <button onClick={() => { setView(prevView); setPrevView(null); }} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA] transition"><ArrowLeft /></button>
            )}
            <button onClick={() => nav(-1)} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA] transition"><ChevronLeft /></button>
            <button onClick={() => setDatePickerOpen(o => !o)} className="text-left hover:bg-ink-50 px-2 py-1 -mx-2 rounded-lg transition">
              <h1 className="text-[20px] font-bold text-ink-900 tracking-tight flex items-center gap-1.5">
                {headerLabel}
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-ink-300"><polyline points="6 9 12 15 18 9"/></svg>
              </h1>
            </button>
            <button onClick={() => nav(1)} className="w-8 h-8 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-[#F7F8FA] transition"><ChevronRight /></button>
            {datePickerOpen && <DateJumpPicker date={date} onJump={(d) => setDate(d)} onClose={() => setDatePickerOpen(false)} />}
          </div>
          <p className="text-[12px] text-ink-400 mt-0.5 ml-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''}{view === 'Day' ? ' today' : ''}
            {selectedTeam.length > 0 && <span className="text-brand-blue"> · {selectedTeam.length} teammate{selectedTeam.length > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} onOpenProfile={() => onSwitchTab?.('profile')} />
      </div>

      {/* View toggle + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {['Day', 'Week', 'Month', 'Schedule'].map(v => (
          <Pill key={v} active={view === v} onClick={() => { setView(v); setPrevView(null); }}>{v}</Pill>
        ))}
        <div className="flex-1" />
        {!isViewingToday && (
          <button onClick={() => setDate(new Date())} className="pill pill-outline !h-9 !px-3 !text-[12px] !text-brand-blue !border-brand-blue/30 hover:!bg-brand-blueLight transition">Today</button>
        )}
        {teamUsers.length > 0 && <TeamToggle users={teamUsers} selected={selectedTeam} onToggle={toggleTeamMember} />}
        <button onClick={() => setLeaveOpen(true)} className="pill pill-outline !h-9 !px-3 !text-[12px]">🏖️ Leave</button>
        <button onClick={() => setAddOpen(true)} className="pill pill-primary !h-9 !px-3 !text-[12px]">+ Event</button>
      </div>

      {/* View body */}
      {view === 'Day' && <DayView events={[...events, ...allEvents.filter(e => e._isTeam && eventLocalDate(e) === isoDate(date))].sort((a,b) => a.start_time.localeCompare(b.start_time))} leaves={leaves} date={date} onEventClick={setEditEvent} onDeleteLeave={setDeleteLeaveId} />}
      {view === 'Week' && <WeekView date={date} allEvents={allEvents} leaves={leaves} onDayClick={switchToDay} />}
      {view === 'Month' && <MonthView date={date} allEvents={allEvents} leaves={leaves} onDayClick={switchToDay} />}
      {view === 'Schedule' && <ScheduleView allEvents={allEvents} leaves={leaves} date={date} onEventClick={setEditEvent} />}

      <AddEventModal open={addOpen} onClose={() => { setAddOpen(false); setPrefillTitle(''); }} onCreated={() => { refresh(); showToast('Event created'); }} date={isoDate(date)} prefillTitle={prefillTitle} />
      <AddLeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onCreated={() => { loadLeaves(); showToast('Leave added'); }} date={isoDate(date)} />
      <ConfirmModal
        open={!!deleteLeaveId}
        onClose={() => setDeleteLeaveId(null)}
        title="Remove Leave"
        message="Are you sure you want to remove this leave entry?"
        onConfirm={async () => {
          try {
            await api.deleteLeave(deleteLeaveId);
            setDeleteLeaveId(null);
            loadLeaves();
            showToast('Leave removed');
          } catch (err) { showToast(err.message || 'Failed to remove leave', 'error'); setDeleteLeaveId(null); }
        }}
      />
      <EditEventModal open={!!editEvent} onClose={() => setEditEvent(null)} event={editEvent}
        onUpdated={() => { refresh(); showToast('Event updated'); }}
        onDeleted={() => { refresh(); showToast('Event deleted'); }}
      />
    </div>
  );
}
