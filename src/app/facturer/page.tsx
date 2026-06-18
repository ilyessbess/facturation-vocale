"use client";

/**
 * Écran principal — un seul écran, le micro au centre.
 *
 * Orchestration du pipeline :
 *   voix → /api/transcribe (Groq) → texte → /api/extract (Claude) → facture mise à jour.
 * La correction écrite passe directement par /api/extract. Le brouillon est
 * sauvegardé en local à chaque changement pour ne rien perdre.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import BoutonMicro from "@/components/BoutonMicro";
import ApercuFacture from "@/components/ApercuFacture";
import type { Facture } from "@/lib/types";
import { factureVide } from "@/lib/demo";
import {
  clearFacture,
  incrementerNumero,
  loadFacture,
  loadReglages,
  saveFacture,
  saveReglages,
  saveHistoriqueEntry,
} from "@/lib/storage";
import { genererPDF } from "@/lib/pdf";
import { partagerFichier, peutPartagerFichiers } from "@/lib/fichiers";

type Message = { texte: string; type: "info" | "erreur" } | null;

/** Petite pause (ms). */
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envoie une requête au serveur en RÉESSAYANT automatiquement si le réseau
 * coupe. Indispensable pour un usage en voiture (connexion qui saute). On tente
 * jusqu'à 3 fois, avec une courte pause entre chaque essai.
 */
async function envoyerAvecReprise(
  url: string,
  options: RequestInit,
  onReprise: () => void
): Promise<Response> {
  const pauses = [800, 1600]; // attentes avant les 2 reprises
  let derniereErreur: unknown;
  for (let i = 0; i <= pauses.length; i++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      derniereErreur = e;
      if (i < pauses.length) {
        onReprise();
        await attendre(pauses[i]);
      }
    }
  }
  throw derniereErreur;
}

