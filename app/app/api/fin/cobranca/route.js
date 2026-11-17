// v903 — e-mail de cobrança e NFs das contas a receber
//   GET ?u=&ids=1,2,3            → NFs (PDF) encontradas para cada título
//   GET ?u=&arq=F12 | A34        → um PDF (F = NF do Movimento fiscal · A = anexo da conta)
//   GET ?u=&ids=…&zip=1          → ZIP com os PDFs das NFs dos títulos
//   POST { usuarioId, para, assunto, corpo, tituloIds } → envia com as NFs anexadas
export const dynamic = "force-dynamic";
import { zipSync } from "fflate";
import { usuarioMaster, negado } from "@/lib/fin";
import { nfsDosTitulos, enviarCobranca, conteudo } from "@/lib/cobrancaEmail";

const chave = (a) => (a.fiscalId ? `F${a.fiscalId}` : `A${a.anexoId}`);
const pdf = (buf, nome, baixar = true) => new Response(buf, { headers: { "Content-Type": nome.endsWith(".zip") ? "application/zip" : "application/pdf", "Cache-Control": "no-store",
  "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nome)}` } });

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioMaster(sp.get("u"));
  if (!u) return negado();
  const arq = String(sp.get("arq") || "");
  if (/^[FA]\d+$/.test(arq)) {
    const a = arq[0] === "F" ? { fiscalId: Number(arq.slice(1)) } : { anexoId: Number(arq.slice(1)) };
    const c = await conteudo(a).catch(() => null);
    if (!c) return new Response("Arquivo não encontrado.", { status: 404 });
    return pdf(Buffer.from(c, "base64"), String(sp.get("nome") || "NF.pdf").replace(/[\\/:*?"<>|]+/g, " "));
  }
  const ids = String(sp.get("ids") || "").split(",").map(Number).filter(Boolean).slice(0, 500);
  const r = await nfsDosTitulos(ids);
  if (sp.get("zip")) {
    const files = {}, vistos = new Set();
    for (const v of Object.values(r)) for (const a of v.arquivos) {
      if (vistos.has(chave(a))) continue; vistos.add(chave(a));
      const c = await conteudo(a).catch(() => null);
      if (!c) continue;
      let n = a.nome, i = 2; while (files[n]) n = a.nome.replace(/(\.pdf)?$/i, ` (${i++})$1`);
      files[n] = [new Uint8Array(Buffer.from(c, "base64")), { level: 0 }];
    }
    if (!Object.keys(files).length) return Response.json({ error: "Nenhuma NF em PDF encontrada para as contas marcadas." }, { status: 404 });
    const d = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    return pdf(Buffer.from(zipSync(files)), `NFs ${d}.zip`);
  }
  return Response.json({ nfs: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { nf: v.nf, arquivos: v.arquivos.map((a) => a.nome), chaves: v.arquivos.map((a) => ({ k: chave(a), nome: a.nome })) }])) });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  try {
    const r = await enviarCobranca(b, u);
    return Response.json(r, { status: r.error ? 400 : 200 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
