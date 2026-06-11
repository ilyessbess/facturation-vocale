"use client";

import { useRef, useState } from "react";

/**
 * Le gros bouton micro, élément central de l'écran.
 *
 * Fonctionnement simple et robuste au doigt : un appui démarre l'enregistrement
 * ("J'écoute…"), un second appui l'arrête et envoie l'audio ("Je réfléchis…").
 * Utilise MediaRecorder, supporté par Safari iOS (enregistre en audio/mp4).
 */

type Props = {
  /** Appelé avec l'audio enregistré quand l'artisan arrête. */
  onAudio: (blob: Blob) => void;
  /** True pendant que l'app transcrit / réfléchit : le bouton est en attente. */
  occupe: boolean;
  /** Message d'erreur à afficher (ex: micro refusé). */
  onErreur: (message: string) => void;
};

type Etat = "pret" | "ecoute";

export default function BoutonMicro({ onAudio, occupe, onErreur }: Props) {
  const [etat, setEtat] = useState<Etat>("pret");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function demarrer() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/mp4";
        const blob = new Blob(chunksRef.current, { type });
        // On coupe le micro (sinon le voyant reste allumé sur iPhone).
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size > 0) onAudio(blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      setEtat("ecoute");
    } catch {
      onErreur(
        "Je n'ai pas pu accéder au micro. Autorise le micro dans Safari, puis réessaie."
      );
    }
  }

  function arreter() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setEtat("pret");
  }

  function onClick() {
    if (occupe) return;
    if (etat === "pret") demarrer();
    else arreter();
  }

  // Apparence selon l'état.
  const enEcoute = etat === "ecoute";
  const couleur = occupe
    ? "bg-slate-400"
    : enEcoute
    ? "bg-red-600 animate-pulse"
    : "bg-blue-700 active:bg-blue-800";

  const libelle = occupe
    ? "Je réfléchis…"
    : enEcoute
    ? "J'écoute… (appuie pour arrêter)"
    : "Appuie et parle";

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <button
        type="button"
        onClick={onClick}
        disabled={occupe}
        aria-label={libelle}
        className={`${couleur} text-white w-44 h-44 rounded-full shadow-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed`}
      >
        {/* Icône micro (forme géométrique, pas de figure animée) */}
        <svg
          width="72"
          height="72"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      </button>
      <p className="text-xl font-bold text-center min-h-7" aria-live="polite">
        {libelle}
      </p>
    </div>
  );
}
