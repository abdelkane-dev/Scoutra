import { sql } from '@scoutra/db';
import { appDb } from '@/server/db';
import { json } from '@/server/http';

export const dynamic = 'force-dynamic';

/** Sonde de santé (Docker) : aucune information interne exposée. */
export async function GET() {
  try {
    const db = await appDb();
    await db.execute(sql`select 1`);
    return json({ status: 'ok' });
  } catch {
    return json({ status: 'unavailable' }, { status: 503 });
  }
}
