/**
 * Génération du PDF de la facture, fidèle au gabarit FCCS.
 *
 * Tourne CÔTÉ NAVIGATEUR (pas de serveur) : on produit un Blob téléchargeable /
 * partageable via le partage natif iPhone. Les coordonnées de mise en page sont
 * portées depuis le moteur reportlab validé par l'artisan (facturation-fccs/
 * generer_facture.py), adaptées au format A4.
 */

import { jsPDF } from "jspdf";
import type { Facture } from "./types";
import {
  calculerTotaux,
  formatEuros,
  formatPrixLigne,
  formatTaux,
} from "./calculs";

// --- Géométrie A4 en points (1 pt = 1/72 pouce) ---
const XG = 19; // bord gauche du tableau
const XD = 576; // bord droit du tableau
const XSEP = 480; // séparateur désignation | montant
const XMON = 570; // bord droit pour aligner les montants

const Y_TABLE_HAUT = 214;
const Y_TOTAUX = 700; // ligne séparant le corps du bloc totaux/mentions
const Y_TABLE_BAS = 760;

const NOIR: [number, number, number] = [0, 0, 0];
const ROUGE: [number, number, number] = [200, 0, 0];
const BLEU: [number, number, number] = [0, 0, 190];

/** Charge une image du dossier public en dataURL (nécessaire pour jsPDF). */
async function chargerImage(url: string): Promise<string> {
  const reponse = await fetch(url);
  const blob = await reponse.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Génère le PDF et renvoie un Blob (+ un nom de fichier suggéré). */
export async function genererPDF(
  facture: Facture
): Promise<{ blob: Blob; nomFichier: string }> {
  const { ht, tva, ttc } = calculerTotaux(facture);
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Petit utilitaire texte (origine en haut à gauche, y = baseline).
  const txt = (
    x: number,
    y: number,
    s: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      align?: "left" | "right" | "center";
    } = {}
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 11);
    const c = opts.color ?? NOIR;
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(s, x, y, { align: opts.align ?? "left" });
  };

  // --- En-tête : images officielles FCCS (logo + coordonnées) ---
  try {
    const logo = await chargerImage("/assets/logo-fccs.jpeg");
    const coord = await chargerImage("/assets/coordonnees-fccs.png");
    // Logo 621x264 (ratio 2.35) ; coordonnées 420x114 (ratio 3.68).
    doc.addImage(logo, "JPEG", XG, 22, 235, 100);
    doc.addImage(coord, "PNG", XG, 128, 250, 68);
  } catch {
    // Si les images manquent, on retombe sur le texte émetteur (jamais bloquant).
    txt(XG, 50, facture.emetteur.nomSociete, { size: 12, bold: true });
    txt(XG, 66, facture.emetteur.adresse, { size: 9 });
  }

  // --- Cadre "Facture n°XX/XX" en haut à droite ---
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(358, 25, 219, 28);
  txt(365, 46, `Facture n°${facture.numeroFacture}`, { size: 20, bold: true });

  // --- Bloc client (sous le cadre, à droite) ---
  let yc = 82;
  if (facture.client.nom) {
    txt(362, yc, facture.client.nom, { size: 10, bold: true });
    yc += 14;
  }
  for (const ligne of facture.client.adresse) {
    txt(362, yc, ligne, { size: 10, bold: true });
    yc += 14;
  }

  // --- Date, centrée au-dessus du tableau ---
  txt((XG + XD) / 2, 206, `A ${facture.ville} le ${facture.date}`, {
    size: 10,
    bold: true,
    align: "center",
  });

  // --- Cadre du tableau ---
  doc.setLineWidth(0.8);
  doc.rect(XG, Y_TABLE_HAUT, XD - XG, Y_TABLE_BAS - Y_TABLE_HAUT);
  // séparateur colonne montant (s'arrête au bloc totaux)
  doc.line(XSEP, Y_TABLE_HAUT, XSEP, Y_TOTAUX);
  // ligne séparant corps et bloc totaux/mentions
  doc.line(XG, Y_TOTAUX, XD, Y_TOTAUX);

  // --- Corps du tableau (flux vertical) ---
  const xLib = 100;
  let y = 242;

  if (facture.site) {
    txt(xLib, y, facture.site);
    y += 28;
  }
  if (facture.titreTravaux) {
    txt(xLib, y, facture.titreTravaux, { bold: true });
    y += 26;
  }

  // Zone TRAVAUX : lignes numérotées, SANS prix.
  for (const t of facture.lignesTravaux) {
    txt(xLib, y, `${t.numero}/ ${t.description}`);
    y += 16;
  }
  if (facture.lignesTravaux.length) y += 14;

  // Zone FOURNITURES : chaque ligne a son prix, aligné à droite.
  if (facture.fournitures.length) {
    txt(xLib, y, "Fournitures et accessoires:", { bold: true });
    y += 22;
    for (const f of facture.fournitures) {
      txt(xLib, y, f.designation);
      txt(XMON, y, formatPrixLigne(f.prix), { size: 10, align: "right" });
      y += 16;
    }
    y += 12;
  }

  // Zone PRESTATIONS : prix global main d'œuvre.
  for (const p of facture.prestations) {
    txt(xLib, y, p.designation, { bold: true });
    txt(XMON, y, formatPrixLigne(p.prix), { size: 10, align: "right" });
    y += 16;
  }

  // Ligne DÉPLACEMENT.
  if (facture.deplacement) {
    txt(xLib, y, facture.deplacement.designation, { bold: true });
    txt(XMON, y, formatPrixLigne(facture.deplacement.prix), {
      size: 10,
      align: "right",
    });
    y += 16;
  }

  // --- Bloc totaux (bas droite) ---
  const XT_GAUCHE = 416; // bord gauche du bloc totaux
  const XT_SEP = 500; // séparateur label | montant
  const yHT = 718;
  const yTVA = 737;
  const yTTC = 756;
  // cadre du bloc
  doc.line(XT_GAUCHE, Y_TOTAUX, XT_GAUCHE, Y_TABLE_BAS);
  doc.line(XT_SEP, Y_TOTAUX, XT_SEP, Y_TABLE_BAS);
  doc.line(XT_GAUCHE, Y_TOTAUX + 24, XD, Y_TOTAUX + 24);
  doc.line(XT_GAUCHE, Y_TOTAUX + 43, XD, Y_TOTAUX + 43);

  txt(XT_GAUCHE + 6, yHT, "Total H.T", { bold: true });
  txt(XMON, yHT, formatEuros(ht), { align: "right" });

  txt(XT_GAUCHE + 6, yTVA, `T.V.A ${formatTaux(facture.tauxTVA)} %`, {
    bold: true,
  });
  txt(XMON, yTVA, formatEuros(tva), { align: "right" });

  txt(XT_GAUCHE + 6, yTTC, "Total T.T.C", { bold: true, color: BLEU });
  txt(XMON, yTTC, formatEuros(ttc), { size: 12, bold: true, color: BLEU, align: "right" });

  // --- Mentions légales (bas gauche) ---
  txt(24, yHT, "Nous vous remercions de votre règlement dès réception de la facture", {
    size: 9,
    bold: true,
  });
  txt(24, yHT + 15, "Réserve de propriété:", { size: 9, bold: true, color: ROUGE });
  const reserve =
    "Nous nous réservons la propriété des marchandises jusqu'au paiement intégral de notre facture (loi n°80335 du 12 mai 1980)";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(ROUGE[0], ROUGE[1], ROUGE[2]);
  const lignesReserve = doc.splitTextToSize(reserve, 385) as string[];
  // Deux lignes courtes qui restent au-dessus de la bordure basse du tableau.
  doc.text(lignesReserve, 24, yHT + 26, { lineHeightFactor: 1.15 });

  const blob = doc.output("blob");
  const nomFichier = `Facture_${facture.numeroFacture.replace(/\//g, "-")}.pdf`;
  return { blob, nomFichier };
}
