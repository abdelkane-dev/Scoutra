# Scoutra : barème de crédits et quotas (à partir des coûts réels)

Date : 22/11/2026. Statut : proposition à valider. Remplace le « barème indicatif » de `docs/ARCHITECTURE.md` §7.1 (500 / 2 000 crédits, 4 crédits par prospect), jugé trop mince : il donnait environ 125 prospects complets par mois à 19,99 $.

Principe : **le client reçoit beaucoup de volume, et la marge reste protégée par l'architecture (cache, petits modèles, brouillons à la demande, garde-fou de coût réel), pas par la rareté des crédits.**

Légende des sources : [V] vérifié en ligne le 22/11/2026 (URL citée) ; [H] hypothèse de travail à mesurer avec `usage_events` en bêta ; [R] repris de `docs/recherche/concurrents.md`, non revérifié aujourd'hui.

---

## 1. Coûts unitaires

### 1.1 Modèles Claude (API Anthropic, $ par million de tokens)

Vérifiés via le skill `claude-api` (table du 03/11/2026) et recoupés sur https://platform.claude.com/docs/en/about-claude/pricing le 22/11/2026 [V].

| Modèle (identifiant) | Entrée | Écriture cache 5 min | Lecture cache | Sortie | Batch API |
|---|---|---|---|---|---|
| Haiku 5.5 (`claude-haiku-5-5`), prompts ≤ 100 K tokens | 0,10 | 0,125 | 0,01 | 0,50 | −50 % entrée et sortie |
| Haiku 5.5, prompts > 100 K tokens | 0,50 | 0,625 | 0,05 | 2,50 | idem |
| Sonnet 5.5 (`claude-sonnet-5-5`) | 2,00 | 2,50 | 0,10 | 10,00 | idem |
| Opus 5.5 (`claude-opus-5-5`) | 4,00 | 5,00 | 0,20 | 20,00 | idem |

