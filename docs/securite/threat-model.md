# Modèle de menaces Nyini

Source : `docs/PLAN.md` (22/11/2026, aucun code encore). Analyse sur plan, sans test d'attaque, par l'agent security-auditor.
Probabilité / impact : F (faible), M (moyen), É (élevé), C (critique).

## 0. Périmètre et frontières de confiance

| Élément | Détail |
|---|---|
| Modes | SaaS multi-locataire (mon VPS) et licence auto-hébergée (Docker Compose chez le client, ses clés IA) |
| Frontières | Navigateur → app Next.js → Postgres (données + file pg-boss) ; workers → Internet (sites, connecteurs, LLM) ; workers → Crawl4AI / Reacher ; hôte client hors de mon contrôle |
| Acteurs hostiles | Locataire malveillant, site/prospect qui pose du contenu piégé, spammeur, pirate de licence, client qui modifie le code, attaquant externe |
| Hypothèse clé | Tout contenu venant du web, d'un prospect, d'un connecteur ou d'un LLM est non fiable. En licence, la vérification hors ligne **dissuade**, elle n'est pas inviolable |

## 1. Actifs

| # | Actif | Où | Impact si compromis |
|---|---|---|---|
| A1 | Données prospects B2B | Postgres | Sanctions RGPD/APDP, fuite entre concurrents |
| A2 | Données de particuliers | Postgres | Dommage aux personnes, risque légal maximal |
| A3 | Clés API des clients | Postgres chiffré | Facturation frauduleuse chez des tiers |
| A4 | Clé privée de signature de licence | Hors ligne / HSM | Licences illimitées falsifiables, irréversible |
| A5 | Comptes, sessions, rôles | Better Auth | Prise de compte |
| A6 | Crédits et facturation | Postgres + paiement | Pertes financières |
| A7 | Clés IA de la plateforme | Variables d'environnement | Facture IA illimitée |
| A8 | Réputation (IP, port 25, domaine) | Infra | Listes noires, bannissement hébergeur |
| A9 | Journal d'audit / traçabilité | Postgres | Perte de preuve de conformité |
| A10 | Code source (licence) | Chez le client | Piratage, revente |

## 2. Menaces et mesures

### 2.1 Multi-locataire
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T1 | IDOR : accès à une ligne d'une autre organisation (oubli de `WHERE org_id`) | É | C | `org_id` NOT NULL partout, **RLS Postgres** (`SET LOCAL app.org_id`, rôle sans BYPASSRLS), couche d'accès unique `withOrg(ctx)`, tests CI d'isolation |
| T2 | Tâche pg-boss avec `org_id` modifiable, worker sans contexte d'org | M | É | Payload validé (zod), même transaction RLS dans le worker |
| T3 | Fuite par cache, logs, exports, flux SSE, déduplication globale | M | É | Clés et canaux préfixés par org, pas de déduplication inter-orgs, logs sans données prospects |
| T4 | Élévation de rôle, invitation réutilisable, org choisie par paramètre client | M | É | Rôle et org active côté serveur, invitations à usage unique liées à un email |
| T5 | Une org sature la file | M | M | Quotas et concurrence par org |

### 2.2 Agents LLM (injection de prompt)
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T6 | Page web piégée qui détourne l'agent ou exfiltre des données | É | É | Moindre privilège (agent lecteur sans outil sensible), sorties à schéma strict, contenu externe marqué « donnée », pas de fetch d'URL arbitraire par le LLM, pas d'images Markdown auto-chargées, validation humaine des actions |
| T7 | Texte de prospect qui fausse le score ou glisse un lien de phishing dans le message | É | M | Relecture humaine avant envoi, contrôle des liens, champs bornés |
| T8 | Secrets dans le contexte du LLM | M | É | Jamais de secret dans un prompt ; prompt système considéré public |
| T9 | Données envoyées au fournisseur IA sans accord | M | M | Sous-traitants dans le DPA, minimisation, zéro rétention si possible |

### 2.3 SSRF (Crawl4AI, connecteurs)
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T10 | URL vers métadonnées cloud, Postgres, Reacher, localhost (redirections, DNS rebinding, IP encodées) | É | C | **Garde SSRF centralisée** (http/https, ports 80/443, blocage plages privées après résolution, redirections revalidées), Crawl4AI sur réseau isolé avec proxy filtrant, métadonnées bloquées |
| T11 | API Crawl4AI exposée ou avec exécution de code | M | É | Pas de port publié, jeton, exécution désactivée, image épinglée |
| T12 | Webhook/source personnalisée comme relais SSRF | M | É | Même garde SSRF partout |
| T13 | Page piège (bombe, boucle, Go de données) | M | M | Limites taille/durée/profondeur, respect de `robots.txt` |

