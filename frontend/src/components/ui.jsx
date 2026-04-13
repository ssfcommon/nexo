import React from 'react';
import { ASSET_ORIGIN } from '../api.js';

// ─── Avatar ───
export function Avatar({ user, size = 32 }) {
  if (!user) return null;
  const url = user.avatar_url || user.owner_avatar || user.author_avatar;
  if (url) {
    const src = url.startsWith('http') ? url : ASSET_ORIGIN + url;
    return (
      <img
        src={src}
        alt={user.name || ''}
        title={user.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: user.avatar_color || '#6B7280', fontSize: size * 0.36, letterSpacing: '-0.02em' }}
      title={user.name}
    >
      {user.initials}
    </div>
  );
}

// ─── Avatar Stack ───
export function AvatarStack({ users = [], max = 2, size = 28 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map(u => (
        <div key={u.id} className="ring-2 ring-white rounded-full">
          <Avatar user={u} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="ring-2 ring-white rounded-full bg-ink-100 text-ink-500 font-semibold flex items-center justify-center"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── Constants ───
export const PRIORITIES = [
  'Urgent & Important',
  'Urgent & Not Important',
  'Not Urgent but Important',
  'Not Urgent, Not Important',
];
export const COMPLEXITIES = ['High Complex', 'Low Complex'];

// ─── Priority Tag ───
export function PriorityTag({ priority }) {
  const map = {
    'Urgent & Important':        { fg: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    'Urgent & Not Important':    { fg: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    'Not Urgent but Important':  { fg: '#4A6CF7', bg: 'rgba(74,108,247,0.08)' },
    'Not Urgent, Not Important': { fg: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    Critical: { fg: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    High:     { fg: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    Medium:   { fg: '#4A6CF7', bg: 'rgba(74,108,247,0.08)' },
    Low:      { fg: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  };
  const c = map[priority] || { fg: '#6B7280', bg: 'rgba(107,114,128,0.08)' };
  const short = priority?.replace('Urgent & ', 'U/').replace('Not Urgent but ', '!U/').replace('Not Urgent, Not ', '!U/!') || priority;
  return (
    <span className="tag" style={{ color: c.fg, backgroundColor: c.bg }} title={priority}>{short}</span>
  );
}

// ─── Progress Bar ───
export function ProgressBar({ percent, color = '#4A6CF7' }) {
  return (
    <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${percent}%`, backgroundColor: color, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </div>
  );
}

// ─── Section Header ───
export function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-sm text-brand-blue font-medium hover:text-brand-blueDark transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}

// ─── Pill ───
export function Pill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'pill ' +
        (active
          ? 'bg-brand-blue text-white shadow-xs'
          : 'bg-white text-ink-500 border border-line-medium hover:bg-ink-50 hover:text-ink-700')
      }
    >
      {children}
    </button>
  );
}

// ─── Department Dot Color ───
export function deptDotColor(dept) {
  if (dept === 'Operations') return '#10B981';
  if (dept === "CEO's Office") return '#4A6CF7';
  return '#9CA3AF';
}