Points qui pèsent sur le coût : l'effort par défaut d'Opus 5.5 et de Haiku 5.5 est `medium` (jetons de réflexion facturés en sortie) → fixer `effort: "low"` explicitement pour extraction, notation et rédaction standard ; garder les prompts de Haiku sous 100 K tokens (au-delà, ×5 sur l'entrée) ; le cache est un préfixe : placer règles, schéma et fiche de campagne d'abord, données du prospect ensuite.

### 1.2 Recherche, lieux, vérification, crawl

| Brique | Prix unitaire | Source / statut |
|---|---|---|
| Google Places API (New), Text Search **Enterprise** (renvoie téléphone et site web), jusqu'à 20 résultats par requête | 35 $ / 1 000 requêtes (palier 0-100 K), soit **0,00175 $ par fiche** ; 1 000 requêtes gratuites par mois | [V] https://developers.google.com/maps/billing-and-pricing/pricing |
| Text Search Pro (sans téléphone ni site) | 32 $ / 1 000 requêtes, 5 000 gratuites par mois | [V] idem |
| Place Details Enterprise (à éviter : le Text Search Enterprise donne déjà les champs utiles) | 20 $ / 1 000 requêtes | [V] idem |
| Place Details Essentials | 5 $ / 1 000 | [V] idem |
| Serper (recherche Google) | 0,30 à 1,00 $ / 1 000 requêtes selon le paquet (50 K = 50 $, 2,5 M = 1 250 $) ; crédits valables 6 mois | [V] https://serper.dev/ ; barème détaillé relevé sur un blog tiers : https://keirolabs.cloud/blog/serper-api-guide-2026 |
| Brave Search API | 5 $ / 1 000 requêtes, 50 req/s | [V] https://api-dashboard.search.brave.com/documentation/pricing |
| Tavily | 0,008 $ par crédit (recherche basique = 1 crédit) | [V] https://docs.tavily.com/documentation/api-credits |
| SearXNG auto-hébergé | 0 $ de licence ; coût serveur + proxys ; fiabilité variable (blocages des moteurs) | [H] |
| Overpass / OSM | Gratuit, mais l'instance publique est limitée (10 000 requêtes et 1 Go par jour) et l'**usage commercial doit passer par un serveur auto-hébergé ou payant** | [V] https://wiki.openstreetmap.org/wiki/Overpass_API |
| Crawl4AI auto-hébergé (Apache-2.0) | CPU : serveur 8 vCPU / 16 Go ≈ 16,49 €/mois (Hetzner CX43) ; avec Chrome sans interface et 30 % d'usage, ≈ 100 000 sites par mois et par nœud → **≈ 0,0003 $ par site**, ramené à 0,001 $ avec marge d'erreur | [V] prix serveur https://costgoat.com/pricing/hetzner ; débit [H] |
| Reacher auto-hébergé | Serveur léger + IP dédiée avec le **port 25 sortant ouvert** (souvent bloqué par défaut chez les hébergeurs : à demander) ; ≈ 0,0003 à 0,0008 $ par vérification | [H] ; la licence de Reacher n'est pas claire sur sa page de prix (https://reacher.email/pricing) : **à faire valider par un juriste avant production** (règle du projet : pas de code AGPL repris ; ici il s'agit d'un service séparé non modifié) |
| Vérification payante de secours (Hunter : 0,5 crédit par adresse) | ≈ 0,012 à 0,025 $ par adresse selon le forfait | [V] https://hunter.io/pricing |
| Enrichissement tiers optionnel (Hunter, Apollo) | Crédits du **client** (clés du client, pas de coût pour Scoutra) | ARCHITECTURE §5.2 |
| Paiement | ≈ 4 % + 0,30 $ par transaction (carte internationale, conversion) | [H] à confirmer avec le prestataire retenu |

---

## 2. Coût d'UN prospect livré

Définition d'un prospect « livré » : trouvé, dédoublonné, enrichi (site, téléphone, adresse, signaux), contact vérifié (statut de l'e-mail, format du téléphone), noté avec raisons. Les prospects rejetés en cours de route (hors cible, sans contact) sont facturés **à Scoutra**, pas au client : leur coût est inclus ci-dessous (« candidats par prospect livré »).

### 2.1 Hypothèses de calcul (tokens, rendement)

| Étape | Agent / modèle | Volume type | Coût unitaire |
|---|---|---|---|
| Interprétation (une fois par campagne) | Opus 5.5, effort medium | 3 000 tokens en entrée, 3 000 en sortie (réflexion comprise) | **0,072 $ par campagne**, amorti sur 20 à 500 prospects |
| Extraction / enrichissement | Haiku 5.5, effort low | 5 000 à 14 000 tokens de markdown nettoyé + 1 500 de préfixe en cache ; 500 à 1 800 en sortie | 0,0008 à 0,0023 $ par site |
| Notation | Code (score déterministe) + ajustement IA borné | Haiku par défaut : 1 500 entrée + 800 cache + 400 sortie | 0,0004 $ ; si Sonnet : 0,0081 $ (0,0040 $ en Batch) ; réservé aux cas limites (≈ 20 %) |
| Rédaction du message | Haiku : 1 200 entrée + 1 500 cache + 500 sortie ; Sonnet effort low : mêmes entrées, 450 sortie ; Opus medium : 1 000 sortie | | Haiku **0,0004 $** ; Sonnet **0,0071 $** (0,0035 $ en Batch) ; Opus **0,0251 $** |
| Recherche de candidats | Places Enterprise : 0,00175 $ par fiche ; web : 1 à 6 requêtes à 0,0003 / 0,001 / 0,005 $ | 1,2 à 3 candidats traités par prospect livré selon le filtrage préalable | voir 2.2 |
| Crawl | Crawl4AI, 4 pages par site | | 0,0003 à 0,004 $ |
| Vérification | Reacher + MX + `libphonenumber-js` | | 0,0003 à 0,0008 $ ; 0,012 $ si repli payant |