### 2.4 Abus du produit
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T14 | Spam, harcèlement, revente de listes | É | É | Politique d'usage, pas d'envoi massif natif, garde-fou pays, exports limités et journalisés, vérification à l'inscription, suspension |
| T15 | Profilage d'une personne nommée via l'agent Interprète | É | É | Classification d'intention, refus des requêtes visant une personne nommée |
| T16 | Client qui nie une action abusive | M | M | Journal d'audit en ajout seul |

### 2.5 Licence
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T17 | Client root qui retire la vérification ou remplace la clé publique | É | É | Objectif = dissuader + preuve contractuelle : vérification en plusieurs points, images signées, clauses d'audit, mises à jour et règles pays réservées aux licenciés à jour |
| T18 | Clé copiée ou horloge reculée | É | M | Liaison à l'installation, détection de recul d'horloge, grâce puis lecture seule |
| T19 | Fuite de la clé privée | F | C | Hors dépôt/CI, clé matérielle ou KMS, **rotation prévue dès la v1** (`kid`, plusieurs clés publiques) |
| T20 | Format mal conçu (JWT `alg=none`) | M | É | Format minimal JSON canonique + Ed25519, tous les champs signés, tests d'altération |
| T21 | Licence utilisée dans un autre pays | M | M | Non vérifiable hors ligne → clause contractuelle |

### 2.6 Clés API
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T22 | Clés en clair dans base, dumps, logs, front | M | C | AES-256-GCM, clé maître hors base, `org_id` en AAD, jamais renvoyées au front, masquage |
| T23 | Membre simple qui lit/remplace la clé | M | É | Réservé owner/admin, audit |
| T24 | Clé d'une org utilisée par une autre | F | É | Résolution par `org_id` du contexte |
| T25 | Clés plateforme exposées (`NEXT_PUBLIC_*`, debug) | M | C | Aucun `NEXT_PUBLIC_` sensible, plafonds fournisseur, gitleaks |

### 2.7 Coûts et crédits
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T26 | Campagne « monde entier » qui explose les appels | É | É | Budget dur par campagne, itérations bornées, estimation avant lancement |
| T27 | Double dépense de crédits en parallèle | M | M | Débit atomique SQL ou grand livre |
| T28 | Monopolisation du LLM | M | M | Limites de débit par utilisateur/org/IP |
| T29 | Webhook de paiement falsifié | M | É | Signature, idempotence, montants recontrôlés, crédits uniquement via webhook |

### 2.8 XSS
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T30 | HTML/JS dans données scrapées affichées | É | É | Pas de `dangerouslySetInnerHTML`, Markdown assaini, CSP stricte, cookies HttpOnly/Secure/SameSite |
| T31 | Injection de formule CSV/Excel | É | M | Préfixer `'` les cellules commençant par `= + - @` |
| T32 | Aperçu HTML servi sur le domaine de l'app | M | É | iframe sandbox sur domaine distinct ou pas d'aperçu brut |

### 2.9 Vérification SMTP
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T33 | Port 25 bloqué → résultats faux | É | M | Test au démarrage, état « non vérifiable » distinct, repli syntaxe + MX |
| T34 | IP sur liste noire | É | É | IP dédiée séparée, rDNS/SPF cohérents, débit limité, surveillance |
| T35 | Énumération d'emails de particuliers | M | É | Vérifier seulement des emails à source tracée, pas de permutations B2C |
| T36 | Reacher exposé sans authentification | M | É | Réseau interne uniquement |
| T37 | IP du client utilisée sans information (licence) | M | M | Doc claire, option de désactivation |

### 2.10 Conformité
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T38 | Données restantes après effacement (sauvegardes, caches, IA) | É | É | Identifiant de personne unique, suppression en cascade, liste de suppression (hash), rétention courte des sauvegardes |
| T39 | Prospect sans source/base légale, conservation illimitée | É | É | `source`, `date_collecte`, `base_legale`, `pays` NOT NULL, purge auto par pays, garde-fou côté serveur |
| T40 | Transferts internationaux non maîtrisés | M | É | Choix de région/fournisseur IA par org, DPA |
| T41 | Fuite sans procédure (72 h RGPD) | F | É | Plan d'incident, `security.txt` |

