'use client';
import * as React from 'react';
import type { Action } from '@scoutra/auth';
import type { AppContext } from '@/lib/app-context';

const Ctx = React.createContext<AppContext | null>(null);

export function AppProvider({ value, children }: { value: AppContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContext {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useApp hors de AppProvider');
  return v;
}

/** Permissions effectives : `allowed` = possible maintenant ; `needs2fa` = permis par le rôle, bloqué sans 2FA. */
export function usePerm() {
  const { org } = useApp();
  return React.useMemo(
    () => ({
      can: (a: Action) => org.permissions.includes(a),
      needs2fa: (a: Action) => org.needsTwoFactor.includes(a),
      visible: (a: Action[] | undefined) =>
        !a || a.some((x) => org.permissions.includes(x) || org.needsTwoFactor.includes(x)),
    }),
    [org.permissions, org.needsTwoFactor],
  );
}
