# Scoutra : recherche concurrentielle

Date : 2026-11-22. Rédigé pour cadrer le produit « ultra pro » (inspiré des leaders).

**Légende de fiabilité**
- **[C] Confirmé** : vérifié pendant cette recherche sur une page publique (URL citée).
- **[S] Supposé** : connaissance générale non revérifiée aujourd'hui, ou donnée de tiers/blog. À revalider avant de s'en servir dans un contrat, un prix ou un argumentaire.
- Les prix changent souvent : toujours revérifier sur la page officielle avant décision.

**Limites de cette recherche** : seules les pages de prix/docs accessibles via recherche web ont été lues (extraits). Plusieurs leaders (ZoomInfo, Cognism, 6sense, Bombora, Sales Navigator…) cachent leurs prix : marqués « sur devis ».

---

## 1. Analyse des leaders

### 1.1 Bases de données de contacts / sales intelligence

**Apollo.io**
- Cible : SDR, PME, startups, agences ; du solo à l'équipe de vente. [S]
- Données : base propre (annoncée > 200 M de contacts) alimentée par contributeurs (extension), partenaires, données publiques. [S]
- Trouver/vérifier : filtres (poste, techno, financement, effectif, offres d'emploi), vérification d'e-mail intégrée, scoring, assistant IA et séquences. [S] L'API MCP d'Apollo expose search, enrich, validation e-mail/téléphone, séquences, suivi visiteurs de site, offres d'emploi d'une organisation (visible dans les outils disponibles de la session). [C, outils MCP listés]
- Signaux : offres d'emploi, financement, techno, visiteurs de site (tracker de domaine), changements de poste. [S/C partiel]
- Prix public : Gratuit 0 $ (900 crédits), Basic 49 $/utilisateur/mois (annuel), Professional 79 $, Organization 119 $ (3 utilisateurs minimum). [C] https://www.apollo.io/pricing et https://www.apollo.io/insights/more-information-on-what-they-are-paying-for-in-apollo-plan-detailsusage-walkthrough
- À reprendre : recherche + enrichissement + séquences dans un seul outil ; assistant IA ; crédits par utilisateur avec plafonds (« per-user budgets », [C] même page insights) ; tracker de visiteurs.

**ZoomInfo**
- Cible : entreprises mid-market/enterprise, ventes US. [S]
- Données : base propre massive (~500 M de contacts selon eux), intention, technographie, organigrammes. [C déclaratif ZoomInfo] https://pipeline.zoominfo.com/sales/kaspr-alternatives
- Modèle : « Free to start » (ZoomInfo Lite), crédits de données et crédits IA ; recherche, lookup et « find similar » gratuits ; coût de crédits affiché avant l'exécution d'un « Agent Team ». [C] https://www.zoominfo.com/compare/seamless-ai-vs-zoominfo
- Prix : contrat médian cité ~33 500 $ [S, blog tiers] https://www.supered.io/blog/kaspr-vs-zoominfo/
- Certifications annoncées : ISO 27001, ISO 27701, SOC 2 Type II, TRUSTe. [C déclaratif] pipeline.zoominfo.com (ci-dessus)
- À reprendre : coût en crédits visible AVANT exécution d'un agent ; « find similar » (lookalike) ; certifications comme argument de confiance.

**Clay**
- Cible : growth/RevOps, agences GTM, power users « no-code ». [S]
- Principe : tableau (« table ») où chaque colonne est un enrichissement ; **waterfall** = essayer plusieurs fournisseurs (150+) à la suite jusqu'à trouver la donnée ; **Claygent** = agent IA qui navigue sur le web pour produire une donnée sur mesure. [C] https://www.clay.com/pricing
- Prix : Free (500 actions/mois, 100 crédits de données), Launch 167 $/mois (annuel), Growth 446 $/mois (annuel), Enterprise sur devis ; deux monnaies : « Actions » (orchestration) et « Data Credits » (données) ; pas de résultat = pas de débit ; recharge à +30 % ; chaque tentative de waterfall consomme une Action même sans résultat. [C] https://www.clay.com/pricing , https://pipeline.zoominfo.com/sales/clay-pricing , https://www.clodura.ai/blog/clay-pricing/
- Aussi : signaux d'intention web, push d'audiences vers les régies pub, API/CLI, serveur MCP, mode BYOK (apporter ses clés). [C] pages ci-dessus
- À reprendre : le waterfall et le « pas de résultat, pas de facturation » ; BYOK ; transparence du coût par ligne. Éviter : la double monnaie jugée complexe par les utilisateurs [C, ZoomInfo pipeline/Clodura].

**Lusha**
- Cible : commerciaux individuels, PME ; extension navigateur. [S]
- Prix : Free 40 crédits/mois ; Starter 37,45 $/mois ; Pro 52,45 $ ; Premium 299,95 $ ; serveur MCP. [C, via blog ZoomInfo] https://pipeline.zoominfo.com/sales/kaspr-alternatives (chiffres d'un concurrent, à revérifier ; un autre blog cite 29/51 $) https://www.cognism.com/blog/lusha-vs-zoominfo
- À reprendre : extension pour captation « à la volée » ; palier gratuit.

**Cognism**
- Cible : équipes EMEA exigeant la conformité RGPD ; téléphones « Diamond Verified » (vérifiés manuellement). [C déclaratif] https://pipeline.zoominfo.com/sales/kaspr-alternatives
- Données : croisement avec listes d'opposition (Do-Not-Call), couverture Europe forte. [S]
- Prix : sur devis. [C]
- À reprendre : conformité par pays (listes d'opposition DNC) intégrée à l'outil comme argument de vente.

**Seamless.AI**
- Cible : prospection en volume, temps réel. [C déclaratif]
- Principe : recherche « temps réel » (annoncé 1,9 Md de contacts) ; plan gratuit, Pro/Enterprise sur devis. [C] https://pipeline.zoominfo.com/sales/kaspr-alternatives , https://www.zoominfo.com/compare/seamless-ai-vs-zoominfo
- À reprendre : vérification au moment de la demande plutôt que base figée.

**Kaspr**
- Cible : prospection LinkedIn en Europe (extension). Prix : à partir de 49 $/siège/mois par carte ; Business 79 $ annuel / 99 $ mensuel (200 téléphones). [S, blog tiers] https://www.supered.io/blog/kaspr-vs-zoominfo/
- À reprendre : extension + crédits téléphone séparés.

**Hunter.io**
- Cible : recherche/vérification d'e-mails par domaine, PME. [C]
- Fonctions : Domain Search, Email Finder, Email Verifier, Discover (base B2B avec assistant IA), Signaux, séquences, extension, MCP, utilisateurs illimités. [C] https://hunter.io/pricing
- Prix : Free 50 crédits/mois ; Starter 49 $ (34 $ annuel, 2 000 crédits/mois) ; Growth 149 $ (104 $ annuel, 10 000) ; Scale 299 $ (209 $ annuel, 25 000). 1 crédit = 1 e-mail trouvé, échec gratuit. [C] https://hunter.io/pricing , https://www.supered.io/blog/hunter-io-pricing/
- Statuts de vérification : valid, invalid, accept_all, webmail, disposable, unknown. [C, fiche de l'API via Firecrawl Alexandria]
- À reprendre : vocabulaire de statuts d'e-mail ; « échec = gratuit » ; signaux sur les leads existants.

**Snov.io**
- Cible : PME, e-mail finder + campagnes + LinkedIn automation. Starter 39 $/mois (1 000 crédits), utilisateurs illimités ; LinkedIn et téléphone facturés à part. [C] https://www.lemlist.com/blog/snov-vs-hunter , https://moderninbound.com/blog/snov-io-vs-hunter
- À reprendre : sièges illimités.

### 1.2 Outils d'envoi / séquences

**Lemlist** : e-mail 69 $/mois (55 $ annuel), 50 000 e-mails/mois, utilisateurs illimités ; Multichannel 109 $/utilisateur (87 $ annuel) avec 400 crédits d'enrichissement/utilisateur. [C] https://www.lemlist.com/versus/lemlist-vs-waalaxy . Fort sur la personnalisation visuelle (images/vidéos). [S]

**Instantly** : cold e-mail volume, warm-up illimité ; Outreach Growth 47 $/mois (autre source 37,60 $ annuel). [C/S] https://getsliq.com/blog/lemlist-alternatives , https://www.waalaxy.com/blog/linkedin-automation-software/lemlist-alternative . Base de leads et « lookalike » intégrés selon eux. [S]

**Smartlead** : infrastructure d'envoi (boîtes illimitées, warm-up, rotation) ; Basic 39 $/mois, Pro 94 $. [C] https://getsliq.com/blog/lemlist-alternatives . Orienté agences (multi-clients). [S]

**PhantomBuster** : automatisations cloud (« phantoms ») de scraping/actions sur réseaux sociaux. [S] Prix non revérifié. **Risque** : repose sur la session de l'utilisateur sur les réseaux, ce que Scoutra s'interdit.

**Waalaxy** : LinkedIn + e-mail ; Pro 19 €/utilisateur/mois, Advanced 49 €, Business 69 € (e-mail à froid + 500 crédits de recherche d'e-mails). [C] https://www.lemlist.com/versus/lemlist-vs-waalaxy . **Risque** : automatisation de comptes LinkedIn (contraire aux CGU LinkedIn [S]) ; Scoutra ne le fera pas.

**À reprendre de cette famille** : warm-up/délivrabilité, rotation de boîtes, séquences multi-étapes, arrêt automatique sur réponse, A/B test, quotas par boîte. Pour Scoutra : on n'envoie pas depuis des comptes sociaux ; l'e-mail passe par les boîtes de l'utilisateur (OAuth Gmail/Microsoft) ou l'utilisateur copie/colle.

### 1.3 Signaux, intention, ABM

**LinkedIn Sales Navigator** : base fermée LinkedIn, alertes de poste/actualité, accès uniquement par compte LinkedIn. [S] Prix sur la page LinkedIn, non revérifié. Scoutra **n'y accède pas** (contrainte : pas de connexion aux comptes sociaux).

**Common Room** : agrège les signaux communautaires/produit (GitHub, Slack, Discord, site, CRM) vers un score de compte. [S] À reprendre : modèle « signal → personne/compte » unifié.

**6sense / Bombora** : intention d'achat B2B (Bombora : « Company Surge » via un consortium de sites d'éditeurs ; 6sense : modèles prédictifs, comptes en « phase d'achat »). Prix sur devis. [S] Non reproductible à l'identique sans consortium ; Scoutra utilise à la place des proxys publics (offres d'emploi, nouveaux contenus, techno, appels d'offres).

**Crunchbase** : financement, investisseurs, acquisitions ; API payante. [S] Prix non revérifié.

**BuiltWith / Wappalyzer** : détection de technologies par analyse du HTML/en-têtes, historique d'adoption, listes de sites par techno. [S] Reproductible en partie : détecter soi-même des technologies sur des pages publiques (empreintes) ou acheter l'API.

**Clearbit / HubSpot Breeze Intelligence** : enrichissement d'un e-mail/domaine vers des champs entreprise ; Clearbit racheté par HubSpot, devenu Breeze Intelligence. [S]

**Ocean.io** : lookalike (« trouve des entreprises comme celles-ci ») à partir d'une liste de comptes gagnés ; vectorisation de sites. [S]

**Persana, Amplemarket, Unify GTM** : outils « AI SDR / GTM » modernes combinant enrichissement waterfall, signaux et rédaction IA ; Unify cible les signaux et le « plays » automatisés. [S] Non revérifiés ; ce sont les concurrents directs de l'idée Scoutra (agents). À analyser plus finement avant lancement.

### 1.4 B2C / créateurs

**Modash, HypeAuditor, Upfluence** : recherche d'influenceurs par audience, niche, localisation, taux d'engagement, détection de faux abonnés, e-mail du créateur, gestion de campagne. [S] Prix surtout sur devis ou à partir de plusieurs centaines de dollars/mois [S]. Données issues d'APIs officielles + collecte propre. À reprendre : fiche créateur normalisée (niche, audience, engagement, contact public).

### 1.5 Écoute sociale (intentions publiques)

| Outil | Statut / prix | Source |
|---|---|---|
| F5Bot | Gratuit (alertes Reddit, Hacker News, Lobsters) ; Silver 9,99 $/mois (20 mots-clés) ; Gold 49,99 $ (200 mots-clés, flux RSS/JSON, filtre IA, Slack/Discord) [C] | https://www.buska.io/blog/affordable-social-listening-tools-2026 |
| Syften | À partir de 29,95 $/mois (3 filtres, 7 jours d'archive) ; paliers supérieurs : Slack, filtre IA, API, webhooks, MCP [C] | idem + https://okara.ai/blog/gummysearch-alternatives |
| Brand24 | Individual 199 $/mois annuel (249 $ mensuel), 3 mots-clés, 2 000 mentions [C] | https://www.buska.io/blog/affordable-social-listening-tools-2026 |
| Mention | Prix non affiché publiquement, démo [C] | idem |
| GummySearch | **Fermé le 30 nov. 2025** après changement des conditions de l'API commerciale de Reddit [C, blog tiers] | https://www.redditmaster.com/best-social-listening-tools-for-reddit |

**Leçon stratégique** : GummySearch a disparu parce que l'accès commercial à l'API Reddit a changé. Scoutra ne doit **jamais dépendre d'une seule source de signaux** ni d'une plateforme fermée : prévoir des connecteurs interchangeables, un mode dégradé et un contrôle de licence par source.

---

## 2. Taxonomie des modèles de prospection

Principe commun pour tous : l'utilisateur décrit sa cible en langage naturel, un agent la convertit en **profil de cible structuré** (type d'entité, géographie, critères, signaux, canaux autorisés) puis choisit les connecteurs adaptés. Scoutra doit traiter **le type de prospect** (entreprise, personne, créateur, acheteur public, association, bien immobilier…) comme un type d'entité de premier niveau, pas seulement « entreprise + contact ».

Légende des canaux : E = e-mail, T = téléphone/SMS, F = formulaire de contact du site, P = plateforme (message sur place de marché/annonce), C = courrier postal, R = relation (intro/réseau), W = WhatsApp (seulement via opt-in / lien public « click-to-chat » sans automatisation de compte).

| Modèle | Définition | Exemples d'utilisateurs | Types de prospects | Sources légales | Signaux | Canaux typiques |
|---|---|---|---|---|---|---|
| **B2B** | Vendre à des entreprises | Closers, agences, SaaS, cabinets, ESN | Décideurs d'entreprises (PME/ETI/grands comptes) | Registres, site officiel, offres d'emploi, annuaires, presse | Levée, recrutement, techno, croissance, nouveau poste | E, F, T, R |
| **B2C** | Vendre à des particuliers | Coachs, artisans, formateurs, immobilier de détail | Particuliers (souvent **non prospectables à froid** sans consentement dans l'UE) | Demandes entrantes publiques, annonces, communautés ouvertes | Posts « je cherche… », événements de vie publics | P, réponse publique, E si opt-in |
| **B2B2C** | Vendre à une entreprise pour atteindre ses clients | Éditeurs d'app de marque blanche, fintech/assurtech, fournisseurs de plateformes | Entreprises qui servent des particuliers (banques, mutuelles, franchises) | Mêmes que B2B + annuaires de franchises | Lancement produit, ouverture de points de vente | E, F, R |
| **D2C** | Marque qui vend directement en ligne | Fondateurs e-commerce, marques de cosmétique | Clients finaux, mais aussi B2B (revendeurs) | Boutiques Shopify publiques, avis | Avis clients, trafic, tech e-commerce | E, réseaux (organique), P |
| **C2C** | Particulier vers particulier (places de marché, revendeurs) | Revendeurs, chineurs, artisans | Vendeurs/acheteurs particuliers actifs | Annonces **publiques** indexées par moteurs (sans connexion) | Annonce active, baisse de prix, stock | P (messagerie du site), réponse |
| **C2B** | Créateur/freelance/consultant vend à des entreprises | Influenceurs, développeurs freelance, rédacteurs, vidéastes | Marques qui recrutent des créateurs, entreprises avec besoin de prestation | Offres freelance, appels à projets, sites de marques, annuaires | Lancement produit, budget pub, offre « cherche freelance » | E, F, R |
| **B2G** | Entreprise vend à l'administration | Bureaux d'études, ESN, BTP, fournisseurs | Acheteurs publics, ministères, collectivités | TED, BOAMP, SAM.gov, portails nationaux | Avis de marché, date limite, attribution précédente | Portail de dépôt, E institutionnel |
| **G2B** | Administration vers entreprises (appel à candidatures, subventions) | Consultants en financement public | Entreprises éligibles à une aide | Portails d'aides, JO, données ouvertes | Ouverture d'aide, éligibilité (taille/secteur) | E, F |
| **B2N** | Vendre aux ONG/associations/fondations | Éditeurs de logiciels associatifs, traiteurs, cabinets de collecte de fonds | ONG, associations, fondations | Répertoire national des associations (France : RNA), registres de charités (UK Charity Commission, US IRS 990) | Appel à projet, subvention reçue, levée de dons | E, F, T |
| **Partenariats / distributeurs** | Trouver revendeurs, intégrateurs, agents | Fabricants, éditeurs SaaS (channel), importateurs | Distributeurs, grossistes, agents commerciaux | Annuaires sectoriels, salons, sites de revendeurs | Nouvelle gamme, expansion géographique | E, R, F |
| **Recrutement de talents** | Trouver candidats ou clients (entreprises qui recrutent) | Recruteurs, cabinets, RH | Candidats (profils **publics** : GitHub, portfolios, publications) ou entreprises qui recrutent | GitHub API, sites de portfolio, publications, offres d'emploi | Changement de poste public, contribution open source | E publique, P |
| **Investisseurs / levée de fonds** | Fondateurs cherchant des investisseurs, ou fonds cherchant des startups | Fondateurs, fonds | Business angels, VC, startups | Sites de fonds, registres (SEC Form D, Companies House), Crunchbase (licence) | Nouveau fonds, thèse publiée, levée récente | E, R (intro) |
| **Immobilier** | Vendeurs/acheteurs/bailleurs/investisseurs | Agents, mandataires, chasseurs, promoteurs | Propriétaires vendeurs, acquéreurs, investisseurs, **entreprises qui cherchent des locaux** | Annonces publiques, permis de construire (données ouvertes), DVF (France), registres | Annonce, baisse de prix, permis déposé, bail qui se termine | P, E, T selon lois locales |
| **Local business** | Commerces de proximité | Agences web locales, fournisseurs CHR | Restaurants, salons, garages, cabinets | OpenStreetMap, annuaires publics, SIRENE (établissements), pages Maps (API officielle) | Avis récents, ouverture, horaires absents, site obsolète | E, T, F, passage |

**Modèles manquants à ajouter**
- **B2E (Business-to-Employee) / avantages salariés** : vendre aux CE/RH. [S]
- **B2B marketplace / vendeurs de plateformes** : trouver des vendeurs Amazon/Etsy/Shopify pour leur vendre une prestation. [S]
- **Enchères / liquidations / entreprises en difficulté (procédures collectives)** : sources publiques (BODACC France, Insolvency Service UK). [S]
- **Succession / cession d'entreprise (M&A PME)** : dirigeants proches de la retraite (cf. exemple « manufacturiers dont le dirigeant a 60 ans et plus » dans la fiche du fournisseur de données publiques françaises, https://recherche-entreprises.api.gouv.fr). [C partiel]
- **Événementiel / salons** : exposants, conférenciers comme prospects. [S]
- **Presse / relations publiques** : journalistes, podcasteurs (sources : sites éditoriaux, bylines publics). [S]
- **Sourcing d'achats (inverse)** : l'utilisateur est l'acheteur et cherche des fournisseurs. [S]
- **Santé / professions réglementées** : annuaires officiels (RPPS en France), forte réglementation (démarchage encadré). [S]
- **Éducation / institutions** : écoles, universités, collectivités formatrices. [S]

**Règle d'architecture** : chaque modèle = un **« playbook »** (profil de cible + connecteurs + signaux + règles de conformité + canaux autorisés + modèles de message), pas du code spécifique.

---

## 3. Catalogue des signaux (« buying signals »)

Coût : Gratuit / Faible / Moyen / Élevé. Légal : OK = source publique ou API officielle ; Prudence = dépend des CGU/pays ; Non = exclu par la règle produit.

| Signal | Source publique/API accessible | Coût | Faisabilité légale |
|---|---|---|---|
| Levée de fonds | Press releases (RSS/sites), SEC Form D (EDGAR gratuit), registres nationaux de capital, Crunchbase (payant) | Gratuit à Élevé | OK (public) ; Crunchbase licence payante |
| Offres d'emploi (recrutement) | Pages carrières publiques, flux JSON-LD `JobPosting`, APIs d'agrégateurs (France Travail, Adzuna, Jooble…) [S] | Gratuit à Faible | OK ; respecter robots.txt et CGU d'agrégateurs |
| Changement de poste | Annonces/communiqués, pages « équipe », presse ; LinkedIn = **Non** | Faible | Prudence ; LinkedIn exclu |
| Nouvelle entreprise créée | Registres (Companies House, SIRENE, OpenCorporates) | Gratuit | OK (licences à lire) |
| Nouveau domaine / site | CZDS (zone files), Certificate Transparency (crt.sh/CT logs) | Gratuit | OK sous conditions CZDS ; données de domaine = pas de personne |
| Technologies utilisées/changements | Empreintes HTML/en-têtes sur pages publiques, BuiltWith/Wappalyzer (payant) | Faible à Moyen | OK |
| Croissance d'effectif | Variation d'offres d'emploi, registres (effectif par tranche), données de tiers payantes | Faible à Élevé | OK (agrégat) |
| Avis clients | Google Places API, Trustpilot (API/CGU), Yelp Fusion [S] | Faible à Moyen | Prudence : CGU interdisent souvent le stockage long |
| Actualités | Flux RSS, GDELT [S], NewsAPI-like [S] | Gratuit à Faible | OK (titres/liens ; attention au droit voisin sur extraits) |
| Intention de recherche (consortium) | Bombora/6sense (devis) | Élevé | OK mais non reproductible ; remplacer par proxys |
| Publications publiques « je cherche… » | Moteurs de recherche, Reddit via API officielle (licence commerciale), Hacker News (API gratuite), forums ouverts, F5Bot/Syften comme **briques tierces** | Gratuit à Moyen | Prudence : API Reddit commerciale payante (cause de la fermeture de GummySearch [C]) ; pas de connexion aux comptes |
| Visites de site | Script de suivi du site de l'utilisateur lui-même (de-anonymisation IP→entreprise) ; Apollo l'expose via un tracker de domaine [C] | Moyen | Prudence RGPD/ePrivacy : consentement cookies requis dans l'UE |
| Appels d'offres | TED (UE), SAM.gov (US), BOAMP (FR) | Gratuit | OK (données ouvertes) |
| Ouverture de nouveaux locaux | Permis de construire, annonces, OpenStreetMap, Google Places « nouveau » | Gratuit à Faible | OK |
| Nouveau produit / lancement | Product Hunt, GitHub releases, communiqués | Gratuit | OK |
| Activité open source | GitHub API (jetons gratuits, limites) | Gratuit | OK ; données personnelles : minimiser |
| Procédures collectives / difficultés | BODACC (FR), Insolvency Service (UK) [S] | Gratuit | OK |
| Brevets / marques | INPI (FR, API), EUIPO, USPTO | Gratuit | OK (le fournisseur « data-inpi-fr » existe côté Firecrawl [C]) |
| Marchés publics attribués | TED, SAM.gov entités/attributions | Gratuit | OK |
| Sites obsolètes / lents / sans HTTPS | Analyse technique du site (Lighthouse-like) | Faible | OK |
| Annonces C2C | Moteurs de recherche et pages publiques sans connexion | Gratuit | Prudence (CGU des places de marché) ; **jamais derrière authentification** |
| Réseaux sociaux : posts | **Non**, sauf pages publiques indexées par moteurs ; pas d'API de compte, pas de session | — | Non pour connexion/scraping authentifié |

Principe produit : **score de signal = fraîcheur × force × fiabilité de la source**, avec preuve (URL + extrait + date) affichée à l'utilisateur (« scoring expliqué »).

---

## 4. Sources de données publiques ou ouvertes

Rappel : « licence commerciale OK » doit être relue par un juriste pour chaque source avant mise en production ; ci-dessous = lecture de surface.

| Source | Couverture | Accès | Licence commerciale |
|---|---|---|---|
| **OpenCorporates** | Plus grande base ouverte d'entreprises (monde) | API (clé), « open data share-alike avec attribution OU commercial » [C] https://api.opencorporates.com/ | Oui si contrat commercial ; sinon share-alike/attribution. Lire https://opencorporates.com/terms-of-use-2/ |
| **UK Companies House** | Entreprises du Royaume-Uni, dirigeants, dépôts | API gratuite avec clé ; 600 requêtes/5 min [C] https://developer.company-information.service.gov.uk/developer-guidelines | Oui sous Open Government Licence [S] ; vérifier conditions de l'API |
| **SIRENE / INSEE et API Recherche d'entreprises (France)** | Toutes les entreprises/établissements français, effectifs en tranches, NAF, dirigeants | API gouvernementale gratuite (recherche par secteur, géolocalisation, effectif, CA, ESS) [C] https://recherche-entreprises.api.gouv.fr (via fiche Firecrawl) ; SIRENE : jeton INSEE [S] | Licence Ouverte Etalab (réutilisation commerciale OK) [S] ; **exclure les entrepreneurs « non diffusibles »** |
| **SEC EDGAR** | Sociétés cotées US, formulaires (Form D, 8-K…) | API gratuite sans clé ; max 10 requêtes/seconde, en-tête User-Agent identifiable [C] https://www.sec.gov/about/developer-resources | Domaine public US [S] |
| **SAM.gov** | Opportunités fédérales US, entités enregistrées | API publique avec clé gratuite [C] https://open.gsa.gov/api/get-opportunities-public-api/ | Oui (données publiques US) [S] |
| **TED (UE)** | Marchés publics européens | API ouverte, sans clé pour la recherche publique [S] | Oui (réutilisation, licence UE) [S] |
| **dgMarket / autres** | Marchés mondiaux (banques de développement) | Partiel, souvent payant [S] | À vérifier cas par cas |
| **Registres OHADA/RCCM (Afrique francophone)** | Variable selon pays ; RCCM national, souvent peu d'API ouvertes | Rarement en API ; consultation guichet/portails nationaux [S] | Incertain, **ne pas compter dessus pour la v1** ; passer par OpenCorporates/annuaires/presse locale |
| **Wikidata** | Entreprises notables, dirigeants, liens | SPARQL/API gratuits | Oui (CC0) [S] |
| **OpenStreetMap** | Commerces et lieux (POI), horaires, site web | Overpass API / extraits Geofabrik | Oui mais **licence ODbL** : attribution + partage à l'identique de la base dérivée [S] |
| **Common Crawl** | Archive du web (HTML) pour trouver sites, techno, textes | Accès S3 gratuit | Les données sont du contenu tiers : termes d'usage Common Crawl ; **droits d'auteur du contenu non cédés** [S] |
| **Certificate Transparency (crt.sh)** | Nouveaux certificats donc nouveaux noms de domaine | Interface/PG public ; ou flux CT directs | Données techniques publiques ; respecter limites de crt.sh [C site Sectigo https://crt.sh/] |
| **ICANN CZDS (zone files)** | Zone files de TLD (gTLD) : listes de domaines | Compte ICANN + demande par TLD, approuvée par le registre ; API de téléchargement ; **1 téléchargement/24 h/zone** ; accès d'au moins 3 mois, révocable [C] https://czds.icann.org/help , https://www.icann.org/resources/pages/zfa-2013-06-28-en | Conditions d'usage restrictives (usage légal, pas d'abus) ; pas pour revente brute [S] |
| **Offres d'emploi (APIs)** | France Travail, Adzuna, agrégateurs, JSON-LD des sites | Variable (clé gratuite/payante) | Variable ; **lire CGU de chaque API** ; JSON-LD des pages carrière = public mais respecter robots.txt |
| **Product Hunt** | Lancements de produits | API GraphQL (usage commercial : conditions spécifiques) [S] | À vérifier (restrictions de l'API) |
| **GitHub** | Dépôts, organisations, contributeurs | API REST/GraphQL avec jeton (limites) | Conditions GitHub ; **pas de spam via e-mails d'auteurs de commits** (CGU l'interdit) [S] |
| **Annuaires** (Pages Jaunes, annuaires sectoriels, chambres de commerce) | Local et sectoriel | Pages publiques, parfois API payantes | CGU souvent restrictives ; préférer sources ouvertes |
| **Google Places API** | Commerces locaux, avis, téléphone | API payante officielle | Oui via contrat Google ; **stockage limité** par CGU [S] |
| **Registres associations/charités** | France RNA, UK Charity Commission, US IRS | Ouvert | Oui [S] |

**Données personnelles** : même quand la source est « publique », la réutilisation de données de personnes est encadrée (RGPD, CCPA…). Voir section conformité en 5.2.

---

## 5. Matrice de fonctionnalités et priorités

### 5.1 Matrice (✔ = oui confirmé ou très probable, ~ = partiel, ✘ = non, ? = non vérifié)

Colonnes : LN = langage naturel ; LK = lookalike ; WF = waterfall multi-fournisseurs ; VE = vérif. e-mail/téléphone ; SC = scoring ; SG = signaux/alertes ; SQ = séquences multi-canal ; EX = extension navigateur ; CRM = intégrations CRM ; DD = déduplication ; CF = conformité par pays.

| Outil | LN | LK | WF | VE | SC | SG | SQ | EX | CRM | DD | CF |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Apollo | ✔ (assistant IA) | ~ | ✘ (waterfall optionnel annoncé via MCP) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (outils de dédoublonnage) | ~ |
| ZoomInfo | ✔ | ✔ (« find similar ») | ✘ | ✔ | ✔ | ✔ (intention) | ~ | ✔ | ✔ | ✔ | ✔ (certifs) |
| Clay | ~ (Claygent) | ~ | ✔ | ✔ (via fournisseurs) | ✔ (formules/IA) | ✔ (jobs, web intent) | ✔ (Sequencer) | ✘ | ✔ | ~ | ~ |
| Lusha | ✘ | ✘ | ✘ | ✔ | ~ | ~ | ✘ | ✔ | ✔ | ~ | ✔ |
| Cognism | ~ | ✘ | ✘ | ✔ (Diamond) | ✔ | ✔ | ✘ | ✔ | ✔ | ✔ | ✔ (DNC) |
| Seamless.AI | ~ | ✘ | ✘ | ✔ (temps réel) | ~ | ~ | ✘ | ✔ | ✔ | ✘ | ~ |
| Kaspr | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ | ✔ | ✔ | ✘ | ✔ |
| Hunter | ✔ (assistant Discover) | ✘ | ✘ | ✔ | ✘ | ✔ (Signaux) | ✔ | ✔ | ✔ | ~ | ~ |
| Snov.io | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ | ✔ | ✔ | ✔ | ~ |
| Lemlist | ✘ | ✘ | ✘ | ~ | ✘ | ✘ | ✔ (multicanal) | ✘ | ✔ | ✘ | ~ |
| Instantly | ✘ | ~ | ✘ | ✔ | ✘ | ✘ | ✔ | ✘ | ✔ | ~ | ~ |
| Smartlead | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ | ✘ | ✔ | ~ | ~ |
| Waalaxy / PhantomBuster | ✘ | ✘ | ✘ | ~ | ✘ | ✘ | ✔ (LinkedIn) | ✔ | ~ | ✘ | ✘ |
| Sales Navigator | ✔ (IA) | ✔ | ✘ | ✘ | ~ | ✔ | ✘ | ✔ | ✔ | ✘ | ✔ |
| Common Room / 6sense / Bombora | ~ | ~ | ✘ | ✘ | ✔ | ✔ | ✘ | ✘ | ✔ | ✔ | ✔ |
| Ocean.io | ~ | ✔ | ✘ | ~ | ✔ | ~ | ✘ | ✘ | ✔ | ✘ | ✔ |
| Persana / Amplemarket / Unify | ✔ | ~ | ✔ (Persana, Amplemarket) | ✔ | ✔ | ✔ | ✔ | ~ | ✔ | ✔ | ~ |

**À noter** : cette matrice est un **jugement de synthèse** : ✔ confirmé pour Apollo, Clay, Hunter, Lemlist, Waalaxy, ZoomInfo sur les points cités dans les sections 1.x ; le reste est **[S] supposé** à revalider (essai gratuit des concurrents recommandé).

### 5.2 Fonctionnalités priorisées pour Scoutra

**Indispensables v1 (sans eux, pas « au niveau »)**
1. Recherche en langage naturel → **profil de cible structuré éditable** (l'utilisateur corrige avant lancement).
2. Découverte multi-sources (registres, web, annuaires, offres d'emploi) avec connecteurs interchangeables.
3. Enrichissement basique en cascade (au moins 2 à 3 fournisseurs/sources) avec **« pas de résultat = pas de débit »**.
4. Vérification d'e-mail (syntaxe, MX, statut valid/invalid/accept_all/webmail/disposable/unknown, vocabulaire de Hunter [C]) ; téléphone : format + type de ligne.
5. Scoring **expliqué** (pourquoi ce prospect : critères, signaux, preuves avec URL).
6. Premier message rédigé par un agent, **validé par l'utilisateur avant envoi** (cohérent avec « jamais sans validation »).
7. Déduplication (domaine/SIREN/identifiant registre) et fusion.
8. Export CSV/Excel + **un** CRM (HubSpot ou Pipedrive) ou webhook.
9. Conformité de base par pays : base légale, liste d'exclusion interne, désinscription, journal d'audit, respect de robots.txt.
10. Transparence du coût : estimation des crédits avant exécution (comme ZoomInfo [C]) et plafonds par utilisateur (comme Apollo [C]).

**Indispensables v2**
11. Lookalike : « trouve des entreprises comme celle-ci » (vecteurs de site + attributs registre).
12. Signaux en temps quasi réel et alertes (offres d'emploi, levée, nouveaux domaines, appels d'offres).
13. Séquences multi-étapes par e-mail via les boîtes de l'utilisateur (OAuth), arrêt automatique à la réponse, quotas, délivrabilité (SPF/DKIM/DMARC, warm-up).
14. Formule 2 : suivi complet jusqu'à la validation du prospect (états de pipeline, relances, détection de réponse, qualification).
15. Intégrations CRM supplémentaires (Salesforce, Zoho…), Slack/Teams.
16. Extension navigateur **sans** connexion aux comptes (capture d'une page publique ouverte par l'utilisateur).
17. Playbooks par modèle (B2B, B2G, local business, immobilier, créateurs…).
18. BYOK (apporter ses clés de fournisseur) comme Clay [C].

**Différenciants**
19. Agents autonomes spécialisés (trouveur, enrichisseur, vérificateur, scoreur, rédacteur) avec **traçabilité de chaque décision** et preuve consultable.
20. Moteur de conformité par pays (UE opt-in/opt-out B2B selon pays, listes DNC, B2C restreint) qui **bloque** le canal interdit plutôt que d'avertir.
21. Couverture internationale réelle (Afrique/OHADA, Asie via annuaires/registres locaux) là où les leaders US sont faibles.
22. Boucle d'apprentissage : réponses/refus réinjectés dans le scoring et le ciblage.
23. Mode « bac à sable » avec données de démo clairement marquées « démo » (règle du porteur).
24. Serveur MCP/API de Scoutra (Clay, Lusha, Hunter, Apollo en ont déjà un [C]).

---

## 6. Synthèse : ce que Scoutra reprend (15 points actionnables)

1. **Entité de premier niveau typée** : `Target` (entreprise, personne, créateur, acheteur public, association, bien immobilier, annonce) ; le modèle de données ne doit pas supposer « entreprise + contact ».
2. **Profil de cible structuré** produit par un agent à partir du langage naturel, stocké versionné et éditable (JSON : géographie, critères, signaux, canaux interdits, volume, budget).
3. **Connecteurs de données interchangeables** avec une interface unique (`search`, `fetch`, `enrich`, `verify`), déclarant pour chacun : licence, coût, quota, pays, types d'entités. Un registre de connecteurs consultable par l'orchestrateur.
4. **Waterfall natif** : cascade de connecteurs ordonnée par coût/qualité, arrêt au premier résultat vérifié, **débit uniquement si résultat** (principe Clay [C]).
5. **Un seul grand livre de crédits** (pas de double monnaie, défaut reproché à Clay [C]) avec estimation avant exécution (ZoomInfo [C]) et plafonds par utilisateur (Apollo [C]).
6. **Provenance par champ** : chaque donnée stocke `source`, `url`, `date_collecte`, `licence`, `confiance` ; indispensable pour la conformité et le scoring expliqué.
7. **Statuts de vérification normalisés** (valid / invalid / accept_all / webmail / disposable / unknown, comme Hunter [C]) + date de dernière vérification et re-vérification avant envoi.
8. **Clé de déduplication multi-identifiants** : domaine normalisé, numéro de registre (SIREN, Companies House, CIK…), place_id ; résolution d'entité probabiliste en second niveau.
9. **Moteur de signaux** : chaque signal = `type`, `entité`, `force`, `date`, `preuve (url+extrait)`, `TTL` ; scoring = fraîcheur × force × fiabilité de la source ; alertes sur abonnement.
10. **Sources de signaux avec disjoncteur** : détection de panne/changement de licence (leçon GummySearch fermé après le changement d'API Reddit [C]) → bascule automatique et mode dégradé.
11. **Lookalike en deux couches** : attributs structurés (registre : secteur, taille, pays) + embedding du contenu du site ; entrée = liste de clients gagnés.
12. **Agents distincts avec outils limités** : Trouveur, Enrichisseur, Vérificateur, Scoreur, Rédacteur, (v2) Suiveur ; orchestrateur avec budget de crédits et journal de décisions ; chaque agent n'a accès qu'aux connecteurs autorisés par le **playbook** du modèle de prospection.
13. **Playbooks par modèle de prospection** (section 2) : configuration déclarative (entités, sources, signaux, canaux, gabarits de message, règles légales), pas de code par cas.
14. **Politique de conformité exécutable** : table `règle(pays, type_prospect, canal) → autorisé / consentement requis / interdit` appliquée avant tout envoi, avec journal d'audit, gestion des désinscriptions et exclusion des « non diffusibles » (France). Pas de connexion aux comptes de réseaux, pas d'aspiration derrière authentification (verrou technique : le collecteur n'a pas de gestionnaire de session).
15. **Envoi et suivi via les boîtes de l'utilisateur (OAuth)** + validation humaine du premier message ; suivi de la formule 2 comme machine à états (`trouvé → vérifié → contacté → relancé → répondu → qualifié/perdu`) ; export/API/MCP et intégration CRM par webhooks.

---

## 7. Points ouverts à vérifier avant décision

- Revérifier pages de prix de ZoomInfo, Cognism, Seamless, Kaspr, Lusha, Instantly (extraits incohérents entre sources tierces).
- Lire in extenso les CGU : OpenCorporates, Product Hunt, Google Places, API d'offres d'emploi, TED.
- Faire valider le moteur de conformité (UE ePrivacy par pays, CCPA, loi nigériane/ivoirienne/sénégalaise sur la protection des données…) par un juriste.
- Tester gratuitement Clay, Apollo, Unify, Amplemarket, Persana pour confirmer la matrice 5.1.
- Évaluer l'accès réel aux registres OHADA/RCCM (incertain, section 4).
