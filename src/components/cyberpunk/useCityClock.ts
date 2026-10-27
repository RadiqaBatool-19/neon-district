import { useEffect, useState } from 'react';
import { cityClock } from '../../stores/cyberpunkStore';

/**
 * Polls the render-loop clock at a low rate, so UI showing the time re-renders
 * a few times per second at most instead of every frame.
 */
export function useCityClock(intervalMs = 250, which: 'hour' | 'target' = 'hour') {
  const [value, setValue] = useState(cityClock[which]);
  useEffect(() => {
    const id = window.setInterval(() => setValue(cityClock[which]), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, which]);
  return value;
}
