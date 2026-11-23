# Lancer et mettre Scoutra en production

Guide pas à pas, à suivre dans l'ordre. Les commandes se tapent dans un terminal.

---

## A. Essayer Scoutra

Les conteneurs Docker tournent toujours en mode production : ils exigent une adresse **HTTPS** et un envoi d'emails réel. Le plus simple pour essayer est donc de suivre directement la partie B sur un petit serveur.

Pour un développeur sur son ordinateur : section « Développement local » du `README.md` (Postgres local + `pnpm dev:web` et `pnpm dev:worker` ; les liens de vérification s'affichent alors dans le terminal).

Sans clé d'API, Scoutra marche en **mode dégradé** : uniquement les sources gratuites (OpenStreetMap, registres, nouveaux domaines), sans IA. C'est clairement indiqué dans l'app.

---

## B. Mettre en production (serveur + nom de domaine)

### 1. Ce qu'il faut acheter / ouvrir

| Élément | Conseil |
|---|---|
| Serveur (VPS) | Ubuntu 24.04, **4 Go de RAM minimum** (8 Go conseillé), 2 à 4 cœurs, 40 Go de disque. Hébergeurs : Hetzner, OVHcloud, DigitalOcean, Scaleway. |
| Nom de domaine | `scoutra.ai` (libre au 22/11/2026). Crée un enregistrement DNS **A** `app.scoutra.ai` → IP du serveur. |
| Email (obligatoire) | Compte [Resend](https://resend.com), domaine vérifié (enregistrements DNS fournis par Resend), clé API. |
| IA | Clé [Anthropic](https://console.anthropic.com) (`ANTHROPIC_API_KEY`). Mets un plafond de dépense mensuel dans la console. |
| Recherche web (au moins une) | [Serper](https://serper.dev) (le moins cher), ou Brave Search API, ou Tavily. |
| Optionnel | Google Places API (commerces locaux), Companies House (Royaume-Uni). |

> Port 25 sortant (vérification d'emails avec Reacher) : souvent bloqué par les hébergeurs. Sans lui, Scoutra vérifie la syntaxe et le domaine de l'email. À demander au support de l'hébergeur plus tard.

### 2. Préparer le serveur

```bash
ssh root@IP_DU_SERVEUR
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh            # installe Docker et Docker Compose
apt install -y git caddy                          # Caddy = HTTPS automatique
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

### 3. Installer Scoutra

```bash
git clone https://github.com/abdelkane-dev/Scoutra.git /opt/scoutra
cd /opt/scoutra
git checkout ccr-e418a790-fxs8iz
scripts/init-secrets.sh --url https://app.scoutra.ai
nano .env
```

Dans `.env`, renseigne (laisse les secrets générés tels quels) :

```
SCOUTRA_MODE=saas
SCOUTRA_ALLOW_SIGNUP=false           # passe à true à l'étape 5, après création de ton compte
RESEND_API_KEY=re_...
SCOUTRA_EMAIL_FROM=Scoutra <noreply@scoutra.ai>
SCOUTRA_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
SCOUTRA_SEARCH_PROVIDERS=serper
SERPER_API_KEY=...
GOOGLE_PLACES_API_KEY=...            # optionnel
SCOUTRA_TRUSTED_PROXIES=127.0.0.1/32 # Caddy tourne sur le serveur
```

```bash
docker compose up -d --build
docker compose ps                  # tous les services doivent être "running" (migrate : "exited 0")
curl -s http://127.0.0.1:3000/api/health
```

### 4. HTTPS avec Caddy

```bash
cat > /etc/caddy/Caddyfile <<'EOF'
app.scoutra.ai {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
EOF
systemctl reload caddy
```

Le certificat HTTPS est obtenu automatiquement.

### 5. Créer ton compte propriétaire

Le **premier compte** créé devient propriétaire. Crée-le **avant** d'ouvrir l'inscription :
1. Va sur https://app.scoutra.ai/signup, crée ton compte, vérifie ton email, crée l'organisation.
2. Active la double authentification (Paramètres > Sécurité) : elle est exigée pour les actions sensibles.
3. Ouvre l'inscription au public :

```bash
cd /opt/scoutra
sed -i 's/^SCOUTRA_ALLOW_SIGNUP=.*/SCOUTRA_ALLOW_SIGNUP=true/' .env
docker compose up -d
```

### 6. Sauvegardes (indispensable)

```bash
mkdir -p /opt/backups
cat > /etc/cron.daily/scoutra-backup <<'EOF'
#!/bin/sh
cd /opt/scoutra && docker compose exec -T postgres pg_dumpall -U postgres | gzip > /opt/backups/scoutra-$(date +%F).sql.gz
find /opt/backups -name 'scoutra-*.sql.gz' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/scoutra-backup
```

Copie aussi `.env` dans un endroit sûr (gestionnaire de mots de passe) : sans la clé `SCOUTRA_MASTER_KEY`, les clés chiffrées sont perdues.

### 7. Mettre à jour

```bash
cd /opt/scoutra && git pull && docker compose up -d --build
```

---

## C. Mode licence (client qui installe chez lui)

Sur **ton ordinateur** (jamais sur le serveur du client) :

```bash
pnpm install
pnpm license keygen --out ~/scoutra-cles      # clé privée hors du dépôt, à garder secrète
```

Puis ajoute la clé publique obtenue dans `packages/license/src/keys.ts` (ou demande-le moi dans une prochaine session), et signe une licence par client :

```bash
pnpm license sign --help                        # pays, organisation, utilisateurs, expiration
```

Le client suit la partie B avec `SCOUTRA_MODE=license`, `SCOUTRA_LICENSE_TOKEN=<sa licence>` et **ses propres** clés IA et de recherche.

---

## D. Ce qui manque encore avant d'encaisser de l'argent

1. **Paiement par carte** : module prêt, mais aucun prestataire branché. Il faut une structure juridique acceptée par un prestataire de cartes (ex. société créée via Stripe Atlas, ou prestataire acceptant le Mali). D'ici là : bêta gratuite (100 crédits d'essai offerts automatiquement).
2. **Contrats** : CGU/CGV, licence, accord de traitement des données, politique de confidentialité (pages présentes, marquées « à rédiger »). À faire relire par un avocat.
3. **Proxy de sortie filtrant** (sécurité réseau du worker) et **Crawl4AI** : recommandés avant l'ouverture à grande échelle.
4. **Purge automatique** des prospects selon la durée légale de chaque pays.
5. **Règles juridiques par pays** : à faire valider par un juriste.

## E. En cas de problème

```bash
docker compose ps                     # état des services
docker compose logs --tail 100 web    # erreurs de l'application
docker compose logs --tail 100 worker # erreurs des recherches
docker compose restart web worker
```

Au démarrage, l'application **refuse de se lancer** si un secret manque ou est trop faible : le message dans les journaux indique lequel.
