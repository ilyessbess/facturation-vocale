"use client";

/**
 * Aperçu vivant et éditable de la facture.
 *
 * Se remplit au fur et à mesure que l'artisan dicte, et chaque champ reste
 * modifiable au doigt ou au clavier. Respecte les trois zones distinctes :
 *   - TRAVAUX     : lignes descriptives numérotées, SANS prix.
 *   - FOURNITURES : matériel, chaque ligne a son prix.
 *   - PRESTATIONS + DÉPLACEMENT : prix de la main d'œuvre et du déplacement.
 */

import type { Facture, LigneFourniture } from "@/lib/types";
import { calculerTotaux, formatEuros, formatTaux } from "@/lib/calculs";
import SelecteurTVA from "./SelecteurTVA";

type Props = {
  facture: Facture;
  onChange: (facture: Facture) => void;
};

/** Convertit la saisie d'un prix en number | null (vide = null, jamais 0 forcé). */
function parsePrix(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function ApercuFacture({ facture, onChange }: Props) {
  const totaux = calculerTotaux(facture);
  const maj = (patch: Partial<Facture>) => onChange({ ...facture, ...patch });

  // --- Helpers de mise à jour des listes (immutables) ---

  const majFourniture = (
    cle: "fournitures" | "prestations",
    index: number,
    patch: Partial<LigneFourniture>
  ) => {
    const liste = facture[cle].map((l, i) => (i === index ? { ...l, ...patch } : l));
    maj({ [cle]: liste } as Partial<Facture>);
  };

  const supprimerLigne = (cle: "fournitures" | "prestations", index: number) => {
    maj({ [cle]: facture[cle].filter((_, i) => i !== index) } as Partial<Facture>);
  };

  const ajouterLigne = (cle: "fournitures" | "prestations") => {
    maj({ [cle]: [...facture[cle], { designation: "", prix: null }] } as Partial<Facture>);
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-5">
      <h2 className="text-2xl font-bold">Aperçu de la facture</h2>

      {/* Métadonnées */}
      <div className="grid grid-cols-3 gap-2">
        <Champ label="N° facture">
          <input
            className={inputCls}
            value={facture.numeroFacture}
            onChange={(e) => maj({ numeroFacture: e.target.value })}
          />
        </Champ>
        <Champ label="Date">
          <input
            className={inputCls}
            value={facture.date}
            onChange={(e) => maj({ date: e.target.value })}
          />
        </Champ>
        <Champ label="Ville">
          <input
            className={inputCls}
            value={facture.ville}
            onChange={(e) => maj({ ville: e.target.value })}
          />
        </Champ>
      </div>

      {/* Client */}
      <div className="flex flex-col gap-2">
        <Titre>Client</Titre>
        <input
          className={inputCls}
          placeholder="Nom du client"
          value={facture.client.nom}
          onChange={(e) => maj({ client: { ...facture.client, nom: e.target.value } })}
        />
        <textarea
          className={inputCls}
          placeholder="Adresse (une ligne par retour à la ligne)"
          rows={2}
          value={facture.client.adresse.join("\n")}
          onChange={(e) =>
            maj({
              client: {
                ...facture.client,
                adresse: e.target.value.split("\n"),
              },
            })
          }
        />
      </div>

      {/* Chantier */}
      <div className="flex flex-col gap-2">
        <Titre>Chantier</Titre>
        <input
          className={inputCls}
          placeholder="Site / lieu du chantier"
          value={facture.site}
          onChange={(e) => maj({ site: e.target.value })}
        />
        <textarea
          className={inputCls}
          placeholder="Intitulé des travaux"
          rows={2}
          value={facture.titreTravaux}
          onChange={(e) => maj({ titreTravaux: e.target.value })}
        />
      </div>

      {/* Travaux (descriptifs, SANS prix) */}
      <div className="flex flex-col gap-2">
        <Titre>Travaux réalisés (sans prix)</Titre>
        {facture.lignesTravaux.length === 0 && (
          <p className="text-slate-400 italic">Aucune ligne de travaux pour l’instant.</p>
        )}
        {facture.lignesTravaux.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-bold w-8 text-right">{t.numero}/</span>
            <input
              className={inputCls + " flex-1"}
              value={t.description}
              onChange={(e) => {
                const lignes = facture.lignesTravaux.map((l, j) =>
                  j === i ? { ...l, description: e.target.value } : l
                );
                maj({ lignesTravaux: lignes });
              }}
            />
            <BoutonSuppr
              onClick={() => {
                const lignes = facture.lignesTravaux
                  .filter((_, j) => j !== i)
                  .map((l, k) => ({ ...l, numero: k + 1 }));
                maj({ lignesTravaux: lignes });
              }}
            />
          </div>
        ))}
        <BoutonAjout
          label="+ Ajouter une ligne de travaux"
          onClick={() =>
            maj({
              lignesTravaux: [
                ...facture.lignesTravaux,
                { numero: facture.lignesTravaux.length + 1, description: "" },
              ],
            })
          }
        />
      </div>

      {/* Fournitures (avec prix) */}
      <div className="flex flex-col gap-2">
        <Titre>Fournitures et accessoires</Titre>
        {facture.fournitures.map((f, i) => (
          <LigneAvecPrix
            key={i}
            ligne={f}
            onDesignation={(v) => majFourniture("fournitures", i, { designation: v })}
            onPrix={(v) => majFourniture("fournitures", i, { prix: parsePrix(v) })}
            onSuppr={() => supprimerLigne("fournitures", i)}
          />
        ))}
        <BoutonAjout label="+ Ajouter une fourniture" onClick={() => ajouterLigne("fournitures")} />
      </div>

      {/* Prestations (main d'œuvre globale) */}
      <div className="flex flex-col gap-2">
        <Titre>Prestation (main d’œuvre)</Titre>
        {facture.prestations.map((p, i) => (
          <LigneAvecPrix
            key={i}
            ligne={p}
            onDesignation={(v) => majFourniture("prestations", i, { designation: v })}
            onPrix={(v) => majFourniture("prestations", i, { prix: parsePrix(v) })}
            onSuppr={() => supprimerLigne("prestations", i)}
          />
        ))}
        <BoutonAjout label="+ Ajouter une prestation" onClick={() => ajouterLigne("prestations")} />
      </div>

      {/* Déplacement */}
      <div className="flex flex-col gap-2">
        <Titre>Déplacement</Titre>
        {facture.deplacement ? (
          <LigneAvecPrix
            ligne={facture.deplacement}
            onDesignation={(v) =>
              maj({ deplacement: { ...facture.deplacement!, designation: v } })
            }
            onPrix={(v) =>
              maj({ deplacement: { ...facture.deplacement!, prix: parsePrix(v) } })
            }
            onSuppr={() => maj({ deplacement: null })}
          />
        ) : (
          <BoutonAjout
            label="+ Ajouter un déplacement"
            onClick={() => maj({ deplacement: { designation: "Déplacement", prix: null } })}
          />
        )}
      </div>

      {/* TVA */}
      <div className="pt-1">
        <SelecteurTVA taux={facture.tauxTVA} onChange={(t) => maj({ tauxTVA: t })} />
      </div>

      {/* Totaux */}
      <div className="border-t border-slate-200 pt-3 flex flex-col gap-1 text-lg">
        <LigneTotal label="Total H.T" valeur={formatEuros(totaux.ht)} />
        <LigneTotal label={`T.V.A ${formatTaux(facture.tauxTVA)} %`} valeur={formatEuros(totaux.tva)} />
        <div className="flex justify-between font-bold text-2xl text-blue-700 pt-1">
          <span>Total T.T.C</span>
          <span>{formatEuros(totaux.ttc)}</span>
        </div>
      </div>
    </section>
  );
}

