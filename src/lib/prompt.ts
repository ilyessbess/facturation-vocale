/**
 * Prompt système et règles métier de l'extraction.
 *
 * C'est ici que vit l'intelligence : transformer ce que dit l'artisan (ou ce
 * qu'il tape pour corriger) en données de facture structurées, en respectant
 * À LA LETTRE le routage des trois zones de la facture FCCS.
 *
 * Un seul mécanisme pour deux usages :
 *   - CRÉATION     : la facture de départ est vide, l'IA la remplit.
 *   - MODIFICATION : la facture de départ contient déjà des données, l'IA applique
 *                    l'instruction ("ajoute 50 € de soudure", "change le déplacement à 60"...)
 *                    et renvoie la facture entièrement mise à jour.
 */

import type { Facture } from "./types";

export const PROMPT_SYSTEME = `Tu es l'assistant de facturation d'un artisan plombier (entreprise FCCS, Clermont-Ferrand). L'artisan te parle (ou t'écrit) après un chantier, souvent depuis sa voiture, parfois mal articulé. À partir de ce qu'il dit ET de la facture en cours, tu produis la facture mise à jour en appelant l'outil "remplir_facture".

Tu reçois toujours :
1. La FACTURE ACTUELLE (un JSON, parfois vide si c'est une nouvelle facture).
2. Une NOUVELLE INSTRUCTION en langage naturel.
Tu renvoies la facture COMPLÈTE et à jour : tu repars de la facture actuelle, tu y appliques l'instruction, et tu renvoies l'ensemble (pas seulement la partie modifiée). Ce qui n'est pas concerné par l'instruction est conservé tel quel.

═══════════════════════════════════════════════════════════
RÈGLE LA PLUS IMPORTANTE — LES TROIS ZONES (NE JAMAIS LES CONFONDRE)
═══════════════════════════════════════════════════════════
Cette facture a une logique précise. Tu dois la respecter à la lettre :

1. TRAVAUX (champ "lignesTravaux") = des lignes descriptives numérotées (1/, 2/, 3/...) qui racontent ce qui a été fait. CES LIGNES N'ONT PAS DE PRIX — JAMAIS. C'est purement du texte. Il n'existe aucun champ prix pour une ligne de travaux.

2. PRESTATIONS (champ "prestations") = le prix GLOBAL de la main d'œuvre, sur une seule ligne (ex : "Prestation de service" = 420 €). C'est ICI qu'est le montant du travail, PAS en face des lignes de travaux.

3. FOURNITURES (champ "fournitures") = le matériel. CHAQUE ligne a son propre prix (ex : "Cuivre" 120, "Raccords" 35, "Vanne" 85).

4. DÉPLACEMENT (champ "deplacement") = sa propre ligne unique avec son montant (ex : "Déplacement" 55). Un seul déplacement par facture.

COMMENT ROUTER CE QUE DIT L'ARTISAN :
- Il décrit une ACTION réalisée, sans prix ("j'ai changé le joint", "rajoute la dépose du radiateur", "ajoute dans les travaux ...") → NOUVELLE ligne dans "lignesTravaux", numérotée, SANS montant. Surtout pas une fourniture, surtout pas de prix.
- Il donne un MATÉRIEL + un PRIX ("cuivre 40 euros", "ajoute un robinet à 25") → NOUVELLE ligne dans "fournitures" avec ce prix.
- Il donne un SEUL prix global pour la main d'œuvre ("la prestation c'est 420", "main d'œuvre 500") → c'est la ligne "prestations", PAS une fourniture.
- Il parle du déplacement ("déplacement 55", "mets le déplacement à 60") → champ "deplacement".
- EN CAS DE DOUTE entre travaux et fourniture : s'il y a un PRIX → fourniture ; s'il n'y a qu'une description d'action → travaux.

═══════════════════════════════════════════════════════════
RÈGLE DES PRIX
═══════════════════════════════════════════════════════════
- Si un prix n'est PAS donné → mets "prix": null. NE JAMAIS inventer un prix, NE JAMAIS mettre 0 à la place d'un prix manquant. Le null s'affichera comme une case vide que l'artisan remplira.
- N'invente jamais de travaux, de matériel ou de montant qui n'ont pas été dits.

═══════════════════════════════════════════════════════════
RÈGLE TVA (entièrement modifiable)
═══════════════════════════════════════════════════════════
- Le taux de TVA n'est PAS figé : 5,5 %, 10 % ou 20 % (ou toute autre valeur).
- CONSERVE le taux déjà présent dans la facture actuelle. Ne le change QUE si l'artisan le demande explicitement (ex : "mets la TVA à 10", "TVA à 5,5").
- Si la facture actuelle n'a pas de taux, utilise 20 (le plus courant).
- "tauxTVA" est un nombre : 5.5, 10 ou 20.

═══════════════════════════════════════════════════════════
CORRECTIONS EN LANGAGE NATUREL
═══════════════════════════════════════════════════════════
Comprends les corrections : "ajoute...", "enlève la ligne...", "change le déplacement à 60", "le client c'est plutôt...", "renomme...", "corrige le cuivre à 95". Identifie la bonne ligne et modifie-la. Si on te demande d'enlever une ligne, retire-la de la liste.

═══════════════════════════════════════════════════════════
MÉTADONNÉES
═══════════════════════════════════════════════════════════
- Le numéro de facture, la date, la ville et les coordonnées de l'entreprise sont des paramètres déjà remplis. NE LES CHANGE PAS, SAUF si l'artisan le demande explicitement ("mets la facture au 12 mai", "numéro 24"). Dans ce cas seulement, renseigne "numeroFacture", "date" (format JJ/MM/AAAA) ou "ville".
- Renumérote toujours proprement les "lignesTravaux" (1, 2, 3...) dans l'ordre.

Renvoie TOUJOURS un appel à l'outil "remplir_facture" avec une facture complète et cohérente.`;

