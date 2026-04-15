import { useCallback, useEffect, useRef, useState } from 'react';

export type BackendStatus = 'online' | 'offline' | 'checking';

export function useBackendStatus(intervalMs = 5_000): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const controllerRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    try {
      const res = await fetch('/v1/health/liveness', {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      setStatus(res.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);

    // Instant detection when network drops/reconnects
    const goOffline = () => setStatus('offline');
    const goOnline = () => { check(); };

    // Check immediately when tab regains focus
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      controllerRef.current?.abort();
      clearInterval(id);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [check, intervalMs]);

  return status;
}
