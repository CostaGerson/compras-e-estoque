// Contabilidade: pacote mensal de documentos que a contabilidade pede.
// Os extratos em PDF entram por cópia automática da Importação mensal; o OFX é enviado à mão
// (na própria Importação ou aqui). Tudo é renomeado no padrão EXTRATO <BANCO> <MES AA> <FORMATO>.
import crypto from "crypto";
import { zipSync, strToU8 } from "fflate";
import { prisma } from "@/lib/prisma";

export const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// "2026-09" → "SET 26"
export function mesAno(competencia) {
  const [a, m] = String(competencia || "").split("-");
  const i = Number(m) - 1;
  if (!a || i < 0 || i > 11) return String(competencia || "");
  return `${MESES_ABREV[i]} ${a.slice(2)}`;
}

// Catálogo das caixas da guia Contabilidade (fora dos extratos, que vêm dos bancos cadastrados).
export const CATEGORIAS = {
  EXTRATO: {
    label: "Extratos", rotulo: "EXTRATO", pasta: "EXTRATOS",
    formatos: ["PDF", "OFX"], slots: true, multiplo: false,
    descricao: "Um PDF e um OFX por banco — é o que a contabilidade pede.",
  },
  RECEBIMENTOS: {
    label: "Planilha de recebimentos", rotulo: "RECEBIMENTOS", pasta: "RECEBIMENTOS",
    formatos: ["XLSX"], slots: false, multiplo: false,
    descricao: "Base dos impostos devidos. Gerada pela guia Recebimentos (ou envie a sua).",
  },
  SPED: {
    label: "SPED", rotulo: "SPED", pasta: "SPED",
    formatos: ["TXT", "XML", "ZIP"], slots: false, multiplo: false,
    descricao: "Arquivo do SPED do mês.",
  },
  SAIDA_XML: {
    label: "Notas de saída · XML", rotulo: "NOTAS DE SAIDA", pasta: "NOTAS DE SAIDA/XML",
    formatos: ["XML", "ZIP"], slots: false, multiplo: true,
    descricao: "XMLs das notas de saída. O sistema lê NF, valor, cliente e CNPJ e usa no cruzamento.",
  },
  SAIDA_PDF: {
    label: "Notas de saída · PDF", rotulo: "NOTAS DE SAIDA", pasta: "NOTAS DE SAIDA/PDF",
    formatos: ["PDF", "ZIP"], slots: false, multiplo: true,
    descricao: "DANFEs em PDF do relatório de saídas.",
  },
  NFS_TOMADA: {
    label: "NFs de serviço tomado fora do estado", rotulo: "NF SERVICO TOMADO", pasta: "NF SERVICOS TOMADOS",
    formatos: ["PDF", "XML", "ZIP"], slots: false, multiplo: true,
    descricao: "Notas de serviço de prestador de outro estado.",
  },
  OUTRO: {
    label: "Outros documentos", rotulo: "OUTRO", pasta: "OUTROS",
    formatos: ["PDF", "XML", "XLSX", "TXT", "ZIP", "OFX"], slots: false, multiplo: true,
    descricao: "Qualquer outro arquivo que a contabilidade pedir no mês.",
  },
};
export const ORDEM_CATEGORIAS = ["RECEBIMENTOS", "SPED", "SAIDA_XML", "SAIDA_PDF", "NFS_TOMADA", "OUTRO"];

export const EXT_POR_FORMATO = { PDF: "pdf", OFX: "ofx", XML: "xml", XLSX: "xlsx", TXT: "txt", ZIP: "zip" };

export function formatoDoNome(nome) {
  const ext = String(nome || "").split(".").pop().toLowerCase();
  const m = { pdf: "PDF", ofx: "OFX", xml: "XML", xlsx: "XLSX", xls: "XLSX", txt: "TXT", zip: "ZIP" };
  return m[ext] || null;
}

const limpar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 .\-]/g, " ").replace(/\s+/g, " ").trim();

// EXTRATO BRADESCO SET 26 PDF.pdf · NOTAS DE SAIDA SET 26 XML - NF 1873.xml
export function nomePadrao({ categoria, banco, competencia, formato, sufixo }) {
  const cat = CATEGORIAS[categoria] || CATEGORIAS.OUTRO;
  const partes = [cat.rotulo];
  if (categoria === "EXTRATO" && banco) partes.push(limpar(banco));
  partes.push(mesAno(competencia), formato);
  let base = partes.filter(Boolean).join(" ");
  if (sufixo) base += ` - ${limpar(sufixo).slice(0, 60)}`;
  return `${base}.${EXT_POR_FORMATO[formato] || "dat"}`;
}

// Garante nome único dentro da competência (acrescenta (2), (3)…).
async function nomeLivre(competencia, nome) {
  const ext = nome.includes(".") ? nome.slice(nome.lastIndexOf(".")) : "";
  const base = ext ? nome.slice(0, -ext.length) : nome;
  for (let i = 1; i < 200; i++) {
    const tent = i === 1 ? nome : `${base} (${i})${ext}`;
    const ja = await prisma.finContabDoc.findFirst({ where: { competencia, nome: tent }, select: { id: true } });
    if (!ja) return tent;
  }
  return `${base} ${Date.now()}${ext}`;
}

