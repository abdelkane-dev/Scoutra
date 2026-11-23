import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, MessageCircle, Plus, Info } from 'lucide-react';
import { Avatar, Button, cn } from '@scoutra/ui';
import { pageKit, AppHeader, NotAllowed } from '@/components/app/page-kit';
import { PageBody } from '@/components/app/page-header';
import { DEMO_SEQUENCES, DEMO_TASKS } from '@/lib/demo/workspace';
import { getDemoProspect } from '@/lib/demo/prospects';
import { formatNumber } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await pageKit();
  return { title: t('work.sequences.title') };
}

const icon = { email: Mail, phone: Phone, whatsapp: MessageCircle } as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { ctx, t, locale, allowed } = await pageKit();
  if (!allowed(['sequence:read']))
    return <NotAllowed t={t} ctx={ctx} title="work.sequences.title" />;
  const { id } = await searchParams;
  const seq = DEMO_SEQUENCES.find((s) => s.id === id) ?? DEMO_SEQUENCES[0]!;
  const pct = (v: number) =>
    formatNumber(v, locale, { style: 'percent', maximumFractionDigits: 0 });
  const maxSent = Math.max(...seq.steps.map((s) => s.sent));
  return (
    <>
      <AppHeader
        t={t}
        ctx={ctx}
        section={{ label: t('app.nav.followup') }}
        title={t('work.sequences.title')}
        meta={t('work.sequences.meta')}
        actions={
          allowed(['sequence:manage']) ? (
            <Button variant="primary">
              <Plus aria-hidden strokeWidth={1.75} />
              {t('work.sequences.newSeq')}
            </Button>
          ) : null
        }
      />
      <PageBody className="lg:grid-cols-[320px_minmax(0,1fr)]">
        <ul className="grid content-start divide-y divide-line self-start overflow-hidden rounded-lg border border-line bg-surface">
          {DEMO_SEQUENCES.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sequences?id=${s.id}`}
                aria-current={s.id === seq.id ? 'page' : undefined}
                className={cn(
                  'grid gap-1 px-4 py-3 hover:bg-[#fafafb]',
                  s.id === seq.id && 'bg-accent-soft shadow-[inset_2px_0_0_var(--accent)]',
                )}
              >
                <span className="text-label-14 font-semibold">{s.name[locale]}</span>
                <span className="flex gap-3 text-label-12 font-normal text-ink-3 tnum">
                  <span>{t('work.sequences.enrolled', { n: s.enrolled })}</span>
                  <span>{t('work.sequences.reply', { pct: pct(s.replyRate) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="grid min-w-0 content-start gap-4">
          <section
            aria-labelledby="h-seq"
            className="overflow-hidden rounded-lg border border-line bg-surface"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
              <h2 id="h-seq" className="t-heading-20">
                {seq.name[locale]}
              </h2>
              <span className="text-label-13 font-normal text-ink-3 tnum">
                {t('work.sequences.enrolled', { n: seq.enrolled })},{' '}
                {t('work.sequences.active', { n: seq.active })}
              </span>
              <span className="ml-auto inline-flex items-center gap-2 text-label-13 text-ink-2">
                <Avatar name={seq.owner} size="sm" />
                {seq.owner}
              </span>
            </header>
            <p className="flex items-start gap-2 border-b border-line bg-canvas px-5 py-2.5 text-label-13 font-normal text-ink-2">
              <Info className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
              {t('work.sequences.noAuto')}
            </p>
            <ol className="relative px-5 py-4">
              {seq.steps.map((s, i) => {
                const Icon = icon[s.channel];
                return (
                  <li
                    key={i}
                    className="relative grid grid-cols-[56px_32px_minmax(0,1fr)] items-start gap-3 pb-5 last:pb-0"
                  >
                    <span className="pt-1.5 text-label-13 text-ink-3 tnum">
                      {t('work.sequences.step', { n: s.day })}
                    </span>
                    <span className="relative z-[1] grid size-8 place-items-center rounded-full border border-line bg-surface">
                      <Icon className="size-4 text-ink-2" strokeWidth={1.75} aria-hidden />
                    </span>
                    {i < seq.steps.length - 1 ? (
                      <span
                        aria-hidden
                        className="absolute left-[83px] top-8 h-[calc(100%-32px)] w-px bg-line"
                      />
                    ) : null}
                    <div className="grid gap-1.5 rounded-md border border-line px-3 py-2.5">
                      <p className="flex flex-wrap items-baseline gap-2 text-label-14 font-semibold">
                        {s.title[locale]}
                        <span className="text-label-12 font-normal text-ink-3">
                          {t(`app.channels.${s.channel}`)}
                        </span>
                      </p>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-label-12 text-ink-3 tnum">
                        <span className="relative block h-2 rounded-[2px] bg-sunken" aria-hidden>
                          <i
                            className="absolute inset-y-0 left-0 rounded-r-[4px] bg-line-strong"
                            style={{ width: `${(s.sent / maxSent) * 100}%` }}
                          />
                          <i
                            className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent"
                            style={{ width: `${(s.replies / maxSent) * 100}%` }}
                          />
                        </span>
                        <span>
                          {t('work.sequences.sent', { n: s.sent })},{' '}
                          {t('work.sequences.replies', { n: s.replies })}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <section
            aria-labelledby="h-due"
            className="overflow-hidden rounded-lg border border-line bg-surface"
          >
            <h2 id="h-due" className="border-b border-line px-5 py-3 text-[14.5px] font-semibold">
              {t('work.sequences.due')}
            </h2>
            <ul className="divide-y divide-line">
              {DEMO_TASKS.filter((x) => x.due === 'today' || x.due === 'overdue').map((task) => {
                const p = getDemoProspect(task.prospect);
                return (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-14">{task.title[locale]}</span>
                      <span className="block truncate text-label-12 font-normal text-ink-3">
                        {p?.person}, {p?.org}
                      </span>
                    </span>
                    <time
                      className={cn(
                        'text-label-12 tnum',
                        task.due === 'overdue' ? 'text-bad' : 'text-ink-3',
                      )}
                    >
                      {task.time[locale]}
                    </time>
                    <Link href="/tasks" className="text-label-13 text-accent-text hover:underline">
                      {t('work.sequences.openTask')}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </PageBody>
    </>
  );
}