### 2.2 Coût par prospect livré, B2B (par agent)

| Agent | Bas (OSM + SearXNG, cache partagé 50 %, Haiku) | **Moyen (Places + Serper, optimisé)** | Haut (pire cas : web seul à 5 $/1 000, pas de cache, API de vérification payante, Sonnet partout) |
|---|---|---|---|
| Interprétation amortie | 0,0001 | **0,0005** | 0,0036 (campagne de 20) |
| Recherche | 0,0008 | **0,0032** | 0,0350 |
| Crawl | 0,0003 | **0,0008** | 0,0040 |
| Extraction | 0,0009 | **0,0017** | 0,0046 |
| Vérification | 0,0003 | **0,0008** | 0,0120 |
| Notation | 0,0004 | **0,0019** | 0,0081 |
| Rédaction (message standard Haiku, généré pour ≈ 60 % des prospects) | 0,0002 | **0,0005** | 0,0116 (Sonnet, 100 %) |
| **Total ($)** | **≈ 0,003** | **≈ 0,0094** | **≈ 0,079** |

Lecture : à l'état « moyen optimisé », **un prospect complet coûte environ 1 cent**. Le « haut » est un pire cas volontairement cumulé : il justifie le garde-fou de coût du §4.6, il n'est pas un scénario courant.

### 2.3 B2C (signaux publics via moteurs de recherche, jamais de liste de personnes aspirée)

