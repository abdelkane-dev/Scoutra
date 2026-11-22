# Nyini — Dossier de cadrage (à valider avant de coder)

> Statut : **proposition**, rien n'est codé. Date : 22/11/2026.
> Nom de travail : **Nyini** (« chercher » en bambara). Voir §7.

---

## 1. Le produit en une phrase

Un « cerveau » de prospection : l'utilisateur décrit sa cible en langage naturel
(« coachs en développement personnel francophones au Sénégal et en Côte d'Ivoire qui vendent déjà en ligne »,
« PME du BTP à Dakar avec un site web mais sans CRM »), choisit sa zone (1 pays, plusieurs, ou monde entier),
et une équipe d'agents IA trouve, enrichit, vérifie, note les prospects et rédige le premier message.

Deux types de cibles :
- **B2B** : entreprises, PME, décideurs.
- **B2C / particuliers** : pour closers, vendeurs de formations, produits digitaux… (le cas le plus encadré légalement, voir §3).

---

## 2. Analyse des projets open source (relevé GitHub du 22/11/2026)

Critères : popularité (étoiles), **licence compatible usage commercial fermé** (MIT / Apache-2.0 = oui ;
AGPL / GPL = non pour du code repris dans un SaaS fermé), maintenance (dernier commit).

### 2.1 À reprendre ou intégrer (licence OK, maintenus)

| Projet | ⭐ | Licence | Dernier commit | Ce qu'on en fait |
|---|---|---|---|---|
| reacherhq/check-if-email-exists | 10,5k | MIT | nov. 2026 | **Agent Vérification** : vérifie qu'un email existe sans envoyer de mail (Rust, serveur HTTP prêt). Lancé comme service Docker séparé. ⚠ nécessite le port 25 sortant (souvent bloqué chez les hébergeurs cloud). |
| AfterShip/email-verifier | 1,7k | MIT | nov. 2026 | Alternative/complément Go à Reacher (syntaxe, MX, jetables, rôles). |
| unclecode/crawl4ai | 87,6k | Apache-2.0 | nov. 2026 | **Agent Enrichissement** : lit les sites web des entreprises et en sort du texte propre pour l'IA (contacts publics, offre, taille, techno). Service Python séparé. |
| firecrawl/fire-enrich | 1,3k | MIT | oct. 2026 | **Modèle d'architecture** : enrichissement multi-agents en TypeScript/Next.js. On s'en inspire et on peut reprendre des morceaux. |
| eracle/OpenOutreach | 3,8k | Apache-2.0 | nov. 2026 | **Modèle de pipeline** « décris ton produit → trouve les gens qui correspondent → explique pourquoi → écrit ». Python : on reprend la logique (prompts, notation expliquée), pas le code tel quel. |
| context-dot-dev/enrichable | 0,3k | MIT | nov. 2026 | Idée d'interface « tableur IA » (une ligne = un prospect, colonnes enrichies en direct). Inspiration UX. |
| gosom/google-maps-scraper | 8,3k | MIT | nov. 2026 | Code utilisable, **mais** aspirer Google Maps viole les conditions de Google. → En SaaS on utilise l'**API officielle Google Places** (payante, légale). Le scraper n'est pas livré. |
| vercel/ai (AI SDK) | 28k | Apache-2.0 | nov. 2026 | **Cœur des agents** : un seul code pour Claude, OpenAI, Mistral, Gemini… Indispensable pour la licence où le client met *ses* clés. |
| apify/crawlee | 26,5k | Apache-2.0 | nov. 2026 | Option si on a besoin d'un navigateur automatisé côté Node (pages dynamiques). |

### 2.2 À regarder pour s'inspirer, **sans reprendre le code** (licence incompatible ou risque)

