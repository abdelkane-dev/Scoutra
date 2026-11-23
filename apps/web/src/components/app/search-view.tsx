'use client';
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bookmark, KanbanSquare, Play, RotateCcw, Download } from 'lucide-react';
import {
  Button,
  CountryCode,
  Label,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  Score,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
  Textarea,
  Tooltip,
  cn,
  toast,
} from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { DEMO_PROSPECTS } from '@/lib/demo/prospects';
import { DEMO_CREDITS } from '@/lib/demo/workspace';
import type { DemoProspect } from '@/lib/demo/types';
import { WRITING_SURCHARGE } from '@/lib/pricing';
import { usePerm } from './app-provider';
import { CountryPicker } from './country-picker';
import { ProspectSheet } from './prospect-sheet';
import { LiveRun } from './live-search';
import { apiFetch } from '@/lib/api';
import { useCredits } from '@/lib/use-credits';

type Kind = 'companies' | 'people' | 'both';
type Zone = 'one' | 'many' | 'world';
type Writing = 'standard' | 'careful' | 'premium';
const AGENTS = ['interpret', 'search', 'enrich', 'verify', 'score', 'write'] as const;
const statusTone = { valid: 'ok', risky: 'warn', invalid: 'bad', none: 'none' } as const;
const EXAMPLES = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'] as const;

interface Run {
  startedAt: string;
  agents: number;
  rows: DemoProspect[];
  log: { time: string; agent: (typeof AGENTS)[number]; text: string }[];
  done: boolean;
}

