import { z } from 'zod';
import { evaluate, rulesetsFor } from '@scoutra/compliance';
import { CONTACT_CHANNELS, isoCountrySchema } from '@scoutra/core';
import { apiRoute, json } from '@/server/http';
import { parseQuery } from '@/server/query';

export const dynamic = 'force-dynamic';

const query = z.object({ country: isoCountrySchema }).strict();

/**
 * Règles applicables à un pays destinataire (vu depuis le pays de l'organisation) : jeux de
 * règles et versions, et décision par canal pour un professionnel et pour un particulier.
 */
export const GET = apiRoute({ action: 'compliance:read' }, async ({ req, ctx }) => {
  const q = parseQuery(req, query);
  const { sets, covered } = rulesetsFor(q.country);
  const decide = (audience: 'business' | 'individual') =>
    CONTACT_CHANNELS.map((channel) => {
      const d = evaluate({
        recipientCountry: q.country,
        senderCountry: ctx.org.countryCode,
        audience,
        channel,
      });
      return {
        channel,
        outcome: d.outcome,
        conditions: d.conditions,
        ruleIds: d.ruleIds,
        reasons: d.reasons,
      };
    });
  return json({
    country: q.country,
    senderCountry: ctx.org.countryCode,
    covered,
    jurisdictions: sets.map((s) => ({
      jurisdiction: s.jurisdiction,
      version: s.version,
      sources: s.sources,
      retentionDays: s.retentionDays,
      maxFollowUps: s.maxFollowUps,
    })),
    business: decide('business'),
    individual: decide('individual'),
    disclaimer:
      'Règles indicatives à faire valider par un juriste ; elles ne constituent pas un avis juridique.',
  });
});
