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
      if (/^[A-Z]{2}\.\d{2}\.\d{3}\.\d{3,}/.test(esq) && num(q) != null) {
        atual = { codigo: esq.split(/\s+/)[0], descricao: desc.replace(new RegExp(`^${esq.split(/\s+/)[0].replace(/\./g, "\\.")}\\s*-\\s*`), "").replace(/\s*-\s*$/, ""), qtd: num(q), preco: num(pr), total: num(tot), grade: [] };
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
