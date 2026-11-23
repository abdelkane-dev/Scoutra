'use client';
import * as React from 'react';
import { Play, X, ShieldAlert, Copy, Mail, Phone, Globe } from 'lucide-react';
import {
  Badge,
  Button,
  CountryCode,
  Panel,
  PanelHeader,
  PanelTitle,
  Score,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Status,
  cn,
  toast,
} from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useFormat, useT } from '@/lib/i18n/client';
import { apiFetch } from '@/lib/api';
import type { ApiCampaign, ApiProspectDetail, ApiProspectItem } from '@/lib/api-types';

const AGENTS = ['interpret', 'search', 'enrich', 'verify', 'score', 'write'] as const;
const TERMINAL = ['completed', 'failed', 'cancelled'];

/** Suit une campagne réelle : sondage de l'état + flux SSE, puis liste des prospects livrés. */
export function useLiveCampaign(id: string | null) {
  const [campaign, setCampaign] = React.useState<ApiCampaign | null>(null);
  const [prospects, setProspects] = React.useState<ApiProspectItem[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [phase, setPhase] = React.useState(0);
  const [stalled, setStalled] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!id) return;
    const [c, p] = await Promise.all([
      apiFetch<ApiCampaign>(`/api/campaigns/${id}`),
      apiFetch<{ items: ApiProspectItem[] }>(
        `/api/prospects?campaignId=${id}&delivered=true&sort=score&limit=100`,
      ),
    ]);
    if (c.data) setCampaign(c.data);
    if (p.data) setProspects(p.data.items);
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    setStalled(false);
    setWarnings([]);
    setPhase(0);
    void refresh();
    const started = Date.now();
    const timer = window.setInterval(() => {
      void refresh();
      if (Date.now() - started > 45_000) setStalled(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [id, refresh]);

  const lastEventId = React.useRef<string | null>(null);
  const status = campaign?.status;
  React.useEffect(() => {
    if (!id || (status !== 'running' && status !== 'paused')) return;
    // Reprise : le navigateur renvoie Last-Event-ID à la reconnexion ; à la réouverture du flux,
    // on le transmet explicitement (?lastEventId=) pour ne perdre aucun événement.
    const q = lastEventId.current ? `?lastEventId=${encodeURIComponent(lastEventId.current)}` : '';
    const es = new EventSource(`/api/campaigns/${id}/stream${q}`);
    const seen = (e: Event) => {
      const le = (e as MessageEvent).lastEventId;
      if (le) lastEventId.current = le;
    };
    const bump = (n: number) => setPhase((p) => Math.max(p, n));
    const on = (name: string, f: (e: Event) => void) =>
      es.addEventListener(name, (e) => {
        seen(e);
        f(e);
      });
    on('campaign.progress', () => bump(2));
    on('prospect.created', () => bump(3));
    on('prospect.updated', () => {
      bump(5);
      void refresh();
    });
    on('message.drafted', () => bump(6));
    on('campaign.warning', (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { code: string };
        setWarnings((w) => (w.includes(d.code) ? w : [...w, d.code]));
      } catch {
        /* événement illisible ignoré */
      }
    });
    on('campaign.status', () => void refresh());
    return () => es.close();
  }, [id, status, refresh]);

  React.useEffect(() => {
    if (campaign?.status && campaign.status !== 'interpreting') setStalled(false);
  }, [campaign?.status]);

  const agentsDone = !campaign
    ? 0
    : campaign.status === 'interpreting'
      ? 0
      : campaign.status === 'awaiting_confirmation'
        ? 1
        : TERMINAL.includes(campaign.status)
          ? 6
          : Math.max(1, phase);
  return { campaign, prospects, warnings, stalled, agentsDone, refresh };
}

export function LiveRun({ id, onReset }: { id: string; onReset: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const { campaign: c, prospects, warnings, stalled, agentsDone, refresh } = useLiveCampaign(id);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const launch = async () => {
    setBusy(true);
    const r = await apiFetch<{ status: string }>(`/api/campaigns/${id}/launch`, {
      method: 'POST',
      body: {},
    });
    setBusy(false);
    if (r.error) {
      const key = `live.errors.${r.error.code}` as MessageKey;
      return toast(t(key) === key ? r.error.message || t('auth.errors.unknown') : t(key));
    }
    toast(t('search.launched'));
    void refresh();
  };
  const cancel = async () => {
    await apiFetch(`/api/campaigns/${id}/cancel`, { method: 'POST', body: {} });
    toast(t('live.cancelled'));
    void refresh();
  };

  if (!c) {
    return (
      <Panel className="grid gap-3 p-4" aria-busy="true">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
      </Panel>
    );
  }
  const spec = c.target?.spec;
  const statusLabel =
    c.status === 'completed'
      ? t('live.completed')
      : c.status === 'failed'
        ? t('live.failed')
        : c.status === 'cancelled' || c.status === 'cancelling'
          ? t('live.cancelled')
          : c.status === 'interpreting'
            ? t('live.interpreting')
            : c.status === 'awaiting_confirmation'
              ? t('live.targetTitle')
              : t('live.running');

  return (
    <>
      <Panel aria-labelledby="h-live">
        <PanelHeader>
          <PanelTitle id="h-live">{statusLabel}</PanelTitle>
          <Badge tone="outline">{t('live.realData')}</Badge>
          <span className="flex-1" />
          {c.status === 'running' ? (
            <Button size="sm" variant="ghost" onClick={cancel}>
              <X aria-hidden strokeWidth={1.75} />
              {t('live.cancel')}
            </Button>
          ) : null}
          {TERMINAL.includes(c.status) ? (
            <Button size="sm" variant="ghost" onClick={onReset}>
              {t('search.newRun')}
            </Button>
          ) : null}
        </PanelHeader>
        <p className="border-b border-line px-4 py-2.5 text-copy-14">{c.prompt}</p>
        <ol
          aria-label={t('search.log')}
          className="grid grid-cols-3 border-b border-line lg:grid-cols-6"
        >
          {AGENTS.map((a, i) => (
            <li
              key={a}
              className="min-w-0 border-line px-3 py-2.5 [&:not(:nth-child(3n))]:border-r max-lg:[&:nth-child(-n+3)]:border-b lg:[&:not(:last-child)]:border-r"
            >
              <b className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                <i
                  className={cn(
                    'size-2 rounded-full',
                    i < agentsDone
                      ? 'bg-accent'
                      : i === agentsDone &&
                          !TERMINAL.includes(c.status) &&
                          c.status !== 'awaiting_confirmation'
                        ? 'bg-accent-line'
                        : 'bg-line-strong',
                  )}
                  aria-hidden
                />
                {t(`app.agents.${a}`)}
              </b>
            </li>
          ))}
        </ol>
        {c.counts ? (
          <p className="px-4 py-2.5 text-label-13 font-normal text-ink-2 tnum">
            {t('live.counts', {
              delivered: c.counts.delivered,
              rejected: c.counts.rejected,
              candidates: c.counts.candidates,
            })}
            {c.credits ? (
              <span className="ml-3 text-ink-3">
                {t('live.credits', {
                  consumed: fmt.n(c.credits.consumed),
                  reserved: fmt.n(c.credits.reserved),
                })}
              </span>
            ) : null}
          </p>
        ) : null}
        {warnings.map((w) => (
          <p
            key={w}
            className="flex items-center gap-2 border-t border-line bg-warn-soft px-4 py-2 text-label-13 text-warn"
          >
            <ShieldAlert className="size-4" strokeWidth={1.75} aria-hidden />
            {t(`live.warning.${w}` as MessageKey)}
          </p>
        ))}
        {c.status === 'interpreting' && stalled ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-copy-14 text-ink-2">
            {t('live.stalled')}
          </div>
        ) : null}
      </Panel>

      {c.status === 'awaiting_confirmation' && spec ? (
        <Panel aria-labelledby="h-target">
          <PanelHeader>
            <div className="min-w-0 flex-1">
              <PanelTitle id="h-target">{t('live.targetTitle')}</PanelTitle>
              <p className="text-label-12 font-normal text-ink-3">{t('live.targetLede')}</p>
            </div>
          </PanelHeader>
          <div className="grid gap-3 p-4 text-copy-14">
            <p className="text-copy-16">{spec.summary}</p>
            {c.target ? (
              <p className="text-label-12 font-normal text-ink-3">
                {t(`live.method.${c.target.interpretation.method}`)},{' '}
                {t('live.confidence', { pct: fmt.pct(c.target.interpretation.confidence) })}
              </p>
            ) : null}
            <dl className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
              <dt className="text-label-13 text-ink-3">{t('live.countries')}</dt>
              <dd className="flex flex-wrap gap-1">
                {spec.countries.map((cc) => (
                  <CountryCode key={cc} code={cc} title={fmt.country(cc)} />
                ))}{' '}
                {spec.regions.join(', ')}
              </dd>
              <dt className="text-label-13 text-ink-3">{t('live.kinds')}</dt>
              <dd className="flex flex-wrap gap-1">
                {spec.kinds.map((k) => (
                  <Badge key={k}>{t(`prospectKinds.${k}` as MessageKey)}</Badge>
                ))}
              </dd>
              <dt className="text-label-13 text-ink-3">{t('live.keywords')}</dt>
              <dd>{spec.keywords.join(', ') || '—'}</dd>
            </dl>
            {c.target?.interpretation.clarifyingQuestions.length ? (
              <div className="rounded-md bg-canvas px-3 py-2.5">
                <p className="text-label-12 text-ink-3">{t('live.questions')}</p>
                <ul className="list-disc pl-5">
                  {c.target.interpretation.clarifyingQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {c.degraded ? (
              <Status tone="warn" className="whitespace-normal">
                {t('live.degraded')}
              </Status>
            ) : null}
            {c.sources?.excluded.length ? (
              <p className="text-label-12 font-normal text-ink-3">
                {t('live.excluded', {
                  list: c.sources.excluded
                    .map((e) => `${e.code} (${t(`live.reasons.${e.reason}` as MessageKey)})`)
                    .join(', '),
                })}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <p className="flex-1 text-label-14 font-semibold tnum">
                {c.estimate?.credits
                  ? t('live.estimate', {
                      low: fmt.n(c.estimate.credits.low),
                      high: fmt.n(c.estimate.credits.high),
                    })
                  : t('live.estimateLicense')}
              </p>
              <Button variant="ghost" onClick={cancel}>
                {t('live.cancel')}
              </Button>
              <Button variant="primary" disabled={busy} onClick={launch}>
                <Play aria-hidden strokeWidth={1.75} />
                {t('live.launch')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {['running', 'completed', 'cancelling', 'cancelled'].includes(c.status) ? (
        <Panel aria-labelledby="h-live-results">
          <PanelHeader>
            <PanelTitle id="h-live-results">{t('search.results')}</PanelTitle>
            <span className="text-label-13 font-normal text-ink-3 tnum">{prospects.length}</span>
          </PanelHeader>
          {prospects.length === 0 ? (
            <p className="px-4 py-8 text-copy-14 text-ink-3">{t('search.resultsEmpty')}</p>
          ) : (
            <table className="w-full text-copy-14">
              <caption className="sr-only">{t('search.results')}</caption>
              <tbody>
                {prospects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setOpen(p.id)}
                    className="h-12 cursor-pointer border-t border-line first:border-0 hover:bg-[#fafafb]"
                  >
                    <td className="max-w-0 pl-4 pr-3">
                      <b className="block truncate font-semibold">{p.displayName}</b>
                      <span className="block truncate text-label-12 font-normal text-ink-3">
                        {[p.city, p.websiteDomain].filter(Boolean).join(', ')}
                      </span>
                    </td>
                    <td className="w-16">
                      {p.countryCode ? <CountryCode code={p.countryCode} /> : null}
                    </td>
                    <td className="w-40 text-label-12 text-ink-3 max-sm:hidden">
                      {p.channels
                        .map((ch) => t(`app.channels.${ch.channel}` as MessageKey))
                        .join(', ')}
                    </td>
                    <td className="w-24 pr-4">
                      {p.score !== null ? <Score value={p.score} /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      ) : null}
      <RealProspectSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Fiche d'un prospect réel (GET /api/prospects/:id) : score, canaux autorisés, coordonnées, brouillon. */
export function RealProspectSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useT();
  const fmt = useFormat();
  const [d, setD] = React.useState<ApiProspectDetail | null>(null);
  React.useEffect(() => {
    setD(null);
    if (!id) return;
    void apiFetch<ApiProspectDetail>(`/api/prospects/${id}`).then((r) => r.data && setD(r.data));
  }, [id]);
  const icon = { email: Mail, phone: Phone, website_form: Globe } as Record<string, typeof Mail>;
  const max = d?.score ? Math.max(...d.score.reasons.map((r) => r.max || r.points), 1) : 1;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent closeLabel={t('app.common.close')} aria-describedby={undefined}>
        {!d ? (
          <div className="grid gap-3 p-5">
            <SheetTitle className="sr-only">{t('app.prospect.title')}</SheetTitle>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SheetTitle className="truncate">{d.prospect.displayName}</SheetTitle>
                  <SheetDescription>
                    {[
                      d.prospect.city,
                      d.prospect.countryCode && fmt.country(d.prospect.countryCode),
                      d.prospect.websiteDomain,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </SheetDescription>
                </div>
                {d.score ? (
                  <p className="text-[32px] font-semibold leading-8 tnum">
                    {d.score.value}
                    <small className="ml-0.5 text-[13px] font-medium text-ink-3">/100</small>
                  </p>
                ) : null}
              </div>
            </SheetHeader>
            <SheetBody>
              {d.score ? (
                <ul className="grid gap-2.5">
                  {d.score.reasons.map((r, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[minmax(0,1fr)_72px_40px] sm:grid-cols-[minmax(0,1fr)_96px_40px] items-center gap-3 text-[13px]"
                    >
                      <span className="text-ink-2">
                        {r.finding.replace(/_/g, ' ')}
                        {r.params ? ` : ${Object.values(r.params).join(', ')}` : ''}
                      </span>
                      <span className="relative h-2.5 rounded-[2px] bg-sunken" aria-hidden>
                        <i
                          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent"
                          style={{ width: `${(Math.max(0, r.points) / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-semibold tnum">
                        {r.points > 0 ? `+${r.points}` : r.points}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <section className="grid gap-2">
                <h3 className="t-heading-16">{t('app.prospect.contact')}</h3>
                <ul className="divide-y divide-line rounded-md border border-line">
                  {d.contacts.map((c) => {
                    const I = icon[c.channel] ?? Globe;
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-copy-14">
                        <I className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{c.value}</span>
                        {!c.revealed ? (
                          <span className="text-label-12 text-ink-3">{t('live.masked')}</span>
                        ) : (
                          <span className="text-label-12 text-ink-3">{c.verificationStatus}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="flex flex-wrap gap-1.5">
                  {d.channels.map((c) => (
                    <Badge key={c.channel} tone="outline">
                      {t(`app.channels.${c.channel}` as MessageKey)}
                    </Badge>
                  ))}
                </p>
              </section>
              {d.messages[0] ? (
                <section className="grid gap-2">
                  <h3 className="t-heading-16">{t('app.prospect.message')}</h3>
                  {d.messages[0].subject ? (
                    <p className="text-label-14 font-semibold">{d.messages[0].subject}</p>
                  ) : null}
                  <p className="whitespace-pre-line rounded-md border border-line bg-canvas px-3 py-2.5 text-copy-14">
                    {d.messages[0].body}
                  </p>
                  {d.messages[0].footer ? (
                    <p className="text-label-12 font-normal text-ink-3">
                      {t('live.footer')} : {d.messages[0].footer}
                    </p>
                  ) : null}
                  <Button
                    className="justify-self-start"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        `${d.messages[0]!.subject ?? ''}\n\n${d.messages[0]!.body}`,
                      );
                      toast(t('app.prospect.messageCopied'));
                    }}
                  >
                    <Copy aria-hidden strokeWidth={1.75} />
                    {t('app.prospect.copyMessage')}
                  </Button>
                </section>
              ) : null}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
