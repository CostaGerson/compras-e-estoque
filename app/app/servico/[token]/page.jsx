// v1006 — lançamento de serviço pelas ferramentas de Silk e Bordado do PCP (sem login; vale o link)
// Mesma tela do ERP (PedidoEditor), travada em "Serviço".
export const dynamic = "force-dynamic";
import { tokenServicoOk, SETORES_SERVICO } from "@/lib/servicoPcp";
import ServicoPcp from "../servicoPcp";

export const metadata = { title: "Lançar serviço — Meridian" };

export default function Page({ params, searchParams }) {
  const setor = String(searchParams?.setor || "").toLowerCase();
  if (!tokenServicoOk(params.token) || !SETORES_SERVICO[setor])
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui", color: "#667085" }}>Link inválido. Abra pelo botão “Lançar serviço” na ferramenta de Silk ou Bordado.</div>;
  return <ServicoPcp uid={`svc:${params.token}:${setor}`} setor={SETORES_SERVICO[setor]} voltarUrl={searchParams?.voltar || ""} />;
}
