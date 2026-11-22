# Scoutra — références de design

Relevé du 22/11/2026. Captures de la page d'accueil (1920×1080, prises via Firecrawl, réduites) dans `docs/design/references/`. Le proxy de la session bloque l'accès direct à certains sites (linear.app, jsdelivr) : les captures ont donc été faites côté Firecrawl, puis lues ici.

Le but : comprendre ce qui fait qu'un SaaS « a l'air fait par une vraie équipe produit », puis en garder 2 ou 3 comme modèles pour Scoutra.

---

## 1. SaaS étudiés

### Attio — CRM — https://attio.com — `references/attio.jpg`
- **Grille** : contenu centré sur ~1180 px, hero centré, puis une fenêtre d'application de 1440 px qui déborde du pli. L'app *est* l'illustration.
- **Typo** : Inter Display (titres, ~69 px, approche serrée) + Inter (texte). Titre court en une ligne : « Welcome to agentic revenue. »
- **Couleurs** : presque monochrome (#202124 encre, gris bleutés #6F7988 / #B5BDC9), fond blanc pur. Aucune couleur décorative ; la couleur vient des données dans l'app (statuts, avatars).
- **Composants** : boutons encre rayon 10 px, bordure 1 px #D3D8DF, champ rayon 12 px, aucune ombre. Barre d'annonce noire en haut.
- **Densité** : app très dense (13 px, lignes de 28 px), landing aérée. Ce contraste fait « vrai outil ».
- **Ton** : phrases courtes, sans superlatif. « Attio is the platform that builds pipeline, advances deals, and grows accounts around the clock. »
- **À retenir** : la vraie interface comme héros, la retenue chromatique, la précision des bordures.

### Linear — gestion produit — https://linear.app — `references/linear.jpg`
- **Grille** : texte du hero **aligné à gauche** sur la même colonne que la capture d'app en dessous ; pas de centrage systématique.
- **Typo** : Inter variable, titre 64 px en deux lignes, graisse moyenne (pas de gras lourd), sous-titre gris 15 px. Berkeley Mono pour le code uniquement.
- **Couleurs** : fond #08090A, texte #8A8F98 pour le secondaire, accent indigo #5E6AD2 réservé au produit, une touche jaune #E4F222 pour les liens « New ».
- **Micro-interactions** : apparition orchestrée unique au chargement, capture d'app légèrement en perspective, raccourcis clavier montrés dans l'interface.
- **Ton** : « The product development system for teams and agents. » Factuel, pas d'adjectif.
- **À retenir** : alignement à gauche assumé, hiérarchie par la graisse et le gris plutôt que par la couleur, l'app montrée avec de vraies données (issues, noms, dates relatives « 2 min ago »).

### Clay — enrichissement GTM — https://www.clay.com — `references/clay.jpg`
- **Grille** : grande illustration 3D en pleine largeur, titre 88 px à gauche, paragraphe et CTA à droite (composition en deux colonnes décalées).
- **Typo** : Roobert (police payante, personnalité forte), approche très serrée.
- **Couleurs** : vert prairie, bleu ciel, CTA lime #CBD810 avec texte noir.
- **Preuve sociale** : bandeau de logos avec une citation intégrée dans une case (« Clay has become the orchestration layer… »).
- **À retenir** : une identité propre (illustration commandée, pas de banque d'images), CTA à fort contraste. À ne pas copier : la 3D illustrée demande un budget d'illustrateur.

### Apollo.io — base de prospects — https://www.apollo.io — `references/apollo.jpg`
- **Grille** : hero centré classique, formulaire d'inscription direct (email + Google + Microsoft).
- **Couleurs** : jaune #FFE500 pour le CTA principal sur fond blanc, gris clair pour l'encadré.
- **Ton** : orienté conversion, « No credit card required ».
- **À retenir** : réduire la friction (inscription dans le hero). À éviter : le hero générique centré sans produit visible.

### folk — CRM léger (équipe française) — https://www.folk.app — `references/folk.jpg`
- **Grille** : titre centré 1 ligne, puis capture de l'app posée sur un fond photographique gris texturé : la capture devient un « objet ».
- **Typo** : grotesque serrée, étiquette d'annonce en petites capitales entre crochets.
- **App** : kanban avec montants (« $134,000 »), étapes « Qualified / Proposal sent / Pitch scheduled », tâches « Overdue », résumé de relation. Exactement notre domaine.
- **À retenir** : le kanban commercial montré avec des montants et des échéances réels, le cadre autour de la capture.

### lemlist — outbound (équipe française) — https://www.lemlist.com — `references/lemlist.jpg`
- **Grille** : visuel d'ambiance pleine largeur (désert, base lunaire en briques) + titre à gauche, paragraphe à droite.
- **Couleurs** : orange/terre cuite saturé, CTA blanc sur fond chaud.
- **Ton** : « The only platform you need to make Outbound work. » + liste concrète de capacités sous le hero (Find & enrich leads, Spot buying intent…).
- **À retenir** : la chaleur de l'orange comme énergie commerciale ; onglets de capacités juste sous le hero.

### Common Room — signaux d'intention — https://www.commonroom.io — `references/commonroom.jpg`
- **Couleurs** : vert menthe pâle en fond de section, vert franc pour l'accent, badges pilules.
- **À retenir comme contre-exemple** : pastille au-dessus du titre, demi-titre coloré, badge pilule « Used by world-class GTM teams » : c'est précisément l'ensemble de tics qui fait « template ».

### Mercury — banque pour startups — https://mercury.com — `references/mercury.jpg`
- **Typo** : Arcadia / Arcadia Display (sur mesure), titre 62 px centré, graisse légère.
- **Couleurs** : photo d'ambiance plein écran, bouton indigo #5266EB pilule.
- **À retenir** : une police propriétaire donne immédiatement un statut « premium » ; mention légale sous le hero (« Mercury is a fintech company, not a bank ») : l'honnêteté réglementaire *fait* sérieux. Utile pour notre mention RGPD.

### Stripe — paiements — https://stripe.com — `references/stripe.jpg`
- **Grille** : **lignes de grille visibles** (filets verticaux en pointillés sur les bords de colonne), contenu aligné à gauche dans une colonne de 12.
- **Typo** : Söhne, titre en deux tons (phrase principale encre + suite grise), 48 px.
- **Données vivantes** : « Global GDP running on Stripe: 1.75381992% » (un compteur qui tourne). Le chiffre précis fait vrai.
- **Couleurs** : un seul grand élément expressif (le ruban coloré), tout le reste est sobre.
- **À retenir** : la grille visible comme structure, le chiffre exact et vivant, l'unique élément audacieux.

### Raycast — lanceur — https://www.raycast.com — `references/raycast.jpg`
- **Couleurs** : noir + rouge #FF6363 en motif diagonal unique.
- **À retenir** : une couleur de marque très vive peut porter toute la page si elle n'est utilisée qu'à un endroit.

### Resend — email développeurs — https://resend.com — `references/resend.jpg`
- **Typo** : titre en serif (contraste fort avec l'UI), sous-titre gris.
- **À retenir** : la typo seule peut faire la différence ; objet 3D unique et sobre.

### PostHog — analytics — https://posthog.com — `references/posthog.jpg`
- **Interface** : la landing *est* un faux bureau (fenêtres, icônes), ton très décalé, surlignage de mots-clés.
- **À retenir** : une personnalité assumée bat un template ; mais trop de bruit pour un outil commercial premium.

### Cal.com — prise de rendez-vous — https://cal.com — `references/cal.jpg`
- **Typo** : titre 72 px avec **petits éléments d'interface insérés dans la phrase** (photo, horloge « NYC », carte « Intro call 30m Booked »).
- **À retenir** : montrer le produit *dans* le titre ; capture de l'app dans une fenêtre Safari réaliste.

### Vercel — https://vercel.com — et Height
- Vercel : noir et blanc stricts, Geist, grille visible, tout en filets 1 px. Height a fermé son service en 2025 : on le cite pour ses vues tableau denses, plus comme site actif.

---

## 2. Design systems publics

| Système | URL | Ce qu'on en reprend |
|---|---|---|
| **Geist** (Vercel) | https://vercel.com/geist/typography | Typo nommée par usage et taille (`heading-48`, `label-14`, `copy-14`). Label 13 *tabulaire* pour les nombres. Label 14 = « style le plus courant, menus ». On adopte ce découpage Heading / Label / Copy. |
| **Radix Themes / Radix Colors** | https://www.radix-ui.com/colors | Échelles de 12 pas par couleur, avec rôle fixe par pas (1-2 fonds, 3-5 composants, 6-8 bordures, 9-10 aplats, 11-12 texte). On construit nos accents ainsi. |
| **Primer** (GitHub) | https://primer.style/foundations/typography | Police de marque **Mona Sans** (OFL, axe de largeur 75-125) ; espacements en base 4/8 ; contraste AA documenté. |
| **Polaris** (Shopify) | https://polaris.shopify.com/design/typography | Règles d'écriture de l'interface : verbes d'action, casse de phrase, messages d'erreur qui disent quoi faire. |
| **Carbon** (IBM) | https://carbondesignsystem.com/elements/2x-grid/overview | Grille 2x, densité des tableaux de données, tableaux comme composant principal d'un outil métier. |
| **Atlassian Design System** | https://atlassian.design/foundations/spacing | Jetons d'espacement 8 px, jetons de couleur sémantiques (`color.text.subtle`, `color.border`), élévations limitées à 3 niveaux. |

## 3. Galeries consultées pour situer le marché
- **refero.design** (https://refero.design) : bibliothèque de captures d'apps réelles, utile pour les écrans de tableau, kanban, fiche contact.
- **godly.website** (https://godly.website) : landings primées ; tendance 2026 = typographie forte, grilles visibles, produit en héros, couleurs franches en aplat.
- **saaspo** (https://saaspo.com) : landings SaaS classées par section (hero, pricing, FAQ) ; confirme que les pages premium ont un rythme de sections varié, pas une pile de grilles de cartes.

---

## 4. Références principales retenues pour Scoutra

### 1) Attio — pour l'application
Même métier (CRM, pipeline, enrichissement, agents). On reprend : la densité de l'app (13-14 px, lignes de 40-44 px), les bordures 1 px nettes sans ombre, les boutons encre, la couleur réservée aux données et aux états, la fenêtre d'app comme héros de la landing.

### 2) Stripe — pour la landing
On reprend : alignement à gauche dans une grille de 12 colonnes **avec les filets de grille visibles**, un seul élément audacieux par page (chez nous : un grand aplat de la couleur d'accent qui porte la capture d'app), des chiffres exacts et vivants (compteur de prospects vérifiés pendant la démo), la mention légale franche.

### 3) Linear — pour la rigueur et le mouvement
On reprend : hiérarchie par graisse et gris plutôt que par couleur, une seule animation orchestrée (la recherche qui se remplit en direct), des données relatives réalistes (« il y a 4 min », « relance J+3 »), les raccourcis clavier affichés.

**Pourquoi ces trois-là** : Attio prouve qu'un outil commercial peut être premium sans décor ; Stripe donne la structure éditoriale et le « chiffre qui fait vrai » ; Linear donne la discipline. Les références françaises du secteur (lemlist, folk) confirment l'usage de l'orange chaud et du kanban chiffré, mais leurs landings reposent sur des illustrations commandées que nous ne pouvons pas produire : on ne les copie pas.

**Ce qu'on refuse explicitement** (vu chez Common Room, Apollo, et dans l'ancienne maquette) : pastille au-dessus du titre, demi-titre coloré, hero centré sans produit, pilules partout, liste à coches orange.
