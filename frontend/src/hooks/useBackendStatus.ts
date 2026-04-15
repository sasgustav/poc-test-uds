import { useEffect, useRef, useState } from 'react';

export type BackendStatus = 'online' | 'offline' | 'checking';

export function useBackendStatus(intervalMs = 10_000): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    async function check() {
      controllerRef.current?.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;

      try {
        const res = await fetch('/v1/health/liveness', { signal: ctrl.signal });
        if (mounted) setStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (mounted) setStatus('offline');
      }
    }

    check();
    const id = setInterval(check, intervalMs);

    return () => {
      mounted = false;
      controllerRef.current?.abort();
      clearInterval(id);
    };
  }, [intervalMs]);

  return status;
}
