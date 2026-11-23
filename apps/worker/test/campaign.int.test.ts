import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { mockLlmClient } from '@scoutra/ai';
import { PLANS } from '@scoutra/billing';
import { CircuitBreaker, type HttpClient } from '@scoutra/connectors';
import { createKeyring } from '@scoutra/crypto';
import { eq, getCreditBalance, grantCredits, schema, withTenant } from '@scoutra/db';
import {
  cancelCampaign,
  createBoss,
  launchCampaign,
  startInterpretation,
  type Boss,
} from '@scoutra/queue';
import { registerCampaignWorkers, type CampaignDeps } from '../src/campaign';
import { handles, seedOrgAndOwner } from '../../../packages/db/test/helpers';

const info = inject('db');
const fx = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../packages/connectors/test/fixtures/${name}`, import.meta.url)),
    'utf8',
  );

/** Réponses enregistrées (synthétiques) : aucun appel réseau réel. */
const http: HttpClient = {
  async request(url) {
    const routes: [RegExp, number, string][] = [
      [/recherche-entreprises/, 200, fx('recherche-entreprises.json')],
      [/overpass/, 200, fx('overpass.json')],
      [/crt\.sh/, 200, '[]'],
      [/lebaobab\.example\.sn\/robots\.txt/, 404, ''],
      [
        /lebaobab\.example\.sn\/$/,
        200,
        fx('site-home.html').replaceAll('batir.example.sn', 'lebaobab.example.sn'),
      ],
      [/./, 404, ''],
    ];
    const r = routes.find(([re]) => re.test(url))!;
    return { status: r[1], text: () => r[2], json: <T>() => JSON.parse(r[2]) as T };
  },
  internal() {
    return Promise.reject(new Error('aucun service interne en test'));
  },
};

async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  timeoutMs = 45_000,
): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('délai dépassé');
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe.skipIf(!info.available)(
  'orchestration d’une campagne (pg-boss + RLS, modèle simulé)',
  () => {
    let h: ReturnType<typeof handles>;
    let boss: Boss;
    let A: { orgId: string; userId: string };
    let B: { orgId: string; userId: string };
    const llm = mockLlmClient(
      (req) => {
        if (req.agent === 'interpreter')
          return {
            model: 'b2b',
            kinds: ['company'],
            summary: 'Restaurants à Dakar',
            language: 'fr',
            countries: ['SN'],
            regions: ['Dakar'],
            keywords: ['restaurant'],
            sectors: ['i_hospitality'],
            roles: [],
            companySizeMin: null,
            companySizeMax: null,
            signals: [],
            exclusions: [],
            channels: ['email', 'phone'],
            clarifyingQuestions: [],
            confidence: 0.9,
          };
        if (req.agent === 'enrichment')
          return {
            summary: 'Restaurant à Dakar',
            category: 'restaurant',
            services: [],
            languages: ['fr'],
            sizeHint: 'small',
            audience: 'consumers',
          };
        if (req.agent === 'scoring') return { adjustment: 5, reason: 'activité correspondante' };
        return {
          subject: 'Proposition pour votre restaurant',
          body: 'Bonjour, nous accompagnons les restaurants de Dakar pour leurs fournitures.',
          hooks: [],
        };
      },
      { costMicroUsd: 50 },
    );

    async function newCampaign(org: { orgId: string; userId: string }, maxProspects = 5) {
      const [c] = await withTenant(h.app.db, org, (tx) =>
        tx
          .insert(schema.campaigns)
          .values({
            organizationId: org.orgId,
            createdBy: org.userId,
            name: 'Test',
            promptText: 'Restaurants à Dakar au Sénégal',
            prospectingModel: 'b2b',
            status: 'interpreting',
            maxProspects,
          })
          .returning(),
      );
      return c!.id;
    }
    const campaign = (org: { orgId: string }, id: string) =>
      withTenant(
        h.app.db,
        org,
        async (tx) =>
          (await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, id)))[0]!,
      );

    beforeAll(async () => {
      h = handles(info);
      A = await seedOrgAndOwner(h.auth, 'camp-a', 'SN');
      B = await seedOrgAndOwner(h.auth, 'camp-b', 'SN');
      boss = createBoss(info.appUrl);
      boss.on('error', () => undefined);
      await boss.start();
      const deps: CampaignDeps = {
        db: h.app.db,
        boss,
        llm,
        http,
        config: {},
        searchProviders: ['searxng'],
        mode: 'saas',
        breaker: new CircuitBreaker(),
        limiter: () => true,
        keyring: createKeyring(1, { 1: randomBytes(32).toString('base64') }),
        hashKey: randomBytes(32),
        platformKey: () => undefined,
        verify: { resolveMx: async (d) => (d.endsWith('example.sn') ? ['mx.' + d] : []) },
        now: () => new Date(),
      };
      await registerCampaignWorkers(deps);
      await withTenant(h.app.db, A, (tx) =>
        grantCredits(tx, {
          orgId: A.orgId,
          origin: 'trial',
          amountMc: 50_000,
          expiresAt: new Date(Date.now() + 864e5),
          ref: 'trial:test',
        }),
      );
    });
    afterAll(async () => {
      await boss.stop({ graceful: false });
      await Promise.all([h.app.close(), h.auth.close(), h.migrator.close()]);
    });

    it('interprétation → estimation → lancement → recherche → livraison → clôture et remboursement', async () => {
      const id = await newCampaign(A);
      await startInterpretation(boss, h.app.db, { ...A, campaignId: id, locale: 'fr' });
      const ready = await waitFor(async () => {
        const c = await campaign(A, id);
        return c.status === 'awaiting_confirmation' ? c : null;
      });
      expect(ready.estimate).toMatchObject({ credits: { low: 3, high: 5 } });
      expect(ready.degraded).toBe(true); // aucune clé : sources gratuites seulement

      const { reservedMc } = await launchCampaign(boss, h.app.db, {
        ...A,
        campaignId: id,
        mode: 'saas',
        plan: PLANS.research,
      });
      expect(reservedMc).toBe(5000);
      const done = await waitFor(async () => {
        const c = await campaign(A, id);
        return c.status === 'completed' ? c : null;
      });
      expect(done.deliveredCount).toBeGreaterThan(0);
      expect(done.consumedMc).toBe(done.deliveredCount * 1000);

      await withTenant(h.app.db, A, async (tx) => {
        // 50 crédits octroyés + essai de 100 crédits (une seule fois, sans abonnement)
        expect(await getCreditBalance(tx, A.orgId)).toBe(150_000 - done.consumedMc);
        const ledger = await tx.select().from(schema.creditLedger);
        expect(ledger.map((l) => l.reason).sort()).toEqual(
          expect.arrayContaining(['reserve', 'adjustment']),
        );
        const prospects = await tx
          .select()
          .from(schema.prospects)
          .where(eq(schema.prospects.campaignId, id));
        const delivered = prospects.filter((p) => p.deliveredAt);
        expect(delivered.length).toBe(done.deliveredCount);
        expect(delivered[0]!.scoreReasons).not.toEqual([]);
        const msgs = await tx.select().from(schema.messages);
        expect(msgs.length).toBe(done.deliveredCount);
        expect(msgs[0]!.footer).toContain('STOP');
        const contacts = await tx.select().from(schema.contacts);
        expect(JSON.stringify(contacts)).not.toContain('@lebaobab');
        expect((await tx.select().from(schema.evidence)).length).toBeGreaterThan(0);
        expect((await tx.select().from(schema.usageEvents)).some((u) => u.kind === 'llm')).toBe(
          true,
        );
        const events = await tx
          .select()
          .from(schema.campaignEvents)
          .where(eq(schema.campaignEvents.campaignId, id));
        expect(events.map((e) => e.type)).toEqual(
          expect.arrayContaining([
            'campaign.target_ready',
            'prospect.created',
            'message.drafted',
            'campaign.status',
          ]),
        );
      });
      // Isolation : B ne voit rien de A
      await withTenant(h.app.db, B, async (tx) => {
        expect(await tx.select().from(schema.prospects)).toHaveLength(0);
        expect(await tx.select().from(schema.campaignEvents)).toHaveLength(0);
      });
    });

    it('sans crédits : lancement refusé (402) ; annulation : remboursement intégral', async () => {
      const idB = await newCampaign(B);
      await startInterpretation(boss, h.app.db, { ...B, campaignId: idB, locale: 'fr' });
      await waitFor(async () => (await campaign(B, idB)).status === 'awaiting_confirmation');
      // B a un abonnement (donc pas d'essai) mais aucun crédit.
      await withTenant(h.app.db, B, (tx) =>
        tx.insert(schema.subscriptions).values({
          organizationId: B.orgId,
          plan: 'research',
          status: 'active',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 864e5),
          provider: 'test',
        }),
      );
      await expect(
        launchCampaign(boss, h.app.db, {
          ...B,
          campaignId: idB,
          mode: 'saas',
          plan: PLANS.research,
        }),
      ).rejects.toMatchObject({ code: 'insufficient_credits' });

      const id = await newCampaign(A, 3);
      await startInterpretation(boss, h.app.db, { ...A, campaignId: id, locale: 'fr' });
      await waitFor(async () => (await campaign(A, id)).status === 'awaiting_confirmation');
      const before = await withTenant(h.app.db, A, (tx) => getCreditBalance(tx, A.orgId));
      await launchCampaign(boss, h.app.db, {
        ...A,
        campaignId: id,
        mode: 'saas',
        plan: PLANS.research,
      });
      await cancelCampaign(boss, h.app.db, { ...A, campaignId: id });
      const c = await waitFor(async () => {
        const x = await campaign(A, id);
        return x.status === 'cancelled' ? x : null;
      });
      const after = await withTenant(h.app.db, A, (tx) => getCreditBalance(tx, A.orgId));
      expect(after).toBe(before - c.consumedMc);
    });
  },
);