### 2.11 Socle et chaîne d'approvisionnement
| ID | Menace | P | I | Mesure |
|---|---|---|---|---|
| T42 | Prise de compte | É | É | Limites de tentatives, argon2id, 2FA admins, `email_verified` Google |
| T43 | CSRF | M | M | SameSite, contrôle `Origin`, pas de GET à effet de bord |
| T44 | Injection SQL via tri/filtres (`sql.raw`) | M | É | Liste blanche, interdiction `sql.raw` sur entrées, Semgrep |
| T45 | Dépendances/images compromises | M | É | Lockfile, audit supply-chain, images par digest, `ignore-scripts`, SBOM |
| T46 | Secrets dans sauvegardes/CI | M | É | Secrets CI, sauvegardes chiffrées, gitleaks |
| T47 | Évasion de conteneur | F | C | Non-root, `cap_drop: ALL`, `no-new-privileges`, lecture seule, jamais le socket Docker |
| T48 | Données dans les rapports d'erreurs | M | M | Scrubbing, pas de corps de requête en log |
| T49 | Mise à jour falsifiée | F | É | Images signées (cosign) |

## 3. Les 10 exigences non négociables (étape 1)

| # | Exigence |
|---|---|
| E1 | Isolation multi-locataire par RLS Postgres + tests CI d'isolation (routes, workers, temps réel) |
| E2 | Autorisation centralisée côté serveur, refus par défaut, org active issue de la session |
| E3 | Authentification durcie (argon2id, limites, 2FA admins, cookies sûrs, CSRF, vérification d'email) |
| E4 | Secrets : rien en dur, clés clientes chiffrées AES-256-GCM, jamais renvoyées au front, gitleaks |
| E5 | Garde SSRF unique + Crawl4AI sur réseau isolé à sortie filtrée |
| E6 | Politique d'agents : contenu externe = donnée, schémas stricts, aucun secret dans les prompts, validation humaine |
| E7 | Budgets et quotas durs, débit de crédits atomique, limites de débit |
| E8 | Sortie sûre : pas de HTML brut externe, CSP stricte, Markdown assaini, CSV neutralisé |
| E9 | Modèle de données conforme dès le départ (source, date, base légale, pays, identifiant de personne, audit) |
| E10 | Licence Ed25519 avec `kid`/rotation conçue avant la 1re vente, chaîne de livraison signée, conteneurs durcis |

## 4. Réglages par défaut sûrs (installation Docker Compose)

| Domaine | Défaut sûr |
|---|---|
| Ports | Seul le reverse proxy (443) publié ; Postgres/Reacher/Crawl4AI en réseau interne |
| TLS | HTTPS obligatoire (Caddy/Traefik), HSTS |
| Secrets | Aucun secret par défaut ; **refus de démarrer** si secrets absents ou faibles ; script de génération |
| Admin | Créé par assistant à usage unique, pas de compte pré-créé, inscription publique désactivée |
| Base | Rôle applicatif sans superutilisateur ni BYPASSRLS ; migrations par rôle séparé |
| Conteneurs | Non-root, lecture seule, `cap_drop: ALL`, limites, images par digest |
| Réseau sortant | Crawl4AI via proxy filtrant ; Reacher sortie port 25 seulement |
| Debug | Production, pas de stack traces ni source maps publiques |
| Journaux | Sans données personnelles, rétention bornée, audit actif |
| Clés IA | Chiffrées, masquées ; conseil de plafond de dépense |
| Limites | Quotas prudents activés |
| Licence | Expiration → grâce puis lecture seule, jamais d'effacement |
| SMTP | Vérification désactivée tant que le test port 25 échoue |
| Garde-fou juridique | Actif par défaut, désactivation admin uniquement et journalisée |
| Sauvegardes | Chiffrées, liste de suppression rejouée à la restauration |
| En-têtes | CSP, nosniff, Referrer-Policy, `frame-ancestors 'none'`, Permissions-Policy |

## 5. Corrections à apporter au plan

| Constat dans PLAN.md | Action |
|---|---|
| §4 licence « hors ligne » présentée comme protection | Reformuler : dissuasion technique + contrat |
| Pas de RLS ni d'isolation des workers | Ajouter E1 à l'étape 1 |
| « Clés chiffrées » sans gestion de clé maître | Clé maître externe, rotation, AAD par org |
| Crawl4AI sans garde SSRF | Ajouter E5 |
| Agents sans politique de confiance | Ajouter E6 |
| Garde-fou et effacement à l'étape 3 | Modèle conforme (E9) dès l'étape 1 |
| Clé de licence à l'étape 6 | Concevoir le format/rotation à l'étape 1 |
| Reacher/Crawl4AI repris tels quels | Durcir leur configuration dans le Compose |

Limite : analyse du plan seul. À revoir à chaque étape (security-auditor), puis semgrep/codeql et tests d'isolation dès que le socle existe. Tests d'attaque uniquement sur localhost.
