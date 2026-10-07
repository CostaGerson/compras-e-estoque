// Central de uploads: todos os arquivos que entraram no sistema, por qualquer caminho.
// Cada origem vira linhas { id: "ORIGEM-123", origem, nomeSistema, nomeOriginal, data, usuario, usuarioId, tamanho }.
// Excluir desfaz o vínculo: o card que dependia do arquivo volta a acusar a falta (calendário do RH,
// importação da análise mensal, contabilidade…).
import { prisma } from "@/lib/prisma";
import { conciliarCompetencia } from "@/lib/fin";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
export const mesNome = (c) => { const [a, m] = String(c || "").split("-"); return m ? `${MESES[Number(m) - 1]} ${a}` : ""; };
const up = (s) => String(s || "").toUpperCase().trim();
export const nomeUsuario = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();
const tam64 = (n) => Math.floor((Number(n) || 0) * 3 / 4);

export const ORIGENS = {
  ARQ: "Análise mensal · importação",
  CONTAB: "Contabilidade",
  ANEXO: "Contas a pagar/receber · anexo",
  RHDOC: "RH · carômetro",
  RET: "Retorno de cobrança",
  ANTEC: "Contrato de desconto de duplicatas",
  EXEC: "Execução judicial · processo",
  NFPDF: "NF de entrada · PDF",
  NFXML: "NF de entrada · XML",
  TITXML: "Contas · XML da NF",
  PP: "Lançar PP",
  PV: "Pedido de venda",
  FISCALXML: "Movimento fiscal · XML",
  FISCALPDF: "Movimento fiscal · PDF",
};
const PP_CAMPOS = { arquivoPcPdf: "PEDIDO DE COMPRA DO CLIENTE", arquivoLancPdf: "SOLICITAÇÃO DE LANÇAMENTO", arquivoPedidoPdf: "PEDIDO" };

const tenta = async (f) => { try { return await f(); } catch { return []; } };

