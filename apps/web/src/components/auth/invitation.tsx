'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Skeleton, buttonVariants, toast } from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useLocale, useT } from '@/lib/i18n/client';
import { authClient } from '@/lib/auth-client';
import { FormAlert, useAuthErrorMessage } from './form-bits';

type Invite = {
  id: string;
  organizationName?: string;
  inviterEmail?: string;
  role: string;
  expiresAt: string | Date;
  organizationId: string;
};

export function InvitationPanel({ id, signedIn }: { id: string; signedIn: boolean }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const msg = useAuthErrorMessage();
  const [invite, setInvite] = React.useState<Invite | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(signedIn);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!signedIn) return;
    let live = true;
    authClient.organization.getInvitation({ query: { id } }).then(({ data, error: err }) => {
      if (!live) return;
      setLoading(false);
      if (err || !data)
        setError(
          err?.code === 'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION'
            ? t('auth.invitation.wrongAccount')
            : t('auth.invitation.expired'),
        );
      else setInvite(data as unknown as Invite);
    });
    return () => {
      live = false;
    };
  }, [id, signedIn, t]);

  const next = `/invitations/${encodeURIComponent(id)}`;
  if (!signedIn) {
    return (
      <div className="grid gap-5">
        <p className="text-copy-16 text-ink-2">{t('auth.invitation.ledeUnknown')}</p>
        <p className="text-copy-14 text-ink-3">{t('auth.invitation.signin')}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className={buttonVariants({ variant: 'ink', size: 'lg' })}
          >
            {t('auth.login.submit')}
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            {t('auth.invitation.createAccount')}
          </Link>
        </div>
      </div>
    );
  }
  if (loading)
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  if (error || !invite) return <FormAlert>{error}</FormAlert>;

  const roleKey = `app.roles.${invite.role}` as MessageKey;
  const role = t(roleKey) === roleKey ? invite.role : t(roleKey);
  const expires = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(invite.expiresAt));
  return (
    <div className="grid gap-5">
      <p className="text-copy-16 text-ink-2">
        {t('auth.invitation.lede', {
          inviter: invite.inviterEmail ?? '—',
          org: invite.organizationName ?? '—',
          role,
        })}
      </p>
      <p className="text-label-13 font-normal text-ink-3">
        {t('auth.invitation.expires', { date: expires })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ink"
          size="lg"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const { error: err } = await authClient.organization.acceptInvitation({
              invitationId: id,
            });
            if (!err)
              await authClient.organization.setActive({ organizationId: invite.organizationId });
            setPending(false);
            if (err) return setError(msg(err));
            toast(t('auth.invitation.accepted'));
            router.replace('/home');
            router.refresh();
          }}
        >
          {t('auth.invitation.accept')}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const { error: err } = await authClient.organization.rejectInvitation({
              invitationId: id,
            });
            setPending(false);
            if (err) return setError(msg(err));
            toast(t('auth.invitation.declined'));
            router.replace('/');
          }}
        >
          {t('auth.invitation.decline')}
        </Button>
      </div>
    </div>
  );
}
