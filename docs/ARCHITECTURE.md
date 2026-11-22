# Nyini — Spécification technique (architecture)

> Statut : **proposition**, en attente de validation du plan (`docs/PLAN.md`). Aucun code applicatif.
> Date : 22/11/2026. Auteur : équipe back-end.
> Portée : structure, données, agents, orchestration, connecteurs, règles pays, facturation/licence, sécurité, tests, risques.
> Convention : **un seul code** pour SaaS et licence auto-hébergée ; le drapeau `NYINI_MODE=saas|license` change la facturation, les fournisseurs IA et la télémétrie.

---

## 1. Structure du monorepo

Gestionnaire : **pnpm workspaces** + **Turborepo** (cache des builds/tests). Node 22 LTS, TypeScript strict.

```
nyini/
├─ apps/
│  ├─ web/            Next.js App Router : pages, Route Handlers (API), Server Actions, SSE
│  └─ worker/         Processus Node séparé : consommateurs pg-boss (agents), planificateur
├─ packages/
│  ├─ db/             Schéma Drizzle, migrations SQL, politiques RLS, helpers `withTenant()`
│  ├─ core/           Types métier partagés, schémas Zod (cible, prospect, score…), erreurs
│  ├─ agents/         Un module par agent (prompt, schéma E/S, sélection de modèle, coûts)
│  ├─ ai/             Fabrique AI SDK : registre de fournisseurs, routage par « niveau », comptage tokens
│  ├─ connectors/     Interface `SourceConnector` + implémentations (Places, OSM, Crawl4AI…)
│  ├─ compliance/     Moteur de règles pays (règles en données + évaluateur pur)
│  ├─ billing/        Crédits, quotas, abonnements, adaptateurs paiement (CinetPay/PayDunya/MoR)
│  ├─ license/        Format de licence, vérification Ed25519 hors ligne, période de grâce
│  ├─ crypto/         Chiffrement par enveloppe (clés API clientes), hachage, jetons
│  ├─ auth/           Configuration Better Auth (organisations, rôles), garde-fous `requireRole()`
│  ├─ queue/          Wrapper pg-boss typé : noms de tâches, schémas de charge utile, idempotence
│  ├─ i18n/           Messages FR/EN (partagés web + rédaction)
│  ├─ ui/             (propriété front) composants shadcn/ui partagés
│  └─ config/         tsconfig, eslint, vitest de base ; lecture/validation des variables d'env (Zod)
├─ tools/
│  └─ license-cli/    CLI hors ligne pour **émettre** des licences (clé privée jamais dans le dépôt)
├─ docker/
│  ├─ compose.yml           web, worker, postgres, reacher, crawl4ai
│  ├─ compose.saas.yml      surcharges SaaS (proxy, sauvegardes, observabilité)
│  └─ compose.license.yml   surcharges licence (pas de télémétrie, clé publique embarquée)
├─ e2e/               Tests Playwright
└─ docs/
```

| Paquet | Dépend de | Règle |
|---|---|---|
| `core` | — | Pur TS, aucune E/S. |
| `db` | `core` | Seul paquet qui importe `drizzle-orm`/`pg`. |
| `compliance`, `license`, `crypto` | `core` | Logique pure, testée par propriétés. |
| `agents` | `core`, `ai`, `connectors`, `compliance`, `db` | Aucune dépendance à Next.js. |
| `apps/web` | tous sauf `agents` (n'exécute pas d'agent : il **publie** des tâches) | |
| `apps/worker` | `agents`, `queue`, `db` | Aucun rendu HTTP sauf `/healthz`. |

Séparer `web` et `worker` permet de dimensionner les agents indépendamment et d'éviter qu'un appel IA long bloque une requête HTTP.

---

## 2. Modèle de données (PostgreSQL + Drizzle)

