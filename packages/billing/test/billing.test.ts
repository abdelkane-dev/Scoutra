import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  PLANS,
  billingEventSchema,
  costModeFor,
  estimateCampaign,
  monthlyGrantFor,
  verifySignedPayload,
} from '../src';

describe('barème (configuration unique)', () => {
  it('formules conformes à docs/offres/credits.md', () => {
    expect(PLANS.research).toMatchObject({
      monthlyCredits: 1000,
      concurrentCampaigns: 2,
      dailyProspectCap: 150,
      costGuardUsd: 9,
    });
    expect(PLANS.pipeline).toMatchObject({
      monthlyCredits: 3000,
      includedSeats: 3,
      concurrentCampaigns: 5,
      dailyProspectCap: 400,
      costGuardUsd: 26,
    });
    expect(monthlyGrantFor(PLANS.pipeline, 5)).toBe(4000);
  });
  it('garde-fou de coût réel : 70 % économie, 100 % gratuit seul', () => {
    expect(costModeFor(6_000_000, 9)).toBe('normal');
    expect(costModeFor(6_300_000, 9)).toBe('economy');
    expect(costModeFor(9_000_000, 9)).toBe('free_only');
    expect(costModeFor(1e12, null)).toBe('normal');
  });
  it('estimation en fourchette ; pas de crédits en licence', () => {
    const e = estimateCampaign({
      maxProspects: 200,
      quality: 'standard',
      plannedQueriesCostMicroUsd: 50_000,
      plannedQueries: 10,
      mode: 'saas',
      degraded: false,
    });
    expect(e.credits).toEqual({ low: 120, high: 200, perProspect: 1 });
    expect(e.costUsd.low).toBeLessThan(e.costUsd.high);
    expect(
      estimateCampaign({
        maxProspects: 10,
        quality: 'premium',
        plannedQueriesCostMicroUsd: 0,
        plannedQueries: 1,
        mode: 'license',
        degraded: true,
      }).credits,
    ).toBeNull();
  });
});

describe('webhooks de paiement', () => {
  const secret = 'whsec_0123456789abcdef';
  const body = '{"a":1}';
  const sign = (t: number, b = body) =>
    `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${b}`).digest('hex')}`;
  it('signature valide, rejeu et altération refusés', () => {
    const now = 1_800_000_000;
    expect(verifySignedPayload(body, sign(now), secret, { now })).toBe(true);
    expect(verifySignedPayload(body, sign(now - 1000), secret, { now })).toBe(false);
    expect(verifySignedPayload('{"a":2}', sign(now), secret, { now })).toBe(false);
    expect(verifySignedPayload(body, null, secret, { now })).toBe(false);
    expect(verifySignedPayload(body, 't=abc,v1=zz', secret, { now })).toBe(false);
  });
  it('événements validés strictement', () => {
    expect(
      billingEventSchema.safeParse({
        type: 'pack.purchased',
        eventId: 'evt_1',
        organizationId: '00000000-0000-4000-8000-000000000001',
        pack: 'pack_500',
      }).success,
    ).toBe(true);
    expect(
      billingEventSchema.safeParse({
        type: 'pack.purchased',
        eventId: 'evt_1',
        organizationId: 'x',
        pack: 'pack_1',
      }).success,
    ).toBe(false);
  });
});
