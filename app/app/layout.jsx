import "./globals.css";

export const metadata = {
  title: "Compras & Estoque — Meridian",
  description: "Sistema de gestão de material e financeiro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