| Projet | ⭐ | Licence | Pourquoi pas de reprise |
|---|---|---|---|
| firecrawl/firecrawl | 206k | AGPL-3.0 | Auto-hébergé + modifié = obligation de publier notre code. Utilisable seulement via leur API payante (connecteur optionnel). |
| ethanplusai/sellbird | 6,9k | AGPL-3.0 | Très proche de notre idée (trouve, vérifie, écrit, envoie, gère les réponses) → excellente inspiration fonctionnelle, code interdit. |
| twentyhq/twenty (CRM) | 61k | AGPL (+ partie commerciale) | Bon modèle pour le module de suivi (formule 2), code interdit. |
| knadh/listmonk | 24k | AGPL-3.0 | Envoi d'emails en masse ; on n'en a pas besoin au départ. |
| laramies/theHarvester | 18k | GPL-2.0 | OSINT emails de domaine ; licence copyleft. |
| joeyism/linkedin_scraper | 4,7k | GPL-3.0 | Licence + interdit par les conditions LinkedIn. |
| sherlock / maigret / social-analyzer | 115k / 41k / 25k | MIT / MIT / AGPL | Outils OSINT qui constituent un **dossier sur une personne** à partir de son pseudo. Licence parfois OK, mais usage = profilage de particuliers → **exclu** du produit (risque légal et réputationnel majeur). |
| filip-michalsky/SalesGPT | 2,8k | MIT | Plus maintenu depuis 2024. |

### 2.3 Frameworks multi-agents envisagés

| Option | Verdict |
|---|---|
| LangGraph (MIT, 45k⭐), CrewAI (MIT, 61k⭐) | Puissants mais Python, et une couche de plus à maintenir. |
| Mastra (Apache-2.0 + parties « ee »), Trigger.dev (Apache-2.0) | Bons, mais ajoutent un service à installer chez chaque client licence. |
| **Retenu : AI SDK + file de tâches Postgres (pg-boss)** | Le plus simple : chaque agent = une fonction, chaque étape = une tâche en file. Parallélisme, reprises en cas d'échec, aucun service en plus que Postgres. |

> Chaque licence sera revérifiée dans le fichier `LICENSE` du dépôt au moment de la reprise (le relevé GitHub peut être imprécis, ex. « NOASSERTION »).

---

## 3. Limites légales et conditions des plateformes (à lire attentivement)

**Je ne suis pas avocat : ce chapitre est une cartographie des risques, à faire valider par un juriste avant le lancement.**

