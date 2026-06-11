"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (nécessaire pour que la PWA soit installable et
 * s'ouvre en plein écran sur l'iPhone). Composant invisible : aucun rendu.
 */
export default function EnregistrerSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // En développement on évite le SW pour ne pas mettre en cache un build instable.
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Échec silencieux : l'app fonctionne quand même sans le SW.
    });
  }, []);

  return null;
}
