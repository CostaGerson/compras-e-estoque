// v1080 — sugestão #102 (Maycon): ver a OC na rota de coleta da OC e a OS na rota de facção aberta pelo PCP.
// A OC vem do ERP (dados atuais; o navegador desenha a imagem). A OS vem do PCP em PDF, sem preços
// (GET {PCP}/api/ext/os/documento?os=N com X-Api-Key). O token do PCP fica só no servidor.
import { prisma } from "@/lib/prisma";
import { listarOcs } from "@/lib/pic";
import { conexao } from "@/lib/cronograma";

const demanda = (id) => prisma.rotaDemanda.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, ocId: true, origem: true, origemRef: true, origemDados: true } });

export const osDaDemanda = (d) => (d?.origem === "PCP" ? String(d.origemDados?.osPcp ?? d.origemRef ?? "").trim() || null : null);

export async function ocDaDemanda(id) {
  const d = await demanda(id);
  if (!d?.ocId) return { error: "Esta demanda não é de uma OC.", status: 404 };
  const [o] = await listarOcs({ ids: [d.ocId] });
  return o ? { oc: o } : { error: "OC não encontrada.", status: 404 };
}

// devolve { pdf: Buffer, os } ou { error, status }
export async function osPdfDaDemanda(id) {
  const os = osDaDemanda(await demanda(id));
  if (!os) return { error: "Esta demanda não veio de uma OS do PCP.", status: 404 };
  const { url, token } = await conexao();
  if (!token) return { error: "Falha de integração com o PCP (token não configurado).", status: 502 };
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await fetch(`${url}/api/ext/os/documento?os=${encodeURIComponent(os)}`, { headers: { "X-Api-Key": token, Accept: "application/pdf" }, signal: ac.signal, cache: "no-store" });
    if (r.status === 404) return { error: `OS ${os} não encontrada no PCP.`, status: 404 };
    if (r.status === 401 || r.status === 403) return { error: "Falha de integração com o PCP.", status: 502 };
    if (!r.ok) return { error: `PCP respondeu ${r.status}. Tente de novo.`, status: 502 };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.subarray(0, 4).toString() !== "%PDF") return { error: "O PCP não devolveu um PDF. Tente de novo.", status: 502 };
    return { pdf: buf, os };
  } catch (e) {
    return { error: e.name === "AbortError" ? "PCP sem resposta em 30 s, tente de novo." : "PCP fora do ar, tente de novo.", status: 502 };
  } finally { clearTimeout(t); }
}
