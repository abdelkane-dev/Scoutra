'use client';
import * as React from 'react';
import { apiFetch, type ApiError } from './api';

/**
 * Lecture d'une route JSON de l'API avec état de chargement, erreur et rechargement.
 * `url` à null : rien n'est chargé (permission absente, paramètre manquant).
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [loading, setLoading] = React.useState(!!url);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    void apiFetch<T>(url, { signal: ctrl.signal }).then((r) => {
      if (ctrl.signal.aborted) return;
      setData(r.data);
      setError(r.error);
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [url, tick]);
  const reload = React.useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}
