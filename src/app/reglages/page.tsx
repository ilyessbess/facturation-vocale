"use client";

/**
 * Page Réglages — à saisir une seule fois.
 *
 * Coordonnées de l'entreprise (émetteur), taux de TVA par défaut, prochain numéro
 * de facture, logo. Pré-rempli avec les données FCCS pour que tout marche
 * immédiatement. Persisté en local via la couche storage.
 *
 * Note : pour FCCS, l'en-tête du PDF/Excel utilise les images officielles
 * (public/assets). Ces champs servent surtout au futur multi-artisan.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  REGLAGES_PAR_DEFAUT,
  loadReglages,
  saveReglages,
  type Reglages,
} from "@/lib/storage";

const inputCls =
  "w-full px-3 py-3 rounded-lg border-2 border-slate-300 bg-white focus:border-blue-600 focus:outline-none";

export default function ReglagesPage() {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    setReglages(loadReglages());
  }, []);

  if (!reglages) return <main className="p-6 text-xl">Chargement…</main>;

  const e = reglages.emetteur;
  const setEmetteur = (patch: Partial<typeof e>) =>
    setReglages({ ...reglages, emetteur: { ...e, ...patch } });

  function enregistrer() {
    if (!reglages) return;
    saveReglages(reglages);
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2500);
  }

  function reinitialiser() {
    setReglages(REGLAGES_PAR_DEFAUT);
  }

  function onLogo(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setEmetteur({ logoUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <main className="flex flex-col gap-5 max-w-xl mx-auto w-full px-4 py-5 safe-bottom">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Réglages</h1>
        <Link href="/" className="px-3 py-2 rounded-lg border-2 border-slate-300 font-bold">
          ← Retour
        </Link>
      </header>

      <Bloc titre="Entreprise">
        <Champ label="Nom de la société">
          <input
            className={inputCls}
            value={e.nomSociete}
            onChange={(ev) => setEmetteur({ nomSociete: ev.target.value })}
          />
        </Champ>
        <Champ label="Adresse">
          <input
            className={inputCls}
            value={e.adresse}
            onChange={(ev) => setEmetteur({ adresse: ev.target.value })}
          />
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="SIRET">
            <input
              className={inputCls}
              value={e.siret}
              onChange={(ev) => setEmetteur({ siret: ev.target.value })}
            />
          </Champ>
          <Champ label="N° TVA">
            <input
              className={inputCls}
              value={e.numeroTVA}
              onChange={(ev) => setEmetteur({ numeroTVA: ev.target.value })}
            />
          </Champ>
          <Champ label="RM">
            <input
              className={inputCls}
              value={e.rm}
              onChange={(ev) => setEmetteur({ rm: ev.target.value })}
            />
          </Champ>
          <Champ label="Email">
            <input
              className={inputCls}
              value={e.email}
              onChange={(ev) => setEmetteur({ email: ev.target.value })}
            />
          </Champ>
          <Champ label="Tél. fixe">
            <input
              className={inputCls}
              value={e.telFixe}
              onChange={(ev) => setEmetteur({ telFixe: ev.target.value })}
            />
          </Champ>
          <Champ label="Tél. mobile">
            <input
              className={inputCls}
              value={e.telMobile}
              onChange={(ev) => setEmetteur({ telMobile: ev.target.value })}
            />
          </Champ>
        </div>
        <Champ label="Logo (optionnel, pour le futur multi-artisan)">
          <input
            type="file"
            accept="image/*"
            onChange={(ev) => onLogo(ev.target.files?.[0] ?? null)}
          />
          {e.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.logoUrl} alt="Logo" className="mt-2 h-16 object-contain" />
          )}
        </Champ>
      </Bloc>

      <Bloc titre="Facturation">
        <div className="grid grid-cols-2 gap-3">
          <Champ label="TVA par défaut (%)">
            <input
              className={inputCls}
              type="number"
              step="0.5"
              value={reglages.tauxTVADefaut}
              onChange={(ev) =>
                setReglages({
                  ...reglages,
                  tauxTVADefaut: parseFloat(ev.target.value) || 0,
                })
              }
            />
          </Champ>
          <Champ label="Prochain n° de facture">
            <input
              className={inputCls}
              value={reglages.prochainNumeroFacture}
              onChange={(ev) =>
                setReglages({ ...reglages, prochainNumeroFacture: ev.target.value })
              }
            />
          </Champ>
        </div>
      </Bloc>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={enregistrer}
          className="px-4 py-4 rounded-xl bg-green-700 text-white font-bold text-lg active:bg-green-800"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={reinitialiser}
          className="px-4 py-4 rounded-xl border-2 border-slate-300 font-bold"
        >
          Réinitialiser (FCCS)
        </button>
        {enregistre && <span className="font-bold text-green-700">Enregistré ✓</span>}
      </div>
    </main>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3">
      <h2 className="text-xl font-bold">{titre}</h2>
      {children}
    </section>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
