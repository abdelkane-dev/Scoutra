'use client';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { KanbanSquare, ListPlus, Workflow, Download, UserPlus, Check, X, Mail, Phone, MessageCircle, Ban } from 'lucide-react';
import { Avatar, Badge, CountryCode, Score, Status, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, cn, toast } from '@scoutra/ui';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { DEMO_LISTS, DEMO_PROSPECTS } from '@/lib/demo/prospects';
import { DEMO_MEMBERS } from '@/lib/demo/team';
import type { DemoProspect, Stage } from '@/lib/demo/types';
import { allowedChannels } from '@/lib/channel-rules';
import { DataTable, type Column, type Facet, type SavedView } from './data-table';
import { ProspectSheet } from './prospect-sheet';
import { useApp, usePerm } from './app-provider';

const tone = { valid: 'ok', risky: 'warn', invalid: 'bad', none: 'none' } as const;
const STAGES: Stage[] = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'];

function BulkButton({ icon: Icon, label, onClick }: { icon: typeof Mail; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-white/90 hover:bg-white/10 hover:text-white max-sm:h-9">
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
      <span className="max-md:sr-only">{label}</span>
    </button>
  );
}

function useProspectBits() {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { org, user } = useApp();
  // Portée « own » (membre) : uniquement ses prospects ; démonstration : propriétaire = Sofia Rossi.
  const rows = org.dataScope === 'own' ? DEMO_PROSPECTS.filter((p) => p.owner === 'Sofia Rossi') : DEMO_PROSPECTS;
  const countries = [...new Set(DEMO_PROSPECTS.map((p) => p.cc))].sort();
  const facets: Facet<DemoProspect>[] = [
    { id: 'cc', label: t('work.base.fCountry'), options: countries.map((c) => ({ value: c, label: `${c}, ${fmt.country(c)}` })), get: (p) => p.cc },
    { id: 'stage', label: t('work.base.fStage'), options: STAGES.map((s) => ({ value: s, label: t(`app.stages.${s}`) })), get: (p) => p.stage },
    { id: 'email', label: t('work.base.fEmail'), options: (['valid', 'risky', 'invalid', 'none'] as const).map((s) => ({ value: s, label: t(`app.emailStatus.${s}`) })), get: (p) => p.emailStatus },
    { id: 'owner', label: t('work.base.fOwner'), options: DEMO_MEMBERS.filter((m) => m.prospectsMonth).map((m) => ({ value: m.name, label: m.name })), get: (p) => p.owner },
  ];
  const views: SavedView<DemoProspect>[] = [
    { id: 'all', label: t('work.base.viewAll'), filter: () => true },
    { id: 'mine', label: t('work.base.viewMine'), filter: (p) => p.owner === user.name || p.owner === 'Léa Martin' },
    { id: 'hot', label: t('work.base.viewHot'), filter: (p) => p.score >= 80 },
    { id: 'week', label: t('work.base.viewWeek'), filter: (p) => p.addedDaysAgo <= 7 },
    { id: 'noemail', label: t('work.base.viewNoEmail'), filter: (p) => p.emailStatus !== 'valid' },
  ];
  return { t, locale, fmt, rows, facets, views };
}

function useBulk() {
  const t = useT();
  const { can } = usePerm();
  return (ids: string[], clear: () => void) => {
    const done = () => {
      toast(t('work.base.bulkDone', { n: ids.length }));
      clear();
    };
    return (
      <>
        {can('prospect:write') ? <BulkButton icon={ListPlus} label={t('work.base.bulkList')} onClick={done} /> : null}
        {can('pipeline:write') ? <BulkButton icon={KanbanSquare} label={t('work.base.bulkPipeline')} onClick={done} /> : null}
        {can('sequence:enroll') ? <BulkButton icon={Workflow} label={t('work.base.bulkSequence')} onClick={done} /> : null}
        {can('prospect:assign') ? <BulkButton icon={UserPlus} label={t('work.base.bulkAssign')} onClick={done} /> : null}
        {can('prospect:export') ? <BulkButton icon={Download} label={t('work.base.bulkExport')} onClick={done} /> : null}
      </>
    );
  };
}

