export const dynamic = "force-dynamic";
import { respostaAnexo, enxugarItensPp } from "@/lib/arquivos";
import { prisma } from "@/lib/prisma";
import { usuarioPP, negadoPP, ppParaUsuario, nomeQuem } from "@/lib/pp";
import { salvarPp, efetivarPedido, faturarPedido, criticas } from "@/lib/pedidoEfetivar";   // v595
import { ehServico, ppDeServico, negadoServico } from "@/lib/servicoPcp";   // v1006

export async function GET(req, { params }) {
  const u = await usuarioPP(req, "ve");
  if (!u) return negadoPP();
  const id = Number(params.id);
  if (u.servicoPcp && !(await ppDeServico(id))) return negadoServico();   // v1006
  try { await enxugarItensPp(id); } catch (e) { console.log("enxugar anexos:", e.message); }   // v868 — arquivos grandes dos itens vão para o disco
  // v320 — ?arquivo=arquivoPedidoPdf|arquivoOpPdf|arquivoPcPdf|arquivoLancPdf → o PDF
  // v595 — ?anexo=ID → o arquivo anexado
  const anx = new URL(req.url).searchParams.get("anexo");
  if (anx) {
    const a = await prisma.ppAnexo.findFirst({ where: { id: Number(anx), ppId: id } });
    if (!a) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    return respostaAnexo(a.base64, { nome: a.nome, mime: a.tipo });   // v865 — também arquivo grande em disco
  }
  // v650 — ?item=ID&k=n → arquivo n do item
  const itq = new URL(req.url).searchParams.get("item");
  if (itq) {
    const it = await prisma.ppItem.findFirst({ where: { id: Number(itq), ppId: id }, select: { anexosJson: true } });
    const a = Array.isArray(it?.anexosJson) ? it.anexosJson[Number(new URL(req.url).searchParams.get("k")) || 0] : null;
    if (!a?.base64) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    return respostaAnexo(a.base64, { nome: a.nome || "arquivo", mime: a.mime });   // v865
  }
  const arq = new URL(req.url).searchParams.get("arquivo");
  if (arq) {
    if (!["arquivoPedidoPdf", "arquivoOpPdf", "arquivoPcPdf", "arquivoLancPdf"].includes(arq)) return Response.json({ error: "Arquivo inválido." }, { status: 400 });
    const r = await prisma.pp.findUnique({ where: { id }, select: { numero: true, [arq]: true } });
    const pp1 = ppParaUsuario({ ...r }, u);
    const v = pp1?.[arq];
    if (!v) return Response.json({ error: "PDF não encontrado." }, { status: 404 });
    const nome = { arquivoPedidoPdf: "PV", arquivoOpPdf: "PP", arquivoPcPdf: "PC", arquivoLancPdf: "LANCAMENTO" }[arq];
    return new Response(Buffer.from(String(v).replace(/^data:[^,]+,/, ""), "base64"), { headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome} ${r.numero || id}.pdf"` } });
  }
  const pp = await prisma.pp.findUnique({
    where: { id },
    include: { itens: { orderBy: { id: "asc" } }, anexos: { select: { id: true, nome: true, tipo: true, categoria: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } },
  });
  if (!pp) return Response.json({ error: "PP não encontrado" }, { status: 404 });
  // v774 — #61: item sem código mostra o código do cadastro de itens (padrão do sistema ou do KM)
  const semCod = pp.itens.filter((i) => !i.codigo && i.itemPadraoId);
  if (semCod.length) {
    const ips = await prisma.itemPadrao.findMany({ where: { id: { in: semCod.map((i) => i.itemPadraoId) } }, select: { id: true, codigoPadrao: true, codigo: true } }).catch(() => []);
    for (const i of semCod) { const x = ips.find((y) => y.id === i.itemPadraoId); if (x) i.codigo = x.codigoPadrao || x.codigo || null; }
  }
  // v775 — #61: item ligado a um produto do KM (código do KM no item ou no cadastro de itens) completa os detalhes de produção
  //   que faltam com os do KM (o que foi lançado no pedido prevalece)
  try {
    const ipIds = pp.itens.map((i) => i.itemPadraoId).filter(Boolean);
    const ips = ipIds.length ? await prisma.itemPadrao.findMany({ where: { id: { in: ipIds } }, select: { id: true, codigo: true } }) : [];
    const codKm = (i) => [i.codigo, ips.find((x) => x.id === i.itemPadraoId)?.codigo].find((c) => c && /^[A-Z]{2}\.\d{2}\.\d{3}\.\d{3,4}$/.test(String(c).toUpperCase()));
    const cods = [...new Set(pp.itens.map(codKm).filter(Boolean).map((c) => String(c).toUpperCase()))];
    const kms = cods.length ? await prisma.kmProduto.findMany({ where: { codigo: { in: cods } }, select: { codigo: true, parametros: true } }) : [];
    const nk = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\b(DA|DO|DE)\b/g, " ").replace(/\s+/g, " ").trim();
    for (const i of pp.itens) {
      if (i.itemPadraoId) continue;   // v908 — item do cadastro de itens padrão: vale o cadastro (o KM não acrescenta estampa/detalhe que o item padrão não tem)
      const c = codKm(i); if (!c) continue;
      const km = kms.find((x) => x.codigo === String(c).toUpperCase()); if (!km || !Array.isArray(km.parametros)) continue;
      let pr; try { pr = JSON.parse(i.parametrosJson || "{}") || {}; } catch { pr = {}; }
      const tem = new Map(Object.entries(pr).map(([k, v]) => [nk(k), v]));
      for (const x of km.parametros) {
        if (!x?.t || !String(x.v || "").trim()) continue;
        const k = nk(x.t), atual = [...tem.entries()].find(([kk]) => kk === k || kk.startsWith(k.split(" ")[0]) && k.startsWith(kk.split(" ")[0]));
        if (atual) continue;   // v908 — campo já existe no item (mesmo apagado pelo usuário): não volta o valor do KM
        pr[String(x.t).toUpperCase()] = x.v;
      }
      if (!i.codigo) i.codigo = String(c).toUpperCase();
      i.parametrosJson = JSON.stringify(pr);
    }
  } catch (e) { console.log("pp/km:", e.message); }
  // v774 — #58: tecido gravado antes da v774 ganha nome do artigo, cor, código e fabricante pela FPP (para a OP)
  try {
    const { resumoFpp } = await import("@/lib/pedidoLanc");
    const { comComposicao } = await import("@/lib/tecidoComposicao");
    const cache = {};
    for (const i of pp.itens) {
      let pr; try { pr = JSON.parse(i.parametrosJson || "{}"); } catch { continue; }
      const t = pr?.TECIDO;
      if (!t || typeof t !== "object" || !t.fpp || (t.nome && t.composicao !== undefined)) continue;
      if (!(t.fpp in cache)) cache[t.fpp] = await comComposicao(resumoFpp(await prisma.fpp.findFirst({ where: { numero: Number(t.fpp) } }).catch(() => null)));
      const rf = cache[t.fpp];
      if (!rf) continue;
      if (t.nome) { pr.TECIDO = { ...t, composicao: rf.artigoComposicao || null }; i.parametrosJson = JSON.stringify(pr); continue; }   // v891 — #85
      const cor = t.cor || (String(t.artigo || "").split(" · ")[1] || null) || rf.artigoCor;
      pr.TECIDO = { ...t, nome: rf.artigo || null, corArtigo: cor, codigo: ((rf.cores || []).find((c) => c.cor === cor) || {}).codigo || rf.artigoCodigo || null, fabricante: rf.artigoFabricante || null, composicao: rf.artigoComposicao || null };
      i.parametrosJson = JSON.stringify(pr);
    }
  } catch (e) { console.log("pp/tecido:", e.message); }
  const { ppsRecebendoDetalhes } = await import("@/lib/dadosLink");   // v707
  const rec = pp.efetivadoEm ? {} : await ppsRecebendoDetalhes([pp.id]);
  return Response.json({ ...ppParaUsuario(pp, u), recebendoDetalhes: !!rec[pp.id] }, { headers: { "Cache-Control": "no-store" } });   // v660 — nunca devolve o lançamento antigo do cache
}

export async function DELETE(req, { params }) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const id = Number(params.id);
  if (u.servicoPcp && !(await ppDeServico(id))) return negadoServico();   // v1006
  // v671 — pedido com número (KM ou lançado) vai para a lixeira de pedidos: senão o KM / a lista o recriam
  const pp = await prisma.pp.findUnique({ where: { id }, select: { numero: true } });
  if (pp?.numero && (await prisma.pedidoVenda.findUnique({ where: { numero: pp.numero }, select: { id: true } }))) {
    const motivo = new URL(req.url).searchParams.get("motivo") || "";
    const { excluirPedido } = await import("@/lib/pedidoLixeira");
    const r = await excluirPedido(pp.numero, { motivo, quem: nomeQuem(u) });
    if (r.error) return Response.json(r, { status: 400 });
    return Response.json({ ok: true, lixeira: true });
  }
  // v793 — pedido com número nunca é apagado: rascunho numerado vai para a lixeira (Produção › Excluídos); só a tentativa sem número é descartada
  if (pp?.numero) {
    const motivo = new URL(req.url).searchParams.get("motivo") || "";
    const { excluirPpNumerado } = await import("@/lib/pedidoLixeira");
    const r = await excluirPpNumerado(id, { motivo, quem: nomeQuem(u) });
    if (r.error) return Response.json(r, { status: 400 });
    return Response.json({ ok: true, lixeira: true });
  }
  await prisma.pp.delete({ where: { id } }); // itens em cascata
  return Response.json({ ok: true });
}

