/*
 * Répare .env.local : extrait les clés (en ignorant tout caractère parasite type
 * espace insécable ou guillemet intelligent ajouté par un éditeur) et réécrit un
 * fichier propre. N'AFFICHE JAMAIS les clés, seulement leur longueur.
 * Lancement : node verification/fix-env.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const chemin = ".env.local";
let brut = await readFile(chemin, "utf8");

// Neutralise les espaces/caractères invisibles courants (insécable, guillemets typographiques).
brut = brut.replace(/[ ‘’“”​]/g, "");

const groq = brut.match(/gsk_[A-Za-z0-9]+/)?.[0] ?? null;
const anthropic = brut.match(/sk-ant-[A-Za-z0-9_-]+/)?.[0] ?? null;

if (!groq || !anthropic) {
  console.log("Impossible d'extraire une clé :");
  console.log("  Groq      :", groq ? "trouvée" : "INTROUVABLE");
  console.log("  Anthropic :", anthropic ? "trouvée" : "INTROUVABLE");
  process.exit(1);
}

const contenu =
  "# Clés API (fichier régénéré proprement, sans caractères parasites)\n" +
  `GROQ_API_KEY=${groq}\n` +
  `ANTHROPIC_API_KEY=${anthropic}\n`;

await writeFile(chemin, contenu, "utf8");

console.log("Fichier .env.local réécrit proprement.");
console.log("  GROQ_API_KEY      : longueur", groq.length, "(commence par gsk_)");
console.log("  ANTHROPIC_API_KEY : longueur", anthropic.length, "(commence par sk-ant-)");
