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
- [ ] Refonte design + logo d'après des références réelles (en cours)
- [ ] Revue sécurité du socle (en cours)

### Reste à faire (socle)
- [ ] Construire l'image Docker et lancer `docker compose` sur une machine avec Docker
- [ ] Vérifier le 1er passage de la CI GitHub
- [ ] Imposer la 2FA aux admins (TOTP disponible)
- [ ] Journaliser les connexions
- [ ] Transport email de production (dev : affichage console)
- [ ] Licence : mémoriser en base la plus grande date vue ; ajouter la vraie clé publique après keygen
- [ ] Étape 2 : proxy de sortie filtrant pour Crawl4AI et Reacher
- [ ] Reverse proxy : réécrire `x-forwarded-for`
