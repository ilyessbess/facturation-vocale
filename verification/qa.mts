/*
 * Harnais de vérification HORS-APP : exécute le VRAI code de génération
 * (src/lib/pdf.ts et src/lib/excel.ts) en environnement Node, en simulant les
 * quelques API navigateur utilisées (fetch des assets + FileReader). Produit les
 * fichiers réels dans /tmp pour inspection visuelle. Ne fait pas partie de l'app.
 *
 * Lancement : npx --yes tsx verification/qa.mts
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// --- Polyfills navigateur minimalistes ---

const PUBLIC = resolve(process.cwd(), "public");

// fetch('/assets/x') -> lecture du fichier local correspondant.
const vraiFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL, init?: unknown) => {
  const s = String(url);
  if (s.startsWith("/")) {
    const bytes = await readFile(resolve(PUBLIC, "." + s));
    const type = s.endsWith(".png") ? "image/png" : "image/jpeg";
    return { blob: async () => new Blob([bytes], { type }) } as Response;
  }
  return vraiFetch(url as never, init as never);
}) as typeof fetch;

// FileReader.readAsDataURL : Node ne le fournit pas, on le simule.
class FileReaderShim {
  result: string | ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  async readAsDataURL(blob: Blob) {
    const buf = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type};base64,${buf.toString("base64")}`;
    this.onloadend?.();
  }
}
// @ts-expect-error: on installe le shim global pour les modules de génération.
globalThis.FileReader = FileReaderShim;

// --- Import du VRAI code de l'app ---
const { genererPDF } = await import("../src/lib/pdf.ts");
const { genererExcel } = await import("../src/lib/excel.ts");
const { factureDemo } = await import("../src/lib/demo.ts");
const { REGLAGES_PAR_DEFAUT } = await import("../src/lib/storage.ts");
const { calculerTotaux } = await import("../src/lib/calculs.ts");

const facture = factureDemo(REGLAGES_PAR_DEFAUT.emetteur);
const totaux = calculerTotaux(facture);
console.log("Totaux démo :", totaux, "(attendu HT 595, TVA 59.5, TTC 654.5)");

const pdf = await genererPDF(facture);
const xls = await genererExcel(facture);

await writeFile("/tmp/qa-facture.pdf", Buffer.from(await pdf.blob.arrayBuffer()));
await writeFile("/tmp/qa-facture.xlsx", Buffer.from(await xls.blob.arrayBuffer()));

console.log("PDF :", pdf.nomFichier, Math.round((await pdf.blob.arrayBuffer()).byteLength / 1024), "Ko -> /tmp/qa-facture.pdf");
console.log("XLSX:", xls.nomFichier, "-> /tmp/qa-facture.xlsx");
