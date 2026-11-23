import http from 'node:http';
import { loadEnv, workerEnvSchema } from '@scoutra/config';
import { assertRlsEnforcedRole, createDb } from '@scoutra/db';
import { createLlmClient } from '@scoutra/ai';
import { createBoss, pingJob, work } from '@scoutra/queue';
import { createCampaignDeps, registerCampaignWorkers, startCampaignSweeper } from './campaign';
import { handlePing } from './handlers/ping';

async function main() {
  const env = loadEnv(workerEnvSchema);
  const handle = createDb(env.DATABASE_URL, { max: 10, applicationName: 'scoutra-worker' });
  const role = await assertRlsEnforcedRole(handle.pool);

  const boss = createBoss(env.DATABASE_URL, { supervise: true });
  boss.on('error', (err: Error) => console.error('[worker] erreur pg-boss :', err.message));
  await boss.start();
  await work(boss, pingJob, (payload, { jobId }) => handlePing(handle.db, payload, jobId));
  const llm = createLlmClient(env);
  const campaignDeps = createCampaignDeps({ env, db: handle.db, boss, llm });
  await registerCampaignWorkers(campaignDeps);
  const stopSweeper = startCampaignSweeper(campaignDeps);
  if (!llm.available)
    console.warn(
      '[worker] aucun modèle d’IA configuré : interprétation heuristique et messages modèles (mode dégradé)',
    );

  let healthy = true;
  const health = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res
        .writeHead(healthy ? 200 : 503, { 'content-type': 'text/plain' })
        .end(healthy ? 'ok' : 'arrêt');
      return;
    }
    res.writeHead(404).end();
  });
  health.listen(env.WORKER_HEALTH_PORT, '0.0.0.0');
  console.info(`[worker] démarré (rôle ${role}), santé sur :${env.WORKER_HEALTH_PORT}/healthz`);

  const shutdown = async (signal: string) => {
    healthy = false;
    stopSweeper();
    console.info(`[worker] ${signal} reçu, arrêt propre…`);
    await boss.stop({ graceful: true, timeout: 20_000 });
    await handle.close();
    health.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
