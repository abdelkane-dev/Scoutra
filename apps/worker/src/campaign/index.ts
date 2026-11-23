import {
  campaignFinalizeJob,
  campaignInterpretJob,
  campaignPlanJob,
  publishTenantJob,
  prospectProcessJob,
  searchRunJob,
  workTenant,
} from '@scoutra/queue';
import { staleCampaigns } from '@scoutra/db';
import type { CampaignDeps } from './deps';
import { handleFinalize } from './finalize';
import { handleInterpret } from './interpret';
import { handlePlan } from './plan';
import { handleProcess } from './process';
import { handleSearch } from './search';

/** Consommateurs des tâches de campagne (concurrence par file, ARCHITECTURE §4.2). */
export async function registerCampaignWorkers(deps: CampaignDeps): Promise<void> {
  const { boss, db } = deps;
  await workTenant(boss, db, campaignInterpretJob, (p, m) => handleInterpret(deps, p, m.signal), {
    localConcurrency: 2,
  });
  await workTenant(boss, db, campaignPlanJob, (p) => handlePlan(deps, p), { localConcurrency: 2 });
  await workTenant(boss, db, searchRunJob, (p, m) => handleSearch(deps, p, m.signal), {
    localConcurrency: 4,
  });
  await workTenant(boss, db, prospectProcessJob, (p, m) => handleProcess(deps, p, m.signal), {
    localConcurrency: 8,
  });
  await workTenant(boss, db, campaignFinalizeJob, (p) => handleFinalize(deps, p), {
    localConcurrency: 2,
  });
}

/**
 * Balayage toutes les 2 min (constat 16) : pour chaque campagne active sans activité, nouvelle
 * vérification de clôture (idempotente). Remplace l'auto-réparation faite lors d'un GET.
 */
export function startCampaignSweeper(deps: CampaignDeps, everyMs = 120_000): () => void {
  const tick = async () => {
    try {
      for (const s of await staleCampaigns(deps.db))
        await publishTenantJob(
          deps.boss,
          deps.db,
          campaignFinalizeJob,
          { organizationId: s.organizationId, campaignId: s.campaignId },
          {
            refType: 'campaign',
            refId: s.campaignId,
            singletonKey: `sweep:${s.campaignId}`,
          },
        );
    } catch (err) {
      console.error(
        '[worker] balayage des campagnes :',
        err instanceof Error ? err.message : 'erreur',
      );
    }
  };
  const t = setInterval(() => void tick(), everyMs);
  void tick();
  return () => clearInterval(t);
}

export { createCampaignDeps, type CampaignDeps } from './deps';
