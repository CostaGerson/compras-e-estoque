import "./globals.css";
import OrdenarTabelas from "./ordenarTabelas";
import Dialogos from "./dialogo";   // v424 — avisos e confirmações do sistema
import Pwa from "./pwa";   // v454 — instalável como app no celular
import CliqueFora from "./cliqueFora";   // v508

export const metadata = {
  title: "ERP Meridian",   // v456
  description: "Sistema de gestão de material e financeiro",
  // v454 — ícone na tela inicial do celular (Android e iPhone)
  referrer: "strict-origin-when-cross-origin",   // v459 — o mapa (OpenStreetMap) exige o Referer
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon.png", type: "image/png" }], apple: "/apple-touch-icon.png" },   // v456 — aba: só a montanha, azul-marinho
  appleWebApp: { capable: true, title: "ERP Meridian", statusBarStyle: "black-translucent" },
};
export const viewport = { themeColor: "#001E41", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}<OrdenarTabelas /><Dialogos /><Pwa /><CliqueFora /></body>
    </html>
  );
}