### 3.1 Lois sur les données personnelles
- **Mali — Loi n°2013-015 du 21 mai 2013** (modifiée par la loi n°2017-070), autorité : **APDP**. Principe : traitement de données personnelles = base légale (souvent le consentement), information des personnes, déclaration/autorisation auprès de l'APDP, sécurité, droit d'opposition. Le texte consolidé est à lire (articles sur la prospection directe).
- **CEDEAO** : Acte additionnel A/SA.1/01/10 (cadre commun) ; la plupart des pays voisins ont une loi équivalente (Sénégal : CDP, Côte d'Ivoire : ARTCI, etc.).
- **Europe — RGPD** : s'applique dès qu'on cible des personnes situées dans l'UE, même depuis Bamako. B2C par email/SMS = **consentement préalable** (directive ePrivacy). B2B = possible sur « intérêt légitime » avec information + désinscription simple.
- **Royaume-Uni (UK GDPR + PECR)**, **Canada (LCAP/CASL : consentement strict)**, **USA (CAN-SPAM : opt-out ; TCPA très sévère pour SMS/appels)**.

👉 **Conséquence produit** : un moteur de règles par pays (« garde-fou juridique ») qui adapte ce que l'outil propose : canaux autorisés, mention d'information obligatoire, désinscription, durée de conservation.

### 3.2 Particuliers : ce qu'on peut faire et ce qu'on ne peut pas faire
| ❌ Interdit / trop risqué | ✅ Légal et efficace |
|---|---|
| Aspirer des profils Facebook / Instagram / LinkedIn de particuliers (contraire aux conditions de Meta et LinkedIn ; comptes bannis, poursuites possibles) | **Trouver où se trouve l'audience** : groupes publics, pages, hashtags, chaînes YouTube, forums, événements → l'agent dit *où* et *pourquoi*, l'humain s'y rend |
| Robots qui envoient des messages privés automatiques (DM) | **Messages rédigés par l'IA, envoyés à la main** par le closer (copier-coller en un clic) |
| Constituer un dossier sur une personne (OSINT, pseudo → tous ses comptes) | **Personnes qui se rendent publiquement joignables pour du business** : créateurs, coachs, freelances, commerçants avec un contact pro affiché |
| Acheter/revendre des fichiers de particuliers | **Prospection entrante** : formulaires Meta Lead Ads (API officielle, consentement), page de capture fournie par Nyini |
| Emails/SMS à des particuliers sans consentement (UE, UK, Canada) | WhatsApp Business uniquement avec **opt-in** (règle de Meta) |

### 3.3 Conditions des plateformes
- **Google Maps** : aspiration interdite → API Places officielle (payante).
- **LinkedIn** : aspiration et automatisation interdites (affaire hiQ c. LinkedIn, gagnée par LinkedIn en 2022 sur le terrain contractuel).
- **Meta (Facebook/Instagram/WhatsApp)** : uniquement API officielles (Graph API, Lead Ads, WhatsApp Business API).
- **Sources ouvertes sûres** : OpenStreetMap (licence ODbL : attribution), registres publics d'entreprises, sites web des entreprises (pages publiques, en respectant `robots.txt`), API de fournisseurs (Apollo, Hunter, Google Places…) via des clés.

### 3.4 Responsabilité : qui est « responsable de traitement » ?
- **SaaS** : le client est responsable de ses campagnes, tu es **sous-traitant** → il faut un **accord de traitement des données (DPA)** et une **politique d'usage acceptable**.
- **Licence** : le client est seul responsable ; le contrat doit le dire clairement.

### 3.5 Ton statut (point bloquant pour vendre)
Sans entreprise enregistrée, impossible de signer des contrats solides, d'encaisser proprement (Stripe n'est pas disponible au Mali) ou de facturer à l'international.
Recommandation : créer une structure à l'**API-Mali (guichet unique, Bamako ; entreprise individuelle ≈ 72 h, ≈ 8 400 FCFA)** — entreprise individuelle pour démarrer vite, ou SARL si associés/investisseurs. Pour l'encaissement : Stripe, Paddle et Lemon Squeezy ne servent pas un marchand malien (Lemon Squeezy ferme en mars 2027). Pistes : PayDunya, CinetPay ou Hub2 (Orange Money, Moov, cartes ; RCCM et compte bancaire malien probablement exigés), Payoneer pour recevoir de l'étranger, Stripe Atlas (société US) à étudier. Détail : `docs/recherche/verifications.md`.

---

## 4. Offres et fonctionnalités

| | **Formule 1 — Recherche** | **Formule 2 — Pipeline** | **Licence pays (annuelle)** |
|---|---|---|---|
| Hébergement & IA | Moi | Moi | **Client** (ses serveurs, ses clés IA et API) |
| Recherche en langage naturel, zones (1 pays / plusieurs / monde) | ✅ | ✅ | ✅ |
| Enrichissement, vérification, score expliqué | ✅ | ✅ | ✅ |
| Premier message rédigé | ✅ | ✅ | ✅ |
| Export CSV / Excel | ✅ | ✅ | ✅ |
| **Suivi complet** : pipeline (nouveau → contacté → répondu → RDV → **validé**/perdu), relances programmées, rappels, notes, historique, tableaux de bord | — | ✅ | ✅ |
| Quotas | crédits de recherche / mois | crédits plus élevés | illimité (payé par ses clés) |
| Prix (à valider) | ~29 €/mois (≈ 19 000 FCFA) | ~79 €/mois (≈ 52 000 FCFA) | dès ~1 500 €/an et par pays |

**Licence par pays** = le droit d'utiliser Nyini *pour une entreprise établie dans un pays donné*, vérifié par une **clé de licence signée** (pays + date d'expiration + nombre d'utilisateurs), contrôlée **hors ligne** (pas de dépendance à mes serveurs).

---

## 5. Stack proposée (la plus simple qui couvre SaaS + installation chez le client)

