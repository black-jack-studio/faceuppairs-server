# Plan de fonctionnement

Référence : `~/faceup-server` (FaceUp, quasi validé par Apple). Tout ce qui suit reprend ses choix de conformité, adaptés à un jeu **sans compte**, **sans pub ni achat en v1**, avec un **leaderboard global à pseudos**. Mécanique : `GAME_DESIGN.md`. DA : `DESIGN.md`.

## 1. Nom

Nom de travail : **FaceUp Pairs** (famille FaceUp, les cartes se retournent face visible).
"FaceUp" seul est impossible : un nom d'App Store est unique et c'est déjà celui de l'autre app.

| | Valeur de travail | Modifiable ? |
|---|---|---|
| Nom affiché | `FaceUp Pairs` | Oui, jusqu'à la soumission |
| Bundle iOS / package Android | `com.beaudoin.faceuppairs` | **Non** une fois la 1re build envoyée |
| Scheme deep link | `faceuppairs` | Oui |

Centralisé dans `app.json` (build natif) + `src/config/app.ts` (textes de l'app).

## 2. Stack

- Expo (dernière SDK stable) + expo-router, TypeScript strict.
- `react-native-reanimated` : animation de retournement (rotation 3D, sans bordure — cf. DESIGN.md).
- `expo-glass-effect` : boutons Liquid Glass iOS 26+, fallback plat radius 12px ailleurs.
- `expo-haptics` : même logique que `faceup-server/client/src/lib/haptics.ts` (tick / impact / success, désactivable).
- `zustand` + `persist` sur AsyncStorage : progression locale (niveaux, étoiles, record Infini, réglages).
- `expo-secure-store` : identifiant joueur anonyme. Sur iOS il vit dans le trousseau et **survit à une désinstallation**, donc un joueur qui réinstalle retrouve son identité de leaderboard sans compte.
- `i18next` + `expo-localization` : FR/EN, un fichier JSON par namespace (même organisation que FaceUp).
- `jest-expo` : tests du moteur de jeu, du score et du filtre de pseudos (FaceUp n'a aucun test et le README le regrette).
- EAS Build + EAS Submit (numéros de build auto-incrémentés côté EAS : évite les bugs de `versionCode` qu'a eus le Codemagic de FaceUp).

## 3. Conformité — repris de FaceUp

### Pseudos (Guideline 1.2 : contenu généré par l'utilisateur filtré)
- 3 à 20 caractères, `[a-zA-Z0-9_]` uniquement — identique à FaceUp.
- Filtre d'insultes : port direct de `faceup-server/shared/usernameFilter.ts` (FR + EN, leetspeak, lettres répétées, sous-chaînes vs mots entiers).
- En plus : liste de noms réservés (`admin`, `support`, `moderator`, `faceup`, `apple`, `google`, `official`…).
- Contrôlé côté client **et** côté serveur, unicité côté serveur.
- Demandé seulement au premier envoi de score au leaderboard (on joue tout de suite, comme Block Blast), jamais au lancement.
- Changement de pseudo dans Réglages, avec délai minimum entre deux changements (comme FaceUp).

### Modération du leaderboard (le seul contenu public)
- "Signaler ce pseudo" sur chaque ligne du classement.
- Côté serveur : au-delà de N signalements, le pseudo est remplacé par `Joueur####` en attendant revue.
- "Masquer ce joueur" (local) pour l'équivalent du blocage demandé par Apple.
- Contact publié et accessible (Assistance), exigé par la 1.2.

### Pages et écrans (même arborescence que FaceUp)
- **Réglages** : Changer de pseudo · Haptique · Langue FR/EN · Règles du jeu · Confidentialité → · Crédits · Feedback (mailto pré-rempli version + plateforme) · numéro de version. (Réglage "Sons" ajouté seulement quand le jeu aura des sons : pas d'interrupteur qui ne fait rien.)
- **Confidentialité →** : Politique de confidentialité · Mentions légales · Conditions d'utilisation · Assistance · **Supprimer mes données**.
- Textes légaux repris de `faceup-server/client/src/locales/*/legal.json` : même éditeur (Stanislas & Anatole Beaudoin), droit français, tribunaux de Paris, même adresse de contact — **réécrits** pour ce jeu (pas de compte, pas de pub, pas d'achat, pas de coffres/probabilités).
- Les mêmes textes doivent aussi exister en **URL publique** (App Store Connect et Play Console exigent une URL de politique de confidentialité) → servis par le backend de l'étape 5.

### Suppression des données (Apple 5.1.1(v), Google Play)
Pas de compte, mais le serveur stocke un identifiant anonyme + pseudo + scores. "Supprimer mes données" efface tout côté serveur, puis réinitialise l'appareil (nouvel identifiant, progression remise à zéro), avec confirmation dans une feuille du bas (même UX que FaceUp).

### Fichiers de plateforme
- `ITSAppUsesNonExemptEncryption = false` (HTTPS système uniquement, comme FaceUp).
- Portrait uniquement ; iPad pris en charge en plein écran (`requireFullScreen`), comme FaceUp.
- Android : permission `INTERNET` seule, les autres bloquées explicitement ; edge-to-edge géré.
- `PrivacyInfo.xcprivacy` (via `app.json` → `ios.privacyManifests`) : **pas de tracking**, pas d'ATT, pas d'IDFA. Données déclarées : identifiant utilisateur (anonyme) + contenu de jeu (scores) + autre contenu utilisateur (pseudo), toutes pour "App Functionality", liées à l'identifiant, sans tracking. Doit rester identique aux réponses "App Privacy" d'App Store Connect (comme le rappelle le manifest de FaceUp).
- Formulaire **Data safety** Google Play : mêmes données, chiffrées en transit, suppression possible.
- Classification d'âge : pas de pub, pas d'achat, pas de jeu d'argent → bien plus basse que FaceUp (18+). Seul point à déclarer : pseudos publics filtrés sur le leaderboard.

### Autres réflexes FaceUp
- Hors ligne : le jeu marche entièrement hors ligne ; les scores Infini sont mis en file et envoyés au retour du réseau.
- Retour Android : géré par expo-router ; une partie en cours demande confirmation avant de quitter.
- Demande d'avis in-app (`expo-store-review`) à un moment positif (ex. 3 étoiles au niveau 5), jamais au lancement.
- Pas de notifications push en v1.
- Pas d'analytics en v1 (évite une ligne de plus dans la déclaration de confidentialité). Si on en ajoute : même approche que PostHog dans FaceUp, et mise à jour du manifest.

## 4. Moteur de jeu (TS pur, testé)

- Paquet de 8 paires tirées dans le pool d'emojis, mélange avec une graine (`seed`) → une partie est rejouable à l'identique, ce qui permet au serveur de **recalculer le score** (anti-triche).
- États : `idle → une carte retournée → deux cartes → résolution (paire : restent visibles ; sinon se retournent après ~600 ms, saisie bloquée) → terminé`.
- **Carrière** : niveaux définis dans `levels.ts` (nombre de paires, pool d'icônes, présence de distracteurs), 1 à 3 étoiles selon coups + temps.
- **Infini** : grilles enchaînées, 3 vies. Une vie se perd sur une **erreur de mémoire** : rater une paire alors que la carte correspondante avait déjà été vue. Un raté "à l'aveugle" (carte jamais vue) ne coûte rien — c'est ce qui rend le mode vraiment basé sur la mémoire.
- Score Infini v1 : 100 pts par paire × multiplicateur de série (x1 → x5, remis à x1 sur un raté) + bonus de grille terminée + bonus de vitesse. Constantes regroupées dans `scoring.ts` pour être réglées après les premiers tests.

## 5. Leaderboard global (étape à part)

- Besoin d'un backend : classer 100 000+ joueurs, calculer le rang de chacun, servir les pages légales publiques.
- Fonctionnement prévu : index sur le meilleur score, rang = nombre de joueurs au-dessus (requête indexée, tient largement 100k–1M), top 100 mis en cache.
- Anti-triche : le serveur délivre la graine d'une partie, le client renvoie la liste des coups horodatés, le serveur rejoue et recalcule le score + contrôles de vraisemblance (durée minimale par paire). Limitation de débit comme `express-rate-limit` sur FaceUp.
- **Décision à prendre avec toi** : réutiliser l'infra FaceUp (Supabase) ou une nouvelle. Rien n'est provisionné sans ton accord (coûts, base partagée — le README de FaceUp rappelle que sa base est la prod, sans backup).

## 6. Arborescence

```
src/app/                   écrans (expo-router)
  _layout.tsx              stack, splash tenu jusqu'au chargement de la progression
  index.tsx                accueil : Carrière / Infini / Réglages
  career.tsx               carte des 60 niveaux
  play/level/[n].tsx       partie Carrière
  play/endless.tsx         partie Infini
  settings/index.tsx       réglages
  settings/privacy.tsx     confidentialité + suppression des données
  settings/username.tsx    pseudo (feuille)
  legal/[doc].tsx          politique, CGU, mentions, assistance, règles, crédits (feuille)
  (leaderboard.tsx)        étape 3
src/
  config/app.ts            nom, éditeur, e-mail, hébergeur
  game/                    rng, icons, engine, board, levels, endless, useBoardGame (+ tests)
  moderation/              usernameFilter (+ tests)
  store/                   progression, réglages (persistés)
  ui/                      theme, AppButton (glass / fallback), Card (flip), Board, ListRow, Screen…
  lib/                     haptics, playerId, format, useLeaveGuard
  i18n/ + locales/{fr,en}/ common, settings, legal
```

## 7. Ordre de livraison

1. ✅ **Fait** — scaffold Expo SDK 57 + `app.json` conforme, tokens de design, moteur + 46 tests, Carrière (60 niveaux, étoiles), progression locale, Réglages + pages légales + règles du jeu en FR/EN, filtre de pseudos, suppression des données.
2. ✅ **Fait (v1 jouable)** — mode Infini (vies, série, score, record local). Reste : réglage fin des constantes après tests en main.
3. **Tout le reste, d'abord en local, puis en ligne** (décision : tout faire, cf. `MONETISATION.md`) — détail en §8.
4. Préparation stores : icône, splash, captures, fiches, classification d'âge, Data safety, builds EAS.

## 8. Étape 3 — plan de travail

Principe : tout tourne en local d'abord (API + base + app sur simulateur, pubs de test Google), puis on met en ligne en une fois.

**Infra choisie** : même famille que FaceUp — API Node dans `server/` (Hono), base Postgres **Supabase** (projet neuf, jamais la base de FaceUp), hébergement **Render**. En local : Postgres embarqué (PGlite), aucune installation nécessaire.

| # | Lot | État |
|---|---|---|
| A | Moteur : score rejouable par le serveur, détection de triche (chance impossible, vitesse inhumaine), boosters Aperçu / Indice, relance unique, Défi du jour, économie (pièces, série de 7 jours) | ✅ fait, testé |
| B | Serveur `server/` : joueurs anonymes + jeton secret, pseudos (filtre, unicité, délai), graines tirées par le serveur, rejeu + recalcul du score, classements tous temps / semaine / jour avec rang, signalements (3 → renommage), suppression, limites de débit, pages légales publiques | ✅ fait, testé (PGlite) |
| C | App : classement (3 onglets, signaler / masquer), envoi des scores avec file hors ligne, pseudo synchronisé, suppression serveur (rejouée si hors ligne) | ✅ fait |
| D | App : pièces, boosters, boutique, coffre du jour, Défi du jour, packs d'icônes (cosmétiques purs) | ✅ fait |
| E | Pubs AdMob : récompensées (relance, doubler, indice, coffre) + interstitielles plafonnées, consentement UMP, pré-popup ATT | ✅ fait (pubs de test Google) |
| F | Achats RevenueCat : supprimer les pubs, pack de démarrage, offre d'échec, pièces, pack Sports, Pairs+, restaurer, gérer l'abonnement | ✅ code fait — inactif sans clé RevenueCat |
| G | Rappels locaux (coffre, série) avec pré-popup, analytics PostHog | ✅ code fait — PostHog inactif sans clé |
| H | Conformité : manifeste iOS (pub + achats + analytics), texte ATT FR/EN, politique / CGU / assistance réécrites, Réglages (restaurer, abonnement, confidentialité pub, rappels) | ✅ fait |
| I | Build natif iOS local (build de développement) | ✅ fait (simulateur) |
| K | Audit (16 points) : sécurité serveur, anti-triche temporel, file hors ligne, consentement avant pseudo, pseudo pris, écrans de fin, plateau, boutique hors ligne, classement au-delà du top 100, icône | ✅ fait, testé |
| J | Mise en ligne | serveur ✅ en ligne (Render + Supabase, `https://faceuppairs-server.onrender.com`, migration 001 appliquée) ; builds iOS : `codemagic.yaml` prêt, en attente de la validation du compte Apple organisation (Team ID à vérifier dans `app.json`) ; guide : `DEPLOY.md` |

Cosmétiques : **packs d'icônes uniquement**. Pas de dos de cartes colorés — DESIGN.md impose des cartes noires dans tous les états.

## Points ouverts
- Nom définitif et bundle ID (à figer avant la création de l'app sur App Store Connect).
- Adresse de contact : `help.faceup@gmail.com` par défaut (même éditeur), ou une adresse dédiée.
- Icône : motif « fusion » (deux cartes qui fusionnent, noir et blanc purs, coins arrondis 22 %) — fait ; splash à harmoniser si besoin.
- Compte Apple : conversion en organisation en cours ; ensuite créer l'app App Store Connect `com.beaudoin.faceuppairs`, groupe Codemagic `pairs_env` (`EXPO_PUBLIC_API_URL`), premier build `ios-testflight`.
- Migrations serveur : jamais au démarrage, `npm run migrate` (ou SQL Editor Supabase). Connexion Supabase via **Session pooler** (le host direct est en IPv6 seul) ; `#` du mot de passe encodé `%23`.
- Prix des produits (suggestions dans `DEPLOY.md` §5).
