// v615 — impressão do pedido no padrão do modelo (cabeçalho Meridian, caixas de cliente/atendimento, tabela de itens)
//   PP (pedido de produção): sem valores — grade, parâmetros de produção, tecido/FPP e foto de cada item
//   PV (pedido de venda): com valores — preço/peça, subtotais, total e condição de pagamento (entrada e parcelas)
import { parcelasCalc, DOCS_ENTREGA as DOCS, dataBR as dataBRl, somaDias, textoCondicao, textoObsNf, paramFora } from "@/lib/pedidoLanc";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v) => { const s = String(v ?? "").trim(); return (s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s)) || 0; };
const money = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(String(s)) ? String(s).slice(0, 10).split("-").reverse().join("/") : s || "");
const cap = (s) => String(s || "").toLowerCase().replace(/(^|\s|·)\S/g, (m) => m.toUpperCase());
const BASE_TXT = { EMISSAO: "do pedido", NF: "da NF", ENTREGA: "da entrega" };

function tecidoTxt(v) {
  if (!v) return "";
  if (typeof v !== "object") return esc(v);
  return [v.tipo, v.artigo, v.medida, v.forro ? `forro ${v.forro}` : ""].filter(Boolean).map(esc).join(" · ") + (v.fpp ? ` <span class="mut">(FPP ${esc(String(v.fpp).padStart(5, "0"))})</span>` : "");
}

/**
 * @param {"PP"|"PV"} tipo
 * @param f   cabeçalho do pedido (editor): numero, emissao, clienteNome, clienteCnpj, clienteIe, clienteEndereco, clienteContato, oc, vendedor,
 *            prazoEntrega, dtDespacho, tipoPedido, obs, obsNfTexto, entregaModo, entregas, pagamento, servico, interno
 * @param itens [{ tipoPecaNome, codigo, descricao, valorUnitario, grade:[{tam,qtd}], parametros:{}, fotoBase64 }]
 * @param componentes { tipoPeca: [parâmetros] } — ordem dos parâmetros de produção
 */
// v650 — anexos na OP: imagem entra como figura; PDF é desenhado página a página (pdf.js) antes de imprimir
//   a = { nome, mime|tipo, src } (src: data URL ou URL do sistema)
const ehPdf = (a) => /pdf/i.test(a.mime || a.tipo || "") || /\.pdf$/i.test(a.nome || "") || /^data:application\/pdf/.test(a.src || "");
const ehImg = (a) => /^image\//i.test(a.mime || a.tipo || "") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.nome || "") || /^data:image\//.test(a.src || "");
const semCache = (src) => (!src || /^data:/.test(src) ? src : `${src}${src.includes("?") ? "&" : "?"}_t=${Date.now()}`);   // v660
function anexosHtml(lista, titulo) {
  const l = (lista || []).filter((a) => a && a.src).map((a) => ({ ...a, src: semCache(a.src) }));
  if (!l.length) return "";
  return `<div class="anx-bloco">${titulo ? `<div class="anx-t">${esc(titulo)}</div>` : ""}${l.map((a) => ehImg(a)
    ? `<figure class="anx"><img src="${esc(a.src)}"/><figcaption>${esc(a.nome || "")}</figcaption></figure>`
    : ehPdf(a) ? `<figure class="anx"><div class="pdf" data-src="${esc(a.src)}"><span class="mut">carregando ${esc(a.nome || "PDF")}…</span></div><figcaption>${esc(a.nome || "")}</figcaption></figure>`
    : `<div class="mut">Anexo ${esc(a.nome || "")} (formato não imprimível)</div>`).join("")}</div>`;
}

