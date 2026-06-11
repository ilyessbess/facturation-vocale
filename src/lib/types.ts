/**
 * Schéma de données de la facture — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Ce type est utilisé partout : aperçu à l'écran, validation des réponses de
 * l'IA, génération du PDF et de l'Excel. Toute évolution du modèle de facture
 * commence ici.
 *
 * Structure calquée directement sur la facture FCCS réelle. Trois zones bien
 * distinctes à ne JAMAIS confondre :
 *   1. lignesTravaux   = points numérotés purement descriptifs, SANS prix.
 *   2. fournitures      = matériel, chaque ligne a SON prix (null si non donné).
 *   3. prestations      = prix GLOBAL de la main d'œuvre (ex: "Prestation de service").
 *   + deplacement       = sa propre ligne avec son montant.
 */

/** Une ligne de matériel ou de main d'œuvre : un libellé + un prix (null si non donné). */
// TODO catalogue fournisseur : un jour, si la `designation` correspond à un article
// connu d'un catalogue, le `prix` pourra être auto-rempli au lieu de rester null.
export type LigneFourniture = {
  designation: string;
  /** Prix en euros. `null` = non renseigné (s'affiche vide, compte comme 0 dans la somme). Jamais 0 par défaut. */
  prix: number | null;
};

/**
 * Une ligne de travaux est PUREMENT DESCRIPTIVE : pas de champ prix, jamais.
 * Ce sont les points numérotés "1/ ...", "2/ ..." qui détaillent ce qui a été fait.
 */
export type LigneTravaux = {
  numero: number;
  description: string;
};

/** En-tête de l'entreprise émettrice. Vient des Réglages, rarement modifié. */
// TODO multi-tenant : un jour, `emetteur` deviendra un compte utilisateur isolé.
export type Emetteur = {
  nomSociete: string; // ex: "FCCS - Froid Climatisation Chauffage Sanitaire Plomberie"
  adresse: string; // ex: "6 Rue du Docteur Claussat, 63100 Clermont-Fd"
  siret: string;
  numeroTVA: string;
  rm: string; // n° répertoire des métiers
  telFixe: string;
  telMobile: string;
  email: string;
  logoUrl?: string;
};

/** Bloc client. Isolé volontairement pour devenir un jour une entité réutilisable. */
// TODO base clients : mémoriser les clients pour auto-remplir l'adresse depuis le nom dicté.
export type Client = {
  nom: string; // ex: "ASSOCIATION CECLER"
  adresse: string[]; // lignes d'adresse
};

/** Taux de TVA. Modifiable : 5,5 / 10 / 20 % ou toute autre valeur. Défaut 10. */
export type TauxTVA = 5.5 | 10 | 20 | number;

/** Une facture complète. */
export type Facture = {
  // En-tête émetteur (vient des Réglages, modifiable)
  emetteur: Emetteur;

  // Métadonnées
  numeroFacture: string; // ex: "22/26"
  ville: string; // ex: "Clermont-Ferrand"
  date: string; // ex: "22/05/2026"

  // Client
  client: Client;

  // Chantier
  site: string; // ex: "Site Rivaly apt A05"
  titreTravaux: string; // ex: "Travaux de réparation de fuite sur tuyauterie eau chaude et froide"

  lignesTravaux: LigneTravaux[]; // points numérotés 1/ 2/ 3/... — DESCRIPTIFS, SANS PRIX
  fournitures: LigneFourniture[]; // matériel : chaque ligne a SON prix (null si non donné)
  prestations: LigneFourniture[]; // prix GLOBAL main d'œuvre, ex: "Prestation de service" 420
  deplacement: LigneFourniture | null; // ligne déplacement à part, ex: "Déplacement" 55

  // Réglages de calcul
  tauxTVA: TauxTVA; // modifiable : 5,5 / 10 / 20 % ou valeur libre. Défaut 10.

  // Mentions légales bas de page
  mentions: string[]; // réserve de propriété, etc.

  // Évolutions futures, NON implémentées aujourd'hui (place réservée, ne pas coder) :
  //   photos?: string[];   // photos de chantier (avant/après) — voir évolutivité
  //   margePourcent?: number; // marge configurable appliquée au calcul — voir évolutivité
};
