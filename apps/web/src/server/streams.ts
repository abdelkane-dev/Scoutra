import 'server-only';
import { ConcurrencySlots } from '@scoutra/core';
import { createCampaignEventListener, type CampaignEventListener } from '@scoutra/db';
import { getEnv } from './env';

const g = globalThis as typeof globalThis & {
  __scoutraListener?: CampaignEventListener;
  __scoutraStreams?: ConcurrencySlots;
};

export function campaignListener(): CampaignEventListener {
  g.__scoutraListener ??= createCampaignEventListener(getEnv().DATABASE_URL);
  return g.__scoutraListener;
}

/** Plafonds de flux SSE simultanés par processus (revue étape 2, constat 3). */
export const STREAM_LIMITS = { perUser: 3, perOrg: 20 } as const;

/** Emplacement de flux (libération) ou null si un plafond est atteint (réponse 429). */
export function acquireStream(orgId: string, userId: string): (() => void) | null {
  g.__scoutraStreams ??= new ConcurrencySlots();
  return g.__scoutraStreams.acquire({
    [`u:${userId}`]: STREAM_LIMITS.perUser,
    [`o:${orgId}`]: STREAM_LIMITS.perOrg,
  });
}
