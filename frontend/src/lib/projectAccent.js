// ─── Project identity + momentum + urgency ──────────────────────────
// Every project gets:
//   • an accent colour (12-palette) and emoji — stored in metadata,
//     deterministic hash-fallback for legacy projects.
//   • a momentum state derived from progress + updated_at.
//   • an urgency state derived from deadline.
//
// All computed client-side. No API changes, no migrations.

// ─── 12-colour palette ──────────────────────────────────────────────
// Muted enough to live in dark UI, saturated enough to feel alive.
// Each entry: { from, to, solid, glow }.
//   from/to → card accent bar gradient, emoji badge halo
//   solid   → chip text, ring stroke
//   glow    → soft outer glow on the emoji badge

export const ACCENT_PALETTE = {
  coral:   { from: '#FF7A6B', to: '#FF4D6D', solid: '#FF6378', glow: 'rgba(255,99,120,0.22)' },
  amber:   { from: '#FFB547', to: '#FF7A33', solid: '#FF973D', glow: 'rgba(255,151,61,0.22)' },
  mango:   { from: '#FFD166', to: '#EF8354', solid: '#F5A05D', glow: 'rgba(245,160,93,0.22)' },
  lime:    { from: '#A7E05A', to: '#68C72E', solid: '#8AD544', glow: 'rgba(138,213,68,0.22)' },
  emerald: { from: '#5EE3A0', to: '#10B981', solid: '#34D08D', glow: 'rgba(52,208,141,0.22)' },
  teal:    { from: '#4FD1C5', to: '#0891B2', solid: '#2AB2B8', glow: 'rgba(42,178,184,0.22)' },
  sky:     { from: '#7DD3FC', to: '#3B82F6', solid: '#5BAAF9', glow: 'rgba(91,170,249,0.22)' },
  indigo:  { from: '#8A8FFF', to: '#6366F1', solid: '#7478FA', glow: 'rgba(116,120,250,0.22)' },
  violet:  { from: '#C084FC', to: '#8B5CF6', solid: '#A574FA', glow: 'rgba(165,116,250,0.22)' },
  pink:    { from: '#F0ABFC', to: '#D946EF', solid: '#E37AF6', glow: 'rgba(227,122,246,0.22)' },
  rose:    { from: '#FDA4AF', to: '#F43F5E', solid: '#F87188', glow: 'rgba(248,113,136,0.22)' },
  slate:   { from: '#94A3B8', to: '#64748B', solid: '#7B8AA0', glow: 'rgba(123,138,160,0.18)' },
};

export const ACCENT_KEYS = Object.keys(ACCENT_PALETTE);

// ─── Hash fallback ──────────────────────────────────────────────────
// Legacy projects without metadata.accent still need to look alive on
// first render. Deterministic: the same title always maps to the same
// colour, so opening the app doesn't shuffle colours between sessions.

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getProjectAccent(project) {
  const key = project?.metadata?.accent;
  if (key && ACCENT_PALETTE[key]) return { key, ...ACCENT_PALETTE[key] };
  // Hash-assigned fallback. Uses the title so colours stay stable.
  const fallbackKey = ACCENT_KEYS[hashString(project?.title || 'project') % ACCENT_KEYS.length];
  return { key: fallbackKey, ...ACCENT_PALETTE[fallbackKey] };
}

// ─── Emoji ──────────────────────────────────────────────────────────
// Default to a neutral work emoji. 24-emoji curated grid lives in the
// create modal — resist growing this list; decision fatigue is the
// enemy.

export const DEFAULT_EMOJI = '📁';

export const EMOJI_CHOICES = [
  '🚀', '📱', '💻', '📊',
  '🎨', '📝', '🔧', '⚙️',
  '🎯', '🧪', '🧩', '🌱',
  '🔥', '💡', '📦', '🎬',
  '📚', '✏️', '🖼', '🎼',
  '🧠', '🛠', '📈', '✨',
];

