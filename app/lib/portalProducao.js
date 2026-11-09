// v727 — pedido do portal (Loja Way) liberado para produção é lançado sozinho no sistema de produção:
//   anexa as artes do cliente e a personalização exclusiva (Excel) ao pedido e efetiva (nº, PV, contas a receber, Compras → PCP).
//   Condição de pagamento e vendedor: os do último pedido do mesmo cliente do portal já efetivado pela equipe.
//   Sem como efetivar (sem condição reaproveitável, sem preço, sem prazo…) → fica em Lançar pedido e a equipe recebe o motivo.
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { efetivarPedido } from "@/lib/pedidoEfetivar";
import { textoCondicao } from "@/lib/pedidoLanc";
import { temDU } from "@/lib/dadosUnitarios";

const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
const PREF_ARTE = "Arte do cliente · ";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const safe = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// condição que dá para repetir: só parcelas por prazo (sem entrada e sem valor fixo, que dependem do total de cada pedido)
export function condicaoReaproveitavel(pag) {
  const ps = Array.isArray(pag?.parcelas) ? pag.parcelas : [];
  if (!ps.length) return null;
  if (pag.entrada && num(pag.entrada.valor) > 0) return null;
  if (ps.some((x) => num(x.valor) > 0)) return null;
  return { parcelas: ps.map((x) => ({ dias: x.dias, tipo: x.tipo, base: x.base })) };
}

// planilha da personalização exclusiva: uma aba por item (nº, tamanho e o que vai em cada local)
export function planilhaPersonalizacao(itens, titulo) {
  const wb = XLSX.utils.book_new();
  let abas = 0;
  itens.forEach((it, k) => {
    const du = it.dadosUnitarios;
    if (!temDU(du) || !(du.linhas || []).length) return;
    const campos = du.campos;
    const cab = ["Nº", "Tamanho", ...campos.map((c) => [c.local, c.rotulo].filter(Boolean).join(" · ") || "Dado")];
    const linhas = du.linhas.map((l, i) => [i + 1, l.tam || "", ...campos.map((c) => String(l.valores?.[c.id] ?? ""))]);
    const porTam = {};
    for (const l of du.linhas) porTam[l.tam || "?"] = (porTam[l.tam || "?"] || 0) + 1;
    const ws = XLSX.utils.aoa_to_sheet([
      [titulo],
      [`Item ${k + 1} · ${it.descricao || ""}${it.codigo ? ` (${it.codigo})` : ""}`],
      [`${du.linhas.length} peça(s) · ${Object.entries(porTam).map(([t, q]) => `${t} ${q}`).join(" · ")}`],
      [],
      cab,
      ...linhas,
    ]);
    ws["!cols"] = [{ wch: 5 }, { wch: 10 }, ...campos.map(() => ({ wch: 28 }))];
    XLSX.utils.book_append_sheet(wb, ws, `Item ${k + 1}`.slice(0, 31));
    abas++;
  });
  if (!abas) return null;
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
}

async function anexar(ppId, nome, mime, base64, categoria, quem) {
  const b64 = String(base64 || "").replace(/^data:[^,]+,/, "");
  if (!b64) return;
  await prisma.ppAnexo.deleteMany({ where: { ppId, nome } });   // refaz (não duplica se liberar de novo)
  await prisma.ppAnexo.create({ data: { ppId, nome: nome.slice(0, 200), tipo: mime || null, categoria, tamanho: Math.floor(b64.length * 3 / 4), base64: b64, criadoPorNome: quem } });
}

export async function lancarNaProducao(ppId, clienteNome) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: { orderBy: { id: "asc" } } } });
  if (!pp) return { ok: false, erros: ["Pedido não encontrado."] };
  if (pp.efetivadoEm) return { ok: true, numero: pp.numero, jaEstava: true };
  const quem = `PORTAL · ${String(clienteNome || "").toUpperCase()}`.trim();
  const nPortal = pp.portalNumero ? String(pp.portalNumero).padStart(4, "0") : String(pp.id);

  // 1) condição de pagamento e vendedor do último pedido deste cliente já efetivado
  const ant = await prisma.pp.findFirst({ where: { portalClienteId: pp.portalClienteId, efetivadoEm: { not: null }, id: { not: pp.id }, status: { not: "CANCELADO" } },
    orderBy: { efetivadoEm: "desc" }, select: { numero: true, pagamento: true, vendedor: true } });
  const pag = pp.pagamento && (pp.pagamento.parcelas?.length || pp.pagamento.entrada) ? pp.pagamento : condicaoReaproveitavel(ant?.pagamento);
  const total = pp.itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0);
  await prisma.pp.update({ where: { id: pp.id }, data: {
    ...(pag && !pp.pagamento ? { pagamento: pag, condicaoPagamento: textoCondicao(pag, total) || null } : {}),
    ...(!pp.vendedor && ant?.vendedor ? { vendedor: ant.vendedor } : {}) } });

  // 2) anexos: artes do cliente (dos itens) e a personalização exclusiva em Excel
  for (const [k, it] of pp.itens.entries()) {
    for (const a of Array.isArray(it.anexosJson) ? it.anexosJson : []) {
      if (!String(a.nome || "").startsWith(PREF_ARTE)) continue;
      await anexar(pp.id, `Item ${k + 1} · ${String(a.nome).slice(PREF_ARTE.length)}`, a.mime, a.base64, "LAYOUT", quem);
    }
  }
  const xls = planilhaPersonalizacao(pp.itens.map((it) => ({ descricao: it.descricao, codigo: it.codigo, dadosUnitarios: it.dadosUnitarios })),
    `PERSONALIZAÇÃO EXCLUSIVA · ${String(clienteNome || "").toUpperCase()} · PEDIDO DO PORTAL ${nPortal}`);
  if (xls) await anexar(pp.id, `Personalização exclusiva · portal ${nPortal}.xlsx`, XLSX_MIME, xls, "OUTRO", quem);

  // 3) efetiva
  if (!pag) return { ok: false, erros: [ant ? `A condição de pagamento do último pedido (${ant.numero}) tem entrada ou valor fixo e não dá para repetir: monte a condição e efetive.` : "Primeiro pedido do portal deste cliente: monte a condição de pagamento e efetive (os próximos usam a mesma condição)."] };
  try {
    const r = await efetivarPedido(pp.id, quem);
    return r.ok ? { ok: true, numero: r.numero, avisos: r.avisos || [] } : { ok: false, erros: r.erros || ["Não efetivou."] };
  } catch (e) { return { ok: false, erros: [e.message] }; }
}