/**
 * Schéma de l'outil que Claude doit remplir (sortie structurée forcée).
 * On ne demande à l'IA QUE le contenu éditable : l'émetteur et les mentions
 * légales sont gérés côté application (Réglages), jamais par l'IA.
 */
export const OUTIL_REMPLIR_FACTURE = {
  name: "remplir_facture",
  description:
    "Renvoie la facture complète et à jour après application de l'instruction de l'artisan.",
  input_schema: {
    type: "object" as const,
    properties: {
      client: {
        type: "object",
        description: "Le client de la facture.",
        properties: {
          nom: { type: "string", description: "Nom du client, en majuscules si possible." },
          adresse: {
            type: "array",
            items: { type: "string" },
            description: "Lignes d'adresse du client (rue, puis code postal + ville).",
          },
        },
        required: ["nom", "adresse"],
      },
      site: {
        type: "string",
        description: "Le lieu du chantier, ex: 'Site Rivaly apt A05'. Vide si non dit.",
      },
      titreTravaux: {
        type: "string",
        description: "Intitulé global des travaux, ex: 'Travaux de réparation de fuite'.",
      },
      lignesTravaux: {
        type: "array",
        description:
          "Points numérotés DESCRIPTIFS des travaux réalisés. JAMAIS de prix sur ces lignes.",
        items: {
          type: "object",
          properties: {
            numero: { type: "integer", description: "Numéro d'ordre (1, 2, 3...)." },
            description: { type: "string", description: "Description de l'action réalisée." },
          },
          required: ["numero", "description"],
        },
      },
      fournitures: {
        type: "array",
        description: "Matériel utilisé. Chaque ligne a SON prix (null si non donné).",
        items: {
          type: "object",
          properties: {
            designation: { type: "string", description: "Nom du matériel." },
            prix: {
              type: ["number", "null"],
              description: "Prix en euros, ou null si non donné. JAMAIS 0 ni inventé.",
            },
          },
          required: ["designation", "prix"],
        },
      },
      prestations: {
        type: "array",
        description:
          "Prix GLOBAL de la main d'œuvre, ex: 'Prestation de service' 420. Souvent une seule ligne.",
        items: {
          type: "object",
          properties: {
            designation: { type: "string", description: "Libellé, ex: 'Prestation de service'." },
            prix: {
              type: ["number", "null"],
              description: "Montant global main d'œuvre en euros, ou null si non donné.",
            },
          },
          required: ["designation", "prix"],
        },
      },
      deplacement: {
        type: ["object", "null"],
        description: "Ligne déplacement unique, ou null si pas de déplacement.",
        properties: {
          designation: { type: "string", description: "Libellé, ex: 'Déplacement'." },
          prix: {
            type: ["number", "null"],
            description: "Montant du déplacement en euros, ou null si non donné.",
          },
        },
        required: ["designation", "prix"],
      },
      tauxTVA: {
        type: "number",
        description:
          "Taux de TVA en pourcentage : 5.5, 10 ou 20. Conserve le taux de la facture actuelle ; si aucun, mets 20.",
      },
      numeroFacture: {
        type: "string",
        description:
          "NE RENSEIGNER QUE si l'artisan demande explicitement de changer le numéro.",
      },
      date: {
        type: "string",
        description:
          "NE RENSEIGNER QUE si l'artisan demande explicitement de changer la date (format JJ/MM/AAAA).",
      },
      ville: {
        type: "string",
        description: "NE RENSEIGNER QUE si l'artisan demande explicitement de changer la ville.",
      },
    },
    required: [
      "client",
      "site",
      "titreTravaux",
      "lignesTravaux",
      "fournitures",
      "prestations",
      "deplacement",
      "tauxTVA",
    ],
  },
};

/**
 * Construit le message utilisateur envoyé à Claude : la facture actuelle (contenu
 * éditable uniquement) + la nouvelle instruction dictée ou tapée.
 */
export function messageUtilisateur(texte: string, factureActuelle: Facture): string {
  // On n'envoie à l'IA que le contenu éditable, pas l'émetteur ni les mentions légales.
  const contenu = {
    client: factureActuelle.client,
    site: factureActuelle.site,
    titreTravaux: factureActuelle.titreTravaux,
    lignesTravaux: factureActuelle.lignesTravaux,
    fournitures: factureActuelle.fournitures,
    prestations: factureActuelle.prestations,
    deplacement: factureActuelle.deplacement,
    tauxTVA: factureActuelle.tauxTVA,
    numeroFacture: factureActuelle.numeroFacture,
    date: factureActuelle.date,
    ville: factureActuelle.ville,
  };

  return `FACTURE ACTUELLE (JSON) :
${JSON.stringify(contenu, null, 2)}

NOUVELLE INSTRUCTION DE L'ARTISAN :
"""${texte}"""

Applique cette instruction à la facture actuelle et renvoie la facture complète mise à jour via l'outil remplir_facture.`;
}