/** Lit le JSON d'une réponse sans planter si la réponse n'en est pas. */
async function litJson(
  r: Response
): Promise<{ erreur?: string; texte?: string; facture?: Facture }> {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

export default function Page() {
  const [facture, setFacture] = useState<Facture | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  // Fichiers générés en attente de partage (un bouton par fichier).
  const [fichiers, setFichiers] = useState<{ blob: Blob; nomFichier: string }[]>([]);
  // L'appareil sait-il partager (iPhone) ou faut-il télécharger (ordinateur) ?
  const [peutPartager, setPeutPartager] = useState(false);
  useEffect(() => setPeutPartager(peutPartagerFichiers()), []);

  // Au démarrage : on reprend le brouillon en cours, sinon une facture VIERGE
  // (en-tête, numéro, date, ville et déplacement pré-remplis ; le reste à dicter).
  useEffect(() => {
    const reglages = loadReglages();
    const brouillon = loadFacture();
    setFacture(
      brouillon ??
        factureVide(
          reglages.emetteur,
          reglages.prochainNumeroFacture,
          reglages.tauxTVADefaut
        )
    );
  }, []);

  // Sauvegarde locale à chaque changement (rien n'est perdu si l'app se ferme).
  useEffect(() => {
    if (facture) saveFacture(facture);
  }, [facture]);

  function info(texte: string) {
    setMessage({ texte, type: "info" });
  }
  function erreur(texte: string) {
    setMessage({ texte, type: "erreur" });
  }

  /** Nouvelle facture vierge (en-tête et numéro pré-remplis depuis les Réglages). */
  function nouvelleFacture() {
    const reglages = loadReglages();
    const f = factureVide(
      reglages.emetteur,
      reglages.prochainNumeroFacture,
      reglages.tauxTVADefaut
    );
    clearFacture();
    setFacture(f);
    setFichiers([]);
    setMessage(null);
  }

  /** Envoie un texte (dicté puis transcrit, ou tapé) à l'extraction Claude. */
  async function appliquerTexte(texte: string) {
    if (!facture) return;
    setOccupe(true);
    info("Je réfléchis…");
    try {
      const r = await envoyerAvecReprise(
        "/api/extract",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texte, factureActuelle: facture }),
        },
        () => info("La connexion est lente, je réessaie…")
      );
      const data = await litJson(r);
      if (!r.ok) {
        erreur(data.erreur ?? "Je n'ai pas tout compris. Reformule ou tape la correction.");
        return;
      }
      if (data.facture) setFacture(data.facture);
      setMessage(null);
    } catch {
      erreur("La connexion a échoué (réseau faible ?). Appuie à nouveau pour réessayer.");
    } finally {
      setOccupe(false);
    }
  }

  /** Reçoit l'audio du micro : transcription puis extraction. */
  async function onAudio(blob: Blob) {
    setOccupe(true);
    info("Je transcris ce que tu as dit…");
    try {
      const form = new FormData();
      const ext = blob.type.includes("webm") ? "webm" : "m4a";
      form.append("audio", blob, `audio.${ext}`);

      const r = await envoyerAvecReprise(
        "/api/transcribe",
        { method: "POST", body: form },
        () => info("La connexion est lente, je réessaie…")
      );
      const data = await litJson(r);
      if (!r.ok) {
        erreur(data.erreur ?? "Je n'ai pas bien entendu, peux-tu répéter ?");
        setOccupe(false);
        return;
      }
      const texte = (data.texte ?? "").trim();
      if (!texte) {
        erreur("Je n'ai rien entendu. Rapproche le téléphone et réessaie.");
        setOccupe(false);
        return;
      }
      // On enchaîne directement sur l'extraction.
      await appliquerTexte(texte);
    } catch {
      erreur("La connexion a échoué (réseau faible ?). Appuie à nouveau pour réessayer.");
      setOccupe(false);
    }
  }

  /** Génère le PDF et le propose (partage natif iPhone ou téléchargement direct). */
  async function genererFichiers() {
    if (!facture) return;
    setOccupe(true);
    setFichiers([]);
    info("Je prépare le PDF…");
    try {
      const pdf = await genererPDF(facture);
      setFichiers([pdf]);

      // Sauvegarde dans l'historique puis incrémentation du numéro.
      saveHistoriqueEntry(facture);
      const reglages = loadReglages();
      reglages.prochainNumeroFacture = incrementerNumero(facture.numeroFacture);
      saveReglages(reglages);

      info("Fichiers prêts. Utilise les boutons verts ci-dessous.");
    } catch (e) {
      console.error(e);
      erreur("Je n'ai pas réussi à générer les fichiers. Réessaie.");
    } finally {
      setOccupe(false);
    }
  }

  if (!facture) {
    return <main className="p-6 text-xl">Chargement…</main>;
  }

  return (
    <main className="flex flex-col gap-6 max-w-xl mx-auto w-full px-4 py-5 safe-bottom">
      {/* En-tête de l'app */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Facture FCCS</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={nouvelleFacture}
            className="px-3 py-2 rounded-lg bg-blue-700 text-white font-bold active:bg-blue-800"
          >
            Nouvelle facture
          </button>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border-2 border-slate-300 font-bold"
            aria-label="Historique"
          >
            📋
          </Link>
          <Link
            href="/reglages"
            className="px-3 py-2 rounded-lg border-2 border-slate-300 font-bold"
            aria-label="Réglages"
          >
            ⚙︎
          </Link>
        </div>
      </header>

      {/* Bouton micro central */}
      <div className="py-2">
        <BoutonMicro onAudio={onAudio} occupe={occupe} onErreur={erreur} />
      </div>

      {/* Message d'état / erreur, lisible et rassurant */}
      {message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 font-semibold text-center ${
            message.type === "erreur"
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {message.texte}
        </div>
      )}

      {/* Aperçu vivant et éditable */}
      <ApercuFacture facture={facture} onChange={setFacture} />

      {/* Génération du PDF */}
      <button
        type="button"
        onClick={genererFichiers}
        disabled={occupe}
        className="px-4 py-5 rounded-xl bg-green-700 text-white font-bold text-xl shadow active:bg-green-800 disabled:opacity-40"
      >
        Générer le PDF
      </button>

      {/* Fichiers prêts : un bouton par fichier (fiable sur iPhone) */}
      {fichiers.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-green-300 p-4 flex flex-col gap-3">
          <p className="font-bold text-lg">Fichiers prêts</p>
          <p className="text-slate-600 text-sm">
            {peutPartager
              ? "Touche pour envoyer (mail, SMS) ou enregistrer le PDF."
              : "Clique pour télécharger le PDF sur ton ordinateur."}
          </p>
          {fichiers.map((f) => {
            const estPdf = f.nomFichier.toLowerCase().endsWith(".pdf");
            const verbe = peutPartager ? "Partager" : "Télécharger";
            return (
              <button
                key={f.nomFichier}
                type="button"
                onClick={() => partagerFichier(f.blob, f.nomFichier)}
                className="flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-green-400 text-green-800 font-bold text-lg active:bg-green-50"
              >
                <span className="text-2xl" aria-hidden="true">
                  {estPdf ? "📄" : "📊"}
                </span>
                <span>{estPdf ? `${verbe} le PDF` : `${verbe} l’Excel`}</span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
