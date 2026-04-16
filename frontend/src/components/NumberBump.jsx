import React, { useEffect, useRef, useState } from 'react';

// ─── NumberBump ────────────────────────────────────────────────
// Wraps a changing value in a span that briefly bumps on update — a
// subtle spring pop when a counter ticks. Used for Profile stats and
// anywhere a number feels too quiet when it updates silently.
//
// On the first render we do NOT animate: we don't want every number
// to pop when the page first loads. We only bump on subsequent changes.
//
// Honors `prefers-reduced-motion` via the keyframe's media gate in
// index.css (no JS check needed — the animation just becomes a no-op).
//
// Props:
//   value        the current value (number or string)
//   className    extra classes merged onto the span
//   children     optional render override — receives the value
//
// Usage:
//   <NumberBump value={tasksDone} />
//   <NumberBump value={streak}>{v => `${v} days`}</NumberBump>

export default function NumberBump({ value, className = '', children, ...rest }) {
  const [bumping, setBumping] = useState(false);
  const prevRef = useRef(value);
  const timerRef = useRef(null);

  useEffect(() => {
    // Skip initial render — only bump when the value actually changes.
    if (prevRef.current === value) return;
    prevRef.current = value;

    setBumping(true);
    clearTimeout(timerRef.current);
    // Matches `number-bump` keyframe duration (420ms) + a small buffer
    // so React doesn't strip the class mid-animation on rapid updates.
    timerRef.current = setTimeout(() => setBumping(false), 450);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  const rendered = typeof children === 'function' ? children(value) : value;

  return (
    <span
      className={(bumping ? 'number-bump ' : '') + className}
      style={{ display: 'inline-block' }}
      {...rest}
    >
      {rendered}
    </span>
  );
}
