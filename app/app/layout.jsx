import "./globals.css";
import OrdenarTabelas from "./ordenarTabelas";
import Dialogos from "./dialogo";   // v424 — avisos e confirmações do sistema
import Pwa from "./pwa";   // v454 — instalável como app no celular

export const metadata = {
  title: "Compras & Estoque — Meridian",
  description: "Sistema de gestão de material e financeiro",
  // v454 — ícone na tela inicial do celular (Android e iPhone)
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Meridian", statusBarStyle: "black-translucent" },
};
export const viewport = { themeColor: "#001E41", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}<OrdenarTabelas /><Dialogos /><Pwa /></body>
    </html>
  );
}
