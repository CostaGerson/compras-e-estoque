// v692 — FPP em PDF no padrão do PV (cabeçalho Meridian, caixas de cliente/item, seções em tabela, totais e condição de pagamento).
//   Abre a janela de impressão: "Salvar como PDF" no navegador. Várias FPPs saem no mesmo documento, uma por página.
//   doc = { numero, emissao, cliente, negociacao, item, nomeComercial, tipo, qtde, leadTime, criadoPor,
//           secoes: [{ titulo, linhas: [[rótulo, valor]] }], custos: [[rótulo, R$/pç, forte?]] | null,
//           totais: [[rótulo, valor, grande?]] | null, pagamento: [[parcela, descrição, %, R$]], anexos: [{ nome, src }] }

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// abre a janela já no clique (evita bloqueio de pop-up); o conteúdo é escrito depois
export function abrirJanelaFpp(alerta) {
  const w = window.open("", "_blank");
  if (!w) { (alerta || window.alert)("Permita pop-ups para gerar o PDF da FPP."); return null; }
  w.document.write("<p style='font-family:Arial;color:#667085;padding:20px'>Gerando a FPP…</p>");
  return w;
}

function paginaFpp(d) {
  const secoes = (d.secoes || []).filter((s) => (s.linhas || []).length).map((s) => `<div class="bl">
    <div class="sec">${esc(s.titulo)}</div>
    <table class="params">${s.linhas.map(([k, v]) => `<tr><td class="pk">${esc(k)}</td><td>${esc(v == null || v === "" ? "—" : v)}</td></tr>`).join("")}</table></div>`).join("");
  const custos = d.custos ? `
    <div class="sec">Composição de custo</div>
    <table class="itens"><tr><th>Item de custo</th><th class="r">R$/peça</th><th class="r">Total (${esc(d.qtde || 0)} pç)</th></tr>
      ${d.custos.map(([k, v, forte]) => `<tr${forte ? ' class="fr"' : ""}><td>${esc(k)}</td><td class="r">${esc(v[0])}</td><td class="r">${esc(v[1])}</td></tr>`).join("")}
    </table>` : "";
  const totais = d.totais ? `<div class="tot"><div class="sec">Resultado</div><table>${d.totais.map(([k, v, g]) => g
    ? `<tr class="g"><td class="b">${esc(k)}</td><td class="r v">${esc(v)}</td></tr>`
    : `<tr><td class="mut">${esc(k)}</td><td class="r b">${esc(v)}</td></tr>`).join("")}</table></div>` : "";
  const pag = (d.pagamento || []).length ? `
    <div class="pgto"><div class="sec">Condição de pagamento</div>
    <table class="pag">${d.pagamento.map(([a, b, c, v]) => `<tr><td class="b">${esc(a)}</td><td>${esc(b)}</td><td class="r">${esc(c)}</td><td class="r">${esc(v || "")}</td></tr>`).join("")}</table></div>` : "";
  const anexos = (d.anexos || []).length ? `<div class="sec">Anexos</div>${d.anexos.map((a) => `<figure class="anx"><img src="${esc(a.src)}"/><figcaption>${esc(a.nome || "")}</figcaption></figure>`).join("")}` : "";
  return `<div class="pg">
  <div class="top">
    <div class="marca">
      <img src="${typeof window !== "undefined" ? window.location.origin : ""}/meridian-wordmark.svg" onerror="this.outerHTML='<div class=&quot;t&quot;>MERIDIAN</div>'"/>
      <div class="s">Meridian Ltda · CNPJ 48.011.287/0001-81</div>
      <div class="s" style="margin-top:2px">R. Dr. Natalino Triginelli, 281 · Jardim Atlântico · Belo Horizonte/MG · CEP 31710-420</div>
    </div>
    <div class="doc"><div class="k">Ficha de precificação</div><div class="n">FPP ${esc(d.numero || "—")}</div><div class="d">Emissão ${esc(d.emissao || "—")}</div></div>
  </div>
  <div class="caixas">
    <div class="cx"><div class="h">Cliente</div>
      <div class="nm">${esc(d.cliente || "—")}</div>
      <div>Negociação: <b>${esc(d.negociacao || "—")}</b></div>
      <div>Condição: <b>${esc(d.condicao || "—")}</b></div>
    </div>
    <div class="cx"><div class="h">Item</div>
      <div class="nm">${esc(d.nomeComercial || d.item || "—")}</div>
      <div>${esc(d.item || "—")} · ${esc(d.tipo || "")}</div>
      <div>Qtde: <b>${esc(d.qtde || "—")} pç</b> · Lead time: <b>${d.leadTime ? esc(d.leadTime) + " dias" : "—"}</b></div>
    </div>
  </div>
  <div class="secs">${secoes}</div>
  ${custos}
  <div class="fim">${pag || "<div></div>"}${totais}</div>
  ${anexos}
  <div class="rod"><span>FPP criada por ${esc(d.criadoPor || "—")} · Meridian</span><span>Impresso em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>
</div>`;
}

