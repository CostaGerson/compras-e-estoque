"use client";
// v1006 — tela de lançamento de serviço do PCP: o mesmo editor de pedidos do ERP, só com o tipo "Serviço"
import React, { useState } from "react";
import PedidoEditor from "../pedidoEditor";
import { imprimirPedido } from "../impressaoPedido";
import { alerta } from "../dialogo";
import { COMPONENTES, TAMANHOS } from "@/lib/componentesPedido";

const imprimir = (f, itens, totalPecas, totalGeral, comValores = true) => imprimirPedido(comValores ? "PV" : "PP", f, itens, { componentes: COMPONENTES, alerta });
// só aceita voltar para o PCP (evita link que mande para outro site)
const voltarSeguro = (u) => (/^https:\/\/[a-z0-9.-]*meridianpro\.com\.br(\/|$)/i.test(u || "") ? u : "");

export default function ServicoPcp({ uid, setor, voltarUrl }) {
  const [k, setK] = useState(0);
  const volta = voltarSeguro(voltarUrl);
  return (
    <div style={{ minHeight: "100vh", background: "#F5F6F8", color: "#1F2733" }}>
      <div style={{ background: "#001E41", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 5, height: 22, background: "#FF6B1A", borderRadius: 3 }} />
          <b style={{ fontSize: 17 }}>Lançar serviço · {setor === "SILK" ? "Silk" : "Bordado"}</b>
        </div>
        {volta && <a href={volta} style={{ color: "#AEB6C2", fontSize: 13, textDecoration: "none" }}>← Voltar para a ferramenta</a>}
      </div>
      <div className="p-6">
        <PedidoEditor key={k} ppId={null} somenteServico podeLancar veVal uid={uid} componentes={COMPONENTES} tamanhos={TAMANHOS} imprimir={imprimir}
          onVoltar={() => { if (volta) window.location.href = volta; else setK((x) => x + 1); }} />
      </div>
    </div>
  );
}
