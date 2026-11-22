import {
  campaignFinalizeJob,
  campaignInterpretJob,
  campaignPlanJob,
  prospectProcessJob,
  searchRunJob,
  workTenant,
} from '@scoutra/queue';
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

export { createCampaignDeps, type CampaignDeps } from './deps';
