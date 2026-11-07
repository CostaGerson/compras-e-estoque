// v696 — Solicitação de lançamento (PDF gerado pela skill do vendedor) → dados para preencher o pedido.
// Lê o texto (rótulo e valor separados por tab), as artes embutidas, o cadastro do cliente (cria/completa pelo CNPJ) e as FPPs pelo número.
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP } from "@/lib/pp";
import { ehSolicitacao, lerSolicitacao, partirEndereco } from "@/lib/lancamentoSkill";
import { imagensDoPdf } from "@/lib/pdfImagens";
import { resumoFpp } from "@/lib/pedidoLanc";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// texto do PDF com "\t" entre itens da mesma linha (o padrão do pdf-parse cola "TECIDOMalha PV" e "38: 1040: 10")
function renderPagina(pageData) {
  return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }).then((tc) => {
    let lastY = null, lastX = null, text = "";
    for (const it of tc.items) {
      const y = it.transform[5], x = it.transform[4];
      if (lastY == null || Math.abs(y - lastY) < 1) { if (lastX != null && x - lastX > 2 && text && !text.endsWith("\n")) text += "\t"; text += it.str; }
      else text += "\n" + it.str;
      lastY = y; lastX = x + (it.width || 0);
    }
    return text;
  });
}
const up = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());
const dig = (s) => String(s || "").replace(/\D/g, "");

export async function POST(req) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const b = await req.json().catch(() => ({}));
  const raw = String(b.base64 || "");
  if (!raw) return Response.json({ error: "Arquivo vazio." }, { status: 400 });
  const buf = Buffer.from(raw.includes(",") ? raw.split(",")[1] : raw, "base64");
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return Response.json({ solicitacao: false });

  let texto = "";
  try {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    texto = (await pdfParse(buf, { pagerender: renderPagina })).text || "";
  } catch (e) { return Response.json({ solicitacao: false, erro: "Não consegui ler o texto do PDF: " + e.message }); }
  if (!ehSolicitacao(texto)) return Response.json({ solicitacao: false });

  const doc = lerSolicitacao(texto);
  const avisos = [...doc.avisos];

  // ---------- artes embutidas (o logo da Meridian fica de fora) ----------
  let imagens = [];
  try {
    imagens = (await imagensDoPdf(buf)).filter((x) => !(x.w === 695 && x.h === 696) && x.w >= 60 && x.h >= 60);
  } catch (e) { avisos.push("Não consegui extrair as artes do PDF: " + e.message); }
  const comLayout = doc.pecas.filter((p) => p.temLayout);
  const alvo = comLayout.length ? comLayout : doc.pecas;
  const soltas = [];
  if (imagens.length && imagens.length === alvo.length) alvo.forEach((p, i) => { p.imagem = imagens[i].url; });
  else if (imagens.length === 1) alvo.forEach((p) => { p.imagem = imagens[0].url; });
  else if (imagens.length) { soltas.push(...imagens.map((x) => x.url)); avisos.push(`O PDF tem ${imagens.length} artes para ${alvo.length} peça(s): entraram como anexos de layout — confira em qual item cada uma vai.`); }

  // ---------- cliente: cadastro pelo CNPJ (cria se não existe; completa IE e e-mail que faltam) ----------
  let cliente = null, clienteCriado = false, clienteCompletado = [];
  const cnpj = doc.faturamento.cnpj;
  if (cnpj) {
    cliente = await prisma.cliente.findUnique({ where: { cnpj } }).catch(() => null);
    const end = partirEndereco(doc.faturamento.endereco);
    if (!cliente && cnpj.length === 14) {
      try {
        cliente = await prisma.cliente.create({ data: {
          cnpj, razaoSocial: up(doc.faturamento.razaoSocial || doc.cliente) || "", nomeFantasia: up(doc.cliente) !== up(doc.faturamento.razaoSocial) ? up(doc.cliente) : null,
          inscricaoEstadual: up(doc.faturamento.ie), logradouro: up(end.logradouro), numero: up(end.numero), complemento: up(end.complemento), bairro: up(end.bairro),
          municipio: up(end.municipio), uf: up(end.uf), cep: end.cep || null, emailNf: doc.email ? doc.email.toLowerCase() : null,
          obs: `Cadastrado pela solicitação de lançamento (vendedor ${doc.vendedor || "—"}) em ${new Date().toLocaleDateString("pt-BR")}.`,
        } });
        clienteCriado = true;
      } catch (e) { avisos.push("Não consegui cadastrar o cliente: " + e.message); }
    } else if (cliente) {
      const data = {};
      if (!cliente.emailNf && doc.email) { data.emailNf = doc.email.toLowerCase(); clienteCompletado.push("e-mail de NF"); }
      if (!cliente.inscricaoEstadual && doc.faturamento.ie) { data.inscricaoEstadual = up(doc.faturamento.ie); clienteCompletado.push("inscrição estadual"); }
      if (!cliente.logradouro && end.logradouro) { Object.assign(data, { logradouro: up(end.logradouro), numero: up(end.numero), complemento: up(end.complemento), bairro: up(end.bairro), municipio: up(end.municipio), uf: up(end.uf), cep: end.cep || null }); clienteCompletado.push("endereço"); }
      if (Object.keys(data).length) cliente = await prisma.cliente.update({ where: { id: cliente.id }, data }).catch(() => cliente);
      if (cliente.razaoSocial && doc.faturamento.razaoSocial && up(cliente.razaoSocial) !== up(doc.faturamento.razaoSocial))
        avisos.push(`Razão social do documento (${up(doc.faturamento.razaoSocial)}) diferente do cadastro (${cliente.razaoSocial}): mantive a do cadastro.`);
    }
  }

  // ---------- FPPs pelo número ----------
  const nums = [...new Set([...doc.fpps, ...doc.pecas.map((p) => p.fpp).filter(Boolean)])];
  const fpps = {};
  for (const n of nums) {
    const f = await prisma.fpp.findUnique({ where: { numero: n } }).catch(() => null);
    fpps[n] = f ? resumoFpp(f) : null;
    if (!f) avisos.push(`FPP ${String(n).padStart(5, "0")} não encontrada no sistema: indexe a FPP no item.`);
  }

  if (cliente) { const { kmDados, kmHash, ...c } = cliente; cliente = c; }
  return Response.json({ solicitacao: true, doc, fpps, cliente, clienteCriado, clienteCompletado, imagensSoltas: soltas, avisos });
}
