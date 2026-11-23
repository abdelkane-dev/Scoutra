'use client';
import * as React from 'react';
import {
  Copy,
  Mail,
  Phone,
  MessageCircle,
  Globe,
  KanbanSquare,
  ListPlus,
  Workflow,
  MoreHorizontal,
  Ban,
  Trash2,
  Check,
  Link2,
} from 'lucide-react';
import {
  Button,
  CountryCode,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Status,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  cn,
} from '@scoutra/ui';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { demoMessage } from '@/lib/demo/prospects';
import type { DemoProspect } from '@/lib/demo/types';
import { allowedChannels } from '@/lib/channel-rules';
import { usePerm } from './app-provider';

const statusTone = { valid: 'ok', risky: 'warn', invalid: 'bad', none: 'none' } as const;
const chIcon = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  linkedin_manual: Link2,
} as const;

/** Fiche prospect : score expliqué, coordonnées, message rédigé, provenance. */
export function ProspectSheet({
  prospect,
  open,
  onOpenChange,
}: {
  prospect: DemoProspect | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const { can } = usePerm();
  const [copied, setCopied] = React.useState(false);
  const p = prospect;
  const msg = React.useMemo(() => (p ? demoMessage(p, locale) : null), [p, locale]);
  const [body, setBody] = React.useState('');
  React.useEffect(() => {
    if (msg) setBody(msg.body);
    setCopied(false);
  }, [msg]);
  if (!p || !msg) return null;
  const max = Math.max(...p.reasons.map((r) => r.pts));
  const allowed = allowedChannels(p.cc, p.kind);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t('app.common.close')} aria-describedby={undefined}>
        <SheetHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="truncate">{p.person}</SheetTitle>
              <SheetDescription>
                {p.role[locale]}, {p.org}, {p.city[locale]}{' '}
                <CountryCode code={p.cc} title={fmt.country(p.cc)} />
              </SheetDescription>
            </div>
            <p className="shrink-0 text-[32px] font-semibold leading-8 tracking-[-0.03em] [font-stretch:110%] tnum">
              {p.score}
              <small className="ml-0.5 text-[13px] font-medium tracking-normal text-ink-3">
                /100
              </small>
            </p>
          </div>
        </SheetHeader>
        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="px-5">
            <TabsTrigger value="overview">{t('app.prospect.whyScore', { n: p.score })}</TabsTrigger>
            <TabsTrigger value="message">{t('app.prospect.message')}</TabsTrigger>
            <TabsTrigger value="provenance">{t('app.prospect.provenance')}</TabsTrigger>
          </TabsList>
          <SheetBody>
            <TabsContent value="overview" className="grid gap-6">
              <figure>
                <figcaption className="mb-3 text-label-13 font-normal text-ink-3">
                  {t('app.prospect.scoreExplained')}
                </figcaption>
                <ul className="grid gap-2.5">
                  {p.reasons.map((r) => (
                    <li
                      key={r.label.fr}
                      className="grid grid-cols-[minmax(0,1fr)_72px_40px] sm:grid-cols-[minmax(0,1fr)_96px_40px] items-center gap-3 text-[13px]"
                      title={`+${r.pts}`}
                    >
                      <span className="text-ink-2">{r.label[locale]}</span>
                      <span className="relative h-2.5 rounded-[2px] bg-sunken" aria-hidden>
                        <i
                          className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent"
                          style={{ width: `${(r.pts / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-semibold tnum">+{r.pts}</span>
                    </li>
                  ))}
                </ul>
              </figure>
              <section aria-labelledby="h-contact" className="grid gap-2">
                <h3 id="h-contact" className="t-heading-16">
                  {t('app.prospect.contact')}
                </h3>
                <dl className="grid divide-y divide-line rounded-md border border-line text-copy-14">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Mail className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
                    <dt className="sr-only">Email</dt>
                    <dd className="min-w-0 flex-1 truncate">
                      {p.email || t('app.prospect.noEmail')}
                    </dd>
                    <Status tone={statusTone[p.emailStatus]}>
                      {t(`app.emailStatus.${p.emailStatus}`)}
                    </Status>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Phone className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
                    <dt className="sr-only">{t('app.channels.phone')}</dt>
                    <dd className="flex-1 tnum">{p.phone ?? '—'}</dd>
                    {p.whatsapp ? <span className="text-label-12 text-ink-3">WhatsApp</span> : null}
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Globe className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
                    <dt className="sr-only">{t('app.prospect.website')}</dt>
                    <dd className="min-w-0 flex-1 truncate">{p.website.replace('https://', '')}</dd>
                    <span className="text-label-12 text-ink-3">
                      {t('app.prospect.employees', { n: p.employees })}
                    </span>
                  </div>
                </dl>
              </section>
              <section aria-labelledby="h-allowed" className="grid gap-2">
                <h3 id="h-allowed" className="t-heading-16">
                  {t('app.prospect.channelsAllowed')}
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {(['email', 'phone', 'whatsapp', 'linkedin_manual'] as const).map((c) => {
                    const ok = allowed.includes(c);
                    const Icon = chIcon[c];
                    return (
                      <li
                        key={c}
                        className={cn(
                          'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-label-12',
                          ok
                            ? 'border-line text-ink'
                            : 'border-dashed border-line text-ink-3 line-through',
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                        {t(`app.channels.${c}`)}
                        <span className="sr-only">
                          {ok ? t('app.common.yes') : t('app.common.no')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {p.nextStep ? (
                <section className="grid gap-1 rounded-md bg-canvas px-3 py-2.5">
                  <p className="text-label-12 text-ink-3">{t('app.prospect.nextStep')}</p>
                  <p className="text-label-14">{p.nextStep[locale]}</p>
                  <p className="text-label-12 font-normal text-ink-3">
                    {p.lastActivity[locale]}, {p.owner}
                  </p>
                </section>
              ) : null}
            </TabsContent>
            <TabsContent value="message" className="grid gap-3">
              <p className="text-label-13 font-normal text-ink-3">
                {t('app.prospect.messageNote')}
              </p>
              <p className="text-label-14 font-semibold">{msg.subject}</p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={11}
                aria-label={t('app.prospect.message')}
                className="text-copy-14"
              />
              <div>
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${msg.subject}\n\n${body}`);
                    setCopied(true);
                    toast(t('app.prospect.messageCopied'));
                  }}
                >
                  {copied ? (
                    <Check aria-hidden strokeWidth={1.75} />
                  ) : (
                    <Copy aria-hidden strokeWidth={1.75} />
                  )}
                  {t('app.prospect.copyMessage')}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="provenance" className="grid gap-3 text-copy-14">
              <ul className="grid divide-y divide-line rounded-md border border-line">
                {[
                  `${t('app.common.source')} : ${p.source}`,
                  t('app.prospect.collected', { date: p.collectedAt }),
                  t('app.prospect.basis', { basis: t(`app.legal.${p.legalBasis}`) }),
                  `${t('app.common.countries')} : ${fmt.country(p.cc)}`,
                ].map((v) => (
                  <li key={v} className="px-3 py-2.5">
                    {v}
                  </li>
                ))}
              </ul>
            </TabsContent>
          </SheetBody>
        </Tabs>
        <SheetFooter>
          {can('pipeline:write') ? (
            <Button variant="primary" onClick={() => toast(t('app.prospect.addedToPipeline'))}>
              <KanbanSquare aria-hidden strokeWidth={1.75} />
              {t('app.prospect.addToPipeline')}
            </Button>
          ) : null}
          {can('sequence:enroll') ? (
            <Button onClick={() => toast(t('app.prospect.enrolled'))}>
              <Workflow aria-hidden strokeWidth={1.75} />
              <span className="max-sm:sr-only">{t('app.prospect.enroll')}</span>
            </Button>
          ) : null}
          <span className="flex-1" />
          {can('prospect:write') ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('app.common.more')}>
                  <MoreHorizontal aria-hidden strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => toast(t('app.prospect.addedToList'))}>
                  <ListPlus strokeWidth={1.75} aria-hidden />
                  {t('app.prospect.addToList')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => toast(t('app.prospect.optedOut'))}>
                  <Ban strokeWidth={1.75} aria-hidden />
                  {t('app.prospect.optOut')}
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => toast(t('app.prospect.erased'))}>
                  <Trash2 strokeWidth={1.75} aria-hidden />
                  {t('app.prospect.erase')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
