import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { buttonVariants, cn, CountryCode, Status } from '@scoutra/ui';
import { getT } from '@/lib/i18n/server';
import { HeroDemo } from '@/components/marketing/hero-demo';
import { Grid12, Rails, Wrap } from '@/components/marketing/frame';
import { formatUsd } from '@/lib/format';
import { CREDIT_PACKS, PLANS, ROLLOVER_SHARE, WRITING_SURCHARGE } from '@/lib/pricing';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { absolute: t('marketing.meta.title') },
    description: t('marketing.meta.description'),
  };
}

const sec = 'border-b border-line py-[72px] min-[900px]:py-[120px]';
const introSide =
  'col-span-12 mb-10 grid content-start gap-4 lg:sticky lg:top-[104px] lg:col-span-4 lg:mb-0';
const bodySide = 'col-span-12 min-w-0 lg:col-span-7 lg:col-start-6';

export default async function LandingPage() {
  const { t, locale } = await getT();
  const nf = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US');
  const money = (v: number) => formatUsd(v, locale);
  const pct = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'percent',
  }).format(ROLLOVER_SHARE);

  const whoRows = [
    'agency',
    'maker',
    'ngo',
    'recruiting',
    'craft',
    'saas',
    'realestate',
    'sourcing',
    'public',
  ] as const;
  const steps = [
    ['interpret', '10:42:03'],
    ['search', '10:42:11'],
    ['enrich', '10:43:02'],
    ['verify', '10:44:20'],
    ['score', '10:44:51'],
    ['write', '10:45:09'],
  ] as const;
  const bars = [
    ['r1', 30],
    ['r2', 22],
    ['r3', 18],
    ['r4', 14],
    ['r5', 10],
  ] as const;
  const funnel = [
    ['contacted', 41, 310],
    ['replied', 20, 61],
    ['meeting', 48, 29],
    ['won', 62, 18],
  ] as const;
  const rules = ['eu', 'uk', 'us', 'ca', 'br', 'apac', 'africa'] as const;

  const yes = (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <Check className="size-4 text-ok" strokeWidth={2} aria-hidden />
      <span className="sr-only">{t('marketing.pricing.included')}</span>
    </span>
  );
  const no = (
    <span className="inline-flex items-center gap-1.5 text-ink-3">
      <Minus className="size-4" strokeWidth={1.75} aria-hidden />
      {t('marketing.pricing.notIncluded')}
    </span>
  );
  type Cell = React.ReactNode;
  const priceRows: [string, Cell, Cell, Cell][] = [
    [t('marketing.pricing.rows.nl'), yes, yes, yes],
    [t('marketing.pricing.rows.kinds'), yes, yes, yes],
    [t('marketing.pricing.rows.zones'), yes, yes, t('marketing.pricing.licenseZone')],
    [t('marketing.pricing.rows.quality'), yes, yes, yes],
    [t('marketing.pricing.rows.export'), yes, yes, yes],
    [t('marketing.pricing.rows.pipeline'), no, yes, yes],
    [t('marketing.pricing.rows.dashboards'), no, yes, yes],
    [
      t('marketing.pricing.rows.credits'),
      <b key="c1" className="font-semibold tnum">
        {nf.format(PLANS.search.creditsPerMonth)}
      </b>,
      <b key="c2" className="font-semibold tnum">
        {nf.format(PLANS.pipeline.creditsPerMonth)}
      </b>,
      t('marketing.pricing.unlimited'),
    ],
    [
      t('marketing.pricing.rows.users'),
      nf.format(PLANS.search.usersIncluded),
      t('marketing.pricing.usersPipeline', {
        n: PLANS.pipeline.usersIncluded,
        price: money(PLANS.pipeline.extraSeat.priceUsd),
        credits: nf.format(PLANS.pipeline.extraSeat.credits),
      }),
      t('marketing.pricing.usersLicense', {
        n: PLANS.license.usersIncluded,
        price: money(PLANS.license.extraUserUsdPerYear),
      }),
    ],
    [
      t('marketing.pricing.rows.campaigns'),
      nf.format(PLANS.search.concurrentCampaigns),
      nf.format(PLANS.pipeline.concurrentCampaigns),
      t('marketing.pricing.campaignsUnlimited'),
    ],
    [
      t('marketing.pricing.rows.rollover'),
      t('marketing.pricing.rolloverValue', { pct }),
      t('marketing.pricing.rolloverValue', { pct }),
      '—',
    ],
    [
      t('marketing.pricing.rows.hosting'),
      t('marketing.pricing.byScoutra'),
      t('marketing.pricing.byScoutra'),
      t('marketing.pricing.yourServers'),
    ],
  ];
  const plans = [
    {
      id: 'search',
      name: t('marketing.pricing.search'),
      for: t('marketing.pricing.searchFor'),
      amt: money(PLANS.search.priceUsd),
      per: t('marketing.pricing.perMonth'),
      href: '/signup?plan=search',
      cta: t('marketing.pricing.choose', { plan: t('marketing.pricing.search') }),
      hl: false,
    },
    {
      id: 'pipeline',
      name: t('marketing.pricing.pipeline'),
      for: t('marketing.pricing.pipelineFor'),
      amt: money(PLANS.pipeline.priceUsd),
      per: t('marketing.pricing.perMonth'),
      href: '/signup?plan=pipeline',
      cta: t('marketing.pricing.choose', { plan: t('marketing.pricing.pipeline') }),
      hl: true,
    },
    {
      id: 'license',
      name: t('marketing.pricing.license'),
      for: t('marketing.pricing.licenseFor'),
      amt: money(PLANS.license.priceUsdPerYear),
      per: t('marketing.pricing.perYear'),
      href: 'mailto:contact@scoutra.ai',
      cta: t('marketing.pricing.talk'),
      hl: false,
    },
  ];

  return (
    <>
      {/* Hero : titre à gauche, chapeau à droite, puis l'app elle-même sur l'aplat orange */}
      <Rails aria-labelledby="h-hero" className="pt-[72px] min-[1000px]:pt-16">
        <Wrap>
          <Grid12 className="items-end gap-y-7">
            <h1
              id="h-hero"
              className="t-display col-span-12 max-w-[15.5em] text-balance min-[1000px]:col-span-8"
            >
              {t('marketing.hero.title')}
            </h1>
            <div className="col-span-12 grid gap-6 min-[1000px]:col-span-4 min-[1000px]:col-start-9 min-[1000px]:pb-1.5">
              <p className="max-w-[46ch] text-copy-18 text-ink-2">{t('marketing.hero.lede')}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/signup" className={buttonVariants({ variant: 'ink', size: 'lg' })}>
                  {t('marketing.hero.cta')}
                </Link>
                <a href="#tarifs" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                  {t('marketing.hero.ctaSecondary')}
                </a>
              </div>
              <p className="text-label-13 font-normal text-ink-3">{t('marketing.hero.fine')}</p>
            </div>
          </Grid12>
          <HeroDemo />
        </Wrap>
      </Rails>

      <section aria-label={t('marketing.facts.title')} className="border-b border-line">
        <Wrap className="py-7">
          <p className="max-w-[92ch] text-copy-14 text-ink-2">
            <b className="font-semibold text-ink">{t('marketing.facts.title')}</b> :{' '}
            {t('marketing.facts.body')}
          </p>
        </Wrap>
      </section>

      {/* Pour qui : tableau à trois colonnes, une ligne par profil */}
      <Rails id="pour-qui" aria-labelledby="h-who" className={sec}>
        <Wrap>
          <Grid12>
            <div className="col-span-12 mb-10 grid max-w-[60ch] gap-4 lg:col-span-8">
              <h2 id="h-who" className="t-heading-40 text-balance">
                {t('marketing.who.title')}
              </h2>
              <p className="text-copy-16 text-ink-2">{t('marketing.who.lede')}</p>
            </div>
            <div className="col-span-12">
              <table className="w-full border-t border-ink text-[14.5px]">
                <thead className="max-md:hidden">
                  <tr className="text-left text-label-13 text-ink-3">
                    <th scope="col" className="w-[22%] py-3 pr-4 font-medium">
                      {t('marketing.who.colWho')}
                    </th>
                    <th scope="col" className="w-[30%] py-3 pr-4 font-medium">
                      {t('marketing.who.colWant')}
                    </th>
                    <th scope="col" className="py-3 font-medium">
                      {t('marketing.who.colAsk')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {whoRows.map((k) => (
                    <tr
                      key={k}
                      className="border-b border-line align-top max-md:grid max-md:gap-1 max-md:py-4"
                    >
                      <th scope="row" className="py-4 pr-4 text-left font-semibold max-md:py-0">
                        {t(`marketing.who.rows.${k}.who`)}
                      </th>
                      <td className="py-4 pr-4 text-ink-2 max-md:py-0">
                        {t(`marketing.who.rows.${k}.want`)}
                      </td>
                      <td className="py-4 text-ink max-md:py-0 max-md:pt-1">
                        <q>{t(`marketing.who.rows.${k}.ask`)}</q>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-5 max-w-[78ch] text-copy-14 text-ink-2">{t('marketing.who.foot')}</p>
            </div>
          </Grid12>
        </Wrap>
      </Rails>

      {/* Fonctionnement : journal horodaté (vraie séquence) */}
      <Rails id="fonctionnement" aria-labelledby="h-how" className={sec}>
        <Wrap>
          <Grid12>
            <div className={introSide}>
              <h2 id="h-how" className="t-heading-40 text-balance">
                {t('marketing.how.title')}
              </h2>
              <p className="max-w-[52ch] text-copy-16 text-ink-2">{t('marketing.how.lede')}</p>
              <p className="text-label-13 text-ink-3">{t('marketing.how.note')}</p>
            </div>
            <ol className={cn(bodySide, 'border-t border-ink')}>
              {steps.map(([k, time]) => (
                <li
                  key={k}
                  className="grid grid-cols-[76px_minmax(0,1fr)] gap-4 border-b border-line py-5"
                >
                  <time
                    dateTime={time}
                    className="pt-0.5 text-label-13 font-normal text-ink-3 tnum"
                  >
                    {time}
                  </time>
                  <div>
                    <h3 className="t-heading-16">{t(`marketing.how.steps.${k}.title`)}</h3>
                    <p className="max-w-[58ch] text-[15px] leading-6 text-ink-2">
                      {t(`marketing.how.steps.${k}.body`)}
                    </p>
                    <p className="mt-2.5 rounded-r-sm border-l-2 border-accent bg-canvas px-3 py-2 text-[13.5px] leading-5 text-ink tnum">
                      {t(`marketing.how.steps.${k}.out`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Grid12>
        </Wrap>
      </Rails>

      {/* Score expliqué : fiche à gauche (7 col.), types de cibles à droite */}
      <Rails aria-labelledby="h-score" className={sec}>
        <Wrap>
          <Grid12 className="items-start gap-y-10">
            <article
              aria-label={t('marketing.score.card')}
              className="col-span-12 overflow-hidden rounded-lg border border-line bg-surface lg:col-span-7"
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5 max-sm:px-4">
                <div>
                  <h3 className="t-heading-20">{t('marketing.score.person')}</h3>
                  <p className="text-label-13 font-normal text-ink-3">
                    {t('marketing.score.role')} <CountryCode code="FR" />
                  </p>
                </div>
                <p className="text-[40px] font-semibold leading-10 tracking-[-0.03em] [font-stretch:110%]">
                  94
                  <small className="ml-0.5 text-[14px] font-medium tracking-normal text-ink-3">
                    /100
                  </small>
                </p>
              </div>
              <div className="grid gap-6 px-6 py-5 max-sm:px-4">
                <figure>
                  <figcaption className="mb-3 text-[14px] font-semibold">
                    {t('marketing.score.chartTitle')}
                  </figcaption>
                  <ul className="grid gap-2.5">
                    {bars.map(([k, v]) => (
                      <li
                        key={k}
                        title={t('marketing.score.points', { n: v })}
                        className="grid grid-cols-[minmax(0,1fr)_80px_30px] items-center gap-3 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_150px_34px]"
                      >
                        <span>{t(`marketing.score.${k}`)}</span>
                        <span className="relative h-2.5 rounded-[2px] bg-sunken" aria-hidden>
                          <i
                            className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent"
                            style={{ width: `${(v / 30) * 100}%` }}
                          />
                        </span>
                        <span className="text-right font-semibold tnum">+{v}</span>
                      </li>
                    ))}
                  </ul>
                  <table className="sr-only">
                    <caption>{t('marketing.score.tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('marketing.score.colCriterion')}</th>
                        <th scope="col">{t('marketing.score.colPoints')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bars.map(([k, v]) => (
                        <tr key={k}>
                          <td>{t(`marketing.score.${k}`)}</td>
                          <td>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </figure>
                <div>
                  <p className="mb-2 text-[14px] font-semibold">
                    {t('marketing.score.messageTitle')}
                  </p>
                  <div className="rounded-md border border-line bg-canvas px-4 py-3.5 text-copy-14 text-ink-2">
                    <b className="font-semibold text-ink">{t('marketing.score.subject')}</b>
                    <p className="mt-3">{t('marketing.score.greeting')}</p>
                    <p className="mt-3">{t('marketing.score.body')}</p>
                    <p className="mt-3">{t('marketing.score.ask')}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-6 py-4 max-sm:px-4">
                <Status tone="ok" className="whitespace-normal [overflow-wrap:anywhere]">
                  {t('marketing.score.confirmed')}
                </Status>
                <span className="ml-auto text-[12.5px] text-ink-3">
                  {t('marketing.score.source')}
                </span>
              </div>
            </article>
            <div className="col-span-12 grid content-start gap-4 lg:col-span-4 lg:col-start-9">
              <h2 id="h-score" className="t-heading-40 text-balance">
                {t('marketing.score.title')}
              </h2>
              <p className="max-w-[52ch] text-copy-16 text-ink-2">{t('marketing.score.lede')}</p>
              <ul className="mt-4 border-t border-ink">
                {(['companies', 'people', 'both'] as const).map((k) => (
                  <li key={k} className="grid gap-1 border-b border-line py-[18px]">
                    <h3 className="t-heading-16">{t(`marketing.score.kinds.${k}`)}</h3>
                    <p className="text-[15px] leading-6 text-ink-2">
                      {t(`marketing.score.kinds.${k}Body`)}
                    </p>
                    <q className="mt-1.5 block text-copy-14 text-ink">
                      {t(`marketing.score.kinds.${k}Ask`)}
                    </q>
                  </li>
                ))}
              </ul>
            </div>
          </Grid12>
        </Wrap>
      </Rails>

      {/* Section sombre (une seule) : Pipeline */}
      <Rails
        dark
        id="pipeline"
        aria-labelledby="h-pipe"
        className="bg-dark py-[72px] text-dark-text min-[900px]:py-[120px]"
      >
        <Wrap>
          <Grid12 className="gap-y-10">
            <div className="col-span-12 grid content-start gap-4 lg:col-span-4">
              <h2 id="h-pipe" className="t-heading-40 text-balance text-white">
                {t('marketing.pipeline.title')}
              </h2>
              <p className="max-w-[52ch] text-copy-16 text-dark-2">
                {t('marketing.pipeline.lede')}
              </p>
              <div className="mt-2">
                <Link
                  href="/signup?plan=pipeline"
                  className={buttonVariants({ variant: 'primary', size: 'lg' })}
                >
                  {t('marketing.pipeline.cta')}
                </Link>
              </div>
            </div>
            <section
              aria-labelledby="h-funnel"
              className="col-span-12 min-w-0 rounded-lg border border-dark-line px-[22px] py-5 lg:col-span-4 lg:col-start-6"
            >
              <h3 id="h-funnel" className="text-[15px] font-semibold text-white">
                {t('marketing.pipeline.funnelTitle')}
              </h3>
              <p className="mt-0.5 text-label-13 font-normal text-dark-2">
                {t('marketing.pipeline.funnelSub')}
              </p>
              <ol className="mt-5 grid gap-3" aria-hidden>
                {funnel.map(([k, rate, n]) => (
                  <li
                    key={k}
                    className="grid grid-cols-[92px_minmax(0,1fr)_44px_40px] items-center gap-3 text-[13.5px]"
                  >
                    <span>{t(`marketing.pipeline.${k}`)}</span>
                    <span className="relative h-3 rounded-[2px] bg-[#1d2028]">
                      <i
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-r-[4px]',
                          k === 'won' ? 'bg-accent' : 'bg-[#3a3f4b]',
                        )}
                        style={{ width: `${rate}%` }}
                      />
                    </span>
                    <span className="text-right text-[12.5px] text-dark-2 tnum">{rate} %</span>
                    <span className="text-right font-semibold text-white tnum">{n}</span>
                  </li>
                ))}
              </ol>
              <table className="sr-only">
                <caption>{t('marketing.pipeline.tableCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('marketing.pipeline.colStage')}</th>
                    <th scope="col">{t('marketing.pipeline.colRate')}</th>
                    <th scope="col">{t('marketing.pipeline.colCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map(([k, rate, n]) => (
                    <tr key={k}>
                      <th scope="row">{t(`marketing.pipeline.${k}`)}</th>
                      <td>{rate} %</td>
                      <td>{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-label-13 font-normal text-dark-2">
                {t('marketing.pipeline.insight')}
              </p>
            </section>
            <section
              aria-labelledby="h-todo"
              className="col-span-12 min-w-0 rounded-lg border border-dark-line px-[22px] py-5 lg:col-span-3"
            >
              <h3 id="h-todo" className="text-[15px] font-semibold text-white">
                {t('marketing.pipeline.todoTitle')}
              </h3>
              <p className="mt-0.5 text-label-13 font-normal text-dark-2">
                {t('marketing.pipeline.todoSub')}
              </p>
              <ul className="mt-3.5">
                {[
                  ['Émilie Gagnon', 't2', '09:30', false],
                  ['Rachel Kim', 't1', t('marketing.pipeline.yesterday'), true],
                  ['Tiago Ferreira', 't3', '11:00', false],
                  ['Marc Lefebvre', 't4', '14:00', false],
                ].map(([name, k, time, late]) => (
                  <li
                    key={name as string}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-dark-line py-3 text-[14px] last:border-0"
                  >
                    <div>
                      <b className="font-semibold text-white">{name as string}</b>
                      <span className="block text-label-13 font-normal text-dark-2">
                        {t(`marketing.pipeline.${k as 't1'}`)}
                      </span>
                    </div>
                    <time
                      className={cn(
                        'text-label-13 font-normal',
                        late ? 'text-[#ff9a73]' : 'text-dark-2',
                      )}
                    >
                      {time as string}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          </Grid12>
        </Wrap>
      </Rails>

      {/* Conformité : tableau par zone */}
      <Rails id="conformite" aria-labelledby="h-conf" className={sec}>
        <Wrap>
          <div className="mb-10 grid max-w-[60ch] gap-4">
            <h2 id="h-conf" className="t-heading-40 text-balance">
              {t('marketing.compliance.title')}
            </h2>
            <p className="text-copy-16 text-ink-2">{t('marketing.compliance.lede')}</p>
          </div>
          <table className="w-full border-t border-ink text-[14.5px]">
            <thead className="max-md:hidden">
              <tr className="text-left text-label-13 text-ink-3">
                <th scope="col" className="py-3 pr-4 font-medium">
                  {t('marketing.compliance.colZone')}
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  {t('marketing.compliance.colCompanies')}
                </th>
                <th scope="col" className="py-3 font-medium">
                  {t('marketing.compliance.colPeople')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((k) => (
                <tr
                  key={k}
                  className="border-b border-line align-top max-md:grid max-md:gap-1.5 max-md:py-3"
                >
                  <th
                    scope="row"
                    className="w-[28%] py-3.5 pr-4 text-left font-semibold max-md:w-auto max-md:py-0"
                  >
                    {t(`marketing.compliance.${k}`)}
                    <small className="block text-label-13 font-normal text-ink-3">
                      {t(`marketing.compliance.${k}Law`)}
                    </small>
                  </th>
                  <td className="py-3.5 pr-4 max-md:py-0">
                    <span className="sr-only md:hidden">
                      {t('marketing.compliance.colCompanies')} :{' '}
                    </span>
                    <Status
                      tone="ok"
                      className="items-start whitespace-normal text-[14.5px] leading-5 [&_svg]:mt-[3px]"
                    >
                      {t(`marketing.compliance.${k}B`)}
                    </Status>
                  </td>
                  <td className="py-3.5 max-md:py-0">
                    <span className="sr-only md:hidden">
                      {t('marketing.compliance.colPeople')} :{' '}
                    </span>
                    <Status
                      tone="warn"
                      className="items-start whitespace-normal text-[14.5px] leading-5 [&_svg]:mt-[3px]"
                    >
                      {t(`marketing.compliance.${k}C`)}
                    </Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 max-w-[78ch] text-copy-14 text-ink-2">
            {t('marketing.compliance.foot')}
          </p>
        </Wrap>
      </Rails>

      {/* Tarifs : tableau comparatif (pas de grille de cartes) */}
      <Rails id="tarifs" aria-labelledby="h-tarifs" className={sec}>
        <Wrap>
          <div className="mb-10 grid max-w-[62ch] gap-4">
            <h2 id="h-tarifs" className="t-heading-40">
              {t('marketing.pricing.title')}
            </h2>
            <p className="text-copy-16 text-ink-2">{t('marketing.pricing.lede')}</p>
          </div>
          <div className="border-t border-ink max-md:hidden">
            <table className="w-full table-fixed text-[14.5px]">
              <caption className="sr-only">{t('marketing.pricing.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[31%]">
                    <span className="sr-only">{t('marketing.pricing.feature')}</span>
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className={cn(
                        'px-4 py-6 text-left align-top font-normal',
                        p.hl && 'bg-canvas',
                      )}
                    >
                      <span className="block text-[16px] font-semibold">{p.name}</span>
                      <span className="mb-3.5 mt-0.5 block text-[13.5px] leading-5 text-ink-3">
                        {p.for}
                      </span>
                      <span className="block text-[32px] font-semibold leading-9 tracking-[-0.03em] [font-stretch:110%] tnum">
                        {p.amt}
                      </span>
                      <span className="mb-4 block text-label-13 font-normal text-ink-3">
                        {p.per}
                      </span>
                      <Link
                        href={p.href}
                        className={buttonVariants({
                          variant: p.hl ? 'ink' : 'secondary',
                          size: 'sm',
                        })}
                      >
                        {p.cta}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priceRows.map(([label, a, b, c]) => (
                  <tr key={label} className="border-t border-line align-top">
                    <th scope="row" className="py-3 pr-4 text-left font-medium text-ink-2">
                      {label}
                    </th>
                    <td className="px-4 py-3">{a}</td>
                    <td className="bg-canvas px-4 py-3">{b}</td>
                    <td className="px-4 py-3">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile : une formule après l'autre, mêmes informations */}
          <div className="grid gap-4 md:hidden">
            {plans.map((p, i) => (
              <section
                key={p.id}
                aria-label={p.name}
                className={cn('rounded-lg border border-line p-5', p.hl && 'border-ink')}
              >
                <span className="block text-[16px] font-semibold">{p.name}</span>
                <span className="mt-0.5 block text-[13.5px] text-ink-3">{p.for}</span>
                <span className="mt-3 block text-[32px] font-semibold leading-9 tracking-[-0.03em] tnum">
                  {p.amt}
                </span>
                <span className="block text-label-13 font-normal text-ink-3">{p.per}</span>
                <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-copy-14">
                  {priceRows.map((r) => (
                    <div key={r[0]} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <dt className="text-ink-2">{r[0]}</dt>
                      <dd className="text-right">{r[i + 1]}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={p.href}
                  className={cn(
                    buttonVariants({ variant: p.hl ? 'ink' : 'secondary', size: 'lg' }),
                    'mt-4 w-full',
                  )}
                >
                  {p.cta}
                </Link>
              </section>
            ))}
          </div>
          <div className="mt-10 grid gap-8 border-t border-line pt-8 md:grid-cols-3">
            <div>
              <h3 className="t-heading-16">{t('marketing.pricing.packsTitle')}</h3>
              <p className="mt-1 text-copy-14 text-ink-2">{t('marketing.pricing.packsBody')}</p>
              <table className="mt-3 w-full text-copy-14">
                <tbody>
                  {CREDIT_PACKS.map((p) => (
                    <tr key={p.credits} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 text-left font-medium">
                        {t('marketing.pricing.pack', { credits: nf.format(p.credits) })}
                      </th>
                      <td className="py-2 text-right font-semibold tnum">{money(p.priceUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="t-heading-16">{t('marketing.pricing.optionsTitle')}</h3>
              <p className="mt-1 text-copy-14 text-ink-2">
                {t('marketing.pricing.optionsBody', {
                  careful: WRITING_SURCHARGE.careful,
                  premium: WRITING_SURCHARGE.premium,
                })}
              </p>
            </div>
            <div>
              <h3 className="t-heading-16">{t('marketing.pricing.paymentTitle')}</h3>
              <p className="mt-1 text-copy-14 text-ink-2">{t('marketing.pricing.paymentBody')}</p>
              <p className="mt-3 flex gap-2 text-label-12">
                <span className="rounded-xs border border-line px-1.5 py-0.5">Visa</span>
                <span className="rounded-xs border border-line px-1.5 py-0.5">Mastercard</span>
              </p>
            </div>
          </div>
          <p className="mt-8 text-label-13 font-normal text-ink-3">{t('marketing.pricing.note')}</p>
        </Wrap>
      </Rails>

      {/* FAQ en liste */}
      <Rails id="faq" aria-labelledby="h-faq" className={cn(sec, 'border-b-0')}>
        <Wrap>
          <Grid12>
            <div className={introSide}>
              <h2 id="h-faq" className="t-heading-40">
                {t('marketing.faq.title')}
              </h2>
            </div>
            <div className={cn(bodySide, 'border-t border-ink')}>
              {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                <details key={n} className="group border-b border-line">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                    {t(`marketing.faq.q${n}`)}
                    <span
                      aria-hidden
                      className="text-[20px] font-normal text-ink-3 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-[62ch] pb-5 text-copy-16 text-ink-2">
                    {t(`marketing.faq.a${n}`)}
                  </p>
                </details>
              ))}
            </div>
          </Grid12>
        </Wrap>
      </Rails>
    </>
  );
}
