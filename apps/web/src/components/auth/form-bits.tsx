'use client';
import * as React from 'react';
import { Eye, EyeOff, TriangleAlert, Check } from 'lucide-react';
import { Input, cn } from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useT } from '@/lib/i18n/client';
import { authErrorCode, type AuthErrorLike } from '@/lib/auth-client';

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const t = useT();
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        className={cn('pr-11', props.className)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('auth.hide') : t('auth.show')}
        aria-pressed={show}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-ink-3 hover:text-ink max-sm:size-10"
      >
        {show ? (
          <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <Eye className="size-4" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </div>
  );
}

/** Message d'erreur traduit à partir du code Better Auth ou Scoutra. */
export function useAuthErrorMessage() {
  const t = useT();
  return React.useCallback(
    (err: AuthErrorLike | string) => {
      const code = typeof err === 'string' ? err : authErrorCode(err);
      const key = `auth.errors.${code}` as MessageKey;
      const msg = t(key);
      return msg === key ? t('auth.errors.unknown') : msg;
    },
    [t],
  );
}

export function FormAlert({
  tone = 'bad',
  children,
}: {
  tone?: 'bad' | 'ok';
  children: React.ReactNode;
}) {
  if (!children) return null;
  const Icon = tone === 'bad' ? TriangleAlert : Check;
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2.5 text-copy-14',
        tone === 'bad' ? 'border-bad/25 bg-bad-soft text-bad' : 'border-ok/25 bg-ok-soft text-ok',
      )}
    >
      <Icon className="mt-[3px] size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span>{children}</span>
    </div>
  );
}
