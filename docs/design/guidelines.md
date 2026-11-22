# Scoutra — charte d'usage (v2, 22/11/2026)

Règles concrètes et vérifiables. Elles s'appliquent aux maquettes (`docs/maquettes/`) et serviront de base aux jetons Tailwind/shadcn de l'app. Références : `docs/design/references.md` (Attio pour l'app, Stripe pour la landing, Linear pour la rigueur).

**Le principe** : un outil de travail sobre et précis, avec **un seul** endroit audacieux par écran (l'aplat de couleur d'accent qui porte l'app sur la landing ; le bouton d'action principal dans l'app). Tout le reste est encre, gris et filets.

---

## 1. Typographie

**Une seule famille : Mona Sans** (police de marque de GitHub/Primer, licence SIL OFL, variable : graisse 200-900, largeur 75-125). Chargée depuis Google Fonts (`family=Mona+Sans:wdth,wght@75..125,400..700`).

- Pourquoi pas Inter / Geist : ce sont les polices par défaut des générateurs d'interfaces (v0, shadcn, Claude). Mona Sans est rare en SaaS, a de vrais chiffres tabulaires (`tnum`) et un axe de largeur : on obtient un contraste titres/texte **dans une seule famille**, sans seconde police.
- Titres : largeur 108 à 112 %, graisse 600, approche négative. Texte et interface : largeur 100 %, graisse 400/500.
- Chiffres dans les tableaux, scores, montants, dates : `font-variant-numeric: tabular-nums`.
- Pas de monospace pour les étiquettes. Pas de capitales espacées. Pas d'italique.
- Repli : `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

### Échelle (nommage à la Geist : usage + taille)

| Jeton | Taille / interligne | Graisse | Largeur | Approche | Usage |
|---|---|---|---|---|---|
| `display` | 64/64 (mobile 40/42) | 600 | 112 % | -0,035 em | Titre du hero, une fois par page |
| `heading-40` | 40/44 (mobile 30/34) | 600 | 110 % | -0,03 em | Titres de section landing |
| `heading-28` | 28/34 (mobile 24/30) | 600 | 108 % | -0,02 em | Sous-sections, prix |
| `heading-20` | 20/28 | 600 | 104 % | -0,01 em | Titres de panneau, nom du prospect dans la fiche |
| `heading-16` | 16/24 | 600 | 100 % | 0 | Titre de bloc, colonne kanban |
| `copy-18` | 18/28 | 400 | 100 % | 0 | Chapeau du hero |
| `copy-16` | 16/26 | 400 | 100 % | 0 | Texte courant landing, message rédigé |
| `copy-14` | 14/22 | 400 | 100 % | 0 | Texte courant de l'app |
| `label-14` | 14/20 | 500 | 100 % | 0 | Boutons, menus, navigation, en-têtes de tableau |
| `label-13` | 13/18 | 500 | 100 % | 0 | Méta-informations, chiffres tabulaires |
| `label-12` | 12/16 | 500 | 100 % | 0,005 em | Légendes de graphique, pied de page |

Longueur de ligne : 45 à 72 caractères (`max-width: 62ch` pour le texte courant).

## 2. Grille et espacements

- **Base 4 px.** Pas autorisés : 4, 8, 12, 16, 20, 24, 32, 40, 56, 80, 120. Rien d'autre.
- **Landing** : 12 colonnes, conteneur 1200 px, gouttière 24 px, marges 20 px (mobile) / 32 px (tablette) / 40 px (bureau). Les deux bords du conteneur sont matérialisés par un **filet vertical pointillé 1 px** (#E4E6EA), comme chez Stripe : la grille est visible et assumée.
- **Alignement** : à gauche par défaut. Aucun bloc de texte centré, sauf le pied de page légal.
- Rythme vertical des sections : 120 px bureau / 72 px mobile, **mais** les sections n'ont pas toutes la même forme (voir §10).
- **App** : barre latérale 232 px, barre du haut 52 px, marge intérieure 24 px (16 px mobile), lignes de tableau 44 px, cartes kanban 12 px de marge intérieure.

## 3. Couleurs

### Neutres (communs aux deux accents)

| Jeton | Valeur | Rôle | Contraste |
|---|---|---|---|
| `--canvas` | #F5F6F7 | Fond de page, barre latérale de l'app | — |
| `--surface` | #FFFFFF | Panneaux, tableaux, cartes | — |
| `--sunken` | #EEF0F2 | Champs désactivés, piste des jauges, en-tête de tableau | — |
| `--line` | #E4E6EA | Filets, bordures par défaut | décoratif |
| `--line-strong` | #CDD1D8 | Bordure de champ, séparateur appuyé | décoratif |
| `--ink` | #12141A | Texte principal, bouton principal landing | 18,4:1 sur blanc |
| `--ink-2` | #474C57 | Texte secondaire | 8,6:1 |
| `--ink-3` | #6A707C | Texte discret, méta (jamais sous 13 px) | 4,97:1 sur blanc, 4,6:1 sur canvas |

### Accent A : Orange signal (défaut)

| Jeton | Valeur | Rôle |
|---|---|---|
| `--accent` | #FF5B1F | Aplat du hero, bouton d'action principal de l'app, barres de données, symbole du logo |
| `--accent-hover` | #EE4A0E | Survol |
| `--on-accent` | #12141A | Texte sur l'accent (5,9:1). **Le blanc est interdit sur cet orange (3,1:1).** |
| `--accent-text` | #C23A06 | Accent utilisé comme texte (5,4:1 sur blanc) |
| `--accent-soft` | #FFEDE5 | Fond de sélection, ligne active |
| `--accent-line` | #FFC9B3 | Bordure de sélection |

### Accent B : Bleu électrique

| Jeton | Valeur | Rôle |
|---|---|---|
| `--accent` | #2B59FF | Mêmes rôles |
| `--accent-hover` | #1F47E6 | Survol |
| `--on-accent` | #FFFFFF | Blanc sur bleu : 5,3:1 |
| `--accent-text` | #2348E6 | 6,7:1 sur blanc |
| `--accent-soft` | #EBF0FF | Sélection |
| `--accent-line` | #C2D0FF | Bordure de sélection |
| `--hl` | #C6F432 | Lime, **uniquement en fond sous du texte encre** (14,4:1) : surlignage d'un chiffre clé |

Les valeurs #FF5B1F et #2B59FF sont gardées : les références (lemlist pour l'orange, Mercury/Stripe pour le bleu) montrent que ces tons saturés fonctionnent s'ils restent rares. On a seulement ajouté des variantes « texte » plus sombres pour l'accessibilité.

### États (réservés, jamais utilisés comme couleur de série)

| État | Texte | Fond | Toujours avec |
|---|---|---|---|
| Vérifié / validé | #12805C (4,9:1) | #E6F4EE | icône coche + mot |
| À risque | #A15C00 (5,2:1) | #FFF3DC | icône triangle + mot |
| Échec / perdu | #C8261C (5,6:1) | #FDECEA | icône croix + mot |

Une couleur n'est **jamais** le seul porteur d'information.

### Section sombre (une seule par page landing)
Fond `--ink` #12141A, texte #E6E8EC, secondaire #9BA1AC (7,1:1), filets #262A33.

## 4. Rayons, bordures, ombres

- Rayons hiérarchisés, pas un rayon unique partout : **4 px** cases à cocher, drapeaux de pays, petites étiquettes ; **6 px** boutons et champs de l'app ; **8 px** boutons landing, menus ; **10 px** panneaux de l'app ; **14 px** fenêtre d'app présentée sur la landing. Pilule (999 px) seulement pour les avatars et l'interrupteur.
- Bordures : 1 px `--line`. Les panneaux se distinguent par la bordure, **pas par l'ombre**.
- Ombres : uniquement pour ce qui flotte. Menu/popover : `0 1px 2px rgba(18,20,26,.06), 0 8px 24px rgba(18,20,26,.10)`. Carte en cours de glissement : `0 12px 32px rgba(18,20,26,.18)`. Fenêtre d'app sur la landing : `0 30px 60px -24px rgba(18,20,26,.45)`.

## 5. Iconographie

- **Une seule famille : Lucide** (licence ISC), intégrée en symboles SVG inline (pas de police d'icônes, pas de CDN).
- Taille fixe : **16 px dans l'app, 18 px dans la navigation de la landing**. Trait **1,75 px**, extrémités et jonctions arrondies, `stroke="currentColor"`.
- Couleur : `--ink-3` par défaut, `--ink` au survol ou à l'état actif. Jamais d'icône dans un rond coloré. Pas d'icône décorative à côté d'un titre de section.
- Icônes utilisées : search, kanban-square, users, download, settings, check, x, mail, phone, message-circle, globe, building-2, user, clock, filter, plus, more-horizontal, calendar, chevron-down, shield-check, map-pin, copy, send, arrow-right (dans les liens de navigation seulement, pas dans les boutons).

## 6. Composants

- **Bouton principal** : landing = fond `--ink`, texte blanc, 40 px de haut, rayon 8, `label-14`. App = fond `--accent`, texte `--on-accent`, 32 px, rayon 6. **Un seul bouton principal visible par zone.**
- **Bouton secondaire** : fond blanc, bordure `--line-strong`, texte `--ink`.
- **Champ** : 36 px (app) / 44 px (landing), bordure `--line-strong`, focus = anneau 2 px `--accent` + bordure `--accent`.
- **Contrôle segmenté** (Entreprises / Particuliers / Les deux ; 7 j / 30 j / 90 j) : piste `--sunken`, segment actif blanc avec bordure `--line`.
- **Drapeau pays** : code ISO en `label-12` dans un rectangle 4 px, fond `--sunken`. Pas d'emoji drapeau.
- **Tableau** : en-tête `label-13` `--ink-3` sur `--sunken`, lignes 44 px, filet entre lignes, ligne active `--accent-soft` + barre gauche 2 px `--accent`.
- **Score** : nombre tabulaire `label-14` 600 + jauge 40×4 px (piste `--sunken`, remplissage `--accent`). Le détail du score est toujours accessible (fiche ou infobulle).
- **Carte kanban** : fond blanc, bordure `--line`, rayon 8, nom en `label-14` 600, méta en `label-13`. Pas d'ombre au repos.
- **Focus clavier** : `outline: 2px solid var(--accent-text); outline-offset: 2px` partout.

## 7. Graphiques (méthode du skill dataviz)

- **Choix de forme** : entonnoir de conversion = barres horizontales décroissantes ; taux de réponse par canal = barres horizontales triées ; prospects par pays = barres horizontales (pas de carte choroplèthe pour moins de 10 pays) ; évolution = ligne 2 px ; chiffre clé seul = tuile chiffre, pas de graphique.
- **Couleur selon la fonction** : une seule série → une seule teinte (`--accent`) ; la valeur mise en avant peut rester en accent et les autres passer en `--line-strong`. Pas de palette catégorielle : nos graphiques n'en ont pas besoin (les catégories sont nommées sur l'axe).
- **Marques** : barres de 8 à 12 px d'épaisseur, extrémité arrondie 4 px côté valeur, ancrées à la ligne de base ; lignes 2 px ; espacement 2 px entre barres adjacentes.
- **Étiquettes** directes à droite de chaque barre (`label-13` tabulaire, couleur texte, jamais couleur de série). Grille et axes très discrets (`--line`).
- **Accessibilité** : chaque graphique a un titre qui dit la conclusion, une table équivalente (`<table class="sr-only">` ou bascule « Voir le tableau »), et une infobulle au survol/focus sur chaque barre.
- Une seule échelle par graphique. Jamais deux axes Y.

## 8. Animations (Motion vanilla, CDN versionné)

- Bibliothèque : `motion` en ES module (`https://cdn.jsdelivr.net/npm/motion@14.14.0/+esm`). React plus tard : `motion/react`, jamais `framer-motion`.
- Propriétés animées : **`transform` et `opacity` uniquement**.
- Durées : 120 ms (survol, pression), 180 ms (ouverture menu/fiche), 240 ms (déplacement de carte), 400 ms max (séquence du hero). Courbe : `cubic-bezier(.2, .7, .2, 1)` ou ressort `stiffness 400, damping 32`.
- **Une seule séquence non déclenchée par l'utilisateur par page** : la recherche qui se remplit en direct dans le hero (agents qui passent à « terminé », lignes de prospects qui arrivent, compteurs). Pas d'apparition au défilement section par section.
- Mouvements de réponse : carte kanban qui glisse vers sa nouvelle colonne, fiche prospect qui s'ouvre, coche « copié ».
- **`prefers-reduced-motion: reduce`** : aucune translation ; état final affiché immédiatement ; les compteurs affichent leur valeur finale.
- Le contenu est **visible sans JavaScript** : l'état « caché avant animation » n'est posé que par une classe ajoutée en JS.

## 9. Ton rédactionnel

- Vouvoiement, phrases courtes, verbes d'action, casse de phrase.
- **Concret et chiffré** : « 132 adresses testées, 118 valides » plutôt que « vérification avancée ». Délais, quantités, pays, sources nommées.
- Les boutons disent ce qui se passe : « Lancer la recherche », « Ajouter au pipeline », « Copier le message ». Le toast reprend le même verbe : « Ajouté au pipeline ».
- Les erreurs disent quoi faire : « Aucun email trouvé pour ce cabinet. Le téléphone et WhatsApp professionnels sont disponibles. »
- Les limites légales sont dites franchement (comme Mercury) : « Pour les particuliers, Scoutra ne propose que les canaux autorisés dans leur pays. »
- **Mots interdits** : révolutionner, booster, propulser, supercharger, débloquer, sans effort, fluide, seamless, unlock, game-changer, magique, ultime, next-gen, « grâce à l'IA » en tête de phrase, « en quelques clics ».

## 10. Anti-signaux IA

### À bannir (visuel)
- Pastille/badge au-dessus du titre (« Nouveau ✦ … »), badges pilules partout.
- Emojis, étincelles ✨, robots, cerveaux, icônes « IA ».
- Dégradés décoratifs (violet-bleu, mesh), glassmorphism, flous d'arrière-plan, effets néon/lueurs.
- Grille de 3 cartes identiques avec icône dans un rond coloré + titre + 2 lignes.
- Même rayon et même ombre grise sur tout.
- Hero centré symétrique avec deux boutons et rien de concret dessous.
- Sections empilées toutes de la même forme (titre centré + grille).
- Un mot du titre en couleur ou en italique ; capitales espacées en sur-titre ; « 01 / 02 / 03 » sur un contenu qui n'est pas une séquence.
- Fond crème + serif + terre cuite ; fond noir + vert acide.
- Flèche « → » ajoutée à chaque bouton ; métadonnées séparées par des points médians partout.
- Liste à coches de couleur pour « rassurer ».
- Faux logos de clients, faux témoignages présentés comme réels.

### À bannir (texte)
- « Supercharge / Unlock / Seamless / Révolutionnez / Boostez / Propulsez », « La plateforme tout-en-un », « Dites adieu à… », « Imaginez… », questions rhétoriques en série, triplets d'adjectifs.
- Chiffres ronds invérifiables (« +300 % de réponses »).

### Ce qui fait « vrai produit »
- La **vraie interface** comme héros, avec des données réalistes (noms internationaux, villes, sources nommées, dates relatives, montants), même en maquette.
- Des détails précis : raccourcis clavier, horodatages (« lancée à 10:42 »), crédits restants, nombre exact de sites lus.
- Une hiérarchie assumée : un titre fort, beaucoup de gris, un seul aplat de couleur.
- Un rythme varié : hero pleine largeur → bande de faits → section en deux colonnes asymétriques → section sombre → tableau → tarifs en tableau comparatif → FAQ en liste.
- Des preuves sociales crédibles **et marquées « Données de démonstration »** tant qu'elles ne sont pas réelles.
- La conformité expliquée par pays, en tableau.

## 11. Accessibilité (AA)

- Contrastes : texte ≥ 4,5:1 (grand texte ≥ 3:1) ; éléments d'interface ≥ 3:1 ; valeurs calculées dans les tableaux ci-dessus.
- Cibles tactiles ≥ 44×44 px sur mobile (boutons, cases, onglets).
- Navigation clavier complète : lien d'évitement, ordre logique, focus visible, kanban déplaçable aux flèches gauche/droite (en plus du glisser-déposer).
- `aria-live="polite"` pour les résultats qui arrivent pendant la recherche ; `aria-pressed` sur les contrôles segmentés ; tableaux avec `<th scope>`.
- Langue déclarée (`lang="fr"`), zoom 200 % sans perte, pas de texte dans les images.
