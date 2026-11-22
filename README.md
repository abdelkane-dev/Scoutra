# Scoutra

SaaS international de prospection multi-agents (B2B, B2C et 21 autres modèles), aussi
installable chez le client sous licence par pays. Même code pour les deux modes
(`SCOUTRA_MODE=saas|license`).

> Étape 1 (socle) : monorepo, base de données multi-locataire, authentification, file de
> tâches, sécurité, Docker, CI. L'interface est construite à l'étape suivante.
> Plan : `docs/PLAN.md` · Architecture : `docs/ARCHITECTURE.md` · Menaces : `docs/securite/threat-model.md`.

## Démarrage rapide

### Installation complète (Docker)

```bash
scripts/init-secrets.sh --url https://prospection.mondomaine.com   # crée .env (droits 600)
docker compose up -d --build                                       # postgres, migrations, worker, web
```

- Sans `.env` complet, `docker compose` refuse de démarrer ; chaque service revérifie ensuite la
  force des secrets et s'arrête s'ils sont faibles.
- Le web écoute sur `127.0.0.1:3000` : placez un reverse proxy TLS (Caddy, Traefik) devant.
- Reacher et Crawl4AI sont déclarés (profil `agents`, réseaux internes, aucun port publié) et
  serviront à l'étape 2 : `docker compose --profile agents up -d`.

### Développement local

```bash
pnpm install
scripts/init-secrets.sh --host localhost        # puis adapter NODE_ENV=development, BETTER_AUTH_URL=http://localhost:3000
# Créer les rôles et la base dans un Postgres local (17 recommandé, 15 minimum) :
#   POSTGRES_USER=postgres SCOUTRA_*_PASSWORD=… docker/postgres/init/01-roles.sh
pnpm db:migrate
pnpm dev:worker   # worker pg-boss (+ /healthz sur :8081)
pnpm dev:web      # http://localhost:3000
```

En développement, les emails (vérification, invitation) sont affichés dans la console du web.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm lint` | ESLint (règles de sécurité incluses) |
| `pnpm format:check` / `pnpm format` | Prettier |
| `pnpm typecheck` | TypeScript strict sur tous les paquets |
| `pnpm test` | Vitest : unitaires + intégration Postgres (si `TEST_DATABASE_ADMIN_URL` est défini) |
| `pnpm test:unit` / `pnpm test:integration` | Sous-ensembles |
| `pnpm build` | Build Next.js (standalone) et bundle du worker |
| `pnpm db:generate` | Nouvelle migration Drizzle (SQL relu en revue) |
| `pnpm db:migrate` | Migrations + schéma pg-boss (rôle propriétaire) |
| `pnpm license <keygen\|sign\|verify>` | Émission hors ligne des licences |

Tests d'intégration : `TEST_DATABASE_ADMIN_URL=postgres://postgres:…@localhost:5432/postgres pnpm test`
(superutilisateur d'un Postgres **jetable** : une base temporaire est créée puis supprimée).
En CI, `SCOUTRA_REQUIRE_DB_TESTS=1` rend ces tests obligatoires.

## Structure

```
apps/web        Next.js 16 : routes API, Better Auth, helpers serveur (src/server)
apps/worker     Consommateurs pg-boss, migrations, /healthz
packages/core   Référentiels métier, erreurs, garde SSRF (safeFetch)
packages/db     Schéma Drizzle, migrations SQL, RLS, withTenant(), audit, crédits
packages/crypto Chiffrement par enveloppe AES-256-GCM, empreintes HMAC
packages/license Licence Ed25519 hors ligne (kid, grâce, lecture seule)
packages/auth   Configuration Better Auth, matrice d'accès, argon2id
packages/queue  Tâches pg-boss typées (Zod)
packages/i18n   Messages FR/EN
packages/config Validation de l'environnement
tools/license-cli  Génération de clés et signature de licences
```

## Choix techniques (en bref)

- **pnpm + Turborepo** : un seul dépôt pour le web, le worker et les paquets partagés ; Turborepo
  met en cache les builds. pnpm 10 bloque les scripts d'installation des dépendances par défaut.
- **TypeScript 6.0** (et non 7.0) : typescript-eslint ne supporte pas encore la version 7.
- **Paquets en TypeScript source** : pas de build intermédiaire ; Next les compile
  (`transpilePackages`), esbuild empaquette le worker en un seul fichier.
- **Isolation multi-locataire en deux couches** : `withTenant()` fixe l'organisation dans la
  transaction (`set_config(..., true)`), et la **Row Level Security Postgres forcée** filtre chaque
  ligne. Trois rôles : `scoutra_migrator` (propriétaire, migrations seulement), `scoutra_app`
  (web + worker, sans BYPASSRLS, vérifié au démarrage), `scoutra_auth` (Better Auth, tables
  d'identité seulement, aucun accès aux données métier). Les relations critiques utilisent des
  clés étrangères composites `(organization_id, id)`.
- **Modèles de prospection et types d'entité en tables de référence** (pas d'enum Postgres) :
  ajouter un modèle = une ligne dans `@scoutra/core` + une migration d'insertion. Une table
  `playbooks` (définition déclarative versionnée) est prête pour l'étape 2.
- **Provenance par champ** (`evidence`) : source, URL, date de collecte, base légale, pays
  obligatoires ; licence et confiance optionnelles.
- **Journal d'audit et grand livre de crédits en ajout seul** : privilèges + déclencheurs.
  Débits sérialisés par verrou consultatif, idempotents.
- **Better Auth** : open source (MIT), auto-hébergeable, organisations et invitations natives.
  Mots de passe en **argon2id** (`@node-rs/argon2`, binaires précompilés sans script
  d'installation), limites de tentatives stockées en base, contrôle d'origine forcé, inscription
  fermée (premier compte ou invitation), 2FA TOTP disponible.
- **pg-boss** : file de tâches dans Postgres (pas de Redis à installer chez les clients). Le
  schéma est installé par le rôle propriétaire ; l'application ne fait aucun DDL. Chaque charge
  utile est validée par Zod (avec `organizationId`) à l'envoi **et** à la réception.
- **Garde SSRF** maison sur `node:http(s)` + `ipaddr.js` (très utilisé, MIT) : seules les IP
  publiques sont autorisées, vérifiées **au moment de la connexion** (anti DNS rebinding),
  redirections revalidées, ports 80/443, noms internes refusés.
- **Chiffrement** : `node:crypto` uniquement (AES-256-GCM, HKDF, Ed25519) : aucune dépendance
  cryptographique tierce.
- **Next.js 16** : `proxy.ts` remplace `middleware.ts` ; CSP stricte à nonce (les pages sont donc
  rendues dynamiquement).

## Sécurité et licences

- Jamais de secret dans le dépôt (`.env`, `*.key`, `*.pem` ignorés ; gitleaks en CI).
- La clé privée de licence n'est jamais écrite dans un dépôt Git (le CLI refuse).
- Code repris uniquement sous MIT/Apache-2.0. Attribution Crawl4AI : voir `NOTICE`.
