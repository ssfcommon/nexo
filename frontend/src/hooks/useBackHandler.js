/**
 * Lightweight Android-back-button / browser-back integration for the SPA.
 *
 * How it works:
 *  - Each "navigable" state (open modal, detail screen) pushes a
 *    `history.pushState` entry and registers a close callback.
 *  - When the user presses the back button, the `popstate` event fires,
 *    we pop the topmost callback off the stack and call it (closes the
 *    overlay / navigates back).
 *  - When the user closes something manually (✕ button), `popBack` is
 *    called: it removes the entry from the stack and calls `history.back()`
 *    to consume the corresponding history entry, with a skip-flag so the
 *    popstate listener doesn't re-fire the callback.
 *
 * Usage:
 *   import { useBackHandler } from '../hooks/useBackHandler.js';
 *   useBackHandler('event-modal', !!selectedEvent, () => setSelectedEvent(null));
 */

import { useEffect, useRef } from 'react';

// ── Module-level state (shared across all hook instances) ──────
const stack = [];        // [{ id, closeFn }]
let skipNext = false;    // prevents double-fire on manual close
let listenerInstalled = false;

function installListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener('popstate', () => {
    if (skipNext) { skipNext = false; return; }
    const top = stack.pop();
    if (top) top.closeFn();
    // If stack is empty → browser default (exit / navigate away). Correct.
  });
}

function pushBack(id, closeFn) {
  installListener();
  // Dedupe — don't push the same id twice.
  if (stack.some(e => e.id === id)) return;
  stack.push({ id, closeFn });
  window.history.pushState({ backId: id }, '');
}

function popBack(id) {
  const idx = stack.findIndex(e => e.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);
  // Consume the history entry we pushed, flagged so popstate skips.
  skipNext = true;
  window.history.back();
}

// ── React hook ─────────────────────────────────────────────────
export function useBackHandler(id, isOpen, closeFn) {
  // Keep closeFn stable via ref so we never have a stale closure.
  const closeFnRef = useRef(closeFn);
  closeFnRef.current = closeFn;

  useEffect(() => {
    if (isOpen) {
      pushBack(id, () => closeFnRef.current());
    } else {
      popBack(id);
    }
    // On unmount while still open → clean up the orphaned entry.
    return () => {
      const idx = stack.findIndex(e => e.id === id);
      if (idx !== -1) {
        stack.splice(idx, 1);
        // Also consume the history entry to keep history length in sync.
        skipNext = true;
        window.history.back();
      }
    };
  }, [id, isOpen]);
}
