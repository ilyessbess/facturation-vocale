/**
 * Couche de persistance — ABSTRACTION VOLONTAIRE.
 *
 * Aujourd'hui : localStorage (rien à installer, rien à perdre si l'app se ferme).
 * Demain : on remplace l'intérieur de ces fonctions par des appels à une vraie
 * base de données (multi-utilisateurs) SANS toucher au reste de l'application.
 *
 * RÈGLE D'OR : aucun autre fichier de l'app n'appelle `localStorage` directement.
 * Tout passe par ce module. C'est ce qui rend l'évolution vers une BDD indolore.
 */

import type { Emetteur, Facture } from "./types";

// ----------------------------- Réglages -----------------------------

/** Réglages persistants saisis une seule fois par l'artisan. */
export type Reglages = {
  emetteur: Emetteur;
  tauxTVADefaut: number; // ex: 10
  prochainNumeroFacture: string; // ex: "23/26"
};

/** Réglages par défaut pré-remplis avec les données FCCS (ça marche tout de suite). */
export const REGLAGES_PAR_DEFAUT: Reglages = {
  emetteur: {
    nomSociete:
      "FCCS - Froid Climatisation Chauffage Sanitaire Plomberie",
    adresse: "6 Rue du Docteur Claussat, 63100 Clermont-Fd",
    siret: "411066715",
    numeroTVA: "FR 664 110 66715",
    rm: "RM 6301",
    telFixe: "04 73 90 71 39",
    telMobile: "06 73 96 67 96",
    email: "fccs63@hotmail.fr",
    // L'en-tête FCCS s'affiche via les images officielles (public/assets), pas via ces champs.
    // Ces valeurs sont conservées pour le futur multi-artisan.
    logoUrl: undefined,
  },
  tauxTVADefaut: 20, // 20 % = cas le plus courant (modifiable à la voix ou au clavier)
  prochainNumeroFacture: "23/26",
};

const CLE_REGLAGES = "fccs.reglages";
const CLE_FACTURE = "fccs.facture.brouillon";

/** True si on est côté navigateur (les API routes ne doivent pas appeler ça).
 * Protégé par try/catch : sur certains Safari (confidentialité stricte), le simple
 * accès à window.localStorage peut lever une exception. */
function navigateurDispo(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Charge les réglages. Renvoie les réglages FCCS par défaut si rien n'est encore enregistré. */
export function loadReglages(): Reglages {
  if (!navigateurDispo()) return REGLAGES_PAR_DEFAUT;
  try {
    const brut = window.localStorage.getItem(CLE_REGLAGES);
    if (!brut) return REGLAGES_PAR_DEFAUT;
    // Fusion défensive : si on ajoute un champ plus tard, les anciens réglages restent valides.
    const charge = JSON.parse(brut) as Partial<Reglages>;
    return {
      ...REGLAGES_PAR_DEFAUT,
      ...charge,
      emetteur: { ...REGLAGES_PAR_DEFAUT.emetteur, ...charge.emetteur },
    };
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

/** Enregistre les réglages. */
export function saveReglages(reglages: Reglages): void {
  if (!navigateurDispo()) return;
  window.localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
}

// ----------------------------- Facture en cours -----------------------------

/** Sauvegarde le brouillon de facture en cours (pour ne rien perdre si l'app se ferme). */
export function saveFacture(facture: Facture): void {
  if (!navigateurDispo()) return;
  window.localStorage.setItem(CLE_FACTURE, JSON.stringify(facture));
}

/** Recharge le brouillon de facture, ou null si aucun. */
export function loadFacture(): Facture | null {
  if (!navigateurDispo()) return null;
  try {
    const brut = window.localStorage.getItem(CLE_FACTURE);
    return brut ? (JSON.parse(brut) as Facture) : null;
  } catch {
    return null;
  }
}

/** Efface le brouillon en cours (bouton "Nouvelle facture"). */
export function clearFacture(): void {
  if (!navigateurDispo()) return;
  window.localStorage.removeItem(CLE_FACTURE);
}

// ----------------------------- Historique -----------------------------

/** Une entrée de l'historique : la facture complète au moment de l'émission. */
export type HistoriqueEntry = {
  id: string;       // ISO datetime → clé unique
  savedAt: string;  // même valeur, pour affichage
  facture: Facture;
};

const CLE_HISTORIQUE = "fccs.historique";
const HISTORIQUE_MAX = 50;

/** Ajoute la facture courante à l'historique (50 entrées max, LIFO). */
export function saveHistoriqueEntry(facture: Facture): void {
  if (!navigateurDispo()) return;
  try {
    const existant = loadHistorique();
    const now = new Date().toISOString();
    const entry: HistoriqueEntry = { id: now, savedAt: now, facture };
    const mis_a_jour = [entry, ...existant].slice(0, HISTORIQUE_MAX);
    window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(mis_a_jour));
  } catch {
    // localStorage plein : on ignore silencieusement
  }
}

/** Charge l'historique complet (plus récent en premier). */
export function loadHistorique(): HistoriqueEntry[] {
  if (!navigateurDispo()) return [];
  try {
    const brut = window.localStorage.getItem(CLE_HISTORIQUE);
    return brut ? (JSON.parse(brut) as HistoriqueEntry[]) : [];
  } catch {
    return [];
  }
}

/** Supprime une entrée de l'historique par son id. */
export function deleteHistoriqueEntry(id: string): void {
  if (!navigateurDispo()) return;
  try {
    const mis_a_jour = loadHistorique().filter((e) => e.id !== id);
    window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(mis_a_jour));
  } catch {}
}

// ----------------------------- Numérotation -----------------------------

/**
 * Incrémente un numéro de facture de la forme "NN/AA" (ex: "23/26" -> "24/26").
 * Si le format est inattendu, renvoie la valeur telle quelle (l'artisan corrigera à la main).
 */
export function incrementerNumero(numero: string): string {
  const m = numero.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return numero;
  const n = parseInt(m[1], 10) + 1;
  return `${n}/${m[2]}`;
}
