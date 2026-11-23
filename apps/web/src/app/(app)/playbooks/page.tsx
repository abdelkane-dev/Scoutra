import type { Metadata } from 'next';
import Link from 'next/link';
import { Play, ShieldAlert } from 'lucide-react';
import { PLAYBOOKS, suggestPlaybooks } from '@scoutra/agents';
import type { AccountType, Sector } from '@scoutra/core';
import type { MessageKey } from '@scoutra/i18n';
import { Badge, buttonVariants, cn } from '@scoutra/ui';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.playbooks.title') };
}

/** Playbooks réels (@scoutra/agents) : sélection par ?model=, rendu serveur, aucun JavaScript requis. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const { ctx, t, locale, allowed } = await pageKit();
  if (!allowed(['campaign:read']))
    return <NotAllowed t={t} ctx={ctx} title="work.playbooks.title" />;
  const { model } = await searchParams;
  const ranked = suggestPlaybooks(
    ctx.org.accountType as AccountType | null,
    ctx.org.sectors as Sector[],
  );
  const suggested = ranked
    .filter((r) => r.score > 0)
    .slice(0, 5)
    .map((r) => r.model);
  const current =
    PLAYBOOKS.find((p) => p.model === model) ??
    PLAYBOOKS.find((p) => p.model === suggested[0]) ??
    PLAYBOOKS[0]!;
  const name = (m: string) => t(`prospectingModels.${m}` as MessageKey);
  const item = (m: string) => (
    <li key={m}>
      <Link
        href={`/playbooks?model=${m}`}
        aria-current={current.model === m ? 'page' : undefined}
        className={cn(
          'flex min-h-9 items-center gap-2 rounded-sm px-2.5 py-1.5 text-label-14 text-ink-2 hover:bg-hover hover:text-ink max-lg:min-h-11',
          current.model === m && 'bg-accent-soft text-ink shadow-[inset_2px_0_0_var(--accent)]',
        )}
      >
        {name(m)}
      </Link>
    </li>
  );
  const audience = {
    business: t('work.playbooks.audienceBusiness'),
    individual: t('work.playbooks.audienceIndividual'),
    per_prospect: t('work.playbooks.audiencePer'),
  }[current.audience];
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.prospecting') }}
        title={t('work.playbooks.title')}
        meta={t('work.playbooks.meta')}
        demo={false}
      />
      <PageBody className="lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav
          aria-label={t('work.playbooks.all')}
          className="grid content-start gap-4 rounded-lg border border-line bg-surface p-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto"
        >
          {suggested.length ? (
            <div>
              <p className="px-2.5 pb-1 pt-1.5 text-label-12 text-ink-3">
                {t('work.playbooks.suggested')}
              </p>
              <ul className="grid gap-0.5">{suggested.map(item)}</ul>
            </div>
          ) : null}
          <div>
            <p className="px-2.5 pb-1 pt-1.5 text-label-12 text-ink-3">{t('work.playbooks.all')}</p>
            <ul className="grid gap-0.5">
              {PLAYBOOKS.filter((p) => !suggested.includes(p.model)).map((p) => item(p.model))}
            </ul>
          </div>
        </nav>
        <article
          className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface"
          aria-labelledby="h-pb"
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id="h-pb" className="t-heading-20">
                {name(current.model)}
              </h2>
              <p className="text-label-13 font-normal text-ink-3">
                {t('work.playbooks.version', { n: current.version })}
              </p>
            </div>
            {allowed(['campaign:write']) ? (
              <Link
                href={`/search?model=${current.model}`}
                className={buttonVariants({ variant: 'primary' })}
              >
                <Play aria-hidden strokeWidth={1.75} />
                {t('work.playbooks.use')}
              </Link>
            ) : null}
          </header>
          {current.audience !== 'business' ? (
            <p className="flex items-start gap-2 border-b border-line bg-warn-soft px-5 py-3 text-copy-14 text-warn">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {t('work.playbooks.individualsNote')}
            </p>
          ) : null}
          <dl className="grid divide-y divide-line">
            {[
              [
                t('work.playbooks.angle'),
                <p key="a" className="text-copy-16 text-ink">
                  {current.messageAngle[locale]}
                </p>,
              ],
              [
                t('work.playbooks.kinds'),
                <span key="k" className="flex flex-wrap gap-1.5">
                  {current.kinds.map((k) => (
                    <Badge key={k}>{t(`prospectKinds.${k}` as MessageKey)}</Badge>
                  ))}
                </span>,
              ],
              [t('work.playbooks.audience'), <span key="au">{audience}</span>],
              [
                t('work.playbooks.signals'),
                <span key="s" className="flex flex-wrap gap-1.5">
                  {current.signals.length
                    ? current.signals.map((s) => (
                        <Badge key={s} tone="outline">
                          {t(`work.signalNames.${s}` as MessageKey)}
                        </Badge>
                      ))
                    : '—'}
                </span>,
              ],
              [
                t('work.playbooks.channels'),
                <span key="c" className="flex flex-wrap gap-1.5">
                  {current.channels.map((c) => (
                    <Badge key={c} tone="outline">
                      {t(`work.channelNames.${c}` as MessageKey)}
                    </Badge>
                  ))}
                </span>,
              ],
              [
                t('work.playbooks.sources'),
                <ol key="so" className="grid gap-1 text-copy-14">
                  {current.connectors.map((c, i) => (
                    <li key={c} className="flex gap-2">
                      <span className="w-4 text-ink-3 tnum">{i + 1}</span>
                      <code className="text-label-13">{c}</code>
                    </li>
                  ))}
                </ol>,
              ],
              [
                t('work.playbooks.rules'),
                <ul key="r" className="grid gap-1 text-copy-14 text-ink-2">
                  <li>{t('work.playbooks.minScore', { n: current.rules.minScore })}</li>
                  <li>
                    {t('work.playbooks.maxDefault', { n: current.rules.defaultMaxProspects })}
                  </li>
                  {current.rules.publicSignalsOnly ? (
                    <li>{t('work.playbooks.publicOnly')}</li>
                  ) : null}
                </ul>,
              ],
            ].map(([k, v], i) => (
              <div key={i} className="grid gap-2 px-5 py-4 md:grid-cols-[200px_minmax(0,1fr)]">
                <dt className="text-label-13 text-ink-3">{k}</dt>
                <dd className="min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      </PageBody>
    </>
  );
}
