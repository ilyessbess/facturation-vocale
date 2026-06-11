"use client";

/**
 * Sélecteur de taux de TVA, bien visible.
 * Trois boutons rapides (5,5 / 10 / 20) + une saisie libre pour tout autre taux.
 * Tout changement déclenche le recalcul des totaux dans le composant parent.
 */

type Props = {
  taux: number;
  onChange: (taux: number) => void;
};

const TAUX_RAPIDES = [5.5, 10, 20];

export default function SelecteurTVA({ taux, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-bold mr-1">TVA :</span>
      {TAUX_RAPIDES.map((t) => {
        const actif = taux === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`px-4 py-2 rounded-lg font-bold border-2 ${
              actif
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-blue-700 border-blue-300"
            }`}
          >
            {String(t).replace(".", ",")} %
          </button>
        );
      })}
      <label className="flex items-center gap-1">
        <span className="text-sm">Autre :</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={taux}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="w-20 px-2 py-2 rounded-lg border-2 border-slate-300 font-bold text-center"
        />
        <span>%</span>
      </label>
    </div>
  );
}
