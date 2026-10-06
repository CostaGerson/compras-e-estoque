// v147 — Entrada de documentos da Análise mensal (extratos, faturas, relatórios do banco) por qualquer caminho:
// a guia Importação da análise mensal e o "Importar documento" do contas a pagar usam as mesmas funções.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { abrirPdf, classificarTexto, garantirTipos, processarArquivo } from "@/lib/fin";
import { copiarExtratoParaContabilidade } from "@/lib/finContab";

export const senhasSalvas = async () => (await prisma.finSenhaPdf.findMany({ select: { senha: true } })).map((s) => s.senha).filter(Boolean);
export const hashBuf = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// abre o PDF tentando a senha informada e depois as cadastradas em Senhas de PDF
export async function abrirComSenhas(buf, senhaInformada) {
  const salvas = await senhasSalvas();
  const tentar = [...(senhaInformada ? [String(senhaInformada)] : []), ...salvas];
  return abrirPdf(buf, tentar);
}

// mês mais provável do documento (para sugerir a competência): vencimento da fatura > datas dos lançamentos > datas do texto
export async function sugerirCompetencia(codigo, buf, senha, texto) {
  const mesHoje = new Date().toISOString().slice(0, 7);
  const venc = String(texto || "").match(/vencimento[^0-9]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i);
  if (/FATURA/.test(codigo) && venc) return `${venc[3]}-${venc[2]}`;
  const conta = (datas) => {
    const c = {};
    for (const d of datas) if (/^\d{4}-\d{2}/.test(d || "")) c[d.slice(0, 7)] = (c[d.slice(0, 7)] || 0) + 1;
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  };
  try {
    const { lerArquivo, LEITORES, lerDetalhe, LEITORES_DETALHE } = await import("@/lib/finParse");
    if (LEITORES[codigo]) { const r = await lerArquivo(codigo, buf, senha); const m = conta((r?.lancamentos || []).map((l) => l.data)); if (m) return m; }
    if (LEITORES_DETALHE[codigo]) { const r = await lerDetalhe(codigo, buf, senha); const ds = (r?.itens || []).map((i) => i.data).sort(); if (ds.length) return ds[ds.length - 1].slice(0, 7); }
  } catch { /* cai no texto */ }
  const m = conta([...String(texto || "").matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((x) => `${x[3]}-${x[2]}-${x[1]}`).filter((d) => d <= `${mesHoje}-31`));
  return m || mesHoje;
}

// identifica um documento da análise mensal (sem gravar)
export async function identificarDocAnalise(buf, texto) {
  const cl = classificarTexto(texto);
  if (!cl.codigo) return null;
  await garantirTipos();
  const tipo = await prisma.finDocTipo.findUnique({ where: { codigo: cl.codigo } });
  return tipo ? { id: tipo.id, codigo: tipo.codigo, banco: tipo.banco, documento: tipo.documento } : null;
}

// grava o documento na análise mensal (mesma regra da guia Importação): arquivo + leitura + cópia para a contabilidade
export async function importarArquivoAnalise({ u, competencia, tipoId, nome, conteudo, senha }) {
  const buf = Buffer.from(String(conteudo), "base64");
  const hash = hashBuf(buf);
  const dup = await prisma.finArquivo.findUnique({ where: { hash }, include: { tipo: true } });
  if (dup) return { erro: `Este arquivo já foi enviado em ${dup.competencia.split("-").reverse().join("/")} (${dup.tipo.banco} · ${dup.tipo.documento}).`, duplicado: true };
  const tipo = await prisma.finDocTipo.findUnique({ where: { id: Number(tipoId) } });
  if (!tipo) return { erro: "Documento não encontrado." };
  const a = await prisma.finArquivo.create({
    data: {
      competencia, tipoId: tipo.id, nome: String(nome || "arquivo.pdf"), tamanho: buf.length, hash, conteudo: String(conteudo), senhaPdf: senha || null,
      enviadoPorId: u.id, enviadoPorNome: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase(),
    },
    select: { id: true, tipoId: true, nome: true, tamanho: true, enviadoPorNome: true, createdAt: true },
  });
  let leitura = null;
  try { leitura = await processarArquivo(a.id); } catch (e) { leitura = { ok: false, erro: e.message }; }
  try { const { conciliarAntecipacoesPendentes } = await import("@/lib/finAntecipacao"); await conciliarAntecipacoesPendentes(a.enviadoPorNome); } catch { /* sem contrato pendente */ }
  let contab = null;
  try { const c = await copiarExtratoParaContabilidade(a.id); contab = c?.doc?.nome || null; } catch { contab = null; }
  return { ...a, leitura, contab, protegido: !!senha, tipo: { id: tipo.id, banco: tipo.banco, documento: tipo.documento } };
}
