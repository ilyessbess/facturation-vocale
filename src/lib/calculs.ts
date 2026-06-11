/**
 * Calculs de la facture : Total HT, TVA, Total TTC.
 *
 * Reproduit à l'identique la logique du modèle Excel FCCS :
 *   - Total HT  = somme de tous les prix renseignés (fournitures + prestations + déplacement).
 *                 Les lignes de TRAVAUX n'entrent PAS dans le calcul (elles n'ont pas de prix).
 *                 Les `null` comptent comme 0 dans la somme mais s'affichent vides dans le tableau.
 *   - TVA       = Total HT × tauxTVA / 100   (taux choisi par l'artisan : 5,5 / 10 / 20 ou autre).
 *   - Total TTC = Total HT + TVA.
 */

import type { Facture, LigneFourniture } from "./types";

export type Totaux = {
  ht: number;
  tva: number;
  ttc: number;
};

/** Additionne les prix non nuls d'une liste de lignes (les `null` sont ignorés). */
function sommePrix(lignes: LigneFourniture[]): number {
  return lignes.reduce((total, l) => total + (l.prix ?? 0), 0);
}

/** Calcule HT / TVA / TTC à partir d'une facture. Arrondi à 2 décimales. */
export function calculerTotaux(facture: Facture): Totaux {
  const ht =
    sommePrix(facture.fournitures) +
    sommePrix(facture.prestations) +
    (facture.deplacement?.prix ?? 0);

  const taux = facture.tauxTVA || 0;
  const tva = arrondir(ht * (taux / 100));
  const ttc = arrondir(ht + tva);

  return { ht: arrondir(ht), tva, ttc };
}

/** Arrondi monétaire à 2 décimales (évite les 0,30000000004). */
export function arrondir(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Format monétaire français : 1234.5 -> "1 234,50 €".
 * Utilisé pour les totaux (toujours 2 décimales).
 */
export function formatEuros(montant: number): string {
  return (
    montant
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €"
  );
}

/**
 * Format d'un prix de ligne : entier si rond (120), sinon 2 décimales (12,50).
 * Reproduit l'affichage du modèle d'origine. Renvoie "" si le prix est null.
 */
export function formatPrixLigne(montant: number | null): string {
  if (montant === null || montant === undefined) return "";
  if (Number.isInteger(montant)) return String(montant);
  return montant.toFixed(2).replace(".", ",");
}

/**
 * Format d'un taux de TVA pour l'affichage : 5.5 -> "5,5", 10 -> "10".
 * Sert au libellé "T.V.A {taux} %" qui doit refléter le taux RÉEL choisi.
 */
export function formatTaux(taux: number): string {
  return String(taux).replace(".", ",");
}
