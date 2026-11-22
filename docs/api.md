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
{ "accountType": "startup", "sectors": ["j_tech_media", "m_professional"] }
```

- `accountType` : `individual | freelancer | sme | startup | enterprise | nonprofit |
public_sector | agency`.
- `sectors` : 1 à 10 codes de `GET /api/reference` (doublons retirés).
- Réponse 200 : le profil enregistré. Le pays d'établissement n'est pas modifiable.
