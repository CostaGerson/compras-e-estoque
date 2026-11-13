// v779 — sugestão #33: e-mail automático semanal para cada cliente com os boletos emitidos para ele na semana.
//   Toda sexta-feira às 17h (horário de Brasília). Semana = segunda a domingo da data do envio.
//   Boleto da semana = conta a receber em aberto, forma BOLETO (ou com nosso número), lançada ou registrada (remessa) na semana.
//   Vai para o "E-mail p/ NFs e Boletos" do cadastro do cliente (vários separados por ; ou ,). Sem boletos → não envia.
//   PDFs anexados à conta (boleto/NF) vão junto. Cada semana é enviada uma vez (registro em FinConfig).
import { prisma } from "@/lib/prisma";
import { enviarEmail, emailDisponivel, LIMITE_ANEXO } from "@/lib/email";
import { SEM_NORT } from "@/lib/finNort";   // v808 — contas da NORT ficam só na guia NORT

const K = (seg) => `COBRANCA_SEMANAL|${seg}`;
const so = (s) => String(s || "").replace(/\D/g, "");
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const br = (d) => (d ? iso(d).split("-").reverse().join("/") : "—");
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function agoraSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour12: false, weekday: "short", hour: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), hora: Number(p.hour) % 24, data: `${p.year}-${p.month}-${p.day}` };
}
export function semanaDe(dataIso) {
  const d = new Date(`${dataIso}T00:00:00Z`), dow = d.getUTCDay();
  const seg = new Date(d.getTime() - ((dow + 6) % 7) * 86400000);
  return { de: iso(seg), ate: iso(new Date(seg.getTime() + 6 * 86400000)) };
}

export async function montarCobranca(dataIso) {
  const { de, ate } = semanaDe(dataIso);
  const ini = new Date(`${de}T03:00:00Z`), fim = new Date(new Date(`${ate}T03:00:00Z`).getTime() + 86400000);
  const ts = await prisma.finTitulo.findMany({
    where: { ...SEM_NORT, tipo: "RECEBER", status: "ABERTO", OR: [{ formaPagamento: "BOLETO" }, { nossoNumero: { not: null } }],
      AND: [{ OR: [{ createdAt: { gte: ini, lt: fim } }, { remessaEm: { gte: new Date(`${de}T00:00:00Z`), lte: new Date(`${ate}T00:00:00Z`) } }] }] },
    select: { id: true, titulo: true, parceiro: true, documento: true, numeroDoc: true, valor: true, valorBruto: true, vencimento: true, vencimentoBoleto: true, nossoNumero: true },
    orderBy: { vencimento: "asc" },
  });
  const docs = [...new Set(ts.map((t) => so(t.documento)).filter(Boolean))];
  const clis = docs.length ? await prisma.cliente.findMany({ where: { cnpj: { in: docs } }, select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, emailNf: true } }) : [];
  const grupos = {};
  for (const t of ts) {
    const c = clis.find((x) => so(x.cnpj) === so(t.documento));
    const k = c ? `C${c.id}` : `P${t.parceiro}`;
    (grupos[k] ||= { cliente: c ? c.nomeFantasia || c.razaoSocial : t.parceiro, cnpj: c?.cnpj || t.documento || null,
      emails: String(c?.emailNf || "").split(/[;,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e)), titulos: [] }).titulos.push(t);
  }
  return { de, ate, grupos: Object.values(grupos) };
}

