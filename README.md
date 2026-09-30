# FaceUp Pairs

Jeu de Memory (paires) en Expo / React Native — iOS et Android, sans compte.

- `GAME_DESIGN.md` — mécanique et modes
- `DESIGN.md` — direction artistique et règles de design
- `PLAN.md` — plan de fonctionnement, conformité stores, étapes

```bash
npm install
npx expo start      # puis i (simulateur iOS) ou a (Android), ou Expo Go
npm test            # moteur de jeu, niveaux, score, filtre de pseudos
npm run typecheck
npm run lint
```

Tous les modules natifs utilisés sont inclus dans Expo Go : pas besoin de build de développement pour jouer.
