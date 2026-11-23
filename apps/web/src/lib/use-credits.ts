'use client';
import * as React from 'react';
import { apiFetch } from './api';
import type { ApiCredits } from './api-types';

/** Solde de crédits réel (GET /api/credits) ; null tant qu'il n'est pas chargé ou indisponible. */
export function useCredits(enabled = true) {
  const [data, setData] = React.useState<ApiCredits | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    apiFetch<ApiCredits>('/api/credits', { signal: ctrl.signal }).then((r) => {
      if (r.data) setData(r.data);
    });
    return () => ctrl.abort();
  }, [enabled]);
  return data;
}
