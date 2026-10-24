import "./globals.css";
import OrdenarTabelas from "./ordenarTabelas";
import Dialogos from "./dialogo";   // v424 — avisos e confirmações do sistema

export const metadata = {
  title: "Compras & Estoque — Meridian",
  description: "Sistema de gestão de material e financeiro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}<OrdenarTabelas /><Dialogos /></body>
    </html>
  );
}
