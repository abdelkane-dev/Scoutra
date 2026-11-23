# Revue de sécurité — routes CRM (commits 19a90b4..fabdc80)

Date : 23/11/2026 · Lecture seule (security-auditor). **Aucun critique ni haut ; 6 moyens, 14 bas/info.**
Conformes : RLS FORCE sur les 14 tables, fonctions SECURITY DEFINER saines, apiRoute partout, portée par rôle, automatisations sans boucle, séquences sans envoi, clés API chiffrées, export CSV protégé, facturation sans invention.

| # | Gravité | Où | Problème | Correctif |
|---|---|---|---|---|
| 1 | Moyenne | `api/pipeline/route.ts:39` | Somme des valeurs castée en int → débordement → 500 pour toute l'organisation | bigint/numeric |
| 2 | Moyenne | `compliance/suppressions`, `compliance.ts` | Un membre sans 2FA peut opposer un domaine entier (ex. gmail.com) et détruire les contacts d'autres | Domaine réservé à compliance:manage, webmails exclus |
| 3 | Moyenne | `worker/campaign/search.ts`, `compliance.ts` | Opposition par domaine appliquée seulement au domaine principal | Tester le domaine de chaque email et chaque site du groupe |
| 4 | Moyenne | `sequences.ts`, `automations.ts` | Séquences continuent après opposition ; maxFollowUps non appliqué ; export garde les prospects opposés | Arrêt des inscriptions, plafond, exclusion export |
| 5 | Moyenne | `automations.ts`, `compliance.ts` | Effacement incomplet : nom dans notifications, journaux d'export, recherches | Anonymiser / purger |
| 6 | Basse | `messages/[id]/regenerate` | Plafond de régénération contournable | Compter tout, verrou |
| 7-20 | Basses/info | divers | Transitions de messages libres, écritures viewer sur vues, GET avec effet de bord, plafonds de nombre, attribution à un rôle sans lecture, CSV qui corrompt les numéros +221…, fonction worker exposée au web, chiffré conservé après révocation, dates de demandes libres, quota support par org, tone hors encapsulation, pause qui republie, indices pseudonymisés | Voir rapport détaillé de l'agent |

Statut : E1, E4, E8 conformes ; E2, E3 avec réserves ; E6, E7, E9 partiels.
