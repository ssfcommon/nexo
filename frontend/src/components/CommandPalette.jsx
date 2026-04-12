import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function CommandPalette({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults(null);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (!q.trim()) { setResults(null); return; }
    const id = setTimeout(() => {
      api.search(q).then(r => { setResults(r); setActive(0); }).catch(() => setResults(null));
    }, 180);
    return () => clearTimeout(id);
  }, [q, open]);

  const flat = results ? [
    ...results.projects.map(p => ({ kind: 'project', id: p.id, title: p.title, sub: p.department, projectId: p.id })),
    ...results.subtasks.map(s => ({ kind: 'subtask', id: 's' + s.id, title: s.title, sub: s.project_title, projectId: s.project_id })),
    ...results.tasks.map(t => ({ kind: 'task', id: 't' + t.id, title: t.title, sub: t.is_quick ? 'Quick task' : 'Task' })),
    ...results.comments.map(c => ({ kind: 'comment', id: 'c' + c.id, title: c.body.slice(0, 60), sub: `${c.author} · ${c.project_title}`, projectId: c.project_id })),
  ] : [];

  const select = (item) => {
    if (item.projectId) onNavigate?.({ tab: 'projects', projectId: item.projectId });
    else if (item.kind === 'task') onNavigate?.({ tab: 'projects' });
    setOpen(false);
  };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); select(flat[active]); }
  };

  if (!open) return null;

  const kindIcons = { project: '📁', subtask: '✓', task: '📝', comment: '💬' };
  const kindColors = { project: '#4A6CF7', subtask: '#22C55E', task: '#F59E0B', comment: '#8B5CF6' };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[560px] bg-white rounded-[14px] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line-light">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-ink-300 flex-shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search projects, tasks, comments…"
            className="flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-300"
          />
          <kbd className="text-[10px] text-ink-300 border border-line-light rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {!q.trim() && (
            <div className="p-6 text-center text-[13px] text-ink-500">
              <p>Search everything in your workspace.</p>
              <p className="text-ink-300 mt-1">Projects · Subtasks · Tasks · Comments</p>
            </div>
          )}
          {q.trim() && flat.length === 0 && results !== null && (
            <div className="p-6 text-center text-[13px] text-ink-500">No matches for "{q}"</div>
          )}
          {flat.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => select(item)}
              className={'w-full flex items-center gap-3 px-4 py-3 text-left ' + (i === active ? 'bg-[#F7F8FA]' : '')}
            >
              <span
                className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white text-[13px] flex-shrink-0"
                style={{ backgroundColor: kindColors[item.kind] }}
              >
                {kindIcons[item.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-ink-900 truncate">{item.title}</p>
                {item.sub && <p className="text-[11px] text-ink-500 truncate">{item.sub}</p>}
              </div>
              <span className="text-[10px] text-ink-300 uppercase flex-shrink-0">{item.kind}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 h-9 border-t border-line-light text-[11px] text-ink-300 bg-[#FAFBFC]">
          <span><kbd className="border border-line-light rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-line-light rounded px-1">↵</kbd> open</span>
          <span><kbd className="border border-line-light rounded px-1">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
