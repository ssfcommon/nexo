import React from 'react';
import { AlarmIcon, CalendarIcon } from './Icons.jsx';

// Shared pair of row-level actions used on Quick Tasks, project subtasks,
// and Home "This Week" cards. Deliberately compact so it fits inside busy
// rows without overwhelming them.
//
// Props:
//   item         — row (must have id, title, optionally alarm_at)
//   onSetAlarm   — (item) => void
//   onAddToCal   — (item) => void
//   size         — 'sm' (24px, for busy subtask rows) or 'md' (28–32px, default)
export default function RowActions({ item, onSetAlarm, onAddToCal, size = 'md' }) {
  const dim = size === 'sm' ? 24 : 28;
  const icon = size === 'sm' ? 12 : 14;
  const alarmOn = !!item?.alarm_at;

  const stopAnd = (fn) => (e) => { e.stopPropagation(); fn?.(item); };

  return (
    <>
      <button
        type="button"
        onClick={stopAnd(onSetAlarm)}
        aria-label={alarmOn ? `Change alarm for ${item?.title}` : `Set alarm for ${item?.title}`}
        title={alarmOn ? `Alarm: ${item.alarm_at} — click to change` : 'Set alarm'}
        className="rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 flex-shrink-0"
        style={{
          width: dim, height: dim,
          color: alarmOn ? '#F59E0B' : '#9CA3AF',
          background: alarmOn ? 'rgba(245,158,11,0.12)' : 'transparent',
          border: alarmOn ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => { if (!alarmOn) { e.currentTarget.style.color = '#F59E0B'; e.currentTarget.style.background = 'rgba(245,158,11,0.10)'; } }}
        onMouseLeave={(e) => { if (!alarmOn) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent'; } }}
      >
        <AlarmIcon width={icon} height={icon} />
      </button>
      <button
        type="button"
        onClick={stopAnd(onAddToCal)}
        aria-label={`Add ${item?.title} to calendar`}
        title="Add to calendar"
        className="rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 flex-shrink-0"
        style={{ width: dim, height: dim, color: '#9CA3AF' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#7EB0FF'; e.currentTarget.style.background = 'rgba(91,140,255,0.12)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent'; }}
      >
        <CalendarIcon width={icon} height={icon} />
      </button>
    </>
  );
}
