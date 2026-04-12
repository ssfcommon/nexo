import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'nexo.onboarding.done';

const STEPS = [
  {
    icon: 'logo',
    title: 'Welcome to Nexo',
    body: "Know What's Next to Do. Let's take a quick 30-second tour.",
  },
  {
    icon: '⚠️',
    title: 'Urgent work, first',
    body: 'The Home screen ranks overdue → due today → upcoming. Tackle the pulsing red cards first.',
  },
  {
    icon: '📁',
    title: 'Projects with real structure',
    body: 'Open a project to see its checklist, comments, meetings, and live progress — auto-calculated from subtasks.',
  },
  {
    icon: '👆',
    title: 'Poke & assign',
    body: "Assign subtasks to teammates with a deadline. Nexo warns you if they're on leave. Nudge with the poke button.",
  },
  {
    icon: '⌘K',
    title: 'Jump anywhere fast',
    body: 'Press Ctrl+K (or ⌘K on Mac) to search projects, tasks, and comments from anywhere in the app.',
  },
  {
    icon: '🔥',
    title: 'Build habits',
    body: 'Use streaks to log daily wellness habits. The Duolingo-style counter keeps you honest.',
  },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Delay slightly so the shell mounts first
      const id = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(id);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
    setStep(0);
  };

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/50" onClick={finish} />
      <div className="relative w-full max-w-[380px] bg-white rounded-[16px] p-6 shadow-xl">
        <div className="text-5xl text-center mb-3">
          {s.icon === 'logo' ? <img src="/logo.png" alt="Nexo" className="w-16 h-16 mx-auto object-contain" /> : s.icon}
        </div>
        <h2 className="text-[20px] font-bold text-center text-ink-900">{s.title}</h2>
        <p className="text-[13px] text-ink-500 text-center mt-2 mb-5 leading-relaxed">{s.body}</p>
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full transition"
              style={{ backgroundColor: i === step ? '#4A6CF7' : '#E5E7EB' }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={finish} className="pill pill-outline flex-1 !h-11">Skip</button>
          <button
            onClick={() => last ? finish() : setStep(step + 1)}
            className="pill pill-primary flex-1 !h-11"
          >
            {last ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}
