// v903 — e-mail de cobrança das contas atrasadas enviado pelo sistema (Resend), com o PDF das NFs de cada título
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel, LIMITE_ANEXO } from "@/lib/email";
import { lerBase64 } from "@/lib/arquivos";

const so = (s) => String(s || "").replace(/\D/g, "");
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const numNf = (t) => (String(t.titulo || "").match(/\bNF[\s-]*(?:E\s*)?0*(\d{2,})/i) || String(t.numeroDoc || "").match(/\bNF[SE-]*\s*0*(\d{2,})/i) || String(t.numeroDoc || "").match(/^0*(\d{3,})(?:[-/]|$)/) || [])[1] || null;

// NF de saída (PDF) de cada título: pela chave da importação, pelo número + CNPJ; senão os PDFs anexados à conta
export async function nfsDosTitulos(ids) {
  const ts = await prisma.finTitulo.findMany({ where: { id: { in: ids.map(Number).filter(Boolean) } }, select: { id: true, titulo: true, numeroDoc: true, chaveImport: true, documento: true } });
  const out = {};
  for (const t of ts) {
    const r = { id: t.id, nf: null, arquivos: [] };
    const ck = String(t.chaveImport || "");
    let n = null;
    if (/^(NFE|NFSE)\|/.test(ck)) n = await prisma.fiscalNota.findUnique({ where: { chaveRegistro: ck.split("|").slice(0, -1).join("|") }, select: { id: true, numero: true, temPdf: true } }).catch(() => null);
    const num = numNf(t);
    if (!n?.temPdf && num) {
      const d = so(t.documento);
      n = await prisma.fiscalNota.findFirst({ where: { tipo: "SAIDA", temPdf: true, numero: { in: [num, num.padStart(6, "0"), num.padStart(9, "0")] }, ...(d.length >= 11 ? { documento: d.length === 14 ? { startsWith: d.slice(0, 8) } : d } : {}) },
        orderBy: { id: "desc" }, select: { id: true, numero: true, temPdf: true } }).catch(() => null);
    }
    if (n?.temPdf) { r.nf = String(n.numero); r.arquivos.push({ tipo: "NF", fiscalId: n.id, nome: `NF ${String(n.numero).replace(/^0+/, "")}.pdf` }); }
    else {
      const an = await prisma.finTituloAnexo.findMany({ where: { tituloId: t.id, OR: [{ mime: "application/pdf" }, { nome: { endsWith: ".pdf", mode: "insensitive" } }] }, select: { id: true, nome: true }, orderBy: { id: "asc" } }).catch(() => []);
      for (const a of an) r.arquivos.push({ tipo: "ANEXO", anexoId: a.id, nome: a.nome });
      if (an.length) r.nf = num || "anexo";
    }
    out[t.id] = r;
  }
  return out;
}

export async function conteudo(a) {
  if (a.fiscalId) { const n = await prisma.fiscalNota.findUnique({ where: { id: a.fiscalId }, select: { pdf: true } }); return lerBase64(n?.pdf); }
  const x = await prisma.finTituloAnexo.findUnique({ where: { id: a.anexoId }, select: { conteudo: true } });
  return lerBase64(x?.conteudo);
}

function html(corpo, linhas, total) {
  const paras = String(corpo || "").split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1F2733;font-size:14px;line-height:1.55;max-width:640px">${paras}
  ${linhas.length ? `<p style="margin:16px 0 0;color:#667085;font-size:12px">NFs em anexo: ${esc(linhas.join(", "))}.</p>` : ""}</div>`;
}

// { para, assunto, corpo, tituloIds, cc? } → envia com as NFs em PDF anexadas
export async function enviarCobranca({ para, assunto, corpo, tituloIds, cc }, u) {
  if (!(await emailDisponivel())) return { error: "Envio de e-mail não configurado (Dados › Integrações › E-mail)." };
  const dest = String(para || "").split(/[;,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (!dest.length) return { error: "Informe um e-mail válido em Para." };
  if (!String(assunto || "").trim() || !String(corpo || "").trim()) return { error: "Assunto e texto são obrigatórios." };
  const nfs = await nfsDosTitulos(tituloIds || []);
  const anexos = [], nomes = [], semNf = [];
  let soma = 0;
  const vistos = new Set();
  for (const id of tituloIds || []) {
    const r = nfs[id];
    if (!r || !r.arquivos.length) { semNf.push(id); continue; }
    for (const a of r.arquivos) {
      const k = a.fiscalId ? `F${a.fiscalId}` : `A${a.anexoId}`;
      if (vistos.has(k)) continue; vistos.add(k);
      const c = await conteudo(a);
      if (!c) continue;
      const b = Buffer.byteLength(c, "base64");
      if (soma + b > LIMITE_ANEXO) return { error: `As NFs somam mais de ${Math.round(LIMITE_ANEXO / 1048576)} MB: envie em mais de um e-mail.` };
      soma += b; anexos.push({ filename: a.nome, content: c }); nomes.push(a.nome.replace(/\.pdf$/i, ""));
    }
  }
  const responder = (await prisma.usuario.findUnique({ where: { id: u?.id || 0 }, select: { email: true } }).catch(() => null))?.email || undefined;
  const r = await enviarEmail({ para: dest, assunto: String(assunto).trim(), html: html(corpo, nomes), texto: String(corpo), anexos, responderPara: responder });
  // registro na observação de cada conta
  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  for (const id of tituloIds || []) {
    const t = await prisma.finTitulo.findUnique({ where: { id: Number(id) }, select: { observacao: true } }).catch(() => null);
    if (t) await prisma.finTitulo.update({ where: { id: Number(id) }, data: { observacao: `${t.observacao ? `${t.observacao}\n` : ""}📧 Cobrança enviada por e-mail em ${quando} para ${dest.join(", ")}${u ? ` por ${[u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase()}` : ""}.`.slice(0, 4000) } }).catch(() => {});
  }
  return { ok: true, id: r.id, para: dest, anexos: nomes, semNf: semNf.length };
}
