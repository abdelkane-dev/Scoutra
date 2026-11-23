# Revue de sécurité — étape 2 (cerveau de recherche)

Date : 23/11/2026 · Périmètre : `git diff 63b95db..HEAD` côté serveur · Lecture seule (security-auditor).
**Verdict : aucun critique, 3 hauts, 8 moyens, 9 bas.**

| # | Gravité | Où | Problème | Correctif |
|---|---|---|---|---|
| 1 | Haute | `apps/worker/src/campaign/process.ts:146`, `api/campaigns/[id]/target`, `packages/core/src/target.ts` | Le public juridique vient du playbook, pas du type de prospect : modèle b2b + kinds person contourne la règle « particulier = consentement » | audience = individual dès que le prospect est une personne ; valider kinds ⊆ playbook.kinds ; test |
| 2 | Haute | `packages/connectors/src/sources/website.ts:57` | Regex HTML quadratiques : une page piégée gèle le worker partagé (~4 min pour 3 Mo) | Analyseur linéaire, troncature ~300 Ko |
| 3 | Haute (SaaS) | `api/campaigns/[id]/stream` | Flux SSE non plafonnés, interrogation toutes les 1,5 s → saturation du pool | Plafond par utilisateur/org, LISTEN/NOTIFY |
| 4 | Moyenne | `process.ts`, `search.ts`, `campaign-lifecycle.ts` | Coût réel non lié à la réservation ; mode économique figé ; abus d'essai | Arrêt quand réservé atteint, réévaluation du mode, borne de coût, limiter les essais |
| 5 | Moyenne | `target/route.ts`, `launchCampaign` | Quota maxProspectsPerCampaign contournable via PUT /target | Contrôle dans PUT /target et au lancement |
| 6 | Moyenne | `api/prospects/[id]` | Contacts d'un canal refusé affichés en clair | Ne révéler que les canaux autorisés |
| 7 | Moyenne | `packages/agents/src/drafting.ts` | Lien de phishing possible dans le brouillon ; offre hors balises | Allow-list des liens ; envelopper l'offre |
| 8 | Moyenne | `interpreter.ts`, `web-search.ts`, `target` | Pas de refus déterministe des recherches visant une personne nommée | Classifieur déterministe + test |
| 9 | Moyenne (à confirmer) | `packages/queue/src/billing-events.ts` | Événements d'abonnement rejouables / désordonnés | Table billing_events + ordre |
| 10 | Moyenne | `website.ts` | Parseur robots.txt non conforme ; erreur = tout permis | Bibliothèque RFC 9309 ; 5xx = interdit |
| 11 | Moyenne | `packages/ai/src/anthropic.ts` | Coût IA des appels échoués non journalisé | Journaliser dans finally |
| 12 | Basse | `deps.ts`, `docker-compose.yml` | Reacher bloqué par safeFetch ; worker sans sortie ; proxy filtrant absent | internalBases + proxy de sortie |
| 13 | Basse | `wallet.ts`, `finalize.ts` | Consommation après clôture de campagne | Vérifier le statut |
| 14 | Basse | quotas | Contrôles non atomiques | Verrou par organisation |
| 15 | Basse | `process.ts` | Double comptage / brouillon dupliqué en reprise | Idempotence |
| 16 | Basse | `api/campaigns/[id]` GET | GET avec effet de bord | Balayage planifié worker |
| 17 | Basse | `api/prospects/[id]` | Masquage faible des contacts non livrés | Booléen « trouvé » |
| 18 | Basse | migration 0005 | scoutra_app peut écrire les portefeuilles ; pg_notify global | Fonctions dédiées ; canal par org |
| 19 | Basse | connecteurs | sourceUrl non validée (http/https) | Validation Zod ; vérifier côté interface |
| 20 | Basse | `process.ts` | Contacts rejetés conservés, pas de purge | Purge par rétention |

Statut : E1, E2, E4 respectées ; E5, E6, E7, E8, E9 partielles ; E3, E10 hors périmètre.
Ordre conseillé : 1, 2, 3, puis 4/5/11, 6/7/8, 10, 9 avant le prestataire de paiement.
