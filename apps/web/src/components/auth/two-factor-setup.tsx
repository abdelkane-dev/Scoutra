'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { encode } from 'uqr';
import { Copy } from 'lucide-react';
import { Button, Field, Input, toast } from '@scoutra/ui';
import { useT } from '@/lib/i18n/client';
import { authClient, safeNext } from '@/lib/auth-client';
import { FormAlert, PasswordInput, useAuthErrorMessage } from './form-bits';

/** Code QR dessiné en SVG (aucun HTML brut). */
function Qr({ value, label }: { value: string; label: string }) {
  const { data, size } = React.useMemo(() => encode(value, { border: 2 }), [value]);
  const cells: React.ReactNode[] = [];
  data.forEach((row, y) =>
    row.forEach(
      (on, x) =>
        on && cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />),
    ),
  );
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      className="size-44 rounded-md border border-line bg-white p-1"
      shapeRendering="crispEdges"
    >
      <g fill="var(--ink)">{cells}</g>
    </svg>
  );
}

function secretFromUri(uri: string) {
  try {
    return new URL(uri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

export function TwoFactorSetup({
  alreadyEnabled,
  next,
}: {
  alreadyEnabled: boolean;
  next?: string;
}) {
  const t = useT();
  const router = useRouter();
  const msg = useAuthErrorMessage();
  const [step, setStep] = React.useState<'password' | 'scan' | 'codes'>('password');
  const [uri, setUri] = React.useState('');
  const [codes, setCodes] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (alreadyEnabled && step === 'password')
    return <FormAlert tone="ok">{t('auth.setup2fa.already')}</FormAlert>;

  const copy = async (text: string, done: string) => {
    await navigator.clipboard.writeText(text);
    toast(done);
  };

  return (
    <div className="grid gap-6">
      <FormAlert>{error}</FormAlert>
      <ol className="grid gap-6">
        <li className="grid gap-3">
          <h2 className="t-heading-16">
            <span className="mr-2 text-ink-3 tnum">1</span>
            {t('auth.setup2fa.step1')}
          </h2>
          {step === 'password' ? (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError(null);
                const password = String(new FormData(e.currentTarget).get('password') ?? '');
                const { data, error: err } = await authClient.twoFactor.enable({ password });
                setPending(false);
                if (err || !data || !('totpURI' in data)) return setError(msg(err));
                setUri(data.totpURI);
                setCodes(data.backupCodes);
                setStep('scan');
              }}
            >
              <Field id="password" label={t('auth.password')}>
                <PasswordInput name="password" autoComplete="current-password" required autoFocus />
              </Field>
              <Button type="submit" variant="ink" size="lg" disabled={pending}>
                {t('auth.setup2fa.start')}
              </Button>
            </form>
          ) : null}
        </li>
        <li className="grid gap-3" aria-disabled={step === 'password'}>
          <h2 className={step === 'password' ? 't-heading-16 text-ink-3' : 't-heading-16'}>
            <span className="mr-2 text-ink-3 tnum">2</span>
            {t('auth.setup2fa.step2')}
          </h2>
          {step === 'scan' ? (
            <>
              <p className="text-copy-14 text-ink-2">{t('auth.setup2fa.step2Body')}</p>
              <Qr value={uri} label={t('auth.setup2fa.qrLabel')} />
              <div className="grid gap-1.5">
                <span className="text-label-13">{t('auth.setup2fa.key')}</span>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-sm bg-sunken px-2.5 py-2 text-label-13 tnum">
                    {secretFromUri(uri)}
                  </code>
                  <Button
                    size="icon"
                    aria-label={t('auth.setup2fa.copy')}
                    onClick={() => copy(secretFromUri(uri), t('auth.setup2fa.copied'))}
                  >
                    <Copy aria-hidden strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </li>
        <li className="grid gap-3">
          <h2 className={step === 'password' ? 't-heading-16 text-ink-3' : 't-heading-16'}>
            <span className="mr-2 text-ink-3 tnum">3</span>
            {t('auth.setup2fa.step3')}
          </h2>
          {step === 'scan' ? (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError(null);
                const code = String(new FormData(e.currentTarget).get('code') ?? '').replace(
                  /\s/g,
                  '',
                );
                const { error: err } = await authClient.twoFactor.verifyTotp({ code });
                setPending(false);
                if (err) return setError(msg(err));
                toast(t('auth.setup2fa.enabled'));
                setStep('codes');
              }}
            >
              <Field id="code" label={t('auth.twoFactor.code')}>
                <Input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  required
                  className="text-[18px] tracking-[0.2em] tnum"
                />
              </Field>
              <Button type="submit" variant="ink" size="lg" disabled={pending}>
                {t('auth.setup2fa.verify')}
              </Button>
            </form>
          ) : null}
        </li>
      </ol>
      {step === 'codes' ? (
        <section className="grid gap-3 rounded-lg border border-line p-4" aria-labelledby="h-codes">
          <h2 id="h-codes" className="t-heading-16">
            {t('auth.setup2fa.backupTitle')}
          </h2>
          <p className="text-copy-14 text-ink-2">{t('auth.setup2fa.backupBody')}</p>
          <ul className="grid grid-cols-2 gap-1.5 rounded-sm bg-sunken p-3 text-label-14 tnum">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => copy(codes.join('\n'), t('auth.setup2fa.codesCopied'))}>
              <Copy aria-hidden strokeWidth={1.75} />
              {t('auth.setup2fa.copyCodes')}
            </Button>
            <Button
              variant="ink"
              onClick={() => {
                router.replace(safeNext(next, '/settings/security'));
                router.refresh();
              }}
            >
              {t('auth.setup2fa.continue')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