export function SearchView({
  models,
  defaultCountry,
  initialModel,
}: {
  models: string[];
  defaultCountry: string;
  initialModel?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { can } = usePerm();
  const canRun = can('campaign:write');
  const [query, setQuery] = React.useState('');
  const [kind, setKind] = React.useState<Kind>('companies');
  const [model, setModel] = React.useState(
    initialModel && models.includes(initialModel) ? initialModel : 'b2b',
  );
  const [zone, setZone] = React.useState<Zone>('many');
  const [countries, setCountries] = React.useState<string[]>([defaultCountry]);
  const [writing, setWriting] = React.useState<Writing>('standard');
  const [max, setMax] = React.useState(50);
  const [error, setError] = React.useState<string | null>(null);
  const [run, setRun] = React.useState<Run | null>(null);
  const [selected, setSelected] = React.useState<DemoProspect | null>(null);
  const [liveId, setLiveId] = React.useState<string | null>(null);
  const timers = React.useRef<number[]>([]);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const left =
    DEMO_CREDITS.granted + DEMO_CREDITS.rollover + DEMO_CREDITS.packs - DEMO_CREDITS.used;
  const perProspect = 1 + WRITING_SURCHARGE[writing];
  const estimate = max * perProspect;

  const validate = () => {
    let err: string | null = null;
    if (query.trim().length < 10) err = t('search.queryTooShort');
    else if (zone !== 'world' && countries.length === 0) err = t('search.needCountry');
    setError(err);
    return err === null;
  };

  /** Vraie recherche (POST /api/campaigns) ; repli sur la démonstration si l'API ne répond pas. */
  const launch = async () => {
    if (!validate()) return;
    const zoneText =
      zone === 'world' ? t('app.common.world') : countries.map((c) => fmt.country(c)).join(', ');
    const prompt = `${query.trim()}\n${t('search.zone')} : ${zoneText}. ${t('search.target')} : ${t(`app.kinds.${kind}`)}.`;
    const r = await apiFetch<{ id: string }>('/api/campaigns', {
      method: 'POST',
      body: { prompt, model, maxProspects: max, quality: writing },
    });
    if (r.data) {
      setRun(null);
      setLiveId(r.data.id);
      return;
    }
    if (r.error && r.error.status > 0 && r.error.status < 500) {
      const key = `live.errors.${r.error.code}` as MessageKey;
      return setError(t(key) === key ? r.error.message || t('auth.errors.unknown') : t(key));
    }
    toast(t('live.demoFallback'));
    launchDemo();
  };

  const launchDemo = () => {
    setLiveId(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const now = new Date();
    const hhmm = (d: Date) =>
      d.toLocaleTimeString(fmt.tag, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const pool = DEMO_PROSPECTS.filter((p) =>
      kind === 'people' ? p.kind === 'person' : kind === 'companies' ? p.kind === 'company' : true,
    )
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(12, max));
    const zoneLabel = zone === 'world' ? t('app.common.world') : countries.join(', ');
    const lines: Record<(typeof AGENTS)[number], string> = {
      interpret: t('search.logInterpret', {
        model: t(`prospectingModels.${model}` as MessageKey),
        zone: zoneLabel,
        kind: t(`app.kinds.${kind}`),
      }),
      search: t('search.logSearch', { n: 286 }),
      enrich: t('search.logEnrich', { n: 171 }),
      verify: t('search.logVerify', { n: 132, valid: 118, risky: 9 }),
      score: t('search.logScore', { n: pool.length, best: pool[0]?.score ?? 0 }),
      write: t('search.logWrite', { n: pool.length }),
    };
    setRun({
      startedAt: now.toLocaleTimeString(fmt.tag, { hour: '2-digit', minute: '2-digit' }),
      agents: 0,
      rows: [],
      log: [],
      done: false,
    });
    toast(t('search.launched'));
    // DÉMONSTRATION : déroulé simulé. Besoin d'API : POST /api/campaigns puis flux d'événements (SSE).
    AGENTS.forEach((a, i) => {
      timers.current.push(
        window.setTimeout(
          () => {
            setRun(
              (r) =>
                r && {
                  ...r,
                  agents: i + 1,
                  log: [
                    {
                      time: hhmm(new Date(now.getTime() + (i + 1) * 9000)),
                      agent: a,
                      text: lines[a],
                    },
                    ...r.log,
                  ],
                },
            );
          },
          500 + i * 700,
        ),
      );
    });
    pool.forEach((p, i) => {
      timers.current.push(
        window.setTimeout(() => setRun((r) => r && { ...r, rows: [...r.rows, p] }), 2700 + i * 220),
      );
    });
    timers.current.push(
      window.setTimeout(() => setRun((r) => r && { ...r, done: true }), 2900 + pool.length * 220),
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* Composer */}
      <Panel className="xl:sticky xl:top-4 xl:self-start" aria-labelledby="h-composer">
        <PanelHeader>
          <PanelTitle id="h-composer">{t('search.composer')}</PanelTitle>
        </PanelHeader>
        <form
          className="grid gap-5 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void launch();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="q">{t('search.query')}</Label>
            <Textarea
              id="q"
              rows={4}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.queryPlaceholder')}
              aria-describedby="q-hint"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void launch();
              }}
              className="text-copy-14"
            />
            <p id="q-hint" className="text-label-12 font-normal text-ink-3">
              {t('search.queryHint')}
            </p>
            <div
              className="mt-1 flex flex-wrap gap-1.5"
              aria-label={t('search.examples')}
              role="group"
            >
              {EXAMPLES.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setQuery(t(`search.${k}`))}
                  className="rounded-sm border border-line px-2 py-1 text-left text-label-12 text-ink-2 hover:border-line-strong hover:text-ink"
                >
                  {t(`search.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-label-13">{t('search.target')}</span>
            <Segmented<Kind>
              label={t('search.target')}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'companies', label: t('app.kinds.companies') },
                { value: 'people', label: t('app.kinds.people') },
                { value: 'both', label: t('app.kinds.both') },
              ]}
            />
            {kind !== 'companies' ? (
              <p className="text-label-12 font-normal text-ink-3">{t('search.targetPeopleNote')}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="model">{t('search.model')}</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`prospectingModels.${m}` as MessageKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <span className="text-label-13">{t('search.zone')}</span>
            <Segmented<Zone>
              label={t('search.zone')}
              value={zone}
              onChange={(z) => {
                setZone(z);
                if (z === 'one') setCountries((c) => c.slice(0, 1));
              }}
              options={[
                { value: 'one', label: t('search.zoneOne') },
                { value: 'many', label: t('search.zoneMany') },
                { value: 'world', label: t('search.zoneWorld') },
              ]}
            />
            {zone === 'world' ? (
              <p className="text-label-12 font-normal text-ink-3">{t('search.worldNote')}</p>
            ) : (
              <CountryPicker value={countries} onChange={setCountries} multiple={zone === 'many'} />
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="writing">{t('search.writing')}</Label>
              <Select value={writing} onValueChange={(v) => setWriting(v as Writing)}>
                <SelectTrigger id="writing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t('search.writingStandard')}</SelectItem>
                  <SelectItem value="careful">
                    {t('search.writingCareful', { n: WRITING_SURCHARGE.careful })}
                  </SelectItem>
                  <SelectItem value="premium">
                    {t('search.writingPremium', { n: WRITING_SURCHARGE.premium })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max">{t('search.max')}</Label>
              <Input
                id="max"
                type="number"
                min={5}
                max={500}
                step={5}
                value={max}
                onChange={(e) => setMax(Math.max(5, Math.min(500, Number(e.target.value) || 5)))}
                className="tnum"
              />
            </div>
          </div>
          <div className="rounded-md bg-canvas px-3 py-2.5">
            <p className="text-label-14 font-semibold tnum">
              {t('search.estimate', { n: fmt.n(estimate) })}
            </p>
            <p className="text-label-12 font-normal text-ink-3">
              {t('search.estimateNote', { left: fmt.n(left) })}
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-label-13 text-bad">
              {error}
            </p>
          ) : null}
          {canRun ? (
            <Button type="submit" variant="primary" size="lg" className="w-full">
              <Play aria-hidden strokeWidth={1.75} />
              {t('search.launch')}
              <span className="ml-1 text-[11px] font-medium opacity-70 max-sm:hidden" aria-hidden>
                ⌘↵
              </span>
            </Button>
          ) : (
            <Tooltip content={t('search.readOnly')}>
              <span tabIndex={0} className="block">
                <Button type="button" variant="primary" size="lg" className="w-full" disabled>
                  {t('search.launch')}
                </Button>
              </span>
            </Tooltip>
          )}
        </form>
      </Panel>

      {/* Déroulé et résultats */}
      <div className="grid min-w-0 content-start gap-4">
        {liveId ? (
          <LiveRun
            id={liveId}
            onDemo={() => {
              if (validate()) launchDemo();
            }}
            onReset={() => setLiveId(null)}
          />
        ) : !run ? (
          <Panel aria-labelledby="h-idle">
            <PanelHeader>
              <PanelTitle id="h-idle">{t('search.idleTitle')}</PanelTitle>
            </PanelHeader>
            <p className="px-4 pt-3 text-copy-14 text-ink-2">{t('search.idleLede')}</p>
            <ol className="grid gap-px p-4 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS.map((a, i) => (
                <li
                  key={a}
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border-t border-line py-3 pr-4"
                >
                  <span className="text-label-13 text-ink-3 tnum">{i + 1}</span>
                  <div>
                    <p className="text-label-14 font-semibold">{t(`app.agents.${a}`)}</p>
                    <p className="text-[13px] leading-5 text-ink-2">
                      {t(`search.idle${i + 1}` as MessageKey)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        ) : (
          <>
            <Panel aria-labelledby="h-run">
              <PanelHeader>
                <PanelTitle id="h-run">
                  {run.done ? t('search.runDone') : t('search.run')}
                </PanelTitle>
                <span className="text-label-13 font-normal text-ink-3">
                  {t('search.startedAt', { time: run.startedAt })}
                </span>
                <span className="flex-1" />
                <span className="flex flex-wrap gap-1">
                  {zone === 'world' ? (
                    <span className="text-label-12 text-ink-3">{t('app.common.world')}</span>
                  ) : (
                    countries.map((c) => <CountryCode key={c} code={c} />)
                  )}
                </span>
              </PanelHeader>
              <p className="border-b border-line px-4 py-2.5 text-copy-14 text-ink">{query}</p>
              <ol
                aria-label={t('search.log')}
                className="grid grid-cols-3 border-b border-line lg:grid-cols-6"
              >
                {AGENTS.map((a, i) => {
                  const state =
                    i < run.agents ? 'done' : i === run.agents && !run.done ? 'running' : 'pending';
                  return (
                    <li
                      key={a}
                      className="min-w-0 border-line px-3 py-2.5 [&:not(:nth-child(3n))]:border-r max-lg:[&:nth-child(-n+3)]:border-b lg:[&:not(:last-child)]:border-r"
                    >
                      <b className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                        <i
                          className={cn(
                            'size-2 rounded-full',
                            state === 'done'
                              ? 'bg-accent'
                              : state === 'running'
                                ? 'bg-accent-line'
                                : 'bg-line-strong',
                          )}
                          aria-hidden
                        />
                        {t(`app.agents.${a}`)}
                      </b>
                      <span className="block text-label-12 font-normal text-ink-3">
                        {state === 'done' ? '✓' : state === 'running' ? '…' : '—'}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <ol className="max-h-48 overflow-y-auto px-4 py-1" aria-live="polite">
                {run.log.map((l) => (
                  <li
                    key={l.agent}
                    className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-line py-2 text-[13px] leading-5 last:border-0"
                  >
                    <time className="text-label-12 font-normal text-ink-3 tnum">{l.time}</time>
                    <span className="text-ink-2">
                      <b className="font-semibold text-ink">{t(`app.agents.${l.agent}`)}</b>{' '}
                      {l.text}
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel aria-labelledby="h-results">
              <PanelHeader>
                <PanelTitle id="h-results">{t('search.results')}</PanelTitle>
                <span className="text-label-13 font-normal text-ink-3 tnum">
                  {t('search.resultsCount', { n: run.rows.length, total: 286 })}
                </span>
                <span className="flex-1" />
                {run.done ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => toast(t('search.searchSaved'))}>
                      <Bookmark aria-hidden strokeWidth={1.75} />
                      <span className="max-sm:sr-only">{t('search.saveSearch')}</span>
                    </Button>
                    {can('prospect:export') ? (
                      <Button size="sm" asChild>
                        <a href="/exports">
                          <Download aria-hidden strokeWidth={1.75} />
                          <span className="max-sm:sr-only">{t('app.common.export')}</span>
                        </a>
                      </Button>
                    ) : null}
                    {can('pipeline:write') ? (
                      <Button
                        size="sm"
                        variant="ink"
                        onClick={() => toast(t('search.addedAll', { n: run.rows.length }))}
                      >
                        <KanbanSquare aria-hidden strokeWidth={1.75} />
                        {t('search.addAll')}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRun(null)}
                      aria-label={t('search.newRun')}
                    >
                      <RotateCcw aria-hidden strokeWidth={1.75} />
                    </Button>
                  </div>
                ) : null}
              </PanelHeader>
              {run.rows.length === 0 ? (
                <p className="px-4 py-8 text-copy-14 text-ink-3">{t('search.resultsEmpty')}</p>
              ) : (
                <table className="w-full text-copy-14">
                  <caption className="sr-only">{t('search.results')}</caption>
                  <thead className="bg-sunken text-left text-label-13 text-ink-3 max-sm:hidden">
                    <tr className="h-9">
                      <th scope="col" className="pl-4 font-medium">
                        {t('search.colProspect')}
                      </th>
                      <th scope="col" className="font-medium">
                        {t('search.colCountry')}
                      </th>
                      <th scope="col" className="font-medium">
                        {t('search.colContact')}
                      </th>
                      <th scope="col" className="pr-4 font-medium">
                        {t('search.colScore')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {run.rows.map((p) => (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
                          onClick={() => setSelected(p)}
                          data-active={selected?.id === p.id}
                          className="h-12 cursor-pointer border-t border-line hover:bg-[#fafafb] data-[active=true]:bg-accent-soft data-[active=true]:shadow-[inset_2px_0_0_var(--accent)]"
                        >
                          <td className="max-w-0 py-1.5 pl-4 pr-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(p);
                              }}
                              className="block w-full truncate text-left font-semibold hover:underline"
                            >
                              {p.person}
                            </button>
                            <span className="block truncate text-label-12 font-normal text-ink-3">
                              {p.org}, {p.city[locale]}
                            </span>
                          </td>
                          <td className="w-16 max-sm:hidden">
                            <CountryCode code={p.cc} />
                          </td>
                          <td className="w-40 max-sm:hidden">
                            <Status tone={statusTone[p.emailStatus]}>
                              {t(`app.emailStatus.${p.emailStatus}`)}
                            </Status>
                          </td>
                          <td className="w-24 pr-4">
                            <Score value={p.score} />
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </Panel>
          </>
        )}
      </div>
      <ProspectSheet
        prospect={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
