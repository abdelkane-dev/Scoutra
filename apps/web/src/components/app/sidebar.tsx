'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronsUpDown,
  Check,
  Lock,
  Plus,
  Search,
  LogOut,
  User,
  ShieldCheck,
  Languages,
  Keyboard,
  TerminalSquare,
} from 'lucide-react';
import {
  Avatar,
  Kbd,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@scoutra/ui';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { authClient } from '@/lib/auth-client';
import { setLocaleCookie } from '@/lib/locale-cookie';
import { DEMO_CREDITS } from '@/lib/demo/workspace';
import { useCredits } from '@/lib/use-credits';
import { HELP, PRIMARY, SECTIONS, type NavItem } from './nav-config';
import { useApp, usePerm } from './app-provider';

const STORAGE = 'scoutra.sidebar.collapsed';

function isActive(pathname: string, href: string) {
  if (href === '/search') return pathname === '/search';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const { needs2fa, can } = usePerm();
  const active = isActive(pathname, item.href);
  const locked = item.perm && !item.perm.some(can) && item.perm.some(needs2fa);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-8 shrink-0 items-center gap-2.5 rounded-sm px-2 text-label-14 text-ink-2 transition-colors hover:bg-hover hover:text-ink max-lg:h-10',
        active && 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:bg-surface',
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0',
          active ? 'text-accent-text' : 'text-ink-3 group-hover:text-ink-2',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{t(item.label)}</span>
      <span className="ml-auto flex items-center gap-1">
        {locked ? (
          <Lock
            className="size-3.5 text-ink-3"
            strokeWidth={1.75}
            aria-label={t('app.common.needs2fa')}
          />
        ) : null}
        {item.count ? <span className="text-label-12 text-ink-3 tnum">{item.count}</span> : null}
        {item.key && !item.count ? (
          <span
            className="hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 lg:flex"
            aria-hidden
          >
            <Kbd>G</Kbd>
            <Kbd>{item.key === ',' ? ',' : item.key.toUpperCase()}</Kbd>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function Sidebar({
  onOpenPalette,
  onShowShortcuts,
  onNavigate,
}: {
  onOpenPalette: () => void;
  onShowShortcuts: () => void;
  onNavigate?: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormat();
  const router = useRouter();
  const app = useApp();
  const { visible } = usePerm();
  const [collapsed, setCollapsed] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE);
      if (raw) setCollapsed(JSON.parse(raw) as string[]);
    } catch {
      /* préférence illisible : on garde tout déplié */
    }
  }, []);
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      window.localStorage.setItem(STORAGE, JSON.stringify(next));
      return next;
    });

  // Solde réel (GET /api/credits) si disponible, sinon démonstration.
  const real = useCredits(app.mode === 'saas');
  const demoTotal = DEMO_CREDITS.granted + DEMO_CREDITS.rollover + DEMO_CREDITS.packs;
  const left = real?.balance ?? demoTotal - DEMO_CREDITS.used;
  const total =
    real?.balance !== undefined
      ? Math.max(real.plan?.monthlyCredits ?? 0, real.balance, 1)
      : demoTotal;
  const used = Math.max(0, total - left);
  const initials = app.org.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full flex-col gap-1 px-2.5 pb-3 pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="mb-1 flex w-full items-center gap-2.5 rounded-sm border border-line bg-surface px-2 py-1.5 text-left hover:border-line-strong"
          aria-label={t('app.shell.orgMenu')}
        >
          <span className="grid size-[22px] shrink-0 place-items-center rounded-[5px] bg-ink text-[11px] font-bold text-white">
            {initials || 'S'}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px] font-semibold leading-[18px]">
              {app.org.name}
            </b>
            <small className="block truncate text-label-12 font-normal text-ink-3">
              {t(`app.roles.${app.org.role}`)}
            </small>
          </span>
          <ChevronsUpDown className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel>{t('app.shell.orgs')}</DropdownMenuLabel>
          {app.orgs.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onSelect={async () => {
                if (o.id === app.org.id) return;
                await authClient.organization.setActive({ organizationId: o.id });
                router.refresh();
              }}
            >
              <span className="truncate">{o.name}</span>
              {o.id === app.org.id ? (
                <Check className="ml-auto text-accent-text!" strokeWidth={1.75} aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Lock strokeWidth={1.75} aria-hidden />
            <span className="text-label-13">
              {t('app.shell.country', { country: fmt.country(app.org.countryCode) })}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/onboarding?new=1')}>
            <Plus strokeWidth={1.75} aria-hidden />
            {t('app.shell.createOrg')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={onOpenPalette}
        className="mb-2 flex h-8 items-center gap-2 rounded-sm border border-line bg-surface px-2 text-left text-label-13 font-normal text-ink-3 hover:border-line-strong max-lg:h-10"
      >
        <Search className="size-4" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 truncate whitespace-nowrap">
          {t('app.shell.searchPlaceholder')}
        </span>
        <Kbd aria-hidden>⌘K</Kbd>
      </button>

      <nav
        aria-label={t('app.nav.main')}
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1"
      >
        {PRIMARY.filter((i) => visible(i.perm)).map((i) => (
          <NavLink key={i.id} item={i} onNavigate={onNavigate} />
        ))}
        {SECTIONS.map((s) => {
          const items = s.items.filter((i) => visible(i.perm));
          if (!items.length) return null;
          const open = !collapsed.includes(s.id);
          const label = t(s.label);
          return (
            <div key={s.id} className="mt-3">
              <button
                type="button"
                aria-expanded={open}
                aria-label={
                  open
                    ? t('app.nav.collapse', { section: label })
                    : t('app.nav.expand', { section: label })
                }
                onClick={() => toggle(s.id)}
                className="group flex h-6 w-full items-center gap-1 rounded-sm px-2 text-label-12 text-ink-3 hover:text-ink-2"
              >
                {label}
                <ChevronDown
                  className={cn(
                    'size-3 transition-transform duration-[120ms]',
                    !open && '-rotate-90',
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="mt-0.5 grid gap-0.5">
                  {items.map((i) => (
                    <NavLink key={i.id} item={i} onNavigate={onNavigate} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="mt-3 grid gap-0.5">
          {HELP.map((i) => (
            <NavLink key={i.id} item={i} onNavigate={onNavigate} />
          ))}
          {/* Emplacement réservé : console opérateur (super-admin plateforme, mode SaaS), non implémentée. */}
          {app.user.platformOperator && app.mode === 'saas' ? (
            <span
              className="flex h-8 items-center gap-2.5 px-2 text-label-14 text-ink-3"
              aria-disabled="true"
            >
              <TerminalSquare className="size-4" strokeWidth={1.75} aria-hidden />
              {t('app.nav.operator')}
              <span className="ml-auto text-label-12">{t('app.nav.operatorSoon')}</span>
            </span>
          ) : null}
        </div>
      </nav>

      <div className="mt-2 grid gap-3 border-t border-line px-1.5 pt-3">
        <Link
          href="/settings/billing"
          onClick={onNavigate}
          className="group grid gap-1.5 rounded-sm"
          title={t('app.shell.creditsLink')}
        >
          <span className="flex justify-between text-[12.5px] text-ink-2">
            <span>{t('app.shell.credits')}</span>
            <b className="font-semibold text-ink tnum">
              {t('app.shell.creditsLeft', { n: fmt.n(left) })}
            </b>
          </span>
          <span className="block h-1 overflow-hidden rounded-[2px] bg-sunken" aria-hidden>
            <span
              className="block h-full origin-left rounded-[2px] bg-ink"
              style={{ transform: `scaleX(${used / total})` }}
            />
          </span>
          <span className="text-label-12 font-normal text-ink-3 tnum">
            {t('app.shell.creditsOf', { used: fmt.n(used), total: fmt.n(total) })}
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2.5 rounded-sm text-left hover:bg-hover max-lg:min-h-11"
            aria-label={t('app.shell.userMenu')}
          >
            <Avatar name={app.user.name} />
            <span className="min-w-0 flex-1 text-[13px] leading-[18px]">
              <b className="block truncate font-medium">{app.user.name}</b>
              <small className="block truncate text-label-12 font-normal text-ink-3">
                {app.user.email}
              </small>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-60">
            <DropdownMenuItem onSelect={() => router.push('/settings/profile')}>
              <User strokeWidth={1.75} aria-hidden />
              {t('app.shell.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push('/settings/security')}>
              <ShieldCheck strokeWidth={1.75} aria-hidden />
              {t('app.shell.security')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setLocaleCookie(locale === 'fr' ? 'en' : 'fr');
                router.refresh();
              }}
            >
              <Languages strokeWidth={1.75} aria-hidden />
              {t('app.shell.switchLanguage')}
              <DropdownMenuShortcut>{locale === 'fr' ? 'EN' : 'FR'}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShowShortcuts}>
              <Keyboard strokeWidth={1.75} aria-hidden />
              {t('app.shell.shortcuts')}
              <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                router.replace('/login');
                router.refresh();
              }}
            >
              <LogOut strokeWidth={1.75} aria-hidden />
              {t('app.shell.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
