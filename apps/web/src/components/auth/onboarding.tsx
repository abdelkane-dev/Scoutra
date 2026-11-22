'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, Field, Input, cn, fieldBase, toast } from '@scoutra/ui';
import { useLocale, useT } from '@/lib/i18n/client';
import { authClient } from '@/lib/auth-client';
import { countryOptions } from '@/lib/countries';
import { saveOrganizationProfile, slugify } from '@/lib/onboarding';
import { FormAlert, useAuthErrorMessage } from './form-bits';

type Ref = { code: string; fr: string; en: string };

export function Onboarding({
  initialStep,
  accountTypes,
  sectors,
}: {
  initialStep: 'org' | 'profile';
  accountTypes: readonly Ref[];
  sectors: readonly Ref[];
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const msg = useAuthErrorMessage();
  const [step, setStep] = React.useState(initialStep);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accountType, setAccountType] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>([]);
  const countries = React.useMemo(() => countryOptions(locale), [locale]);

  return (
    <div className="grid gap-6">
      <ol className="flex gap-4 text-label-13" aria-label={t('auth.onboarding.title')}>
        {(['org', 'profile'] as const).map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? 'step' : undefined}
            className={cn('flex items-center gap-2', step === s ? 'text-ink' : 'text-ink-3')}
          >
            <span
              className={cn(
                'grid size-5 place-items-center rounded-full text-[11px] tnum',
                step === s ? 'bg-ink text-white' : 'bg-sunken',
              )}
            >
              {i + 1}
            </span>
            {s === 'org' ? t('auth.onboarding.stepOrg') : t('auth.onboarding.stepProfile')}
          </li>
        ))}
      </ol>
      <FormAlert>{error}</FormAlert>
      {step === 'org' ? (
        <form
          noValidate
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get('name') ?? '').trim();
            const countryCode = String(f.get('country') ?? '');
            if (!countryCode) return setError(msg('invalid_country_code'));
            setPending(true);
            setError(null);
            const { data, error: err } = await authClient.organization.create({
              name,
              slug: slugify(name),
              countryCode,
            });
            if (!err && data) await authClient.organization.setActive({ organizationId: data.id });
            setPending(false);
            if (err) return setError(msg(err));
            setStep('profile');
          }}
        >
          <Field id="name" label={t('auth.onboarding.orgName')}>
            <Input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder={t('auth.onboarding.orgNamePlaceholder')}
              autoFocus
            />
          </Field>
          <Field
            id="country"
            label={t('auth.onboarding.country')}
            hint={t('auth.onboarding.countryHint')}
          >
            <select
              name="country"
              required
              defaultValue=""
              className={cn(fieldBase, 'h-9 appearance-auto px-2.5 max-sm:h-11')}
            >
              <option value="" disabled>
                {t('auth.onboarding.countryPlaceholder')}
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="ink" size="lg" disabled={pending}>
            {t('auth.onboarding.submit')}
          </Button>
        </form>
      ) : (
        <form
          className="grid gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!accountType || picked.length === 0)
              return setError(t('auth.onboarding.chooseOne'));
            setPending(true);
            setError(null);
            const { error: err } = await saveOrganizationProfile({ accountType, sectors: picked });
            setPending(false);
            if (err) return setError(err.message || msg(err.code));
            toast(t('auth.onboarding.saved'));
            router.replace('/home');
            router.refresh();
          }}
        >
          <div className="grid gap-1">
            <h2 className="t-heading-20">{t('auth.onboarding.profileTitle')}</h2>
            <p className="text-copy-14 text-ink-2">{t('auth.onboarding.profileLede')}</p>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-label-13">{t('auth.onboarding.accountType')}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {accountTypes.map((a) => (
                <label
                  key={a.code}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm border px-3 text-copy-14 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text',
                    accountType === a.code
                      ? 'border-accent-line bg-accent-soft text-ink'
                      : 'border-line text-ink-2 hover:border-line-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={a.code}
                    checked={accountType === a.code}
                    onChange={() => setAccountType(a.code)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'size-3.5 rounded-full border',
                      accountType === a.code ? 'border-[4px] border-ink' : 'border-line-strong',
                    )}
                  />
                  {a[locale]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-2 flex w-full justify-between text-label-13">
              <span>{t('auth.onboarding.sectors')}</span>
              <span className="font-normal text-ink-3">
                {t('auth.onboarding.sectorsCount', { n: picked.length })}
              </span>
            </legend>
            <p className="-mt-1 text-label-12 font-normal text-ink-3">
              {t('auth.onboarding.sectorsHint')}
            </p>
            <div className="grid max-h-72 gap-px overflow-y-auto rounded-md border border-line bg-line">
              {sectors.map((s) => {
                const on = picked.includes(s.code);
                return (
                  <label
                    key={s.code}
                    className="flex min-h-10 cursor-pointer items-center gap-2.5 bg-surface px-3 text-copy-14 hover:bg-[#fafafb]"
                  >
                    <Checkbox
                      checked={on}
                      disabled={!on && picked.length >= 10}
                      onCheckedChange={(v) =>
                        setPicked((p) =>
                          v === true ? [...p, s.code] : p.filter((c) => c !== s.code),
                        )
                      }
                    />
                    {s[locale]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <Button type="submit" variant="ink" size="lg" disabled={pending}>
              {t('auth.onboarding.save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => {
                router.replace('/home');
                router.refresh();
              }}
            >
              {t('auth.onboarding.skip')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
