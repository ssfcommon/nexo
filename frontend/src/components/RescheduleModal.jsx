import React, { useEffect, useState } from 'react';
import Modal, { Field, inputCls } from './Modal.jsx';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { CheckIcon } from './Icons.jsx';

// Reschedule modal — change a task or subtask's deadline from the row
// kebab without opening the full edit form. Mirrors AlarmModal in
// shape (date input + presets + clear) so the surface stays familiar.
//
// Presets are recomputed each open so "Today" stays accurate across
// midnight; "This Friday"/"Next week" are de-duped if today happens
// to be Friday (same trick used in QuickTaskModal's date panel).
//
// Props:
//   open      — boolean
//   item      — row { id, title, deadline?, kind? }
//   kind      — 'task' | 'subtask'   (defaults to 'task')
//   onClose   — close handler
//   onSaved   — (newDeadlineIso | null) => void  fired after save/clear
export default function RescheduleModal({ open, item, kind = 'task', onClose, onSaved }) {
  const showToast = useToast();
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(item?.deadline || new Date().toISOString().slice(0, 10));
  }, [open, item]);

  // Same preset construction as the Quick-task modal — kept in sync so
  // users see one mental model for "what counts as Friday/next week".
  const presets = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const offset = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const now = new Date();
    const daysToFri = (5 - now.getDay() + 7) % 7 || 7;
    const raw = [
      { label: 'Today',       value: today },
      { label: 'Tomorrow',    value: offset(1) },
      { label: 'This Friday', value: offset(daysToFri) },
      { label: 'Next week',   value: offset(7) },
    ];
    const seen = new Set();
    return raw.filter(p => (seen.has(p.value) ? false : (seen.add(p.value), true)));
  })();

  const save = async (e) => {
    e?.preventDefault?.();
    if (!date) { showToast('Pick a date', 'warning'); return; }
    if (date === item?.deadline) { onClose?.(); return; }
    setBusy(true);
    try {
      if (kind === 'subtask') {
        await api.updateSubtask(item.id, { deadline: date });
      } else {
        await api.updateTask(item.id, { deadline: date });
      }
      onSaved?.(date);
      showToast('Deadline updated');
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Could not reschedule', 'error');
    } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      if (kind === 'subtask') {
        await api.updateSubtask(item.id, { deadline: null });
      } else {
        await api.updateTask(item.id, { deadline: null });
      }
      onSaved?.(null);
      showToast('Deadline cleared');
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Could not clear deadline', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reschedule">
      <form onSubmit={save} className="space-y-3">
        <p className="text-[13px] mb-1" style={{ color: '#9CA3AF' }}>
          Move <span className="font-semibold" style={{ color: '#E5E7EB' }}>{item?.title}</span>
        </p>

        {/* Preset row — most reschedules are "push to tomorrow" or
            "Friday", so surfacing those as one-tap chips beats the
            native date picker for the common case. */}
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map(p => {
            const active = date === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setDate(p.value)}
                className="h-10 px-3 rounded-[10px] text-[13px] font-medium flex items-center justify-between gap-2 transition-all active:scale-[0.98]"
                style={{
                  background: active ? 'rgba(91,140,255,0.14)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#A8C4FF' : '#D1D5DB',
                  border: `1px solid ${active ? 'rgba(91,140,255,0.28)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <span>{p.label}</span>
                {active && <CheckIcon width="12" height="12" />}
              </button>
            );
          })}
        </div>

        <Field label="Or pick a date">
          <input
            type="date"
            className={inputCls}
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </Field>

        <div className="flex gap-2 pt-1">
          {item?.deadline && (
            <button
              type="button"
              disabled={busy}
              onClick={clear}
              className="h-10 px-4 rounded-[10px] text-[13px] font-semibold border"
              style={{ background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.30)', color: '#F87171' }}
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 h-10 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Reschedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
