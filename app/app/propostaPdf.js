// v848 — Proposta comercial no padrão da proposta do CRM, gerada pelo próprio sistema a partir das FPPs:
//   capa · marcas · proposta (tabela) · uma página por item com os anexos da FPP · condições comerciais (pelo pagamento lançado) · dados cadastrais.
//   Abre numa janela e chama a impressão (salvar como PDF, A4 paisagem).
"use client";

const ESC = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const R$ = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const N = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const PCT = (x) => `${(Math.round((Number(x) || 0) * 1000) / 10).toLocaleString("pt-BR")}%`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataExtenso = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

const MARCAS = Array.from({ length: 19 }, (_, i) => `/proposta/logo-${String(i + 1).padStart(2, "0")}.png`);
// v850 — a 3ª marca é a TERRAÇO (logo enviada pelo Igor)
// v852 — varejo/alimentos (Verdemar, Super Nosso, Porto Alegre, Verde Campo, Friboi) logo depois do Mart Minas
const VAREJO = ["verdemar", "supernosso", "portoalegre", "verdecampo", "friboi"].map((n) => `/proposta/logo-${n}.png`);
const GRADE_MARCAS = [MARCAS[0], MARCAS[1], "/proposta/logo-terraco.png", ...MARCAS.slice(2, 11), ...VAREJO, ...MARCAS.slice(11)];

const blobParaDataUrl = (b) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(b); });

// pdf.js (CDN) para mostrar as páginas dos anexos em PDF como imagem
let _pdfjs = null;
function carregarPdfJs() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = new Promise((ok) => {
    if (window.pdfjsLib) return ok(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch {} ok(window.pdfjsLib || null); };
    s.onerror = () => ok(null);
    document.head.appendChild(s);
  });
  return _pdfjs;
}
async function paginasDoPdf(blob, max = 2) {
  const lib = await carregarPdfJs();
  if (!lib) return [];
  try {
    const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    const out = [];
    for (let p = 1; p <= Math.min(max, doc.numPages); p++) {
      const pg = await doc.getPage(p);
      const vp = pg.getViewport({ scale: 2 });
      const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: cx, viewport: vp }).promise;
      out.push(cv.toDataURL("image/jpeg", 0.88));
    }
    return out;
  } catch { return []; }
}

// v854 — padrão de todo layout: fundo cinza em gradiente + etiqueta MERIDIAN embaixo; fundo branco do arquivo some (multiply)
function fundoBranco(src) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      try {
        const n = 48, cv = document.createElement("canvas"); cv.width = n; cv.height = n;
        const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, n, n);
        const px = cx.getImageData(0, 0, n, n).data;
        let tot = 0, br = 0;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          if (x > 1 && x < n - 2 && y > 1 && y < n - 2) continue;   // só a moldura de 2 px
          const i = (y * n + x) * 4; tot++;
          if (px[i + 3] < 20 || (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235)) br++;
        }
        ok(br / tot >= 0.85);
      } catch { ok(false); }
    };
    im.onerror = () => ok(false);
    im.src = src;
  });
}

