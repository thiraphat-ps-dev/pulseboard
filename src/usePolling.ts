import { useEffect } from 'react';

/** Re-run `fn` every `ms` while the tab is visible, and right away when it becomes visible again. */
export function usePolling(fn: () => void, ms: number) {
  useEffect(() => {
    let timer = window.setInterval(tick, ms);
    function tick() {
      if (document.visibilityState === 'visible') fn();
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      fn();
      window.clearInterval(timer);
      timer = window.setInterval(tick, ms);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fn, ms]);
}
