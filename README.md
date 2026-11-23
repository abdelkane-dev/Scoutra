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

| Commande                                   | Rôle                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `pnpm lint`                                | ESLint (règles de sécurité incluses)                                                |
| `pnpm format:check` / `pnpm format`        | Prettier                                                                            |
| `pnpm typecheck`                           | TypeScript strict sur tous les paquets                                              |
| `pnpm test`                                | Vitest : unitaires + intégration Postgres (si `TEST_DATABASE_ADMIN_URL` est défini) |
| `pnpm test:unit` / `pnpm test:integration` | Sous-ensembles                                                                      |
| `pnpm build`                               | Build Next.js (standalone) et bundle du worker                                      |
| `pnpm db:generate`                         | Nouvelle migration Drizzle (SQL relu en revue)                                      |
| `pnpm db:migrate`                          | Migrations + schéma pg-boss (rôle propriétaire)                                     |
| `pnpm license <keygen\|sign\|verify>`      | Émission hors ligne des licences                                                    |

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
- **File pg-boss et isolation (décision de l'étape 2, constat 7 de la revue)** : les tables
  pg-boss n'ont pas de RLS. Option retenue, la plus simple et sûre sans fork de pg-boss : chaque
  tâche MÉTIER porte `organizationId` + `trackingId` validés par Zod à l'envoi et à la réception ;
  une ligne `tenant_jobs` (RLS FORCE) est créée dans l'organisation avant l'envoi ; le worker
  rouvre `withTenant` et **refuse** une tâche dont le suivi n'existe pas dans cette organisation ;
  l'état et l'annulation passent **uniquement** par `tenant_jobs` (`getTenantJob`,
  `cancelTenantJobs`), jamais par une lecture directe de pg-boss. Charges utiles = identifiants
  seulement (aucune donnée personnelle dans la file). Test d'isolation :
  `packages/queue/test/tenant-jobs.int.test.ts`. Écartées : une file par organisation (milliers
  de files, DDL à l'exécution) et la RLS sur le schéma pg-boss (non supportée, casse la
  maintenance).
- **Garde SSRF** maison sur `node:http(s)` + `ipaddr.js` (très utilisé, MIT) : seules les IP
  publiques sont autorisées, vérifiées **au moment de la connexion** (anti DNS rebinding),
  redirections revalidées, ports 80/443, noms internes refusés.
- **Chiffrement** : `node:crypto` uniquement (AES-256-GCM, HKDF, Ed25519) : aucune dépendance
  cryptographique tierce.
- **Next.js 16** : `proxy.ts` remplace `middleware.ts` ; CSP stricte à nonce (les pages sont donc
  rendues dynamiquement).

## Cerveau de recherche (étape 2)

```
packages/connectors  Sources (manifeste légal, disjoncteur, sélection, mode dégradé)
packages/agents      Interprète, Recherche, Enrichissement, Vérification, Notation, Rédaction, playbooks
packages/ai          Niveaux de modèle fast / balanced / strong (Anthropic ou modèles du client)
packages/compliance  Règles pays en YAML versionné → évaluateur déterministe
packages/billing     Barème unique, estimation, garde-fou de coût, interface de paiement abstraite
```

- **Sans aucune clé**, tout fonctionne en **mode dégradé explicite** : OpenStreetMap, registres
  publics (France, Royaume-Uni avec clé gratuite), crt.sh, SearXNG si configuré ; interprétation
  heuristique et messages modèles sans IA. L'interface l'affiche (`degraded`, raisons
  d'exclusion des sources). Rien n'est inventé : sans source, 0 prospect, 0 débit.
- **Claude** via le SDK officiel `@anthropic-ai/sdk` (sorties structurées `output_config.format`,
  effort explicite, cache du préfixe) ; **modèles du client** (licence) via l'AI SDK
  (`@ai-sdk/openai-compatible`). Rédaction par défaut sur `fast` + effort `low`.
- **Garde-fou juridique** : `packages/compliance/rules/*.yaml` (à faire valider par un juriste),
  compilé par `pnpm --filter @scoutra/compliance rules` ; un test vérifie la synchronisation.
- **Crédits** : millicrédits entiers, portefeuilles FIFO par expiration, réservation au lancement,
  débit par prospect livré (idempotent), remboursement du reste ; coût réel journalisé
  (`usage_events`) et garde-fou par organisation (70 % : sources et modèles les moins chers).
- **Suivi en direct** : SSE par relecture de `campaign_events` sous RLS (reprise `Last-Event-ID`) ;
  un `pg_notify` est déjà émis pour passer plus tard à `LISTEN`.
- Limites connues (v1) : limites de débit par fournisseur en mémoire du worker ; Crawl4AI non
  branché tant que le proxy de sortie filtrant (E5) n'existe pas (lecture de site par safeFetch) ;
  safeFetch ne passe pas par un proxy HTTP sortant.

## Mise en production (à lire)

1. **Premier compte = propriétaire de l'installation.** L'inscription est fermée : seul le
   tout premier compte peut s'inscrire sans invitation. Le web n'écoute que sur
   `127.0.0.1:3000` : créez ce compte **avant** d'ouvrir l'accès public, par exemple via un
   tunnel SSH (`ssh -L 3000:127.0.0.1:3000 serveur`), puis configurez le reverse proxy.
2. **Reverse proxy et IP client.** Les limites de tentatives dépendent de l'IP du client. Le
   proxy doit **écraser** l'en-tête d'IP envoyé par le client (Caddy et Traefik le font pour
   `X-Forwarded-For` ; Cloudflare : `CF-Connecting-IP`). Réglez `SCOUTRA_CLIENT_IP_HEADER`
   (défaut `x-forwarded-for`) et `SCOUTRA_TRUSTED_PROXIES` (IP/CIDR du proxy, ex.
   `172.18.0.0/16` pour un proxy dans le réseau Docker). Une limite de 10 tentatives par email
   et par 15 minutes s'applique en plus, quelle que soit l'IP.
3. **Rôles et 2FA.** Rôles d'organisation : `owner`, `admin`, `manager` (chef d'équipe),
   `member` (membre / commercial : ses propres recherches et prospects), `viewer` (lecture seule),
   `billing` (facturation et crédits). Matrice unique à refus par défaut :
   `packages/auth/src/access.ts` ; `GET /api/me` renvoie les permissions effectives. Toute
   personne qui effectue une action sensible (invitations, rôles, clés API, intégrations, export,
   facturation, licence, conformité, audit) doit avoir activé la 2FA : l'API répond
   `403 two_factor_required`. `SCOUTRA_ENFORCE_ADMIN_2FA=false` est réservé à la recette.
4. **Pays d'établissement.** Il est choisi à la création de l'organisation et n'est plus
   modifiable par l'interface (il pilote la licence et les règles juridiques).
5. **Mode licence.** En production, `SCOUTRA_LICENSE_PUBLIC_KEYS` est ignorée : seules les clés
   publiques embarquées dans l'image valident une licence. La vérification hors ligne dissuade
   mais n'est pas inviolable chez un client qui modifie le code : le contrat fait foi.

## Sécurité et licences

- Jamais de secret dans le dépôt (`.env`, `*.key`, `*.pem` ignorés ; gitleaks en CI).
- La clé privée de licence n'est jamais écrite dans un dépôt Git (le CLI refuse).
- Code repris uniquement sous MIT/Apache-2.0. Attribution Crawl4AI : voir `NOTICE`.
