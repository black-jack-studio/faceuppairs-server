# Plan de monétisation — FaceUp Pairs

Objectif : gagner de l'argent sans casser ce qui fait revenir les joueurs (la rétention). Un jeu casual gagne surtout en **nombre de parties jouées × revenu par partie** : chaque levier ci-dessous est jugé sur ces deux axes.

## 1. Ce que font les meilleurs

- **Block Blast** (le modèle cité) : ~17,5 M$ de pub par mois, quasiment zéro achat intégré (< 10 000 $ d'IAP sur toute l'année 2025). Pub interstitielle entre les parties + pub récompensée pour "continuer" quand on est sur le point de perdre + bannière. 200 M+ de joueurs mensuels.
- **Puzzle "hybrid-casual"** (Royal Match, jeux de tri, etc.) : pub + achats. Les meilleurs font 0,15–0,50 $ de revenu par joueur actif et par jour (ARPDAU), contre 0,01–0,05 $ en pub seule.
- Les **"fail offers"** (offre au moment de perdre) déclenchent ~27 % des premiers achats ; le pack à 1,99 $ ~40 %.
- La **pub récompensée** rapporte le plus par affichage (14–22 $ pour 1 000 vues aux US/Europe de l'Ouest, 8–10 $ en Tier 2) et ne fait pas fuir les joueurs, parce qu'ils la choisissent.
- L'**interstitielle** rapporte 9–14 $ / 1 000 en Tier 1 mais abîme la rétention si elle est trop fréquente : les apps saines la limitent à ~1 toutes les 2–3 parties.
- La **bannière** rapporte 0,40–0,80 $ / 1 000 : quasi rien, et elle salit le design.

→ Notre jeu a la même forme que Block Blast (parties courtes, rejouables, "encore une") : la pub est la base, les achats viennent en complément.

## 2. Les leviers, par ordre de priorité

### A. Pub récompensée (le pilier) — toujours optionnelle
| Placement | Mode | Récompense |
|---|---|---|
| **Continuer** après la 3e vie perdue | Infini | +1 vie, une fois par partie. Le moment où l'envie est maximale. |
| **Doubler les pièces** en fin de niveau / partie | Les deux | ×2 pièces gagnées |
| **Indice gratuit** quand on est bloqué | Carrière | Révèle une paire |
| **Coffre du jour** | Accueil | Pièces ou booster, 1 fois par jour |

### B. Pub interstitielle (encadrée)
- Jamais avant le niveau 5 (le joueur doit d'abord aimer le jeu).
- Seulement entre deux parties, jamais pendant.
- Plafond : 1 toutes les 3 parties **et** au moins 2 minutes d'écart.
- Jamais pour quelqu'un qui a payé quoi que ce soit (règle "on protège les payeurs").

### C. Pas de bannière en jeu
Revenu marginal, et elle casse la DA du plateau. À tester éventuellement plus tard, sur les menus seulement.

### D. Achats intégrés
| Offre | Prix indicatif | Pourquoi |
|---|---|---|
| **Pairs+** (achat unique) | 3,99 € | Zéro pub entre les parties + pack Visages + couronne au classement. Un seul achat, pas d'abonnement (décision du 1er octobre 2026). Garde les pubs récompensées, que les joueurs aiment. |
| **Pack de démarrage** (pièces + boosters + suppression des pubs) | 2,99 € | Proposé une seule fois, après quelques parties : meilleure conversion en premier achat. |
| **Offre d'échec** (continuer + boosters) | 0,99–1,99 € | Proposée au game over Infini, à côté de la pub "Continuer". |
| **Packs de pièces** | 0,99 € → 19,99 € | Pour ceux qui veulent des boosters sans regarder de pub. |
| **Dos de cartes et packs d'icônes** | 1,99–4,99 € | Cosmétique pur : colle au fait qu'on cherche de beaux assets. Jamais de couleur *sur le plateau* sans valider la DA. |

### E. Monnaie et boosters (le moteur des achats)
- **Pièces** gagnées en jouant (niveaux, étoiles, record battu, coffre du jour, pub).
- **Boosters** payés en pièces :
  - *Aperçu* : toutes les cartes visibles 1 seconde au début.
  - *Indice* : révèle une paire.
  - *Seconde chance* : annule la dernière erreur de mémoire (Infini).
- Règle d'équilibre : on peut finir **tout** le jeu sans payer. Les boosters vont plus vite, ils ne sont jamais obligatoires. Et **pas de booster dans le classement Infini**, sinon le classement devient "pay to win" et perd tout son sens.

### F. Rétention = plus de parties = plus d'argent
- **Défi du jour** : une grille identique pour tout le monde (même graine), un classement du jour.
- **Série de connexion** (jours d'affilée) avec récompenses croissantes.
- **Saisons de classement** hebdomadaires (récompenses cosmétiques au top).
- Notifications locales douces ("ton coffre du jour est prêt"), uniquement après accord explicite — comme FaceUp : on ne demande jamais la permission au premier lancement.

### G. Acquisition (pour que tout ça tourne)
- **Cross-promo FaceUp ↔ FaceUp Pairs** : gratuit, même éditeur, public proche.
- **ASO** : nom + sous-titre + mots-clés ("memory", "jeu de mémoire", "paires", "cerveau").
- **TikTok / Reels** : vidéos de parties rapides (le format retournement de cartes se prête bien aux vidéos courtes).
- **Pub payante** (Apple Search Ads, puis TikTok/Meta) seulement quand on sait combien rapporte un joueur (sinon on perd de l'argent).

## 3. Ordre de mise en place

1. **Avant la sortie** : pièces + boosters + pub récompensée (Continuer, Doubler, Indice) + interstitielle plafonnée + Pairs+ (3,99 €, achat unique) + pack de démarrage. Avec la conformité ci-dessous.
2. **Premier mois après sortie** : mesurer (rétention J1/J7, pubs vues par joueur, conversion en achat) avant de toucher aux prix.
3. **Ensuite** : offres d'échec, cosmétiques, défi du jour, saisons.
4. **Quand l'audience est là** : médiation de pubs par enchères (AppLovin MAX ou LevelPlay, +18–22 % de revenu pub typique).

## 4. Stack technique (repris de FaceUp)

| Besoin | FaceUp (Capacitor) | FaceUp Pairs (Expo) |
|---|---|---|
| Pubs | AdMob | `react-native-google-mobile-ads` (AdMob), médiation plus tard |
| Achats | RevenueCat | `react-native-purchases` (RevenueCat) — prix lus depuis le store, jamais écrits en dur |
| Suivi iOS (ATT) | popup maison puis popup Apple | `expo-tracking-transparency`, même principe |
| Consentement RGPD pubs | UMP de Google + ligne "Confidentialité pub" dans Réglages | Idem (UMP inclus dans le SDK AdMob) |
| Vérif des pubs récompensées | SSV côté serveur | SSV sur le backend du classement |
| Mesure | PostHog | À ajouter (indispensable pour piloter la monétisation) |

Ces modules sont natifs : il faudra passer d'Expo Go à un **build de développement** (EAS).

## 5. Ce que la monétisation change côté conformité

Tout ce qui est "sans pub, sans achat" dans l'app actuelle est à revoir — exactement comme FaceUp l'a fait :
- **Politique de confidentialité, CGU** : sections Publicité, Achats, Abonnements, remboursements (reprendre celles de FaceUp).
- **Manifeste de confidentialité iOS** : `NSPrivacyTracking` passe à `true` si pub personnalisée, domaines de tracking Google, types "Advertising Data", "Device ID", "Purchase History".
- **Info.plist** : `NSUserTrackingUsageDescription`, identifiants SKAdNetwork, identifiant d'app AdMob.
- **Google Play** : formulaire Data safety mis à jour, identifiant AdMob Android, déclaration "contient des pubs".
- **Âge** : la pub fait monter la classification. Ne **pas** cibler les enfants (catégorie Kids / programme Familles de Google) : ça interdit la plupart des réseaux de pub et la pub personnalisée.
- **Règles Apple** : pub récompensée toujours optionnelle ; achats numériques uniquement via l'achat intégré d'Apple ; si un jour on vend quoi que ce soit d'aléatoire (coffres), afficher les probabilités (FaceUp le fait dans sa politique).
- **Réglages** : ajouter "Restaurer les achats", "Gérer l'abonnement", et "Confidentialité pub" (Europe).

## 6. Ordres de grandeur (estimations, pas des promesses)

Revenu par jour ≈ joueurs actifs par jour × revenu par joueur (ARPDAU).

| Joueurs actifs / jour | Pub seule (~0,03 $) | Hybride bien réglé (~0,10 $) |
|---|---|---|
| 1 000 | ~30 $/jour | ~100 $/jour |
| 10 000 | ~300 $/jour | ~1 000 $/jour |
| 100 000 | ~3 000 $/jour | ~10 000 $/jour |

Le vrai levier n'est pas le nombre de pubs mais le nombre de joueurs qui reviennent : une rétention J1 de 40 % et J7 de 15 % est un bon objectif pour un puzzle casual.

## Sources
- Block Blast — revenus et modèle : [Udonis](https://www.blog.udonis.co/statistics/block-blast), [Capermint](https://www.capermint.com/blog/develop-a-game-like-block-blast/), [Deconstructor of Fun / Sensor Tower](https://www.deconstructoroffun.com/blog/5-numbers-hiding-in-plain-sight-sensor-towers-ad-monetization-report)
- ARPDAU et modèles hybrides : [Game Growth Advisor](https://gamegrowthadvisor.com/blog/2026-06-02-hybrid-monetization-mobile-games-iap-ads-guide-2026/)
- eCPM AdMob 2026, plafonds d'interstitielles, médiation : [RevenueLab](https://www.revenuelab.fyi/blog/admob-ecpm-benchmarks-2026)
- Fail offers et premiers achats : [AppMagic](https://appmagic.rocks/blog/fail-offers), [Udonis — IAP](https://www.blog.udonis.co/mobile-marketing/mobile-games/in-app-purchases)
- Pub récompensée : [MAF](https://maf.ad/en/blog/rewarded-ads-stats/)
