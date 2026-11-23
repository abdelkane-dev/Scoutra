# Scoutra — contrat de l'API (pour l'interface)

Toutes les routes sont sous `/api`, en JSON, avec la session Better Auth (cookie HttpOnly).
L'organisation est TOUJOURS l'organisation active de la session (jamais un paramètre).

## Conventions communes

- **Erreurs** : `{"error": {"code": "...", "message": "texte traduit"}}` (+ `issues` pour
  `invalid_input`). Codes : `unauthenticated` 401, `forbidden` 403, `two_factor_required` 403,
  `not_found` 404, `invalid_input` 400, `conflict` 409, `insufficient_credits` 402,
  `quota_exceeded` 429, `rate_limited` 429, `read_only` 423 (licence en lecture seule),
  `internal` 500.
- **Mutations** (POST/PUT/PATCH/DELETE) : en-tête `Origin` de l'application obligatoire
  (le navigateur l'envoie) et `Content-Type: application/json`, corps ≤ 64 Ko.
- **Permissions** : l'interface masque ce que `GET /api/me` ne liste pas dans
  `organization.permissions`, mais le serveur revérifie toujours.
- Dates en ISO 8601 UTC ; identifiants en UUID.

## Session, rôles, profil

### `GET /api/me`

```json
{
  "user": {
    "id": "uuid",
    "email": "a@b.c",
    "name": "Awa",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "platformOperator": false
  },
  "mode": "saas",
  "organization": {
    "id": "uuid",
    "role": "manager",
    "countryCode": "SN",
    "accountType": "sme",
    "sectors": ["f_construction"],
    "onboardingComplete": true,
    "permissions": ["org:read", "campaign:write", "..."],
    "twoFactorRequiredFor": ["prospect:export"],
    "dataScope": "team",
    "license": { "mode": "saas", "status": "valid" }
  }
}
```

- `organization` vaut `null` sans organisation active.
- Rôles : `owner` (Propriétaire), `admin` (Administrateur), `manager` (Chef d'équipe),
  `member` (libellé générique « Membre / Commercial »), `viewer` (Lecture seule),
  `billing` (Facturation).
- `twoFactorRequiredFor` : actions permises par le rôle mais bloquées tant que la 2FA n'est pas
  activée (afficher « Activez la double authentification »).
- `dataScope` : `team` (voit toute l'organisation), `own` (ne voit que ses campagnes et prospects),
  `none` (billing : aucune donnée de prospection).
- `platformOperator` : console opérateur SaaS prévue, non implémentée (toujours `false` en licence).
- `onboardingComplete` : faux tant que type de compte et secteurs ne sont pas renseignés.

Actions de la matrice (`packages/auth/src/access.ts`) : `org:read|update|delete|profile`,
`member:list|invite|remove|change_role`, `campaign:read|read_all|write`,
`prospect:read|read_all|write|assign|export`, `contact:read|write`, `signal:read`,
`message:read|write`, `task:read|write`, `automation:read|manage`, `pipeline:read|write|manage`,
`sequence:read|enroll|manage`, `report:read_own|read_team`, `credits:read`,
`billing:read|manage`, `apikey:manage`, `integration:manage`, `compliance:read|manage`,
`license:manage`, `audit:read`. « Leads » dans l'interface = prospects (`prospect:*`).

### `GET /api/reference` (action `org:read`)

Référentiels avec libellés FR/EN : `accountTypes` (`{code, fr, en}`), `sectors`
(`{code, isic, fr, en}`, sections ISIC Rév. 4), `roles`, `prospectingModels`
(`{code, defaultKinds, involvesIndividuals}`), `prospectKinds`.

### `PUT /api/organization/profile` (action `org:profile` : owner, admin ; sans 2FA)

Onboarding et paramètres. Corps strict :

```json
{ "accountType": "startup", "sectors": ["j_tech_media", "m_professional"], "website": "https://www.acme.sn" }
```

- `website` (facultatif, `null` pour effacer) : site de l'expéditeur, normalisé en domaine
  (`acme.sn`). C'est le **seul domaine dont les liens sont conservés** dans les brouillons générés
  (les autres liens sont retirés). Renvoyé dans `GET /api/me` (`organization.website`).

- `accountType` : `individual | freelancer | sme | startup | enterprise | nonprofit |
public_sector | agency`.
- `sectors` : 1 à 10 codes de `GET /api/reference` (doublons retirés).
- Réponse 200 : le profil enregistré. Le pays d'établissement n'est pas modifiable.

## Recherche (campagnes)

Cycle : `interpreting` → `awaiting_confirmation` (fiche + estimation à relire) → `running` →
`completed` ; annulation : `cancelling` → `cancelled` (avant lancement : `cancelled` direct).
Portée : un `member` ne voit que ses campagnes (`dataScope: own`) ; manager, admin, owner et
viewer voient toute l'organisation ; `billing` n'y a pas accès.

### `POST /api/campaigns` (action `campaign:write`, 20/min)

```json
{ "prompt": "Restaurants et hôtels à Dakar", "name": "Dakar CHR", "model": "b2b", "maxProspects": 50, "quality": "standard" }
```

- `prompt` 10–2000 caractères (obligatoire). `model` facultatif (un des 23 codes de
  `GET /api/reference`) : sinon l'Interprète le choisit. `maxProspects` 5–1500 (plafond de la
  formule). `quality` : `standard` (1 crédit / prospect livré), `careful` (+1), `premium` (+3).
- Réponse **202** `{ "id": "uuid", "status": "interpreting" }`. Suivre ensuite le flux SSE ou
  `GET /api/campaigns/:id`. Erreurs : `quota_exceeded` (prospects par campagne, interprétations
  par jour).

### `GET /api/campaigns?status=&limit=25&offset=0` (action `campaign:read`)

`{ "items": [Campaign], "nextOffset": 25 | null }`.

### `GET /api/campaigns/:id` (action `campaign:read`)

```json
{
  "id": "uuid", "name": "…", "prompt": "…", "model": "b2b", "modelForced": false,
  "status": "awaiting_confirmation", "quality": "standard", "maxProspects": 50,
  "credits": { "reserved": 50, "consumed": 12 },
  "counts": { "candidates": 80, "duplicates": 4, "delivered": 12, "rejected": 30 },
  "degraded": true, "costMode": "normal",
  "estimate": {
    "prospects": { "requested": 50, "low": 30 },
    "credits": { "low": 30, "high": 50, "perProspect": 1 },
    "costUsd": { "low": 0.2, "high": 1.02 },
    "plannedQueries": 9, "degraded": true, "assumptions": ["delivery_ratio_default", "free_sources_only"]
  },
  "sources": {
    "selected": ["osm_overpass", "crtsh"],
    "excluded": [{ "code": "google_places", "reason": "missing_key" }],
    "degraded": true, "costMode": "normal"
  },
  "target": {
    "version": 1, "confirmed": false,
    "spec": { "model": "b2b", "kinds": ["company"], "summary": "…", "language": "fr", "countries": ["SN"],
              "regions": ["Dakar"], "keywords": ["restaurant"], "sectors": ["i_hospitality"], "roles": [],
              "signals": [{ "key": "new_company", "required": false }], "exclusions": [], "channels": ["email", "phone"] },
    "interpretation": { "method": "ai" | "heuristic", "confidence": 0.9, "clarifyingQuestions": ["…"] }
  },
  "createdBy": "uuid", "createdAt": "…", "startedAt": null, "finishedAt": null
}
```

- `credits` vaut `null` dans `estimate` en mode licence (pas de crédits ; `costUsd` = coût des
  clés du client).
- **Mode dégradé** (`degraded: true`) : seules des sources gratuites sont utilisées (aucune clé,
  ou garde-fou de coût). Afficher l'explication avec `sources.excluded[].reason` :
  `missing_key`, `missing_service` (SearXNG non configuré), `cost_guard`, `circuit_open`
  (source en panne, écartée temporairement), `country`, `kind`, `model`, `not_in_playbook`,
  `search_provider_already_chosen`. `interpretation.method = "heuristic"` : aucune IA configurée,
  fiche approximative à relire. Rien n'est jamais inventé : sans source, 0 prospect et 0 débit.
- `costMode` : `normal`, `economy` (≥ 70 % du plafond de coût réel : sources et modèles les moins
  chers), `free_only` (≥ 100 %).

### `PUT /api/campaigns/:id/target` (action `campaign:write`, statut `awaiting_confirmation`)

Corps : `{ "spec": TargetSpec, "maxProspects"?: number, "quality"?: "standard" | "careful" | "premium" }`
(schéma strict, mêmes champs que `target.spec`). Crée une nouvelle version confirmée, recalcule
estimation et sources ; renvoie la campagne complète. `409 conflict` si la campagne est lancée.

### `POST /api/campaigns/:id/launch` (action `campaign:write`)

Corps : `{ "budgetCredits"?: number }` (plafond « ne pas dépasser N crédits »). Réserve
`min(maxProspects × crédits par prospect, budget, solde)` puis lance la recherche.
Réponse **202** `{ "id", "status": "running", "reservedCredits": 50 }`. Erreurs :
`insufficient_credits` (402), `quota_exceeded` (campagnes simultanées de la formule),
`conflict` (pas en `awaiting_confirmation`). En SaaS, une organisation sans abonnement reçoit
une seule fois l'essai de 100 crédits. **Pas de résultat = pas de débit** : seuls les prospects
livrés (score ≥ seuil du playbook ET au moins un canal autorisé par le garde-fou juridique)
consomment ; le reste de la réservation est remboursé à la clôture.

### `POST /api/campaigns/:id/cancel` (action `campaign:write`)

**202** `{ "id", "status": "cancelling" }`. Les tâches en file sont annulées, les prospects déjà
livrés conservés, la réservation non consommée remboursée.

### `GET /api/campaigns/:id/stream` — suivi en direct (SSE)

`EventSource('/api/campaigns/:id/stream')` (cookies de session). Reprise automatique : le
navigateur renvoie `Last-Event-ID` (ou `?lastEventId=` à la main). Battement `: ping` toutes les
20 s ; fermeture à la fin de la campagne ou après 10 min (reconnexion automatique, `retry: 3000`).
Événements (`event:` / `data:` JSON, toujours avec `at`) :

| event                   | data                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| `campaign.target_ready` | `{ method, confidence }`                                                          |
| `campaign.status`       | `{ status, reservedMc? , delivered?, consumedMc?, refundedMc? }` (1 crédit = 1000 mc) |
| `campaign.progress`     | `{ phase: "searching", queries, sources }`                                        |
| `campaign.warning`      | `{ code: "degraded_free_sources_only" \| "no_source_available" \| "source_failed", connector?, reason?, excluded? }` |
| `prospect.created`      | `{ prospectId, source }`                                                          |
| `prospect.updated`      | `{ prospectId, status: "drafted" \| "rejected", score, reason }`                  |
| `message.drafted`       | `{ prospectId, messageId }`                                                       |

Raisons de rejet (`reason`) : `low_score`, `no_allowed_channel`, `excluded`,
`budget_exhausted`, `quota_reached` (plafond journalier ou nombre demandé atteint).

## Prospects (« Leads »)

### `GET /api/prospects` (action `prospect:read`)

Paramètres : `campaignId`, `status` (`found|drafted|rejected|…`), `delivered=true|false`,
`minScore`, `country` (ISO), `kind`, `q` (nom, ≥ 2 caractères), `sort=score|recent|name`,
`limit` (≤ 100), `offset`. Un `member` ne voit que ses prospects.

```json
{ "items": [{ "id": "uuid", "campaignId": "uuid", "kind": "company", "model": "b2b",
  "displayName": "Restaurant Le Baobab", "countryCode": "SN", "city": "Dakar",
  "websiteDomain": "lebaobab.sn", "status": "drafted", "rejectionReason": null, "score": 82,
  "sourceCodes": ["osm_overpass"], "category": "restaurant", "signals": ["no_website"],
  "channels": [{ "channel": "email", "outcome": "allow_with_conditions" }],
  "ownerUserId": "uuid", "deliveredAt": "…", "createdAt": "…" }], "nextOffset": null }
```

Aucune coordonnée en clair dans la liste.

### `GET /api/prospects/:id` (action `prospect:read`)

```json
{
  "prospect": { "id", "displayName", "kind", "countryCode", "city", "websiteDomain", "status", "attributes": {}, "deliveredAt": "…" },
  "score": { "value": 82, "reasons": [{ "criterion": "fit|signals|reachability|quality|ai_adjustment|exclusion",
             "points": 25, "max": 35, "finding": "keywords_matched", "params": { "matched": "restaurant" } }] },
  "channels": [{ "channel": "email", "outcome": "allow_with_conditions", "conditions": { "requireOptOut": true, "footer": "eu_notice", "retentionDays": 1095, "maxFollowUps": 2 },
                 "ruleIds": ["eu-business-email"], "rulesetVersions": ["EU@2026-11-22"], "reasons": [], "warnings": [] }],
  "evidence": { "display_name": [{ "id", "source": "osm_overpass", "url": "…", "collectedAt": "…", "legalBasis": "legitimate_interest", "license": "ODbL", "snippet": null }],
                "contact.email": [ … ] },
  "contacts": [{ "id", "channel": "email", "value": "contact@lebaobab.sn", "revealed": true, "found": true,
                 "verificationStatus": "valid|unknown|risky|accept_all|webmail|invalid|disposable", "isRoleAddress": true, "evidence": ["uuid"] }],
  "messages": [{ "id", "channel": "email", "language": "fr", "subject": "…", "body": "…", "footer": "mention légale + STOP", "quality": "standard", "generatedBy": "ai|template", "status": "draft" }]
}
```

- Coordonnées en clair **uniquement pour un prospect livré ET un canal autorisé par le garde-fou**
  (`revealed: true`) ; sinon `value: null` et `found: true` (la coordonnée existe, rien n'en est
  montré). Chaque consultation est journalisée (`prospect.contacts_viewed`).
- `outcome` du garde-fou : `allow`, `allow_with_conditions`, `manual_only` (page publique ou
  formulaire : l'utilisateur ouvre le lien lui-même) ; les canaux refusés n'apparaissent pas.
- Le message est toujours un **brouillon** : aucun envoi automatique (copier puis envoyer à la
  main). Le pied de page légal (`footer`) est ajouté par le code, à afficher sous le corps.

## Crédits et playbooks

### `GET /api/credits` (action `credits:read`)

SaaS : `{ "mode": "saas", "balance": 90, "buckets": [{ "origin": "trial|plan|rollover|pack|adjustment", "remaining": 90, "expiresAt": "…" }],
"plan": { "code": "research", "monthlyCredits": 1000, "concurrentCampaigns": 2, "maxProspectsPerCampaign": 500, "dailyProspectCap": 150, "pipeline": false },
"periodStart": "…", "costMode": "normal", "deliveryCredits": { "standard": 1, "careful": 2, "premium": 4 },
"packs": [{ "code": "pack_500", "credits": 500, "priceUsd": 14.99, "validityMonths": 12 }] }`.
Licence : `{ "mode": "license", "credits": null }`. Le barème vient d'une configuration unique
(`packages/billing/src/plans.ts`).

### `GET /api/playbooks` (action `campaign:read`)

`{ "items": [{ "model": "real_estate", "version": 1, "relevance": 4.5, "kinds": [], "connectors": [],
"signals": [], "channels": [], "audience": "business|individual|per_prospect",
"rules": { "publicSignalsOnly": false, "minScore": 45, "defaultMaxProspects": 100 },
"messageAngle": { "fr": "…", "en": "…" } }] }`, triés par pertinence pour le profil de
l'organisation (type de compte + secteurs).

## Client Better Auth (interface)

Déclarer les rôles côté client pour que les invitations `manager`, `viewer`, `billing` soient
typées : `import { BETTER_AUTH_ROLES } from '@scoutra/auth/roles'` puis
`organizationClient({ roles: BETTER_AUTH_ROLES, schema: … })`.

## Paiement (abstrait)

`POST /api/billing/webhook` : réservé au prestataire de paiement (carte, international, **non
encore choisi**) ; répond `404` tant qu'aucun adaptateur n'est branché
(`apps/web/src/server/payments.ts`). Événements normalisés (`packages/billing/src/payments.ts`) :
`subscription.activated|renewed|canceled`, `pack.purchased` (avec `eventId` et `occurredAt`),
appliqués une seule fois par `eventId` (table `billing_events`) et dans l'ordre : un événement
d'abonnement plus ancien que le dernier appliqué, ou une période déjà ouverte, est ignoré
(`stale`). Octroi du forfait par période, report de 50 % un mois, packs valables 12 mois.
L'interface n'appelle pas cette route ; le passage en caisse (`createCheckout`) sera exposé avec
le prestataire.

## CRM : prospects (étape 3)

Portée identique partout : un `member` n'agit que sur ses prospects (`ownerUserId` = lui) ; un
prospect hors de sa portée répond `404`.

### `GET /api/prospects` — compléments

Nouveaux filtres : `stage`, `ownerUserId`, `listId`, `qualification`
(`unqualified|qualified|disqualified`). Nouveaux champs par ligne : `stage`, `qualification`,
`valueAmount`, `ownerName` (nom du membre propriétaire), `emailStatus`
(`valid|risky|invalid|none`, meilleur email vérifié).

### `PATCH /api/prospects/:id` (action `prospect:write`)

```json
{ "stage": "meeting", "ownerUserId": "uuid|null", "valueAmount": 1200, "qualification": "qualified", "note": "Rappeler jeudi" }
```

Au moins un champ. `ownerUserId` exige `prospect:assign` (manager, admin, owner) et un membre de
l'organisation (`invalid_input` sinon). `stage` : une clé de `GET /api/pipeline/stages`. Chaque
changement est historisé ; un changement d'étape déclenche les automatisations. Réponse :
`{ id, stage, ownerUserId, valueAmount, qualification, updatedAt }`.

### `POST /api/prospects/bulk` (action `prospect:write`, 30/min)

```json
{ "ids": ["uuid", "…"], "action": { "type": "add_to_list", "listId": "uuid" } }
```

`action.type` : `add_to_list` / `remove_from_list` (`listId`), `move_stage` (`stage`),
`assign` (`ownerUserId`, exige `prospect:assign`), `enroll` (`sequenceId`), `qualify`
(`qualification`). 500 identifiants au plus. Réponse `{ affected, skipped }` (`skipped` :
prospects hors de votre portée ou déjà présents).

### `GET /api/prospects/:id/activities` (action `prospect:read`)

`{ items: [{ id, type, payload, actorUserId, actorName, at }] }`, du plus récent au plus ancien.
Types : `stage_changed`, `owner_changed`, `qualification_changed`, `note`, `message_status`,
`reply_logged`, `task_created`, `task_done`, `sequence_enrolled`, `list_added`, `automation`.

### Listes : `GET /api/lists`, `POST /api/lists`, `DELETE /api/lists/:id`

`GET` → `{ items: [{ id, name, size, createdBy, createdAt }] }`. `POST { name }` → 201
(`conflict` si le nom existe). `DELETE` : auteur de la liste ou chef d'équipe ; les prospects
restent. Ajout/retrait de prospects : `POST /api/prospects/bulk`.

### Vues enregistrées : `GET /api/views`, `POST /api/views`, `DELETE /api/views/:id`

`POST { name, filters, shared }` où `filters` reprend les paramètres de `GET /api/prospects`
(+ `columns: string[]`). `GET` renvoie mes vues et les vues partagées (`mine: boolean`).
Seul l'auteur supprime une vue.

## Pipeline et campagnes (pause)

### `GET /api/pipeline/stages` (action `pipeline:read`) · `PUT /api/pipeline/stages` (`pipeline:manage`)

`GET` → `{ items: [{ key, label: { fr, en }, kind: "open|won|lost", position }] }` (étapes par
défaut : `new`, `contacted`, `replied`, `meeting`, `won`, `lost`). `PUT { stages: [{ key, label,
kind }] }` remplace la configuration (ordre = position, `new` obligatoire, 2 à 15 étapes) ; les
prospects d'une étape supprimée reviennent à `new`.

### `GET /api/pipeline?ownerUserId=&perStage=100` (action `pipeline:read`)

`{ stages: [{ key, label, kind, count, value, items: [{ id, displayName, countryCode, city, score,
ownerUserId, ownerName, valueAmount, qualification, stageChangedAt }] }] }` : prospects **livrés**,
portée par rôle. Déplacer une carte : `PATCH /api/prospects/:id { "stage": "meeting" }` ;
historique : `GET /api/prospects/:id/activities`.

### `POST /api/campaigns/:id/pause` · `POST /api/campaigns/:id/resume` (action `campaign:write`)

`running` → `paused` → `running` (sinon `409 conflict`). En pause, les tâches de recherche et de
traitement se reportent d'une minute : rien n'est perdu ni débité. Événement SSE
`campaign.status`. Une campagne en pause compte dans les campagnes simultanées.

## Messages et boîte unifiée (aucun envoi automatique)

Scoutra n'envoie **jamais** de message (ni email, ni DM sur une plateforme). L'utilisateur copie
le brouillon, l'envoie lui-même, puis saisit le statut.

### `PATCH /api/messages/:id` (action `message:write`)

```json
{ "status": "sent_manually" }
{ "status": "replied", "replyText": "Intéressé, rappelez-moi jeudi" }
{ "subject": "…", "body": "texte corrigé" }
```

`status` : `draft`, `to_send`, `copied`, `sent_manually`, `replied`, `discarded`. Effets :
`sent_manually` → `sentAt`, prospect `new` → `contacted` ; `replied` → `repliedAt`, réponse
historisée (`reply_logged`), séquences du prospect arrêtées, automatisations « a répondu ».
Le corps n'est plus modifiable après envoi (`409`). Le pied de page légal n'est jamais modifiable.
Réponse : `{ id, status, subject, body, footer, sentAt, repliedAt }`.

### `POST /api/messages/:id/regenerate` (action `message:write`, 20/min)

Corps `{ language?: "fr"|"en", tone?: string }`. Nouveau brouillon (même canal, même décision du
garde-fou), l'ancien passe à `discarded`. **3 régénérations par prospect** (`429 quota_exceeded`
au-delà). Au-delà du plafond de coût, ou sans IA : message modèle (`generatedBy: "template"`).
Réponse 201 `{ id, replaces, channel, subject, body, footer, generatedBy, status }`.

### `GET /api/inbox/threads?status=&limit=50` (action `message:read`)

`{ items: [{ prospectId, prospectName, countryCode, channel, lastAt, subject, preview,
awaitingAction, items: [{ from: "me"|"them", kind: "draft"|"sent"|"reply", body, subject, channel,
status?, messageId?, at }] }] }` — un fil par prospect visible ; `status` filtre `replied`,
`to_send` ou `sent_manually`.

## Tâches, agenda, séquences, automatisations, notifications

### Tâches : `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`

Actions `task:read` / `task:write`. Un `member` voit les tâches qui lui sont assignées ou qu'il a
créées ; l'équipe voit tout. `GET ?status=open|done|cancelled&due=overdue|today|week&mine=true&limit=`
→ `{ items: [{ id, title, kind, status, source: "manual|sequence|automation", dueAt, endAt,
overdue, prospectId, prospectName, assigneeUserId, assigneeName, createdAt }] }`.
`POST { title, kind: "call|email|whatsapp|meeting|follow_up|linkedin_manual|other", dueAt?, endAt?,
prospectId?, assigneeUserId? }` (assigner à quelqu'un d'autre exige `prospect:assign`). `PATCH`
accepte les mêmes champs + `status`.

### `GET /api/agenda?from=ISO&to=ISO` (action `task:read`, 31 jours au plus)

`{ items: [{ id, title, kind, start, end, who, prospectId, prospectName, done }] }` (fin par défaut
: début + 30 min).

### Séquences : `GET /api/sequences` (`sequence:read`), `POST /api/sequences`, `PATCH /api/sequences/:id` (`sequence:manage`), `POST /api/sequences/:id/enroll` (`sequence:enroll`)

`POST { name, status?, steps: [{ day, channel: "email|phone|whatsapp|linkedin_manual|other", kind:
"task|draft", title, template? }] }` (jours croissants, 20 étapes au plus). Chaque minute, le worker
exécute les étapes dues : **tâche** pour l'utilisateur, ou **brouillon** email (si le garde-fou
autorise l'email pour ce prospect ; `{{name}}` remplacé). **Aucun envoi.** Une réponse saisie
arrête la séquence du prospect. `GET` → `{ items: [{ id, name, status, steps, enrolled, active,
replyRate, createdBy, createdAt }] }`. `enroll { prospectIds }` → `{ enrolled, skipped }`.

### Automatisations : `GET /api/automations` (`automation:read`), `POST`, `PUT /api/automations/:id`, `DELETE` (`automation:manage`)

`{ name, enabled, trigger, triggerArg, action, actionArg }` :
- `trigger` : `delivered` (prospect livré), `score_above` (`triggerArg` = score), `signal`
  (`triggerArg` = clé de signal), `replied` (réponse saisie), `stage_changed` (`triggerArg` =
  étape, vide = toutes) ;
- `action` : `assign` (`actionArg` = id de membre), `create_task` (`actionArg` = titre),
  `move_stage` (`actionArg` = étape), `notify` (`actionArg` = id de membre ou `owner`).
Réponse : `{ id, name, enabled, trigger, triggerArg, action, actionArg, runs, lastRunAt }`.
Actions internes uniquement ; une action d'automatisation ne redéclenche pas d'automatisation.

### Notifications : `GET /api/notifications` · `POST /api/notifications/read { ids? }`

`{ unread, items: [{ id, title, body, link, read, at }] }` (les miennes). `read` sans `ids` :
tout marquer comme lu.
