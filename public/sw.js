/*
 * Service worker minimal et SANS cache.
 *
 * L'app a besoin d'internet de toute façon (transcription Groq, extraction
 * Claude) : on ne vise pas le hors-ligne. Le service worker existe surtout pour
 * que la PWA soit installable. Il ne met RIEN en cache et, au contraire, il
 * EFFACE tout ancien cache.
 *
 * Pourquoi : une version précédente mettait les fichiers de l'app en cache, ce
 * qui pouvait servir un mélange ancien/nouveau après une mise à jour et bloquer
 * l'app sur « Chargement… ». Ici, toutes les requêtes vont directement au réseau.
 */

self.addEventListener("install", () => {
  // Prend la main immédiatement, sans attendre la fermeture des onglets.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Supprime TOUS les anciens caches laissés par les versions précédentes.
      const cles = await caches.keys();
      await Promise.all(cles.map((c) => caches.delete(c)));
      await self.clients.claim();
    })()
  );
});

// Volontairement AUCUN gestionnaire 'fetch' : rien n'est intercepté ni mis en
// cache, l'app charge toujours la dernière version depuis le réseau.
