import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';
import { Badge, buttonVariants, CountryCode, Panel, PanelHeader, PanelTitle, cn } from '@scoutra/ui';
import { pageKit, AppHeader } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { AgentSteps, HBar, Sparkline } from '@/components/app/bits';
import { TodayTasks } from '@/components/app/today-tasks';
import { DEMO_AGENT_FEED, DEMO_CAMPAIGNS, DEMO_CREDITS, DEMO_INVOICES, DEMO_REPORTS, DEMO_SIGNALS } from '@/lib/demo/workspace';
import { DEMO_PROSPECTS } from '@/lib/demo/prospects';
import { suggestModels } from '@/lib/playbook-suggest';
import { formatNumber, formatUsd } from '@/lib/format';
import { PLANS } from '@/lib/pricing';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('home.title') };
}

export default async function HomePage() {
  const { ctx, t, locale, allowed } = await pageKit();
  const n = (v: number) => formatNumber(v, locale);
  const pct = (v: number) => formatNumber(v, locale, { style: 'percent', maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const running = DEMO_CAMPAIGNS.filter((c) => c.status === 'running');
  const totalCredits = DEMO_CREDITS.granted + DEMO_CREDITS.rollover + DEMO_CREDITS.packs;
  const first = ctx.user.name.split(' ')[0] ?? ctx.user.name;

  const header = (
    <AppHeader
      t={t}
      ctx={ctx}
      title={t('home.greeting', { name: first })}
      meta={t('home.meta', { date, n: running.length })}
      actions={
        allowed(['campaign:write']) ? (
          <Link href="/search" className={buttonVariants({ variant: 'primary' })}>
            <Plus aria-hidden strokeWidth={1.75} />
            {t('home.newSearch')}
          </Link>
        ) : null
      }
    />
  );

  // Rôle facturation : aucune donnée de prospection, seulement crédits et factures.
  if (ctx.org.dataScope === 'none') {
    return (
      <>
        {header}
        <PageBody>
          <Panel>
            <PanelHeader>
              <PanelTitle>{t('home.billingTitle')}</PanelTitle>
            </PanelHeader>
            <div className="grid gap-px bg-line sm:grid-cols-3">
              {[
                [t('home.kpi.credits'), n(totalCredits - DEMO_CREDITS.used), t('home.kpi.ofTotal', { total: n(totalCredits) })],
                [t('home.seats'), `${DEMO_CREDITS.seats}`, `${PLANS.pipeline.usersIncluded} + ${DEMO_CREDITS.seats - PLANS.pipeline.usersIncluded}`],
                [t('home.nextInvoice'), formatUsd(PLANS.pipeline.priceUsd + 2 * PLANS.pipeline.extraSeat.priceUsd, locale), DEMO_INVOICES[0]!.date[locale]],
              ].map(([label, value, sub]) => (
                <div key={label} className="bg-surface px-4 py-4">
                  <p className="text-label-13 text-ink-3">{label}</p>
                  <p className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] tnum">{value}</p>
                  <p className="text-label-12 font-normal text-ink-3">{sub}</p>
                </div>
              ))}
            </div>
            <p className="border-t border-line px-4 py-3 text-copy-14 text-ink-2">
              {t('home.billingLede')}{' '}
              <Link href="/settings/billing" className="font-medium text-accent-text hover:underline">
                {t('home.openBilling')}
              </Link>
            </p>
          </Panel>
        </PageBody>
      </>
    );
  }

  const weekly = DEMO_REPORTS.weekly.map((w) => w.delivered);
  const kpis = [
    { label: t('home.kpi.delivered'), value: n(1024), sub: t('home.kpi.vsPrev', { delta: '+18 %' }), spark: weekly },
    { label: t('home.kpi.replyRate'), value: pct(0.19), sub: t('home.kpi.vsPrev', { delta: '+3 pts' }), spark: [12, 13, 15, 14, 16, 17, 16, 18, 19, 18, 19, 19] },
    { label: t('home.kpi.meetings'), value: n(29), sub: t('home.kpi.vsPrev', { delta: '+7' }), spark: DEMO_REPORTS.weekly.map((w) => w.meetings) },
    { label: t('home.kpi.won'), value: n(18), sub: formatUsd(126400, locale), spark: [1, 1, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2] },
    { label: t('home.kpi.credits'), value: n(totalCredits - DEMO_CREDITS.used), sub: t('home.kpi.ofTotal', { total: n(totalCredits) }), spark: null },
  ];
  const stages = ['new', 'contacted', 'replied', 'meeting', 'won'] as const;
  const byStage = stages.map((s) => ({ s, items: DEMO_PROSPECTS.filter((p) => p.stage === s) }));
  const maxStage = Math.max(...byStage.map((b) => b.items.length));
  const openValue = DEMO_PROSPECTS.filter((p) => !['won', 'lost'].includes(p.stage)).reduce((a, p) => a + p.valueUsd, 0);
  const models = suggestModels(ctx.org.accountType, ctx.org.sectors);

  return (
    <>
      {header}
      <PageBody>
        {/* Bande de chiffres : un seul panneau découpé par des filets, pas des cartes séparées */}
        <section aria-label={t('home.kpi.label')} className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-line [gap:1px] md:grid-cols-5">
          {kpis.map((k, i) => (
            <div key={k.label} className={cn('flex flex-col justify-between gap-2 bg-surface px-4 py-3.5', i === 4 && 'col-span-2 md:col-span-1')}>
              <p className="text-label-13 text-ink-3">{k.label}</p>
              <div className="flex items-end justify-between gap-2">
                <p className="text-[26px] font-semibold leading-8 tracking-[-0.02em] [font-stretch:106%] tnum">{k.value}</p>
                {k.spark ? <Sparkline values={k.spark} /> : null}
              </div>
              <p className="text-label-12 font-normal text-ink-3 tnum">{k.sub}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid min-w-0 content-start gap-4">
            <Panel aria-labelledby="h-running">
              <PanelHeader>
                <PanelTitle id="h-running">{t('home.running')}</PanelTitle>
                <Badge tone="neutral" className="tnum">{running.length}</Badge>
                <span className="flex-1" />
                <Link href="/campaigns" className="text-label-13 text-ink-3 hover:text-ink">
                  {t('app.common.seeAll')}
                </Link>
              </PanelHeader>
              <ul className="divide-y divide-line">
                {running.map((c, i) => (
                  <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_96px_80px]">
                    <div className="min-w-0">
                      <Link href="/search?run=demo" className="block truncate text-label-14 font-semibold hover:underline">
                        {c.name[locale]}
                      </Link>
                      <span className="flex items-center gap-1.5 text-label-12 font-normal text-ink-3">
                        {c.countries.map((cc) => <CountryCode key={cc} code={cc} />)}
                        <span className="truncate">{c.owner}, {c.created[locale]}</span>
                      </span>
                    </div>
                    <AgentSteps done={i === 0 ? 5 : 3} label={t('home.progressLabel', { done: i === 0 ? 5 : 3 })} />
                    <span className="text-label-13 text-ink-2 tnum max-sm:hidden">{t('home.delivered', { n: c.delivered })}</span>
                    <span className="text-right text-label-13 text-ink-3 tnum max-sm:hidden">{pct(c.progress)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel aria-labelledby="h-feed">
                <PanelHeader>
                  <PanelTitle id="h-feed">{t('home.feed')}</PanelTitle>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-label-12 text-ok">
                    <i className="size-1.5 rounded-full bg-ok" aria-hidden />
                    {t('home.feedLive')}
                  </span>
                </PanelHeader>
                <ol className="px-4 py-1">
                  {DEMO_AGENT_FEED.map((f) => (
                    <li key={f.when} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-0">
                      <time className="text-label-12 font-normal text-ink-3 tnum">{f.when}</time>
                      <p className="text-[13px] leading-5 text-ink-2">
                        <b className="font-semibold text-ink">{t(`app.agents.${f.agent}`)}</b> {f.text[locale]}
                      </p>
                    </li>
                  ))}
                </ol>
              </Panel>
              <Panel aria-labelledby="h-pipe">
                <PanelHeader>
                  <PanelTitle id="h-pipe">{t('home.pipeline')}</PanelTitle>
                  <span className="ml-auto text-label-13 text-ink-3 tnum">{t('home.pipelineValue', { value: formatUsd(openValue, locale) })}</span>
                </PanelHeader>
                <ul className="grid gap-3 px-4 py-4">
                  {byStage.map(({ s, items }) => (
                    <li key={s} className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3 text-[13px]">
                      <Link href="/pipeline" className="text-ink-2 hover:text-ink">{t(`app.stages.${s}`)}</Link>
                      <HBar value={items.length} max={maxStage} highlight={s === 'won'} />
                      <span className="text-right font-semibold tnum">{items.length}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line px-4 py-3">
                  <p className="mb-2 text-label-13">{t('home.playbooks')}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {models.map((m) => (
                      <li key={m}>
                        <Link href={`/playbooks?model=${m}`} className="inline-flex h-7 items-center gap-1 rounded-sm border border-line px-2 text-label-12 text-ink-2 hover:border-line-strong hover:text-ink">
                          {t(`prospectingModels.${m}` as never)}
                          <ArrowUpRight className="size-3" strokeWidth={1.75} aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {!ctx.org.onboardingComplete ? (
                    <p className="mt-2 text-label-12 font-normal text-ink-3">
                      {t('home.completeProfile')}{' '}
                      <Link href="/settings/organization" className="text-accent-text hover:underline">{t('home.completeProfileCta')}</Link>
                    </p>
                  ) : null}
                </div>
              </Panel>
            </div>
          </div>

          <div className="grid content-start gap-4">
            <Panel aria-labelledby="h-today">
              <PanelHeader>
                <PanelTitle id="h-today">{t('home.today')}</PanelTitle>
                <Link href="/tasks" className="ml-auto text-label-13 text-ink-3 hover:text-ink">{t('app.common.seeAll')}</Link>
              </PanelHeader>
              <TodayTasks canWrite={ctx.org.permissions.includes('task:write')} />
            </Panel>
            <Panel aria-labelledby="h-signals">
              <PanelHeader>
                <PanelTitle id="h-signals">{t('home.signals')}</PanelTitle>
                <Link href="/signals" className="ml-auto text-label-13 text-ink-3 hover:text-ink">{t('app.common.seeAll')}</Link>
              </PanelHeader>
              <ul className="divide-y divide-line">
                {DEMO_SIGNALS.slice(0, 4).map((s) => (
                  <li key={s.id} className="px-4 py-2.5">
                    <p className="flex items-center gap-2 text-label-14 font-semibold">
                      <span className="truncate">{s.org}</span>
                      <CountryCode code={s.cc} />
                      <span className="ml-auto shrink-0 text-label-12 font-normal text-ink-3">{s.when[locale]}</span>
                    </p>
                    <p className="text-[13px] leading-5 text-ink-2">{s.text[locale]}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
