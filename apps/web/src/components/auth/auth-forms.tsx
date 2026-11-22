'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Checkbox, Field, Input, Label } from '@scoutra/ui';
import { useT } from '@/lib/i18n/client';
import { authClient, safeNext } from '@/lib/auth-client';
import { FormAlert, PasswordInput, useAuthErrorMessage } from './form-bits';

function useSubmit() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback(async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, setError, run };
}

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const msg = useAuthErrorMessage();
  const { pending, error, setError, run } = useSubmit();
  const next = safeNext(params.get('next'));

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get('email') ?? '').trim();
        void run(async () => {
          const { data, error: err } = await authClient.signIn.email({
            email,
            password: String(f.get('password') ?? ''),
          });
          if (err) {
            if (err.code === 'EMAIL_NOT_VERIFIED') {
              router.push(`/verify-email?email=${encodeURIComponent(email)}`);
              return;
            }
            setError(msg(err));
            return;
          }
          // Avec la 2FA, le plugin redirige vers /two-factor (onTwoFactorRedirect).
          if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) return;
          router.replace(next);
          router.refresh();
        });
      }}
    >
      <FormAlert>{error}</FormAlert>
      <Field id="email" label={t('auth.email')}>
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Link href="/forgot-password" className="text-label-13 text-accent-text hover:underline">
            {t('auth.login.forgot')}
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" variant="ink" size="lg" disabled={pending} className="w-full">
        {pending ? t('common.loading') : t('auth.login.submit')}
      </Button>
      <p className="text-copy-14 text-ink-2">
        {t('auth.login.noAccount')}{' '}
        <Link
          href={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-medium text-accent-text hover:underline"
        >
          {t('auth.login.signup')}
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const msg = useAuthErrorMessage();
  const { pending, error, setError, run } = useSubmit();
  const next = params.get('next');

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get('email') ?? '').trim();
        const password = String(f.get('password') ?? '');
        if (password.length < 12) {
          setError(msg('PASSWORD_TOO_SHORT'));
          return;
        }
        void run(async () => {
          const callbackURL = safeNext(next, '/onboarding');
          const { data, error: err } = await authClient.signUp.email({
            name: String(f.get('name') ?? '').trim(),
            email,
            password,
            callbackURL,
          });
          if (err) {
            setError(msg(err));
            return;
          }
          // Sans vérification d'email exigée, la session est ouverte tout de suite.
          if (data && 'token' in data && data.token) {
            router.replace(callbackURL);
            router.refresh();
          } else {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          }
        });
      }}
    >
      <FormAlert>{error}</FormAlert>
      <Field id="name" label={t('auth.name')}>
        <Input name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field id="email" label={t('auth.email')}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label={t('auth.password')} hint={t('auth.passwordHint')}>
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </Field>
      <Button type="submit" variant="ink" size="lg" disabled={pending} className="w-full">
        {pending ? t('common.loading') : t('auth.signup.submit')}
      </Button>
      <p className="text-label-12 font-normal text-ink-3">
        <Link href="/terms" className="underline-offset-2 hover:underline">
          {t('auth.signup.terms')}
        </Link>
      </p>
      <p className="text-copy-14 text-ink-2">
        {t('auth.signup.hasAccount')}{' '}
        <Link href="/login" className="font-medium text-accent-text hover:underline">
          {t('auth.signup.login')}
        </Link>
      </p>
    </form>
  );
}

