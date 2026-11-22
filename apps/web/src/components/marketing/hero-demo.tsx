'use client';
import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RotateCcw, Search, KanbanSquare, Users, Download } from 'lucide-react';
import { CountryCode, Score, Status, cn } from '@scoutra/ui';
import { Logo } from '@/components/brand/logo';
import { useLocale, useT } from '@/lib/i18n/client';

/* Données de démonstration (personnes et cabinets fictifs). */
const ROWS = [
  {
    name: 'Dr Claire Fontaine',
    org: 'Cabinet Dentaire Confluence',
    city: { fr: 'Lyon', en: 'Lyon' },
    cc: 'FR',
    mail: 'ok',
    score: 94,
  },
  {
    name: 'Dr Émilie Gagnon',
    org: 'Clinique Dentaire Rosemont',
    city: { fr: 'Montréal', en: 'Montreal' },
    cc: 'CA',
    mail: 'ok',
    score: 89,
  },
  {
    name: 'Dr Rachel Kim',
    org: 'South Congress Dental Studio',
    city: { fr: 'Austin', en: 'Austin' },
    cc: 'US',
    mail: 'ok',
    score: 86,
  },
  {
    name: 'Dr Tiago Ferreira',
    org: 'Clínica Dentária Alfama',
    city: { fr: 'Lisbonne', en: 'Lisbon' },
    cc: 'PT',
    mail: 'ok',
    score: 82,
  },
  {
    name: 'Dr Marc Lefebvre',
    org: 'Centre Dentaire Plateau',
    city: { fr: 'Montréal', en: 'Montreal' },
    cc: 'CA',
    mail: 'phone',
    score: 77,
  },
  {
    name: 'Dr Thomas Girard',
    org: 'Centre Dentaire Part-Dieu',
    city: { fr: 'Lyon', en: 'Lyon' },
    cc: 'FR',
    mail: 'ok',
    score: 74,
  },
  {
    name: 'Dr Ana Ribeiro',
    org: 'Sorriso Lapa',
    city: { fr: 'Lisbonne', en: 'Lisbon' },
    cc: 'PT',
    mail: 'warn',
    score: 68,
  },
] as const;

const AGENTS = [
  { key: 'interpret', out: 'interpretOut', n: 0 },
  { key: 'search', out: 'searchOut', n: 286 },
  { key: 'enrich', out: 'enrichOut', n: 171 },
  { key: 'verify', out: 'verifyOut', n: 132 },
  { key: 'score', out: 'scoreOut', n: 0 },
  { key: 'write', out: 'writeOut', n: 8 },
] as const;

type Phase = { typed: number; agents: number; rows: number; done: boolean };
const FINAL = (q: number): Phase => ({
  typed: q,
  agents: AGENTS.length,
  rows: ROWS.length,
  done: true,
});

/**
 * L'unique séquence non déclenchée par l'utilisateur de la page (charte §8).
 * Rendu serveur = état final (visible sans JavaScript) ; la séquence ne se joue qu'après
 * hydratation et jamais si l'utilisateur demande moins de mouvement.
 */
