/**
 * API route /api/extract — compréhension / extraction structurée (texte -> facture).
 *
 * Reçoit le texte (dicté puis transcrit, ou tapé pour corriger) + la facture
 * actuelle, appelle Claude qui renvoie la facture mise à jour via l'outil
 * "remplir_facture". La clé ANTHROPIC_API_KEY reste côté serveur : le navigateur
 * ne voit jamais la clé.
 *
 * Même mécanisme pour la création (facture vide au départ) et la modification
 * (facture déjà remplie + instruction de correction).
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Facture } from "@/lib/types";
import {
  OUTIL_REMPLIR_FACTURE,
  PROMPT_SYSTEME,
  messageUtilisateur,
} from "@/lib/prompt";

// Modèle Claude récent et économique, suffisant pour cette extraction structurée.
const MODELE = "claude-haiku-4-5";

// Laisse jusqu'à 30 s à la fonction (marge si l'API Claude répond lentement).
export const maxDuration = 30;

export async function POST(req: Request) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    return NextResponse.json(
      {
        erreur:
          "La clé Anthropic n'est pas configurée. Ajoute ANTHROPIC_API_KEY dans le fichier .env.local.",
      },
      { status: 500 }
    );
  }

  let texte: string;
  let factureActuelle: Facture;
  try {
    const body = await req.json();
    texte = String(body.texte ?? "").trim();
    factureActuelle = body.factureActuelle as Facture;
    if (!texte || !factureActuelle) throw new Error("paramètres manquants");
  } catch {
    return NextResponse.json(
      { erreur: "Requête invalide." },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: cle });

    const reponse = await anthropic.messages.create({
      model: MODELE,
      max_tokens: 2000,
      // Prompt système mis en cache : il est volumineux et identique à chaque appel.
      system: [
        {
          type: "text",
          text: PROMPT_SYSTEME,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [OUTIL_REMPLIR_FACTURE as Anthropic.Tool],
      // On FORCE l'usage de l'outil : Claude doit répondre par un JSON structuré.
      tool_choice: { type: "tool", name: OUTIL_REMPLIR_FACTURE.name },
      messages: [
        { role: "user", content: messageUtilisateur(texte, factureActuelle) },
      ],
    });

    // Récupère le bloc tool_use renvoyé par Claude.
    const bloc = reponse.content.find((c) => c.type === "tool_use");
    if (!bloc || bloc.type !== "tool_use") {
      throw new Error("réponse sans tool_use");
    }

    const factureMaj = fusionner(factureActuelle, bloc.input as ContenuIA);
    return NextResponse.json({ facture: factureMaj });
  } catch (e) {
    console.error("Erreur /api/extract :", e);
    return NextResponse.json(
      {
        erreur:
          "Je n'ai pas tout compris. Reformule ou tape la correction directement.",
      },
      { status: 502 }
    );
  }
}

// ----------------------- Fusion + validation défensive -----------------------

/** Contenu éditable renvoyé par l'IA (sans émetteur ni mentions légales). */
type ContenuIA = {
  client?: { nom?: string; adresse?: string[] };
  site?: string;
  titreTravaux?: string;
  lignesTravaux?: { numero?: number; description?: string }[];
  fournitures?: { designation?: string; prix?: number | string | null }[];
  prestations?: { designation?: string; prix?: number | string | null }[];
  deplacement?: { designation?: string; prix?: number | string | null } | null;
  tauxTVA?: number;
  numeroFacture?: string;
  date?: string;
  ville?: string;
};

/** Convertit un prix éventuellement string ("120", "12,5") en number, ou null. */
function versPrix(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normaliserLignes(
  lignes: { designation?: string; prix?: number | string | null }[] | undefined
) {
  return (lignes ?? [])
    .filter((l) => (l.designation ?? "").trim() !== "")
    .map((l) => ({ designation: String(l.designation).trim(), prix: versPrix(l.prix) }));
}

/**
 * Reconstruit une Facture complète et valide à partir de la facture actuelle
 * (pour l'émetteur, les mentions, les métadonnées) et du contenu renvoyé par l'IA.
 * L'émetteur et les mentions légales ne sont JAMAIS modifiés par l'IA.
 */
function fusionner(actuelle: Facture, ia: ContenuIA): Facture {
  // Lignes de travaux : on garde la description, on renumérote proprement.
  const lignesTravaux = (ia.lignesTravaux ?? [])
    .filter((l) => (l.description ?? "").trim() !== "")
    .map((l, i) => ({ numero: i + 1, description: String(l.description).trim() }));

  // Déplacement : objet ou null.
  let deplacement = null as Facture["deplacement"];
  if (ia.deplacement && (ia.deplacement.designation ?? "").trim() !== "") {
    deplacement = {
      designation: String(ia.deplacement.designation).trim(),
      prix: versPrix(ia.deplacement.prix),
    };
  }

  const taux = typeof ia.tauxTVA === "number" && ia.tauxTVA > 0 ? ia.tauxTVA : actuelle.tauxTVA;

  return {
    // Jamais touchés par l'IA :
    emetteur: actuelle.emetteur,
    mentions: actuelle.mentions,
    // Métadonnées : conservées sauf override explicite de l'IA.
    numeroFacture: ia.numeroFacture?.trim() || actuelle.numeroFacture,
    date: ia.date?.trim() || actuelle.date,
    ville: ia.ville?.trim() || actuelle.ville,
    // Contenu :
    client: {
      nom: (ia.client?.nom ?? actuelle.client.nom).trim(),
      adresse: ia.client?.adresse ?? actuelle.client.adresse,
    },
    site: ia.site?.trim() ?? actuelle.site,
    titreTravaux: ia.titreTravaux?.trim() ?? actuelle.titreTravaux,
    lignesTravaux,
    fournitures: normaliserLignes(ia.fournitures),
    prestations: normaliserLignes(ia.prestations),
    deplacement,
    tauxTVA: taux,
  };
}
