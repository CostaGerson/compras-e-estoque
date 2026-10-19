// v316 — leitura dos PDFs do KM Sistemas: PV (pedido de venda: comercial e financeiro) e PP (ordem de produção: dados de produção)
import { linhasPdf, col } from "@/lib/finParse";

const num = (s) => { const t = String(s || "").replace(/\./g, "").replace(",", "."); const n = parseFloat(t); return isNaN(n) ? null : Math.round(n * 100) / 100; };
const dataISO = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const txt = (l) => col(l, -1, 9999);
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

// identifica o tipo do PDF pelo texto da 1ª página
export async function lerPedidoPdf(buf) {
  const paginas = await linhasPdf(buf);
  const t1 = norm((paginas[0] || []).map(txt).join("\n"));
  if (ehPosicaoVendas(paginas)) return { tipo: "POSICAO", ...lerPosicaoVendas(paginas) };
  if (/ORDEM DE PRODUCAO/.test(t1)) return { tipo: "PP", ...lerPP(paginas) };
  if (/CONDICAO DE PAGAMENTO/.test(t1) && /\bPEDIDO\b/.test(t1)) return { tipo: "PV", ...lerPV(paginas) };
  throw new Error("PDF não reconhecido como PV (pedido de venda) nem PP (ordem de produção).");
}

