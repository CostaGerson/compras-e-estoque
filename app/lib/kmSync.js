// v386 — integração direta com o banco do KM (MentorSoft, PostgreSQL, usuário de consulta "mentorbi")
// · o agente do PC da fábrica (tools/km/km-sync.ps1) lê as views/tabelas do KM e manda os pedidos em aberto para POST /api/km/sync
// · aqui cada pedido vira o mesmo objeto que sai da leitura do PDF (PV e OP/PP) e passa pelo mesmo fluxo do upload (aplicarLidos)
// · pedido sem mudança desde o último envio é ignorado (hash em KmPedido)
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { aplicarLidos, entradaAutomatica, QUEM_KM } from "@/lib/pedidos";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const n0 = (v) => (v == null || v === "" ? null : Number(v));
const isoD = (s) => (s ? String(s).slice(0, 10) : null);
const limpa = (s) => (s == null ? null : String(s).replace(/\s+/g, " ").trim() || null);
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");

// ---------- RTF do detalhe do item (OP) → texto ----------
export function rtfTexto(rtf) {
  let s = String(rtf || "");
  if (!s.startsWith("{\\rtf")) return s;
  // grupos de controle (tabela de fontes/cores, gerador) — até 1 nível de chaves dentro
  s = s.replace(/\{\\(?:fonttbl|colortbl|stylesheet|\*)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "");
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));   // bytes LATIN1/CP1252
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)));
  s = s.replace(/\\(?:par|line)\b ?/g, "\n").replace(/\\tab\b ?/g, " ");
  s = s.replace(/\\[a-z]+-?\d* ?/gi, "").replace(/\\([\\{}])/g, "$1").replace(/[{}]/g, "").replace(/\r/g, "");
  return s;
}

// "****TECIDO**** ... texto" → [{ t: "TECIDO", v: "..." }] — para no PERÍODO/VALOR TERCEIRIZADO, como a leitura da OP em PDF
export function parametrosDoDetalhe(rtf) {
  const txt = rtfTexto(rtf);
  const partes = txt.split(/\*{3,}\s*([^*\n]+?)\s*\*{3,}/);
  const out = [];
  for (let i = 1; i < partes.length; i += 2) {
    const t = partes[i].trim().toUpperCase();
    if (/^PER[IÍ]ODO\b/.test(semAc(t)) || /^VALOR TERCEIRIZADO/.test(semAc(t))) break;
    const v = partes[i + 1].split("\n").map((x) => x.trim()).filter(Boolean).join(" ").replace(/\s*=\s*$/, "").trim();
    out.push({ t, v });
  }
  return out;
}

// ordem de tamanhos da grade
const ORDEM_TAM = ["RN", "BB", "PP", "P", "M", "G", "GG", "XG", "EG", "XGG", "EGG", "EXG", "G1", "G2", "G3", "G4", "EXGG", "XXG", "XXXG", "UNICO", "U"];
const pesoTam = (t) => { const n = Number(t); if (Number.isFinite(n)) return 1000 + n; const i = ORDEM_TAM.indexOf(semAc(t)); return i < 0 ? 500 : i; };

