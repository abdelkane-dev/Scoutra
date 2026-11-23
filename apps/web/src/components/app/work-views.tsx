'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Mail,
  Phone,
  MessageCircle,
  CalendarClock,
  ArrowLeft,
  Copy,
  Zap,
  KanbanSquare,
  Bell,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  CountryCode,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Label,
  Panel,
  PanelHeader,
  PanelTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  cn,
  toast,
} from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import {
  DEMO_ALERTS,
  DEMO_AGENDA,
  DEMO_AUTOMATIONS,
  DEMO_CAMPAIGNS,
  DEMO_SAVED_SEARCHES,
  DEMO_SIGNALS,
  DEMO_TASKS,
  DEMO_THREADS,
} from '@/lib/demo/workspace';
import { getDemoProspect } from '@/lib/demo/prospects';
import { PLANS } from '@/lib/pricing';
import { DataTable, type Column } from './data-table';
import { usePerm } from './app-provider';

/* ---------------- Recherches enregistrées ---------------- */
type Saved = (typeof DEMO_SAVED_SEARCHES)[number];
export function SavedSearchesView() {
  const t = useT();
  const locale = useLocale();
  const { can } = usePerm();
  const [alerts, setAlerts] = React.useState<Record<string, boolean>>(
    Object.fromEntries(DEMO_SAVED_SEARCHES.map((s) => [s.id, s.alert])),
  );
  const cols: Column<Saved>[] = [
    {
      id: 'name',
      header: t('work.saved.colName'),
      primary: true,
      sortValue: (s) => s.name[locale],
      cell: (s) => (
        <span className="block min-w-0 max-w-[420px]">
          <b className="block truncate font-semibold">{s.name[locale]}</b>
          <span className="block truncate text-label-12 font-normal text-ink-3">
            {s.query[locale]}
          </span>
        </span>
      ),
    },
    {
      id: 'cc',
      header: t('work.saved.colCountries'),
      cell: (s) => (
        <span className="inline-flex gap-1">
          {s.countries.map((c) => (
            <CountryCode key={c} code={c} />
          ))}
        </span>
      ),
      mobileHidden: true,
    },
    {
      id: 'last',
      header: t('work.saved.colLast'),
      cell: (s) => <span className="text-ink-2">{s.lastRun[locale]}</span>,
      mobileHidden: true,
    },
    {
      id: 'results',
      header: t('work.saved.colResults'),
      align: 'right',
      sortValue: (s) => s.results,
      cell: (s) => s.results,
    },
    {
      id: 'fresh',
      header: t('work.saved.colFresh'),
      align: 'right',
      sortValue: (s) => s.fresh,
      cell: (s) =>
        s.fresh ? (
          <Badge tone="accent">{t('work.saved.fresh', { n: s.fresh })}</Badge>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      id: 'alert',
      header: t('work.saved.colAlert'),
      cell: (s) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Switch
            checked={alerts[s.id]}
            disabled={!can('campaign:write')}
            aria-label={`${t('work.saved.colAlert')} : ${s.name[locale]}`}
            onCheckedChange={(v) => {
              setAlerts((a) => ({ ...a, [s.id]: v }));
              toast(v ? t('work.saved.alertOn') : t('work.saved.alertOff'));
            }}
          />
        </span>
      ),
      mobileHidden: true,
    },
    {
      id: 'owner',
      header: t('work.saved.colOwner'),
      cell: (s) => (
        <span className="inline-flex items-center gap-2 text-ink-2">
          <Avatar name={s.owner} size="sm" />
          {s.owner.split(' ')[0]}
        </span>
      ),
      mobileHidden: true,
    },
    {
      id: 'act',
      header: '',
      cell: (s) =>
        can('campaign:write') ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              toast(t('work.saved.rerunDone'));
            }}
            aria-label={`${t('work.saved.rerun')} : ${s.name[locale]}`}
          >
            <RotateCcw aria-hidden strokeWidth={1.75} />
            <span className="max-lg:sr-only">{t('work.saved.rerun')}</span>
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      rows={[...DEMO_SAVED_SEARCHES]}
      columns={cols}
      getId={(s) => s.id}
      getLabel={(s) => s.name[locale]}
      searchText={(s) => `${s.name[locale]} ${s.query[locale]}`}
      caption={t('work.saved.title')}
    />
  );
}

