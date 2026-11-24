// v1108 — prévia do link no WhatsApp com a peça: "Escolha aqui os detalhes da sua CAMISETA …"
import { linkPublico } from "@/lib/dadosLink";
import { itemDoTitulo } from "@/lib/itemSemCor";
export async function generateMetadata({ params }) {
  const l = await linkPublico(params.token).catch(() => null);
  const title = l ? `Escolha aqui os detalhes da sua ${itemDoTitulo(l.titulo)}` : "Escolha aqui os detalhes da sua camisa";
  const description = "Escolha o tamanho e escreva o que vai na sua peça.";
  return { title, description, openGraph: { title, description, siteName: "Meridian", type: "website", images: [{ url: "/og-link-dados.png", width: 600, height: 600, alt: "Meridian" }] } };
}
export default function DadosTokenLayout({ children }) { return children; }
