/**
 * Pull-to-refresh for the mobile shell.
 *
 * Native browser pull-to-refresh doesn't fire because scrolling happens
 * inside <main>, not on the document. This hook listens for touch events
 * on the scroll container, tracks a downward drag from scrollTop === 0,
 * and fires an onRefresh callback once the user crosses a threshold.
 *
 * Exposes two hooks:
 *  - usePullToRefresh(scrollElRef, onRefresh) — drives the indicator
 *  - useOnRefresh(cb) — lets any screen subscribe to a global refresh event
 *    so it can re-fetch its data. The App dispatches 'nexo:refresh' when
 *    the user releases past the threshold.
 */

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 72;   // px of pull at which refresh fires
const MAX_PULL = 130;   // cap on pull distance for rubber-band
const EASE = 0.55;      // finger travel -> indicator travel ratio
const MIN_VISIBLE_MS = 700; // keep the spinner up long enough to feel responsive

export function usePullToRefresh(scrollElRef, onRefresh) {
  const [pullDelta, setPullDelta] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Mirror state into refs so we can read them from stable event handlers
  // without reinstalling the listeners on every render.
  const pullDeltaRef = useRef(0);
  const refreshingRef = useRef(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { pullDeltaRef.current = pullDelta; }, [pullDelta]);
  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const el = scrollElRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop !== 0 || refreshingRef.current) { pullingRef.current = false; return; }
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingRef.current) return;
      const y = e.touches[0].clientY;
      const delta = y - startYRef.current;
      if (delta > 0 && el.scrollTop === 0) {
        const eased = Math.min(MAX_PULL, delta * EASE);
        pullDeltaRef.current = eased;
        setPullDelta(eased);
      } else if (delta < 0) {
        pullingRef.current = false;
        pullDeltaRef.current = 0;
        setPullDelta(0);
      }
    };

    const onTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const crossed = pullDeltaRef.current >= THRESHOLD;
      if (crossed) {
        setRefreshing(true);
        setPullDelta(THRESHOLD); // lock indicator at threshold during refresh
        pullDeltaRef.current = THRESHOLD;
        const startedAt = Date.now();
        try {
          await Promise.resolve(onRefreshRef.current?.());
        } catch {}
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_VISIBLE_MS) {
          await new Promise(r => setTimeout(r, MIN_VISIBLE_MS - elapsed));
        }
        setRefreshing(false);
      }
      // Always spring back to rest when touch ends
      setPullDelta(0);
      pullDeltaRef.current = 0;
    };

    const onTouchCancel = () => {
      pullingRef.current = false;
      setPullDelta(0);
      pullDeltaRef.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchCancel);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [scrollElRef]);

  return { pullDelta, refreshing, threshold: THRESHOLD };
}

// ── Subscriber — screens call this to be notified of a refresh. ──
export function useOnRefresh(cb) {
  const cbRef = useRef(cb);
  useEffect(() => { cbRef.current = cb; }, [cb]);
  useEffect(() => {
    const h = () => cbRef.current?.();
    window.addEventListener('nexo:refresh', h);
    return () => window.removeEventListener('nexo:refresh', h);
  }, []);
}
