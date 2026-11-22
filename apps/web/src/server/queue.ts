import 'server-only';
import { createBoss, type Boss } from '@scoutra/queue';
import { ensureDbReady } from './db';
import { getEnv } from './env';

const g = globalThis as typeof globalThis & { __scoutraBoss?: Promise<Boss> };

/** Client pg-boss du web : publie seulement (pas de maintenance, pas de migration). */
export function getBoss(): Promise<Boss> {
  g.__scoutraBoss ??= (async () => {
    await ensureDbReady();
    const boss = createBoss(getEnv().DATABASE_URL, { supervise: false });
    boss.on('error', (e: Error) => console.error('[web] pg-boss :', e.message));
    await boss.start();
    return boss;
  })();
  return g.__scoutraBoss;
}
