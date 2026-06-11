/**
 * API route /api/transcribe — transcription audio (voix -> texte).
 *
 * Reçoit l'audio enregistré dans le navigateur (FormData), l'envoie à Groq
 * (modèle Whisper large v3, rapide et bon en français parlé) et renvoie le texte.
 * La clé GROQ_API_KEY reste côté serveur.
 */

import Groq, { toFile } from "groq-sdk";
import { NextResponse } from "next/server";

const MODELE = "whisper-large-v3";

// Laisse jusqu'à 30 s à la fonction (marge si l'upload audio ou Groq est lent).
export const maxDuration = 30;

export async function POST(req: Request) {
  const cle = process.env.GROQ_API_KEY;
  if (!cle) {
    return NextResponse.json(
      {
        erreur:
          "La clé Groq n'est pas configurée. Ajoute GROQ_API_KEY dans le fichier .env.local.",
      },
      { status: 500 }
    );
  }

  let audio: File | null = null;
  try {
    const formData = await req.formData();
    audio = formData.get("audio") as File | null;
    if (!audio || audio.size === 0) throw new Error("audio manquant");
  } catch {
    return NextResponse.json(
      { erreur: "Je n'ai pas reçu d'audio. Réessaie d'enregistrer." },
      { status: 400 }
    );
  }

  try {
    const groq = new Groq({ apiKey: cle });

    // On reconstruit un fichier que le SDK sait envoyer, en gardant le bon type MIME
    // (iOS Safari enregistre en audio/mp4 ; Chrome en audio/webm — les deux passent).
    const buffer = Buffer.from(await audio.arrayBuffer());
    const fichier = await toFile(buffer, audio.name || "audio.m4a", {
      type: audio.type || "audio/m4a",
    });

    const transcription = await groq.audio.transcriptions.create({
      file: fichier,
      model: MODELE,
      language: "fr", // on sait que l'artisan parle français : meilleure précision
      temperature: 0,
    });

    return NextResponse.json({ texte: transcription.text.trim() });
  } catch (e) {
    console.error("Erreur /api/transcribe :", e);
    return NextResponse.json(
      { erreur: "Je n'ai pas bien entendu, peux-tu répéter ?" },
      { status: 502 }
    );
  }
}
