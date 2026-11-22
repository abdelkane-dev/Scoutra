# Revue de sécurité — étape 1 (socle)

Date : 22/11/2026 · Périmètre : commits f8e3ffd..00c3276 (hors docs) · Lecture seule par security-auditor.
Semgrep et gitleaks absents de l'environnement : recherches ciblées à la place (aucun `sql.raw`, `innerHTML`, `eval`, secret en dur).

**Verdict : aucun constat critique.** Points forts vérifiés : RLS FORCE sur toutes les tables, rôles sans BYPASSRLS, `withTenant` sans fuite, crypto AES-256-GCM + HKDF, licence Ed25519 canonique, garde SSRF, Docker durci, CSP à nonce.

## Constats

| # | Gravité | Où | Problème | Correctif |
|---|---|---|---|---|
| 1 | Moyenne | `packages/auth/src/auth.ts:84-87` | `trustedProviders: ['google']` désactive la vérification `email_verified` → prise de compte possible via un compte Google non vérifié | Retirer `trustedProviders` ou exiger `emailVerified` ; test |
| 2 | Moyenne | `auth.ts:129-155`, `access.ts` | Les routes Better Auth `/api/auth/organization/*` ignorent la matrice maison (un admin peut promouvoir un admin) | `createAccessControl` aligné sur la matrice ou hook `before` ; tests |
| 3 | Moyenne | `auth.ts:139-155` | `countryCode` modifiable sans validation via `organization/update` (pilote licence et connecteurs) | `beforeUpdateOrganization` : validation ISO, changement interdit ou réservé au propriétaire avec audit |
| 4 | Moyenne | `session.ts:129-159` | 2FA disponible mais jamais exigée pour les admins | Exiger la 2FA pour les actions sensibles |
| 5 | Moyenne | `auth.ts:50-58` | IP client non configurée (`trustedProxies`) → limite de connexion globale ou contournable ; pas de limite par compte | `advanced.ipAddress.trustedProxies`, limite par email, doc du proxy |
| 6 | Faible | `apps/web/src/server/db.ts:285-297` | Le pool d'auth n'est pas contrôlé (superutilisateur possible par erreur) | Vérifier aussi `scoutra_auth` |
| 7 | Faible | `packages/queue/src/boss.ts` | Tables pg-boss sans RLS ; isolation par filtre applicatif seul | Test d'isolation des tâches ; RLS ou file par org avant l'étape 2 |
| 8 | Faible | `packages/core/src/ssrf/fetch.ts` | En-têtes (dont clés) renvoyés lors d'une redirection vers un autre hôte ; pas de délai global | Retirer `authorization`/`cookie` si l'origine change ; `AbortSignal.timeout` |
| 9 | Faible | `docker/postgres/init/01-roles.sh` | Seule la longueur des mots de passe est vérifiée ; `POSTGRES_PASSWORD` non validé | Contrôle d'entropie |
| 10 | Faible | `packages/license/src/keys.ts`, `env.ts` | En licence, le client peut ajouter sa propre clé publique ou passer en mode saas | Ignorer les clés d'environnement en production licence ; documenter |
| 11 | Faible | `apps/web/src/server/license.ts` | Anti-recul d'horloge codé mais inactif | Étape 6 |
| 12 | Faible | `.github/workflows/ci.yml` | gitleaks sans `pull-requests: read` ; pas d'audit de dépendances ni d'analyse statique | Permission + `pnpm audit`, CodeQL/semgrep |
| 13 | Faible | `auth.ts:108-124` | Le premier visiteur crée le compte propriétaire | Jeton d'installation ou doc |
| 14 | Faible | `apps/web/src/server/http.ts` | `apiRoute` n'impose pas l'autorisation ; pas de limite de débit sur les routes métier | Action obligatoire ou `public: true` explicite ; limite par org |
| 15 | Faible | divers | `style-src 'unsafe-inline'`, email de prod non configuré, `NODE_ENV` par défaut development | À traiter plus tard |

## Exigences E1-E10

| Exigence | Statut |
|---|---|
| E1 Isolation RLS | Respectée (sauf file pg-boss) |
| E2 Autorisation centralisée | Partielle (2, 3, 14) |
| E3 Auth durcie | Partielle (1, 4, 5) |
| E4 Secrets | Respectée (CI à ajuster) |
| E5 SSRF + Crawl4AI isolé | Partielle (8 ; proxy filtrant à l'étape 2) |
| E6 Politique d'agents | Sans objet à l'étape 1 |
| E7 Budgets et quotas | Partielle (14) |
| E8 Sortie sûre | Partielle (CSV/Markdown sans objet encore) |
| E9 Modèle de données conforme | Respectée (3) |
| E10 Licence et chaîne de livraison | Partielle (10, 11) |

Priorité avant l'étape 2 : 1, 2, 3, 4, 5, puis 14 et 7.
