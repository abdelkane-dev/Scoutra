import { z } from 'zod';
import { messagePatchSchema, patchMessage } from '@scoutra/crm';
import { withTenant } from '@scoutra/db';
import { actorOf } from '@/server/campaigns';
import { appDb } from '@/server/db';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Statut saisi par l'utilisateur (à envoyer, copié, envoyé à la main, répondu, écarté), texte
 * de la réponse reçue, ou correction du brouillon. Aucun envoi automatique.
 */
export const PATCH = apiRoute(
  { action: 'message:write', params: z.object({ id: z.uuid() }), body: messagePatchSchema },
  async ({ params, body, ctx }) => {
    const db = await appDb();
    const m = await withTenant(db, { orgId: ctx.orgId, userId: ctx.user.id }, (tx) =>
      patchMessage(tx, actorOf(ctx), params.id, body),
    );
    return json({
      id: m.id,
      status: m.status,
      subject: m.subject,
      body: m.body,
      footer: m.footer,
      sentAt: m.sentAt,
      repliedAt: m.repliedAt,
    });
  },
);
