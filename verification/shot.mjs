// Capture l'écran après avoir cliqué sur "Générer", pour vérifier l'apparition
// des deux boutons de partage. Vise le site de production. Hors-app.
import { chromium } from "playwright";

const URL = process.env.URL || "https://facturation-vocale.vercel.app";
const W = parseInt(process.env.W || "390", 10);
const H = parseInt(process.env.H || "844", 10);
const SORTIE = process.env.SORTIE || "/tmp/mobile-fichiers.png";
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: W, height: H } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

// Clique sur le bouton vert de génération.
await page.getByText("Générer le PDF").click();
await page.waitForTimeout(3500); // laisse le temps de générer PDF + Excel

await page.screenshot({ path: SORTIE, fullPage: true });
console.log("Capture faite : " + SORTIE);
await navigateur.close();
