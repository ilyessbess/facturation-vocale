/**
 * Factures de référence :
 *   - `factureDemo`  : la facture Cecler du modèle réel, pour voir le rendu AVANT de brancher l'audio.
 *   - `factureVide`  : une facture neuve (bouton "Nouvelle facture"), en-tête pré-rempli, corps vide.
 *
 * Toutes deux partent de l'émetteur des Réglages, pour que le multi-artisan futur
 * fonctionne sans rien changer ici.
 */

import type { Emetteur, Facture } from "./types";

/** Les deux mentions légales du bas de facture (réserve de propriété). */
export const MENTIONS_LEGALES: string[] = [
  "Nous vous remercions de votre règlement dès réception de la facture",
  "Réserve de propriété: Nous nous réservons la propriété des marchandises jusqu'au paiement intégral de notre facture (loi n°80335 du 12 mai 1980)",
];

/** Date du jour au format français JJ/MM/AAAA. */
export function dateAujourdhui(): string {
  const d = new Date();
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${jj}/${mm}/${d.getFullYear()}`;
}

/** Facture neuve : en-tête et réglages pré-remplis, corps à dicter. */
export function factureVide(
  emetteur: Emetteur,
  numeroFacture: string,
  tauxTVA: number
): Facture {
  return {
    emetteur,
    numeroFacture,
    ville: "Clermont-Ferrand",
    date: dateAujourdhui(),
    client: { nom: "", adresse: [] },
    site: "",
    titreTravaux: "",
    lignesTravaux: [],
    fournitures: [],
    prestations: [],
    // Déplacement pré-rempli à 55 € (valeur la plus fréquente, modifiable/supprimable).
    deplacement: { designation: "Déplacement", prix: 55 },
    tauxTVA,
    mentions: MENTIONS_LEGALES,
  };
}

/** Facture de démonstration : le chantier Cecler du modèle réel (HT 595, TVA 10%, TTC 654,50). */
export function factureDemo(emetteur: Emetteur): Facture {
  return {
    emetteur,
    numeroFacture: "22/26",
    ville: "Clermont-Ferrand",
    date: "22/05/2026",
    client: {
      nom: "ASSOCIATION CECLER",
      adresse: ["13 rue Condorcet", "63000 Clermont-Ferrand"],
    },
    site: "Site Rivaly apt A05",
    titreTravaux:
      "Travaux de réparation de fuite sur tuyauterie eau chaude et froide",
    // Zone TRAVAUX : descriptions numérotées, SANS prix.
    lignesTravaux: [
      { numero: 1, description: "Recherche et localisation de la fuite" },
      { numero: 2, description: "Dépose de la portion de tuyauterie défectueuse" },
      { numero: 3, description: "Pose d'une vanne d'isolement et remise en eau" },
    ],
    // Zone FOURNITURES : matériel, chaque ligne a SON prix.
    fournitures: [{ designation: "Cuivre et colliers", prix: 120 }],
    // Zone PRESTATIONS : prix global de la main d'œuvre.
    prestations: [{ designation: "Prestation de service", prix: 420 }],
    // Ligne DÉPLACEMENT à part.
    deplacement: { designation: "Déplacement", prix: 55 },
    tauxTVA: 10,
    mentions: MENTIONS_LEGALES,
  };
}