function prospectColumns(t: ReturnType<typeof useT>, locale: 'fr' | 'en', fmt: ReturnType<typeof useFormat>, kind: 'company' | 'person'): Column<DemoProspect>[] {
  return [
    {
      id: 'name',
      header: kind === 'company' ? t('work.base.colOrg') : t('work.base.colProspect'),
      primary: true,
      sortValue: (p) => (kind === 'company' ? p.org : p.person),
      cell: (p) => (
        <span className="block min-w-0">
          <b className="block truncate font-semibold">{kind === 'company' ? p.org : p.person}</b>
          <span className="block truncate text-label-12 font-normal text-ink-3">
            {kind === 'company' ? `${p.person}, ${p.role[locale]}` : `${p.role[locale]}, ${p.org}`}
          </span>
        </span>
      ),
    },
    { id: 'cc', header: t('work.base.colCountry'), sortValue: (p) => p.cc, cell: (p) => <span className="inline-flex items-center gap-2"><CountryCode code={p.cc} title={fmt.country(p.cc)} /><span className="text-ink-2">{p.city[locale]}</span></span>, mobileHidden: true },
    { id: 'email', header: t('work.base.colEmail'), sortValue: (p) => p.emailStatus, cell: (p) => <Status tone={tone[p.emailStatus]}>{t(`app.emailStatus.${p.emailStatus}`)}</Status>, mobileHidden: true },
    { id: 'phone', header: t('work.base.colPhone'), cell: (p) => <span className="text-ink-2 tnum">{p.phone ?? '—'}</span>, hidden: true, mobileHidden: true },
    { id: 'stage', header: t('work.base.colStage'), sortValue: (p) => STAGES.indexOf(p.stage), cell: (p) => <Badge tone={p.stage === 'won' ? 'accent' : 'neutral'}>{t(`app.stages.${p.stage}`)}</Badge>, mobileHidden: true },
    { id: 'owner', header: t('work.base.colOwner'), sortValue: (p) => p.owner, cell: (p) => <span className="inline-flex items-center gap-2 text-ink-2"><Avatar name={p.owner} size="sm" />{p.owner.split(' ')[0]}</span>, mobileHidden: true },
    { id: 'source', header: t('work.base.colSource'), sortValue: (p) => p.source, cell: (p) => <span className="text-ink-2">{p.source}</span>, hidden: true, mobileHidden: true },
    { id: 'value', header: t('work.base.colValue'), align: 'right', sortValue: (p) => p.valueUsd, cell: (p) => (p.valueUsd ? fmt.money(p.valueUsd) : '—'), mobileHidden: true },
    { id: 'added', header: t('work.base.colAdded'), align: 'right', sortValue: (p) => -p.addedDaysAgo, cell: (p) => <span className="text-ink-3">{t('work.base.addedAgo', { n: p.addedDaysAgo })}</span>, mobileHidden: true },
    { id: 'score', header: t('work.base.colScore'), sortValue: (p) => p.score, cell: (p) => <Score value={p.score} /> },
  ];
}

