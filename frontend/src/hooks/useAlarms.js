import { useEffect, useRef } from 'react';
import { api } from '../api.js';

const alerted = new Set(); // track IDs already notified in this session

export default function useAlarms() {
  const timer = useRef(null);

  useEffect(() => {
    // Request notification permission once
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const check = async () => {
      try {
        const due = await api.alarmsDue?.();
        if (!due || !due.length) return;
        due.forEach(t => {
          if (alerted.has(t.id)) return;
          alerted.add(t.id);
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification('Nexo — Task Alarm', {
              body: t.title,
              icon: '/favicon.ico',
              requireInteraction: true, // stays until user acts
              tag: `nexo-alarm-${t.id}`,
            });
            // Play alarm sound (short beep via AudioContext)
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              osc.type = 'sine';
              osc.frequency.value = 880;
              osc.connect(ctx.destination);
              osc.start();
              setTimeout(() => { osc.stop(); ctx.close(); }, 500);
              // Repeat beep 3 times
              setTimeout(() => { const c2 = new AudioContext(); const o2 = c2.createOscillator(); o2.type='sine'; o2.frequency.value=880; o2.connect(c2.destination); o2.start(); setTimeout(()=>{o2.stop();c2.close();},500); }, 1000);
              setTimeout(() => { const c3 = new AudioContext(); const o3 = c3.createOscillator(); o3.type='sine'; o3.frequency.value=880; o3.connect(c3.destination); o3.start(); setTimeout(()=>{o3.stop();c3.close();},500); }, 2000);
            } catch {}
          }
        });
      } catch {}
    };

    check();
    timer.current = setInterval(check, 30000); // check every 30s
    return () => clearInterval(timer.current);
  }, []);
}
