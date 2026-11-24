"use client";
// v1089 — botões OP · PV · FPP do pedido de origem de um item de compra (PIC, cotação, OC). Tudo abre em nova guia.
import React from "react";
import { imprimirPedido, dadosImpressaoPp, dadosImpressaoPedido } from "./impressaoPedido";
import { COMPONENTES } from "@/lib/componentesPedido";
import { alerta } from "./dialogo";

const aguarde = (w, t) => { try { w.document.write(`<p style="font-family:Arial;color:#667085;padding:24px">${t}</p>`); } catch {} };
const falha = (w, m) => { try { w.document.open(); w.document.write(`<p style="font-family:Arial;color:#D92D20;padding:24px">${m}</p>`); w.document.close(); } catch {} };

// OP (sem valores) ou PV (com valores) do pedido: PDF do KM quando veio de lá; senão o mesmo layout da Produção
export async function abrirDocPedido(tipo, numero, user) {
  const w = window.open("", "_blank");
  if (!w) return alerta("Permita pop-ups para abrir em nova guia.");
  aguarde(w, `Abrindo ${tipo === "PV" ? "o PV" : "a OP"} do pedido ${numero}…`);
  try {
    const p = await fetch(`/api/producao/gestao?numero=${encodeURIComponent(numero)}`, { cache: "no-store" }).then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "Pedido não encontrado."); return x; });
    const arq = tipo === "PV" ? "arquivoPedidoPdf" : "arquivoOpPdf";
    const temPdf = tipo === "PV" ? p.pp?.temPv : p.pp?.temOp;
    if (p.pp && p.pp.origem === "PEDIDOS" && temPdf) { w.location.href = `/api/pp/${p.pp.id}?arquivo=${arq}&_u=${user?.id}`; return; }
    if (p.pp && p.pp.origem !== "PEDIDOS") {
      const d = await fetch(`/api/pp/${p.pp.id}`, { cache: "no-store", headers: { "x-usuario-id": String(user?.id || "") } }).then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "Sem acesso ao pedido."); return x; });
      const { f, itens } = dadosImpressaoPp(d, tipo === "PV");
      const anexos = (d.anexos || []).filter((a) => a.categoria !== "NF_CLIENTE").map((a) => ({ nome: a.nome, mime: a.tipo, src: `/api/pp/${p.pp.id}?anexo=${a.id}&_u=${user?.id}` }));
      imprimirPedido(tipo, f, itens, { componentes: COMPONENTES, alerta, anexos, janela: w });
    } else {
      const { f, itens } = dadosImpressaoPedido(p);
      imprimirPedido(tipo, f, itens, { componentes: COMPONENTES, alerta, janela: w });
    }
  } catch (e) { falha(w, e.message); }
}
// FPP do item do pedido (pela demanda de compra do item) → abre a FPP no ERP em nova guia
export async function abrirFppOrigem(pedido, chave) {
  const w = window.open("", "_blank");
  if (!w) return alerta("Permita pop-ups para abrir em nova guia.");
  aguarde(w, "Abrindo a FPP…");
  try {
    const r = await fetch(`/api/compras/origem-fpp?pedido=${encodeURIComponent(pedido)}&chave=${encodeURIComponent(chave || "")}`, { cache: "no-store" }).then((x) => x.json());
    if (!r.id) throw new Error(r.error || "Este item do pedido não tem FPP indexada.");
    w.location.href = `/?v=fpp&id=${r.id}`;
  } catch (e) { falha(w, e.message); }
}

// l: origens [{ pedido, chave, avulsa? }]
export default function DocsOrigem({ l, user }) {
  const ps = [];
  for (const o of Array.isArray(l) ? l : []) if (o && o.pedido && !o.avulsa && !/^AV\d+$/.test(String(o.pedido)) && !ps.some((x) => x.pedido === o.pedido)) ps.push(o);
  if (!ps.length) return null;
  const b = (t, fn, title) => <button type="button" onClick={(e) => { e.stopPropagation(); fn(); }} title={title} className="px-1.5 rounded font-semibold" style={{ border: "1px solid #E4E7EC", color: "#2E7CD6", background: "#fff" }}>{t}</button>;
  return (
    <div className="text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
      {ps.slice(0, 6).map((o) => (
        <span key={o.pedido} className="inline-flex items-center gap-1" style={{ color: "#667085" }}>{ps.length > 1 ? `${o.pedido}:` : ""}
          {b("OP", () => abrirDocPedido("PP", o.pedido, user), `Ordem de produção do pedido ${o.pedido} (nova guia)`)}
          {b("PV", () => abrirDocPedido("PV", o.pedido, user), `Pedido de venda ${o.pedido} (nova guia)`)}
          {b("FPP", () => abrirFppOrigem(o.pedido, o.chave), `FPP do item no pedido ${o.pedido} (nova guia)`)}
        </span>
      ))}
      {ps.length > 6 && <span style={{ color: "#667085" }}>+{ps.length - 6} pedido(s)</span>}
    </div>
  );
}