// ---------- pedido do KM → objetos PV e OP (mesmo formato de lerPV / lerPP) ----------
export function mapearPedido(k) {
  const numero = String(k.numero || "").trim();
  const itensKm = (k.itens || []).slice().sort((a, b) => Number(a.id) - Number(b.id));
  const pv = {
    tipo: "PV", numero, fonteKm: true,
    emissao: isoD(k.emissao), despacho: isoD(k.entrega),
    cliente: limpa(k.fantasia) || limpa(k.cliente), razaoSocial: limpa(k.cliente), clienteCodigo: limpa(k.cliente_codigo),
    cnpj: k.cnpj ? String(k.cnpj).replace(/\D/g, "") || null : null,
    condicao: limpa(k.condicao), vendedor: limpa(k.representante),
    tipoPedido: limpa(k.tipo), oc: limpa(k.oc),
    total: r2(n0(k.valor_pedido) || n0(k.valor_solpedid) || 0),
    frete: n0(k.frete) || null, freteTipo: limpa(k.frete_tipo), obs: limpa(k.obs) ? limpa(k.obs).toUpperCase() : null,
    qtdTotal: Number(k.total_pecas) || itensKm.reduce((s, i) => s + (Number(i.qtd) || 0), 0),
    itens: itensKm.map((i) => {
      const qtd = Number(i.qtd) || 0, preco = n0(i.preco) ?? n0(i.precoTabela);
      return {
        codigo: limpa(i.codigo), descricao: limpa(i.descricao) || limpa(i.nome), qtd, preco,
        total: r2(n0(i.valor) ?? qtd * (preco || 0)),
        grade: (i.grade || []).map((g) => ({ tam: limpa(g.tam), qtd: Number(g.qtd) || 0 })).filter((g) => g.tam)
          .sort((a, b) => pesoTam(a.tam) - pesoTam(b.tam)),
      };
    }),
  };
  // OP: só itens que já têm detalhe (parâmetros) ou OP aberta no PCP
  const comOp = itensKm.filter((i) => (i.ops && i.ops.length) || (i.detalhe && /\*{3,}/.test(rtfTexto(i.detalhe))));
  let pp = null;
  if (comOp.length) {
    pp = {
      tipo: "PP", numero, fonteKm: true, cliente: pv.cliente, emissao: pv.emissao, despacho: pv.despacho,
      itens: comOp.map((i) => {
        const ops = (i.ops || []).map((o) => ({
          op: String(o.op), qtd: Number(o.qtd) || 0, producao: isoD(o.producao), programacao: isoD(o.programacao), obs: limpa(o.obs),
          setores: (o.setores || []).map((s) => ({ setor: limpa(s.setor), seq: Number(s.seq) || 0, previsao: isoD(s.previsao), entrada: isoD(s.entrada),
            envio: isoD(s.envio), finalizado: String(s.finalizado || "").trim().toUpperCase() === "S" })),
        }));
        return {
          seq: itensKm.indexOf(i) + 1, de: itensKm.length, codigo: limpa(i.codigo), descricao: limpa(i.nome) || limpa(i.descricao),
          qtd: ops.reduce((s, o) => s + o.qtd, 0) || Number(i.qtd) || 0, op: ops[0]?.op || null,
          parametros: parametrosDoDetalhe(i.detalhe), kmOps: ops,
        };
      }),
    };
  }
  // status do pedido no KM (solpedid.cstatuspedid): C cancelado · F faturado · P parcial · L/U/E em andamento
  const st = String(k.status_km || "").trim().toUpperCase();
  const faturadoKm = st === "F", canceladoKm = st === "C" || !!k.excluido;
  const qtSaldo = itensKm.reduce((s, i) => s + Math.max((Number(i.qtd) || 0) - (Number(i.entregue) || 0), 0), 0);
  const extra = {
    qtEntregar: faturadoKm || canceladoKm ? 0 : Math.round(qtSaldo),
    vlEntregar: faturadoKm || canceladoKm ? 0 : r2(k.valor_a_entregar),
    ultFaturamento: isoD(k.ult_faturamento), excluido: canceladoKm, faturadoKm, situacao: st || null,
    nfs: (k.nfs || []).map((x) => ({ numero: String(x.numero || "").replace(/^0+(?=\d)/, ""), emissao: isoD(x.emissao), valor: r2(x.valor) })).filter((x) => x.numero),
  };
  return { pv, pp, extra };
}

const hashDe = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex");