// ---------- PV ----------
const ROTULOS_DIR = ["TIPO DE PEDIDO", "DT DESPACHO", "CONDICAO DE PAGAMENTO", "O.C. CLIENTE", "VENDEDOR", "ASSINATURA", "FRETE", "TOTAL GERAL", "PRODUTOS"];
export function lerPV(paginas) {
  const p1 = paginas[0] || [];
  const out = { itens: [] };
  // cabeçalho: data e nº do pedido
  for (const l of p1.slice(0, 4)) {
    const s = txt(l);
    const m = s.match(/(\d{2}\/\d{2}\/\d{4}).*PEDIDO\s+(\d{5,})/i);
    if (m) { out.emissao = dataISO(m[1]); out.numero = m[2]; break; }
  }
  // coluna da direita (x ≥ 440): rótulo e, na linha de baixo, o valor
  const dir = [];
  for (const l of p1) { const s = col(l, 440, 9999); if (s && l.y > 300) dir.push(s); }
  const valorDe = (rot) => {
    const i = dir.findIndex((s) => norm(s) === rot);
    if (i < 0) return null;
    const v = dir[i + 1];
    return v && !ROTULOS_DIR.includes(norm(v)) ? v.trim() : null;
  };
  out.tipoPedido = valorDe("TIPO DE PEDIDO");
  out.despacho = dataISO(valorDe("DT DESPACHO"));
  out.condicao = valorDe("CONDICAO DE PAGAMENTO");
  out.oc = valorDe("O.C. CLIENTE");
  out.vendedor = valorDe("VENDEDOR");
  // esquerda
  for (const l of p1) {
    const s = col(l, 0, 440);
    let m;
    if ((m = s.match(/^Cliente:\s*(.+)$/i))) {
      const c = m[1].trim(); const mc = c.match(/^(\d+)-(.+)$/);
      out.clienteCodigo = mc ? mc[1] : null; out.cliente = (mc ? mc[2] : c).trim().toUpperCase();
    }
    if ((m = s.match(/Cnpj\/Cpf:\s*([\d./-]+)/i))) out.cnpj = m[1].replace(/\D/g, "");
    if ((m = s.match(/Frete:\s*(.+?)(?:\s+Transp\.|$)/i))) out.freteTipo = m[1].trim();
  }
  // itens e totais (todas as páginas)
  let atual = null, tams = null;
  for (const pg of paginas) {
    for (const l of pg) {
      const s = txt(l);
      const esq = col(l, 0, 75), desc = col(l, 75, 400), q = col(l, 400, 460), pr = col(l, 460, 520), tot = col(l, 520, 9999);
      if (/^Total Qtde:/i.test(s)) { const m = s.match(/Total Qtde:\s*([\d.,]+).*Produtos\s*([\d.,]+)/i); if (m) { out.qtdTotal = num(m[1]); out.totalProdutos = num(m[2]); } atual = null; continue; }
      if (/^Total Geral/i.test(col(l, 440, 9999))) { const m = col(l, 440, 9999).match(/([\d.]+,\d{2})/); if (m) out.total = num(m[1]); continue; }
      if (/^Frete$/i.test(col(l, 440, 520))) { const m = col(l, 520, 9999).match(/([\d.]+,\d{2})/); if (m) out.frete = num(m[1]); continue; }
      // v319 — código pelo texto da linha inteira (alguns PDFs vêm com letras soltas e o código passa da coluna)
      const mc = col(l, 0, 400).replace(/\s+/g, " ").match(/^([A-Z]{2}\.\d{2}\.\d{3}\.\d{3,})\s*(.*)$/);
      if (mc && num(q) != null) {
        const cod = mc[1];
        const resto = mc[2].replace(new RegExp(`^${cod.replace(/\./g, "\\.")}\\s*-?\\s*`), "").replace(/\s*-\s*$/, "").trim();
        atual = { codigo: cod, descricao: resto, qtd: num(q), preco: num(pr), total: num(tot), grade: [] };
        out.itens.push(atual); tams = null; continue;
      }
      if (!atual) continue;
      const g = s.replace(/^GRADE->\s*/i, "");
      if (g.includes("¦")) {
        const partes = g.split("¦").map((x) => x.trim()).filter(Boolean);
        if (partes.length && partes.every((x) => /^\d+$/.test(x))) { if (tams) atual.grade = tams.map((t, i) => ({ tam: t, qtd: Number(partes[i]) || 0 })); }
        else tams = partes;
        continue;
      }
      if (/^GRADE->$/i.test(s)) continue;
      if (desc && !q && !esq && !atual.grade.length) atual.descricao = `${atual.descricao} - ${desc}`.replace(/\s+-\s+-\s+/g, " - ");
    }
  }
  // observação do pedido (texto ao lado de "Obs.:")
  const lo = p1.find((l) => /^Obs\.:/i.test(col(l, 0, 440)));
  if (lo) {
    const t = p1.filter((l) => Math.abs(l.y - lo.y) <= 8).map((l) => col(l, 0, 440).replace(/^Obs\.:\s*/i, "")).filter(Boolean).join(" ").trim();
    if (t) out.obs = t.toUpperCase();
  }
  if (out.total == null) out.total = out.totalProdutos ?? out.itens.reduce((a, i) => a + (i.total || 0), 0);
  if (!out.numero) throw new Error("PV sem número de pedido.");
  return out;
}

// ---------- PP (uma página por item) ----------
const TITULOS = new Set(["MODELAGEM", "MOLDE", "TECIDO", "PERSONALIZACAO", "GOLA", "MANGA", "FECHAMENTO", "COSTAS", "BARRA", "PUNHO", "RECORTE", "BOLSO", "FORRO", "EXTRA",
  "PE DE GOLA", "BOLSO DIANTEIRO", "BOLSO TRASEIRO", "REFORCO", "CARCELA"]);