export const hashBuf = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// Grava um documento. Nos slots únicos (extrato PDF/OFX, recebimentos, SPED) substitui o que havia.
export async function gravarDoc({ competencia, categoria, tipoId = null, banco = null, formato, buf, nomeOriginal, sufixo, arquivoId = null, usuario = null }) {
  const cat = CATEGORIAS[categoria] || CATEGORIAS.OUTRO;
  const hash = hashBuf(buf);
  const dup = await prisma.finContabDoc.findFirst({ where: { competencia, hash }, select: { id: true, nome: true } });
  if (dup) return { ok: true, duplicado: true, doc: dup };

  const unico = categoria === "EXTRATO" || !cat.multiplo;
  if (unico) {
    await prisma.finContabDoc.deleteMany({
      where: { competencia, categoria, formato, ...(categoria === "EXTRATO" ? { tipoId } : {}) },
    });
  }
  const nome = await nomeLivre(competencia, nomePadrao({ categoria, banco, competencia, formato, sufixo }));
  const doc = await prisma.finContabDoc.create({
    data: {
      competencia, categoria, tipoId, banco, formato, nome,
      nomeOriginal: nomeOriginal || null, tamanho: buf.length, hash,
      conteudo: buf.toString("base64"), arquivoId,
      enviadoPorId: usuario?.id || null,
      enviadoPorNome: usuario ? [usuario.nome, usuario.sobrenome].filter(Boolean).join(" ").toUpperCase() : null,
    },
    select: { id: true, nome: true, categoria: true, formato: true, tamanho: true, createdAt: true },
  });
  return { ok: true, doc };
}

// Cópia automática do PDF enviado na Importação mensal (só extratos).
export async function copiarExtratoParaContabilidade(arquivoId) {
  const a = await prisma.finArquivo.findUnique({
    where: { id: arquivoId },
    select: { id: true, competencia: true, conteudo: true, nome: true, parcial: true, tipo: { select: { id: true, codigo: true, banco: true } } },
  });
  if (!a || !a.tipo) return null;
  if (!/_EXTRATO$/.test(a.tipo.codigo)) return null;   // só extrato de conta corrente
  if (a.parcial) return null;                            // v172 — parcial não vai para a contabilidade
  // nunca sobrescreve: se já existe um PDF deste banco no mês, deixa como está
  const ja = await prisma.finContabDoc.findFirst({
    where: { competencia: a.competencia, categoria: "EXTRATO", formato: "PDF", tipoId: a.tipo.id },
    select: { id: true, nome: true },
  });
  if (ja) return { ok: true, duplicado: true, doc: ja };
  const buf = Buffer.from(a.conteudo, "base64");
  return gravarDoc({
    competencia: a.competencia, categoria: "EXTRATO", tipoId: a.tipo.id, banco: a.tipo.banco,
    formato: "PDF", buf, nomeOriginal: a.nome, arquivoId: a.id,
  });
}

// Refaz as cópias de um mês (usado quando a guia é aberta pela 1ª vez num mês antigo).
export async function sincronizarExtratos(competencia) {
  const arqs = await prisma.finArquivo.findMany({
    where: { competencia, parcial: false, tipo: { codigo: { endsWith: "_EXTRATO" } } },
    select: { id: true },
  });
  let n = 0;
  for (const a of arqs) { const r = await copiarExtratoParaContabilidade(a.id).catch(() => null); if (r && !r.duplicado) n++; }
  return n;
}

// ---------------- ZIP do pacote ----------------
export async function montarZip(competencia) {
  const docs = await prisma.finContabDoc.findMany({
    where: { competencia },
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    select: { nome: true, categoria: true, conteudo: true, banco: true, formato: true, tamanho: true },
  });
  if (!docs.length) return null;

  const arvore = {};
  const lista = [];
  for (const d of docs) {
    const pasta = (CATEGORIAS[d.categoria] || CATEGORIAS.OUTRO).pasta;
    const partes = pasta.split("/");
    let no = arvore;
    for (const p of partes) { no[p] = no[p] || {}; no = no[p]; }
    no[d.nome] = new Uint8Array(Buffer.from(d.conteudo, "base64"));
    lista.push(`${pasta}/${d.nome}`);
  }
  arvore["CONTEUDO.txt"] = strToU8(
    [`MERIDIAN · DOCUMENTOS CONTABEIS ${mesAno(competencia)}`, "", ...lista.sort(), "", `${docs.length} arquivo(s)`].join("\r\n")
  );

  const u8 = zipSync(arvore, { level: 6 });
  return {
    nome: `CONTABILIDADE MERIDIAN ${mesAno(competencia)}.zip`,
    buffer: Buffer.from(u8),
    arquivos: docs.length,
    lista: lista.sort(),
  };
}

// ---------------- config simples (e-mail da contabilidade) ----------------
export const CFG_EMAIL = "EMAIL_CONTABILIDADE";

export async function lerConfig(chave) {
  const c = await prisma.finConfig.findUnique({ where: { chave } });
  return c ? c.valor : null;
}
export async function salvarConfig(chave, valor) {
  return prisma.finConfig.upsert({ where: { chave }, create: { chave, valor: String(valor || "") }, update: { valor: String(valor || "") } });
}
export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
