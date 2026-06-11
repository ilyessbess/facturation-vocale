// Génère les icônes PWA (PNG) à partir d'un SVG abstrait : micro géométrique
// blanc sur fond bleu. Aucune figure animée (conforme à la charte).
// Lancement : npx --yes -p sharp node scripts/generer-icones.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1d4ed8"/>
  <g fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <rect x="206" y="120" width="100" height="190" rx="50" fill="#ffffff" stroke="none"/>
    <path d="M156 250 a100 100 0 0 0 200 0"/>
    <line x1="256" y1="350" x2="256" y2="404"/>
    <line x1="196" y1="404" x2="316" y2="404"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const buf = Buffer.from(svg);

await sharp(buf).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(buf).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(buf).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

console.log("Icônes générées dans public/icons/");