| Couche | Choix | Pourquoi (en simple) |
|---|---|---|
| Langage | **TypeScript** partout | Un seul langage pour l'interface, le serveur et les agents. |
| Application web | **Next.js** (App Router) | Pages + API dans le même projet ; rendu serveur = rapide sur mobile et connexions lentes. |
| Interface | **Tailwind + shadcn/ui**, animations **motion/react**, graphiques **Recharts** | Composants sobres et pros, faciles à personnaliser ; `prefers-reduced-motion` respecté. |
| Base de données | **PostgreSQL** + **Drizzle ORM** | Fiable, gratuit ; requêtes typées, jamais de SQL concaténé. |
| Agents en parallèle | **pg-boss** (file de tâches dans Postgres) | Pas besoin de Redis : moins de pièces à installer chez les clients licence. |
| IA | **AI SDK** (multi-fournisseur) | Claude par défaut en SaaS ; en licence le client choisit son fournisseur. |
| Services annexes | **Reacher** (vérif. email, Rust) + **Crawl4AI** (lecture de sites, Python) en conteneurs | Repris tels quels, licences MIT/Apache. |
| Authentification | **Better Auth** (email + Google), multi-organisation, rôles | Open source, auto-hébergeable. |
| Déploiement | **Docker Compose** (une commande) | Identique pour mon SaaS (un VPS) et pour l'installation client. |
| Langues | Français + anglais dès le départ (i18n) | Clients au Mali et à l'international. |

---

## 6. Architecture

```
            Utilisateur (web / mobile)
                     │
            ┌────────▼─────────┐
            │  App Next.js      │  interface, API, auth, facturation/licence
            └────────┬─────────┘
                     │ crée une « campagne »
            ┌────────▼─────────┐
            │ PostgreSQL        │  données + file de tâches (pg-boss)
            └────────┬─────────┘
                     │ tâches en parallèle
   ┌──────────────── Workers agents (Node) ─────────────────┐
   │ 0. Interprète  : texte libre → fiche cible structurée   │
   │ 1. Recherche   : interroge les connecteurs de sources   │
   │ 2. Enrichit    : site web, réseaux pro, taille, offre   │
   │ 3. Vérifie     : email (Reacher), téléphone, doublons   │
   │ 4. Note        : score 0-100 + raisons lisibles         │
   │ 5. Rédige      : 1er message adapté au canal et au pays │
   │ 6. Suit (F2)   : relances, rappels, statut → « validé » │
   │ ⚖ Garde-fou    : règles par pays appliquées partout     │
   └───────┬───────────────┬───────────────┬────────────────┘
           │               │               │
     Connecteurs      Reacher (Docker)  Crawl4AI (Docker)
     Google Places, OSM, registres publics, Apollo/Hunter (clé),
     Meta Lead Ads (opt-in), recherche web
```

Principes :
- **Connecteurs « plug-in »** : chaque source = un module avec la même interface ; on en ajoute sans toucher au reste ; chaque connecteur déclare son statut légal et les pays où il est utilisable.
- **Tout est traçable** : pour chaque prospect, la source, la date et la base légale sont enregistrées (exigé par RGPD/APDP), avec effacement sur demande.
- **Clés client chiffrées** en base (mode licence et option « apporte ta clé »).
- **Mode SaaS et mode licence = le même code**, un drapeau de configuration change la facturation (abonnement vs clé de licence).

---

## 7. Nom