const ehTitulo = (s) => { const n = norm(s); return TITULOS.has(n) || /^(GOLA|PE DE GOLA|MANGA|FECHAMENTO|FRENTE|COSTAS|BARRA|PUNHO|RECORTE|BOLSO|EXTRA|COS|ALCA|FORRO) D[AOE]S? [A-Z ]+$/.test(n) && n.split(" ").length <= 5; };
export function lerPP(paginas) {
  const out = { itens: [] };
  for (const pg of paginas) {
    const linhas = pg.map(txt);
    const cab = linhas.find((s) => /ORDEM DE PRODU/i.test(s));
    if (!cab) continue;
    const m = cab.match(/(\d{5,})\s*\/\s*(\d+)\s*-\s*(\d+)/);
    if (!m) continue;
    out.numero = out.numero || m[1];
    const it = { seq: Number(m[2]), de: Number(m[3]), parametros: [] };
    const idOp = cab.match(/(\d{4,})\s*$/); if (idOp) it.op = idOp[1];
    let i0 = -1;
    linhas.forEach((s, i) => {
      let k;
      if ((k = s.match(/^Item:\s*(.+?)\s+Tipo:/i))) it.descricao = k[1].trim();
      if ((k = s.match(/Total:\s*(\d+)/i))) it.qtd = Number(k[1]);
      if ((k = s.match(/Previs[aã]o Despacho:\s*(\d{2}\/\d{2}\/\d{4})/i))) out.despacho = out.despacho || dataISO(k[1]);
      if ((k = s.match(/Data Emiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i))) out.emissao = out.emissao || dataISO(k[1]);
      if ((k = s.match(/Cliente:\s*(?:\d+-)?(.+)$/i))) out.cliente = out.cliente || k[1].trim().toUpperCase();
      if ((k = s.match(/^([A-Z]{2}\.\d{2}\.\d{3}\.\d{3,})\s/))) it.codigo = k[1];
      if (/^Produto:/i.test(s)) i0 = i;
    });
    // parâmetros: do "Produto:" até "PERÍODO PERSONALIZAÇÃO"
    if (i0 >= 0) {
      let p = null;
      for (const s of linhas.slice(i0 + 1)) {
        if (/^PER[IÍ]ODO /i.test(s) || /^VALOR TERCEIRIZADO/i.test(s)) break;
        if (ehTitulo(s)) { p = { t: s.trim().toUpperCase(), v: "" }; it.parametros.push(p); continue; }
        if (p) p.v = `${p.v} ${s.trim()}`.trim().replace(/=$/, "");
      }
    }
    out.itens.push(it);
  }
  if (!out.numero) throw new Error("PP sem número de pedido.");
  out.itens.sort((a, b) => a.seq - b.seq);
  return out;
}