// ----------------------------- Sous-composants -----------------------------

const inputCls =
  "w-full px-3 py-3 rounded-lg border-2 border-slate-300 bg-white focus:border-blue-600 focus:outline-none";

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-slate-700">{children}</h3>;
}

/** Une ligne avec désignation + prix + suppression (fournitures, prestations, déplacement). */
function LigneAvecPrix({
  ligne,
  onDesignation,
  onPrix,
  onSuppr,
}: {
  ligne: LigneFourniture;
  onDesignation: (v: string) => void;
  onPrix: (v: string) => void;
  onSuppr: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className={inputCls + " flex-1"}
        placeholder="Désignation"
        value={ligne.designation}
        onChange={(e) => onDesignation(e.target.value)}
      />
      <div className="relative w-28">
        <input
          className={inputCls + " text-right pr-6"}
          inputMode="decimal"
          placeholder="—"
          value={ligne.prix ?? ""}
          onChange={(e) => onPrix(e.target.value)}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">€</span>
      </div>
      <BoutonSuppr onClick={onSuppr} />
    </div>
  );
}

function LigneTotal({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-semibold">{label}</span>
      <span>{valeur}</span>
    </div>
  );
}

function BoutonSuppr({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Supprimer la ligne"
      className="w-10 h-10 shrink-0 rounded-lg border-2 border-red-200 text-red-600 font-bold text-xl active:bg-red-50"
    >
      ×
    </button>
  );
}

function BoutonAjout({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start px-3 py-2 rounded-lg border-2 border-blue-200 text-blue-700 font-semibold active:bg-blue-50"
    >
      {label}
    </button>
  );
}
