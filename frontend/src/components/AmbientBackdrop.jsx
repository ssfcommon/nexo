import React, { useEffect, useState } from 'react';

// ─── AmbientBackdrop ───────────────────────────────────────────
// A whisper-quiet tint behind the whole app that shifts by time of day.
// Not a skybox — just enough warmth/coolness that the room you're in
// feels like the right room for the hour. Glass cards blur it further.
//
//   05–12  sunrise    — coral + pink glow in the upper right
//   12–17  daylight   — cool blue wash from the top
//   17–21  golden     — amber + violet from the upper left
//   21–05  moonlight  — deep indigo + violet from the top
//
// Opacities stay in the 6–10% range deliberately. Go louder and it
// starts fighting with content and accent colors on cards.
//
// We re-evaluate every 10 minutes so an open tab doesn't stay stuck in
// morning mode all day, and re-evaluate on window focus so returning to
// the tab at dusk doesn't still show daylight.

function ambientFor(hour) {
  if (hour >= 5 && hour < 12) return {
    key: 'morning',
    from: 'rgba(255, 167, 107, 0.10)', // warm coral
    mid:  'rgba(255, 122, 155, 0.05)', // pink blush
    pos:  '85% 0%',
  };
  if (hour >= 12 && hour < 17) return {
    key: 'afternoon',
    from: 'rgba(91, 140, 255, 0.09)',  // cool sky blue
    mid:  'rgba(108, 199, 255, 0.03)',
    pos:  '50% 0%',
  };
  if (hour >= 17 && hour < 21) return {
    key: 'evening',
    from: 'rgba(255, 139, 88, 0.11)',  // golden hour
    mid:  'rgba(180, 94, 220, 0.05)',  // violet edge
    pos:  '15% 10%',
  };
  return {
    key: 'night',
    from: 'rgba(100, 124, 220, 0.09)', // moonlight indigo
    mid:  'rgba(66, 40, 120, 0.05)',
    pos:  '65% 5%',
  };
}

export default function AmbientBackdrop() {
  const [ambient, setAmbient] = useState(() => ambientFor(new Date().getHours()));

  useEffect(() => {
    const recheck = () => {
      const next = ambientFor(new Date().getHours());
      setAmbient(prev => (prev.key === next.key ? prev : next));
    };
    // Poll lightly — every 10 min is plenty for a 4-bucket day/night cycle.
    const id = setInterval(recheck, 10 * 60 * 1000);
    window.addEventListener('focus', recheck);
    window.addEventListener('visibilitychange', recheck);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none"
      style={{
        // Fixed to the viewport so we don't care how tall the content gets
        // or which screen mounts us. Content containers should set `relative
        // z-10` so they stack above this layer.
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: `radial-gradient(ellipse 140% 80% at ${ambient.pos}, ${ambient.from} 0%, ${ambient.mid} 35%, transparent 72%)`,
        // Cross-fade when the bucket swaps so dawn→day isn't a blink.
        transition: 'background 1200ms ease',
      }}
    />
  );
}