// ---------- aplica um lote vindo do agente ----------
export async function sincronizarKm(pedidos, { previa = false } = {}) {
  const lista = (Array.isArray(pedidos) ? pedidos : []).filter((k) => k && k.numero);
  const nums = lista.map((k) => String(k.numero).trim());
  const existentes = Object.fromEntries((await prisma.pedidoVenda.findMany({ where: { numero: { in: nums } },
    select: { id: true, numero: true, cliente: true, clienteCodigo: true, total: true, qtd: true, itens: true, status: true, faturadoEm: true, fonte: true } }))
    .map((x) => [x.numero, x]));
  const hashes = previa ? {} : Object.fromEntries((await prisma.kmPedido.findMany({ where: { numero: { in: nums } } })).map((x) => [x.numero, x.hash]));
  // nome do cliente: o que já está nos pedidos do mesmo código (o PDF mostrava o nome do cadastro)
  const codigos = [...new Set(lista.map((k) => limpa(k.cliente_codigo)).filter(Boolean))];
  const nomePorCodigo = Object.fromEntries((await prisma.pedidoVenda.findMany({ where: { clienteCodigo: { in: codigos } }, select: { clienteCodigo: true, cliente: true },
    orderBy: { updatedAt: "desc" } })).reverse().map((x) => [x.clienteCodigo, x.cliente]));

  const res = { recebidos: lista.length, iguais: 0, novos: 0, atualizados: 0, ignorados: 0, cancelados: 0, faturados: 0, entradas: 0, erros: [], pedidos: [] };
  const lidos = [], posAplicar = [];
  for (const k of lista) {
    try {
      const { pv, pp, extra } = mapearPedido(k);
      const at = existentes[pv.numero];
      const h = hashDe(k);
      if (!previa && hashes[pv.numero] === h) { res.iguais++; continue; }
      if (at?.cliente) pv.cliente = at.cliente; else if (pv.clienteCodigo && nomePorCodigo[pv.clienteCodigo]) pv.cliente = nomePorCodigo[pv.clienteCodigo];
      // não cria pedido que já chega cancelado ou sem nada a faturar
      if (!at && (extra.excluido || extra.vlEntregar <= 0.009)) { res.ignorados++; if (!previa) posAplicar.push({ numero: pv.numero, hash: h, so: true }); continue; }
      if (previa) {
        const itAt = Array.isArray(at?.itens) ? at.itens : [];
        res.pedidos.push({
          numero: pv.numero, novo: !at, cliente: pv.cliente, total: pv.total, totalAtual: at ? Number(at.total) : null, qtd: pv.qtdTotal, qtdAtual: at?.qtd ?? null,
          vlEntregar: extra.vlEntregar, statusKm: extra.situacao, valorSolpedid: n0(k.valor_solpedid), frete: pv.frete, freteTipo: pv.freteTipo, oc: pv.oc, condicao: pv.condicao, despacho: pv.despacho, cnpj: pv.cnpj, vendedor: pv.vendedor,
          itens: pv.itens.map((i) => ({ codigo: i.codigo, descricao: i.descricao, qtd: i.qtd, preco: i.preco, grade: i.grade.map((g) => `${g.tam}:${g.qtd}`).join(" "),
            casaComAtual: at ? itAt.some((x) => x.codigo === i.codigo) : null })),
          op: pp ? pp.itens.map((i) => ({ codigo: i.codigo, op: i.op, parametros: i.parametros.length, setores: (i.kmOps[0]?.setores || []).length })) : [],
        });
        continue;
      }
      lidos.push(pv); if (pp) lidos.push(pp);
      posAplicar.push({ numero: pv.numero, hash: h, extra, novo: !at });
    } catch (e) { res.erros.push(`${k.numero}: ${e.message}`); }
  }
  if (previa) return res;

  if (lidos.length) {
    const r = await aplicarLidos(lidos, QUEM_KM);
    for (const x of r) if (x.erro) res.erros.push(`${x.nome || x.numero}: ${x.erro}`);
  }
  for (const p of posAplicar) {
    if (!p.so) {
      const at = await prisma.pedidoVenda.findUnique({ where: { numero: p.numero }, select: { id: true, status: true, faturadoEm: true, fonte: true } });
      if (at) {
        const e = p.extra;
        const data = { qtEntregar: e.qtEntregar, vlEntregar: e.vlEntregar, kmNfs: e.nfs, fonte: at.fonte && at.fonte.includes("KM") ? at.fonte : (at.fonte ? `${at.fonte}+KM` : "KM") };
        if (e.excluido && at.status !== "CANCELADO") { data.status = "CANCELADO"; res.cancelados++; }
        else if (e.vlEntregar <= 0.009 && at.status === "ANDAMENTO") { data.status = "FATURADO"; data.faturadoEm = at.faturadoEm || (e.ultFaturamento ? dUTC(e.ultFaturamento) : new Date()); res.faturados++; }
        await prisma.pedidoVenda.update({ where: { id: at.id }, data });
        if (p.novo) res.novos++; else res.atualizados++;
        if (!data.status) {
          try { const e2 = await entradaAutomatica(p.numero); if (e2) res.entradas++; } catch (e) { res.erros.push(`${p.numero}: entrada — ${e.message}`); }
        }
      }
    }
    await prisma.kmPedido.upsert({ where: { numero: p.numero }, create: { numero: p.numero, hash: p.hash }, update: { hash: p.hash } });
  }
  await prisma.kmSyncLog.create({ data: { recebidos: res.recebidos, novos: res.novos, atualizados: res.atualizados, iguais: res.iguais, entradas: res.entradas,
    erros: res.erros.length ? res.erros.slice(0, 50).join("\n") : null } });
  return res;
}
