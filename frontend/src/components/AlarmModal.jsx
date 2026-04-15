import React, { useEffect, useState } from 'react';
import Modal, { Field, inputCls } from './Modal.jsx';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

// Shared modal for setting / clearing a personal alarm on a task or subtask.
// Splits date + time so mobile keyboards are friendlier and empty state is
// explicit. Used from Quick Tasks (Projects screen), project subtasks
// (ProjectDetail), and the Home "This Week" feed.
//
// Props:
//   open        — boolean
//   item        — the row (must have id, title, optionally alarm_at, deadline)
//   kind        — 'task' | 'subtask'  (defaults to 'task')
//   onClose     — close handler
//   onSaved     — (alarmIso | null) => void  (called after save or clear)
export default function AlarmModal({ open, item, kind = 'task', onClose, onSaved }) {
  const showToast = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Seed with existing alarm, or the row's deadline @ 9am as a sensible default.
    if (item?.alarm_at) {
      const [d, t] = item.alarm_at.split(/[ T]/);
      setDate(d || '');
      setTime((t || '09:00').slice(0, 5));
    } else {
      setDate(item?.deadline || new Date().toISOString().slice(0, 10));
      setTime('09:00');
    }
  }, [open, item]);

  const save = async (e) => {
    e?.preventDefault?.();
    if (!date) { showToast('Pick a date', 'warning'); return; }
    const ts = `${date} ${time || '09:00'}`;
    setBusy(true);
    try {
      await api.setAlarm(item.id, ts, kind);
      onSaved?.(ts);
      showToast(`Alarm set for ${date} ${time}`);
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Could not set alarm', 'error');
    } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await api.setAlarm(item.id, null, kind);
      onSaved?.(null);
      showToast('Alarm cleared');
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Could not clear alarm', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Set Alarm">
      <form onSubmit={save} className="space-y-3">
        <p className="text-[13px] mb-1" style={{ color: '#9CA3AF' }}>
          Remind me about <span className="font-semibold" style={{ color: '#E5E7EB' }}>{item?.title}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required />
          </Field>
          <Field label="Time">
            <input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} required />
          </Field>
        </div>
        <div className="flex gap-2 pt-1">
          {item?.alarm_at && (
            <button type="button" disabled={busy} onClick={clear}
              className="h-10 px-4 rounded-[10px] text-[13px] font-semibold border"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#F87171' }}>
              Clear
            </button>
          )}
          <button type="submit" disabled={busy}
            className="flex-1 h-10 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">
            {busy ? 'Saving…' : 'Set Alarm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
