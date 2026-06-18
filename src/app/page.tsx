"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadHistorique,
  deleteHistoriqueEntry,
  loadReglages,
  saveFacture,
  type HistoriqueEntry,
} from "@/lib/storage";
import { calculerTotaux } from "@/lib/calculs";
import { genererPDF } from "@/lib/pdf";
import { partagerFichier, peutPartagerFichiers } from "@/lib/fichiers";

function abregerSite(site: string): string {
  if (!site?.trim()) return "";
  const s = site.trim();
  return s.length <= 22 ? s : s.slice(0, 21) + "…";
}

export default function Dashboard() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [peutPartager, setPeutPartager] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [prenom, setPrenom] = useState("");

  useEffect(() => {
    setEntries(loadHistorique());
    setPeutPartager(peutPartagerFichiers());
    const reglages = loadReglages();
    setPrenom(reglages.prenomUtilisateur ?? "");
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const initiale = prenom ? prenom[0].toUpperCase() : "F";

  function ouvrirFacture(entry: HistoriqueEntry) {
    saveFacture(entry.facture);
    router.push("/facturer");
  }

  function supprimer(id: string) {
    const ok = window.confirm("Supprimer cette facture de l'historique ?");
    if (!ok) return;
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
              {prenom ? `Bonjour, ${prenom}` : "Bonjour"}
            </h1>
            <p className="text-slate-400 text-sm capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg select-none">
              {initiale}
            </div>
            <Link
              href="/reglages"
              className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-slate-200 text-slate-500 font-bold"
              aria-label="Réglages"
            >
              ⚙︎
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-w-xl mx-auto w-full px-4 py-5 flex-1">
        {/* CTA — dicter une facture */}
        <Link
          href="/facturer"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 flex items-center gap-4 active:bg-slate-50"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26" aria-hidden="true">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
              <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">Dicter une facture</p>
            <p className="text-slate-400 text-sm">Parler, l'app s'occupe du reste</p>
          </div>
        </Link>

        {/* Historique */}
        {entries.length > 0 && (
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase px-1 mt-1">
            Récentes
          </p>
        )}

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-12 text-center">
            <span className="text-5xl">📄</span>
            <p className="font-semibold text-slate-600">
              Aucune facture enregistrée
            </p>
            <p className="text-slate-400 text-sm">
              Dicte ta première facture en appuyant sur la carte ci-dessus.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => {
              const { ttc } = calculerTotaux(entry.facture);
              const { numeroFacture, client, site } = entry.facture;
              const siteCourt = abregerSite(site);
              const ttcAffiche =
                Number.isInteger(ttc)
                  ? `${ttc} €`
                  : `${ttc.toFixed(2).replace(".", ",")} €`;

              return (
                <li
                  key={entry.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* Zone principale — tap pour modifier */}
                  <button
                    type="button"
                    onClick={() => ouvrirFacture(entry)}
                    className="w-full px-4 py-4 flex items-center gap-3 active:bg-slate-50 text-left"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {client.nom || "Client"}
                      </p>
                      <p className="text-slate-400 text-sm truncate">
                        Facture #{numeroFacture}
                        {siteCourt ? ` (${siteCourt})` : ""}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900 flex-shrink-0">
                      {ttcAffiche}
                    </span>
                  </button>

                  {/* Barre d'actions */}
                  <div className="border-t border-slate-100 flex">
                    <button
                      type="button"
                      onClick={() => regenerer(entry)}
                      disabled={enCours === entry.id}
                      className="flex-1 py-3 text-sm text-blue-600 font-semibold flex items-center justify-center gap-1.5 active:bg-blue-50 disabled:opacity-40"
                    >
                      <span>📄</span>
                      <span>
                        {enCours === entry.id
                          ? "Génération…"
                          : peutPartager
                          ? "Partager le PDF"
                          : "Télécharger le PDF"}
                      </span>
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button
                      type="button"
                      onClick={() => supprimer(entry.id)}
                      className="px-5 py-3 text-sm text-red-400 font-semibold active:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
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
            href="/facturer"
            className="block w-full py-4 rounded-2xl bg-blue-600 text-white font-extrabold text-center text-lg shadow-lg active:bg-blue-700"
          >
            + Nouvelle facture
          </Link>
        </div>
      </div>
    </main>
  );
}