function htmlEmail(g, de, ate) {
  const linhas = g.titulos.map((t) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #EEF0F3">${esc(t.numeroDoc || t.titulo)}</td><td style="padding:6px 8px;border-bottom:1px solid #EEF0F3">${br(t.vencimentoBoleto || t.vencimento)}</td><td style="padding:6px 8px;border-bottom:1px solid #EEF0F3;text-align:right">${moeda(t.valorBruto ?? t.valor)}</td><td style="padding:6px 8px;border-bottom:1px solid #EEF0F3;color:#667085">${esc(t.nossoNumero || "—")}</td></tr>`).join("");
  const total = g.titulos.reduce((s, t) => s + Number(t.valorBruto ?? t.valor ?? 0), 0);
  return `<div style="font-family:Montserrat,Arial,sans-serif;background:#F5F6F8;padding:24px"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden">
  <div style="background:#001E41;color:#fff;padding:16px 20px;font-weight:700;letter-spacing:1px">MERIDIAN</div>
  <div style="padding:20px;color:#1F2733;font-size:14px;line-height:1.5">
    <p>Olá, ${esc(g.cliente)}.</p>
    <p>Seguem os boletos emitidos para vocês nesta semana (${br(de)} a ${br(ate)}).</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0"><tr style="color:#2E5C9A;text-align:left"><th style="padding:6px 8px">Documento</th><th style="padding:6px 8px">Vencimento</th><th style="padding:6px 8px;text-align:right">Valor</th><th style="padding:6px 8px">Nosso nº</th></tr>${linhas}
    <tr><td colspan="2" style="padding:8px;font-weight:700">Total</td><td style="padding:8px;text-align:right;font-weight:700">${moeda(total)}</td><td></td></tr></table>
    <p style="color:#667085;font-size:12px">Os boletos em PDF seguem anexos quando disponíveis. Em caso de dúvida, responda este e-mail.</p>
  </div></div></div>`;
}

// previa = só monta; senão envia (cliente sem e-mail fica na lista de pendências)
export async function cobrancaSemanal({ dataIso, previa = false, forcar = false } = {}) {
  const d = dataIso || agoraSP().data;
  const { de, ate, grupos } = await montarCobranca(d);
  const ja = await prisma.finConfig.findUnique({ where: { chave: K(de) } }).catch(() => null);
  const res = { de, ate, jaEnviada: !!ja && !forcar, clientes: grupos.map((g) => ({ cliente: g.cliente, cnpj: g.cnpj, emails: g.emails, boletos: g.titulos.length, total: g.titulos.reduce((s, t) => s + Number(t.valorBruto ?? t.valor ?? 0), 0) })), enviados: 0, semEmail: [], erros: [] };
  if (previa || res.jaEnviada) return res;
  if (!emailDisponivel()) { res.erros.push("Envio de e-mail não configurado (RESEND_API_KEY / RESEND_FROM)."); return res; }
  for (const g of grupos) {
    if (!g.emails.length) { res.semEmail.push(g.cliente); continue; }
    const anx = await prisma.finTituloAnexo.findMany({ where: { tituloId: { in: g.titulos.map((t) => t.id) }, OR: [{ mime: "application/pdf" }, { nome: { endsWith: ".pdf", mode: "insensitive" } }] }, select: { nome: true, conteudo: true } }).catch(() => []);
    let soma = 0; const anexos = [];
    for (const a of anx) { const b = Buffer.byteLength(a.conteudo, "base64"); if (soma + b > LIMITE_ANEXO) break; soma += b; anexos.push({ filename: a.nome, content: a.conteudo }); }
    try {
      await enviarEmail({ para: g.emails, assunto: `Meridian — boletos da semana (${br(de)} a ${br(ate)})`, html: htmlEmail(g, de, ate), anexos });
      res.enviados++;
    } catch (e) { res.erros.push(`${g.cliente}: ${e.message}`); }
  }
  await prisma.finConfig.upsert({ where: { chave: K(de) }, create: { chave: K(de), valor: JSON.stringify({ em: new Date().toISOString(), enviados: res.enviados, semEmail: res.semEmail, erros: res.erros }) },
    update: { valor: JSON.stringify({ em: new Date().toISOString(), enviados: res.enviados, semEmail: res.semEmail, erros: res.erros }) } }).catch(() => null);
  // aviso aos masters: resumo e clientes sem e-mail cadastrado
  if (grupos.length) {
    const ms = await prisma.usuario.findMany({ where: { ativo: true, isMaster: true }, select: { id: true } }).catch(() => []);
    const txt = `📧 COBRANÇA SEMANAL ${br(de)} a ${br(ate)}: ${res.enviados} e-mail(s) enviado(s) com os boletos da semana.${res.semEmail.length ? ` Sem e-mail no cadastro (preencha "E-mail p/ NFs e Boletos" em Clientes): ${res.semEmail.join(", ")}.` : ""}${res.erros.length ? ` Erros: ${res.erros.join("; ")}.` : ""}`;
    if (ms.length) await prisma.mensagem.createMany({ data: ms.map((m) => ({ deId: m.id, paraId: m.id, texto: txt.slice(0, 2000) })) }).catch(() => null);
  }
  return res;
}

// toda sexta às 17h (Brasília), uma vez por semana
export function agendarCobrancaSemanal() {
  if (globalThis.__cobrancaSemanal) return;
  globalThis.__cobrancaSemanal = true;
  setInterval(async () => {
    const a = agoraSP();
    if (a.dow !== 5 || a.hora < 17) return;
    try { const r = await cobrancaSemanal({ dataIso: a.data }); if (!r.jaEnviada && r.clientes.length) console.log(`[cobrança semanal] ${r.enviados} enviados`); } catch (e) { console.error("[cobrança semanal]", e.message); }
  }, 10 * 60 * 1000);
}
