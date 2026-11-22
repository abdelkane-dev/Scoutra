import { randomUUID } from 'node:crypto';
import { createDb, schema, type DbHandle } from '../src';

export function pgCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export async function expectPgError(p: Promise<unknown>, codes: string[]): Promise<void> {
  try {
    await p;
  } catch (e) {
    const code = pgCode(e);
    if (!code || !codes.includes(code)) {
      throw new Error(`Code Postgres inattendu ${code}`, { cause: e });
    }
    return;
  }
  throw new Error(`Une erreur Postgres (${codes.join('/')}) était attendue`);
}

/** Crée utilisateur + organisation + adhésion via le rôle scoutra_auth (comme Better Auth). */
export async function seedOrgAndOwner(auth: DbHandle, label: string, country = 'ML') {
  const userId = randomUUID();
  const orgId = randomUUID();
  await auth.db
    .insert(schema.users)
    .values({ id: userId, name: `Owner ${label}`, email: `${label}-${userId}@test.invalid` });
  await auth.db.insert(schema.organizations).values({
    id: orgId,
    name: `Org ${label}`,
    slug: `org-${label}-${orgId}`,
    countryCode: country,
  });
  await auth.db.insert(schema.members).values({ organizationId: orgId, userId, role: 'owner' });
  return { userId, orgId };
}

export function handles(urls: { appUrl: string; authUrl: string; migratorUrl: string }) {
  return {
    app: createDb(urls.appUrl, { max: 2 }),
    auth: createDb(urls.authUrl, { max: 2 }),
    migrator: createDb(urls.migratorUrl, { max: 1 }),
  };
}
