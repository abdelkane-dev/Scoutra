'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Lock, ShieldCheck, ShieldAlert, CreditCard, Download } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  Segmented,
  Status,
  cn,
  toast,
} from '@scoutra/ui';
import type { Locale, MessageKey } from '@scoutra/i18n';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { authClient } from '@/lib/auth-client';
import { saveOrganizationProfile } from '@/lib/onboarding';
import { setLocaleCookie } from '@/lib/locale-cookie';
import { CREDIT_PACKS, PLANS, ROLLOVER_SHARE, WRITING_SURCHARGE } from '@/lib/pricing';
import { DEMO_CREDITS, DEMO_INVOICES } from '@/lib/demo/workspace';
import { useAuthErrorMessage, PasswordInput } from '@/components/auth/form-bits';
import { useApp, usePerm } from './app-provider';

const NAV = [
  ['organization', '/settings/organization'],
  ['profile', '/settings/profile'],
  ['security', '/settings/security'],
  ['billing', '/settings/billing'],
  ['license', '/settings/license'],
] as const;

export function SettingsNav() {
  const t = useT();
  const pathname = usePathname();
  const { visible } = usePerm();
  return (
    <nav
      aria-label={t('prefs.title')}
      className="flex gap-1 overflow-x-auto lg:sticky lg:top-4 lg:flex-col lg:self-start"
    >
      {NAV.filter(([k]) => k !== 'billing' || visible(['billing:read', 'billing:manage'])).map(
        ([k, href]) => (
          <Link
            key={k}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className={cn(
              'flex h-8 shrink-0 items-center rounded-sm px-2.5 text-label-14 text-ink-2 hover:bg-hover hover:text-ink max-lg:h-10',
              pathname === href && 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]',
            )}
          >
            {t(`prefs.nav.${k}`)}
          </Link>
        ),
      )}
    </nav>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-line px-4 py-4 first:border-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
      <div>
        <p className="text-label-14 font-semibold">{label}</p>
        {hint ? <p className="mt-0.5 text-label-12 font-normal text-ink-3">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type Ref = { code: string; fr: string; en: string };
export function OrganizationSettings({
  accountTypes,
  sectors,
}: {
  accountTypes: Ref[];
  sectors: Ref[];
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const router = useRouter();
  const app = useApp();
  const { can } = usePerm();
  const editable = can('org:profile');
  const [name, setName] = React.useState(app.org.name);
  const [type, setType] = React.useState(app.org.accountType ?? '');
  const [picked, setPicked] = React.useState<string[]>(app.org.sectors);
  const [website, setWebsite] = React.useState(app.org.website ?? '');
  const msg = useAuthErrorMessage();
  return (
    <div className="grid gap-4">
      {!editable ? (
        <p className="text-label-13 font-normal text-ink-3">{t('prefs.org.readOnly')}</p>
      ) : null}
      <Panel>
        <Row label={t('prefs.org.name')}>
          <form
            className="flex max-w-md gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await authClient.organization.update({ data: { name } });
              if (error) return toast(msg(error));
              toast(t('prefs.org.nameSaved'));
              router.refresh();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!can('org:update')}
              aria-label={t('prefs.org.name')}
            />
            {can('org:update') ? <Button type="submit">{t('app.common.save')}</Button> : null}
          </form>
        </Row>
        <Row label={t('prefs.org.country')} hint={t('prefs.org.countryLocked')}>
          <p className="inline-flex h-9 items-center gap-2 rounded-sm border border-line bg-sunken px-3 text-copy-14 text-ink-2">
            <Lock className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
            {fmt.country(app.org.countryCode)} ({app.org.countryCode})
          </p>
        </Row>
      </Panel>
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>{t('prefs.org.profile')}</PanelTitle>
            <p className="text-label-12 font-normal text-ink-3">{t('prefs.org.profileLede')}</p>
          </div>
        </PanelHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await saveOrganizationProfile({
              accountType: type,
              sectors: picked,
              website: website.trim() || null,
            });
            if (error) return toast(error.message || t('auth.errors.unknown'));
            toast(t('prefs.org.saved'));
            router.refresh();
          }}
        >
          <Row label={t('prefs.org.accountType')}>
            <div
              className="flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label={t('prefs.org.accountType')}
            >
              {accountTypes.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  role="radio"
                  aria-checked={type === a.code}
                  disabled={!editable}
                  onClick={() => setType(a.code)}
                  className="h-8 rounded-sm border border-line px-2.5 text-label-13 text-ink-2 hover:border-line-strong aria-checked:border-accent-line aria-checked:bg-accent-soft aria-checked:text-ink disabled:opacity-60 max-sm:h-10"
                >
                  {a[locale]}
                </button>
              ))}
            </div>
          </Row>
          <Row
            label={t('prefs.org.sectors')}
            hint={t('auth.onboarding.sectorsCount', { n: picked.length })}
          >
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {sectors.map((s) => (
                <label
                  key={s.code}
                  className="flex min-h-8 items-center gap-2.5 text-copy-14 max-sm:min-h-10"
                >
                  <Checkbox
                    checked={picked.includes(s.code)}
                    disabled={!editable || (!picked.includes(s.code) && picked.length >= 10)}
                    onCheckedChange={(v) =>
                      setPicked((p) =>
                        v === true ? [...p, s.code] : p.filter((x) => x !== s.code),
                      )
                    }
                  />
                  {s[locale]}
                </label>
              ))}
            </div>
          </Row>
          <Row label={t('crm.website')} hint={t('crm.websiteHint')}>
            <Input
              className="max-w-md"
              type="url"
              inputMode="url"
              value={website}
              disabled={!editable}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t('crm.websitePlaceholder')}
              aria-label={t('crm.website')}
            />
          </Row>
          {editable ? (
            <div className="flex justify-end border-t border-line px-4 py-3">
              <Button type="submit" variant="primary" disabled={!type || picked.length === 0}>
                {t('prefs.org.save')}
              </Button>
            </div>
          ) : null}
        </form>
      </Panel>
      {app.org.role === 'owner' ? (
        <Panel className="border-bad/30">
          <Row label={t('prefs.org.danger')} hint={t('prefs.org.deleteHint')}>
            <Button variant="secondary" className="text-bad" disabled={!can('org:delete')}>
              {t('prefs.org.delete')}
            </Button>
          </Row>
        </Panel>
      ) : null}
    </div>
  );
}