export function imprimirFpps(w, docs) {
  if (!w) return;
  const titulo = docs.length === 1 ? `FPP ${docs[0].numero || ""} · ${docs[0].nomeComercial || docs[0].item || ""}` : `FPPs (${docs.length}) · Meridian`;
  const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm 13mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Montserrat', Arial, sans-serif; color: #1F2733; margin: 0; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg + .pg { page-break-before: always; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #001E41; padding-bottom: 9px; }
  .marca img { height: 26px; display: block; }
  .marca .t { font-weight: 800; letter-spacing: 6px; font-size: 24px; color: #001E41; }
  .marca .s { color: #667085; font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 5px; }
  .doc { text-align: right; }
  .doc .k { color: #FF6B1A; font-weight: 700; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }
  .doc .n { color: #001E41; font-weight: 800; font-size: 22px; line-height: 1.15; }
  .doc .d { color: #667085; font-size: 9.5px; }
  .caixas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0 6px; }
  .cx { background: #EEF3FB; border-radius: 6px; padding: 9px 11px; }
  .cx .h { color: #2E5C9A; font-weight: 700; font-size: 8.5px; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 4px; }
  .cx .nm { font-weight: 800; font-size: 12.5px; color: #001E41; margin-bottom: 2px; }
  .cx div { line-height: 1.45; }
  .mut { color: #667085; font-weight: 400; }
  .r { text-align: right; white-space: nowrap; } .b { font-weight: 700; }
  .sec { color: #2E5C9A; font-weight: 700; font-size: 8.5px; letter-spacing: 1.2px; text-transform: uppercase; margin: 12px 0 5px; }
  table.params { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.params td { border: 1px solid #EEF0F3; padding: 3px 6px; }
  table.params td.pk { color: #667085; width: 44%; text-transform: uppercase; font-size: 9px; }
  table.itens { width: 100%; border-collapse: collapse; }
  table.itens th { text-align: left; color: #2E5C9A; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; padding: 5px 6px; border-bottom: 2px solid #001E41; }
  table.itens th.r { text-align: right; }
  table.itens td { padding: 4px 6px; border-bottom: 1px solid #E4E7EC; }
  table.itens tr.fr td { font-weight: 700; color: #001E41; background: #F5F7FB; }
  .secs { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; }
  .bl { break-inside: avoid; }
  .fim { display: grid; grid-template-columns: 1fr 280px; gap: 18px; align-items: start; break-inside: avoid; }
  .tot table { width: 100%; border-collapse: collapse; }
  .tot td { padding: 5px 4px; }
  .tot tr.g td { border-top: 1px solid #1F2733; border-bottom: 1px solid #E4E7EC; padding: 8px 4px; }
  .tot tr.g td.v { font-size: 17px; font-weight: 800; color: #001E41; }
  table.pag { width: 100%; border-collapse: collapse; }
  table.pag td { padding: 4px 6px; border-bottom: 1px solid #EEF0F3; vertical-align: top; }
  figure.anx { margin: 0 0 8px; break-inside: avoid; page-break-inside: avoid; } figure.anx img { max-width: 100%; max-height: 200mm; display: block; border: 1px solid #E4E7EC; }
  figure.anx figcaption { font-size: 9px; color: #667085; margin-top: 2px; }
  .rod { margin-top: 16px; display: flex; justify-content: space-between; color: #98A2B3; font-size: 8.5px; border-top: 1px solid #E4E7EC; padding-top: 5px; }
</style></head><body>
${docs.map(paginaFpp).join("")}
<script>
  window.onload = function () {
    var t0 = Date.now();
    (function esperar() {
      var ok = Array.prototype.every.call(document.images, function (i) { return i.complete; });
      if (ok || Date.now() - t0 > 15000) setTimeout(function () { window.print(); }, 300); else setTimeout(esperar, 200);
    })();
  };
</script>
</body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}
