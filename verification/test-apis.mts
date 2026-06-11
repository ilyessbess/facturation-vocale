/*
 * Test de bout en bout des deux API routes avec les vraies clés (.env.local).
 * Ne fait pas partie de l'app. Lancement : npx --yes tsx verification/test-apis.mts
 */
import { readFile } from "node:fs/promises";

const BASE = "http://localhost:3000";
const { factureDemo } = await import("../src/lib/demo.ts");
const { REGLAGES_PAR_DEFAUT } = await import("../src/lib/storage.ts");

// 1) Transcription (Groq Whisper)
console.log("1) Test transcription Groq...");
const audio = await readFile("/tmp/test.m4a");
const form = new FormData();
form.append("audio", new File([audio], "test.m4a", { type: "audio/m4a" }));
const rT = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: form });
const dT = await rT.json();
if (!rT.ok) {
  console.log("   ECHEC transcription :", dT.erreur);
  process.exit(1);
}
console.log("   Texte transcrit :", JSON.stringify(dT.texte));

// 2) Compréhension / extraction (Claude)
console.log("2) Test extraction Claude (sur le texte transcrit)...");
const facture = factureDemo(REGLAGES_PAR_DEFAUT.emetteur);
const rE = await fetch(`${BASE}/api/extract`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ texte: dT.texte, factureActuelle: facture }),
});
const dE = await rE.json();
if (!rE.ok) {
  console.log("   ECHEC extraction :", dE.erreur);
  process.exit(1);
}
const f = dE.facture;
console.log("   Client     :", f.client?.nom);
console.log("   Prestations:", JSON.stringify(f.prestations));
console.log("   Deplacement:", JSON.stringify(f.deplacement));
console.log("   TVA        :", f.tauxTVA);
console.log("\nOK : les deux clés fonctionnent, le pipeline voix -> facture tourne.");