Conventions : clés `uuid` (v7, triables), `created_at`/`updated_at timestamptz`, **`organization_id NOT NULL`** sur toute table métier, suppressions logiques uniquement là où la loi le permet (l'effacement RGPD est **physique** ou par anonymisation irréversible). Enums Postgres pour les statuts. Index composite `(organization_id, …)` en tête.

### 2.1 Comptes et accès

| Table | Colonnes clés | Notes |
|---|---|---|
| `users` | id, email (unique, citext), name, locale, email_verified_at | Gérée par Better Auth. |
| `sessions`, `accounts`, `verifications` | standard Better Auth | |
| `organizations` | id, name, slug, country_code (ISO-3166), plan, mode (`saas`/`license`), data_region, created_at | Pays d'établissement = base des règles « émetteur ». |
| `members` | id, organization_id → organizations, user_id → users, role (`owner`/`admin`/`member`/`viewer`), invited_by | Unique (organization_id, user_id). |
| `invitations` | id, organization_id, email, role, token_hash, expires_at, accepted_at | Jeton stocké haché. |

Rôles : `owner` (facturation, licence, suppression org), `admin` (membres, clés API, règles), `member` (campagnes, prospects), `viewer` (lecture seule).

### 2.2 Campagnes et cibles

| Table | Colonnes clés | Notes |
|---|---|---|
| `campaigns` | id, organization_id, created_by, name, prompt_text, status (`draft`/`interpreting`/`running`/`paused`/`cancelling`/`cancelled`/`completed`/`failed`), max_prospects, credit_budget, started_at, finished_at | |
| `target_profiles` | id, organization_id, campaign_id (1-1), version, spec jsonb (validé par `TargetSpec`), audience (`b2b`/`b2c`), countries text[], confirmed_by_user bool | Versionnée : l'utilisateur peut corriger la fiche avant lancement. |
| `campaign_runs` | id, organization_id, campaign_id, attempt, status, stats jsonb (trouvés, enrichis, vérifiés, rejetés), cost_credits, cost_tokens | Une campagne peut être relancée. |

### 2.3 Prospects, contacts, preuves

| Table | Colonnes clés | Notes |
|---|---|---|
| `prospects` | id, organization_id, campaign_id, kind (`company`/`person`), display_name, country_code, city, website_domain, category, dedupe_key (unique par org), status (`found`/`enriched`/`verified`/`scored`/`drafted`/`rejected`/`suppressed`), rejection_reason | `dedupe_key` = domaine normalisé, ou nom+ville+pays normalisés, ou `place_id`. |
| `prospect_companies` | prospect_id (PK/FK), legal_name, size_band, industry_codes text[], technologies text[], has_crm bool?, description | Uniquement si kind = company. |
| `prospect_persons` | prospect_id (PK/FK), full_name, professional_role, is_professional_public bool | Particuliers : **seulement** profils pros rendus publics volontairement (cf. PLAN §3.2). |
| `contacts` | id, organization_id, prospect_id, channel (`email`/`phone`/`whatsapp`/`website_form`/`social_page`), value_encrypted bytea, value_hash (recherche/dédoublonnage), is_role_address bool, verification_status (`unknown`/`valid`/`invalid`/`risky`/`catch_all`), verified_at | Valeurs de contact chiffrées au repos (données personnelles). |
| `sources` | id, code (ex. `google_places`), version, legal_status | Catalogue (global, pas de tenant). |
| `evidence` | id, organization_id, prospect_id, contact_id?, source_code, source_url, retrieved_at, legal_basis (`consent`/`legitimate_interest`/`public_professional`/`contract`), consent_ref?, snippet (court), raw_hash | **Obligatoire** : chaque champ issu d'une source a au moins une preuve. Exigence RGPD/APDP (traçabilité). |
| `scores` | id, organization_id, prospect_id, run_id, value smallint (0-100), reasons jsonb (liste de `{critère, poids, constat, preuve_id}`), model, scored_at | Historisé ; le dernier fait foi. |

### 2.4 Messages, pipeline, suivi (formule 2)

| Table | Colonnes clés | Notes |
|---|---|---|
| `messages` | id, organization_id, prospect_id, contact_id?, channel, language, subject?, body, compliance_footer, status (`draft`/`approved`/`copied`/`sent_manually`/`blocked`), compliance_decision_id, model | Aucun envoi automatique de DM ; email sortant éventuel = phase ultérieure. |
| `pipeline_stages` | id, organization_id, key (`new`/`contacted`/`replied`/`meeting`/`won`/`lost` + personnalisées), position, is_terminal | Valeurs par défaut créées à l'inscription. |
| `pipeline_items` | id, organization_id, prospect_id (unique), stage_id, owner_member_id, value_amount?, currency?, moved_at | |
| `follow_ups` | id, organization_id, pipeline_item_id, due_at, kind (`reminder`/`follow_up_message`), message_id?, status (`scheduled`/`done`/`skipped`/`cancelled`), pgboss_job_id | |
| `activities` | id, organization_id, prospect_id, actor_member_id?, type (`note`/`stage_change`/`message_copied`/`reply_logged`/`call`), payload jsonb, occurred_at | Historique affiché. |

### 2.5 Facturation, licence, clés

| Table | Colonnes clés | Notes |
|---|---|---|
| `subscriptions` | id, organization_id, plan (`research`/`pipeline`), status, period_start, period_end, provider (`cinetpay`/`paydunya`/`paddle`/`lemonsqueezy`), provider_ref | SaaS uniquement. |
| `credit_ledger` | id, organization_id, delta int (+/-), reason (`monthly_grant`/`purchase`/`usage`/`refund`/`adjustment`), ref_type, ref_id, idempotency_key (unique), created_at | **Grand livre en ajout seul** ; solde = somme. Pas de colonne « solde » modifiable. |
| `usage_events` | id, organization_id, run_id?, kind (`llm_tokens`/`connector_call`/`email_verify`/`crawl`), provider, units, cost_micro_usd, credits | Base du coût réel et des tableaux de bord. |
| `licenses` | id, organization_id, license_id (claim `lid`), payload jsonb, signature, valid_from, expires_at, last_verified_at, status | Mode licence uniquement. |
| `api_credentials` | id, organization_id, provider (`anthropic`/`openai`/`google_places`/`apollo`/`hunter`/`meta`…), label, ciphertext, wrapped_dek, key_version, last4, created_by, last_used_at, revoked_at | Chiffrement par enveloppe (§8). |

### 2.6 Conformité et audit

| Table | Colonnes clés | Notes |
|---|---|---|
| `country_rules` | id, country_code (ou `EU`, `ECOWAS`), version, effective_from, rules jsonb, source_refs text[] | Globale (lecture seule pour les tenants) ; surcharges par org dans `org_rule_overrides` (plus strictes uniquement). |
| `compliance_decisions` | id, organization_id, prospect_id, contact_id?, channel, rule_version, outcome (`allow`/`allow_with_conditions`/`deny`), conditions jsonb, reasons jsonb, decided_at | Rejouable : la décision cite la version de règle. |
| `suppression_list` | id, organization_id (null = global plateforme), value_hash, channel, reason (`opt_out`/`erasure`/`bounce`/`complaint`), created_at | Vérifiée **avant** toute insertion de contact et tout message. Seul un hachage est conservé. |
| `data_subject_requests` | id, organization_id, type (`erasure`/`opposition`/`access`/`rectification`), subject_identifier_hash, received_via, status, due_at, completed_at, handled_by | Délai légal suivi (`due_at`). |
| `capture_forms` / `inbound_leads` | form: id, org, slug, consent_text_version ; lead: id, org, form_id, payload chiffré, consent_at, ip_hash | Formulaire Nyini (opt-in prouvé). |
| `audit_log` | id, organization_id, actor_user_id?, actor_type (`user`/`system`/`agent`), action, target_type, target_id, ip_hash, user_agent, metadata jsonb, created_at | Ajout seul (révocation `UPDATE/DELETE` pour le rôle applicatif). |

### 2.7 Isolation multi-locataire

Deux couches, aucune ne suffit seule :

1. **Applicative** : tout accès passe par `withTenant(orgId, fn)` (paquet `db`) qui ouvre une transaction et exécute `SET LOCAL app.org_id = $1` (paramétré via `set_config`). Les dépôts n'acceptent pas de requête sans `orgId` (type obligatoire). Lint personnalisé interdisant `db.select()` brut hors de `packages/db`.
2. **Row Level Security** Postgres sur toutes les tables à `organization_id` :
   ```sql
   ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE prospects FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON prospects
     USING (organization_id = current_setting('app.org_id', true)::uuid)
     WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);
   ```
   - Rôle `nyini_app` (non propriétaire, sans `BYPASSRLS`) pour web et worker.
   - Rôle `nyini_migrator` (propriétaire) pour les migrations uniquement.
   - Rôle `nyini_system` (`BYPASSRLS`) réservé aux tâches plateforme explicites (octroi mensuel de crédits, purge) ; utilisé via un client distinct, journalisé.
   - pg-boss utilise son propre schéma `pgboss` hors RLS ; les charges utiles de tâches contiennent `organization_id`, revérifié par le worker (la tâche appartient-elle bien à une campagne de cette org ?).
3. **Tests** : suite d'intégration « tenant A ne voit jamais B » générée pour chaque table (§9).

Clés étrangères composites `(organization_id, id)` sur les relations critiques (ex. `contacts → prospects`) pour empêcher un lien inter-tenant même par erreur.

---

## 3. Contrats des agents

### 3.1 Règles communes

- Chaque agent = fonction pure côté orchestration : `run(input, ctx) → output`, `ctx` = `{ orgId, runId, ai, connectors, compliance, budget, logger, signal }`.
- Entrée et sortie validées par **Zod** (schémas dans `packages/core`). Sortie IA obtenue par **sortie structurée** (AI SDK `generateObject` / mode JSON-schema du fournisseur), puis revalidée par Zod ; échec de validation = 1 nouvel essai avec l'erreur en contexte, puis échec propre.
- **Niveaux de modèle** abstraits (paquet `ai`), résolus selon le mode :

| Niveau | Usage | SaaS (Anthropic, prix vérifiés au 03/11/2026, $/M tokens entrée/sortie) | Licence |
|---|---|---|---|
| `fast` | extraction, classement, dédoublonnage flou | `claude-haiku-5-5` (0,10 / 0,50) | modèle « petit » choisi par le client |
| `balanced` | notation expliquée, garde-fou (explication) | `claude-sonnet-5-5` (2 / 10) | modèle « moyen » du client |
| `strong` | interprétation de cible, rédaction | `claude-opus-5-5` (4 / 20), effort `medium` | modèle « fort » du client |

  Points d'attention API (Claude 5.5) : le `tool_choice` forcé (`any`/`tool`) est refusé sur Opus 5.5 et Sonnet 5.5 → utiliser la **sortie structurée** (`output_config.format`) et vérifier que le mode de l'AI SDK pour `generateObject` n'envoie pas de tool_choice forcé ; gérer `stop_reason: "refusal"` (fallback serveur activable). Ces prix et identifiants sont à **revérifier à l'implémentation** (relecture via le skill `claude-api`).
- **Maîtrise des coûts** : budget par exécution (`credit_budget` campagne) ; estimation avant appel (`countTokens`), refus si dépassement ; **mise en cache des prompts** (préfixe système + règles stables) ; entrées tronquées *proprement* (texte de site résumé par `fast` avant `strong`) ; `maxOutputTokens` explicite par agent ; option **Batches** (−50 %) pour les notations non urgentes.
- **Idempotence** : clé `sha256(agent | version_prompt | entrée_normalisée)` stockée dans `agent_cache(org_id, key, output, created_at)` ; une même tâche rejouée ne refacture ni ne réécrit. Écritures en `INSERT … ON CONFLICT DO NOTHING/UPDATE` sur clés naturelles (`dedupe_key`).
- **Reprises** : pg-boss `retryLimit` + `retryBackoff` ; erreurs classées `Retryable` (429, 5xx, réseau, délai) / `Fatal` (400, schéma invalide après nouvel essai, refus de conformité). Un échec fatal marque le prospect `rejected` avec raison, jamais la campagne entière.
- Traçabilité : chaque appel IA écrit un `usage_events` (tokens, coût, modèle) et le modèle utilisé est stocké sur l'objet produit.

### 3.2 Tableau des agents

| Agent | Entrée (Zod) | Sortie (Zod) | Niveau | Idempotence / notes |
|---|---|---|---|---|
| **Interprète** | `{ promptText: string(10..2000), uiLocale, zone: { mode: 'countries'|'world', countries?: ISO[] } }` | `TargetSpec` (ci-dessous) + `clarifyingQuestions: string[]` (max 3) + `confidence: 0..1` | `strong` | Une fois par version de fiche ; l'utilisateur confirme/corrige avant lancement. |
| **Recherche** | `{ targetSpec, connectorCode, query: ConnectorQuery, page }` | `{ candidates: RawCandidate[], nextPage? }` | aucun IA (sauf traduction de la cible en requêtes connecteur : `fast`) | Clé = connecteur + requête + page. Dédoublonnage par `dedupe_key` à l'insertion. |
| **Enrichissement** | `{ prospectId, website?, kind }` | `{ company?: CompanyFacts, person?: PersonFacts, contacts: ContactCandidate[], evidence: Evidence[] }` | `fast` (extraction depuis le markdown Crawl4AI) | Respect `robots.txt` ; max N pages/site (accueil, contact, à propos, mentions légales). |
| **Vérification** | `{ contactId }` | `{ status: 'valid'|'invalid'|'risky'|'catch_all'|'unknown', checks: { syntax, mx, smtp?, disposable, role }, checkedAt }` | aucun IA | Résultat mis en cache 30 j par `value_hash` (toutes orgs, hachage seul). Téléphones : `libphonenumber-js` (format, pays, type). |
| **Notation** | `{ prospectId, targetSpec, facts, verification }` | `{ score: int 0..100, reasons: { criterion, weight, finding, evidenceId? }[] (1..8), disqualifiers: string[] }` | `balanced` | **Score hybride** : sous-scores déterministes (correspondance pays, secteur, signaux présents, joignabilité) calculés en code + jugement IA borné (±20). Garantit reproductibilité et testabilité. |
| **Garde-fou juridique** | `{ prospect: { kind, countryCode }, contact: { channel, isRoleAddress, legalBasisAvailable }, sender: { orgCountry }, purpose: 'cold_outreach'|'follow_up' }` | `ComplianceDecision { outcome, allowedChannels, conditions: { footerTemplateId?, requireOptOutLink, retentionDays, requireConsentProof }, reasons, ruleVersion }` | **aucun IA pour décider** (moteur de règles §6) ; `fast` éventuel pour reformuler l'explication | Pur et déterministe : appelé **avant** Rédaction et avant affichage d'un canal. |
| **Rédaction** | `{ prospectId, channel, language, facts, score.reasons, decision.conditions, senderProfile: { offer, tone, signature } }` | `{ subject?: string(≤90), body: string (bornes par canal : email ≤ 1200 car., WhatsApp ≤ 700, formulaire ≤ 1000), personalizationHooks: string[], footer }` | `strong` | Refuse si `decision.outcome = deny`. Pied de page légal injecté par **code** (gabarit pays), pas par l'IA. |
| **Suivi (F2)** | `{ pipelineItemId, history: Activity[], lastMessage, daysSince }` | `{ action: 'remind'|'draft_follow_up'|'close_lost'|'wait', dueAt?, draft? }` | `fast` (décision) / `strong` (brouillon) | Planifié via pg-boss `sendAfter` ; annulé si réponse enregistrée ou opposition. Nombre max de relances par règle pays. |

`TargetSpec` (extrait) :
```ts
TargetSpec = z.object({
  audience: z.enum(['b2b', 'b2c']),
  summary: z.string().max(300),
  countries: z.array(IsoCountry).min(1).or(z.literal('WORLD')),
  regions: z.array(z.string()).max(20).default([]),       // villes, régions
  sectors: z.array(z.object({ label: z.string(), naics: z.string().optional() })).max(15),
  roles: z.array(z.string()).max(15),                     // décideurs ciblés (B2B) / professions (B2C pro)
  companySize: z.object({ min: z.number().int().optional(), max: z.number().int().optional() }).optional(),
  signals: z.array(z.object({ key: z.string(), description: z.string(), required: z.boolean() })).max(10),
  exclusions: z.array(z.string()).max(20),
  languages: z.array(Bcp47).max(5),
});
```

Agent B2C « Où est mon audience » (étape 4) : sortie = **lieux** (groupes publics, pages, chaînes, événements) avec justification ; jamais de liste de personnes.

---

## 4. Orchestration (pg-boss)

### 4.1 Graphe des tâches

```
campaign.start
  └─► agent.interpret ──(fiche confirmée par l'utilisateur)──► campaign.plan
        campaign.plan : 1 tâche search.page par (connecteur × pays × requête)
          └─► search.page ──► (N prospects insérés) ──► enrich.prospect  [fan-out]
                 enrich.prospect ──► verify.contact (par contact) [fan-out]
                 verify.* terminés ──► score.prospect
                 score ≥ seuil ──► comply.check ──► draft.message (par canal autorisé)
          search.page peut publier search.page suivante (pagination) tant que quota non atteint
campaign.finalize (déclenchée quand compteurs « en attente » = 0, ou quota atteint)
followup.tick (cron 15 min) ──► followup.evaluate (par élément dû)
billing.monthly_grant (cron), purge.retention (cron quotidien), dsr.process
```

- Coordination par **compteurs** en base (`campaign_runs.stats.pending`) décrémentés en transaction, plutôt que par attente active.
- Chaque tâche : `singletonKey` = clé d'idempotence (évite les doublons en file), `expireInSeconds` adapté (crawl 120 s, IA 180 s).
- Charges utiles : uniquement des identifiants + `organization_id` + `runId` (pas de données personnelles dans la file).

### 4.2 Parallélisme et limites de débit

| Ressource | Mécanisme | Valeur initiale (à régler) |
|---|---|---|
| Workers par file | `teamSize`/`batchSize` pg-boss par nom de file | interpret 2, search 4, enrich 8, verify 4, score 8, draft 4 |
| Par organisation | sémaphore Postgres (`pg_try_advisory_xact_lock` + compteur) | max 10 tâches actives/org (équité multi-tenant) |
| Par fournisseur | **seau à jetons** en table `rate_buckets(provider, scope, tokens, refilled_at)` mis à jour par `UPDATE … RETURNING` atomique ; scope = `global` (clé plateforme) ou `org:<id>` (clé client) | Google Places : selon quota projet ; Reacher : 1 req/s par domaine cible ; Crawl4AI : 4 crawls concurrents, 1 req/s par domaine ; Anthropic : suivi des en-têtes de limite, repli sur 429 `retry-after` |
| Échec fournisseur | disjoncteur (5 erreurs/60 s → pause 2 min du connecteur) | |

Une tâche sans jeton disponible est replanifiée (`sendAfter` + gigue) et non marquée en échec.

### 4.3 Diffusion en direct (SSE)

- Route `GET /api/campaigns/:id/stream` (Route Handler Next.js, runtime Node) → `text/event-stream`.
- Source des événements : le worker écrit en table `campaign_events(id bigserial, org_id, campaign_id, type, payload, created_at)` puis `pg_notify('campaign_<id>', id)`.
- Le serveur web écoute `LISTEN` (une connexion dédiée partagée, multiplexée par campagne), relit les lignes par id et pousse `event: prospect.updated` etc.
- Reprise après coupure : en-tête `Last-Event-ID` → relecture depuis la table (rétention 7 j). Repli automatique en *polling* toutes les 5 s si SSE indisponible (proxy, réseau mobile lent).
- Contrôle d'accès vérifié à l'ouverture (membre de l'org, campagne de l'org) ; battement de cœur toutes les 20 s.
- Événements : `run.status`, `prospect.created`, `prospect.updated` (statut, score), `message.drafted`, `usage.updated`, `error`.

### 4.4 Annulation

1. `POST /api/campaigns/:id/cancel` → statut `cancelling` (transaction) + événement.
2. Les tâches en file : `boss.cancel()` par lot sur les tâches portant `runId` (indexées via `singletonKey` préfixé ou table `run_jobs`).
3. Tâches en cours : chaque agent vérifie `isCancelled(runId)` (cache 2 s) avant chaque appel externe et passe un `AbortSignal` aux appels IA/HTTP.
4. Aucune facturation des tâches non démarrées ; les crédits réservés non consommés sont **rendus** (écriture `refund` dans le grand livre).
5. Statut final `cancelled` quand le compteur « en cours » atteint 0. Les prospects déjà trouvés sont conservés.

Pause/reprise : même mécanisme, sans purge de la file (tâches replanifiées).

---

## 5. Connecteurs de sources

### 5.1 Interface commune

```ts
interface SourceConnector {
  manifest: {
    code: string;                         // 'google_places'
    name: { fr: string; en: string };
    version: string;
    prospectKinds: ('company' | 'person')[];
    countries: IsoCountry[] | 'WORLD';
    legalStatus: 'official_api' | 'open_data' | 'public_web' | 'opt_in' | 'first_party';
    defaultLegalBasis: LegalBasis;        // repris dans `evidence`
    licenseNotice?: string;               // ex. attribution ODbL
    cost: { unit: 'request' | 'result'; microUsd: number; credits: number };
    requiresKey: null | { provider: string; scope: 'platform' | 'customer' | 'either' };
    rateLimit: { perSecond: number; perDay?: number };
    availableIn: ('saas' | 'license')[];
  };
  buildQueries(spec: TargetSpec): ConnectorQuery[];           // pur, testable
  search(q: ConnectorQuery, ctx: ConnectorCtx): Promise<{ candidates: RawCandidate[]; nextPage?: string }>;
  healthCheck(ctx): Promise<'ok' | 'degraded' | 'down'>;
}
```

Registre : `connectors/registry.ts`. Le planificateur ne retient un connecteur que si `audience`, pays, mode et présence de clé sont compatibles **et** si le moteur de règles l'autorise pour ce pays.

### 5.2 Liste initiale

| Connecteur | Types | Pays | Statut légal | Coût | Clé |
|---|---|---|---|---|---|
| Google Places API (New) — Text Search / Place Details | company | monde | `official_api` (conditions Google : affichage, durée de cache limitée des données) | payant par requête (SKU selon champs demandés) | plateforme (SaaS) / client (licence) |
| OpenStreetMap / Overpass | company | monde (couverture variable en Afrique) | `open_data` (ODbL : attribution, partage à l'identique de la base dérivée à étudier) | gratuit ; instance publique limitée → instance dédiée recommandée | non |
| Recherche web (API de moteur : Brave Search / SerpAPI / Bing selon dispo) | company, person (pro) | monde | `official_api` | payant par requête | plateforme ou client |
| Sites web via Crawl4AI | company, person (pro) | monde | `public_web` (respect `robots.txt`, pages publiques, pas de contournement d'authentification) | coût serveur | non |
| Apollo | company, person (pro) | monde | `official_api` (contrat du client) | crédits Apollo du client | **client** |
| Hunter | company (emails de domaine) | monde | `official_api` | crédits Hunter du client | **client** |
| Meta Lead Ads (Graph API, webhook `leadgen`) | person | monde | `opt_in` (consentement recueilli par le formulaire Meta) | gratuit (hors publicité) | client (jeton de page, app Meta validée) |
| Formulaire de capture Nyini | person, company | monde | `first_party` (consentement horodaté, texte versionné) | gratuit | non |

### 5.3 Interdits explicites (non négociables, vérifiés en revue de code)

- Aucune aspiration de profils de réseaux sociaux (LinkedIn, Facebook, Instagram, TikTok, X), ni via navigateur automatisé, ni via services tiers d'aspiration.
- Aucun envoi automatique de messages privés (DM) sur une plateforme ; aucun pilotage de compte utilisateur.
- Aucun outil OSINT de corrélation d'identité (pseudo → comptes).
- Aucune aspiration de Google Maps (API officielle uniquement).
- Aucun achat/import de fichiers de particuliers sans preuve de consentement.
- Garde-fou technique : la liste blanche des connecteurs est **compilée** (pas de chargement dynamique de connecteurs tiers en SaaS) ; Crawl4AI configuré avec une liste noire de domaines (réseaux sociaux, places de marché de données).

---

## 6. Moteur de règles par pays

### 6.1 Format

Règles en **données versionnées** (fichiers YAML dans `packages/compliance/rules/`, chargés en `country_rules` à la migration), évaluateur pur en TS. Résolution : pays du destinataire + bloc régional (UE, CEDEAO) + pays de l'émetteur → règle **la plus stricte** l'emporte.

```yaml
jurisdiction: EU            # ou code ISO
version: 2026-11-01
inherits: []
sources: ["RGPD art. 6, 21", "Directive 2002/58/CE art. 13"]
rules:
  - id: eu-b2c-email
    when: { audience: person, channel: [email, sms, whatsapp] }
    outcome: deny_unless
    unless: { legalBasis: consent, consentProof: true }
  - id: eu-b2b-email
    when: { audience: company, channel: email }
    outcome: allow_with_conditions
    conditions: { legalBasis: legitimate_interest, requireOptOutLink: true,
                  footer: eu_information_notice, preferRoleAddress: false }
  - id: eu-retention
    applies: always
    conditions: { retentionDays: 1095, inactiveProspectPurgeDays: 1095 }
  - id: eu-max-followups
    when: { purpose: follow_up }
    conditions: { maxFollowUps: 2 }
```

Évaluation : `evaluate(context, ruleset) → ComplianceDecision` (pure, déterministe, `ruleVersion` incluse). Absence de règle pour un pays → **règle par défaut prudente** (B2C : consentement requis ; B2B : opt-out + information) et avertissement « pays non couvert juridiquement ».

### 6.2 Exemples initiaux (à faire valider par un juriste)

| Juridiction | B2B email | B2C email/SMS | Appels / WhatsApp | Obligations communes |
|---|---|---|---|---|
| **UE (RGPD + ePrivacy)** | intérêt légitime + information + opposition simple | **consentement préalable** | consentement (WhatsApp : opt-in Meta) | mention d'information, registre, conservation limitée (proposition : 3 ans d'inactivité) |
| **Royaume-Uni (UK GDPR + PECR)** | autorisé vers « corporate subscribers » avec opt-out ; travailleurs indépendants/sociétés de personnes = traités comme particuliers | consentement (exception « soft opt-in » clients existants uniquement) | vérification TPS/CTPS pour appels | identification de l'expéditeur, opt-out |
| **Canada (LCAP/CASL)** | **consentement exprès ou tacite** (ex. adresse publiée sans mention de refus + lien avec la fonction) | consentement exprès | — | identification, mécanisme de désabonnement traité sous 10 jours ouvrables |
| **États-Unis (CAN-SPAM ; TCPA)** | autorisé avec opt-out | email : opt-out ; **SMS/appels automatisés : consentement écrit préalable (TCPA)** → canal SMS bloqué par défaut | idem | adresse postale physique, objet non trompeur, opt-out traité sous 10 jours |
| **Mali (loi n°2013-015, mod. 2017-070, APDP)** | base légale + information ; déclaration du traitement à l'APDP | consentement recommandé par défaut (prospection directe) | consentement | droit d'opposition, déclaration APDP, sécurité ; transferts hors Mali encadrés |
| **CEDEAO (Acte additionnel A/SA.1/01/10)** — règle régionale par défaut pour SN, CI, BF, etc., surchargée par les lois nationales | information + opposition | consentement | consentement | autorité nationale à déclarer |

Le garde-fou est appliqué à trois moments : sélection des connecteurs (planification), affichage des canaux proposés, et avant rédaction/copie d'un message. Chaque décision est stockée (`compliance_decisions`).

---

## 7. Facturation et licence

### 7.1 Crédits et quotas (SaaS)

| Élément | Formule 1 — Recherche | Formule 2 — Pipeline |
|---|---|---|
| Octroi mensuel (proposition) | 500 crédits | 2 000 crédits |
| Report | non (expire en fin de période) | non |
| Packs supplémentaires | oui | oui |
| Utilisateurs | 1 | 3 (puis par siège) |
| Fonctions | recherche → message, export | + pipeline, relances, tableaux de bord |

Barème indicatif (à calibrer sur les coûts réels mesurés dans `usage_events`) : prospect trouvé 1 crédit, enrichi +1, email vérifié +1, message rédigé +1. Règle : **prix en crédits ≥ 2× le coût marginal** constaté.

Mécanique :
- **Réservation** au lancement (`credit_ledger` delta négatif `reserve`, montant = budget campagne), **ajustement** à la fin (`refund` du non-consommé). Empêche le dépassement en parallèle.
- Vérification du solde par `SELECT … FOR UPDATE` sur une ligne de verrou par org ou `pg_advisory_xact_lock(org)`.
- Toutes les écritures portent une `idempotency_key` unique (webhooks de paiement rejoués sans double crédit).
- Fonctions F2 protégées par `requireFeature('pipeline')` côté serveur (pas seulement masquées à l'écran).
- Webhooks de paiement : vérification de signature du fournisseur, horodatage, idempotence, journal d'audit.

### 7.2 Licence par pays (auto-hébergée)

Format : jeton compact `base64url(payload) + "." + base64url(signature)`, signature **Ed25519** (bibliothèque `@noble/ed25519` ou `node:crypto`).

```json
{
  "v": 1,
  "lid": "lic_01J…",
  "org": "Société cliente SARL",
  "orgId": "uuid",
  "country": "SN",
  "maxUsers": 25,
  "features": ["research", "pipeline", "byo_keys"],
  "iat": 1795000000,
  "nbf": 1795000000,
  "exp": 1826536000,
  "graceDays": 30,
  "kid": "2026-01"
}
```

- Clé **publique** embarquée dans l'image (`packages/license/keys/<kid>.pub`), plusieurs `kid` acceptés pour la rotation. Clé **privée** uniquement sur un poste hors ligne / HSM, utilisée par `tools/license-cli` ; jamais dans le dépôt ni en CI.
- Vérification hors ligne au démarrage et toutes les 6 h : signature, `nbf`, `exp`, `country` = pays de l'organisation, nombre de membres actifs ≤ `maxUsers`.
- **Période de grâce** : de `exp` à `exp + graceDays` → bannière d'alerte, tout fonctionne ; après → mode **lecture seule** (consultation, export, effacement RGPD toujours possibles ; nouvelles campagnes bloquées). Jamais de suppression de données.
- Anti-retour en arrière d'horloge : mémoriser `max(last_seen_time)` en base ; si l'horloge recule de plus de 24 h, alerte et calcul sur la date mémorisée.
- Révocation : liste de révocation signée optionnelle, importable manuellement (pas d'appel réseau obligatoire).
- Mode licence : facturation par crédits désactivée (illimité), clés IA/API **du client** obligatoires (`api_credentials`), télémétrie désactivée par défaut.

---

## 8. Sécurité

| Sujet | Mesure |
|---|---|
| Clés API clientes | **Chiffrement par enveloppe** : une DEK aléatoire (32 o) par secret, chiffrement AES-256-GCM (IV 12 o, AAD = `organization_id|provider|credential_id`) ; DEK chiffrée par la **KEK** dérivée de `NYINI_MASTER_KEY` (variable d'environnement, 32 o base64, HKDF-SHA256 avec `key_version`). Rotation : nouvelle version de KEK, re-chiffrement des seules DEK. Déchiffrement uniquement dans le worker au moment de l'appel ; jamais renvoyé au navigateur (on n'affiche que `last4`). Option KMS (AWS/GCP/Vault) derrière la même interface. |
| Données de contact | Valeurs chiffrées (même mécanisme, DEK par org) + `value_hash` = HMAC-SHA256 avec clé dédiée (`NYINI_HASH_KEY`) pour recherche et liste d'opposition. |
| Secrets | Jamais en dur ; schéma Zod de l'environnement au démarrage (refus de démarrer si manquant ou trop court) ; `.env.example` sans valeurs ; détection de secrets en CI (gitleaks). |
| Validation des entrées | Zod sur chaque Route Handler / Server Action (corps, paramètres, requête) ; tailles maximales ; normalisation des domaines/emails ; SQL via Drizzle uniquement (paramétré), aucune concaténation. |
| Contrôle d'accès | Middleware par route : `requireSession` → `requireMember(orgId)` → `requireRole(min)` → `requireFeature(f)` ; l'`orgId` vient de la session/URL et est revérifié contre l'appartenance, jamais pris aveuglément du corps. Matrice rôle × action testée. RLS en seconde barrière. |
| Contenu tiers dans les prompts | Le texte des sites web est **non fiable** (injection de prompt) : encadré comme données, aucun outil à effets de bord donné aux agents qui lisent du contenu externe, sorties toujours validées par schéma, liens/URL produits revérifiés. |
| SSRF (Crawl4AI, URL fournies) | Résolution DNS puis refus des IP privées/locales/métadonnées cloud ; Crawl4AI dans un réseau Docker sans accès à Postgres ; délais et taille maximale de page. |
| Journal d'audit | Connexions, changements de rôle, création/révocation de clés, exports, effacements, changements de règles, licences, annulations ; ajout seul ; IP hachée. |
| Anti-abus | Limites par IP et par utilisateur (inscription, connexion, création de campagne, export) ; plafond quotidien de prospects par org ; détection de motifs de spam (volume de messages copiés anormal) ; politique d'usage acceptable acceptée et horodatée ; CAPTCHA sur le formulaire de capture. |
| Sessions | Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, rotation ; CSRF géré par Better Auth + vérification d'origine sur les mutations ; en-têtes CSP stricte, HSTS. |
| Effacement / opposition | `dsr.process` : suppression physique prospect + contacts + preuves + messages, ajout du hachage à `suppression_list`, trace minimale dans `data_subject_requests` (sans donnée en clair). Purge de rétention quotidienne selon règles pays. |
| Dépendances | Audit supply-chain à chaque ajout ; images Docker épinglées par digest ; Reacher et Crawl4AI sans exposition publique. |

---

## 9. Stratégie de tests

| Niveau | Outil | Cible |
|---|---|---|
| Unitaires | Vitest | schémas Zod, normaliseurs, construction de requêtes connecteurs, gabarits de pied de page, crypto (vecteurs connus). |
| Propriétés | fast-check | `normalizeDomain`/`dedupeKey` (idempotence, stabilité), score (toujours 0-100, monotone vis-à-vis des signaux requis, déterministe), moteur de règles (la règle la plus stricte gagne ; jamais `allow` B2C UE sans consentement), licence (toute altération d'un octet → rejet ; aller-retour encode/decode), chiffrement (aller-retour, AAD différente → échec), grand livre (solde = somme, jamais négatif après réservation). |
| Intégration | Vitest + Postgres réel (Testcontainers ou service CI) | migrations, **isolation RLS** (test généré pour chaque table : tenant A ne lit/écrit pas B, y compris sans `app.org_id` → 0 ligne), pg-boss (idempotence, annulation, reprises), SSE (reprise `Last-Event-ID`). |
| Agents | Vitest + fournisseur IA simulé (`MockLanguageModel` de l'AI SDK) + jeux de réponses enregistrées | contrat E/S, gestion des sorties invalides, refus, budget. Évaluations réelles (coûteuses) hors CI, déclenchées manuellement. |
| Connecteurs | serveurs HTTP simulés (MSW) + fixtures enregistrées | pagination, erreurs 429/5xx, disjoncteur. |
| E2E | Playwright (Compose complet, IA simulée) | inscription → org → campagne → prospects en direct → message copié ; annulation ; effacement ; mode licence expirée → lecture seule ; mobile (viewport) et sans JS pour les pages de contenu. |
| Sécurité | semgrep, gitleaks, tests d'accès par rôle | en CI ; tests d'attaque uniquement sur localhost. |

Commandes prévues (racine) :

```
pnpm install
pnpm dev                 # web + worker + services Docker
pnpm typecheck           # turbo run typecheck
pnpm lint
pnpm test                # unitaires + propriétés
pnpm test:integration    # nécessite Postgres (docker compose up -d postgres)
pnpm test:e2e            # Playwright, Compose complet
pnpm db:generate         # drizzle-kit generate (migration SQL relue en revue)
pnpm db:migrate
docker compose -f docker/compose.yml up -d
```

---

## 10. Risques techniques et questions ouvertes

### 10.1 Risques

| # | Risque | Impact | Atténuation |
|---|---|---|---|
| R1 | **Port 25 sortant bloqué** chez la plupart des hébergeurs → Reacher ne fait pas la vérif SMTP | Vérification dégradée (syntaxe + MX seulement) | VPS autorisant le port 25, ou proxy SOCKS Reacher, ou API de vérification tierce (clé) ; statut `unknown` assumé. Réputation IP à surveiller (listes noires). |
| R2 | Couverture faible des sources en Afrique de l'Ouest (Places, OSM) | Peu de résultats au Mali/Sénégal | Combiner sources, recherche web, registres publics nationaux (à inventorier), formulaire de capture. |
| R3 | Coût Google Places et IA par prospect supérieur au prix en crédits | Marge négative | Mesure `usage_events` dès l'étape 2, champs Places minimaux, niveau `fast` par défaut, cache, budget par campagne. |
| R4 | Conditions Google Places : limites de stockage/caching des données | Non-conformité contractuelle | Ne stocker que `place_id` + données autorisées ; rafraîchissement ; revue juridique. |
| R5 | Compatibilité de l'AI SDK avec les contraintes Claude 5.5 (pas de `tool_choice` forcé, refus) et avec les fournisseurs clients hétérogènes en licence | Sorties structurées en échec | Test de contrat par fournisseur ; repli « JSON en texte + validation Zod » ; liste de modèles supportés publiée. |
| R6 | pg-boss sous forte charge (fan-out de milliers de tâches) | Latence, verrous | Lots (`insert` groupé), index, partitionnement par file ; seuil de passage à une file dédiée documenté. |
| R7 | RLS mal configurée (rôle propriétaire, `FORCE` oublié, pool qui garde `app.org_id`) | Fuite inter-tenant | `SET LOCAL` uniquement en transaction, rôle non propriétaire, tests générés par table, revue sécurité dédiée. |
| R8 | Injection de prompt via sites crawlés | Messages/notes manipulés | Pas d'outils à effets de bord, validation de schéma, revue humaine avant envoi (déjà imposée : envoi manuel). |
| R9 | Licence contournée en auto-hébergé (code modifiable) | Perte de revenus | Accepté partiellement : dissuasion contractuelle + code compilé/obfusqué optionnel ; ne pas sur-investir. |
| R10 | Erreur juridique dans les règles pays | Responsabilité | Règles versionnées, sources citées, validation juriste avant lancement, défaut prudent. |
| R11 | SSE derrière proxys/mobiles lents | Mise à jour en direct cassée | Reprise par `Last-Event-ID`, repli polling, battements. |
| R12 | Paiement (Mali, Stripe indisponible) | Lancement bloqué | Abstraction `PaymentProvider` ; dépend de la création de la structure (PLAN §3.5). |

### 10.2 Questions ouvertes

1. **Hébergement SaaS** : quel fournisseur/région (UE pour clients européens ? Afrique ?) et autorise-t-il le port 25 sortant ? Une seule région au départ ?
2. **Fournisseur de recherche web** : Brave Search, SerpAPI, Bing (fin d'API ?) ou autre — coût et conditions à comparer.
3. **Instance Overpass** : publique (limitée) ou dédiée (coût serveur, import des extraits Afrique) ?
4. **Registres publics d'entreprises** par pays prioritaire (Mali, Sénégal, Côte d'Ivoire, France) : lesquels ont une API ou des données ouvertes réutilisables ?
5. **Barème de crédits** et octrois mensuels : à fixer après mesure des coûts réels de l'étape 2.
6. **Envoi d'emails par Nyini** (SMTP/API du client) : hors périmètre v1 (copier-coller) ou prévu en formule 2 ? Impacte délivrabilité, désinscription automatisée et responsabilité.
7. **Modèles IA en licence** : liste minimale de fournisseurs supportés et testés (Anthropic, OpenAI, Mistral, modèles locaux via Ollama ?).
8. **RLS dès l'étape 1** (recommandé) ou seulement filtrage applicatif au départ ?
9. **Rétention par défaut** et durée de conservation des preuves après effacement d'un prospect (seul le hachage d'opposition est conservé ?) — à valider par un juriste.
10. **Licence** : rattachement à un nom de domaine/instance en plus du pays ? Liste de révocation nécessaire ?
11. **Données de contact chiffrées** : accepte-t-on la perte de recherche plein texte sur emails/téléphones (recherche par hachage exact seulement) ?
12. **Meta Lead Ads** : qui porte l'app Meta (Nyini en SaaS, le client en licence) et la vérification d'entreprise Meta ?
