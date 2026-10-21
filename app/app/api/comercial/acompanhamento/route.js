export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// v381 — Comercial › Acompanhamento: pedidos do vendedor logado (master/diretoria veem todos) e situação no PCP
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";
import { gerencial } from "@/lib/acesso";
import { pcpDoPedido } from "@/lib/cronograma";

const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
// ordem de avanço: a situação do pedido é a do item MENOS avançado
const ORDEM = { LEVANTAMENTO: 0, "A PROGRAMAR": 1, A_PROGRAMAR: 1, "EM PRODUÇÃO": 2, EM_PRODUCAO: 2, "CONCLUÍDO": 3, CONCLUIDO: 3 };
const TXT = ["LEVANTAMENTO", "A PROGRAMAR", "EM PRODUÇÃO", "CONCLUÍDO"];
const ordemDe = (s) => { const k = sem(s).replace(/\s+/g, " "); return ORDEM[k] ?? ORDEM[k.replace(/ /g, "_")] ?? (/CONCLU/.test(k) ? 3 : /PRODU/.test(k) ? 2 : /PROGRAM/.test(k) ? 1 : 0); };

// vendedor do pedido = usuário logado (pelo primeiro nome; aceita nome completo)
function doVendedor(u, vendedor) {
  const v = sem(vendedor); if (!v) return false;
  const nome = sem(u.nome), completo = sem(`${u.nome} ${u.sobrenome || ""}`);
  return v === nome || v === completo || v.split(/\s+/)[0] === nome || completo.startsWith(v);
}
async function acesso(id) {
  const u = await usuarioAtivoFin(id);
  if (!u) return null;
  return { u, todos: gerencial(u) };
}

