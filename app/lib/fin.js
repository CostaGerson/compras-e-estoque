import { prisma } from "@/lib/prisma";

// Documentos obrigatórios por mês (1 card cada). qtdEsperada = arquivos esperados.
export const TIPOS_PADRAO = [
  { codigo: "BRADESCO_EXTRATO",  banco: "BRADESCO", documento: "Extrato conta corrente", descricao: "Extrato mensal Net Empresa (PDF)" },
  { codigo: "BRADESCO_COBRANCA", banco: "BRADESCO", documento: "Títulos pagos (cobrança)", descricao: "Boletos recebidos — substitui a LIQUIDACAO DE COBRANCA do extrato" },
  { codigo: "BRADESCO_FOLHA",    banco: "BRADESCO", documento: "Comprovantes de folha", descricao: "Crédito em conta salário — substitui PAGAMENTO FUNCIONARIOS", multiplo: true },
  { codigo: "BRADESCO_FATURA",   banco: "BRADESCO", documento: "Faturas de cartão", descricao: "1 fatura por portador", qtdEsperada: 3, multiplo: true },
  { codigo: "ITAU_EXTRATO",      banco: "ITAÚ", documento: "Extrato conta corrente", descricao: "Extrato do período (PDF)" },
  { codigo: "ITAU_PAGAMENTOS",   banco: "ITAÚ", documento: "Relatório de pagamentos / Pix", descricao: "Detalha o SISPAG do extrato", multiplo: true },
  { codigo: "ITAU_FATURA",       banco: "ITAÚ", documento: "Fatura Mastercard", descricao: "Fatura com todos os portadores" },
  { codigo: "INTER_EXTRATO",     banco: "INTER", documento: "Extrato conta corrente", descricao: "Extrato do período (PDF)" },
  { codigo: "INTER_FATURA",      banco: "INTER", documento: "Fatura de cartão", descricao: "Fatura mensal" },
  { codigo: "C6_EXTRATO",        banco: "C6 BANK", documento: "Extrato conta corrente", descricao: "Extrato do período (PDF)" },
  { codigo: "C6_FATURA",         banco: "C6 BANK", documento: "Fatura de cartão", descricao: "PDF com senha — cadastre em Senhas de PDF" },
  { codigo: "BB_EXTRATO",        banco: "BANCO DO BRASIL", documento: "Extrato conta corrente", descricao: "Extrato do mês (PDF)" },
  { codigo: "BB_FATURA",         banco: "BANCO DO BRASIL", documento: "Faturas de cartão", descricao: "1 fatura por portador", qtdEsperada: 3, multiplo: true },
  { codigo: "CAIXA_EXTRATO",     banco: "CAIXA", documento: "Extrato conta corrente", descricao: "Gerenciador Caixa (PDF)" },
  { codigo: "CAIXA_FATURA",      banco: "CAIXA", documento: "Fatura Elo", descricao: "Fatura com todos os cartões" },
  { codigo: "IFOOD_RECARGA",     banco: "IFOOD BENEFÍCIOS", documento: "Relatórios de recarga", descricao: "Todas as recargas do mês — substituem o PIX global ao iFood", multiplo: true },
];

// Garante que o catálogo existe (sem sobrescrever ajustes feitos depois).
export async function garantirTipos() {
  const n = await prisma.finDocTipo.count();
  if (n >= TIPOS_PADRAO.length) return;
  await prisma.finDocTipo.createMany({
    data: TIPOS_PADRAO.map((t, i) => ({
      codigo: t.codigo, banco: t.banco, documento: t.documento, descricao: t.descricao || null,
      qtdEsperada: t.qtdEsperada || 1, multiplo: !!t.multiplo, ordem: i + 1,
    })),
    skipDuplicates: true,
  });
}

// Só o master (ou setor FINANCEIRO) acessa o financeiro.
export async function usuarioMaster(id) {
  const uid = Number(id);
  if (!uid) return null;
  const u = await prisma.usuario.findUnique({ where: { id: uid }, select: { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true } });
  if (!u || !u.ativo) return null;
  if (!(u.isMaster || u.setor === "FINANCEIRO")) return null;
  return u;
}
export const negado = () => Response.json({ error: "Acesso restrito ao financeiro." }, { status: 403 });

export const competenciaValida = (c) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ""));

// Tenta abrir o PDF. Retorna { ok, senha } ou { ok:false, precisaSenha, senhaErrada } ou { ok:false, erro }.
export async function abrirPdf(buf, senhasTentar) {
  const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const PDFJS = mod.default || mod;
  PDFJS.disableWorker = true;
  const tenta = async (password) => {
    try {
      const doc = await PDFJS.getDocument({ data: new Uint8Array(buf), password });
      const paginas = doc.numPages;
      doc.destroy();
      return { ok: true, paginas };
    } catch (e) {
      if (e && e.name === "PasswordException") return { ok: false, senha: true };
      return { ok: false, erro: e?.message || "PDF inválido" };
    }
  };
  const r0 = await tenta(undefined);
  if (r0.ok) return { ok: true, senha: null, paginas: r0.paginas };
  if (!r0.senha) return { ok: false, erro: r0.erro };
  for (const s of senhasTentar) {
    if (!s) continue;
    const r = await tenta(s);
    if (r.ok) return { ok: true, senha: s, paginas: r.paginas };
  }
  return { ok: false, precisaSenha: true };
}
