# Facture FCCS — facturation à la voix

PWA (application web installable) qui permet à un artisan de **créer une facture
en parlant**, depuis son téléphone, après un chantier. Il dicte, l'app transcrit
et comprend, remplit une facture fidèle au modèle FCCS, qu'il peut corriger à la
voix ou au clavier, puis génère un **PDF** et un **Excel** prêts à envoyer.

- **Voix → texte** : Groq (modèle Whisper `whisper-large-v3`).
- **Texte → facture structurée** : Claude (`claude-haiku-4-5`).
- **Fichiers** : PDF (jsPDF) + Excel avec formules (exceljs), générés dans le navigateur.
- **Stack** : Next.js (App Router) + TypeScript + Tailwind. Déployable sur Vercel.

Les clés API restent **côté serveur** (API routes). Le navigateur n'envoie que
l'audio et le texte à ton propre backend, jamais les clés.

---

## 1. Obtenir les clés API

### Groq (transcription)
1. Va sur https://console.groq.com et crée un compte.
2. Menu **API Keys** → **Create API Key**.
3. Copie la clé (commence par `gsk_...`).

### Anthropic (compréhension)
1. Va sur https://console.anthropic.com et crée un compte.
2. Section **API Keys** → **Create Key**.
3. Copie la clé (commence par `sk-ant-...`).

> ⚠️ Une clé API ne se partage jamais et ne se met jamais dans le code. Elle va
> uniquement dans le fichier `.env.local` (local) ou dans les variables
> d'environnement de Vercel (production).

---

## 2. Lancer en local

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier de clés et le remplir
cp .env.example .env.local
#   puis ouvre .env.local et colle tes deux clés

# 3. Démarrer
npm run dev
```

Ouvre http://localhost:3000.

Au premier lancement, l'app affiche une **facture de démonstration** (le chantier
Cecler) pour voir le rendu tout de suite, même sans clés API. Le bouton
« Générer » produit le PDF et l'Excel sans aucune clé. Les clés ne servent que
pour la **voix** et la **compréhension**.

> Le micro de Safari/Chrome ne fonctionne que sur `https://` ou sur `localhost`.
> En local, `http://localhost:3000` suffit.

---

## 3. Déployer sur Vercel

1. Pousse ce dossier sur un dépôt GitHub.
2. Sur https://vercel.com, **Add New… → Project**, importe le dépôt.
3. Dans **Settings → Environment Variables**, ajoute :
   - `GROQ_API_KEY`
   - `ANTHROPIC_API_KEY`
4. **Deploy**. Vercel détecte Next.js automatiquement, aucune configuration spéciale.

L'URL de production est en `https://` : le micro y fonctionne, et la PWA est
installable sur iPhone.

---

## 4. Installer l'app sur l'écran d'accueil de l'iPhone

1. Ouvre l'URL de production dans **Safari** (pas Chrome) sur l'iPhone.
2. Touche le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisis **« Sur l'écran d'accueil »**.
4. Valide. L'icône apparaît sur l'écran d'accueil ; l'app s'ouvre en plein écran,
   comme une vraie application.

---

## 5. Comment ça marche au quotidien

1. Appuie sur le gros bouton micro, parle (« Facture pour l'association Cecler…,
   prestation de service 420 euros, déplacement 55, fournitures cuivre 120 »),
   ré-appuie pour arrêter.
2. La facture se remplit toute seule. Les prix non dits restent **vides** (jamais 0).
3. Corrige à la voix (« ajoute 50 euros de soudure ») ou en écrivant dans la zone
   du bas. Change la TVA d'un bouton (5,5 / 10 / 20) ou à la voix.
4. Touche **« Générer le PDF et l'Excel »** : sur iPhone, le partage permet de les
   envoyer par mail ou SMS directement.

### Les trois zones de la facture (logique respectée par l'app)
- **Travaux** : ce qui a été fait, en lignes numérotées, **sans prix**.
- **Fournitures** : le matériel, **chaque ligne a son prix**.
- **Prestation** : le prix **global** de la main d'œuvre. **Déplacement** : sa ligne à part.

---

## 6. Réglages

La page **Réglages** (icône ⚙︎) permet de saisir une fois les coordonnées de
l'entreprise, le taux de TVA par défaut et le prochain numéro de facture. Tout est
pré-rempli avec les données FCCS. Ces réglages sont enregistrés **dans le
navigateur** (rien n'est envoyé ailleurs).

---

## Structure du projet

```
src/
  app/
    page.tsx              écran principal (micro + aperçu + génération)
    reglages/page.tsx     page des réglages
    api/transcribe/       Groq Whisper (voix → texte)
    api/extract/          Claude (texte → facture)
  components/             bouton micro, aperçu éditable, sélecteur TVA, correction
  lib/
    types.ts              schéma de la facture (source de vérité)
    calculs.ts            HT / TVA / TTC
    prompt.ts             règles métier de l'IA (les 3 zones, TVA, prix null)
    pdf.ts / excel.ts     génération des fichiers, fidèles au modèle
    storage.ts            persistance (localStorage aujourd'hui, BDD demain)
public/
  assets/                 images officielles de l'en-tête FCCS
  manifest.json, sw.js    PWA installable
```

## Évolutions prévues (non codées en v1)

La persistance passe par une couche unique (`lib/storage.ts`), et les blocs
`client` / `emetteur` sont isolés. Cela prépare, sans risque, une base de données
multi-utilisateurs, une base clients, un catalogue fournisseurs, l'ajout de photos
de chantier et une marge configurable, sans réécrire l'application.
