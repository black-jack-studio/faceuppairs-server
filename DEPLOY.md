# Mise en ligne — pas à pas

Tout tourne déjà en local (API + base + app sur simulateur avec pubs de test). Ce guide liste ce qu'il faut créer pour passer en réel, **dans cet ordre**. Pour chaque étape : ce que tu fais, et ce que tu m'envoies.

Règle : les **secrets** (mots de passe, clés secrètes) ne passent jamais par le chat — tu les colles toi-même là où c'est indiqué. Les **identifiants publics** (URL, ID d'app AdMob, clés "publiques" RevenueCat/PostHog) peuvent m'être envoyés.

---

## 0. Décider le nom

Le bundle ID `com.beaudoin.faceuppairs` devient **définitif** dès la création de l'app sur App Store Connect. Si le nom "FaceUp Pairs" te va, on garde tout ; sinon dis-le-moi avant l'étape 5.

## 1. GitHub (pour que Render déploie l'API)

1. Crée un dépôt **privé** vide sur github.com, par ex. `faceup-pairs` (sans README).
2. Envoie-moi son URL. Je fais le commit et le push.

## 2. Supabase — la base du classement

Un **nouveau projet**, jamais celui de FaceUp (la base de FaceUp est sa prod, sans backup).

1. supabase.com → New project → nom `faceup-pairs`, région **Europe (Paris) eu-west-3**, choisis un mot de passe de base de données fort (garde-le dans ton gestionnaire de mots de passe).
2. Project Settings → Database → Connection string → onglet **Session pooler** → copie l'URL et remplace `[YOUR-PASSWORD]` par ton mot de passe.
3. **Ne m'envoie pas cette URL.** Dans ce terminal, tape (avec ton URL) :
   ```
   ! cd server && DATABASE_URL='postgresql://…' npm run migrate
   ```
   Il te demande de retaper l'hôte pour confirmer, puis crée les tables.

## 3. Render — l'API

1. render.com → New → **Blueprint** → choisis le dépôt GitHub de l'étape 1. Render lit `render.yaml`.
2. Il demande `DATABASE_URL` : colle l'URL de l'étape 2.
3. Plan **Starter** (≈ 7 $/mois) : le plan gratuit s'endort et le classement mettrait ~50 s à répondre.
4. Une fois déployé, ouvre `https://<ton-service>.onrender.com/health` → doit afficher `{"ok":true}`.
5. **Envoie-moi l'URL du service.** Elle sert aussi pour les stores :
   - Politique de confidentialité : `https://<service>/legal/privacy`
   - Assistance : `https://<service>/legal/support`

## 4. AdMob — les pubs

1. admob.google.com (même compte que FaceUp) → Apps → Add app → **iOS**, "pas encore publiée", nom FaceUp Pairs. Puis pareil pour **Android**.
2. Dans chaque app, crée 2 blocs d'annonces : **Rewarded** (nom `revive_and_rewards`) et **Interstitial** (nom `between_games`).
3. **Envoie-moi les 6 identifiants** : 2 ID d'app (`ca-app-pub-…~…`) et 4 ID de blocs (`ca-app-pub-…/…`). Ils ne sont pas secrets.
4. Plus tard (après la sortie) : AdMob demandera un fichier `app-ads.txt` sur un site ; je le servirai depuis l'API.

## 5. App Store Connect

1. Mes apps → + → Nouvelle app → iOS, nom **FaceUp Pairs**, langue principale Français, bundle ID `com.beaudoin.faceuppairs` (à créer dans Certificates, Identifiers & Profiles si besoin), SKU `faceup-pairs`.
2. Fonctionnalités → Achats intégrés → crée (mêmes ID exacts, prix de ton choix) :

   | ID produit | Type | Prix suggéré |
   |---|---|---|
   | `faceup_pairs.plus` | Non consommable | 3,99 € |
   | `faceup_pairs.pack_sports` | Non consommable | 1,99 € |
   | `faceup_pairs.coins_1000` | Consommable | 0,99 € |
   | `faceup_pairs.coins_3000` | Consommable | 2,99 € |
   | `faceup_pairs.coins_8000` | Consommable | 6,99 € |
   | `faceup_pairs.coins_20000` | Consommable | 14,99 € |

3. Pas d'abonnement : Pairs+ est l'achat non consommable `faceup_pairs.plus` (zéro pub, pack Visages, couronne au classement).
4. Chaque produit a besoin d'un nom, d'une description et d'une capture de revue : je te fournirai les textes et les captures depuis le simulateur.
5. **Envoie-moi l'Apple ID de l'app** (le nombre dans "Informations sur l'app").

## 6. RevenueCat — les achats

1. app.revenuecat.com → nouveau projet `FaceUp Pairs`.
2. Ajoute l'app iOS (bundle ID ci-dessus) et suis leur assistant pour la clé App Store Connect (comme pour FaceUp).
3. Products → importe les 9 produits. Entitlements → crée :
   - `no_ads` ← plus
   - `plus` ← plus
   - `pack_sports` ← pack_sports
4. **Envoie-moi la clé SDK publique iOS** (`appl_…`) — et plus tard l'Android (`goog_…`). Elles sont faites pour être dans l'app.
5. **Couronne Pairs+ au classement** : RevenueCat → Project settings → API keys → crée une clé secrète (`sk_…`) et ajoute-la sur Render en `REVENUECAT_SECRET_API_KEY`. Le serveur s'en sert pour vérifier l'achat avant d'afficher la couronne. Sans elle, l'achat marche mais la couronne n'apparaît pas.
6. Bonus pour tester tout de suite : RevenueCat fournit un **Test Store** (clé `test_…`) qui simule les achats sans App Store. Envoie-la aussi si tu veux que je teste la boutique avant que les produits Apple soient validés.

## 7. PostHog — les statistiques

1. eu.posthog.com → nouveau projet `FaceUp Pairs`.
2. **Envoie-moi la "Project API key"** (`phc_…`, publique).

## 8. Expo / EAS — les builds

1. Dans ce terminal : `! npx eas-cli@latest login` (compte Expo, gratuit).
2. Je lance `eas init`, je crée les variables d'environnement de production avec tout ce qui précède, puis `eas build --profile production`.
3. `eas submit` envoie l'iOS sur TestFlight. Pour Android, **le premier AAB s'envoie à la main** dans la Play Console (Google l'impose), ensuite c'est automatique.

## 9. Fiches des stores

Je prépare les textes (description, mots-clés), les captures, et les réponses aux questionnaires :
- **App Store** : Confidentialité de l'app (identique au manifeste dans `app.json`), classification d'âge (pubs + contenu utilisateur filtré), URL de confidentialité et d'assistance (étape 3).
- **Google Play** : Sécurité des données, classification IARC, déclaration "contient des annonces", public cible **13 ans et plus** (ne jamais cocher les enfants : ça interdit la plupart des pubs).

---

### Ce que je fais pendant ce temps

Tout le reste : textes des fiches, captures, icône et écran de lancement définitifs, derniers réglages. Dès que tu m'envoies un élément, je l'intègre et je te dis l'étape suivante.
