'use client';
import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { Avatar, Button, Panel, Segmented, cn } from '@scoutra/ui';
import { useFormat, useT } from '@/lib/i18n/client';
import { DEMO_REPORTS } from '@/lib/demo/workspace';
import { DEMO_MEMBERS } from '@/lib/demo/team';
import { useApp, usePerm } from './app-provider';

const INK3 = '#6a707c';
const LINE = '#e4e6ea';
const ACCENT = '#ff5b1f';
const MUTED = '#cdd1d8';
const tick = { fill: INK3, fontSize: 12 };

function TooltipBox({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm bg-ink px-2 py-1 text-label-12 text-white shadow-pop">
      <span className="text-white/70">{label}</span>{' '}
      <b className="font-semibold tnum">{fmt(payload[0]!.value)}</b>
    </div>
  );
}

/** Carte de graphique : titre = la conclusion, bascule vers une table équivalente. */
function ChartCard({
  title,
  sub,
  table,
  children,
  className,
}: {
  title: string;
  sub: string;
  table: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const [asTable, setAsTable] = React.useState(false);
  return (
    <Panel className={cn('flex flex-col', className)}>
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14.5px] font-semibold leading-5">{title}</h2>
          <p className="text-label-12 font-normal text-ink-3">{sub}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-pressed={asTable}
          aria-label={asTable ? t('app.common.showChart') : t('app.common.showTable')}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? (
            <BarChart3 aria-hidden strokeWidth={1.75} />
          ) : (
            <Table2 aria-hidden strokeWidth={1.75} />
          )}
        </Button>
      </div>
      <div className="flex-1 px-2 py-3">
        {asTable ? <div className="px-2">{table}</div> : children}
      </div>
    </Panel>
  );
}

function SimpleTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <table className="w-full text-copy-14">
      <thead>
        <tr className="border-b border-line text-left text-label-13 text-ink-3">
          <th scope="col" className="py-1.5 font-medium">
            {head[0]}
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            {head[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a} className="border-b border-line last:border-0">
            <th scope="row" className="py-1.5 text-left font-normal">
              {a}
            </th>
            <td className="py-1.5 text-right tnum">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AnalyticsView() {
  const t = useT();
  const fmt = useFormat();
  const { org } = useApp();
  const { can } = usePerm();
  const [range, setRange] = React.useState<'7' | '30' | '90'>('90');
  const funnel = DEMO_REPORTS.funnel.map((f) => ({
    name: t(`app.stages.${f.stage as 'new'}`),
    value: f.n,
    key: f.stage,
  }));
  const channels = [...DEMO_REPORTS.channels]
    .sort((a, b) => b.rate - a.rate)
    .map((c) => ({ name: t(`app.channels.${c.channel as 'email'}`), value: c.rate }));
  const countries = DEMO_REPORTS.countries.map((c) => ({ name: fmt.country(c.cc), value: c.n }));
  const barProps = {
    barSize: 10,
    radius: [0, 4, 4, 0] as [number, number, number, number],
    isAnimationActive: false,
  };
  const hbar = (
    data: { name: string; value: number; key?: string }[],
    valueFmt: (v: number) => string,
    highlight: (i: number, d: { key?: string }) => boolean,
  ) => (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 10)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 56, bottom: 0, left: 8 }}
        barCategoryGap={2}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={tick}
          axisLine={false}
          tickLine={false}
        />
        <RTooltip cursor={{ fill: '#f5f6f7' }} content={<TooltipBox fmt={valueFmt} />} />
        <Bar dataKey="value" {...barProps}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={highlight(i, d) ? ACCENT : MUTED} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => valueFmt(Number(v))}
            style={{
              fill: '#12141a',
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'7' | '30' | '90'>
          label={t('insight.analytics.range')}
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: t('insight.analytics.d7') },
            { value: '30', label: t('insight.analytics.d30') },
            { value: '90', label: t('insight.analytics.d90') },
          ]}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t('insight.analytics.funnelTitle')}
          sub={t('insight.analytics.funnelSub')}
          table={
            <SimpleTable
              head={[t('insight.analytics.stage'), t('insight.analytics.prospects')]}
              rows={funnel.map((f) => [f.name, fmt.n(f.value)])}
            />
          }
        >
          {hbar(
            funnel,
            (v) => fmt.n(v),
            (_, d) => d.key === 'replied',
          )}
        </ChartCard>
        <ChartCard
          title={t('insight.analytics.channelTitle')}
          sub={t('insight.analytics.channelSub')}
          table={
            <SimpleTable
              head={[t('app.common.channel'), t('insight.analytics.rate')]}
              rows={channels.map((c) => [c.name, fmt.pct(c.value)])}
            />
          }
        >
          {hbar(
            channels,
            (v) => fmt.pct(v),
            (i) => i === 0,
          )}
        </ChartCard>
        <ChartCard
          title={t('insight.analytics.weeklyTitle')}
          sub={t('insight.analytics.weeklySub')}
          table={
            <SimpleTable
              head={[t('insight.analytics.week'), t('insight.analytics.delivered')]}
              rows={DEMO_REPORTS.weekly.map((w) => [w.w, fmt.n(w.delivered)])}
            />
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={DEMO_REPORTS.weekly}
              margin={{ top: 8, right: 16, bottom: 0, left: -12 }}
            >
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis
                dataKey="w"
                tick={tick}
                axisLine={{ stroke: LINE }}
                tickLine={false}
                interval={1}
              />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={40} />
              <RTooltip cursor={{ stroke: MUTED }} content={<TooltipBox fmt={(v) => fmt.n(v)} />} />
              <Line
                type="monotone"
                dataKey="delivered"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title={t('insight.analytics.countryTitle')}
          sub={t('insight.analytics.countrySub')}
          table={
            <SimpleTable
              head={[t('insight.analytics.country'), t('insight.analytics.prospects')]}
              rows={countries.map((c) => [c.name, fmt.n(c.value)])}
            />
          }
        >
          {hbar(
            countries,
            (v) => fmt.n(v),
            (i) => i < 2,
          )}
        </ChartCard>
        <ChartCard
          className="lg:col-span-2"
          title={t('insight.analytics.creditsTitle')}
          sub={t('insight.analytics.creditsSub')}
          table={
            <SimpleTable
              head={[t('insight.analytics.day'), t('insight.analytics.credits')]}
              rows={DEMO_REPORTS.credits.map((c) => [c.d, fmt.n(c.used)])}
            />
          }
        >
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={DEMO_REPORTS.credits}
              margin={{ top: 8, right: 16, bottom: 0, left: -4 }}
            >
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="d" tick={tick} axisLine={{ stroke: LINE }} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={48} />
              <RTooltip cursor={{ stroke: MUTED }} content={<TooltipBox fmt={(v) => fmt.n(v)} />} />
              <Line
                type="monotone"
                dataKey="used"
                stroke={ACCENT}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[14.5px] font-semibold">{t('insight.analytics.teamTitle')}</h2>
          {!can('report:read_team') ? (
            <p className="text-label-12 font-normal text-ink-3">{t('insight.analytics.teamOwn')}</p>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-copy-14">
            <thead className="bg-sunken text-left text-label-13 text-ink-3">
              <tr className="h-9">
                <th scope="col" className="pl-4 font-medium">
                  {t('insight.analytics.colMember')}
                </th>
                <th scope="col" className="text-right font-medium">
                  {t('insight.analytics.colProspects')}
                </th>
                <th scope="col" className="px-3 font-medium">
                  {t('insight.analytics.colMeetings')}
                </th>
                <th scope="col" className="pr-4 text-right font-medium">
                  {t('insight.analytics.colWon')}
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_MEMBERS.filter(
                (m) =>
                  m.goalMeetings &&
                  (can('report:read_team') ||
                    (org.dataScope === 'own' && m.name === 'Sofia Rossi')),
              ).map((m) => (
                <tr key={m.id} className="h-11 border-t border-line">
                  <th scope="row" className="pl-4 text-left font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={m.name} size="sm" />
                      {m.name}
                    </span>
                  </th>
                  <td className="text-right tnum">{m.prospectsMonth}</td>
                  <td className="px-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="block h-1.5 w-24 overflow-hidden rounded-[2px] bg-sunken"
                        aria-hidden
                      >
                        <span
                          className="block h-full origin-left bg-accent"
                          style={{
                            transform: `scaleX(${Math.min(1, m.meetingsMonth / m.goalMeetings)})`,
                          }}
                        />
                      </span>
                      <span className="text-label-12 text-ink-2 tnum">
                        {t('insight.team.of', { n: m.meetingsMonth, goal: m.goalMeetings })}
                      </span>
                    </span>
                  </td>
                  <td className="pr-4 text-right tnum">
                    {t('insight.team.of', { n: m.wonMonth, goal: m.goalWon })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
