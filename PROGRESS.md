# Avancement

## Étape 0 — Cadrage (22/11/2026)
- [x] Analyse des projets open source (GitHub)
- [x] Limites légales (APDP Mali, RGPD, CGU plateformes)
- [x] Stack, architecture, plan, nom proposés → `docs/PLAN.md`
- [x] Retours du porteur : nom international, prix en $, couleurs vives, B2B+B2C, moteurs de recherche
- [x] Nom Scoutra et stack validés (22/11/2026)
- [ ] Choix de la couleur (maquettes)

## Étape 1 — Socle (en cours)
- [x] Monorepo, base de données (RLS), auth, file de tâches, Docker Compose, CI (backend-dev) — commits 676f4fc à 00c3276
- [x] Recherche concurrents et taxonomie des modèles de prospection (fait : `docs/recherche/concurrents.md`)
- [ ] Interface : design system et écrans de base (frontend-dev, après les maquettes)
- [ ] Renommage du dépôt (à faire dans GitHub > Settings)
- [ ] Refonte design + logo d'après des références réelles (fait : docs/design/, en attente du choix logo + couleur)
- [ ] Revue sécurité du socle (fait : docs/securite/revue-etape1.md ; constats 1-10, 12-14 corrigés avec tests, 195 tests, CI GitHub verte)

### Reste à faire (socle)
- [ ] Construire l'image Docker et lancer `docker compose` sur une machine avec Docker
- [ ] Vérifier le 1er passage de la CI GitHub
- [ ] Imposer la 2FA aux admins (TOTP disponible)
- [ ] Journaliser les connexions
- [ ] Transport email de production (dev : affichage console)
- [ ] Licence : mémoriser en base la plus grande date vue ; ajouter la vraie clé publique après keygen
- [ ] Étape 2 : proxy de sortie filtrant pour Crawl4AI et Reacher
- [ ] Reverse proxy : réécrire `x-forwarded-for`

## Étape 2 — Cerveau de recherche (23/11/2026)
- [x] 6 rôles + permissions effectives, type de compte + 21 secteurs ISIC
- [x] 10 connecteurs (moteurs de recherche, OSM, Google Places, registres UK/FR, crt.sh, sites web), disjoncteur, mode dégradé
- [x] 6 agents + garde-fou juridique YAML + 23 playbooks
- [x] Orchestration : crédits en millicrédits, garde-fou de coût, quotas, SSE ; API documentée (docs/api.md) ; 269 tests
- [ ] Assignation, clés API client, actions sur messages, prestataire de paiement, expiration planifiée des crédits
- [ ] Crawl4AI derrière un proxy de sortie filtrant
- [x] Revue sécurité de l'étape 2 : 20 constats traités (12 et 18 partiels), 291 tests
- [ ] Interface branchée sur l'API (en cours, frontend-dev)
