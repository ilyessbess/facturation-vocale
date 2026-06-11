/**
 * Génération du fichier Excel (.xlsx) de la facture.
 *
 * Reproduit le gabarit FCCS et garde des FORMULES réelles pour les totaux
 * (HT = somme des lignes, TVA = HT × taux, TTC = HT + TVA), pour que le fichier
 * reste modifiable dans Excel : l'artisan peut compléter un prix vide et les
 * totaux se recalculent seuls. Porté depuis facturation-fccs/generer_excel.py.
 *
 * Tourne côté navigateur ; renvoie un Blob téléchargeable / partageable.
 */

import ExcelJS from "exceljs";
import type { Facture } from "./types";
import { calculerTotaux, formatTaux } from "./calculs";

const EUR_FMT = '#,##0.00 "€"';

/** Charge une image du dossier public en base64 (pour l'insérer dans le classeur). */
async function chargerImageBase64(url: string): Promise<string> {
  const reponse = await fetch(url);
  const blob = await reponse.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function genererExcel(
  facture: Facture
): Promise<{ blob: Blob; nomFichier: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Facture");

  ws.getColumn(1).width = 64;
  ws.getColumn(2).width = 16;

  // --- En-tête : on insère les images officielles FCCS ---
  try {
    const logo = await chargerImageBase64("/assets/logo-fccs.jpeg");
    const coord = await chargerImageBase64("/assets/coordonnees-fccs.png");
    const idLogo = wb.addImage({ base64: logo, extension: "jpeg" });
    const idCoord = wb.addImage({ base64: coord, extension: "png" });
    ws.addImage(idLogo, { tl: { col: 0, row: 0 }, ext: { width: 235, height: 100 } });
    ws.addImage(idCoord, { tl: { col: 0, row: 5 }, ext: { width: 250, height: 68 } });
  } catch {
    // Sans images, on retombe sur le texte (jamais bloquant).
    ws.getCell("A1").value = facture.emetteur.nomSociete;
    ws.getCell("A1").font = { bold: true, size: 14 };
  }

  // Styles réutilisés
  const bold = { bold: true };
  const bigBold = { bold: true, size: 14 };
  const blueBold = { bold: true, size: 12, color: { argb: "FF0000FF" } };
  const redBold = { bold: true, size: 9, color: { argb: "FFFF0000" } };
  const gris: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBEBEB" } };
  const bleuClair: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9E1F5" } };

  // On laisse les lignes 1 à 8 pour les images de l'en-tête.
  let row = 9;
  const set = (r: number, col: number, value: ExcelJS.CellValue) => {
    const cell = ws.getCell(r, col);
    cell.value = value;
    return cell;
  };

  // --- Numéro + date ---
  set(row, 1, `Facture n° ${facture.numeroFacture}`).font = bigBold;
  set(row, 2, facture.date).font = bold;
  row += 1;
  set(row, 1, `A ${facture.ville} le ${facture.date}`);
  row += 2;

  // --- Client ---
  set(row, 1, "Client :").font = bold;
  row += 1;
  if (facture.client.nom) {
    set(row, 1, facture.client.nom).font = bold;
    row += 1;
  }
  for (const ligne of facture.client.adresse) {
    set(row, 1, ligne);
    row += 1;
  }
  row += 1;

  // --- Site + titre des travaux ---
  if (facture.site) {
    set(row, 1, facture.site);
    row += 1;
  }
  if (facture.titreTravaux) {
    set(row, 1, facture.titreTravaux).font = bold;
    row += 1;
  }
  row += 1;

  // --- Zone TRAVAUX : descriptions numérotées, SANS prix ---
  if (facture.lignesTravaux.length) {
    set(row, 1, "Travaux :").font = bold;
    row += 1;
    for (const t of facture.lignesTravaux) {
      set(row, 1, `${t.numero}/ ${t.description}`);
      row += 1;
    }
    row += 1;
  }

  // Mémorise les lignes Excel portant un prix, pour la formule du Total HT.
  const lignesPrix: number[] = [];

  // --- Zone FOURNITURES : chaque ligne a son prix ---
  if (facture.fournitures.length) {
    const c1 = set(row, 1, "Fournitures et accessoires :");
    c1.font = bold;
    c1.fill = gris;
    const c2 = set(row, 2, "Montant (€)");
    c2.font = bold;
    c2.fill = gris;
    row += 1;
    for (const f of facture.fournitures) {
      set(row, 1, f.designation);
      // Prix null -> cellule laissée vide (éditable directement dans Excel).
      const cell = set(row, 2, f.prix ?? null);
      cell.numFmt = EUR_FMT;
      lignesPrix.push(row);
      row += 1;
    }
    row += 1;
  }

  // --- Zone PRESTATIONS (prix global main d'œuvre) ---
  for (const p of facture.prestations) {
    set(row, 1, p.designation).font = bold;
    const cell = set(row, 2, p.prix ?? null);
    cell.numFmt = EUR_FMT;
    lignesPrix.push(row);
    row += 1;
  }

  // --- Ligne DÉPLACEMENT ---
  if (facture.deplacement) {
    set(row, 1, facture.deplacement.designation).font = bold;
    const cell = set(row, 2, facture.deplacement.prix ?? null);
    cell.numFmt = EUR_FMT;
    lignesPrix.push(row);
    row += 1;
  }
  row += 1;

  // --- Totaux avec FORMULES (le fichier reste recalculable dans Excel) ---
  // On stocke AUSSI le résultat calculé (result) pour que la valeur s'affiche
  // tout de suite, même dans un simple visualiseur qui ne recalcule pas.
  const { ht, tva, ttc } = calculerTotaux(facture);
  const formuleSomme =
    lignesPrix.length > 0 ? lignesPrix.map((r) => `B${r}`).join("+") : "0";
  const taux = facture.tauxTVA;

  const htRow = row;
  set(row, 1, "Total H.T").font = bold;
  const cHT = ws.getCell(row, 2);
  cHT.value = { formula: formuleSomme, result: ht };
  cHT.font = bold;
  cHT.fill = gris;
  cHT.numFmt = EUR_FMT;
  row += 1;

  const tvaRow = row;
  set(row, 1, `T.V.A ${formatTaux(taux)} %`).font = bold;
  const cTVA = ws.getCell(row, 2);
  cTVA.value = { formula: `B${htRow}*${taux}/100`, result: tva };
  cTVA.font = bold;
  cTVA.fill = gris;
  cTVA.numFmt = EUR_FMT;
  row += 1;

  set(row, 1, "Total T.T.C").font = blueBold;
  const cTTC = ws.getCell(row, 2);
  cTTC.value = { formula: `B${htRow}+B${tvaRow}`, result: ttc };
  cTTC.font = blueBold;
  cTTC.fill = bleuClair;
  cTTC.numFmt = EUR_FMT;
  row += 2;

  // --- Mentions légales ---
  set(row, 1, "Nous vous remercions de votre règlement dès réception de la facture.").font = bold;
  row += 1;
  const mention = set(
    row,
    1,
    "Réserve de propriété : Nous nous réservons la propriété des marchandises jusqu'au paiement intégral de notre facture (loi n°80335 du 12 mai 1980)."
  );
  mention.font = redBold;
  mention.alignment = { wrapText: true };
  ws.getRow(row).height = 28;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const nomFichier = `Facture_${facture.numeroFacture.replace(/\//g, "-")}.xlsx`;
  return { blob, nomFichier };
}