export function imprimirPedido(tipo, f, itens, { componentes = {}, alerta, anexos = [] } = {}) {
  const PV = tipo === "PV";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const servico = !!f.servico || f.tipoPedido === "SERVIÇO";
  const qtdDe = (it) => (it.grade || []).reduce((s, g) => s + n(g.qtd), 0);
  const lista = (itens || []).filter((it) => String(it.descricao || "").trim() || qtdDe(it) > 0);
  const totalPecas = lista.reduce((s, it) => s + qtdDe(it), 0);
  const totalGeral = lista.reduce((s, it) => s + qtdDe(it) * n(it.valorUnitario), 0);
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const numero = f.numero || "—";
  const titulo = PV ? (servico ? "Pedido de serviço" : "Pedido de venda") : "Ordem de produção";

  // ---------- tabela de itens ----------
  const linhas = lista.map((it, i) => {
    const grade = (it.grade || []).filter((g) => n(g.qtd) > 0);
    const tams = servico ? "—" : grade.map((g) => `${esc(g.tam)} ${esc(g.qtd)}`).join(" · ") || "—";
    const tec = it.parametros?.TECIDO;
    const det = servico ? "" : [cap(it.tipoPecaNome), it.codigo ? `cód. ${esc(it.codigo)}` : "", PV && tec ? (typeof tec === "object" ? [tec.tipo, tec.artigo].filter(Boolean).map(esc).join(" · ") : esc(tec)) : ""].filter(Boolean).join(" · ");
    const q = qtdDe(it), vu = n(it.valorUnitario);
    return `<tr>
      <td class="num">${i + 1}</td>
      <td><div class="it">${esc(it.descricao || cap(it.tipoPecaNome) || "—")}</div>${det ? `<div class="sub">${det}</div>` : ""}</td>
      <td class="tam">${tams}</td>
      <td class="r">${q.toLocaleString("pt-BR")}</td>
      ${PV ? `<td class="r">${money(vu)}</td><td class="r b">${money(q * vu)}</td>` : ""}
    </tr>`;
  }).join("");

  // ---------- PP: detalhamento de produção de cada item ----------
  const producao = PV || servico ? "" : lista.map((it, i) => {
    const comps = componentes[it.tipoPecaNome] || [];
    const extras = Object.keys(it.parametros || {}).filter((k) => !comps.includes(k));
    const params = [...comps, ...extras].map((c) => {
      const v = it.parametros?.[c];
      return `<tr><td class="pk">${esc(c)}</td><td>${c === "TECIDO" ? tecidoTxt(v) || "—" : esc(v || "—")}</td></tr>`;
    }).join("");
    const grade = (it.grade || []).filter((g) => n(g.qtd) > 0);
    return `<div class="peca">
      <div class="peca-h"><span class="bd">${i + 1}</span>${esc(it.descricao || cap(it.tipoPecaNome))}<span class="mut"> · ${esc(cap(it.tipoPecaNome))}${it.codigo ? ` · cód. ${esc(it.codigo)}` : ""}</span><span class="q">${qtdDe(it).toLocaleString("pt-BR")} pç</span></div>
      <div class="peca-b">
        ${it.fotoBase64 ? `<img class="foto" src="${it.fotoBase64}"/>` : `<div class="foto vz">sem layout</div>`}
        <div class="peca-i">
          <table class="grade"><tr>${grade.map((g) => `<th>${esc(g.tam)}</th>`).join("") || "<th>—</th>"}<th class="tt">TOTAL</th></tr>
            <tr>${grade.map((g) => `<td>${esc(g.qtd)}</td>`).join("") || "<td>—</td>"}<td class="tt">${qtdDe(it).toLocaleString("pt-BR")}</td></tr></table>
          <table class="params">${params || `<tr><td class="pk">Parâmetros</td><td>—</td></tr>`}</table>
        </div>
      </div>
      ${anexosHtml((it.anexos || []).map((a) => ({ ...a, src: a.src || a.base64 })), "Arquivos do item")}
    </div>`;
  }).join("");

  // ---------- PV: condição de pagamento ----------
  let pagHtml = "";
  if (PV && !f.interno) {
    const c = parcelasCalc(f.pagamento, totalGeral, { emissao: f.emissao });
    const ls = [];
    if (c.entrada) ls.push(`<tr><td>Entrada</td><td>${dBR(c.entrada.data) || "—"}</td><td class="r">${money(c.entrada.valor)}</td></tr>`);
    for (const x of c.parcelas) ls.push(`<tr><td>Parcela ${x.n}/${x.de}</td><td>${x.dias} dias ${x.tipo === "UTEIS" ? "úteis" : "corridos"} ${BASE_TXT[x.base] || ""}${x.data ? ` · ${dBR(x.data)}` : ""}</td><td class="r">${money(x.valor)}</td></tr>`);
    if (ls.length) pagHtml = `<div class="sec">Condição de pagamento</div><table class="pag">${ls.join("")}</table>`;
  }

  // ---------- entrega ----------
  const entregas = f.entregaModo && f.entregaModo !== "UNICA" && Array.isArray(f.entregas) && f.entregas.length
    ? `<div class="sec">${f.entregaModo === "TERCEIROS" ? "Entrega com terceiros" : "Entrega fracionada"}</div>
      <table class="pag">${f.entregas.map((e, k) => `<tr><td class="b">${k + 1}. ${esc(e.local || "—")}</td><td>${esc(e.endereco || "—")}${e.responsavel ? ` · resp. ${esc(e.responsavel)}` : ""}${e.contato ? ` · ${esc(e.contato)}` : ""}${e.documento ? `<div class="mut">${esc(DOCS[e.documento] || e.documento)}</div>` : ""}</td></tr>`).join("")}</table>` : "";

  const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${PV ? "PV" : "OP"} ${esc(numero)} · Meridian</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm 13mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Montserrat', Arial, sans-serif; color: #1F2733; margin: 0; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #001E41; padding-bottom: 9px; }
  .marca img { height: 26px; display: block; }
  .marca .t { font-weight: 800; letter-spacing: 6px; font-size: 24px; color: #001E41; }
  .marca .s { color: #667085; font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 5px; }
  .doc { text-align: right; }
  .doc .k { color: #FF6B1A; font-weight: 700; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }
  .doc .n { color: #001E41; font-weight: 800; font-size: 22px; line-height: 1.15; }
  .doc .d { color: #667085; font-size: 9.5px; }
  .caixas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0 12px; }
  .cx { background: #EEF3FB; border-radius: 6px; padding: 9px 11px; }
  .cx .h { color: #2E5C9A; font-weight: 700; font-size: 8.5px; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 4px; }
  .cx .nm { font-weight: 800; font-size: 12.5px; color: #001E41; margin-bottom: 2px; }
  .cx div { line-height: 1.45; }
  .mut { color: #667085; font-weight: 400; }
  table.itens { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.itens th { text-align: left; color: #2E5C9A; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; padding: 6px 6px; border-bottom: 2px solid #001E41; }
  table.itens td { padding: 7px 6px; border-bottom: 1px solid #E4E7EC; vertical-align: top; }
  table.itens .num { width: 22px; color: #667085; }
  table.itens .it { font-weight: 700; color: #001E41; }
  table.itens .sub { color: #667085; font-size: 10px; margin-top: 1px; }
  table.itens .tam { font-size: 10px; max-width: 190px; }
  .r { text-align: right; white-space: nowrap; } .b { font-weight: 700; }
  th.r { text-align: right; }
  .tot { display: flex; justify-content: flex-end; margin-top: 10px; }
  .tot table { width: 270px; border-collapse: collapse; }
  .tot td { padding: 5px 4px; }
  .tot tr.g td { border-top: 1px solid #1F2733; border-bottom: 1px solid #E4E7EC; padding: 8px 4px; }
  .tot tr.g td.v { font-size: 17px; font-weight: 800; color: #001E41; }
  .sec { color: #2E5C9A; font-weight: 700; font-size: 8.5px; letter-spacing: 1.2px; text-transform: uppercase; margin: 14px 0 5px; }
  table.pag { width: 100%; border-collapse: collapse; }
  table.pag td { padding: 4px 6px; border-bottom: 1px solid #EEF0F3; vertical-align: top; }
  .notas { margin-top: 14px; border-top: 1px solid #E4E7EC; padding-top: 8px; font-size: 10px; line-height: 1.55; }
  .peca { border: 1px solid #E4E7EC; border-radius: 6px; margin-bottom: 9px; overflow: hidden; page-break-inside: avoid; }
  .peca-h { background: #F5F7FB; border-bottom: 1px solid #E4E7EC; padding: 6px 9px; font-weight: 700; color: #001E41; display: flex; align-items: center; gap: 6px; }
  .peca-h .bd { background: #001E41; color: #fff; border-radius: 50%; width: 17px; height: 17px; display: inline-flex; align-items: center; justify-content: center; font-size: 9.5px; }
  .peca-h .q { margin-left: auto; color: #FF6B1A; }
  .peca-b { display: flex; gap: 10px; padding: 9px; }
  .foto { width: 125px; height: 125px; object-fit: cover; border-radius: 5px; border: 1px solid #E4E7EC; flex-shrink: 0; }
  .foto.vz { display: flex; align-items: center; justify-content: center; color: #98A2B3; font-size: 9.5px; }
  .peca-i { flex: 1; min-width: 0; }
  table.grade { border-collapse: collapse; margin-bottom: 7px; }
  table.grade th, table.grade td { border: 1px solid #D5DBE5; padding: 3px 8px; text-align: center; font-size: 10.5px; }
  table.grade th { background: #001E41; color: #fff; font-size: 9.5px; }
  table.grade .tt { background: #FFF0E6; color: #C2410C; font-weight: 700; }
  table.grade th.tt { background: #FF6B1A; color: #fff; }
  table.params { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.params td { border: 1px solid #EEF0F3; padding: 3px 6px; }
  table.params td.pk { color: #667085; width: 34%; text-transform: uppercase; font-size: 9px; }
  .rod { margin-top: 16px; display: flex; justify-content: space-between; color: #98A2B3; font-size: 8.5px; border-top: 1px solid #E4E7EC; padding-top: 5px; }
</style></head><body>
  <div class="top">
    <div class="marca">
      <img src="${origin}/meridian-wordmark.svg" onerror="this.outerHTML='<div class=&quot;t&quot;>MERIDIAN</div>'"/>
      <div class="s">Meridian Ltda · CNPJ 48.011.287/0001-81</div>
      <div class="s" style="margin-top:2px">R. Dr. Natalino Triginelli, 281 · Jardim Atlântico · Belo Horizonte/MG · CEP 31710-420</div>
    </div>
    <div class="doc"><div class="k">${titulo}</div><div class="n">Nº ${esc(numero)}</div><div class="d">Emissão ${dBR(f.emissao) || "—"}</div></div>
  </div>

  <div class="caixas">
    <div class="cx"><div class="h">Cliente</div>
      <div class="nm">${esc(f.clienteNome || "—")}</div>
      ${f.clienteCnpj ? `<div>CNPJ/CPF ${esc(f.clienteCnpj)}${f.clienteIe ? ` · IE ${esc(f.clienteIe)}` : ""}</div>` : ""}
      ${f.clienteEndereco ? `<div>${esc(f.clienteEndereco)}</div>` : ""}
      ${f.clienteContato ? `<div>${esc(f.clienteContato)}</div>` : ""}
    </div>
    <div class="cx"><div class="h">Atendimento</div>
      <div>Vendedor: <b>${esc(f.vendedor || "—")}</b></div>
      <div>Prazo: <b>${esc(f.prazoEntrega || "—")}</b>${f.dtDespacho ? ` · despacho <b>${esc(f.dtDespacho)}</b>` : ""}</div>
      ${f.oc ? `<div>OC do cliente: <b>${esc(f.oc)}</b></div>` : ""}
      <div>Tipo: ${esc(cap(f.tipoPedido || (servico ? "serviço" : "venda normal")))}</div>
    </div>
  </div>

  <table class="itens">
    <tr><th>#</th><th>${servico ? "Serviço" : "Item"}</th><th>${servico ? "" : "Tamanhos"}</th><th class="r">Qtd</th>${PV ? `<th class="r">${servico ? "Valor unit." : "Preço/pç"}</th><th class="r">Subtotal</th>` : ""}</tr>
    ${linhas || `<tr><td colspan="6" class="mut">Nenhum item.</td></tr>`}
  </table>

  <div class="tot"><table>
    <tr><td class="mut">${servico ? "Quantidade total" : "Total de peças"}</td><td class="r b">${totalPecas.toLocaleString("pt-BR")}</td></tr>
    ${PV ? `<tr class="g"><td class="b">Total</td><td class="r v">${money(totalGeral)}</td></tr>` : ""}
  </table></div>

  ${pagHtml}
  ${entregas}
  ${producao ? `<div class="sec">Detalhamento de produção</div>${producao}` : ""}

  ${f.obs || (PV && f.obsNfTexto) ? `<div class="notas">
    ${f.obs ? `<div><b>Observações:</b> ${esc(f.obs).replace(/\n/g, "<br/>")}</div>` : ""}
    ${PV && f.obsNfTexto ? `<div><b>Dados para a NF:</b> ${esc(f.obsNfTexto)}</div>` : ""}
  </div>` : ""}

  ${!PV && (anexos || []).length ? `<div class="sec">Anexos do pedido</div>${anexosHtml(anexos)}` : ""}

  <div class="rod"><span>${PV ? "Pedido de venda" : "Ordem de produção — documento interno, sem valores"} · Meridian</span><span>Impresso em ${agora}</span></div>
  <style>
    .anx-bloco { margin-top: 8px; } .anx-t { font-weight: 700; font-size: 10px; text-transform: uppercase; color: #667085; margin: 6px 0 4px; letter-spacing: .4px; }
    figure.anx { margin: 0 0 8px; break-inside: avoid; page-break-inside: avoid; } figure.anx img { max-width: 100%; max-height: 250mm; display: block; border: 1px solid #E4E7EC; }
    figure.anx figcaption { font-size: 9px; color: #667085; margin-top: 2px; } .pdf img { margin-bottom: 4px; }
  </style>
  <script>
    window.__pdfPend = document.querySelectorAll(".pdf[data-src]").length;
    window.onload = function () {
      var t0 = Date.now();
      (function esperar() {
        var imgs = Array.prototype.every.call(document.images, function (i) { return i.complete; });
        if ((window.__pdfPend <= 0 && imgs) || Date.now() - t0 > 20000) setTimeout(function () { window.print(); }, 300); else setTimeout(esperar, 200);
      })();
    };
  </script>
  <script type="module">
    const els = [...document.querySelectorAll(".pdf[data-src]")];
    if (els.length) {
      try {
        const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";
        for (const el of els) {
          try {
            const src = el.dataset.src;
            const data = src.startsWith("data:") ? Uint8Array.from(atob(src.split(",")[1]), (c) => c.charCodeAt(0)) : new Uint8Array(await (await fetch(src)).arrayBuffer());
            const doc = await pdfjs.getDocument({ data }).promise;
            el.innerHTML = "";
            for (let p = 1; p <= Math.min(doc.numPages, 30); p++) {
              const pg = await doc.getPage(p); const vp = pg.getViewport({ scale: 1.6 });
              const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
              await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
              const img = document.createElement("img"); img.src = cv.toDataURL("image/jpeg", 0.85); el.appendChild(img);
            }
          } catch (e) { el.innerHTML = '<span class="mut">Não consegui desenhar este PDF.</span>'; }
          window.__pdfPend--;
        }
      } catch (e) { els.forEach((el) => { el.innerHTML = '<span class="mut">Não consegui carregar o leitor de PDF (sem internet?).</span>'; }); window.__pdfPend = 0; }
    }
  </script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { (alerta || window.alert)("Permita pop-ups para imprimir o pedido."); return; }
  w.document.write(html); w.document.close();
}

// v638 — monta cabeçalho e itens da impressão a partir do lançamento gravado (GET /api/pp/:id), como o editor faz
//   usado no card do pedido em Produção › Gestão (Imprimir PV / Imprimir OP)
export function dadosImpressaoPp(d, veVal = true) {
  const js = (v, def) => { try { return v ? JSON.parse(v) : def; } catch { return def; } };
  const servico = d.tipoPedido === "SERVIÇO";
  const itens = (d.itens || []).map((it) => {
    const grade = js(it.gradeJson, []);
    const base = { tipoPecaNome: it.tipoPecaNome || "", codigo: it.codigo || "", descricao: it.descricao || "", valorUnitario: it.valorUnitario != null ? String(it.valorUnitario) : "",
      parametros: Object.fromEntries(Object.entries(js(it.parametrosJson, {})).filter(([k, v]) => v && !paramFora(k))), fotoBase64: it.fotoBase64 || "",
      anexos: Array.isArray(it.anexosJson) ? it.anexosJson : [] };
    return servico ? { ...base, grade: [{ tam: "UN", qtd: grade.reduce((q, g) => q + (n(g.qtd) || 0), 0) }] } : { ...base, grade };
  });
  const total = itens.reduce((s, it) => s + (it.grade || []).reduce((q, g) => q + n(g.qtd), 0) * n(it.valorUnitario), 0);
  const emissao = d.emissao || (d.createdAt ? String(d.createdAt).slice(0, 10) : "");
  const despacho = d.prazoDias != null && emissao ? somaDias(emissao, Number(d.prazoDias), d.prazoTipo || "UTEIS") : null;
  const entregas = Array.isArray(d.entregas) ? d.entregas : [];
  const f = {
    ...d, emissao, servico, interno: !!d.interno, valorTotal: total, dtDespacho: despacho ? dataBRl(despacho) : d.dtDespacho || "",
    prazoEntrega: d.prazoDias != null ? `${d.prazoDias} dias ${d.prazoTipo === "UTEIS" ? "úteis" : "corridos"}` : d.prazoEntrega || "",
    condicaoPagamento: d.interno ? "INTERNO" : veVal ? (d.pagamento ? textoCondicao(d.pagamento, total) : d.condicaoPagamento || "") : "",
    tipoPedido: servico ? "SERVIÇO" : d.interno ? "INTERNO" : "VENDA NORMAL", obsNfTexto: textoObsNf({ numero: d.numero, oc: d.oc, nfObs: d.nfObs }),
    entregasTexto: (d.entregaModo || "UNICA") === "UNICA" ? "" : entregas.map((e, k) => `${k + 1}. ${e.local || "—"} · ${e.endereco || "—"} · resp. ${e.responsavel || "—"} ${e.contato || ""} · ${DOCS[e.documento] || "—"}`).join("\n"),
  };
  return { f, itens };
}

// v638 — pedido que não tem lançamento no sistema (veio do KM): imprime com os dados do pedido de venda
export function dadosImpressaoPedido(p) {
  const servico = p.tipoPedido === "SERVIÇO";
  const itens = (p.itens || []).map((i) => ({ tipoPecaNome: i.tipoPeca || "", codigo: i.codigo || "", descricao: i.descricao || "", valorUnitario: i.preco != null ? String(i.preco) : "",
    grade: servico || !(i.grade || []).length ? [{ tam: "UN", qtd: i.qtd }] : i.grade, parametros: Object.fromEntries((i.parametros || []).map((x) => [x.t, x.v])), fotoBase64: i.foto || "" }));
  const f = { numero: p.numero, emissao: p.emissao, clienteNome: p.cliente, oc: p.oc, vendedor: p.vendedor, dtDespacho: p.prazo ? dataBRl(p.prazo) : "", servico,
    tipoPedido: p.tipoPedido || "VENDA NORMAL", condicaoPagamento: p.condicao || "", obs: p.obs || "", obsNfTexto: p.nfObs || "", valorTotal: p.total };
  return { f, itens };
}
