'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  UserPlus,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Download,
  KeyRound,
  Copy,
  Trash2,
  Lock,
  CircleCheck,
  CircleAlert,
  Circle,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  CountryCode,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Label,
  Panel,
  PanelHeader,
  PanelTitle,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonRows,
  Status,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  toast,
} from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useFormat, useLocale, useT } from '@/lib/i18n/client';
import { authClient, authErrorCode } from '@/lib/auth-client';
import { DEMO_MEMBERS } from '@/lib/demo/team';
import {
  DEMO_API_KEYS,
  DEMO_AUDIT,
  DEMO_ERASURE,
  DEMO_EXPORTS,
  DEMO_INTEGRATIONS,
  DEMO_SUPPRESSIONS,
} from '@/lib/demo/workspace';
import { useApp, usePerm } from './app-provider';
import { DataTable, type Column } from './data-table';

const ROLES = ['owner', 'admin', 'manager', 'member', 'viewer', 'billing'] as const;
type Role = (typeof ROLES)[number];
function assignable(actor: Role): Role[] {
  if (actor === 'owner') return [...ROLES];
  if (actor === 'admin') return ['manager', 'member', 'viewer', 'billing'];
  return [];
}

/** Erreur d'action sensible : renvoie vers l'activation de la 2FA si nécessaire. */
function useActionError() {
  const t = useT();
  const router = useRouter();
  return (err: { code?: string; message?: string; status?: number } | null | undefined) => {
    const code = authErrorCode(err);
    if (code === 'two_factor_required') {
      toast(t('auth.errors.two_factor_required'), {
        action: {
          label: t('app.shell.twoFactorCta'),
          onClick: () => router.push('/two-factor/setup?next=/team'),
        },
      });
      return;
    }
    const key = `auth.errors.${code}` as MessageKey;
    toast(t(key) === key ? t('auth.errors.unknown') : t(key));
  };
}

/* ---------------- Équipe (membres et invitations réels) ---------------- */
type Member = {
  id: string;
  role: string;
  createdAt?: string | Date;
  user: { id: string; name: string; email: string };
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
};