// ---------- condição de pagamento → entrada + prazos após a NF ----------
// "30 DIAS" → [30] · "30/60/90" → [30,60,90] · "A VISTA" → [0] · "ENTRADA 50% + 30 DIAS" → entrada 50% e [30] · "ENTRADA/30/60" → 1/3 cada
export function lerCondicao(cond) {
  const n = norm(cond);
  if (!n) return { ok: false, entradaPct: 0, prazos: [0] };
  const temEntrada = /ENTRADA|SINAL|ANTECIPAD/.test(n);
  const pcts = [...n.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => Number(m[1].replace(",", ".")));
  const semPct = n.replace(/\d+(?:[.,]\d+)?\s*%/g, " ");
  let prazos = [...semPct.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((d) => d <= 400);
  if (/A VISTA|AVISTA/.test(n) && !prazos.length) prazos = [0];
  if (!prazos.length && !temEntrada) return { ok: false, entradaPct: 0, prazos: [0] };
  let entradaPct = 0;
  if (temEntrada) entradaPct = pcts.length ? pcts[0] / 100 : 1 / (prazos.length + 1);
  return { ok: true, entradaPct: Math.min(1, entradaPct), prazos: prazos.length ? prazos : (entradaPct < 1 ? [0] : []) };
}

// ---------- v325 — Posição Geral de Vendas (KM): todos os pedidos com condição, entrega e saldo a entregar ----------
const VENDEDORES = ["IGOR", "PEDRO", "GERSON", "GESTOR", "MAYCON", "LEANDRO"];
const COL = { cli: [75, 237], emis: [237, 284], entr: [284, 330], qtd: [330, 385], vlr: [385, 438], qte: [438, 491], vle: [491, 554], condVend: [554, 690] };
export function ehPosicaoVendas(paginas) {
  const t = norm((paginas[0] || []).map(txt).join(" "));
  return /POSICAO GERAL DE VENDAS/.test(t) && /COND\.? ?PGTO/.test(t);
}
export function lerPosicaoVendas(paginas) {
  const pedidos = [];
  for (const pg of paginas) {
    // ordena linhas por y desc (de cima para baixo) e agrupa em registros que começam no nº do pedido
    // separa o nº do pedido do nome do cliente quando vêm colados num só token
    const linhas = [...pg].map((l) => ({ y: l.y, its: l.its.flatMap((t) => {
      const m = t.s.match(/^(\d{8})\s+(.+)$/);
      return m ? [{ x: t.x, w: 0, s: m[1] }, { x: 76, w: t.w, s: m[2] }] : [t];
    }) })).sort((a, b) => b.y - a.y);
    let reg = null;
    const fecha = () => { if (reg) { const p = montar(reg); if (p) pedidos.push(p); } reg = null; };
    for (const l of linhas) {
      const f = l.its[0];
      if (f && /^\d{8}$/.test(f.s.trim())) { fecha(); reg = { numero: f.s.trim(), linhas: [l] }; }
      else if (reg) reg.linhas.push(l);
    }
    fecha();
  }
  // total do rodapé (para conferência)
  let totalVle = null, totalPed = null;
  for (const pg of paginas) for (const l of pg) {
    const s = txt(l); const m = s.match(/Pedidos:\s*(\d+)/i);
    if (m) { totalPed = Number(m[1]); const vals = s.match(/[\d.]+,\d{2}/g); if (vals && vals.length >= 2) totalVle = num(vals[1]); }
  }
  return { pedidos, totalPed, totalVle };
}
function montar(reg) {
  // texto da linha inteira (todas as linhas do registro, de cima para baixo, da esquerda para a direita)
  const toks = reg.linhas.flatMap((l) => l.its.map((t) => t.s)).map((x) => String(x).trim()).filter(Boolean);
  const full = toks.join(" ").replace(/\s+/g, " ");
  const datas = [...full.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)];
  const emissao = dataISO(datas[0]?.[1]);
  const entrega = dataISO(datas[1]?.[1]);
  // cliente: entre o nº do pedido e a 1ª data
  let cliente = "";
  const mc = full.match(new RegExp(`^${reg.numero}\\s+(.*?)\\s+\\d{2}/\\d{2}/\\d{4}`));
  if (mc) cliente = mc[1].trim().toUpperCase();
  // depois da 2ª data (ou da 1ª, se só houver uma): QTD VALORLIQ QTENTREGAR VLENTREGAR COND... VEND ...
  const ancora = datas[1] || datas[0];
  const resto = ancora ? full.slice(ancora.index + ancora[0].length).trim() : full;
  const partes = resto.split(" ");
  const ehInt = (w) => /^\d{1,6}$/.test(w);
  const ehDec = (w) => /^\d{1,3}(\.\d{3})*,\d{2}$/.test(w);
  let qtd = 0, valor = 0, qtEntregar = 0, vlEntregar = 0, i = 0, achou = 0;
  for (; i < partes.length && achou < 4; i++) {
    const w = partes[i];
    if (achou === 0 && ehInt(w)) { qtd = Number(w); achou = 1; }
    else if (achou === 1 && ehDec(w)) { valor = num(w); achou = 2; }
    else if (achou === 2 && ehInt(w)) { qtEntregar = Number(w); achou = 3; }
    else if (achou === 3 && ehDec(w)) { vlEntregar = num(w); achou = 4; }
  }
  // o que sobra: condição ... VENDEDOR vfin custo %  → tira o vendedor e os 3 números finais
  const cauda = partes.slice(i);
  const vi = cauda.findIndex((w) => VENDEDORES.includes(norm(w)));
  const vendedor = vi >= 0 ? cauda[vi].toUpperCase() : null;
  const condicao = (vi >= 0 ? cauda.slice(0, vi) : cauda.filter((w) => !ehDec(w) && !/^-/.test(w))).join(" ").trim().toUpperCase() || null;
  if (!cliente && !valor) return null;
  return { numero: reg.numero, cliente, emissao, entrega, qtd, valor, qtEntregar, vlEntregar, condicao, vendedor };
}