// GET ?u=&todos=1 → lista · ?u=&numero= → detalhe ao vivo do PCP
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const a = await acesso(q.get("u"));
  if (!a) return Response.json({ error: "Sem acesso." }, { status: 403 });

  if (q.get("numero")) {
    const p = await prisma.pedidoVenda.findFirst({ where: { numero: q.get("numero") }, select: { numero: true, vendedor: true, cliente: true, entregaPrevista: true, despacho: true, status: true } });
    if (!p) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (!a.todos && !doVendedor(a.u, p.vendedor)) return Response.json({ error: "Este pedido é de outro vendedor." }, { status: 403 });
    let pcp;
    try { pcp = await pcpDoPedido(p.numero); } catch (e) { return Response.json({ error: `PCP: ${e.message}` }, { status: 502 }); }
    const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const dias = (a0, b0) => Math.round((new Date(`${b0}T00:00:00Z`) - new Date(`${a0}T00:00:00Z`)) / 864e5);
    const itens = pcp.itens.map((i) => {
      const es = pcp.etapas.filter((e) => e.itemCode === i.itemCode).sort((x, y) => String(x.inicio || x.entrada || "").localeCompare(String(y.inicio || y.entrada || "")));
      const ord = ordemDe(i.situacao);
      const aberta = es.find((e) => !e.concluida && (!i.etapaAtual || sem(e.etapa) === sem(i.etapaAtual))) || es.find((e) => !e.concluida);
      const fechadas = es.filter((e) => e.concluida);
      const ultimaSaida = fechadas.map((e) => e.saida).filter(Boolean).sort().pop() || null;
      // desde quando está nesta situação
      const desde = ord === 3 ? ultimaSaida : ord === 2 ? (aberta?.entrada || ultimaSaida || aberta?.inicio || null) : (i.atualizadoEm || null);
      // programação: etapa em curso × planejado; concluído × entrega; sem programação × prazo de entrega
      let prog = { k: "SEM", t: "sem programação" };
      if (ord === 3) {
        const ref = i.entrega; if (ref && ultimaSaida) { const d = dias(ref, ultimaSaida); prog = d > 0 ? { k: "ATRASADO", t: `concluído ${d} dia(s) depois do prazo`, d } : { k: "ADIANTADO", t: d < 0 ? `concluído ${-d} dia(s) antes do prazo` : "concluído no prazo", d } ; }
        else prog = { k: "OK", t: "concluído" };
      } else if (aberta?.planejadoFim) {
        const d = dias(aberta.planejadoFim, hoje);
        if (d > 0) prog = { k: "ATRASADO", t: `${aberta.etapa}: ${d} dia(s) além do fim programado (${aberta.planejadoFim.split("-").reverse().join("/")})`, d };
        else if (aberta.entrada && aberta.inicio && aberta.entrada < aberta.inicio) prog = { k: "ADIANTADO", t: `${aberta.etapa}: entrou ${dias(aberta.entrada, aberta.inicio)} dia(s) antes do programado`, d };
        else prog = { k: "OK", t: `${aberta.etapa}: dentro da programação (fim ${aberta.planejadoFim.split("-").reverse().join("/")})`, d };
      } else if (i.entrega) {
        const d = dias(i.entrega, hoje);
        prog = d > 0 ? { k: "ATRASADO", t: `prazo de entrega vencido há ${d} dia(s)`, d } : { k: "OK", t: `ainda sem etapa programada · entrega ${i.entrega.split("-").reverse().join("/")}`, d };
      }
      return { itemCode: i.itemCode, op: i.pedido, produto: i.produto, pecas: i.pecas, quantidade: i.quantidade, complemento: i.complemento,
        situacao: TXT[ord], etapa: i.etapaAtual || aberta?.etapa || null, prestador: aberta?.prestador || null, desde, entrega: i.entrega, prog,
        etapas: es.map((e) => ({ etapa: e.etapa, subetapa: e.subetapa, prestador: e.prestador, inicio: e.inicio, planejadoFim: e.planejadoFim, entrada: e.entrada, saida: e.saida, concluida: e.concluida })) };
    });
    return Response.json({ numero: p.numero, cliente: p.cliente, vendedor: p.vendedor, status: p.status, agrupado: pcp.agrupado, ops: pcp.ops, itens });
  }

  const lista = await prisma.pedidoVenda.findMany({
    where: { interno: false, ...(q.get("todos") === "1" ? {} : { status: "ANDAMENTO" }) },
    orderBy: [{ emissao: "desc" }, { numero: "desc" }],
    select: { numero: true, emissao: true, cliente: true, vendedor: true, total: true, qtd: true, itens: true, status: true, cronoItens: true, cronoSituacao: true, cronoEm: true, entregaPrevista: true, despacho: true, nfNumero: true, nfsFaturadas: true, vlEntregar: true, qtEntregar: true },
  });
  const meus = a.todos ? lista : lista.filter((p) => doVendedor(a.u, p.vendedor));
  const pedidos = meus.map((p) => {
    const ci = (Array.isArray(p.cronoItens) ? p.cronoItens : []).filter((i) => !i.complemento);
    const ords = ci.map((i) => ordemDe(i.situacao));
    const min = ords.length ? Math.min(...ords) : null;
    const pior = min != null ? ci[ords.indexOf(min)] : null;
    const situacao = p.status === "FATURADO" ? "FATURADO" : p.status === "CANCELADO" ? "CANCELADO" : min == null ? (p.cronoSituacao === "NÃO ESTÁ NO CRONOGRAMA" ? "FORA DO PCP" : "SEM PCP") : TXT[min];
    const pvItens = Array.isArray(p.itens) ? p.itens.length : 0;
    return { numero: p.numero, emissao: iso(p.emissao), cliente: p.cliente, vendedor: p.vendedor, itens: pvItens || ci.length, total: Number(p.total) || 0,
      situacao, etapa: min === 2 ? pior?.etapa || null : null, entrega: iso(p.entregaPrevista) || iso(p.despacho), status: p.status,
      parcial: Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length > 0 && p.status === "ANDAMENTO", nf: p.nfNumero || null };
  });
  return Response.json({ todos: a.todos, vendedor: a.todos ? null : `${a.u.nome}`, pedidos });
}