export function ProfileSettings() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const app = useApp();
  const [name, setName] = React.useState(app.user.name);
  return (
    <Panel>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await authClient.updateUser({ name });
          toast(t('prefs.profile.saved'));
          router.refresh();
        }}
      >
        <Row label={t('prefs.profile.name')}>
          <Input
            className="max-w-md"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t('prefs.profile.name')}
            autoComplete="name"
          />
        </Row>
        <Row label={t('prefs.profile.email')} hint={t('prefs.profile.emailHint')}>
          <Input
            className="max-w-md"
            value={app.user.email}
            disabled
            aria-label={t('prefs.profile.email')}
          />
        </Row>
        <Row label={t('prefs.profile.language')}>
          <Segmented<Locale>
            label={t('prefs.profile.language')}
            value={locale}
            onChange={(l) => {
              setLocaleCookie(l);
              router.refresh();
            }}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
        <div className="flex justify-end border-t border-line px-4 py-3">
          <Button type="submit" variant="primary">
            {t('prefs.profile.save')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function SecuritySettings() {
  const t = useT();
  const router = useRouter();
  const app = useApp();
  const msg = useAuthErrorMessage();
  const [disableOpen, setDisableOpen] = React.useState(false);
  const enabled = app.user.twoFactorEnabled;
  const blocked = app.org.needsTwoFactor
    .map((a) => a.split(':')[0])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
  return (
    <div className="grid gap-4">
      <Panel>
        <Row
          label={t('prefs.security.twoFactor')}
          hint={
            !enabled && blocked ? t('prefs.security.requiredFor', { actions: blocked }) : undefined
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            {enabled ? (
              <Status tone="ok" soft>
                {t('prefs.security.on')}
              </Status>
            ) : (
              <Status tone="warn" soft>
                {t('prefs.security.off')}
              </Status>
            )}
            {enabled ? (
              <Button size="sm" variant="ghost" onClick={() => setDisableOpen(true)}>
                {t('prefs.security.disable')}
              </Button>
            ) : (
              <Button size="sm" variant="primary" asChild>
                <Link href="/two-factor/setup?next=/settings/security">
                  <ShieldCheck aria-hidden strokeWidth={1.75} />
                  {t('prefs.security.enable')}
                </Link>
              </Button>
            )}
          </div>
        </Row>
        <Row label={t('prefs.security.password')}>
          <form
            className="grid max-w-md gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const { error } = await authClient.changePassword({
                currentPassword: String(f.get('current')),
                newPassword: String(f.get('next')),
                revokeOtherSessions: true,
              });
              if (error) return toast(msg(error));
              toast(t('prefs.security.changed'));
              (e.target as HTMLFormElement).reset();
            }}
          >
            <Field id="pw-current" label={t('prefs.security.current')}>
              <PasswordInput name="current" autoComplete="current-password" required />
            </Field>
            <Field id="pw-next" label={t('prefs.security.next')} hint={t('auth.passwordHint')}>
              <PasswordInput name="next" autoComplete="new-password" minLength={12} required />
            </Field>
            <div>
              <Button type="submit">{t('prefs.security.changePassword')}</Button>
            </div>
          </form>
        </Row>
        <Row label={t('prefs.security.sessions')} hint={t('prefs.security.sessionsLede')}>
          <Button
            size="sm"
            onClick={async () => {
              await authClient.revokeOtherSessions();
              toast(t('prefs.security.revoked'));
            }}
          >
            {t('prefs.security.revokeOthers')}
          </Button>
        </Row>
      </Panel>
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('prefs.security.disableTitle')}</DialogTitle>
            <DialogDescription>{t('prefs.security.disableLede')}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await authClient.twoFactor.disable({
                password: String(new FormData(e.currentTarget).get('password')),
              });
              if (error) return toast(msg(error));
              setDisableOpen(false);
              toast(t('prefs.security.disabled'));
              router.refresh();
            }}
          >
            <Field id="dis-pw" label={t('auth.password')}>
              <PasswordInput name="password" autoComplete="current-password" required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDisableOpen(false)}>
                {t('app.common.cancel')}
              </Button>
              <Button type="submit" variant="danger">
                <ShieldAlert aria-hidden strokeWidth={1.75} />
                {t('prefs.security.disable')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BillingSettings() {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { can } = usePerm();
  const manage = can('billing:manage');
  const total = DEMO_CREDITS.granted + DEMO_CREDITS.rollover + DEMO_CREDITS.packs;
  const left = total - DEMO_CREDITS.used;
  const extra = DEMO_CREDITS.seats - PLANS.pipeline.usersIncluded;
  const monthly = PLANS.pipeline.priceUsd + extra * PLANS.pipeline.extraSeat.priceUsd;
  const parts = [
    [t('prefs.billing.granted'), DEMO_CREDITS.granted, 'bg-ink'],
    [t('prefs.billing.rollover'), DEMO_CREDITS.rollover, 'bg-ink-3'],
    [t('prefs.billing.packs'), DEMO_CREDITS.packs, 'bg-line-strong'],
  ] as const;
  return (
    <div className="grid gap-4">
      {!manage ? (
        <p className="text-label-13 font-normal text-ink-3">{t('prefs.billing.readOnly')}</p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <PanelHeader>
            <div className="min-w-0 flex-1">
              <PanelTitle>{t('prefs.billing.credits')}</PanelTitle>
              <p className="text-label-12 font-normal text-ink-3">
                {t('prefs.billing.creditsLede')}
              </p>
            </div>
          </PanelHeader>
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-end gap-6">
              <p>
                <span className="block text-label-13 text-ink-3">{t('prefs.billing.left')}</span>
                <span className="text-[32px] font-semibold leading-9 tracking-[-0.03em] tnum">
                  {fmt.n(left)}
                </span>
              </p>
              <p>
                <span className="block text-label-13 text-ink-3">{t('prefs.billing.used')}</span>
                <span className="text-[20px] font-semibold leading-7 tnum">
                  {fmt.n(DEMO_CREDITS.used)}
                </span>
              </p>
            </div>
            <div className="grid gap-2">
              <div
                className="flex h-2.5 overflow-hidden rounded-[2px] bg-sunken"
                role="img"
                aria-label={`${fmt.n(DEMO_CREDITS.used)} / ${fmt.n(total)}`}
              >
                <span
                  className="h-full bg-accent"
                  style={{ width: `${(DEMO_CREDITS.used / total) * 100}%` }}
                />
              </div>
              <ul className="grid gap-1 text-label-13 sm:grid-cols-3">
                {parts.map(([l, v, c]) => (
                  <li key={l} className="flex items-center gap-2">
                    <i className={cn('size-2 rounded-[2px]', c)} aria-hidden />
                    <span className="text-ink-2">{l}</span>
                    <b className="ml-auto font-semibold tnum sm:ml-0">{fmt.n(v)}</b>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-label-12 font-normal text-ink-3">
              {t('prefs.billing.rolloverRule', { pct: fmt.pct(ROLLOVER_SHARE) })}
            </p>
          </div>
          <div className="border-t border-line p-4">
            <p className="mb-2 text-label-14 font-semibold">{t('prefs.billing.buyPacks')}</p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {CREDIT_PACKS.map((p) => (
                <li key={p.credits} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex-1 text-copy-14">
                    {t('prefs.billing.packLine', { credits: fmt.n(p.credits) })}
                  </span>
                  <span className="text-label-14 font-semibold tnum">{fmt.money(p.priceUsd)}</span>
                  {manage ? (
                    <Button size="sm" onClick={() => toast(t('prefs.billing.bought'))}>
                      {t('prefs.billing.buy')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-label-12 font-normal text-ink-3">
              {t('prefs.billing.writingLede', {
                careful: WRITING_SURCHARGE.careful,
                premium: WRITING_SURCHARGE.premium,
              })}
            </p>
          </div>
        </Panel>
        <div className="grid content-start gap-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>{t('prefs.billing.plan')}</PanelTitle>
              <Badge tone="ink" className="ml-auto">
                {t('prefs.billing.planName')}
              </Badge>
            </PanelHeader>
            <div className="grid gap-1 p-4 text-copy-14">
              <p className="text-[24px] font-semibold leading-8 tnum">
                {fmt.money(monthly)}
                <span className="ml-1 text-label-13 font-normal text-ink-3">
                  {t('app.common.perMonth')}
                </span>
              </p>
              <p className="text-ink-2">
                {t('prefs.billing.seats', {
                  n: DEMO_CREDITS.seats,
                  included: PLANS.pipeline.usersIncluded,
                })}
              </p>
              <p className="text-ink-3">
                {t('prefs.billing.renews', {
                  date: new Date(DEMO_CREDITS.renewsOn).toLocaleDateString(fmt.tag, {
                    day: 'numeric',
                    month: 'long',
                  }),
                })}
              </p>
              {manage ? (
                <Button className="mt-3 justify-self-start">{t('prefs.billing.change')}</Button>
              ) : null}
            </div>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>{t('prefs.billing.payment')}</PanelTitle>
            </PanelHeader>
            <div className="grid gap-3 p-4">
              <p className="text-label-12 font-normal text-ink-3">
                {t('prefs.billing.paymentLede')}
              </p>
              <div className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5">
                <CreditCard className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
                <div className="flex-1">
                  <p className="text-label-14">{t('prefs.billing.card')}</p>
                  <p className="text-label-12 font-normal text-ink-3">
                    {t('prefs.billing.cardExp')}
                  </p>
                </div>
              </div>
              {manage ? (
                <Button size="sm" className="justify-self-start">
                  {t('prefs.billing.updateCard')}
                </Button>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
      <Panel>
        <PanelHeader>
          <PanelTitle>{t('prefs.billing.invoices')}</PanelTitle>
        </PanelHeader>
        <table className="w-full text-copy-14">
          <thead className="bg-sunken text-left text-label-13 text-ink-3">
            <tr className="h-9">
              <th scope="col" className="pl-4 font-medium">
                {t('prefs.billing.colInvoice')}
              </th>
              <th scope="col" className="px-3 font-medium">
                {t('prefs.billing.colDate')}
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                {t('prefs.billing.colAmount')}
              </th>
              <th scope="col" className="px-3 font-medium max-sm:hidden">
                {t('prefs.billing.colStatus')}
              </th>
              <th scope="col" className="pr-4">
                <span className="sr-only">PDF</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_INVOICES.map((i) => (
              <tr key={i.id} className="h-11 border-t border-line">
                <th scope="row" className="pl-4 text-left font-medium tnum">
                  {i.id}
                </th>
                <td className="px-3 text-ink-2">{i.date[locale]}</td>
                <td className="px-3 text-right tnum">{fmt.money(i.amount)}</td>
                <td className="px-3 max-sm:hidden">
                  <Status tone="ok">{t('prefs.billing.paid')}</Status>
                </td>
                <td className="pr-4 text-right">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${t('prefs.billing.download')} ${i.id}`}
                  >
                    <Download aria-hidden strokeWidth={1.75} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export function LicenseSettings() {
  const t = useT();
  const fmt = useFormat();
  const app = useApp();
  const status = (
    ['valid', 'grace', 'read_only', 'invalid'].includes(app.org.license.status)
      ? app.org.license.status
      : 'valid'
  ) as 'valid';
  return (
    <Panel>
      <Row
        label={t('prefs.license.mode')}
        hint={app.mode === 'saas' ? t('prefs.license.saasLede') : t('prefs.license.offline')}
      >
        <p className="text-copy-14">
          {app.mode === 'saas' ? t('prefs.license.saas') : t('prefs.license.license')}
        </p>
      </Row>
      <Row label={t('prefs.license.status')}>
        <Status tone={status === 'valid' ? 'ok' : status === 'grace' ? 'warn' : 'bad'} soft>
          {t(`prefs.license.statuses.${status}` as MessageKey)}
        </Status>
      </Row>
      <Row label={t('prefs.license.country')}>
        <p className="text-copy-14">
          {fmt.country(app.org.countryCode)} ({app.org.countryCode})
        </p>
      </Row>
      <Row
        label={t('prefs.license.users')}
        hint={t('prefs.license.price', {
          price: fmt.money(PLANS.license.priceUsdPerYear),
          users: PLANS.license.usersIncluded,
        })}
      >
        <p className="text-copy-14 tnum">
          {app.mode === 'license' ? PLANS.license.usersIncluded : '—'}
        </p>
      </Row>
      {app.org.role !== 'owner' ? (
        <p className="border-t border-line px-4 py-3 text-label-12 font-normal text-ink-3">
          {t('prefs.license.manageOnly')}
        </p>
      ) : null}
    </Panel>
  );
}
