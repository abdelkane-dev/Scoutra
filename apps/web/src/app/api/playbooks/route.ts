import { PLAYBOOKS, suggestPlaybooks } from '@scoutra/agents';
import type { AccountType, Sector } from '@scoutra/core';
import { apiRoute, json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Playbooks des 23 modèles, priorisés selon le profil de l'organisation (type + secteurs). */
export const GET = apiRoute({ action: 'campaign:read' }, async ({ ctx }) => {
  const ranking = suggestPlaybooks(
    ctx.org.accountType as AccountType | null,
    ctx.org.sectors as Sector[],
  );
  return json({
    items: ranking.map((r) => {
      const p = PLAYBOOKS.find((x) => x.model === r.model)!;
      return {
        model: p.model,
        version: p.version,
        relevance: r.score,
        kinds: p.kinds,
        connectors: p.connectors,
        signals: p.signals,
        channels: p.channels,
        audience: p.audience,
        rules: p.rules,
        messageAngle: p.messageAngle,
      };
    }),
  });
});
