# Design guidelines — Memory 4×4

DA validée, extraite du code et des écrans réels de Faceup (`~/faceup-server`), puis affinée sur 6 itérations du moodboard. Référence visuelle : artifact "Moodboard — Jeu tap grille (DA Faceup)". Mécanique du jeu : voir `GAME_DESIGN.md`.

## Principe directeur

Deux langages distincts et volontairement contrastés :
- **La grille (le jeu)** : carrée, plate, angles droits (radius 0), zéro couleur, zéro brillance.
- **Les contrôles (boutons, nav)** : arrondis, natifs par plateforme, jamais custom-dessinés en dur.

Ne jamais faire converger les deux — c'est ce contraste qui fait la lisibilité et le côté "léché".

## Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `bg.board` | `#1C1C1E` | Fond de l'écran de jeu (plateau). Jamais noir pur ici. |
| `card.bg` | `#000000` | Fond de carte — **identique dans tous les états** (face cachée, révélée). Jamais de bordure, jamais de teinte. |
| `text.primary` | `#F5F5F5` | Titres, emoji, valeurs mises en avant. |
| `text.muted` | `#8A8A8E` | Labels secondaires, stats, timer. |
| `text.muted.alt` | `#ABABAB` | Variante sur fond `#090909` (écrans hors jeu, cf. Faceup). |
| `accent` | `#0A84FF` | Bleu système iOS : bouton principal uniquement (natif sur iOS, copié sur Android). Jamais sur la grille. |

Accents Faceup — **disponibles ailleurs dans l'app, jamais sur la grille** :

| Token | Valeur |
|---|---|
| `accent.green` | `#B5F3C7` |
| `accent.purple` | `#B79CFF` |
| `accent.blue` | `#8CCBFF` |
| `accent.gold` | `#F8CA5A` |

Usage prévu pour ces 4 accents : badges de progression, streak, écran d'accueil, éléments de la boutique/cosmétiques. Jamais sur une carte de la grille, jamais en fond dégradé, jamais en glow.

## Typographie

Police système par plateforme — pas de police custom chargée :
- **iOS** : San Francisco (`-apple-system` / SF Pro), natif.
- **Android** : Roboto, natif.

En React Native / Expo : ne rien préciser en `fontFamily` (laisser le système par défaut), ou `Platform.select({ ios: undefined, android: 'sans-serif' })` selon le composant. Pas de `@expo-google-fonts/*` à charger pour le texte courant.

Échelle utilisée dans les mockups (à garder comme référence, pas figée au pixel près) :
- Titre d'écran / niveau : 22–26px, 800.
- Corps / stats : 13–15px, 500–600.
- Labels secondaires (timer, %) : 12–13px, 500–600, `text.muted`.

## Radius — deux régimes, jamais mélangés

| Élément | Radius |
|---|---|
| Cartes de la grille | `0` — toujours, sans exception. |
| Boutons Android / fallback | `12px` |
| Boutons iOS | **Pas de token** — géré par le composant natif Liquid Glass (capsule par défaut). Ne pas essayer de reproduire un radius fixe. |
| Cases de la carte des niveaux | `0` — ce sont des cartes, même règle que la grille. |

## Cartes de la grille

- Ratio 1:1 strict, `gap: 8px` entre cartes, grille 4×4.
- **Aucune bordure, à aucun moment** — ni au repos, ni pendant l'animation de retournement. Le flip est une pure transition (rotation 3D / scale / opacity), jamais un changement de couleur de bordure.
- Face cachée : carte noire vide, rien dessus.
- Révélée : carte noire + emoji centré, rien d'autre (pas de check, pas de halo, pas de teinte de succès).
- Aucun dégradé, aucun `box-shadow` de glow sur les cartes. Le seul relief autorisé est celui, très léger, de l'ombre du cadre du téléphone dans les mockups — jamais sur un élément de jeu lui-même.

## Boutons et contrôles