export function HeroDemo() {
  const t = useT();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const query = t('marketing.hero.query');
  const [p, setP] = React.useState<Phase>(() => FINAL(query.length));
  const [run, setRun] = React.useState(0);

  React.useEffect(() => {
    if (reduce) {
      setP(FINAL(query.length));
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, f: () => void) =>
      timers.push(window.setTimeout(() => !cancelled && f(), ms));
    setP({ typed: 0, agents: 0, rows: 0, done: false });
    const typeMs = 1100;
    const steps = 24;
    for (let i = 1; i <= steps; i++)
      at((typeMs / steps) * i, () =>
        setP((s) => ({ ...s, typed: Math.round((query.length * i) / steps) })),
      );
    AGENTS.forEach((_, i) =>
      at(typeMs + 250 + i * 330, () => setP((s) => ({ ...s, agents: i + 1 }))),
    );
    ROWS.forEach((_, i) => at(typeMs + 900 + i * 260, () => setP((s) => ({ ...s, rows: i + 1 }))));
    at(typeMs + 900 + ROWS.length * 260 + 200, () => setP((s) => ({ ...s, done: true })));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduce, query, run]);

  const ease = [0.2, 0.7, 0.2, 1] as const;

  return (
    <div
      className="relative mt-11 h-[560px] overflow-hidden rounded-lg bg-accent md:h-[600px] md:rounded-xl"
      aria-label={t('marketing.hero.stageLabel')}
      role="region"
    >
      <p className="absolute left-3 top-4 z-[2] text-[12.5px] font-semibold text-on-accent md:left-[6%] md:top-[18px]">
        {t('marketing.hero.demo')}
      </p>
      <div className="absolute bottom-[-40px] left-3 right-[-24px] top-12 grid grid-rows-[40px_1fr] overflow-hidden rounded-xl bg-surface text-[13.5px] leading-5 shadow-window md:left-[6%] md:right-[-2%] md:top-14">
        <div className="flex items-center gap-3 border-b border-line bg-canvas px-3.5">
          <span className="rounded-sm border border-line bg-surface px-2.5 py-0.5 text-label-12 font-normal text-ink-3">
            app.scoutra.ai/search
          </span>
        </div>
        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[196px_minmax(0,1fr)_340px] md:grid-cols-[minmax(0,1fr)_300px]">
          <aside
            aria-label={t('marketing.hero.menuPreview')}
            className="hidden content-start gap-0.5 border-r border-line bg-canvas px-2.5 py-3.5 lg:grid"
          >
            <Logo className="mx-2 mb-3.5 mt-0.5 h-[18px]" />
            {[
              [Search, t('marketing.agents.search'), true],
              [KanbanSquare, t('marketing.pricing.pipeline'), false],
              [Users, 'Prospects', false],
              [Download, 'Exports', false],
            ].map(([Icon, label, on]) => {
              const I = Icon as typeof Search;
              return (
                <span
                  key={label as string}
                  className={cn(
                    'flex items-center gap-2.5 rounded-sm px-2 py-1.5 font-medium text-ink-2',
                    on && 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)]',
                  )}
                >
                  <I
                    className={cn('size-4', on ? 'text-accent-text' : 'text-ink-3')}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {label as string}
                </span>
              );
            })}
          </aside>
          <div className="grid min-w-0 content-start gap-3.5 px-4 py-4 md:px-5">
            <div className="min-h-[62px] rounded-md border border-line-strong px-3 py-2.5 text-[14px] leading-[21px]">
              {query.slice(0, p.typed)}
              {!p.done && p.typed < query.length ? (
                <span
                  aria-hidden
                  className="ml-px inline-block h-4 w-[1.5px] translate-y-[3px] bg-ink"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
              {['FR', 'CA', 'US', 'PT'].map((c) => (
                <CountryCode key={c} code={c} />
              ))}
              <span>{t('marketing.hero.companies')}</span>
              <span className="flex-1" />
              <span>{t('marketing.hero.launchedAt')}</span>
            </div>
            <ol
              aria-label={t('marketing.hero.agentsLabel')}
              className="grid grid-cols-3 overflow-hidden rounded-md border border-line xl:grid-cols-6"
            >
              {AGENTS.map((a, i) => {
                const on = i < p.agents;
                return (
                  <li
                    key={a.key}
                    className="min-w-0 border-line px-2.5 py-2 [&:nth-child(-n+3)]:border-b xl:[&:nth-child(-n+3)]:border-b-0 [&:not(:nth-child(3n))]:border-r xl:[&:not(:last-child)]:border-r"
                  >
                    <b className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                      <i
                        className={cn(
                          'size-2 shrink-0 rounded-full transition-colors duration-200',
                          on ? 'bg-accent' : 'bg-line-strong',
                        )}
                      />
                      {t(`marketing.agents.${a.key}`)}
                    </b>
                    <span
                      className={cn(
                        'block truncate text-label-12 font-normal text-ink-3 tnum',
                        !on && 'invisible',
                      )}
                    >
                      {t(`marketing.agents.${a.out}`, { n: a.n })}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="flex items-baseline gap-2.5">
              <b className="t-heading-16">{t('marketing.hero.kept', { n: p.rows })}</b>
              <span className="text-label-13 text-ink-3">{t('marketing.hero.analysed')}</span>
              <span className="flex-1" />
              <span className="hidden text-label-13 text-ink-3 sm:inline">
                {t('marketing.hero.sorted')}
              </span>
            </div>
            <ol className="border-t border-line" aria-live="polite">
              <AnimatePresence initial={false}>
                {ROWS.slice(0, p.rows).map((r, i) => (
                  <motion.li
                    key={r.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease }}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_70px] items-center gap-3 border-b border-line px-1 py-2 sm:grid-cols-[minmax(0,1fr)_40px_112px_76px]',
                      i === 0 && 'bg-accent-soft shadow-[inset_2px_0_0_var(--accent)]',
                    )}
                  >
                    <div className="min-w-0">
                      <b className="block truncate font-semibold">{r.name}</b>
                      <span className="block truncate text-[12.5px] text-ink-3">
                        {r.org}, {r.city[locale]}
                      </span>
                    </div>
                    <CountryCode code={r.cc} className="hidden sm:inline-block" />
                    <span className="hidden sm:inline">
                      {r.mail === 'ok' ? (
                        <Status tone="ok">
                          {locale === 'fr' ? 'Email vérifié' : 'Email verified'}
                        </Status>
                      ) : r.mail === 'warn' ? (
                        <Status tone="warn">
                          {locale === 'fr' ? 'À confirmer' : 'To confirm'}
                        </Status>
                      ) : (
                        <Status tone="none">
                          {locale === 'fr' ? 'Téléphone seul' : 'Phone only'}
                        </Status>
                      )}
                    </span>
                    <Score value={r.score} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>
          <aside
            aria-label={t('marketing.hero.cardPreview')}
            className="hidden min-w-0 content-start gap-3.5 border-l border-line px-[18px] py-[18px] md:grid"
          >
            <div>
              <h3 className="text-[16px] font-semibold leading-[22px]">Dr Claire Fontaine</h3>
              <p className="text-[12.5px] text-ink-3">{t('marketing.score.role')}</p>
            </div>
            <div>
              <p className="mb-2 text-label-13">{t('marketing.hero.why', { n: 94 })}</p>
              <ul className="grid gap-[7px]">
                {(['r1', 'r2', 'r3', 'r4', 'r5'] as const).map((k, i) => (
                  <li
                    key={k}
                    className="grid grid-cols-[30px_minmax(0,1fr)] gap-2 text-[12.5px] text-ink-2"
                  >
                    <b className="font-semibold text-ink tnum">+{[30, 22, 18, 14, 10][i]}</b>
                    {t(`marketing.score.${k}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-line bg-canvas px-3 py-2.5 text-[12.5px] leading-[19px] text-ink-2">
              <b className="font-semibold text-ink">{t('marketing.score.subject')}</b>
              <br />
              {t('marketing.score.greeting')} {t('marketing.score.body').slice(0, 110)}…
            </div>
          </aside>
        </div>
      </div>
      {p.done && !reduce ? (
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="absolute bottom-[18px] right-5 z-[3] inline-flex h-8 items-center gap-1.5 rounded-sm bg-ink px-3 text-[12.5px] font-semibold text-white"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t('marketing.hero.replay')}
        </button>
      ) : null}
    </div>
  );
}
