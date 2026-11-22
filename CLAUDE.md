# Scoutra — SaaS de prospection multi-agents

Statut : étape 1 (socle) livrée. Lire `docs/PLAN.md` (plan complet) et `PROGRESS.md`.

## Stack (validée)
TypeScript · Next.js (App Router) · Tailwind + shadcn/ui · motion/react · Recharts · PostgreSQL + Drizzle · pg-boss (file de tâches) · AI SDK (multi-fournisseur) · Better Auth · Reacher + Crawl4AI en conteneurs · Docker Compose.

## Commandes
- `pnpm install` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm format`
- Tests d'intégration Postgres : définir `TEST_DATABASE_ADMIN_URL` (superutilisateur d'un Postgres jetable)
- `pnpm db:generate` (migration Drizzle) · `pnpm db:migrate` (rôle propriétaire)
- `pnpm dev:web` · `pnpm dev:worker` · `docker compose up -d --build` après `scripts/init-secrets.sh`
- `pnpm license keygen|sign|verify` (clé privée hors dépôt)

## Règles du socle (à respecter)
- Données métier uniquement via `withTenant(db, { orgId, userId }, tx => …)` (`@scoutra/db`) ; RLS forcée.
- Routes API : `apiRoute()` + `requireOrgAccess(action)` (`apps/web/src/server`) ; org active issue de la session.
- Toute nouvelle table avec `organization_id` : RLS ENABLE + FORCE, politique, privilèges, ajout dans `TENANT_TABLES` (un test le vérifie).
- URL externes : `safeFetch()` (`@scoutra/core`) uniquement. Tâches : `publish()`/`work()` (`@scoutra/queue`).
- Interdits lint : `sql.raw`, `dangerouslySetInnerHTML`, import direct de `pg`/`drizzle-orm` hors `packages/db`.

## Conventions
- Même code pour le SaaS et la licence auto-hébergée (drapeau de configuration).
- Aucune aspiration de profils de particuliers ni envoi automatique de DM (voir `docs/PLAN.md` §3).
- Chaque connecteur de source déclare son statut légal et ses pays autorisés.
- Code repris uniquement sous MIT/Apache-2.0 (jamais AGPL/GPL).
- Interface en français et anglais.
