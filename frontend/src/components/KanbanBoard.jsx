import React, { useState } from 'react';
import { Avatar } from './ui.jsx';

const COLUMNS = [
  { id: 'pending',     title: 'Todo',        color: '#9CA3AF' },
  { id: 'in_progress', title: 'In Progress', color: '#4A6CF7' },
  { id: 'done',        title: 'Done',        color: '#22C55E' },
];

// Normalize legacy subtask statuses into the 3 kanban buckets.
function bucket(s) {
  if (s.status === 'done') return 'done';
  if (s.status === 'in_progress') return 'in_progress';
  return 'pending';
}

export default function KanbanBoard({ subtasks, onMove }) {
  const [dragging, setDragging] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  const byCol = COLUMNS.reduce((acc, c) => ({ ...acc, [c.id]: [] }), {});
  subtasks.forEach(s => { byCol[bucket(s)].push(s); });

  const onDragStart = (s) => (e) => {
    setDragging(s);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(s.id));
  };
  const onDragOver = (colId) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoverCol !== colId) setHoverCol(colId);
  };
  const onDrop = (colId) => (e) => {
    e.preventDefault();
    setHoverCol(null);
    if (dragging && bucket(dragging) !== colId) {
      onMove?.(dragging, colId);
    }
    setDragging(null);
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {COLUMNS.map(col => (
        <div
          key={col.id}
          onDragOver={onDragOver(col.id)}
          onDragLeave={() => hoverCol === col.id && setHoverCol(null)}
          onDrop={onDrop(col.id)}
          className={'rounded-card border border-line-light p-2 min-h-[160px] transition ' + (hoverCol === col.id ? 'bg-brand-blueLight' : 'bg-[#FAFBFC]')}
        >
          <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-line-light">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
            <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">{col.title}</span>
            <span className="ml-auto text-[11px] text-ink-300">{byCol[col.id].length}</span>
          </div>
          <div className="space-y-2">
            {byCol[col.id].map(s => (
              <div
                key={s.id}
                draggable
                onDragStart={onDragStart(s)}
                className={'bg-white rounded-[8px] border border-line-light p-2 cursor-grab active:cursor-grabbing ' +
                  (dragging?.id === s.id ? 'opacity-50' : '')}
              >
                <p className={'text-[12px] leading-snug ' + (col.id === 'done' ? 'line-through text-ink-300' : 'text-ink-900')}>
                  {s.title}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  {s.deadline ? (
                    <span className="text-[10px] text-ink-500">
                      {new Date(s.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ) : <span />}
                  {s.owner_initials && (
                    <Avatar
                      user={{ initials: s.owner_initials, avatar_color: s.owner_color, name: s.owner_name }}
                      size={20}
                    />
                  )}
                </div>
              </div>
            ))}
            {byCol[col.id].length === 0 && (
              <p className="text-[11px] text-ink-300 text-center py-4">Drop here</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
