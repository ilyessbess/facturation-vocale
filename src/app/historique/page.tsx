"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadHistorique, deleteHistoriqueEntry, type HistoriqueEntry } from "@/lib/storage";
import { calculerTotaux, formatEuros } from "@/lib/calculs";
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

  function formaterDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <main className="flex flex-col gap-4 max-w-xl mx-auto w-full px-4 py-5 safe-bottom">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Historique</h1>
        <Link
          href="/"
          className="px-3 py-2 rounded-lg border-2 border-slate-300 font-bold"
        >
          ← Retour
        </Link>
      </header>

      {entries.length === 0 ? (
        <p className="text-slate-500 text-center mt-10">
          Aucune facture enregistrée pour l'instant.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => {
            const { ttc } = calculerTotaux(entry.facture);
            const { numeroFacture, date, client } = entry.facture;
            return (
              <li
                key={entry.id}
                className="bg-white rounded-2xl border-2 border-slate-200 px-4 py-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-lg">
                      Facture n° {numeroFacture}
                    </span>
                    <span className="text-slate-500 text-sm">{date}</span>
                    <span className="text-slate-700 font-semibold mt-1">
                      {client.nom || "Client inconnu"}
                    </span>
                    <span className="text-green-700 font-bold text-lg">
                      {formatEuros(ttc)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => supprimer(entry.id)}
                    className="text-slate-400 hover:text-red-500 text-xl px-2 py-1 rounded-lg"
                    aria-label="Supprimer cette entrée"
                  >
                    ×
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => regenerer(entry)}
                  disabled={enCours === entry.id}
                  className="flex items-center gap-2 justify-center px-4 py-3 rounded-xl border-2 border-green-400 text-green-800 font-bold active:bg-green-50 disabled:opacity-40"
                >
                  <span aria-hidden="true">📄</span>
                  <span>
                    {enCours === entry.id
                      ? "Génération…"
                      : peutPartager
                      ? "Partager le PDF"
                      : "Télécharger le PDF"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
