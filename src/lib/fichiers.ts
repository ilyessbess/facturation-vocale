/**
 * Téléchargement et partage des fichiers générés.
 *
 * Important pour l'iPhone : on partage les fichiers UN PAR UN. Safari iOS ne
 * laisse passer de façon fiable qu'un seul fichier par action de l'utilisateur ;
 * vouloir envoyer le PDF et l'Excel d'un coup fait perdre le second. Chaque
 * bouton de l'app déclenche donc le partage d'un seul fichier.
 */

/** Déclenche le téléchargement classique d'un Blob (ordinateur, ou repli). */
export function telecharger(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Partage UN fichier. Sur iPhone, ouvre le menu de partage natif (Mail,
 * Messages, « Enregistrer dans Fichiers »…). Si le partage n'est pas disponible
 * (ordinateur), ouvre le fichier dans un nouvel onglet ou le télécharge.
 *
 * À appeler depuis un vrai appui de l'utilisateur (gardé tel quel pour iOS).
 */
export async function partagerFichier(
  blob: Blob,
  nomFichier: string
): Promise<void> {
  const file = new File([blob], nomFichier, { type: blob.type });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nomFichier });
      return;
    } catch (e) {
      // L'utilisateur a annulé : on n'insiste pas.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Autre erreur : on bascule sur l'ouverture/téléchargement ci-dessous.
    }
  }

  // Repli (ordinateur, ou navigateur sans partage) : téléchargement direct.
  // Fiable et prévisible partout : le fichier arrive dans le dossier Téléchargements.
  telecharger(blob, nomFichier);
}

/** Indique si l'appareil sait partager un fichier (iPhone, Safari Mac récent...). */
export function peutPartagerFichiers(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  // Test avec un fichier fictif : certains navigateurs n'ont share() que pour du texte.
  try {
    const test = new File(["x"], "test.txt", { type: "text/plain" });
    return !!nav.share && !!nav.canShare && nav.canShare({ files: [test] });
  } catch {
    return false;
  }
}
