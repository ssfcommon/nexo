import React, { useEffect, useState } from 'react';

const COLORS = ['#4A6CF7', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#FACC15', '#EC4899', '#06B6D4'];
const SHAPES = ['rect', 'circle', 'strip'];
const MESSAGES = [
  'Great job!',
  'Nailed it!',
  'Crushed it!',
  'Well done!',
  'Keep going!',
  'On fire!',
  'Boom!',
];

let nextId = 1;
const listeners = new Set();

function playSound() {
  try {
    const ctx = new AudioContext();
    // Rising two-tone chime
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

export function fireConfetti() {
  listeners.forEach(fn => fn());
}

function makeParticles() {
  const particles = [];
  // Main burst — 50 particles from center
  for (let i = 0; i < 50; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const velocity = 300 + Math.random() * 400;
    particles.push({
      i,
      left: 50 + (Math.random() - 0.5) * 10,
      top: 40 + (Math.random() - 0.5) * 10,
      dx: Math.cos(angle) * velocity,
      dy: Math.sin(angle) * velocity - 200,
      rot: Math.random() * 1080 - 540,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      scale: 0.6 + Math.random() * 0.8,
      delay: Math.random() * 150,
      duration: 1.8 + Math.random() * 0.8,
    });
  }
  // Side bursts — 15 from each side
  [-1, 1].forEach(side => {
    for (let i = 0; i < 15; i++) {
      const angle = side === -1
        ? -Math.PI / 4 + Math.random() * Math.PI / 2
        : Math.PI * 3 / 4 + Math.random() * Math.PI / 2;
      const velocity = 200 + Math.random() * 300;
      particles.push({
        i: 50 + (side === 1 ? 15 : 0) + i,
        left: side === -1 ? 5 : 95,
        top: 70 + Math.random() * 20,
        dx: Math.cos(angle) * velocity,
        dy: Math.sin(angle) * velocity - 300,
        rot: Math.random() * 720,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        scale: 0.5 + Math.random() * 0.6,
        delay: 100 + Math.random() * 200,
        duration: 1.6 + Math.random() * 0.6,
      });
    }
  });
  return particles;
}

function ParticleEl({ p }) {
  const base = {
    position: 'absolute',
    left: `${p.left}%`,
    top: `${p.top}%`,
    backgroundColor: p.color,
    animationDelay: `${p.delay}ms`,
    animationDuration: `${p.duration}s`,
    '--dx': `${p.dx}px`,
    '--dy': `${p.dy}px`,
    '--rot': `${p.rot}deg`,
    transform: `scale(${p.scale})`,
  };
  if (p.shape === 'circle') {
    return <span className="confetti-piece" style={{ ...base, width: 8, height: 8, borderRadius: '50%' }} />;
  }
  if (p.shape === 'strip') {
    return <span className="confetti-piece" style={{ ...base, width: 3, height: 14, borderRadius: 1 }} />;
  }
  return <span className="confetti-piece" style={{ ...base, width: 8, height: 10, borderRadius: 2 }} />;
}

export default function ConfettiHost() {
  const [bursts, setBursts] = useState([]);

  useEffect(() => {
    const onFire = () => {
      const id = nextId++;
      const particles = makeParticles();
      const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      playSound();
      setBursts(b => [...b, { id, particles, message }]);
      setTimeout(() => setBursts(b => b.filter(x => x.id !== id)), 3000);
    };
    listeners.add(onFire);
    return () => listeners.delete(onFire);
  }, []);

  if (bursts.length === 0) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {bursts.map(b => (
        <div key={b.id} className="absolute inset-0">
          {b.particles.map(p => <ParticleEl key={p.i} p={p} />)}
          {/* Toast message */}
          <div className="celebrate-toast">
            <span className="text-[22px] font-bold text-ink-900">{b.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
