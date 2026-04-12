import React from 'react';

export function Skeleton({ className = '', width, height }) {
  return (
    <div
      className={'rounded-md bg-[#E5E7EB] skeleton-shimmer ' + className}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="card space-y-2">
      <Skeleton height={16} width="60%" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${70 - i * 10}%`} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-[14px] font-semibold text-ink-900">{title}</p>
      {subtitle && <p className="text-[12px] text-ink-500 mt-1">{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