/* ---------------- Campagnes ---------------- */
type Camp = (typeof DEMO_CAMPAIGNS)[number];
export function CampaignsView() {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { can } = usePerm();
  const running = DEMO_CAMPAIGNS.filter((c) => c.status === 'running').length;
  const cols: Column<Camp>[] = [
    {
      id: 'name',
      header: t('work.campaigns.colName'),
      primary: true,
      sortValue: (c) => c.name[locale],
      cell: (c) => (
        <span className="block min-w-0 max-w-[380px]">
          <Link href="/search" className="block truncate font-semibold hover:underline">
            {c.name[locale]}
          </Link>
          <span className="flex items-center gap-1 text-label-12 font-normal text-ink-3">
            {c.countries.map((cc) =>
              cc === 'WORLD' ? (
                <span key={cc}>{t('app.common.world')}</span>
              ) : (
                <CountryCode key={cc} code={cc} />
              ),
            )}
            <span className="ml-1 truncate">{t(`prospectingModels.${c.model}` as MessageKey)}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      header: t('work.campaigns.colStatus'),
      sortValue: (c) => c.status,
      cell: (c) => (
        <Status tone={c.status === 'running' ? 'ok' : c.status === 'paused' ? 'warn' : 'none'}>
          {t(`work.campaigns.status.${c.status}`)}
        </Status>
      ),
    },
    {
      id: 'progress',
      header: t('work.campaigns.colProgress'),
      sortValue: (c) => c.progress,
      cell: (c) => (
        <span className="inline-flex items-center gap-2">
          <span className="block h-1.5 w-24 overflow-hidden rounded-[2px] bg-sunken" aria-hidden>
            <span
              className="block h-full origin-left bg-accent"
              style={{ transform: `scaleX(${c.progress})` }}
            />
          </span>
          <span className="text-label-12 text-ink-3 tnum">{fmt.pct(c.progress)}</span>
        </span>
      ),
      mobileHidden: true,
    },
    {
      id: 'delivered',
      header: t('work.campaigns.colDelivered'),
      align: 'right',
      sortValue: (c) => c.delivered,
      cell: (c) => c.delivered,
    },
    {
      id: 'credits',
      header: t('work.campaigns.colCredits'),
      align: 'right',
      sortValue: (c) => c.credits,
      cell: (c) => c.credits,
      mobileHidden: true,
    },
    {
      id: 'reply',
      header: t('work.campaigns.colReply'),
      align: 'right',
      sortValue: (c) => c.replyRate,
      cell: (c) => fmt.pct(c.replyRate),
      mobileHidden: true,
    },
    {
      id: 'owner',
      header: t('work.campaigns.colOwner'),
      cell: (c) => (
        <span className="inline-flex items-center gap-2 text-ink-2">
          <Avatar name={c.owner} size="sm" />
          {c.owner.split(' ')[0]}
        </span>
      ),
      mobileHidden: true,
    },
    {
      id: 'created',
      header: t('work.campaigns.colCreated'),
      cell: (c) => <span className="text-ink-3">{c.created[locale]}</span>,
      mobileHidden: true,
    },
    {
      id: 'act',
      header: '',
      cell: (c) =>
        can('campaign:write') && c.status !== 'done' ? (
          <Tooltip
            content={
              c.status === 'running' ? t('work.campaigns.pause') : t('work.campaigns.resume')
            }
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={
                c.status === 'running' ? t('work.campaigns.pause') : t('work.campaigns.resume')
              }
              onClick={() =>
                toast(
                  c.status === 'running' ? t('work.campaigns.pause') : t('work.campaigns.resume'),
                )
              }
            >
              {c.status === 'running' ? (
                <Pause aria-hidden strokeWidth={1.75} />
              ) : (
                <Play aria-hidden strokeWidth={1.75} />
              )}
            </Button>
          </Tooltip>
        ) : null,
    },
  ];
  return (
    <DataTable
      rows={[...DEMO_CAMPAIGNS]}
      columns={cols}
      getId={(c) => c.id}
      getLabel={(c) => c.name[locale]}
      searchText={(c) => c.name[locale]}
      caption={t('work.campaigns.title')}
      toolbarExtra={
        <span className="text-label-12 text-ink-2 tnum">
          {t('work.campaigns.concurrent', { n: running, max: PLANS.pipeline.concurrentCampaigns })}
        </span>
      }
    />
  );
}

/* ---------------- Signaux ---------------- */
export function SignalsView() {
  const t = useT();
  const locale = useLocale();
  const { can } = usePerm();
  const [type, setType] = React.useState('all');
  const [alerts, setAlerts] = React.useState<Record<string, boolean>>(
    Object.fromEntries(DEMO_ALERTS.map((a) => [a.id, a.on])),
  );
  const types = ['all', 'funding', 'hiring', 'tender', 'creation', 'move', 'reviews'] as const;
  const list = DEMO_SIGNALS.filter((s) => type === 'all' || s.type === type);
  const days = ['today', 'yesterday', 'earlier'] as const;
  const label = (k: string) =>
    k === 'all' ? t('app.common.all') : t(`work.signalNames.${k}` as MessageKey);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 content-start gap-3">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label={t('app.common.filter')}
        >
          {types.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => setType(k)}
              className="h-8 shrink-0 rounded-sm border border-line bg-surface px-2.5 text-label-13 text-ink-2 hover:border-line-strong aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-ink max-sm:h-10"
            >
              {label(k)}
              <span className="ml-1.5 text-ink-3 tnum">
                {k === 'all'
                  ? DEMO_SIGNALS.length
                  : DEMO_SIGNALS.filter((s) => s.type === k).length}
              </span>
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <Panel>
            <EmptyState title={t('work.signals.emptyTitle')}>
              {t('work.signals.emptyBody')}
            </EmptyState>
          </Panel>
        ) : (
          days.map((d) => {
            const items = list.filter((s) => s.day === d);
            if (!items.length) return null;
            return (
              <section key={d} aria-labelledby={`d-${d}`}>
                <h2 id={`d-${d}`} className="mb-2 text-label-13 text-ink-3">
                  {t(`work.signals.day.${d}`)}
                </h2>
                <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)_auto]"
                    >
                      <span className="text-label-12 text-ink-3">
                        <Badge tone="outline">{label(s.type)}</Badge>
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-label-14 font-semibold">
                          {s.org}
                          <CountryCode code={s.cc} />
                          <span className="text-label-12 font-normal text-ink-3">
                            {s.when[locale]}
                          </span>
                        </p>
                        <p className="text-copy-14 text-ink-2">{s.text[locale]}</p>
                        <p className="text-label-12 font-normal text-ink-3">
                          {t('app.common.source')} : {s.source}
                        </p>
                      </div>
                      {can('pipeline:write') ? (
                        <Button
                          size="sm"
                          className="self-start"
                          onClick={() => toast(t('app.prospect.addedToPipeline'))}
                        >
                          <KanbanSquare aria-hidden strokeWidth={1.75} />
                          <span className="max-lg:sr-only">{t('work.signals.addPipeline')}</span>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        )}
      </div>
      <Panel className="self-start" aria-labelledby="h-alerts">
        <PanelHeader>
          <PanelTitle id="h-alerts">{t('work.signals.alerts')}</PanelTitle>
          {can('campaign:write') ? (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => toast(t('work.signals.alertCreated'))}
            >
              <Plus aria-hidden strokeWidth={1.75} />
              {t('work.signals.newAlert')}
            </Button>
          ) : null}
        </PanelHeader>
        <ul className="divide-y divide-line">
          {DEMO_ALERTS.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <Bell className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-14">{a.name[locale]}</p>
                <p className="text-label-12 font-normal text-ink-3">
                  {t('work.signals.hits', { n: a.hits })}
                </p>
              </div>
              <Switch
                checked={alerts[a.id]}
                disabled={!can('campaign:write')}
                aria-label={a.name[locale]}
                onCheckedChange={(v) => setAlerts((x) => ({ ...x, [a.id]: v }))}
              />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ---------------- Automatisations ---------------- */
export function AutomationsView() {
  const t = useT();
  const locale = useLocale();
  const { can } = usePerm();
  const manage = can('automation:manage');
  const [on, setOn] = React.useState<Record<string, boolean>>(
    Object.fromEntries(DEMO_AUTOMATIONS.map((r) => [r.id, r.on])),
  );
  const [builder, setBuilder] = React.useState(false);
  const arg = (v: string) =>
    v === 'replied' || v === 'won'
      ? t(`app.stages.${v}`)
      : v === 'funding'
        ? t('work.signalNames.funding')
        : v;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-label-13 font-normal text-ink-3">
          {manage ? null : t('work.automations.readOnly')}
        </p>
        <span className="flex-1" />
        {manage ? (
          <Button variant="primary" onClick={() => setBuilder(true)}>
            <Plus aria-hidden strokeWidth={1.75} />
            {t('work.automations.newRule')}
          </Button>
        ) : null}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {DEMO_AUTOMATIONS.map((r) => (
          <li
            key={r.id}
            className={cn(
              'grid items-center gap-x-4 gap-y-2 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto]',
              !on[r.id] && 'opacity-60',
            )}
          >
            <p className="flex items-center gap-2 text-copy-14">
              <Zap className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
              <span className="text-label-12 text-ink-3">{t('work.automations.when')}</span>
              <b className="font-semibold">
                {t(`work.automations.trigger.${r.trigger}`, { arg: arg(r.triggerArg) })}
              </b>
            </p>
            <p className="flex items-center gap-2 text-copy-14">
              <span className="text-label-12 text-ink-3">{t('work.automations.then')}</span>
              <span>{t(`work.automations.action.${r.action}`, { arg: arg(r.actionArg) })}</span>
            </p>
            <p className="text-label-12 font-normal text-ink-3 tnum">
              {t('work.automations.runs', { n: r.runs })}
              <br />
              {t('work.automations.last', { when: r.last[locale] })}
            </p>
            <Switch
              checked={on[r.id]}
              disabled={!manage}
              aria-label={t(`work.automations.trigger.${r.trigger}`, { arg: arg(r.triggerArg) })}
              onCheckedChange={(v) => setOn((x) => ({ ...x, [r.id]: v }))}
            />
          </li>
        ))}
      </ul>
      <Dialog open={builder} onOpenChange={setBuilder}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('work.automations.builderTitle')}</DialogTitle>
            <DialogDescription>{t('work.automations.builderLede')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="trg">{t('work.automations.triggerLabel')}</Label>
              <Select defaultValue="replied">
                <SelectTrigger id="trg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ['replied', 'score_above', 'signal', 'task_overdue', 'stage_changed'] as const
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`work.automations.trigger.${k}`, {
                        arg:
                          k === 'score_above'
                            ? '80'
                            : k === 'task_overdue'
                              ? '2'
                              : k === 'signal'
                                ? t('work.signalNames.funding')
                                : t('app.stages.won'),
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="act">{t('work.automations.actionLabel')}</Label>
              <Select defaultValue="create_task">
                <SelectTrigger id="act">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['move_stage', 'assign', 'create_task', 'notify', 'add_to_list'] as const).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {t(`work.automations.action.${k}`, {
                          arg:
                            k === 'move_stage'
                              ? t('app.stages.replied')
                              : k === 'assign'
                                ? 'James Carter'
                                : 'Clients 2026',
                        })}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuilder(false)}>
              {t('app.common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setBuilder(false);
                toast(t('work.automations.created'));
              }}
            >
              {t('app.common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------- Messages ---------------- */
const chIcon = { email: Mail, whatsapp: MessageCircle, phone: Phone } as const;
export function InboxView() {
  const t = useT();
  const locale = useLocale();
  const { can } = usePerm();
  const [folder, setFolder] = React.useState<'all' | 'unread' | 'email' | 'whatsapp' | 'phone'>(
    'all',
  );
  const [activeId, setActiveId] = React.useState<string | null>(DEMO_THREADS[0]!.id);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const threads = DEMO_THREADS.filter(
    (th) => folder === 'all' || (folder === 'unread' ? th.unread : th.channel === folder),
  );
  const active = DEMO_THREADS.find((th) => th.id === activeId) ?? null;
  const p = active ? getDemoProspect(active.prospect) : null;
  const [reply, setReply] = React.useState('');
  React.useEffect(() => setReply(active?.draft?.[locale] ?? ''), [active, locale]);
  const folders = [
    ['all', t('work.inbox.fAll'), DEMO_THREADS.length],
    ['unread', t('work.inbox.fUnread'), DEMO_THREADS.filter((x) => x.unread).length],
    ['email', t('work.inbox.fEmail'), DEMO_THREADS.filter((x) => x.channel === 'email').length],
    [
      'whatsapp',
      t('work.inbox.fWhatsapp'),
      DEMO_THREADS.filter((x) => x.channel === 'whatsapp').length,
    ],
    ['phone', t('work.inbox.fPhone'), DEMO_THREADS.filter((x) => x.channel === 'phone').length],
  ] as const;
  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[180px_320px_minmax(0,1fr)]">
      <nav
        aria-label={t('work.inbox.folders')}
        className={cn(
          'border-line p-2 max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto max-lg:border-b lg:border-r',
          mobileOpen && 'max-lg:hidden',
        )}
      >
        {folders.map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            aria-pressed={folder === k}
            onClick={() => setFolder(k)}
            className="flex h-8 w-full shrink-0 items-center gap-2 rounded-sm px-2 text-left text-label-14 text-ink-2 hover:bg-hover aria-pressed:bg-sunken aria-pressed:text-ink max-lg:h-10 max-lg:w-auto"
          >
            <span className="flex-1 whitespace-nowrap">{label}</span>
            <span className="text-label-12 text-ink-3 tnum">{n}</span>
          </button>
        ))}
      </nav>
      <ul
        className={cn(
          'divide-y divide-line border-line lg:border-r',
          mobileOpen && 'max-lg:hidden',
        )}
      >
        {threads.map((th) => {
          const tp = getDemoProspect(th.prospect);
          const Icon = chIcon[th.channel];
          return (
            <li key={th.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveId(th.id);
                  setMobileOpen(true);
                }}
                aria-current={th.id === activeId ? 'true' : undefined}
                className="grid w-full gap-0.5 px-4 py-3 text-left hover:bg-[#fafafb] aria-[current=true]:bg-accent-soft aria-[current=true]:shadow-[inset_2px_0_0_var(--accent)]"
              >
                <span className="flex items-center gap-2">
                  {th.unread ? (
                    <i
                      className="size-1.5 rounded-full bg-accent"
                      aria-label={t('work.inbox.fUnread')}
                    />
                  ) : null}
                  <b
                    className={cn(
                      'truncate text-label-14',
                      th.unread ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {tp?.person}
                  </b>
                  <span className="ml-auto flex items-center gap-1.5 text-label-12 font-normal text-ink-3">
                    <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                    {th.when[locale]}
                  </span>
                </span>
                <span className="truncate text-label-13 font-normal text-ink">
                  {th.subject[locale]}
                </span>
                <span className="line-clamp-2 text-label-12 font-normal text-ink-3">
                  {th.preview[locale]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <section
        aria-label={active?.subject[locale] ?? t('work.inbox.select')}
        className={cn('flex min-w-0 flex-col', !mobileOpen && 'max-lg:hidden')}
      >
        {active && p ? (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden"
                aria-label={t('work.inbox.back')}
                onClick={() => setMobileOpen(false)}
              >
                <ArrowLeft aria-hidden strokeWidth={1.75} />
              </Button>
              <Avatar name={p.person} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-14 font-semibold">
                  {p.person} <CountryCode code={p.cc} />
                </p>
                <p className="truncate text-label-12 font-normal text-ink-3">
                  {p.role[locale]}, {p.org}
                </p>
              </div>
              <Badge>{t(`app.stages.${p.stage}`)}</Badge>
            </header>
            <ol className="grid flex-1 content-start gap-3 overflow-y-auto px-4 py-4">
              {active.messages.map((m, i) => (
                <li
                  key={i}
                  className={cn(
                    'max-w-[78%] rounded-md px-3 py-2.5 text-copy-14',
                    m.from === 'me'
                      ? 'justify-self-end bg-ink text-white'
                      : m.from === 'note'
                        ? 'justify-self-stretch max-w-none border border-dashed border-line-strong bg-canvas'
                        : 'border border-line bg-surface',
                  )}
                >
                  <p
                    className={cn(
                      'mb-1 text-label-12',
                      m.from === 'me' ? 'text-white/70' : 'text-ink-3',
                    )}
                  >
                    {m.from === 'me'
                      ? t('work.inbox.me')
                      : m.from === 'note'
                        ? t('work.inbox.note')
                        : p.person}
                    , {m.when[locale]}
                  </p>
                  <p>{m.body[locale]}</p>
                </li>
              ))}
            </ol>
            {active.draft && can('message:write') ? (
              <div className="grid gap-2 border-t border-line bg-canvas p-3">
                <p className="text-label-12 text-ink-3">{t('work.inbox.draft')}</p>
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  aria-label={t('work.inbox.reply')}
                  placeholder={t('work.inbox.placeholder')}
                />
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(reply);
                      toast(t('work.inbox.sentNote'));
                    }}
                  >
                    <Copy aria-hidden strokeWidth={1.75} />
                    {t('work.inbox.send')}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="p-8 text-copy-14 text-ink-3">{t('work.inbox.select')}</p>
        )}
      </section>
    </div>
  );
}

/* ---------------- Tâches et agenda ---------------- */
const typeIcon = {
  email: Mail,
  call: Phone,
  whatsapp: MessageCircle,
  meeting: CalendarClock,
} as const;
export function TasksView() {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { can } = usePerm();
  const [done, setDone] = React.useState<string[]>(
    DEMO_TASKS.filter((x) => x.done).map((x) => x.id),
  );
  const [create, setCreate] = React.useState(false);
  const groups = ['overdue', 'today', 'tomorrow', 'later'] as const;
  const days = Array.from({ length: 5 }, (_, i) => new Date(2026, 10, 23 + i));
  const hours = Array.from({ length: 10 }, (_, i) => 8 + i);
  return (
    <Tabs defaultValue="list" className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <TabsList className="border-0">
          <TabsTrigger value="list">{t('app.common.list')}</TabsTrigger>
          <TabsTrigger value="agenda">{t('app.common.calendar')}</TabsTrigger>
        </TabsList>
        <span className="flex-1" />
        {can('task:write') ? (
          <Button variant="primary" onClick={() => setCreate(true)}>
            <Plus aria-hidden strokeWidth={1.75} />
            {t('work.tasks.newTask')}
          </Button>
        ) : null}
      </div>
      <TabsContent value="list" className="grid gap-4">
        {groups.map((g) => {
          const items = DEMO_TASKS.filter((x) => x.due === g);
          if (!items.length) return null;
          return (
            <section key={g} aria-labelledby={`g-${g}`}>
              <h2
                id={`g-${g}`}
                className={cn(
                  'mb-2 flex items-center gap-2 text-label-13',
                  g === 'overdue' ? 'text-bad' : 'text-ink-3',
                )}
              >
                {t(`work.tasks.groups.${g}`)}
                <span className="tnum">{items.length}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {items.map((task) => {
                  const p = getDemoProspect(task.prospect);
                  const Icon = typeIcon[task.type];
                  const isDone = done.includes(task.id);
                  return (
                    <li
                      key={task.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_200px_140px_80px]"
                    >
                      <Checkbox
                        checked={isDone}
                        disabled={!can('task:write')}
                        aria-label={`${t('work.tasks.done')} : ${task.title[locale]}`}
                        onCheckedChange={(v) =>
                          setDone((d) =>
                            v === true ? [...d, task.id] : d.filter((x) => x !== task.id),
                          )
                        }
                      />
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon
                          className="size-4 shrink-0 text-ink-3"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'truncate text-label-14',
                            isDone && 'text-ink-3 line-through',
                          )}
                        >
                          {task.title[locale]}
                        </span>
                      </span>
                      <Link
                        href={`/prospects?open=${task.prospect}`}
                        className="truncate text-label-13 font-normal text-ink-2 hover:text-ink max-sm:hidden"
                      >
                        {p?.org}
                      </Link>
                      <span className="inline-flex items-center gap-2 text-label-13 font-normal text-ink-2 max-sm:hidden">
                        <Avatar name={task.owner} size="sm" />
                        {task.owner.split(' ')[0]}
                      </span>
                      <time
                        className={cn(
                          'text-right text-label-13 tnum',
                          g === 'overdue' ? 'text-bad' : 'text-ink-3',
                        )}
                      >
                        {task.time[locale]}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </TabsContent>
      <TabsContent value="agenda">
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <p className="border-b border-line px-4 py-2.5 text-label-14 font-semibold">
            {t('work.tasks.week')}
          </p>
          <div className="grid min-w-[720px] grid-cols-[56px_repeat(5,minmax(0,1fr))]">
            <div />
            {days.map((d) => (
              <div
                key={d.toISOString()}
                className="border-b border-l border-line px-2 py-2 text-label-13"
              >
                {d.toLocaleDateString(fmt.tag, { weekday: 'short', day: 'numeric' })}
              </div>
            ))}
            <div className="relative col-span-6 grid grid-cols-[56px_repeat(5,minmax(0,1fr))]">
              <div>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="h-12 border-b border-line pr-2 pt-1 text-right text-label-12 font-normal text-ink-3 tnum"
                  >{`${h}:00`}</div>
                ))}
              </div>
              {days.map((_, di) => (
                <div key={di} className="relative border-l border-line">
                  {hours.map((h) => (
                    <div key={h} className="h-12 border-b border-line" />
                  ))}
                  {DEMO_AGENDA.filter((e) => e.day === di).map((e) => (
                    <div
                      key={e.title.fr}
                      className="absolute inset-x-1 overflow-hidden rounded-sm border-l-2 border-accent bg-accent-soft px-1.5 py-1 text-label-12"
                      style={{
                        top: `${(e.start - 8) * 48 + 2}px`,
                        height: `${(e.end - e.start) * 48 - 4}px`,
                      }}
                    >
                      <p className="truncate font-semibold">{e.title[locale]}</p>
                      <p className="truncate font-normal text-ink-2">{e.who}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('work.tasks.newTask')}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setCreate(false);
              toast(t('work.tasks.created'));
            }}
          >
            <Field id="tt" label={t('work.tasks.taskTitle')}>
              <Input required />
            </Field>
            <Field id="td" label={t('work.tasks.taskDue')}>
              <Input type="datetime-local" required />
            </Field>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setCreate(false)}>
                {t('app.common.cancel')}
              </Button>
              <Button variant="primary" type="submit">
                {t('app.common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
