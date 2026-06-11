import type { Metadata, Viewport } from "next";
import "./globals.css";
import EnregistrerSW from "@/components/EnregistrerSW";

export const metadata: Metadata = {
  title: "Facture FCCS",
  description: "Crée ta facture à la voix après un chantier.",
  manifest: "/manifest.json",
  // Permet l'installation et le plein écran sur l'écran d'accueil iPhone.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Facture",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // évite le zoom involontaire en voiture
  userScalable: false,
  viewportFit: "cover", // gère l'encoche iPhone
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <EnregistrerSW />
      </body>
    </html>
  );
}