| Agent | Bas | **Moyen** | Haut |
|---|---|---|---|
| Interprétation amortie | 0,0001 | 0,0005 | 0,0036 |
| Recherche (8 à 10 requêtes par prospect livré : rendement faible) | 0,0010 (SearXNG) | **0,0050** (SearXNG d'abord, Serper en repli) | 0,0500 (Brave) |
| Classement des extraits (Haiku, ≈ 15 extraits examinés) | 0,0007 | 0,0014 | 0,0040 |
| Lecture de la page publique | 0,0003 | 0,0008 | 0,0030 |
| Extraction + vérification | 0,0008 | 0,0016 | 0,0060 |
| Notation + message (Haiku) | 0,0008 | 0,0010 | 0,0120 |
| **Total ($)** | **≈ 0,0037** | **≈ 0,0103** | **≈ 0,080** |

Le B2C coûte à peu près autant que le B2B moyen : la recherche domine (rendement faible), alors que dans le B2B ce sont la recherche de lieux et la rédaction.

### 2.4 Où sont les coûts, et comment les réduire

Effet des leviers sur le B2B « moyen » (de 0,0188 $ sans optimisation à 0,0094 $ avec) :

| Levier | Gain | Remarque |
|---|---|---|
| **Rédaction à la demande, modèle rapide par défaut** (Haiku au lieu de Sonnet pour 100 % des prospects) | −0,0066 $ (le plus gros) | Sonnet « soigné » et Opus « premium » en option payante (§3). À valider par un test à l'aveugle sur 100 messages ; si Haiku déçoit, basculer le défaut sur Sonnet effort low et réduire les quotas d'environ 15 % |
| **Préfiltrage par le code avant crawl** (catégorie, pays, taille, mots-clés de l'extrait) | −0,0010 à −0,0020 $ | Passe de 2 à 1,3 candidats traités par prospect livré |
| **Cache partagé de données publiques d'entreprises** (site, catégorie, téléphone de standard, signaux du site ; **jamais** de données de personnes ni de contacts nominatifs partagés entre organisations) | −0,0015 $ à 30-50 % de réussite | Même mécanique que le cache de vérification par `value_hash` déjà prévu. À faire valider côté RGPD : on ne mutualise que des faits sur des entreprises |
| **SearXNG + OSM d'abord**, Places et Serper en repli | −0,002 à −0,004 $ | OSM exige un serveur Overpass dédié (limites de l'instance publique) |
| **Petit modèle par défaut** (extraction, notation Haiku ; Sonnet seulement sur les cas limites) | −0,006 $ | `fast` partout sauf cas limite |
| **Prompt caching** (règles + schéma en préfixe) | −30 à −60 % sur la part LLM | Vérifier `cache_read_input_tokens` en production |
| **Batch API (−50 %)** pour notation et rédaction des grosses campagnes lancées « en différé » | −0,002 à −0,004 $ | Option « résultats d'ici quelques heures » |
| Effort `low` explicite sur tous les agents sauf l'interprète | évite le surcoût de réflexion | Défaut `medium` sur Opus 5.5 et Haiku 5.5 |

Coûts dominants, par ordre : recherche (Places / web) ≈ 34 %, notation + extraction ≈ 38 %, rédaction ≈ 5 % (grâce à Haiku et à la génération à la demande), le reste est marginal. **Conséquence de design pour l'architecture** : passer la Rédaction du niveau `strong` (Opus) au niveau `fast` par défaut, avec escalade `balanced` / `strong` à la demande ; garder Opus pour l'Interprète (0,072 $ une fois par campagne, rentable).

---

## 3. Définition du crédit

**1 crédit = 1 prospect livré, prêt à contacter** : trouvé, enrichi, contact vérifié, noté avec raisons, et message d'accroche standard inclus (généré à la demande, 3 régénérations par prospect incluses).

Pourquoi cette définition :
- Lisible : le client compte des prospects, pas des étapes. Pas de double monnaie (Clay a deux monnaies, Actions et Data Credits, jugées complexes [R]).
- Équitable : **pas de résultat = pas de débit** (modèle Clay, Hunter, Apollo [R]). Une recherche qui ne trouve rien, un prospect hors cible, un doublon : 0 crédit.
- Vérification et message **inclus** : ils coûtent ≈ 0,001 à 0,002 $ avec les petits modèles, donc les facturer à part ajouterait de la complexité pour un gain nul. Seules les options de qualité supérieure (Sonnet, Opus) sont en supplément, parce que leur coût est 10 à 25 fois plus élevé.
- Le crédit vaut ≈ 0,02 $ au tarif du forfait pour un coût moyen ≈ 0,0094 $ : on respecte la règle « prix en crédits ≥ 2 × le coût marginal » de l'architecture (§7.1).

Règles de livraison (pour que le « pas de résultat, pas de débit » soit vérifiable) : un prospect est **livré** s'il passe le seuil de score de la campagne ET a au moins un canal de contact autorisé par le moteur de règles du pays. Sinon il est écarté sans débit.

Unités fractionnaires : le grand livre compte en **millicrédits** (1 crédit = 1 000 mc), l'interface montre des crédits entiers (décimales seulement dans le détail).

---

## 4. Quotas, packs, usage équitable

### 4.1 Quotas par formule (par mois)

| | **Recherche 19,99 $** | **Pipeline 49,99 $** | **Licence 1 990 $/an/pays** |
|---|---|---|---|
| Crédits inclus par mois | **1 000** (≈ 1 000 prospects complets) | **3 000** | Pas de crédits : illimité, coûts d'API à la charge du client |
| Message standard | inclus (3 régénérations / prospect) | inclus | inclus |
| Message soigné (Sonnet) | +1 crédit | +1 crédit | clé du client |
| Message premium (Opus) | +3 crédits | +3 crédits | clé du client |
| Relance IA (brouillon, formule 2) | n/a | 1 crédit par brouillon ; rappels, changements d'étape, notes, tableaux de bord : **0 crédit** | inclus |
| Utilisateurs inclus | 1 | 3 (+9,99 $/mois par siège supplémentaire, avec +500 crédits) | 10 (+99 $/an par utilisateur) |
| Campagnes simultanées | 2 | 5 | illimité |
| Prospects max par campagne | 500 | 1 500 | illimité |
| Plafond journalier (usage équitable) | 150 prospects par jour | 400 prospects par jour | limité par les quotas des clés du client |
| Aperçu gratuit de la cible | 20 candidats (nom + lieu, sans enrichissement) par campagne | idem | idem |
| Interprétation / affinage de la cible | gratuit, 20 par jour (coût réel 0,07 $) | 50 par jour | illimité |
| Export CSV / Excel | illimité, gratuit | illimité, gratuit | illimité |
| Report des crédits non utilisés | 50 % de l'octroi mensuel reporté **un mois**, le reste expire | idem | n/a |
| Pipeline (formule 2) | non | oui | oui |

Autres actions : doublon déjà livré à l'organisation : 0 ; rafraîchir un prospect de plus de 90 jours : 0,25 crédit ; vérifier une liste importée par le client : 0,1 crédit par adresse ; lot de 10 lieux « Où est mon audience » (B2C) : 1 crédit.

### 4.2 Packs de crédits supplémentaires (abonnés)

| Pack | Prix | Prix par crédit | Validité | Marge brute à 100 % d'usage (coût moyen) |
|---|---|---|---|---|
| 500 crédits | 14,99 $ | 0,030 $ | 12 mois | ≈ 63 % |
| 2 500 crédits | 59 $ | 0,0236 $ | 12 mois | ≈ 56 % |
| 10 000 crédits | 199 $ | 0,0199 $ | 12 mois | ≈ 49 % |
| Au-delà de 10 000 par mois | sur devis (ou passage à la **licence** si un seul pays : 1 990 $/an revient à ≈ 166 $/mois) | | | |

Les packs coûtent plus cher par crédit que le forfait pour ne pas le cannibaliser, restent sous le prix des concurrents (§4.4) et ne sont pas soumis au report mensuel (12 mois). Ils consomment après les crédits du forfait qui expirent.

### 4.3 Marge brute

Hypothèses [H] : paiement 4 % + 0,30 $ (≈ 1,10 $ sur la formule 1, 2,30 $ sur la 2) ; coûts fixes par client (stockage, support, flux temps réel) 0,60 $ / 1,20 $ ; marge = prix − paiement − coûts fixes par client − coûts de production (IA + API + serveurs variables). TVA exclue.

| Cas | F1 : coût | F1 : marge | F2 : coût | F2 : marge |
|---|---|---|---|---|
| **Typique** (F1 : 45 % des crédits consommés ; F2 : 55 % ; mélange de sources à ≈ 0,008 $ par crédit) | 3,60 $ | **14,69 $ soit 73 %** | 13,20 $ | **33,29 $ soit 67 %** |
| 100 % consommé, mix « bas » (OSM, SearXNG, cache) | 3,10 $ | 15,19 $ soit 76 % | 9,30 $ | 37,19 $ soit 74 % |
| **Extrême : 100 % consommé, coût moyen** (0,0094 $) | 9,40 $ | **8,89 $ soit 44 %** | 28,20 $ | **18,29 $ soit 37 %** |
| 100 % consommé, pire cas (0,079 $ par crédit) **sans garde-fou** | 78,90 $ | −60,61 $ (perte) | 236,70 $ | −190,21 $ (perte) |
| 100 % consommé, pire cas **avec garde-fou de coût** (§4.6 : plafond 9 $ / 26 $) | 9,00 $ | **9,29 $ soit 46 %** | 26,00 $ | **20,49 $ soit 41 %** |

Seuil de rentabilité de la plateforme : coûts fixes de départ estimés à ≈ 150 $/mois (2 à 3 serveurs, Postgres, supervision) [H] ; contribution ≈ 9 à 18 $ par abonné → **≈ 10 à 15 abonnés**. Un nœud Crawl4AI de ≈ 17 €/mois absorbe l'ordre de 100 000 sites par mois [H].

### 4.4 Comparaison aux concurrents au même prix

Les comparaisons portent sur le **nombre de crédits**, pas sur l'identité des données : Apollo et Lusha possèdent une base de contacts nommés ; Scoutra découvre en direct à partir de sources publiques (entreprises, contacts génériques, signaux), donc moins de décideurs nommés par prospect. Avantage de Scoutra : un prospect complet (vérifié, noté, avec message) pour 1 crédit.

| Prix mensuel | Concurrent | Ce qu'on obtient | Scoutra au même prix |
|---|---|---|---|
| ≈ 20 $ | Aucun forfait payant à ce prix. Offres gratuites : Apollo Free 900 crédits **par an** (≈ 75/mois), Hunter Free 50 crédits/mois, Lusha Free 40 crédits/mois [V] https://www.apollo.io/pricing , https://hunter.io/pricing , https://www.lusha.com/pricing/ | 40 à 75 crédits/mois | **1 000 prospects complets**, soit 13 à 25 fois plus |
| ≈ 49 $ | Apollo Basic 49 $/utilisateur/mois (facturé annuellement) : 2 500 crédits/mois (30 000/an), 1 crédit par e-mail, **8 par téléphone**, un siège [V] | ≈ 280 contacts avec e-mail + téléphone, ou 2 500 e-mails | **3 000 prospects complets** avec 3 utilisateurs, pipeline et messages |
| ≈ 49 $ | Hunter Starter 49 $/mois (34 $ en annuel) : 2 000 crédits (1 crédit = 1 e-mail trouvé, 0,5 pour vérifier) [V] | 2 000 e-mails trouvés, ou 4 000 vérifications | 3 000 prospects, noté + message + pipeline |
| ≈ 37 à 52 $ | Lusha Starter / Pro (chiffres de blog, à revérifier) [R] | non vérifié | idem |
| 167 $ | Clay Launch (facturé annuellement), deux monnaies Actions et Data Credits [R] | non vérifié | Pour ≈ 109 $ : F2 + 1 pack de 2 500 = 5 500 prospects complets |

### 4.5 Report, expiration, équité

- Crédits du forfait : 50 % de l'octroi reportés un mois ; consommés en premier ceux qui expirent le plus tôt (FIFO par date d'expiration).
- Packs : 12 mois.
- Annulation d'abonnement : les packs restent utilisables jusqu'à leur échéance en lecture + export + consommation, mais sans les fonctions du forfait.
- Essai : 100 crédits sans carte, plafonnés à 1 $ de coût réel, B2B uniquement sans Places (anti-abus).

