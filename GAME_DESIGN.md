# Cahier des charges — jeu de Memory (grille 4×4)

## Concept

Jeu de Memory classique (paires) sur une grille 4×4 (16 cartes / 8 paires). On retourne deux cartes ; si elles matchent, elles restent révélées ; sinon elles se retournent. Version speedrun : le score se joue sur le chrono + le nombre de coups (retournements), pas juste "fini ou pas fini".

DA : voir le moodboard validé (fond plateau `#1C1C1E`, cartes `#000000` carrées sans contour, boutons radius 12px sur Android / Liquid Glass natif sur iOS, police système SF Pro/Roboto). Guidelines de design à écrire séparément (`DESIGN.md`).

## Modes

### Mode Carrière
- Niveaux numérotés, courbe de difficulté progressive : variété d'icônes croissante, puis distracteurs visuellement proches (ex. deux cocktails similaires), puis grilles plus grandes en fin de progression.
- Notation 1 à 3 étoiles par niveau, basée sur le temps et le nombre de coups — pousse à rejouer un niveau déjà validé pour le perfectionner.
- Débloque des thèmes de grille / packs d'emojis au fil de la progression (récompense visible, pas juste un chiffre).
- Sert de tutoriel naturel avant de lâcher le joueur en mode Infini.

### Mode Infini
- Les grilles s'enchaînent sans fin ; la difficulté augmente en continu (icônes plus nombreuses, distracteurs plus tôt).
- Un système de vies (ex. 3 erreurs) clôt la run — pas de chrono fixe qui coupe le joueur en pleine lancée.
- Score = vitesse + précision (nombre de coups) + multiplicateur de streak (paires trouvées d'affilée sans erreur).
- C'est le score qu'on compare sur le leaderboard.

## Leaderboard

- Uniquement un classement général au lancement — pas de système d'amis dans cette v1.
- Doit classer tous les joueurs à l'échelle (tenir à 100 000+ utilisateurs) → nécessite un backend léger qui stocke les scores et calcule le rang, pas une solution purement locale.
- Pas de compte requis : un identifiant anonyme est généré sur l'appareil au premier lancement, associé à un pseudo choisi localement, et c'est cet identifiant qui envoie le score au classement.
- La progression (niveaux, étoiles, meilleur score Infini) reste stockée sur l'appareil. Lier un vrai compte (pour retrouver sa progression sur un autre appareil) est une option future, jamais une obligation à l'installation.

## Hors périmètre pour le lancement

- Pas de système d'amis / classement entre amis.
- Pas de compte ou de connexion obligatoire.

## Décidé mais pas encore détaillé (à faire à l'implémentation)

- Formule exacte du score (pondération vitesse / coups / streak).
- Courbe de difficulté précise par niveau (mode Carrière) et par manche (mode Infini).
- Choix du backend pour le leaderboard global à 100k+ joueurs.
- Set d'emojis/icônes définitif (cf. moodboard : accent mis sur "trouver de bons assets", pas de couleur sur les cartes).
