'use client';
import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { LayoutGroup, motion } from 'motion/react';
import { Avatar, CountryCode, Score, Segmented, cn, toast } from '@scoutra/ui';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { DEMO_PROSPECTS } from '@/lib/demo/prospects';
import type { DemoProspect, Stage } from '@/lib/demo/types';
import { ProspectSheet } from './prospect-sheet';
import { useApp, usePerm } from './app-provider';

const STAGES: Stage[] = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'];

function Card({
  p,
  onOpen,
  onMove,
  canMove,
  overlay,
}: {
  p: DemoProspect;
  onOpen?: () => void;
  onMove?: (dir: -1 | 1) => void;
  canMove: boolean;
  overlay?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: p.id,
    disabled: !canMove || overlay,
  });
  const due =
    p.dueInDays === null
      ? null
      : p.dueInDays < 0
        ? t('work.pipeline.dueLate')
        : p.dueInDays === 0
          ? t('work.pipeline.dueToday')
          : t('work.pipeline.dueIn', { n: p.dueInDays });
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      role="button"
      tabIndex={0}
      aria-roledescription={undefined}
      aria-label={t('work.pipeline.cardLabel', {
        name: p.person,
        org: p.org,
        score: p.score,
        stage: t(`app.stages.${p.stage}`),
      })}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.();
        if (canMove && e.key === 'ArrowRight') {
          e.preventDefault();
          onMove?.(1);
        }
        if (canMove && e.key === 'ArrowLeft') {
          e.preventDefault();
          onMove?.(-1);
        }
      }}
      className={cn(
        'grid cursor-grab gap-2 rounded-md border border-line bg-surface p-3 text-left outline-none transition-[border-color] hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent-text active:cursor-grabbing',
        isDragging && 'opacity-40',
        overlay && 'rotate-[1.5deg] shadow-drag',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-label-14 font-semibold">{p.org}</p>
          <p className="truncate text-label-12 font-normal text-ink-3">
            {p.person}, {p.city[locale]}
          </p>
        </div>
        <CountryCode code={p.cc} />
      </div>
      <div className="flex items-center justify-between gap-2 text-label-12">
        <Score value={p.score} className="text-label-13" />
        <span className="font-semibold tnum">{p.valueUsd ? fmt.money(p.valueUsd) : '—'}</span>
      </div>
      {p.nextStep ? (
        <div className="flex items-center gap-2 border-t border-line pt-2 text-label-12 font-normal">
          <Avatar name={p.owner} size="sm" />
          <span className="min-w-0 flex-1 truncate text-ink-2">{p.nextStep[locale]}</span>
          {due ? (
            <span className={cn('shrink-0 tnum', p.dueInDays! < 0 ? 'text-bad' : 'text-ink-3')}>
              {due}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Column({
  stage,
  items,
  children,
  total,
}: {
  stage: Stage;
  items: number;
  total: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      aria-label={t(`app.stages.${stage}`)}
      className="flex w-[280px] shrink-0 flex-col rounded-lg bg-sunken/70"
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <i
          className={cn(
            'size-2 rounded-full',
            stage === 'won' ? 'bg-accent' : stage === 'lost' ? 'bg-line-strong' : 'bg-ink-3',
          )}
          aria-hidden
        />
        <h2 className="t-heading-16 text-[14px]">{t(`app.stages.${stage}`)}</h2>
        <span className="text-label-12 text-ink-3 tnum">{items}</span>
        <span className="ml-auto text-label-12 text-ink-2 tnum">{total}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'grid min-h-24 flex-1 content-start gap-2 rounded-b-lg px-2 pb-2 transition-colors',
          isOver && 'bg-accent-soft',
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function PipelineBoard() {
  const t = useT();
  const fmt = useFormat();
  const { org } = useApp();
  const { can } = usePerm();
  const canMove = can('pipeline:write');
  const [items, setItems] = React.useState<DemoProspect[]>(() =>
    org.dataScope === 'own'
      ? DEMO_PROSPECTS.filter((p) => p.owner === 'Sofia Rossi')
      : DEMO_PROSPECTS,
  );
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [owner, setOwner] = React.useState<'all' | 'mine'>('all');
  const [open, setOpen] = React.useState<DemoProspect | null>(null);
  const [live, setLive] = React.useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const move = (id: string, stage: Stage) => {
    setItems((list) => list.map((p) => (p.id === id ? { ...p, stage } : p)));
    const p = items.find((x) => x.id === id);
    if (p && p.stage !== stage) {
      const msg = t('work.pipeline.moved', { name: p.org, stage: t(`app.stages.${stage}`) });
      setLive(msg);
      toast(msg);
    }
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (e.over) move(String(e.active.id), e.over.id as Stage);
  };
  const shown =
    owner === 'mine'
      ? items.filter((p) => p.owner === 'Léa Martin' || p.owner === 'Sofia Rossi')
      : items;
  const dragging = items.find((p) => p.id === dragId) ?? null;

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'all' | 'mine'>
          label={t('work.pipeline.filterOwner')}
          value={owner}
          onChange={setOwner}
          options={[
            { value: 'all', label: t('work.pipeline.everyone') },
            { value: 'mine', label: t('work.base.viewMine') },
          ]}
        />
        <p className="text-label-12 font-normal text-ink-3">{t('work.pipeline.moveHint')}</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <LayoutGroup>
          <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-3 sm:-mx-6 sm:px-6">
            {STAGES.map((s) => {
              const col = shown.filter((p) => p.stage === s).sort((a, b) => b.score - a.score);
              return (
                <Column
                  key={s}
                  stage={s}
                  items={col.length}
                  total={fmt.money(col.reduce((a, p) => a + p.valueUsd, 0))}
                >
                  {col.length === 0 ? (
                    <p className="px-1 py-3 text-label-12 font-normal text-ink-3">
                      {t('work.pipeline.empty')}
                    </p>
                  ) : null}
                  {col.map((p) => (
                    <motion.div
                      key={p.id}
                      layout="position"
                      layoutId={p.id}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    >
                      <Card
                        p={p}
                        canMove={canMove}
                        onOpen={() => setOpen(p)}
                        onMove={(dir) => {
                          const next = STAGES[STAGES.indexOf(p.stage) + dir];
                          if (next) move(p.id, next);
                        }}
                      />
                    </motion.div>
                  ))}
                </Column>
              );
            })}
          </div>
        </LayoutGroup>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' }}>
          {dragging ? <Card p={dragging} canMove overlay /> : null}
        </DragOverlay>
      </DndContext>
      <ProspectSheet prospect={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