export function getProjectEmoji(project) {
  return project?.metadata?.emoji || DEFAULT_EMOJI;
}

// ─── Momentum ───────────────────────────────────────────────────────
// Derived from progress + updated_at. Cheap, no extra fetches.
//
//   all-clear → progress === 100 (regardless of activity)
//   on-fire   → active within 3d, progress > 0 and < 100
//   building  → active within 14d, progress > 0 and < 100
//   quiet     → everything else (stale, or 0 progress)
//
// We chose 3d / 14d windows so "on-fire" genuinely means active this
// week — otherwise everything glows and the signal is noise.

const DAY_MS = 86400000;

export function getMomentum(project) {
  const progress = Number(project?.progress ?? 0);
  if (progress >= 100) {
    return { state: 'clear', emoji: '✨', label: 'All clear', chipColor: '#34D08D', chipBg: 'rgba(52,208,141,0.12)' };
  }
  const updated = project?.updated_at ? new Date(project.updated_at).getTime() : 0;
  const daysSince = updated ? (Date.now() - updated) / DAY_MS : Infinity;

  if (progress > 0 && daysSince <= 3) {
    return { state: 'fire', emoji: '🔥', label: 'On fire', chipColor: '#FFB547', chipBg: 'rgba(255,181,71,0.14)' };
  }
  if (progress > 0 && daysSince <= 14) {
    return { state: 'building', emoji: '📈', label: 'Building momentum', chipColor: '#7DD3FC', chipBg: 'rgba(125,211,252,0.12)' };
  }
  return { state: 'quiet', emoji: '😴', label: 'Quiet', chipColor: '#94A3B8', chipBg: 'rgba(148,163,184,0.12)' };
}

// ─── Urgency ────────────────────────────────────────────────────────
// From deadline alone. Pulse is reserved for overdue so it actually
// means something — if everything pulses, the pulse is noise.
//
//   calm     → no deadline, or > 7 days out
//   warm     → 2–7 days out (amber text, no glow)
//   hot      → 12h – 48h (amber edge glow, ⚡ prefix)
//   overdue  → past deadline (red pulse on right edge)

export function getUrgency(project) {
  const d = project?.deadline;
  if (!d) return { state: 'calm', hoursLeft: null, color: '#9CA3AF', prefix: '' };

  const deadline = new Date(d + 'T23:59:59').getTime();
  const hoursLeft = (deadline - Date.now()) / 3600000;

  if (hoursLeft < 0) return { state: 'overdue', hoursLeft, color: '#EF4444', prefix: '' };
  if (hoursLeft <= 12) return { state: 'hot', hoursLeft, color: '#FF7A33', prefix: '⚡ ' };
  if (hoursLeft <= 48) return { state: 'hot', hoursLeft, color: '#F59E0B', prefix: '⚡ ' };
  if (hoursLeft <= 168) return { state: 'warm', hoursLeft, color: '#F59E0B', prefix: '' };
  return { state: 'calm', hoursLeft, color: '#9CA3AF', prefix: '' };
}

// Human-readable deadline text. Keeps it short so the card chip fits.
export function formatDeadline(project) {
  const d = project?.deadline;
  if (!d) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const dl = new Date(d + 'T00:00:00');
  const diffDays = Math.round((dl - today) / DAY_MS);

  if (diffDays < 0) return `Overdue · ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tmrw';
  if (diffDays <= 6) {
    const day = dl.toLocaleDateString('en-US', { weekday: 'short' });
    return `Due ${day}`;
  }
  return `Due ${dl.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ─── Momentum group order ───────────────────────────────────────────
// The order sections appear on the Projects screen. "On fire" first
// so the heat is visible without scrolling.

export const MOMENTUM_ORDER = ['fire', 'building', 'quiet', 'clear'];

export const MOMENTUM_GROUP_LABELS = {
  fire:     'On fire',
  building: 'Building momentum',
  quiet:    'Quiet',
  clear:    'All clear',
};