export async function listarUploads() {
  const out = [];
  // 1) Análise mensal — extratos, faturas, relatórios
  for (const a of await tenta(() => prisma.finArquivo.findMany({
    select: { id: true, competencia: true, nome: true, tamanho: true, enviadoPorId: true, enviadoPorNome: true, createdAt: true, tipo: { select: { banco: true, documento: true } } } }))) {
    out.push({ id: `ARQ-${a.id}`, origem: "ARQ", nomeSistema: up(`${a.tipo?.documento || "DOCUMENTO"} ${a.tipo?.banco || ""} ${mesNome(a.competencia)}`).replace(/\s+/g, " "),
      nomeOriginal: a.nome, data: a.createdAt, usuario: a.enviadoPorNome, usuarioId: a.enviadoPorId, tamanho: a.tamanho });
  }
  // 2) Contabilidade (as cópias automáticas da importação não aparecem: somem junto com o original)
  for (const d of await tenta(() => prisma.finContabDoc.findMany({ where: { arquivoId: null },
    select: { id: true, competencia: true, categoria: true, nome: true, nomeOriginal: true, tamanho: true, enviadoPorId: true, enviadoPorNome: true, createdAt: true } }))) {
    out.push({ id: `CONTAB-${d.id}`, origem: "CONTAB", nomeSistema: up(d.nome.replace(/\.[a-z0-9]+$/i, "")), nomeOriginal: d.nomeOriginal || d.nome,
      data: d.createdAt, usuario: d.enviadoPorNome, usuarioId: d.enviadoPorId, tamanho: d.tamanho });
  }
  // 3) Anexos das contas (inclui o que o RH envia)
  const envios = await tenta(() => prisma.rhEnvio.findMany({ select: { tituloId: true, hash: true, arquivo: true, categoria: true, empresa: true, competencia: true } }));
  const envioDe = (a) => envios.find((e) => e.tituloId === a.tituloId && ((a.hash && e.hash === a.hash) || e.arquivo === a.nome));
  for (const a of await tenta(() => prisma.finTituloAnexo.findMany({
    select: { id: true, tituloId: true, nome: true, tamanho: true, hash: true, criadoPorNome: true, createdAt: true, titulo: { select: { titulo: true, tipo: true, competencia: true } } } }))) {
    const e = envioDe(a);
    out.push({ id: `ANEXO-${a.id}`, origem: "ANEXO",
      nomeSistema: e ? up(`${e.categoria} ${e.empresa} ${mesNome(e.competencia)}`) : up(`ANEXO · ${a.titulo?.titulo || ""} ${mesNome(a.titulo?.competencia)}`),
      nomeOriginal: a.nome, data: a.createdAt, usuario: a.criadoPorNome, tamanho: a.tamanho, rh: !!e });
  }
  // 4) RH — documentos dos funcionários
  for (const d of await tenta(() => prisma.rhDocumento.findMany({
    select: { id: true, tipo: true, nome: true, tamanho: true, criadoPorNome: true, createdAt: true, funcionario: { select: { nomeCompleto: true, pessoaId: true } } } }))) {
    out.push({ id: `RHDOC-${d.id}`, origem: "RHDOC", nomeSistema: up(`${d.tipo} · ${d.funcionario?.nomeCompleto || d.funcionario?.pessoaId || ""}`),
      nomeOriginal: d.nome, data: d.createdAt, usuario: d.criadoPorNome, tamanho: d.tamanho });
  }
  // 5) Retornos de cobrança
  for (const r of await tenta(() => prisma.finRetorno.findMany({ select: { id: true, sequencia: true, nome: true, dataArquivo: true, criadoPorNome: true, createdAt: true } }))) {
    out.push({ id: `RET-${r.id}`, origem: "RET", nomeSistema: `RETORNO DE COBRANÇA BRADESCO Nº ${r.sequencia || "—"}`, nomeOriginal: r.nome, data: r.createdAt, usuario: r.criadoPorNome });
  }
  for (const r of await tenta(() => prisma.finAntecipacao.findMany({ select: { id: true, contrato: true, nome: true, criadoPorNome: true, createdAt: true } }))) {
    out.push({ id: `ANTEC-${r.id}`, origem: "ANTEC", nomeSistema: `CONTRATO DE DESCONTO BRADESCO Nº ${r.contrato}`, nomeOriginal: r.nome, data: r.createdAt, usuario: r.criadoPorNome });
  }
  // 5b) Execuções judiciais — arquivos do processo
  for (const a of await tenta(() => prisma.finExecucaoAnexo.findMany({ select: { id: true, nome: true, tamanho: true, criadoPorNome: true, createdAt: true, execucao: { select: { titulo: true, processo: true } } } }))) {
    out.push({ id: `EXEC-${a.id}`, origem: "EXEC", nomeSistema: up(`PROCESSO · ${a.execucao?.titulo || ""}${a.execucao?.processo ? ` (${a.execucao.processo})` : ""}`),
      nomeOriginal: a.nome, data: a.createdAt, usuario: a.criadoPorNome, tamanho: a.tamanho });
  }
  // 6) NF de entrada (Compras) — sem registro de quem enviou: só o master exclui
  for (const n of await tenta(() => prisma.notaFiscal.findMany({ where: { OR: [{ temPdf: true }, { temXml: true }] },
    select: { id: true, numero: true, temPdf: true, temXml: true, createdAt: true, fornecedor: { select: { nome: true, razaoSocial: true } } } }))) {
    const f = up(n.fornecedor?.nome || n.fornecedor?.razaoSocial || "");
    if (n.temPdf) out.push({ id: `NFPDF-${n.id}`, origem: "NFPDF", nomeSistema: `NF ${n.numero} ${f} · PDF`.trim(), nomeOriginal: `NF ${n.numero}.pdf`, data: n.createdAt });
    if (n.temXml) out.push({ id: `NFXML-${n.id}`, origem: "NFXML", nomeSistema: `NF ${n.numero} ${f} · XML`.trim(), nomeOriginal: `NF ${n.numero}.xml`, data: n.createdAt });
  }
  // 7) XML gravado na própria conta (importação de XML no contas a pagar)
  for (const t of await tenta(() => prisma.$queryRawUnsafe(`SELECT id, titulo, "numeroDoc", "createdAt", "criadoPorNome", length("arquivoXml") AS n FROM "FinTitulo" WHERE "arquivoXml" IS NOT NULL AND "arquivoXml" <> ''`))) {
    out.push({ id: `TITXML-${t.id}`, origem: "TITXML", nomeSistema: up(`XML · ${t.titulo}`), nomeOriginal: `${t.numeroDoc || t.id}.xml`, data: t.createdAt, usuario: t.criadoPorNome, tamanho: Number(t.n) || 0 });
  }
  // 8) Produção: PDFs do PP e arquivo do PV
  for (const p of await tenta(() => prisma.$queryRawUnsafe(`SELECT id, numero, "clienteNome", "createdAt", length("arquivoPcPdf") AS a, length("arquivoLancPdf") AS b, length("arquivoPedidoPdf") AS c FROM "Pp"`))) {
    [["arquivoPcPdf", p.a], ["arquivoLancPdf", p.b], ["arquivoPedidoPdf", p.c]].forEach(([campo, n]) => {
      if (Number(n) > 0) out.push({ id: `PP-${p.id}-${campo}`, origem: "PP", nomeSistema: up(`PP ${p.numero || p.id} · ${PP_CAMPOS[campo]} · ${p.clienteNome || ""}`), nomeOriginal: `${PP_CAMPOS[campo]}.pdf`, data: p.createdAt, tamanho: tam64(n) });
    });
  }
  for (const p of await tenta(() => prisma.$queryRawUnsafe(`SELECT id, numero, cliente, "createdAt", length("arquivoOrigem") AS n FROM "Pv" WHERE "arquivoOrigem" IS NOT NULL AND "arquivoOrigem" <> ''`))) {
    out.push({ id: `PV-${p.id}`, origem: "PV", nomeSistema: up(`PV ${p.numero} · ${p.cliente}`), nomeOriginal: `PV ${p.numero}`, data: p.createdAt, tamanho: tam64(p.n) });
  }
  // 9) ADM › Movimento fiscal (v158)
  for (const n of await tenta(() => prisma.fiscalNota.findMany({ where: { OR: [{ temPdf: true }, { temXml: true }] },
    select: { id: true, tipo: true, numero: true, parceiro: true, xmlNome: true, pdfNome: true, temXml: true, temPdf: true, criadoPorId: true, criadoPorNome: true, createdAt: true } }))) {
    const base = `NF ${n.tipo === "SAIDA" ? "SAÍDA" : "ENTRADA"} ${n.numero} ${up(n.parceiro)}`;
    if (n.temXml) out.push({ id: `FISCALXML-${n.id}`, origem: "FISCALXML", nomeSistema: `${base} · XML`, nomeOriginal: n.xmlNome || `NF ${n.numero}.xml`, data: n.createdAt, usuario: n.criadoPorNome, usuarioId: n.criadoPorId });
    if (n.temPdf) out.push({ id: `FISCALPDF-${n.id}`, origem: "FISCALPDF", nomeSistema: `${base} · PDF`, nomeOriginal: n.pdfNome || `NF ${n.numero}.pdf`, data: n.createdAt, usuario: n.criadoPorNome, usuarioId: n.criadoPorId });
  }
  return out.map((x) => ({ ...x, origemNome: ORIGENS[x.origem], data: new Date(x.data).toISOString() }))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

// quem pode excluir: o master ou quem enviou
export const podeExcluir = (u, x) => !!u && (u.isMaster || u.setor === "FINANCEIRO"
  || (x.usuarioId && x.usuarioId === u.id) || (!!x.usuario && up(x.usuario) === nomeUsuario(u)));

const partes = (id) => { const [origem, n, campo] = String(id).split("-"); return { origem, n: Number(n), campo }; };

// conteúdo do arquivo → { nome, buf, mime }
const MIME = { pdf: "application/pdf", xml: "application/xml", txt: "text/plain; charset=utf-8", ret: "text/plain; charset=latin1", ofx: "application/x-ofx",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", zip: "application/zip", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
export const mimeDe = (nome) => MIME[String(nome || "").split(".").pop().toLowerCase()] || "application/octet-stream";
export const bufDe = (s) => {
  const t = String(s || "");
  if (t.startsWith("data:")) return Buffer.from(t.slice(t.indexOf(",") + 1), "base64");
  if (/^\s*</.test(t)) return Buffer.from(t, "utf8");          // XML gravado como texto
  return Buffer.from(t, "base64");
};
export async function conteudoUpload(id) {
  const { origem, n, campo } = partes(id);
  if (origem === "ARQ") { const a = await prisma.finArquivo.findUnique({ where: { id: n }, select: { nome: true, conteudo: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo) }; }
  if (origem === "CONTAB") { const a = await prisma.finContabDoc.findUnique({ where: { id: n }, select: { nome: true, conteudo: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo) }; }
  if (origem === "ANEXO") { const a = await prisma.finTituloAnexo.findUnique({ where: { id: n }, select: { nome: true, conteudo: true, mime: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo), mime: a.mime }; }
  if (origem === "RHDOC") { const a = await prisma.rhDocumento.findUnique({ where: { id: n }, select: { nome: true, conteudo: true, mime: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo), mime: a.mime }; }
  if (origem === "ANTEC") { const a = await prisma.finAntecipacao.findUnique({ where: { id: n }, select: { nome: true, conteudo: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo) }; }
  if (origem === "EXEC") { const a = await prisma.finExecucaoAnexo.findUnique({ where: { id: n }, select: { nome: true, conteudo: true, mime: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo), mime: a.mime }; }
  if (origem === "RET") { const a = await prisma.finRetorno.findUnique({ where: { id: n }, select: { nome: true, conteudo: true } }); return a && { nome: a.nome, buf: bufDe(a.conteudo) }; }
  if (origem === "NFPDF" || origem === "NFXML") {
    const a = await prisma.notaFiscal.findUnique({ where: { id: n }, select: { numero: true, arquivoPdf: true, arquivoXml: true } });
    const c = origem === "NFPDF" ? a?.arquivoPdf : a?.arquivoXml;
    return c && { nome: `NF ${a.numero}.${origem === "NFPDF" ? "pdf" : "xml"}`, buf: bufDe(c) };
  }
  if (origem === "TITXML") { const a = await prisma.finTitulo.findUnique({ where: { id: n }, select: { numeroDoc: true, arquivoXml: true } }); return a?.arquivoXml && { nome: `${a.numeroDoc || n}.xml`, buf: bufDe(a.arquivoXml) }; }
  if (origem === "PP" && PP_CAMPOS[campo]) { const a = await prisma.pp.findUnique({ where: { id: n }, select: { numero: true, [campo]: true } }); return a?.[campo] && { nome: `PP ${a.numero || n} ${PP_CAMPOS[campo]}.pdf`, buf: bufDe(a[campo]) }; }
  if (origem === "FISCALXML" || origem === "FISCALPDF") {
    const a = await prisma.fiscalNota.findUnique({ where: { id: n }, select: { numero: true, xml: true, xmlNome: true, pdf: true, pdfNome: true } });
    if (origem === "FISCALXML") return a?.xml && { nome: a.xmlNome || `NF ${a.numero}.xml`, buf: Buffer.from(a.xml, "utf8") };
    return a?.pdf && { nome: a.pdfNome || `NF ${a.numero}.pdf`, buf: Buffer.from(a.pdf, "base64") };
  }
  if (origem === "PV") { const a = await prisma.pv.findUnique({ where: { id: n }, select: { numero: true, arquivoOrigem: true } }); return a?.arquivoOrigem && { nome: `PV ${a.numero}.pdf`, buf: bufDe(a.arquivoOrigem) }; }
  return null;
}

export async function excluirUpload(id) {
  const { origem, n, campo } = partes(id);
  if (!n) throw new Error("Documento inválido.");
  if (origem === "ARQ") {
    const a = await prisma.finArquivo.findUnique({ where: { id: n }, select: { competencia: true } });
    const copias = await prisma.finContabDoc.findMany({ where: { arquivoId: n }, select: { id: true } });
    if (copias.length) {
      await prisma.finNfSaida.deleteMany({ where: { docId: { in: copias.map((c) => c.id) } } }).catch(() => null);
      await prisma.finContabDoc.deleteMany({ where: { arquivoId: n } });
    }
    await prisma.finArquivo.delete({ where: { id: n } });     // os lançamentos lidos dele vão junto
    if (a) await conciliarCompetencia(a.competencia).catch(() => null);
  } else if (origem === "CONTAB") {
    await prisma.finNfSaida.deleteMany({ where: { docId: n } }).catch(() => null);
    await prisma.finContabDoc.delete({ where: { id: n } });
  } else if (origem === "ANEXO") {
    const a = await prisma.finTituloAnexo.findUnique({ where: { id: n }, select: { tituloId: true, hash: true, nome: true } });
    if (a) {
      // o envio do RH some junto: o card do calendário volta a acusar a falta
      await prisma.rhEnvio.deleteMany({ where: { tituloId: a.tituloId, OR: [...(a.hash ? [{ hash: a.hash }] : []), { arquivo: a.nome }] } }).catch(() => null);
      await prisma.finTituloAnexo.delete({ where: { id: n } });
    }
  } else if (origem === "RHDOC") await prisma.rhDocumento.delete({ where: { id: n } });
  else if (origem === "RET") await prisma.finRetorno.delete({ where: { id: n } });
  else if (origem === "EXEC") await prisma.finExecucaoAnexo.delete({ where: { id: n } });
  else if (origem === "ANTEC") throw new Error("Contrato de desconto não se exclui por aqui: as baixas e os encargos já foram lançados.");
  else if (origem === "NFPDF") await prisma.notaFiscal.update({ where: { id: n }, data: { arquivoPdf: null, temPdf: false } });
  else if (origem === "NFXML") await prisma.notaFiscal.update({ where: { id: n }, data: { arquivoXml: null, temXml: false } });
  else if (origem === "TITXML") await prisma.finTitulo.update({ where: { id: n }, data: { arquivoXml: null } });
  else if (origem === "PP" && PP_CAMPOS[campo]) await prisma.pp.update({ where: { id: n }, data: { [campo]: null } });
  else if (origem === "PV") await prisma.pv.update({ where: { id: n }, data: { arquivoOrigem: null } });
  else if (origem === "FISCALXML") await prisma.fiscalNota.update({ where: { id: n }, data: { xml: null, temXml: false } });
  else if (origem === "FISCALPDF") await prisma.fiscalNota.update({ where: { id: n }, data: { pdf: null, temPdf: false } });
  else throw new Error("Origem desconhecida.");
  return true;
}
