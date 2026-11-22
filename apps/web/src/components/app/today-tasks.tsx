'use client';
import * as React from 'react';
import Link from 'next/link';
import { Checkbox, cn, toast } from '@scoutra/ui';
import { useLocale, useT } from '@/lib/i18n/client';
import { DEMO_TASKS } from '@/lib/demo/workspace';
import { getDemoProspect } from '@/lib/demo/prospects';

/** Liste « Relances du jour » cochable (démonstration ; besoin d'API : PATCH /api/tasks/:id). */
export function TodayTasks({ canWrite }: { canWrite: boolean }) {
  const t = useT();
  const locale = useLocale();
  const tasks = DEMO_TASKS.filter((x) => x.due === 'today' || x.due === 'overdue');
  const [done, setDone] = React.useState<string[]>(tasks.filter((x) => x.done).map((x) => x.id));
  return (
    <>
      <p className="px-4 pb-1 pt-3 text-label-12 text-ink-3">{t('home.todayCount', { done: done.length, total: tasks.length })}</p>
      <ul className="divide-y divide-line">
        {tasks.map((task) => {
          const p = getDemoProspect(task.prospect);
          const isDone = done.includes(task.id);
          return (
            <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
              <Checkbox
                className="mt-[3px]"
                checked={isDone}
                disabled={!canWrite}
                aria-label={`${t('home.markDone')} : ${task.title[locale]}`}
                onCheckedChange={(v) => {
                  setDone((d) => (v === true ? [...d, task.id] : d.filter((x) => x !== task.id)));
                  if (v === true) toast(t('home.taskDone'));
                }}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-label-14', isDone && 'text-ink-3 line-through')}>{task.title[locale]}</p>
                <Link href={`/prospects?open=${task.prospect}`} className="block truncate text-label-12 font-normal text-ink-3 hover:text-ink">
                  {p?.person}, {p?.org}
                </Link>
              </div>
              <time className={cn('shrink-0 text-label-12 tnum', task.due === 'overdue' ? 'text-bad' : 'text-ink-3')}>{task.time[locale]}</time>
            </li>
          );
        })}
      </ul>
    </>
  );
}
