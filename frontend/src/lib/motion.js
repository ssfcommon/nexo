// ─── Motion primitives ──────────────────────────────────────────────
// One source of truth for app-wide motion. Import these everywhere so
// every transition in Nexo speaks the same vocabulary.
//
// Three springs. That's it. Resist adding more.
//
//   gentle  — soft settle. Use for things that should feel calm (fades,
//             ambient shifts, non-hero state changes).
//   snappy  — iOS toggle feel. Slight overshoot + quick settle. Use for
//             most interactive transitions (card mount, chip flip,
//             progress-ring updates).
//   bouncy  — celebratory overshoot. Use sparingly — reserved for
//             moments of joy (project created, task complete, milestone
//             hit). Overuse kills the magic.
//
// Usage:
//   style={{ transition: `transform 220ms ${spring.snappy}` }}

export const spring = {
  gentle: 'cubic-bezier(0.34, 1.20, 0.64, 1)',
  snappy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bouncy: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
};

// ─── Reduced motion ─────────────────────────────────────────────────
// Called once at module load. `prefers-reduced-motion: reduce` users get
// 0-duration everything. We honour it silently — no opt-in needed.

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
}

// ─── Stagger helper ─────────────────────────────────────────────────
// Returns an inline style for a child at index `i` in a staggered list.
// Each child enters opacity 0 → 1 + translateY 6 → 0 with `snappy`.
// Delay grows linearly; clamped at 10 children so a list of 50 doesn't
// take 2 seconds to fully mount.
//
// Pattern:
//   items.map((x, i) => <Card key={x.id} style={staggerIn(i)} ...>)
//
// The card's base CSS must include `animation-fill-mode: both` and the
// @keyframes `card-stagger-in` defined in index.css.

const MAX_STAGGER_INDEX = 10;
const STAGGER_MS = 40;

export function staggerIn(index) {
  if (prefersReducedMotion()) return { opacity: 1 };
  const i = Math.min(index, MAX_STAGGER_INDEX);
  return {
    animation: `card-stagger-in 280ms ${spring.snappy} both`,
    animationDelay: `${i * STAGGER_MS}ms`,
  };
}

// ─── Press scale helper ─────────────────────────────────────────────
// Standard press feedback: scale to 0.97 on press, spring back to 1 on
// release. Apply as Tailwind class: `active:scale-[0.97]` with a
// transition on transform using `spring.snappy`.
//
// This util just centralises the numbers so we don't sprinkle magic
// constants.

export const pressFeedback = {
  scale: 0.97,
  durationMs: 180,
  easing: spring.snappy,
};