// v595 — salvar alterações (mantém o id e os anexos)
export async function PUT(req, { params }) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  try {
    const corpo = await req.json();
    if (u.servicoPcp && (!ehServico(corpo?.tipoPedido) || !(await ppDeServico(params.id)))) return negadoServico();   // v1006
    const id = await salvarPp(Number(params.id), corpo, nomeQuem(u));
    try { await enxugarItensPp(id); } catch (e) { console.log("enxugar anexos:", e.message); }   // v868
    const pp = await prisma.pp.findUnique({ where: { id }, include: { itens: true } });
    return Response.json({ id, ...criticas(pp) });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

// v595 — { acao: "efetivar" } · { acao: "faturar", nf, emissaoNf, entrega }
export async function POST(req, { params }) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  const b = await req.json().catch(() => ({}));
  if (u.servicoPcp && (b.acao === "faturar" || !(await ppDeServico(params.id)))) return negadoServico();   // v1006 — o PCP efetiva o serviço; faturar é no ERP
  try {
    if (b.acao === "efetivar") {
      const r = await efetivarPedido(Number(params.id), nomeQuem(u));
      // v654 — item sem layout: tarefa de criação de layout para o arte finalista (o pedido segue normal)
      const kmAss = r?.ok ? (await prisma.pp.findUnique({ where: { id: Number(params.id) }, select: { kmAssumidoEm: true } }))?.kmAssumidoEm : null;   // v730 — pedido do KM assumido: não pede layout
      if (r?.ok && !kmAss) { try { const { gerarCriacaoLayout } = await import("@/lib/layoutFluxo"); r.tarefaLayout = await gerarCriacaoLayout(Number(params.id), u); } catch (e) { console.log("layout:", e.message); } }
      return Response.json(r);
    }
    if (b.acao === "rascunho") { const { salvarRascunho } = await import("@/lib/pedidoEfetivar"); return Response.json(await salvarRascunho(Number(params.id))); }   // v777 — #62
    if (b.acao === "faturar") return Response.json(await faturarPedido(Number(params.id), b, nomeQuem(u)));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { console.log("pp acao:", e); return Response.json({ error: e.message }, { status: 500 }); }
}