export function VerifyEmailPanel({ dev }: { dev: boolean }) {
  const t = useT();
  const params = useSearchParams();
  const msg = useAuthErrorMessage();
  const email = params.get('email') ?? '';
  const { pending, error, setError, run } = useSubmit();
  const [sent, setSent] = React.useState(false);
  return (
    <div className="grid gap-5">
      <p className="text-copy-16 text-ink-2">
        {email ? t('auth.verify.lede', { email }) : t('auth.verify.ledeNoEmail')}
      </p>
      <FormAlert>{error}</FormAlert>
      {sent ? <FormAlert tone="ok">{t('auth.verify.resent')}</FormAlert> : null}
      <p className="text-copy-14 text-ink-3">{t('auth.verify.spam')}</p>
      {dev ? (
        <p className="rounded-md bg-sunken px-3 py-2 text-label-13 text-ink-2">
          {t('auth.verify.devNote')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={pending || !email}
          onClick={() =>
            void run(async () => {
              const { error: err } = await authClient.sendVerificationEmail({
                email,
                callbackURL: '/onboarding',
              });
              if (err) setError(msg(err));
              else setSent(true);
            })
          }
        >
          {t('auth.verify.resend')}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/login">{t('auth.verify.done')}</Link>
        </Button>
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  const t = useT();
  const msg = useAuthErrorMessage();
  const { pending, error, setError, run } = useSubmit();
  const [sent, setSent] = React.useState(false);
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
        void run(async () => {
          const { error: err } = await authClient.requestPasswordReset({
            email,
            redirectTo: '/reset-password',
          });
          if (err && err.status === 429) setError(msg(err));
          else setSent(true); // même réponse que l'adresse existe ou non
        });
      }}
    >
      <FormAlert>{error}</FormAlert>
      {sent ? <FormAlert tone="ok">{t('auth.forgot.sent')}</FormAlert> : null}
      <Field id="email" label={t('auth.email')}>
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" variant="ink" size="lg" disabled={pending} className="w-full">
        {t('auth.forgot.submit')}
      </Button>
      <Link href="/login" className="text-copy-14 font-medium text-accent-text hover:underline">
        {t('auth.forgot.back')}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const msg = useAuthErrorMessage();
  const token = params.get('token');
  const { pending, error, setError, run } = useSubmit();
  if (!token || params.get('error')) {
    return (
      <div className="grid gap-4">
        <FormAlert>{t('auth.reset.missingToken')}</FormAlert>
        <Link
          href="/forgot-password"
          className="text-copy-14 font-medium text-accent-text hover:underline"
        >
          {t('auth.forgot.submit')}
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const a = String(f.get('password') ?? '');
        if (a !== String(f.get('confirm') ?? '')) return setError(t('auth.reset.mismatch'));
        if (a.length < 12) return setError(msg('PASSWORD_TOO_SHORT'));
        void run(async () => {
          const { error: err } = await authClient.resetPassword({ newPassword: a, token });
          if (err) setError(msg(err));
          else router.replace('/login?reset=1');
        });
      }}
    >
      <FormAlert>{error}</FormAlert>
      <Field id="password" label={t('auth.password')} hint={t('auth.passwordHint')}>
        <PasswordInput name="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <Field id="confirm" label={t('auth.reset.confirm')}>
        <PasswordInput name="confirm" autoComplete="new-password" required minLength={12} />
      </Field>
      <Button type="submit" variant="ink" size="lg" disabled={pending} className="w-full">
        {t('auth.reset.submit')}
      </Button>
    </form>
  );
}

export function TwoFactorForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const msg = useAuthErrorMessage();
  const { pending, error, setError, run } = useSubmit();
  const [backup, setBackup] = React.useState(false);
  const [trust, setTrust] = React.useState(false);
  const next = safeNext(params.get('next'));
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get('code') ?? '').replace(/\s/g, '');
        void run(async () => {
          const { error: err } = backup
            ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: trust })
            : await authClient.twoFactor.verifyTotp({ code, trustDevice: trust });
          if (err)
            return setError(
              msg(backup && err.code === 'INVALID_CODE' ? 'INVALID_BACKUP_CODE' : err),
            );
          router.replace(next);
          router.refresh();
        });
      }}
    >
      <FormAlert>{error}</FormAlert>
      <Field id="code" label={backup ? t('auth.twoFactor.backup') : t('auth.twoFactor.code')}>
        <Input
          key={backup ? 'b' : 't'}
          name="code"
          inputMode={backup ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          pattern={backup ? undefined : '[0-9 ]*'}
          maxLength={backup ? 32 : 7}
          required
          autoFocus
          className="text-[18px] tracking-[0.2em] tnum"
        />
      </Field>
      <label className="flex items-center gap-2.5 text-copy-14 text-ink-2">
        <Checkbox checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
        {t('auth.twoFactor.trust')}
      </label>
      <Button type="submit" variant="ink" size="lg" disabled={pending} className="w-full">
        {t('auth.twoFactor.submit')}
      </Button>
      <Button
        type="button"
        variant="link"
        onClick={() => setBackup((b) => !b)}
        className="justify-self-start"
      >
        {backup ? t('auth.twoFactor.useTotp') : t('auth.twoFactor.useBackup')}
      </Button>
    </form>
  );
}
