export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { unzipSync } from "fflate";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, competenciaValida, garantirTipos } from "@/lib/fin";
import {
  CATEGORIAS, ORDEM_CATEGORIAS, formatoDoNome, gravarDoc, sincronizarExtratos,
  CFG_EMAIL, lerConfig, salvarConfig, emailValido, mesAno,
} from "@/lib/finContab";
import { registrarXmlSaida } from "@/lib/finNfSaida";
import { emailDisponivel } from "@/lib/email";

// GET ?u=&competencia=AAAA-MM
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });

  await garantirTipos();
  await sincronizarExtratos(competencia).catch(() => null); // traz os PDFs já enviados na Importação

  const [bancos, docs, email, envios, nfs] = await Promise.all([
    prisma.finDocTipo.findMany({ where: { ativo: true, codigo: { endsWith: "_EXTRATO" } }, orderBy: { ordem: "asc" }, select: { id: true, banco: true, documento: true } }),
    prisma.finContabDoc.findMany({
      where: { competencia },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
      select: { id: true, categoria: true, tipoId: true, banco: true, formato: true, nome: true, nomeOriginal: true, tamanho: true, enviadoPorNome: true, createdAt: true, arquivoId: true },
    }),
    lerConfig(CFG_EMAIL),
    prisma.finContabEnvio.findMany({ where: { competencia }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.finNfSaida.count({ where: { competencia } }),
  ]);

  return Response.json({
    competencia, mesAno: mesAno(competencia),
    bancos, docs, email: email || "", envios, notasSaida: nfs,
    categorias: ORDEM_CATEGORIAS.map((k) => ({ k, ...CATEGORIAS[k] })),
    emailPronto: emailDisponivel(),
  });
}

// POST  { usuarioId, competencia, categoria, tipoId?, nome, conteudo(base64) }
// ZIP em categoria múltipla é expandido; XML de saída é lido na hora.
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioSoMaster(b?.usuarioId, "docsFinanceiros");
  if (!u) return soMaster();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });

  const categoria = String(b.categoria || "OUTRO").toUpperCase();
  const cat = CATEGORIAS[categoria];
  if (!cat) return Response.json({ error: "Categoria desconhecida." }, { status: 400 });
  if (!b.conteudo) return Response.json({ error: "Arquivo vazio." }, { status: 400 });

  let tipoId = null, banco = null;
  if (categoria === "EXTRATO") {
    const t = await prisma.finDocTipo.findUnique({ where: { id: Number(b.tipoId) }, select: { id: true, banco: true } });
    if (!t) return Response.json({ error: "Informe o banco do extrato." }, { status: 400 });
    tipoId = t.id; banco = t.banco;
  }

  const nomeEnviado = String(b.nome || "arquivo");
  const buf = Buffer.from(String(b.conteudo), "base64");
  const resultados = [];

  // entrada: um arquivo ou vários (ZIP em categoria múltipla)
  const entradas = [];
  if (/\.zip$/i.test(nomeEnviado) && cat.multiplo) {
    try {
      const ent = unzipSync(new Uint8Array(buf));
      for (const [caminho, u8] of Object.entries(ent)) {
        const nome = caminho.split("/").pop();
        if (!nome || caminho.includes("__MACOSX") || nome.startsWith(".")) continue;
        entradas.push({ nome, buf: Buffer.from(u8) });
      }
      if (!entradas.length) return Response.json({ error: "O ZIP está vazio." }, { status: 400 });
    } catch { return Response.json({ error: "ZIP inválido." }, { status: 400 }); }
  } else entradas.push({ nome: nomeEnviado, buf });

  for (const e of entradas) {
    const formato = formatoDoNome(e.nome);
    if (!formato || !cat.formatos.includes(formato)) {
      resultados.push({ nome: e.nome, ok: false, erro: `Formato não aceito aqui (use ${cat.formatos.join(", ")}).` });
      continue;
    }
    if (formato === "PDF" && e.buf.slice(0, 5).toString() !== "%PDF-") {
      resultados.push({ nome: e.nome, ok: false, erro: "Não é um PDF válido." });
      continue;
    }

    // sufixo do nome final
    let sufixo = null;
    let nota = null;
    if (categoria === "SAIDA_XML" && formato === "XML") {
      const r = await registrarXmlSaida(b.competencia, e.buf.toString("utf8"));
      if (!r.ok) { resultados.push({ nome: e.nome, ok: false, erro: r.erro }); continue; }
      nota = r.nota;
      sufixo = `NF ${nota.numero}`;
    } else if (cat.multiplo) {
      sufixo = e.nome.replace(/\.[^.]+$/, "");
    }

    const g = await gravarDoc({
      competencia: b.competencia, categoria, tipoId, banco, formato,
      buf: e.buf, nomeOriginal: e.nome, sufixo, usuario: u,
    });
    resultados.push({
      nome: e.nome, ok: true, duplicado: !!g.duplicado, doc: g.doc,
      nota: nota ? { numero: nota.numero, valor: nota.valor, nome: nota.destNome, cnpj: nota.destCnpj } : null,
    });
  }

  const erros = resultados.filter((r) => !r.ok);
  return Response.json({ ok: erros.length < resultados.length, resultados }, { status: erros.length === resultados.length ? 422 : 200 });
}

// PUT { usuarioId, email } → e-mail da contabilidade
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();
  const email = String(b.email || "").trim().toLowerCase();
  if (email && !emailValido(email)) return Response.json({ error: "E-mail inválido." }, { status: 400 });
  await salvarConfig(CFG_EMAIL, email);
  return Response.json({ ok: true, email });
}