### 4.6 Garde-fou de coût réel (le point qui rend les gros quotas sûrs)

Chaque appel écrit déjà un `usage_events` (tokens, coût, modèle). On y ajoute un **plafond de coût réel par organisation et par période** : F1 9 $, F2 26 $, packs : 50 % du prix du pack. Comportement progressif :
1. À 70 % du plafond : bascule automatique vers les sources et modèles les moins chers (SearXNG et OSM avant Places et Serper, Haiku partout, messages standard seulement).
2. À 100 % : les campagnes en cours se terminent avec les sources gratuites ; les nouvelles sont refusées avec proposition de pack ou de clés du client (BYOK).
3. Alerte interne si le coût moyen par crédit d'une organisation dépasse 2 × la cible (0,019 $).

Sans ce garde-fou, un utilisateur qui consomme 100 % avec un mix coûteux ferait perdre de l'argent (tableau 4.3) ; avec lui, le plancher de marge est d'environ 41 à 46 %.

---

## 5. Couverture par région

Les évaluations ci-dessous sont des **hypothèses de terrain à valider par un échantillon de 200 fiches par ville et par pays** avant la bêta (aucune mesure sur Scoutra n'existe encore). Le statut légal de chaque source est à faire valider par un juriste (conventions du projet : chaque connecteur déclare statut et pays).

| | **Afrique de l'Ouest** (Sénégal, Côte d'Ivoire, Mali, Ghana, Nigeria, Bénin, Togo…) | **Europe** | **Amérique du Nord** |
|---|---|---|---|
| Découverte d'entreprises | Google Places : bon dans les capitales et grandes villes (commerces, restaurants, hôtels, cliniques, écoles), faible ailleurs. OSM : couverture variable, peu de balises téléphone ou site web → **instance Overpass dédiée** et usage en complément. Registres OHADA/RCCM : rarement en API, **ne pas compter dessus en v1** [R]. OpenCorporates : partiel | Registres **gratuits et fiables** : SIRENE et API Recherche d'entreprises (France), Companies House (Royaume-Uni), OpenCorporates, TED [R]. Places en complément pour le commerce local | Google Places excellent ; SEC EDGAR (sociétés cotées), SAM.gov (marchés publics) ; registres d'État très hétérogènes (OpenCorporates) [R] |
| Présence web (crawl, e-mail) | Beaucoup de PME n'ont **qu'une page Facebook ou un numéro WhatsApp** : peu de sites à crawler, peu d'e-mails | Sites quasi systématiques, e-mails génériques vérifiables | Sites systématiques ; concurrence forte (Apollo, ZoomInfo) |
| Canal dominant | **Téléphone / WhatsApp** : vérification du format (`libphonenumber-js`), pas de SMTP | E-mail, puis téléphone | E-mail |
| Impact sur le coût (par rapport au « moyen » 0,0094 $) | **≈ −20 %** : peu de crawl ni de vérification SMTP ; recherche Places + OSM | **≈ −20 %** : les registres gratuits remplacent Places | **≈ +20 %** : Places dominant, plus de requêtes web |
| Impact sur la qualité | Taux de contact « e-mail vérifié » plus faible ; compenser par le téléphone et un **score de joignabilité** adapté au pays | Très bon, avec filtrage des adresses de personnes non diffusibles (SIRENE) | Bon ; règles strictes (CASL au Canada, CAN-SPAM, CCPA) gérées par le moteur de règles |
| À prévoir | Serveur Overpass ; échantillons par ville ; langues locales (français, anglais, haoussa, wolof selon zone) ; paiement local (mobile money) pour l'abonnement ; Places sur zones urbaines uniquement | Clés des registres ; attribution et licences (Etalab, OGL) ; listes d'opposition ; RGPD | Compte Google Cloud avec quota Places relevé ; suivi de la facture Places par organisation |

