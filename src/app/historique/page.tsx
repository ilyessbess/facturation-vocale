"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadHistorique,
  deleteHistoriqueEntry,
  type HistoriqueEntry,
} from "@/lib/storage";
import { calculerTotaux } from "@/lib/calculs";
import { genererPDF } from "@/lib/pdf";
import { partagerFichier, peutPartagerFichiers } from "@/lib/fichiers";

export default function Historique() {
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [peutPartager, setPeutPartager] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    setEntries(loadHistorique());
    setPeutPartager(peutPartagerFichiers());
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function supprimer(id: string) {
    deleteHistoriqueEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function regenerer(entry: HistoriqueEntry) {
    setEnCours(entry.id);
    try {
      const pdf = await genererPDF(entry.facture);
      await partagerFichier(pdf.blob, pdf.nomFichier);
    } catch {
      alert("Erreur lors de la génération du PDF.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white px-5 pt-10 pb-5 border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Factures récentes
            </h1>
            <p className="text-slate-400 text-sm capitalize">{today}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg select-none">
            F
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-3 max-w-xl mx-auto w-full px-4 py-5 flex-1">
        {entries.length > 0 && (
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase px-1">
            Récentes
          </p>
        )}

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-20 text-center">
            <span className="text-5xl">📄</span>
            <p className="font-semibold text-slate-600">
              Aucune facture enregistrée
            </p>
            <p className="text-slate-400 text-sm">
              Génère ta première facture depuis l'écran principal.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => {
              const { ttc } = calculerTotaux(entry.facture);
              const { numeroFacture, client } = entry.facture;
              const ttcAffiche =
                Number.isInteger(ttc) ? `${ttc} €` : `${ttc.toFixed(2).replace(".", ",")} €`;
              return (
                <li
                  key={entry.id}
                  className="bg-white rounded-2xl shadow-sm px-4 py-4 flex items-center gap-3"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {client.nom || "Client"}
                    </p>
                    <p className="text-slate-400 text-sm">
                      Facture #{numeroFacture}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="font-bold text-slate-900">{ttcAffiche}</span>
                    <button
                      type="button"
                      onClick={() => regenerer(entry)}
                      disabled={enCours === entry.id}
                      className="text-xs text-blue-600 font-semibold disabled:opacity-40"
                    >
                      {enCours === entry.id
                        ? "…"
                        : peutPartager
                        ? "Partager"
                        : "Télécharger"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => supprimer(entry.id)}
                    className="text-slate-300 active:text-red-400 text-xl px-1 flex-shrink-0"
                    aria-label="Supprimer"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bouton bas de page */}
      <div className="sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-6 pb-8 px-4">
        <div className="max-w-xl mx-auto">
          <Link
            href="/"
            className="block w-full py-4 rounded-2xl bg-blue-600 text-white font-extrabold text-center text-lg shadow-lg active:bg-blue-700"
          >
            + Nouvelle facture
          </Link>
        </div>
      </div>
    </main>
  );
}
