'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, Plus, ListChecks, UserPlus, Languages, Keyboard, ShieldAlert, Eye } from 'lucide-react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Kbd, Sheet, SheetContent, SheetTitle,
  Toaster, TooltipProvider, Button,
} from '@scoutra/ui';
import { MotionConfig } from 'motion/react';
import type { MessageKey } from '@scoutra/i18n';
import { useLocale, useT } from '@/lib/i18n/client';
import { setLocaleCookie } from '@/lib/locale-cookie';
import { DEMO_PROSPECTS } from '@/lib/demo/prospects';
import { Logo } from '@/components/brand/logo';
import { ALL_ITEMS } from './nav-config';
import { Sidebar } from './sidebar';
import { useApp, usePerm } from './app-provider';

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

const TWO_FA_LABELS: Partial<Record<string, MessageKey>> = {
  'prospect:export': 'app.nav.exports',
  'apikey:manage': 'app.nav.integrations',
  'member:invite': 'app.shell.inviteMember',
  'billing:manage': 'app.nav.settings',
  'compliance:manage': 'app.nav.compliance',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const app = useApp();
  const { visible } = usePerm();
  const [palette, setPalette] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);
  const items = ALL_ITEMS.filter((i) => visible(i.perm));

  // Raccourcis : ⌘K / Ctrl+K, « ? », et « G puis lettre » (façon Linear).
  React.useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        setHelp(true);
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        g = Date.now();
        return;
      }
      if (Date.now() - g < 1200) {
        const target = items.find((i) => i.key === e.key.toLowerCase());
        g = 0;
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, router]);

  const go = (href: string) => {
    setPalette(false);
    router.push(href);
  };
  const blocked = app.org.needsTwoFactor
    .map((a) => TWO_FA_LABELS[a])
    .filter((k, i, arr): k is MessageKey => !!k && arr.indexOf(k) === i)
    .map((k) => t(k).toLowerCase());

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <a className="skip-link" href="#contenu">
          {t('app.shell.skip')}
        </a>
        <div className="grid min-h-dvh bg-canvas text-copy-14 lg:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="sticky top-0 hidden h-dvh border-r border-line bg-canvas lg:block">
            <Sidebar onOpenPalette={() => setPalette(true)} onShowShortcuts={() => setHelp(true)} />
          </aside>
          <div className="flex min-w-0 flex-col">
            {/* Barre mobile */}
            <div className="sticky top-0 z-30 flex h-[52px] items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
              <Sheet open={mobileNav} onOpenChange={setMobileNav}>
                <Button variant="ghost" size="icon" aria-label={t('app.nav.openMenu')} onClick={() => setMobileNav(true)}>
                  <Menu strokeWidth={1.75} aria-hidden />
                </Button>
                <SheetContent side="left" closeLabel={t('app.common.close')} className="bg-canvas p-0" hideClose>
                  <SheetTitle className="sr-only">{t('app.nav.main')}</SheetTitle>
                  <Sidebar
                    onNavigate={() => setMobileNav(false)}
                    onOpenPalette={() => {
                      setMobileNav(false);
                      setPalette(true);
                    }}
                    onShowShortcuts={() => setHelp(true)}
                  />
                </SheetContent>
              </Sheet>
              <Link href="/home" aria-label={t('app.nav.home')}>
                <Logo className="h-[22px]" />
              </Link>
              <span className="flex-1" />
              <Button variant="ghost" size="icon" aria-label={t('app.shell.openPalette')} onClick={() => setPalette(true)}>
                <Search strokeWidth={1.75} aria-hidden />
              </Button>
            </div>
            {app.rolePreview ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-ink px-4 py-1.5 text-label-13 text-white sm:px-6">
                <Eye className="size-4" strokeWidth={1.75} aria-hidden />
                {t('app.shell.rolePreview', { role: t(`app.roles.${app.org.role}`) })}
                <button
                  type="button"
                  className="ml-auto underline underline-offset-2"
                  onClick={() => {
                    document.cookie = 'scoutra_ui_role=; Path=/; Max-Age=0';
                    router.refresh();
                  }}
                >
                  {t('app.shell.rolePreviewReset')}
                </button>
              </div>
            ) : null}
            {blocked.length ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warn/25 bg-warn-soft px-4 py-2 text-label-13 text-warn sm:px-6">
                <ShieldAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">{t('app.shell.twoFactorBanner', { actions: blocked.join(', ') })}</span>
                <Link href="/two-factor/setup?next=/home" className="font-semibold underline underline-offset-2">
                  {t('app.shell.twoFactorCta')}
                </Link>
              </div>
            ) : null}
            <main id="contenu" className="min-w-0 flex-1">
              {children}
            </main>
          </div>
        </div>

        <CommandDialog open={palette} onOpenChange={setPalette} title={t('app.shell.commandTitle')}>
          <CommandInput placeholder={t('app.shell.searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('app.shell.commandEmpty')}</CommandEmpty>
            <CommandGroup heading={t('app.shell.actions')}>
              {visible(['campaign:write']) ? (
                <CommandItem onSelect={() => go('/search')}>
                  <Plus aria-hidden strokeWidth={1.75} />
                  {t('app.shell.newSearch')}
                </CommandItem>
              ) : null}
              {visible(['task:write']) ? (
                <CommandItem onSelect={() => go('/tasks?new=1')}>
                  <ListChecks aria-hidden strokeWidth={1.75} />
                  {t('app.shell.newTask')}
                </CommandItem>
              ) : null}
              {visible(['member:invite']) ? (
                <CommandItem onSelect={() => go('/team?invite=1')}>
                  <UserPlus aria-hidden strokeWidth={1.75} />
                  {t('app.shell.inviteMember')}
                </CommandItem>
              ) : null}
              <CommandItem
                onSelect={() => {
                  setPalette(false);
                  setLocaleCookie(locale === 'fr' ? 'en' : 'fr');
                  router.refresh();
                }}
              >
                <Languages aria-hidden strokeWidth={1.75} />
                {t('app.shell.switchLanguage')}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setPalette(false);
                  setHelp(true);
                }}
              >
                <Keyboard aria-hidden strokeWidth={1.75} />
                {t('app.shell.shortcuts')}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={t('app.shell.goTo')}>
              {items.map((i) => {
                const Icon = i.icon;
                return (
                  <CommandItem key={i.id} value={`${t(i.label)} ${i.id}`} onSelect={() => go(i.href)}>
                    <Icon aria-hidden strokeWidth={1.75} />
                    {t(i.label)}
                    {i.key ? (
                      <span className="ml-auto flex gap-0.5" aria-hidden>
                        <Kbd>G</Kbd>
                        <Kbd>{i.key.toUpperCase()}</Kbd>
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {visible(['prospect:read']) ? (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('app.shell.recentProspects')}>
                  {DEMO_PROSPECTS.slice(0, 8).map((p) => (
                    <CommandItem key={p.id} value={`${p.person} ${p.org}`} onSelect={() => go(`/prospects?open=${p.id}`)}>
                      <span className="font-medium text-ink">{p.person}</span>
                      <span className="truncate text-ink-3">{p.org}</span>
                      <span className="ml-auto text-label-12 text-ink-3 tnum">{p.score}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </CommandDialog>

        <Dialog open={help} onOpenChange={setHelp}>
          <DialogContent closeLabel={t('app.common.close')}>
            <DialogHeader>
              <DialogTitle>{t('app.shell.shortcutsTitle')}</DialogTitle>
              <DialogDescription>{t('app.shell.shortcutsLede')}</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line text-copy-14">
              {[
                [t('app.shell.openPalette'), ['⌘', 'K']],
                [t('app.shell.showShortcuts'), ['?']],
                ...items.filter((i) => i.key).map((i) => [t(i.label), ['G', i.key!.toUpperCase()]] as const),
              ].map(([label, keys]) => (
                <div key={label as string} className="flex items-center justify-between bg-surface px-3 py-2">
                  <dt>{label as string}</dt>
                  <dd className="flex items-center gap-1">
                    {(keys as readonly string[]).map((k, idx) => (
                      <React.Fragment key={k + idx}>
                        {idx > 0 && keys[0] === 'G' ? <span className="text-label-12 text-ink-3">{t('app.shell.then')}</span> : null}
                        <Kbd className="h-5 min-w-5 text-[12px]">{k}</Kbd>
                      </React.Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        </Dialog>
        <Toaster closeLabel={t('app.common.close')} />
      </TooltipProvider>
    </MotionConfig>
  );
}
