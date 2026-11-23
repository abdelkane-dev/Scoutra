import { sql } from 'drizzle-orm';
import type { Database } from './client';

/**
 * Campagnes actives sans activité depuis 5 min, toutes organisations (fonction SQL SECURITY
 * DEFINER qui ne renvoie que des identifiants). Le worker relance alors la vérification de
 * clôture DANS l'organisation de chaque campagne (revue étape 2, constat 16).
 */
export async function staleCampaigns(
  db: Database,
): Promise<{ organizationId: string; campaignId: string }[]> {
  const res = await db.execute<{ organization_id: string; campaign_id: string }>(
    sql`select organization_id, campaign_id from app_stale_campaigns()`,
  );
  return res.rows.map((r) => ({ organizationId: r.organization_id, campaignId: r.campaign_id }));
}
