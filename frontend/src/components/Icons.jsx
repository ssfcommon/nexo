import React from 'react';

// Consistent 20x20 stroke-based SVG icons. Pass className for color overrides.
const s = { strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', stroke: 'currentColor' };

export const HomeIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
export const FolderIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
);
export const CalendarIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
export const UserIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
export const BellIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
export const SearchIcon = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
export const ChevronLeft = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s} {...p}><polyline points="15 18 9 12 15 6"/></svg>
);
export const ChevronRight = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s} {...p}><polyline points="9 18 15 12 9 6"/></svg>
);
export const ArrowLeft = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s} {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
export const PlusIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s} {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
export const AlarmIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 14"/><line x1="5" y1="3" x2="2" y2="6"/><line x1="19" y1="3" x2="22" y2="6"/></svg>
);
export const UmbrellaIcon = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