// anexos gerais + arquivos das estampas da FPP → imagens (PDF vira as primeiras páginas); outros tipos só pelo nome
async function anexosDaFpp(fppId) {
  if (!fppId) return { imgs: [], outros: [] };
  const lista = async (q) => fetch(`/api/fpp/${fppId}/anexos${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => []);
  const todos = [...(await lista("")), ...(await lista("?aplicacao=todas"))].filter((a) => a && a.id);
  const imgs = [], outros = [];
  for (const a of todos) {
    const tipo = String(a.mime || "").toLowerCase(), nome = String(a.nome || "");
    const ehImg = tipo.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nome);
    const ehPdf = tipo === "application/pdf" || /\.pdf$/i.test(nome);
    if (!ehImg && !ehPdf) { outros.push(nome); continue; }
    const blob = await fetch(`/api/fpp/${fppId}/anexos?arquivo=${a.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    if (!blob) { outros.push(nome); continue; }
    if (ehImg) { const u = await blobParaDataUrl(blob); if (u) imgs.push({ src: u, nome, branco: await fundoBranco(u) }); else outros.push(nome); }
    else { const ps = await paginasDoPdf(blob); if (ps.length) for (const [k, src] of ps.entries()) imgs.push({ src, nome: ps.length > 1 ? `${nome} · pág. ${k + 1}` : nome, branco: await fundoBranco(src) }); else outros.push(nome); }
  }
  return { imgs, outros };
}

const CSS = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Montserrat', Arial, sans-serif; color: #1B2A45; background: #888; text-transform: uppercase; }
.min { text-transform: none; }   /* e-mail, site e @ ficam como são */
.pg { width: 297mm; height: 210mm; position: relative; overflow: hidden; background: #E8ECF2; page-break-after: always; break-after: page; margin: 0 auto; }
.pg:last-child { page-break-after: auto; break-after: auto; }
@media screen { .pg { margin: 10px auto; box-shadow: 0 2px 12px rgba(0,0,0,.25); } }
.topo { position: absolute; top: 0; left: 0; right: 0; height: 2mm; background: #FF6B1A; }
.base { position: absolute; bottom: 0; left: 0; right: 0; height: 1.6mm; background: #1B2A45; }
.wm { position: absolute; opacity: .07; pointer-events: none; }
.logo { position: absolute; top: 9mm; left: 9mm; display: flex; align-items: center; gap: 3mm; font-weight: 800; letter-spacing: 1.6mm; font-size: 13pt; color: #1B2A45; }
.logo img { width: 10mm; height: 10mm; }
.num { position: absolute; bottom: 5mm; right: 9mm; font-size: 8pt; color: #6B7A90; letter-spacing: .3mm; }
.cont { position: absolute; top: 22mm; left: 15mm; right: 15mm; bottom: 12mm; }
.barra { background: #1B2A45; color: #fff; border-radius: 3mm; padding: 4mm 7mm; font-weight: 800; font-size: 19pt; letter-spacing: .2mm; }
.barra b, .lar { color: #FF6B1A; }
.sub { font-size: 8.5pt; color: #6B7A90; margin: 3mm 0 4mm; }
.sub b { color: #1B2A45; }
table.it { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9pt; }
table.it th { background: #1B2A45; color: #fff; font-size: 7pt; font-weight: 700; letter-spacing: .3mm; text-transform: uppercase; padding: 2.6mm 3mm; text-align: left; vertical-align: middle; }
table.it th.r, table.it td.r { text-align: right; } table.it th.c, table.it td.c { text-align: center; }
table.it th:first-child { border-radius: 2mm 0 0 2mm; } table.it th:last-child { border-radius: 0 2mm 2mm 0; }
table.it td { padding: 2.8mm 3mm; border-bottom: .3mm solid #D3D9E2; vertical-align: middle; }
table.it tr.lay td { padding: 0 3mm 3mm; }
.r { text-align: right; } .c { text-align: center; }
.card { background: #fff; border: .3mm solid #D3D9E2; border-radius: 3mm; }
.rot { font-size: 6.5pt; font-weight: 700; letter-spacing: .4mm; text-transform: uppercase; color: #6B7A90; }
.marcas { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3.2mm; margin-top: 5mm; }
.marcas div { height: 17.5mm; display: flex; align-items: center; justify-content: center; padding: 2.5mm 4mm; }
.marcas img { max-width: 100%; max-height: 100%; object-fit: contain; }
.anx { display: grid; gap: 4mm; }
.anx figure { margin: 0; display: flex; flex-direction: column; min-height: 0; }
.anx .im { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 2mm; }
.anx img { max-width: 100%; max-height: 100%; object-fit: contain; }
.anx .im.padrao { position: relative; background: linear-gradient(160deg, #F4F5F7 0%, #DCE0E6 55%, #BFC5CE 100%); padding: 3mm 3mm 14mm; border-color: #C9CED6; overflow: hidden; }
.anx .im.branco img.lay { mix-blend-mode: multiply; }
.etq { position: absolute; left: 0; right: 0; bottom: 0; height: 11mm; background: #0C2342; display: flex; align-items: center; justify-content: center; border-radius: 0 0 3mm 3mm; }   /* v859 — faixa da marca (padrão Meridian) */
.etq img { height: 5.6mm; width: auto; mix-blend-mode: normal !important; }
.anx figcaption { font-size: 6.5pt; color: #6B7A90; margin-top: 1.2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.linha { display: flex; justify-content: space-between; align-items: baseline; padding: 2mm 0; border-bottom: .3mm solid #D3D9E2; font-size: 8.5pt; }
.info div { font-size: 8.5pt; padding: 2.2mm 0; border-bottom: .3mm solid #D3D9E2; }
.info b { font-weight: 700; }
.dados h4 { font-size: 11pt; margin: 0 0 4mm; display: inline-block; padding-bottom: 1mm; border-bottom: .6mm solid #FF6B1A; }
.dados p { margin: 0 0 2.6mm; font-size: 9.5pt; line-height: 1.5; }
.dados p b { color: #5C6B82; }
`;

function pagina(conteudo, n, total, { wm = "dir" } = {}) {
  const marcaDagua = wm === "dir"
    ? `<img class="wm" src="/proposta/emblema.png" style="right:-28mm;top:8mm;width:95mm" />`
    : wm === "esq" ? `<img class="wm" src="/proposta/emblema.png" style="left:-28mm;bottom:-28mm;width:95mm" />`
      : `<img class="wm" src="/proposta/emblema.png" style="right:-30mm;bottom:-40mm;width:140mm" />`;
  return `<section class="pg"><div class="topo"></div>${marcaDagua}
    <div class="logo"><img src="/proposta/emblema.png" />MERIDIAN</div>
    ${conteudo}
    <div class="num">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div><div class="base"></div></section>`;
}

const capa = (cliente) => `
  <div class="cont" style="top:32mm">
    <div style="font-size:20pt;font-weight:700">OLÁ,</div>
    <div style="font-size:30pt;font-weight:800;line-height:1.05">${ESC(String(cliente || "").toUpperCase())}.</div>
    <div class="barra" style="font-size:12pt;padding:3mm 6mm;margin-top:4mm">A <b>MERIDIAN</b> TEM ESTRUTURA PRA VESTIR SUA EQUIPE INTEIRA</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-top:5mm">
      ${[["1.700", "m²", "PARQUE FABRIL PRÓPRIO"], ["60", "mil", "PEÇAS/MÊS DE CAPACIDADE PRODUTIVA"], ["+100", "", "CLIENTES ATENDIDOS POR MÊS"], ["100%", "", "ETAPAS INTERNAS: DO CORTE À EMBALAGEM"]]
    .map(([v, u, t]) => `<div class="card" style="padding:4mm 5mm;height:26mm"><div style="color:#FF6B1A;font-weight:800;font-size:19pt">${v}<span style="font-size:10pt"> ${u}</span></div><div style="font-size:6.8pt;font-weight:600;margin-top:1.5mm;line-height:1.35">${t}</div></div>`).join("")}
    </div>
    <div class="barra" style="position:absolute;left:0;width:135mm;top:105mm;font-size:9pt;padding:4mm 6mm;line-height:1.6">UMA CONFECÇÃO DE UNIFORMES DE <span class="lar">BELO HORIZONTE-MG</span> QUE ATENDE EMPRESAS DE <span class="lar">TODO O BRASIL</span></div>
    <img src="/proposta/mapa-brasil.png" style="position:absolute;right:20mm;top:75mm;width:58mm" />
  </div>`;

const marcas = () => `
  <div class="cont">
    <div class="barra">MARCAS QUE CONFIAM NA <b>MERIDIAN</b></div>
    <div class="marcas">${GRADE_MARCAS.map((m) => `<div class="card">${m.startsWith("/") ? `<img src="${m}" />` : `<span style="font-weight:800;font-size:12pt;letter-spacing:.5mm">${m}</span>`}</div>`).join("")}</div>
    <div class="barra" style="font-size:9.5pt;padding:4mm 6mm;margin-top:5mm">TODO MÊS, EMPRESAS DE DIVERSOS SETORES CONFIAM NA <b>MERIDIAN</b> PARA VESTIR SUAS EQUIPES.</div>
  </div>`;

// v852 — layout (anexos da FPP) logo abaixo da linha do item, na própria página da proposta
function layoutDoItem(it) {
  const im = it.imgs || [];
  if (!im.length && !(it.outros || []).length) return "";
  const alt = it.altLay || 70;
  return `<tr class="lay"><td></td><td colspan="4">
    ${im.length ? `<div class="anx" style="height:${alt}mm;grid-template-columns:repeat(${Math.min(im.length, 3)},1fr)">${im.map((a) => `<figure><div class="card im padrao${a.branco ? " branco" : ""}"><img class="lay" src="${a.src}" /><div class="etq"><img src="/meridian-logo.svg" /></div></div></figure>`).join("")}</div>` : ""}
    ${(it.outros || []).length ? `<div style="font-size:6.8pt;color:#6B7A90;margin-top:1.5mm">Outros arquivos: ${it.outros.map(ESC).join(", ")}</div>` : ""}
  </td></tr>`;
}
function tabela(d, itens, primeira, ultimo) {
  const linhas = itens.map((it) => it.cont ? layoutDoItem(it) : `<tr>
      <td style="width:14mm;color:#FF6B1A;font-weight:800">${String(it.n).padStart(2, "0")}</td>
      <td><b style="font-size:9.5pt">${ESC(it.nome)}</b>${it.det ? `<div style="font-size:7pt;color:#6B7A90;margin-top:.8mm;text-transform:uppercase">${ESC(it.det)}</div>` : ""}</td>
      <td class="c" style="width:22mm">${N(it.qtd)}</td>
      <td class="r" style="width:32mm">${R$(it.unit)}</td>
      <td class="c" style="width:36mm;color:#FF6B1A;font-weight:800">${R$(it.total)}</td></tr>${layoutDoItem(it)}`).join("");
  return `<div class="cont">
    <div class="barra">PROPOSTA COMERCIAL${primeira ? "" : " <span style='font-size:11pt;font-weight:600'>(continuação)</span>"}</div>
    <div class="sub">Para <b>${ESC(String(d.cliente || "").toUpperCase())}</b> · ${dataExtenso()}</div>
    ${itens.length ? `<table class="it"><thead><tr><th>Item</th><th>Produto e descrição</th><th class="c">Qtd</th><th class="r">Unitário</th><th class="c">Total</th></tr></thead><tbody>${linhas}</tbody></table>` : ""}
    ${ultimo ? `<div class="card" style="margin-top:5mm;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:700;font-size:9pt">${N(d.pecas)} PEÇAS · ${d.itens.length} ${d.itens.length === 1 ? "ITEM" : "ITENS"}</div>
      <div class="r"><div class="rot">Total</div><div style="color:#FF6B1A;font-weight:800;font-size:19pt">${R$(d.total)}</div></div></div>` : ""}
  </div>`;
}

function paginaItem(it, imgs, outros, parte, partes) {
  const n = imgs.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const anexos = n
    ? `<div class="anx" style="height:100%;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${Math.ceil(n / cols) || 1},1fr)">${imgs.map((a) => `<figure><div class="card im"><img src="${a.src}" /></div><figcaption>${ESC(a.nome)}</figcaption></figure>`).join("")}</div>`
    : `<div class="card" style="height:100%;display:flex;align-items:center;justify-content:center;color:#6B7A90;font-size:9pt">Sem imagens anexadas à FPP.</div>`;
  return `<div class="cont">
    <div class="barra" style="display:flex;justify-content:space-between;align-items:center"><span><b>ITEM ${String(it.n).padStart(2, "0")}</b> · ${ESC(it.nome)}</span>${partes > 1 ? `<span style="font-size:9pt;font-weight:600">${parte}/${partes}</span>` : ""}</div>
    <div style="position:absolute;top:22mm;left:0;right:0;bottom:0;display:grid;grid-template-columns:72mm 1fr;gap:6mm">
      <div class="card" style="padding:5mm 6mm;align-self:start">
        <div class="rot">Produto</div><div style="font-weight:800;font-size:11pt;margin:1mm 0 2mm">${ESC(it.nome)}</div>
        ${it.det ? `<div style="font-size:7.5pt;color:#5C6B82;text-transform:uppercase;line-height:1.5;margin-bottom:2mm">${ESC(it.det)}</div>` : ""}
        <div class="linha"><span class="rot">Quantidade</span><b>${N(it.qtd)} pç</b></div>
        <div class="linha"><span class="rot">Unitário</span><b>${R$(it.unit)}</b></div>
        ${it.lead ? `<div class="linha"><span class="rot">Prazo</span><b>${ESC(it.lead)}</b></div>` : ""}
        <div class="linha" style="border:0"><span class="rot">Total</span><b style="color:#FF6B1A;font-size:13pt">${R$(it.total)}</b></div>
        ${outros.length ? `<div style="font-size:6.8pt;color:#6B7A90;margin-top:3mm">Outros arquivos: ${outros.map(ESC).join(", ")}</div>` : ""}
      </div>
      <div style="min-height:0">${anexos}</div>
    </div>
  </div>`;
}

function condicoes(d) {
  const blocos = d.pagamento.map((g, gi) => `
    <div class="card" style="padding:4mm 6mm;border-left:1.2mm solid #FF6B1A;margin-bottom:3mm">
      <div style="color:#FF6B1A;font-size:6.5pt;font-weight:800;letter-spacing:.4mm">${d.pagamento.length > 1 ? `CONDIÇÃO ${gi + 1} · ${ESC(g.itens)}` : "CONDIÇÃO DE PAGAMENTO"}</div>
      <div style="font-weight:800;font-size:9pt;margin:1mm 0 2mm">${ESC(g.texto)}</div>
      ${g.linhas.map((l) => `<div style="display:grid;grid-template-columns:34mm 18mm 34mm 1fr;gap:3mm;padding:1.8mm 0;border-top:.3mm solid #D3D9E2;font-size:8.5pt;align-items:baseline">
        <b>${ESC(l.rotulo)}</b><span>${PCT(l.frac)}</span><b style="color:#FF6B1A">${R$(l.valor)}</b><span class="rot" style="font-size:7pt">${ESC(l.quando)}</span></div>`).join("")}
    </div>`).join("");
  return `<div class="cont">
    <div class="barra">CONDIÇÕES COMERCIAIS</div>
    <div style="margin-top:5mm">${blocos}</div>
    <div style="display:grid;grid-template-columns:1fr 92mm;gap:12mm;margin-top:4mm">
      <div class="info">
        <div><b>Data do orçamento:</b> ${dataExtenso()}</div>
        <div><b>Orçamento válido por:</b> ${ESC(d.validade || "A definir")}</div>
        <div><b>Prazo de entrega:</b> ${ESC(d.prazo || "A definir")}</div>
        <div><b>Forma de pagamento:</b> ${ESC(d.pagamento.map((g) => g.texto).join(" · "))}</div>
        <div><b>Frete:</b> ${ESC(d.frete || "A combinar")}</div>
        ${d.rodape ? `<div style="color:#6B7A90;font-size:7.5pt">${ESC(d.rodape)}</div>` : ""}
      </div>
      <div style="background:#1B2A45;color:#fff;border-radius:3mm;padding:5mm 6mm;align-self:start">
        <div style="color:#FF6B1A;font-weight:800;font-size:8.5pt;letter-spacing:.4mm;margin-bottom:2mm">RESUMO DO INVESTIMENTO</div>
        ${[["ITENS", d.itens.length], ["TOTAL DE PEÇAS", N(d.pecas)], ["PAGAMENTO", d.pagamento.map((g) => g.texto).join(" · ")], ["ENTREGA", d.prazo || "A definir"]]
    .map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:4mm;font-size:7.5pt;padding:1.2mm 0"><span style="letter-spacing:.3mm;opacity:.8">${k}</span><b style="text-align:right">${ESC(v)}</b></div>`).join("")}
        <div style="font-weight:800;font-size:8pt;margin-top:3mm">TOTAL</div>
        <div style="font-weight:800;font-size:19pt">${R$(d.total)}</div>
      </div>
    </div>
  </div>`;
}

const dadosCadastrais = () => `
  <div class="cont">
    <div class="barra">NOSSOS DADOS CADASTRAIS</div>
    <div class="dados" style="display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:10mm;margin-top:7mm">
      <div><h4 style="color:#FF6B1A">MERIDIAN LTDA.</h4>
        <p><b>CNPJ:</b> 48.011.287/0001-81</p><p><b>Inscrição estadual:</b> 00444.505.900-58</p><p><b>Inscrição municipal:</b> 1.420.065/001-7</p>
        <p><b>CNAE:</b> 14.13-4-03. Facção de roupas profissionais</p>
        <p><b>Endereço:</b> Rua Doutor Natalino Triginelli, 281, Jardim Atlântico, Belo Horizonte-MG, CEP 31.710-420</p></div>
      <div><h4>Contato</h4>
        <p><b>Pedro:</b> (31) 99930-2168</p><p><b>Igor:</b> (31) 99060-0506</p><p><b>E-mail:</b> <span class="min">contato@meridianpro.com.br</span></p>
        <p><b>Site:</b> <span class="min">www.meridianpro.com.br</span></p><p><b>Instagram:</b> <span class="min">@meridian_uniformes</span></p></div>
      <div><h4>Dados bancários</h4>
        <p><b>Banco:</b> Bradesco (237)</p><p><b>Agência:</b> 1408</p><p><b>Conta corrente:</b> 13137-7</p><p><b>PIX:</b> 48011287000181 (CNPJ)</p></div>
    </div>
  </div>`;

// d: { cliente, itens:[{ n, fppId, nome, det, qtd, unit, total, lead }], pagamento:[{ itens, texto, linhas:[{ rotulo, frac, valor, quando }] }],
//      prazo, validade, frete, rodape }
export async function gerarPropostaPdf(d, aoProgresso) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela da proposta. Libere os pop-ups deste site.");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Gerando proposta…</title></head><body style="font-family:Montserrat,Arial;padding:40px;color:#1B2A45">Gerando a proposta e carregando os anexos das FPPs…</body></html>`);
  const total = d.itens.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const pecas = d.itens.reduce((s, it) => s + (Number(it.qtd) || 0), 0);
  const dd = { ...d, total, pecas };

  // anexos de cada item (até 6 imagens por página do item)
  const porItem = [];
  for (const [k, it] of d.itens.entries()) {
    aoProgresso?.(`Anexos do item ${k + 1} de ${d.itens.length}…`);
    porItem.push(await anexosDaFpp(it.fppId));
  }

  // anexos entram no item; até 3 imagens lado a lado (as demais em outra linha do mesmo item)
  const itens = [];
  d.itens.forEach((it, k) => {
    const { imgs, outros } = porItem[k];
    const grupos = []; for (let i = 0; i < imgs.length; i += 3) grupos.push(imgs.slice(i, i + 3));
    if (!grupos.length) itens.push({ ...it, imgs: [], outros });
    grupos.forEach((g, j) => itens.push(j === 0 ? { ...it, imgs: g, outros } : { ...it, imgs: g, outros: [], cont: true }));
  });
  // paginação pela altura (mm): linha ~13, layout ~76, total ~30; útil ~150 abaixo do título
  const ALT = 150, conteudos = [];
  conteudos.push([capa(d.cliente), { wm: "capa" }]);
  conteudos.push([marcas(), { wm: "dir" }]);
  const paginas = []; let atual = [], usado = 0;
  for (const it of itens) {
    const h = (it.cont ? 0 : 13) + (it.imgs.length ? 76 : 0) + (it.outros.length ? 5 : 0);
    if (atual.length && usado + h > ALT) { paginas.push(atual); atual = []; usado = 0; }
    atual.push(it); usado += h;
  }
  if (atual.length) paginas.push(atual);
  if (!paginas.length) paginas.push([]);
  const cabeTotal = usado + 30 <= ALT;
  paginas.forEach((pg, i) => conteudos.push([tabela(dd, pg, i === 0, i === paginas.length - 1 && cabeTotal), { wm: "capa" }]));
  if (!cabeTotal) conteudos.push([tabela(dd, [], false, true), { wm: "capa" }]);
  conteudos.push([condicoes(dd), { wm: "dir" }]);
  conteudos.push([dadosCadastrais(), { wm: "esq" }]);

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Proposta ${ESC(d.cliente)} · ${dataExtenso()}</title>
    <base href="${window.location.origin}/">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${CSS}</style></head><body>
    ${conteudos.map(([c, o], i) => pagina(c, i + 1, conteudos.length, o)).join("")}
    <script>
      Promise.all([document.fonts ? document.fonts.ready : 0, ...Array.from(document.images).map((im) => im.complete ? 0 : new Promise((ok) => { im.onload = im.onerror = ok; }))])
        .then(() => setTimeout(() => { window.focus(); window.print(); }, 300));
    </script></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}