**Recommandé : Nyini** — « chercher » en bambara. Court, facile à prononcer partout (« nyi-ni »), une vraie histoire (né à Bamako), sonne comme une marque tech.
Domaines libres au 22/11/2026 : **nyini.io, nyini.ai, nyini.app, nyini.co** (nyini.com est pris).
Alternatives : **Huntra** (huntra.io libre), **Leadkin** (leadkin.io libre).
→ Nom du dépôt proposé : `nyini`. (Vérifier aussi les marques déposées : OAPI pour l'Afrique francophone, EUIPO, USPTO.)

---

## 8. Direction design

Propre, épuré, international, « ne fait pas IA » : pas de dégradés violets, pas d'étincelles ✨, pas de robot.
- Fond blanc cassé, texte encre presque noir, **une seule couleur d'accent** (vert profond ou indigo sobre, à choisir), gris neutres.
- Typographie : une sans-serif nette (ex. Geist / Inter) + chiffres tabulaires pour les tableaux.
- Animations discrètes et utiles : apparition des prospects en direct pendant que les agents travaillent, compteurs, transitions du pipeline (glisser-déposer).
- Graphiques : entonnoir de conversion, prospects par pays (carte), taux de réponse par canal, score moyen par source.
- Mobile d'abord, contenu visible sans JavaScript.

---

## 9. Plan par étapes

| Étape | Contenu | Livrable |
|---|---|---|
| **0. Cadrage** (ce document) | Validation stack, nom, offres, limites légales | Ton feu vert ✅ |
| **1. Socle** | Monorepo, Docker Compose, Postgres, auth multi-organisation, i18n FR/EN, design system, CI (tests + lint), hook de démarrage cloud | App vide mais installable en 1 commande |
| **2. Cerveau v1 (B2B)** | Agent Interprète + Recherche (Google Places, OSM, web) + Enrichissement (Crawl4AI) + Vérification (Reacher) + Notation + Rédaction ; affichage en direct | 1re recherche réelle de bout en bout |
| **3. Garde-fou juridique** | Règles par pays, traçabilité source/base légale, désinscription, effacement, journal | Conformité intégrée |
| **4. Particuliers (B2C légal)** | Agent « Où est mon audience », profils pros publics, Lead Ads Meta, page de capture, messages à envoyer à la main | Le cas closers |
| **5. Suivi (Formule 2)** | Pipeline kanban, relances, rappels, statut « validé », tableaux de bord et graphiques | Formule 2 complète |
| **6. Offres & licence** | Abonnements + crédits, paiement (mobile money + carte), clé de licence signée par pays, mode « clés du client » | Prêt à vendre |
| **7. Contrats** | Voir §10 | Documents Word/PDF |
| **8. Lancement** | Audit sécurité complet, page vitrine, documentation d'installation, bêta avec 5–10 clients | Bêta payante |

À chaque étape : revue sécurité, tests, mise à jour de `PROGRESS.md` et `docs/decisions.md`.
Exécution par l'équipe d'agents (front, back, tests, sécurité, docs) en parallèle, chacun sur ses fichiers.

---

## 10. Contrats (étape 7)

Plutôt qu'un seul pavé de 50 pages, un **dossier contractuel modulaire** (~40-50 pages au total), plus clair et plus solide :
1. **Conditions générales de vente et d'utilisation SaaS** (formules 1 et 2) — objet, comptes, crédits, prix, paiement, résiliation, suspension, propriété intellectuelle, responsabilité plafonnée, droit applicable (Mali) et règlement des litiges (arbitrage OHADA / CCJA).
2. **Contrat de licence annuelle par pays** — territoire, utilisateurs, installation chez le client, clés IA et frais d'API **à sa charge**, mises à jour, support, audit, interdiction de revente, fin de licence.
3. **Accord de traitement des données (DPA)** — rôles (responsable / sous-traitant), sécurité, sous-traitants (fournisseurs d'IA), transferts internationaux, violations de données.
4. **Politique d'usage acceptable** — interdiction du spam, du harcèlement, de l'aspiration interdite, obligations de consentement selon le pays.
5. **Accord de niveau de service (SLA)** — disponibilité, support, délais.
6. **Politique de confidentialité** du site et de l'app.

Rédaction en français + anglais, au format Word et PDF, **à faire relire par un avocat** (idéalement au Mali + un confrère UE si clients européens). Nécessite que ta structure soit créée (elle est partie au contrat).

---

## 11. Décisions attendues de ta part

1. Nom : **Nyini** ou une alternative ?
2. Stack (§5) : OK ?
3. Approche particuliers (§3.2 : pas d'aspiration de profils, messages envoyés à la main) : OK ?
4. Prix indicatifs (§4) : à garder comme base ?
5. Couleur d'accent : vert profond ou indigo ?
6. Création de ta structure à l'API-Mali : en cours / prévue ?