export function TeamView() {
  const t = useT();
  const fmt = useFormat();
  const params = useSearchParams();
  const app = useApp();
  const { can, needs2fa } = usePerm();
  const onError = useActionError();
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [invites, setInvites] = React.useState<Invitation[]>([]);
  const [inviteOpen, setInviteOpen] = React.useState(params.get('invite') === '1');
  const [role, setRole] = React.useState<Role>('member');
  const canInvite = can('member:invite') || needs2fa('member:invite');
  const actor = app.org.role as Role;

  const load = React.useCallback(async () => {
    const { data } = await authClient.organization.getFullOrganization();
    const d = data as unknown as { members?: Member[]; invitations?: Invitation[] } | null;
    setMembers(d?.members ?? []);
    setInvites((d?.invitations ?? []).filter((i) => i.status === 'pending'));
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const date = (d: string | Date) =>
    new Date(d).toLocaleDateString(fmt.tag, { day: 'numeric', month: 'short' });
  const demoStats = (email: string) => DEMO_MEMBERS.find((m) => m.email === email);

  return (
    <Tabs defaultValue="members" className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <TabsList className="border-0">
          <TabsTrigger value="members">
            {t('insight.team.tabMembers')}{' '}
            <span className="text-label-12 text-ink-3 tnum">{members?.length ?? ''}</span>
          </TabsTrigger>
          <TabsTrigger value="invites">
            {t('insight.team.tabInvites')}{' '}
            <span className="text-label-12 text-ink-3 tnum">{invites.length}</span>
          </TabsTrigger>
          <TabsTrigger value="goals">{t('insight.team.tabGoals')}</TabsTrigger>
          <TabsTrigger value="roles">{t('insight.team.tabRoles')}</TabsTrigger>
        </TabsList>
        <span className="flex-1" />
        {canInvite ? (
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden strokeWidth={1.75} />
            {t('insight.team.invite')}
            {needs2fa('member:invite') ? (
              <Lock
                className="opacity-70"
                aria-label={t('app.common.needs2fa')}
                strokeWidth={1.75}
              />
            ) : null}
          </Button>
        ) : null}
      </div>
      <TabsContent value="members" className="grid gap-2">
        <Panel className="overflow-hidden">
          {members === null ? (
            <SkeletonRows rows={4} />
          ) : (
            <table className="w-full text-copy-14">
              <caption className="sr-only">{t('insight.team.tabMembers')}</caption>
              <thead className="bg-sunken text-left text-label-13 text-ink-3">
                <tr className="h-9">
                  <th scope="col" className="pl-4 font-medium">
                    {t('insight.team.colMember')}
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    {t('insight.team.colRole')}
                  </th>
                  <th scope="col" className="px-3 font-medium max-sm:hidden">
                    {t('insight.team.colProspects')}
                  </th>
                  <th scope="col" className="w-12 pr-4">
                    <span className="sr-only">{t('app.common.more')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const self = m.user.id === app.user.id;
                  const manageable =
                    !self &&
                    assignable(actor).includes(m.role as Role) &&
                    (actor === 'owner' || m.role !== 'owner');
                  return (
                    <tr key={m.id} className="h-14 border-t border-line">
                      <th scope="row" className="pl-4 text-left font-normal">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={m.user.name} />
                          <span className="min-w-0">
                            <b className="block truncate font-semibold">
                              {m.user.name}
                              {self ? (
                                <span className="ml-1.5 font-normal text-ink-3">
                                  ({t('insight.team.you')})
                                </span>
                              ) : null}
                            </b>
                            <span className="block truncate text-label-12 font-normal text-ink-3">
                              {m.user.email}
                            </span>
                          </span>
                        </span>
                      </th>
                      <td className="px-3">
                        <Badge tone={m.role === 'owner' ? 'ink' : 'neutral'}>
                          {t(`app.roles.${m.role as Role}`)}
                        </Badge>
                      </td>
                      <td className="px-3 text-ink-2 tnum max-sm:hidden">
                        {demoStats(m.user.email)?.prospectsMonth ?? '—'}
                      </td>
                      <td className="pr-4 text-right">
                        {manageable &&
                        (can('member:change_role') ||
                          can('member:remove') ||
                          needs2fa('member:remove')) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`${t('app.common.more')} : ${m.user.name}`}
                              >
                                <MoreHorizontal aria-hidden strokeWidth={1.75} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t('insight.team.changeRole')}</DropdownMenuLabel>
                              {assignable(actor).map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  disabled={r === m.role}
                                  onSelect={async () => {
                                    const { error } =
                                      await authClient.organization.updateMemberRole({
                                        memberId: m.id,
                                        role: r,
                                      });
                                    if (error) return onError(error);
                                    toast(t('insight.team.roleChanged'));
                                    void load();
                                  }}
                                >
                                  {t(`app.roles.${r}`)}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onSelect={async () => {
                                  const { error } = await authClient.organization.removeMember({
                                    memberIdOrEmail: m.id,
                                  });
                                  if (error) return onError(error);
                                  toast(t('insight.team.removed'));
                                  void load();
                                }}
                              >
                                <Trash2 strokeWidth={1.75} aria-hidden />
                                {t('insight.team.remove')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <p className="text-label-12 font-normal text-ink-3">{t('insight.team.realData')}</p>
      </TabsContent>
      <TabsContent value="invites">
        <Panel>
          {invites.length === 0 ? (
            <EmptyState
              title={t('insight.team.noInvites')}
              action={
                canInvite ? (
                  <Button onClick={() => setInviteOpen(true)}>
                    <Plus aria-hidden strokeWidth={1.75} />
                    {t('insight.team.invite')}
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-label-14">{i.email}</span>
                  <Badge>{t(`app.roles.${i.role as Role}`)}</Badge>
                  <span className="text-label-12 font-normal text-ink-3">
                    {t('insight.team.expires', { date: date(i.expiresAt) })}
                  </span>
                  {can('member:invite') ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const { error } = await authClient.organization.cancelInvitation({
                          invitationId: i.id,
                        });
                        if (error) return onError(error);
                        toast(t('insight.team.cancelled'));
                        void load();
                      }}
                    >
                      {t('insight.team.cancel')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </TabsContent>
      <TabsContent value="goals" className="grid gap-2">
        <Panel className="overflow-x-auto">
          <table className="w-full text-copy-14">
            <thead className="bg-sunken text-left text-label-13 text-ink-3">
              <tr className="h-9">
                <th scope="col" className="pl-4 font-medium">
                  {t('insight.team.colMember')}
                </th>
                <th scope="col" className="px-3 font-medium">
                  {t('insight.team.goalMeetings')}
                </th>
                <th scope="col" className="pr-4 font-medium">
                  {t('insight.team.goalWon')}
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_MEMBERS.filter((m) => m.goalMeetings).map((m) => (
                <tr key={m.id} className="h-12 border-t border-line">
                  <th scope="row" className="pl-4 text-left font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={m.name} size="sm" />
                      {m.name}
                    </span>
                  </th>
                  {[
                    [m.meetingsMonth, m.goalMeetings],
                    [m.wonMonth, m.goalWon],
                  ].map(([n, g], i) => (
                    <td key={i} className={i ? 'pr-4' : 'px-3'}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="block h-1.5 w-28 overflow-hidden rounded-[2px] bg-sunken"
                          aria-hidden
                        >
                          <span
                            className={cn(
                              'block h-full origin-left',
                              n! >= g! ? 'bg-ok' : 'bg-accent',
                            )}
                            style={{ transform: `scaleX(${Math.min(1, n! / g!)})` }}
                          />
                        </span>
                        <span className="text-label-12 text-ink-2 tnum">
                          {t('insight.team.of', { n: n!, goal: g! })}
                        </span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <p className="text-label-12 font-normal text-ink-3">{t('insight.team.demoGoals')}</p>
      </TabsContent>
      <TabsContent value="roles" className="grid gap-3">
        <p className="text-copy-14 text-ink-2">{t('insight.team.rolesLede')}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {ROLES.map((r) => (
            <li key={r} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <b className="text-label-14 font-semibold">{t(`app.roles.${r}`)}</b>
              <span className="text-copy-14 text-ink-2">{t(`app.roleHints.${r}`)}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('insight.team.inviteTitle')}</DialogTitle>
            <DialogDescription>{t('insight.team.inviteLede')}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
              const { error } = await authClient.organization.inviteMember({
                email,
                role,
              });
              if (error) return onError(error);
              setInviteOpen(false);
              toast(t('insight.team.sent'));
              void load();
            }}
          >
            <Field id="inv-email" label={t('insight.team.email')}>
              <Input name="email" type="email" required autoComplete="off" />
            </Field>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-role">{t('insight.team.role')}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="inv-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(assignable(actor).length ? assignable(actor) : (['member'] as Role[])).map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {t(`app.roles.${r}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <p className="text-label-12 font-normal text-ink-3">{t(`app.roleHints.${role}`)}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                {t('app.common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('insight.team.send')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

/* ---------------- Intégrations ---------------- */
const stIcon = { connected: CircleCheck, available: Circle, attention: CircleAlert } as const;
export function IntegrationsView() {
  const t = useT();
  const locale = useLocale();
  const { mode } = useApp();
  const { can, needs2fa } = usePerm();
  const manage = can('integration:manage');
  const keys = can('apikey:manage') || needs2fa('apikey:manage');
  const [created, setCreated] = React.useState<string | null>(null);
  const [keyOpen, setKeyOpen] = React.useState(false);
  const groups = ['crm', 'email', 'messaging', 'calendar', 'data'] as const;
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Panel key={g} aria-labelledby={`g-${g}`}>
            <PanelHeader>
              <PanelTitle id={`g-${g}`}>{t(`insight.integrations.groups.${g}`)}</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-line">
              {DEMO_INTEGRATIONS.filter((i) => i.group === g).map((i) => {
                const Icon = stIcon[i.status];
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-line text-label-13 font-semibold">
                      {i.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-14 font-semibold">{i.name}</p>
                      <p className="truncate text-label-12 font-normal text-ink-3">
                        {i.detail[locale]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'hidden items-center gap-1.5 text-label-12 sm:inline-flex',
                        i.status === 'connected'
                          ? 'text-ok'
                          : i.status === 'attention'
                            ? 'text-warn'
                            : 'text-ink-3',
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                      {t(`insight.integrations.status.${i.status}`)}
                    </span>
                    {manage ? (
                      <Button
                        size="sm"
                        variant={i.status === 'available' ? 'secondary' : 'ghost'}
                        onClick={() => toast(t('insight.integrations.connectedToast'))}
                      >
                        {i.status === 'available'
                          ? t('insight.integrations.connect')
                          : t('insight.integrations.manage')}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>
      {keys ? (
        <Panel aria-labelledby="h-keys">
          <PanelHeader>
            <div className="min-w-0 flex-1">
              <PanelTitle id="h-keys">{t('insight.integrations.apiKeys')}</PanelTitle>
              <p className="text-label-12 font-normal text-ink-3">
                {t('insight.integrations.apiKeysLede')}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                can('apikey:manage')
                  ? setKeyOpen(true)
                  : toast(t('auth.errors.two_factor_required'))
              }
            >
              <KeyRound aria-hidden strokeWidth={1.75} />
              {t('insight.integrations.newKey')}
            </Button>
          </PanelHeader>
          {created ? (
            <div
              className="flex flex-wrap items-center gap-2 border-b border-line bg-ok-soft px-4 py-3 text-label-13 text-ok"
              role="status"
            >
              {t('insight.integrations.keyCreated')}
              <code className="rounded-xs bg-surface px-2 py-1 text-ink tnum">{created}</code>
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(created);
                  toast(t('app.common.copied'));
                }}
              >
                <Copy aria-hidden strokeWidth={1.75} />
                {t('app.common.copy')}
              </Button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-copy-14">
              <thead className="bg-sunken text-left text-label-13 text-ink-3">
                <tr className="h-9">
                  <th scope="col" className="pl-4 font-medium">
                    {t('insight.integrations.colName')}
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    {t('insight.integrations.colKey')}
                  </th>
                  <th scope="col" className="px-3 font-medium max-sm:hidden">
                    {t('insight.integrations.colScopes')}
                  </th>
                  <th scope="col" className="px-3 font-medium max-sm:hidden">
                    {t('insight.integrations.colUsed')}
                  </th>
                  <th scope="col" className="pr-4">
                    <span className="sr-only">{t('app.common.more')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEMO_API_KEYS.map((k) => (
                  <tr key={k.id} className="h-11 border-t border-line">
                    <th scope="row" className="pl-4 text-left font-medium">
                      {k.name[locale]}
                    </th>
                    <td className="px-3">
                      <code className="text-label-13 text-ink-2 tnum">
                        {k.prefix}••••••••{k.last4}
                      </code>
                    </td>
                    <td className="px-3 text-ink-2 max-sm:hidden">
                      <code className="text-label-12">{k.scopes}</code>
                    </td>
                    <td className="px-3 text-ink-3 max-sm:hidden">{k.lastUsed[locale]}</td>
                    <td className="pr-4 text-right">
                      {can('apikey:manage') ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast(t('insight.integrations.revoked'))}
                        >
                          {t('insight.integrations.revoke')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      <Panel aria-labelledby="h-ai">
        <PanelHeader>
          <div className="min-w-0 flex-1">
            <PanelTitle id="h-ai">{t('insight.integrations.aiKeys')}</PanelTitle>
            <p className="text-label-12 font-normal text-ink-3">
              {mode === 'license'
                ? t('insight.integrations.aiKeysLede')
                : t('insight.integrations.saasManaged')}
            </p>
          </div>
        </PanelHeader>
        <ul className="divide-y divide-line">
          {[
            ['Anthropic', true],
            ['OpenAI', false],
            ['Google Places', true],
            ['Serper', false],
          ].map(([n, set]) => (
            <li key={n as string} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-label-14">{n as string}</span>
              <code className="text-label-13 text-ink-3">{set ? '••••••••••••' : '—'}</code>
              <Status tone={set ? 'ok' : 'none'}>
                {set ? t('insight.integrations.set') : t('insight.integrations.notSet')}
              </Status>
            </li>
          ))}
        </ul>
      </Panel>
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('insight.integrations.newKey')}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setKeyOpen(false);
              setCreated('sk_live_demo_••••••••••••_a1b2');
            }}
          >
            <Field id="kn" label={t('insight.integrations.keyName')}>
              <Input required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setKeyOpen(false)}>
                {t('app.common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('app.common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Exports ---------------- */
type Exp = (typeof DEMO_EXPORTS)[number];
export function ExportsView() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { can, needs2fa } = usePerm();
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<'csv' | 'xlsx'>('xlsx');
  const cols: Column<Exp>[] = [
    {
      id: 'name',
      header: t('insight.exports.colName'),
      primary: true,
      cell: (e) => <b className="font-semibold">{e.name[locale]}</b>,
    },
    {
      id: 'format',
      header: t('insight.exports.colFormat'),
      cell: (e) => <Badge tone="outline">{e.format.toUpperCase()}</Badge>,
    },
    {
      id: 'rows',
      header: t('insight.exports.colRows'),
      align: 'right',
      sortValue: (e) => e.rows,
      cell: (e) => e.rows,
    },
    {
      id: 'by',
      header: t('insight.exports.colBy'),
      cell: (e) => (
        <span className="inline-flex items-center gap-2 text-ink-2">
          <Avatar name={e.by} size="sm" />
          {e.by.split(' ')[0]}
        </span>
      ),
      mobileHidden: true,
    },
    {
      id: 'when',
      header: t('insight.exports.colWhen'),
      cell: (e) => <span className="text-ink-3">{e.when[locale]}</span>,
      mobileHidden: true,
    },
    {
      id: 'status',
      header: t('insight.exports.colStatus'),
      cell: (e) => (
        <Status tone={e.status === 'ready' ? 'ok' : e.status === 'running' ? 'warn' : 'none'}>
          {t(`insight.exports.status.${e.status}`)}
        </Status>
      ),
    },
    {
      id: 'dl',
      header: '',
      cell: (e) =>
        e.status === 'ready' && can('prospect:export') ? (
          <Button size="sm" variant="ghost" onClick={() => toast(t('insight.exports.download'))}>
            <Download aria-hidden strokeWidth={1.75} />
            <span className="max-md:sr-only">{t('insight.exports.download')}</span>
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-label-13 font-normal text-ink-2">
          <ShieldCheck className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />
          {t('insight.exports.auditNote')}
        </p>
        <span className="flex-1" />
        <Button
          variant="primary"
          onClick={() =>
            can('prospect:export') ? setOpen(true) : router.push('/two-factor/setup?next=/exports')
          }
        >
          {needs2fa('prospect:export') ? (
            <ShieldOff aria-hidden strokeWidth={1.75} />
          ) : (
            <Plus aria-hidden strokeWidth={1.75} />
          )}
          {needs2fa('prospect:export')
            ? t('app.shell.twoFactorCta')
            : t('insight.exports.newExport')}
        </Button>
      </div>
      <DataTable
        rows={[...DEMO_EXPORTS]}
        columns={cols}
        getId={(e) => e.id}
        getLabel={(e) => e.name[locale]}
        caption={t('insight.exports.title')}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('insight.exports.newTitle')}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
              toast(t('insight.exports.created'));
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="src">{t('insight.exports.source')}</Label>
              <Select defaultValue="view">
                <SelectTrigger id="src">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">{t('insight.exports.sourceView')}</SelectItem>
                  <SelectItem value="all">{t('insight.exports.sourceAll')}</SelectItem>
                  <SelectItem value="pipeline">{t('insight.exports.sourcePipeline')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-label-13">{t('insight.exports.format')}</span>
              <Segmented<'csv' | 'xlsx'>
                label={t('insight.exports.format')}
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'xlsx', label: 'Excel' },
                  { value: 'csv', label: 'CSV' },
                ]}
              />
            </div>
            <div className="grid gap-1 rounded-md bg-canvas px-3 py-2.5">
              <span className="text-label-12 text-ink-3">{t('insight.exports.fields')}</span>
              <span className="text-copy-14">{t('insight.exports.fieldsValue')}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t('app.common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('insight.exports.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------- Conformité ---------------- */
const RULES = [
  { zone: 'eu', cc: ['FR', 'DE', 'ES', 'IT', 'PT', 'BE', 'NL', 'PL', 'IE', 'RO'] },
  { zone: 'uk', cc: ['GB'] },
  { zone: 'us', cc: ['US'] },
  { zone: 'ca', cc: ['CA'] },
  { zone: 'br', cc: ['BR'] },
  { zone: 'apac', cc: ['AU', 'SG', 'IN'] },
  { zone: 'africa', cc: ['MA', 'SN', 'NG', 'ZA'] },
] as const;

export function ComplianceView({ marketing }: { marketing: Record<string, string> }) {
  const t = useT();
  const locale = useLocale();
  const { org } = useApp();
  const { can } = usePerm();
  const manage = can('compliance:manage');
  const [addOpen, setAddOpen] = React.useState(false);
  return (
    <Tabs defaultValue="suppressions" className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <TabsList className="border-0">
          <TabsTrigger value="suppressions">{t('insight.compliance.tabSuppressions')}</TabsTrigger>
          <TabsTrigger value="erasure">
            {t('insight.compliance.tabErasure')}{' '}
            <span className="text-label-12 text-ink-3 tnum">
              {DEMO_ERASURE.filter((d) => d.status !== 'done').length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="audit">{t('insight.compliance.tabAudit')}</TabsTrigger>
          <TabsTrigger value="rules">{t('insight.compliance.tabRules')}</TabsTrigger>
        </TabsList>
        <span className="flex-1" />
        {can('prospect:write') ? (
          <Button onClick={() => setAddOpen(true)}>
            <Plus aria-hidden strokeWidth={1.75} />
            {t('insight.compliance.add')}
          </Button>
        ) : null}
      </div>
      <TabsContent value="suppressions">
        <DataTable
          rows={[...DEMO_SUPPRESSIONS]}
          getId={(s) => s.id}
          getLabel={(s) => s.value}
          searchText={(s) => s.value}
          caption={t('insight.compliance.tabSuppressions')}
          columns={[
            {
              id: 'v',
              header: t('insight.compliance.colValue'),
              primary: true,
              cell: (s) => <code className="text-label-13">{s.value}</code>,
            },
            {
              id: 'type',
              header: t('insight.compliance.colType'),
              cell: (s) => <Badge>{t(`insight.compliance.types.${s.type}`)}</Badge>,
            },
            {
              id: 'reason',
              header: t('insight.compliance.colReason'),
              cell: (s) => <span className="text-ink-2">{s.reason[locale]}</span>,
              mobileHidden: true,
            },
            {
              id: 'scope',
              header: t('insight.compliance.colScope'),
              cell: (s) => <span className="text-ink-2">{s.scope[locale]}</span>,
              mobileHidden: true,
            },
            {
              id: 'when',
              header: t('insight.compliance.colWhen'),
              cell: (s) => <span className="text-ink-3">{s.when[locale]}</span>,
              mobileHidden: true,
            },
            {
              id: 'by',
              header: t('insight.compliance.colBy'),
              cell: (s) => <span className="text-ink-2">{s.by}</span>,
              mobileHidden: true,
            },
          ]}
        />
      </TabsContent>
      <TabsContent value="erasure">
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {DEMO_ERASURE.map((d) => (
            <li
              key={d.id}
              className="grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_160px_140px_auto]"
            >
              <code className="truncate text-label-13">{d.requester}</code>
              <span className="text-label-12 font-normal text-ink-3">
                {t('insight.compliance.colReceived')} {d.received[locale]}
              </span>
              <span
                className={cn(
                  'text-label-13 tnum',
                  d.status !== 'done' && d.daysLeft < 20 ? 'text-warn' : 'text-ink-2',
                )}
              >
                {d.deadline[locale]}
                {d.status !== 'done'
                  ? `, ${t('insight.compliance.daysLeft', { n: d.daysLeft })}`
                  : ''}
              </span>
              <Status
                tone={d.status === 'done' ? 'ok' : d.status === 'in_progress' ? 'warn' : 'none'}
              >
                {t(`insight.compliance.erasure.${d.status}`)}
              </Status>
              {manage && d.status !== 'done' ? (
                <Button size="sm" onClick={() => toast(t('insight.compliance.processed'))}>
                  {t('insight.compliance.process')}
                </Button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="audit">
        {can('audit:read') ? (
          <DataTable
            rows={[...DEMO_AUDIT]}
            getId={(l) => l.id}
            getLabel={(l) => l.action}
            searchText={(l) => `${l.actor} ${l.action} ${l.target[locale]}`}
            caption={t('insight.compliance.tabAudit')}
            columns={[
              {
                id: 'when',
                header: t('insight.compliance.colWhen'),
                primary: true,
                sortValue: (l) => l.when,
                cell: (l) => <span className="text-ink-2 tnum">{l.when}</span>,
              },
              { id: 'actor', header: t('insight.compliance.colActor'), cell: (l) => l.actor },
              {
                id: 'action',
                header: t('insight.compliance.colAction'),
                cell: (l) => <code className="text-label-12">{l.action}</code>,
              },
              {
                id: 'target',
                header: t('insight.compliance.colTarget'),
                cell: (l) => <span className="text-ink-2">{l.target[locale]}</span>,
                mobileHidden: true,
              },
              {
                id: 'ip',
                header: t('insight.compliance.colIp'),
                cell: (l) => <span className="text-ink-3 tnum">{l.ip}</span>,
                mobileHidden: true,
              },
            ]}
          />
        ) : (
          <Panel>
            <EmptyState
              icon={<Lock strokeWidth={1.75} aria-hidden />}
              title={t('insight.compliance.auditLocked')}
            />
          </Panel>
        )}
      </TabsContent>
      <TabsContent value="rules" className="grid gap-3">
        <p className="text-copy-14 text-ink-2">{t('insight.compliance.rulesLede')}</p>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-copy-14">
            <thead className="bg-sunken text-left text-label-13 text-ink-3">
              <tr className="h-9">
                <th scope="col" className="pl-4 font-medium">
                  {t('insight.compliance.colCountry')}
                </th>
                <th scope="col" className="px-3 font-medium">
                  {t('insight.compliance.colCompanies')}
                </th>
                <th scope="col" className="pr-4 font-medium">
                  {t('insight.compliance.colPeople')}
                </th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => {
                const mine = (r.cc as readonly string[]).includes(org.countryCode);
                return (
                  <tr
                    key={r.zone}
                    className={cn(
                      'border-t border-line align-top',
                      mine && 'bg-accent-soft shadow-[inset_2px_0_0_var(--accent)]',
                    )}
                  >
                    <th scope="row" className="py-3 pl-4 pr-3 text-left font-semibold">
                      {marketing[r.zone]}
                      <small className="block text-label-12 font-normal text-ink-3">
                        {marketing[`${r.zone}Law`]}
                      </small>
                      {mine ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-label-12 text-accent-text">
                          <CountryCode code={org.countryCode} />
                          {t('insight.compliance.yourCountry')}
                        </span>
                      ) : null}
                    </th>
                    <td className="px-3 py-3">
                      <Status tone="ok" className="items-start whitespace-normal [&_svg]:mt-0.5">
                        {marketing[`${r.zone}B`]}
                      </Status>
                    </td>
                    <td className="py-3 pr-4">
                      <Status tone="warn" className="items-start whitespace-normal [&_svg]:mt-0.5">
                        {marketing[`${r.zone}C`]}
                      </Status>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-label-12 font-normal text-ink-3">{marketing.foot}</p>
      </TabsContent>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent closeLabel={t('app.common.close')}>
          <DialogHeader>
            <DialogTitle>{t('insight.compliance.add')}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setAddOpen(false);
              toast(t('insight.compliance.added'));
            }}
          >
            <Field id="sv" label={t('insight.compliance.value')}>
              <Input required />
            </Field>
            <Field id="sr" label={t('insight.compliance.colReason')}>
              <Input />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                {t('app.common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('app.common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

export function TwoFactorLink() {
  const t = useT();
  return (
    <Link href="/two-factor/setup" className="text-accent-text hover:underline">
      {t('app.shell.twoFactorCta')}
    </Link>
  );
}