**iOS — Liquid Glass natif** (iOS 26+), via `@expo/ui/swift-ui` (`src/ui/AppButton.tsx`) :
- `.glassProminent` pour l'action principale (Carrière, Niveau suivant, Rejouer) — **dans le bleu système d'Apple, sans teinte custom** (validé : le bleu natif plutôt qu'un blanc forcé).
- `.glass` pour les actions secondaires (Infini, Réglages, Menu…).
- Boutons affichés ensemble : `AppButtonGroup`, qui les place dans un seul `GlassEffectContainer` — jamais deux effets glass isolés côte à côte.
- Retour : bouton glass rond avec le symbole `chevron.left`. Réglages : roue dentée (`gearshape.fill`) en glass rond, en haut à gauche de l'accueil — jamais un bouton texte.
- Accueil : Carrière et Infini en taille "hero", **même largeur** (`HERO_BUTTON_WIDTH`), empilés ; Défi du jour et Classement en dessous, côte à côte, même largeur entre eux. En haut à droite : coffre du jour (`gift.fill`, glass rond, pastille blanche quand il est prêt) et solde de pièces (pastille noire, ouvre la boutique).
- Sélecteurs à 2–3 choix (langue, onglets du classement) : `Segmented` — piste noire, segment choisi blanc, radius 12.
- Cases du coffre (J1…J7) et de la carte des niveaux : ce sont des cartes → noires, angles droits.
- Le glass est réservé aux contrôles/nav — **jamais appliqué à la grille ni à un contenu** (les panneaux de fin de partie sont opaques).

**Android / fallback non-glass** :
- Secondaire : fond `#000000`, bordure `1px rgba(255,255,255,0.14)`, radius `12px`, texte `#F5F5F5` 600.
- Principal : fond `#0A84FF` (le bleu système iOS, pour que les deux plateformes se ressemblent), texte blanc 700, radius `12px`.

## Ce qu'on ne fait jamais

- Pas de dégradé (fond, bouton, carte).
- Pas de glow / halo coloré.
- Pas de couleur sur les cartes de la grille — noir uniquement. Les étoiles aussi restent monochromes (blanc / gris).
- Pas de bordure sur les cartes, même pendant l'animation.
- Pas de radius custom sur les boutons iOS — on délègue au système.
- Pas de police custom chargée pour le texte courant — système uniquement.
- Pas d'accent Faceup (vert/violet/bleu/or) sur la grille.

## Icônes du jeu

**Microsoft Fluent Emoji 3D** partout (cartes, pièces, médailles, coffre, boutique) — même famille que FaceUp. Source : `github.com/microsoft/fluentui-emoji`, licence MIT (texte reproduit dans Crédits, obligatoire). Images en `assets/emoji/*.webp` (192 px), affichées via `<Emoji asset=… />` (`src/ui/Emoji.tsx`) ; la table `src/ui/emojiImages.ts` est générée, ne pas l'éditer à la main.
- Sur une carte : l'image fait 62 % du côté de la carte, centrée.
- Chaque icône garde son caractère Unicode (`glyph`) pour les lecteurs d'écran.
- Éviter les images Fluent qui ont leur propre fond carré (ex. « Shooting star », « Milky way ») : sur une carte noire elles font un cadre.
- Seules exceptions non-emoji : les étoiles ★ (monochromes, DA) et les symboles système des boutons glass (SF Symbols).

Packs d'icônes (`src/game/iconPacks.ts`) : chaque pack remplit les 24 emplacements du plateau, avec les look-alikes aux mêmes positions (0–4, 5–7, 8–11, 12–14, 15–16, 17–19) pour que la difficulté soit identique d'un pack à l'autre. Les packs changent les emojis, **jamais la couleur des cartes**.

## Écrans de jeu

- Marge latérale réduite à 16 px (`Screen compact`) pour donner la largeur au plateau ; le plateau est **ancré en haut**, juste sous le HUD — l'espace libre tombe au-dessus des boosters.
- Vies (Infini, Défi du jour) : 3 cœurs Fluent (`UI_EMOJI.heart`), une vie perdue = cœur à 20 % d'opacité.
- Fin de partie : l'action qui fait continuer d'abord, en grand (`hero` + `glassProminent` : Niveau suivant / Rejouer) ; « Doubler (pub) » en petit à côté de la ligne de pièces gagnées ; les sorties (Rejouer/Niveaux, Classement/Menu) côte à côte en dessous.

## Icône de l'app et splash

L'icône est une vue du jeu, pas un logo : fond `#1C1C1E`, grille 2×2 de cartes noires à angles droits, une paire de cerises Fluent trouvée en diagonale. Généré dans `assets/images/` (icon, android-icon-foreground/background/monochrome, splash-icon, favicon). Le splash reprend la même grille sur fond `#1C1C1E`.