Même crédit partout : écarts de coût absorbés par la moyenne et par le garde-fou (§4.6). Pas de tarif par région, pour garder le barème lisible. Asie : plus tard (Places, OSM et registres ouverts à étudier pays par pays).

---

## 6. Recommandations d'implémentation

1. **Unités du grand livre** : `credit_ledger` en **millicrédits entiers** (BIGINT), jamais de flottants ; colonne séparée `cost_microusd` (coût réel de production) pour mesurer la marge par organisation, par campagne et par connecteur. Types d'événements : `grant` (octroi mensuel, date d'expiration), `rollover`, `pack_purchase` (12 mois), `reserve`, `consume`, `refund`, `expire`, `adjust`. Une ligne de portefeuille (« seau ») par origine de crédits, consommation FIFO par expiration.
2. **Réserver puis rembourser** (déjà dans ARCHITECTURE §7.1) : à l'estimation au lancement, réserver `budget_campagne` (borne P90) ; chaque prospect qui passe à l'état `delivered` convertit 1 000 mc de réservation en `consume` ; à la fin, `refund` du reste. `idempotency_key` = `campagne | prospect | rôle` pour qu'une reprise de tâche ne facture pas deux fois. Un prospect jamais livré ne consomme rien.
3. **Budget par campagne** : le client fixe un maximum de crédits (« ne pas dépasser N ») et un maximum de prospects ; arrêt propre à 100 %, pause et notification à 80 %.
4. **Estimation avant lancement** : afficher une **fourchette** « environ 180 à 260 crédits pour 200 prospects ; vous ne payez que les prospects livrés », calculée à partir des statistiques de rendement mesurées (par pays, type B2B/B2C, connecteurs) et du `cost` déjà présent dans le manifeste de chaque connecteur ; coût IA estimé avec `countTokens` avant appel. Au début, utiliser des rendements par défaut prudents (40 % de livraison), les remplacer par les mesures du bêta.
5. **Mesure continue** : tableau interne coût moyen par crédit, par formule, par région, par connecteur ; alerte si > 0,019 $ par crédit sur 7 jours ; recalibrer quotas et packs chaque trimestre à partir de `usage_events` (les chiffres de ce document sont des hypothèses [H] jusque-là).
6. **Garde-fou de coût réel** (§4.6) implémenté dans le planificateur de connecteurs : le sélecteur ne retient un connecteur payant que si le plafond de coût de l'organisation le permet.
7. **Mode licence** : même moteur, `credit_ledger` désactivé, mais **estimation de coût affichée** à partir des mêmes manifestes (le client voit ce que coûtent ses clés : de l'ordre de 0,003 à 0,02 $ par prospect, soit environ 30 à 200 $ pour 10 000 prospects). Argument de vente de la licence.
8. **Contrôle côté serveur** de tous les quotas (campagnes simultanées, plafond journalier, formule) ; pas seulement masqués dans l'interface.
9. **Changements à reporter dans ARCHITECTURE.md** (non faits ici, un seul fichier écrit) : niveau de la Rédaction `fast` par défaut ; notation Haiku avec escalade Sonnet ; effort `low` explicite ; octroi 1 000 / 3 000 ; barème §7.1 remplacé par le tableau ci-dessous.
10. **À revérifier avant mise en production** : prix et identifiants Anthropic (`claude-api`), grille Places (les paliers de volume baissent le coût au-delà de 100 K requêtes par mois), licence de Reacher, tarifs Serper, ouverture du port 25 chez l'hébergeur.

---

## Barème proposé

| Élément | Formule 1 Recherche (19,99 $/mois) | Formule 2 Pipeline (49,99 $/mois) | Licence pays (1 990 $/an) |
|---|---|---|---|
| Définition du crédit | 1 crédit = 1 prospect livré (enrichi + vérifié + noté + message standard) ; pas de résultat = pas de débit | idem | sans objet (illimité) |
| Crédits par mois | **1 000** | **3 000** | illimité, clés du client |
| Prix effectif par crédit | 0,020 $ | 0,0167 $ | n/a |
| Message soigné / premium | +1 / +3 crédits | +1 / +3 | clé du client |
| Relance IA (brouillon) | n/a | 1 crédit (rappels et suivi : 0) | inclus |
| Utilisateurs | 1 | 3 (+9,99 $ et +500 crédits par siège) | 10 (+99 $/an) |
| Campagnes simultanées / prospects par campagne | 2 / 500 | 5 / 1 500 | illimité |
| Plafond journalier | 150 prospects | 400 prospects | selon clés |
| Report | 50 % un mois | 50 % un mois | n/a |
| Packs | 500 = 14,99 $ ; 2 500 = 59 $ ; 10 000 = 199 $ (valables 12 mois) | idem | n/a |
| Garde-fou de coût réel par mois | 9 $ | 26 $ | n/a |
| Coût réel par crédit (bas / moyen / pire cas) | 0,003 / 0,0094 / 0,079 $ | idem | payé par le client |
| Marge brute typique | **≈ 73 %** | **≈ 67 %** | ≈ 100 % (hors support) |
| Marge brute à 100 % d'usage (coût moyen) | **≈ 44 %** | **≈ 37 %** | n/a |
| Plancher avec garde-fou (pire cas) | ≈ 46 % | ≈ 41 % | n/a |
