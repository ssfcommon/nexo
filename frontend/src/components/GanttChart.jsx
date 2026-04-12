import React from 'react';

function parseDate(s) { return s ? new Date(s + 'T00:00:00') : null; }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function fmtMonth(d) { return d.toLocaleDateString('en-US', { month: 'short' }); }

export default function GanttChart({ projectStart, projectEnd, subtasks }) {
  // Build a stable span that contains everything
  const allDates = [
    parseDate(projectStart),
    parseDate(projectEnd),
    ...subtasks.map(s => parseDate(s.deadline)).filter(Boolean),
  ].filter(Boolean);

  if (allDates.length < 2) {
    return (
      <div className="card text-center py-6 text-[13px] text-ink-300">
        Add deadlines to subtasks to see the timeline view.
      </div>
    );
  }

  const min = new Date(Math.min(...allDates));
  const max = new Date(Math.max(...allDates));
  // Pad by 2 days on each side
  min.setDate(min.getDate() - 2);
  max.setDate(max.getDate() + 2);
  const total = daysBetween(min, max) || 1;

  const now = new Date();
  const todayX = (daysBetween(min, now) / total) * 100;

  // Month markers
  const markers = [];
  const cursor = new Date(min);
  cursor.setDate(1);
  while (cursor <= max) {
    const x = (daysBetween(min, cursor) / total) * 100;
    if (x >= 0 && x <= 100) markers.push({ x, label: fmtMonth(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const rows = subtasks
    .filter(s => s.deadline)
    .slice()
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1));

  return (
    <div className="card !p-3 space-y-2">
      {/* Axis */}
      <div className="relative h-5 border-b border-line-light mb-1">
        {markers.map((m, i) => (
          <div key={i} className="absolute top-0 h-full border-l border-line-light pl-1 text-[10px] text-ink-300" style={{ left: m.x + '%' }}>
            {m.label}
          </div>
        ))}
        {todayX >= 0 && todayX <= 100 && (
          <div className="absolute top-0 h-full border-l-2 border-danger" style={{ left: todayX + '%' }} title="Today" />
        )}
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {rows.map(s => {
          const end = parseDate(s.deadline);
          const start = new Date(end);
          start.setDate(start.getDate() - 3); // visual duration bar: 3 days by default
          const left = Math.max(0, (daysBetween(min, start) / total) * 100);
          const width = Math.max(2, (daysBetween(start, end) / total) * 100);
          const color = s.status === 'done' ? '#22C55E' :
                        end < now ? '#EF4444' :
                        s.status === 'in_progress' ? '#4A6CF7' : '#9CA3AF';
          return (
            <div key={s.id} className="relative h-6 flex items-center">
              <span className="absolute left-0 top-0 text-[11px] text-ink-900 truncate pr-2" style={{ width: '35%' }}>
                {s.title}
              </span>
              <div className="absolute top-1.5 h-3 rounded-full" style={{ left: 'calc(35% + ' + left + '%)', width: width + '%', maxWidth: 'calc(65% - ' + left + '%)', backgroundColor: color }} />
            </div>
          );
        })}
      </div>

      {/* Today marker fallback */}
      {todayX > 100 && <p className="text-[10px] text-ink-300 text-right">Today is past the project window.</p>}
    </div>
  );
}
