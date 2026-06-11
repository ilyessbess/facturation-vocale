"use client";

import { useState } from "react";

/**
 * Bas de l'écran : corriger en écrivant (même moteur que la voix) + générer
 * le PDF et l'Excel. La correction texte sert quand l'artisan a été mal compris.
 */

type Props = {
  onCorrection: (texte: string) => void;
  onGenerer: () => void;
  occupe: boolean;
};

export default function ZoneCorrection({ onCorrection, onGenerer, occupe }: Props) {
  const [texte, setTexte] = useState("");

  function envoyer() {
    const t = texte.trim();
    if (!t || occupe) return;
    onCorrection(t);
    setTexte("");
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-bold">Corriger en écrivant</span>
        <textarea
          className="w-full px-3 py-3 rounded-lg border-2 border-slate-300 bg-white focus:border-blue-600 focus:outline-none"
          rows={2}
          placeholder='Ex : "change le déplacement à 60", "ajoute 50 € de soudure", "enlève la dernière fourniture"'
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={envoyer}
        disabled={occupe || texte.trim() === ""}
        className="px-4 py-3 rounded-lg bg-slate-700 text-white font-bold active:bg-slate-800 disabled:opacity-40"
      >
        Appliquer la correction
      </button>

      <button
        type="button"
        onClick={onGenerer}
        disabled={occupe}
        className="px-4 py-5 rounded-xl bg-green-700 text-white font-bold text-xl shadow active:bg-green-800 disabled:opacity-40"
      >
        Générer le PDF et l’Excel
      </button>
    </div>
  );
}