export function ProspectsView() {
  const { t, locale, fmt, rows, facets, views } = useProspectBits();
  const bulk = useBulk();
  const params = useSearchParams();
  const [open, setOpen] = React.useState<DemoProspect | null>(() => DEMO_PROSPECTS.find((p) => p.id === params.get('open')) ?? null);
  const companies = rows.filter((p) => p.kind === 'company');
  const people = rows;
  const search = (p: DemoProspect) => `${p.person} ${p.org} ${p.city[locale]} ${p.source}`;
  return (
    <Tabs defaultValue="companies" className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <TabsList>
        <TabsTrigger value="companies">{t('work.base.tabCompanies')} <span className="text-label-12 text-ink-3 tnum">{companies.length}</span></TabsTrigger>
        <TabsTrigger value="people">{t('work.base.tabPeople')} <span className="text-label-12 text-ink-3 tnum">{people.length}</span></TabsTrigger>
        <TabsTrigger value="lists">{t('work.base.tabLists')} <span className="text-label-12 text-ink-3 tnum">{DEMO_LISTS.length}</span></TabsTrigger>
      </TabsList>
      <TabsContent value="companies">
        <DataTable rows={companies} columns={prospectColumns(t, locale, fmt, 'company')} getId={(p) => p.id} getLabel={(p) => p.org} facets={facets} views={views} searchText={search} onRowClick={setOpen} activeId={open?.id} bulkActions={bulk} caption={t('work.base.tabCompanies')} />
      </TabsContent>
      <TabsContent value="people">
        <DataTable rows={people} columns={prospectColumns(t, locale, fmt, 'person')} getId={(p) => p.id} getLabel={(p) => p.person} facets={facets} views={views} searchText={search} onRowClick={setOpen} activeId={open?.id} bulkActions={bulk} caption={t('work.base.tabPeople')} />
      </TabsContent>
      <TabsContent value="lists">
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {DEMO_LISTS.map((l) => {
            const items = DEMO_PROSPECTS.filter((p) => p.lists.includes(l));
            return (
              <li key={l} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-14 font-semibold">{l}</p>
                  <p className="text-label-12 font-normal text-ink-3">{t('work.base.listCount', { n: items.length })}</p>
                </div>
                <span className="flex -space-x-1.5" aria-hidden>
                  {items.slice(0, 4).map((p) => <Avatar key={p.id} name={p.person} size="sm" className="ring-2 ring-surface" />)}
                </span>
              </li>
            );
          })}
        </ul>
      </TabsContent>
      <ProspectSheet prospect={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </Tabs>
  );
}

export function LeadsView() {
  const { t, locale, fmt, rows, facets } = useProspectBits();
  const { can } = usePerm();
  const bulk = useBulk();
  const [open, setOpen] = React.useState<DemoProspect | null>(null);
  const [qualif, setQualif] = React.useState<Record<string, 'todo' | 'qualified' | 'rejected'>>({});
  const leads = rows.filter((p) => p.stage === 'new' || p.stage === 'contacted');
  const state = (p: DemoProspect) => qualif[p.id] ?? (p.score >= 85 ? 'qualified' : 'todo');
  const cols: Column<DemoProspect>[] = [
    prospectColumns(t, locale, fmt, 'person')[0]!,
    { id: 'source', header: t('work.base.colSource'), sortValue: (p) => p.source, cell: (p) => <span className="text-ink-2">{p.source}</span>, mobileHidden: true },
    { id: 'cc', header: t('work.base.colCountry'), cell: (p) => <CountryCode code={p.cc} title={fmt.country(p.cc)} />, mobileHidden: true },
    { id: 'sla', header: t('work.base.colSla'), align: 'right', sortValue: (p) => p.addedDaysAgo, cell: (p) => <span className={cn(p.addedDaysAgo > 1 ? 'text-bad' : 'text-ink-2')}>{t('work.base.slaHours', { n: Math.max(2, p.addedDaysAgo * 24) })}</span>, mobileHidden: true },
    { id: 'owner', header: t('work.base.colOwner'), cell: (p) => <span className="inline-flex items-center gap-2 text-ink-2"><Avatar name={p.owner} size="sm" />{p.owner.split(' ')[0]}</span>, mobileHidden: true },
    {
      id: 'qualif',
      header: t('work.base.colQualif'),
      cell: (p) => {
        const s = state(p);
        return (
          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Status tone={s === 'qualified' ? 'ok' : s === 'rejected' ? 'bad' : 'none'} className="w-24">{t(`work.base.qualif.${s}`)}</Status>
            {can('prospect:write') && s === 'todo' ? (
              <>
                <Tooltip content={t('work.base.qualify')}>
                  <button type="button" aria-label={`${t('work.base.qualify')} : ${p.person}`} className="grid size-7 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ok" onClick={() => setQualif((q) => ({ ...q, [p.id]: 'qualified' }))}>
                    <Check className="size-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </Tooltip>
                <Tooltip content={t('work.base.disqualify')}>
                  <button type="button" aria-label={`${t('work.base.disqualify')} : ${p.person}`} className="grid size-7 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-bad" onClick={() => setQualif((q) => ({ ...q, [p.id]: 'rejected' }))}>
                    <X className="size-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </Tooltip>
              </>
            ) : null}
          </span>
        );
      },
    },
    { id: 'score', header: t('work.base.colScore'), sortValue: (p) => p.score, cell: (p) => <Score value={p.score} /> },
  ];
  return (
    <>
      <DataTable rows={leads} columns={cols} getId={(p) => p.id} getLabel={(p) => p.person} facets={facets.slice(0, 1).concat(facets.slice(3))} searchText={(p) => `${p.person} ${p.org}`} onRowClick={setOpen} activeId={open?.id} bulkActions={bulk} caption={t('work.base.leadsTitle')} />
      <ProspectSheet prospect={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}

export function ContactsView() {
  const { t, locale, rows, facets } = useProspectBits();
  const [open, setOpen] = React.useState<DemoProspect | null>(null);
  const chIcons = { email: Mail, phone: Phone, whatsapp: MessageCircle, linkedin_manual: UserPlus } as const;
  const cols: Column<DemoProspect>[] = [
    {
      id: 'name',
      header: t('work.base.colProspect'),
      primary: true,
      sortValue: (p) => p.person,
      cell: (p) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={p.person} />
          <span className="min-w-0">
            <b className="block truncate font-semibold">{p.person}</b>
            <span className="block truncate text-label-12 font-normal text-ink-3">{p.role[locale]}</span>
          </span>
        </span>
      ),
    },
    { id: 'org', header: t('work.base.colOrg'), sortValue: (p) => p.org, cell: (p) => <span className="text-ink-2">{p.org}</span>, mobileHidden: true },
    { id: 'email', header: t('work.base.colEmail'), cell: (p) => (p.email ? <span className="inline-flex items-center gap-2"><span className="text-ink-2">{p.email}</span><Status tone={tone[p.emailStatus]}><span className="sr-only">{t(`app.emailStatus.${p.emailStatus}`)}</span></Status></span> : <span className="text-ink-3">—</span>), mobileHidden: true },
    { id: 'phone', header: t('work.base.colPhone'), cell: (p) => <span className="text-ink-2 tnum">{p.phone ?? '—'}</span>, mobileHidden: true },
    {
      id: 'channels',
      header: t('work.base.colChannels'),
      cell: (p) => {
        const allowed = allowedChannels(p.cc, p.kind);
        return (
          <span className="inline-flex gap-1">
            {(['email', 'phone', 'whatsapp'] as const).map((c) => {
              const Icon = chIcons[c];
              const ok = allowed.includes(c);
              return (
                <Tooltip key={c} content={`${t(`app.channels.${c}`)} : ${ok ? t('app.common.yes') : t('app.common.no')}`}>
                  <span tabIndex={0} className={cn('grid size-6 place-items-center rounded-xs', ok ? 'bg-sunken text-ink-2' : 'text-line-strong')}>
                    <Icon className="size-3.5" strokeWidth={1.75} aria-label={`${t(`app.channels.${c}`)} ${ok ? t('app.common.yes') : t('app.common.no')}`} />
                  </span>
                </Tooltip>
              );
            })}
          </span>
        );
      },
      mobileHidden: true,
    },
    { id: 'basis', header: t('work.base.colBasis'), cell: (p) => <span className="text-ink-2">{t(`app.legal.${p.legalBasis}`)}</span>, hidden: true },
    { id: 'last', header: t('work.base.colLast'), cell: (p) => (p.emailStatus === 'invalid' ? <Status tone="bad"><Ban className="sr-only" />{t('work.base.optedOut')}</Status> : <span className="text-ink-3">{p.lastActivity[locale]}</span>), mobileHidden: true },
  ];
  return (
    <>
      <DataTable rows={rows} columns={cols} getId={(p) => p.id} getLabel={(p) => p.person} facets={facets.slice(0, 1)} searchText={(p) => `${p.person} ${p.org} ${p.email}`} onRowClick={setOpen} activeId={open?.id} caption={t('work.base.contactsTitle')} />
      <ProspectSheet prospect={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}
