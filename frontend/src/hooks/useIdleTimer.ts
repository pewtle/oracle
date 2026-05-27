import { useEffect, useRef } from 'react';

/**
 * Calls onIdle after `delayMs` milliseconds of no user activity.
 * Activity resets the timer: mouse moves, clicks, touches, keypresses, scrolls.
 */
export function useIdleTimer(onIdle: () => void, delayMs: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onIdle, delayMs);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // Start the timer immediately

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onIdle, delayMs]);
}
