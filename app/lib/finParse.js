// Leitura dos extratos bancários (PDF) → lançamentos.
// Cada leitor recebe as linhas posicionais do PDF e devolve
// { saldoAnterior, lancamentos: [{ data: "AAAA-MM-DD", historico, documento, identificacao, valor }] }

const MESES = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// "1.234,56" | "-R$ 1.234,56" | "- 21,39" | "65,79 D" → número (com sinal)
export function valorBR(s) {
  if (s == null) return null;
  let t = String(s).replace(/\s+/g, "");
  if (!/\d,\d{2}/.test(t)) return null;
  let neg = /^-|^\(|-R\$/.test(t) || /D$/.test(t);
  t = t.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(t);
  if (isNaN(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}
const r2 = (n) => Math.round(n * 100) / 100;
const dataBR = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

// ---------- PDF → páginas → linhas (y) com itens posicionados ----------
export async function linhasPdf(buf, senha) {
  const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const PDFJS = mod.default || mod;
  PDFJS.disableWorker = true;
  const doc = await PDFJS.getDocument({ data: new Uint8Array(buf), password: senha || undefined });
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const c = await pg.getTextContent();
    const rows = new Map();
    for (const it of c.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      // junta itens com y muito próximo (±1)
      let key = y;
      for (const k of rows.keys()) if (Math.abs(k - y) <= 1) { key = k; break; }
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], w: it.width || 0, s: it.str });
    }
    const linhas = [...rows.entries()].sort((a, b) => b[0] - a[0])
      .map(([y, its]) => ({ y, its: its.sort((a, b) => a.x - b.x) }));
    paginas.push(linhas);
  }
  doc.destroy();
  return paginas;
}

// texto dos itens com x em [x0, x1), juntando letras "espaçadas" sem criar espaços falsos
export function col(linha, x0, x1) {
  const its = linha.its.filter((i) => i.x >= x0 && i.x < x1);
  let out = "", fim = null;
  for (const i of its) {
    if (fim !== null && i.x - fim > 0.8) out += " ";
    out += i.s;
    fim = i.x + i.w;
  }
  return out.replace(/\s+/g, " ").trim();
}
const txt = (linha) => col(linha, -1, 9999);

// ordem de leitura: órfãs carregadas (vieram de cima) + linhas acima da âncora + âncora + abaixo
function ordemLeitura(g) {
  const acima = g.extras.filter((e) => e.y > g.ancora.y || e._carregada).sort((a, b) => b.y - a.y);
  const abaixo = g.extras.filter((e) => e.y <= g.ancora.y && !e._carregada && e !== g.ancora).sort((a, b) => b.y - a.y);
  const carregadas = acima.filter((e) => e._carregada);
  const resto = acima.filter((e) => !e._carregada);
  return [...carregadas, ...resto, g.ancora, ...abaixo];
}

// ============================ BRADESCO ============================
function lerBradesco(paginas) {
  // corta tudo depois da linha "Total"
  let fim = false, saldoAnterior = null;
  const declarado = {};
  const pags = paginas.map((linhas) => linhas.filter((l) => {
    if (fim) return false;
    const d = col(l, 0, 95);
    if (/^Total$/i.test(d)) {
      fim = true;
      declarado.creditos = valorBR(col(l, 335, 430)); declarado.debitos = valorBR(col(l, 430, 520)); declarado.saldoFinal = valorBR(col(l, 520, 9999));
      return false;
    }
    return true;
  }));
  const CAB = /Extrato Mensal|MERIDIAN LTDA \||Nome do usu|Data da opera|^Folha|Agência \| Conta|Total Dispon|Extrato de: Ag|Lançamento|^01408/;
  const ignorar = (l) => CAB.test(txt(l)) || l.y > 835 || (!col(l, 95, 9999) && !col(l, 0, 95));
  const ehAncora = (l) => valorBR(col(l, 335, 430)) !== null || valorBR(col(l, 430, 520)) !== null;
  // marca órfãs carregadas
  const grupos = [];
  let carregar = [];
  for (const linhas of pags) {
    const uteis = linhas.filter((l) => !ignorar(l));
    for (const l of uteis) if (/SALDO ANTERIOR/.test(col(l, 95, 265))) saldoAnterior = valorBR(col(l, 520, 9999));
    const corpo = uteis.filter((l) => !/SALDO ANTERIOR/.test(col(l, 95, 265)));
    const ancoras = corpo.filter(ehAncora).map((a) => ({ ancora: a, extras: [] }));
    if (!ancoras.length) continue;
    carregar.forEach((c) => { c._carregada = true; ancoras[0].extras.push(c); });
    carregar = [];
    for (const l of corpo) {
      if (ehAncora(l)) continue;
      let melhor = null, dist = Infinity;
      for (const a of ancoras) { const d = Math.abs(a.ancora.y - l.y); if (d < dist) { dist = d; melhor = a; } }
      if (l.y < ancoras[ancoras.length - 1].ancora.y && dist > 7) { carregar.push(l); continue; }
      melhor.extras.push(l);
    }
    grupos.push(...ancoras);
  }
  let dataAtual = null;
  const out = [];
  for (const g of grupos) {
    const linhas = ordemLeitura(g);
    const datas = linhas.map((l) => dataBR(col(l, 0, 95))).filter(Boolean);
    if (datas.length) dataAtual = datas[0];
    const historico = linhas.map((l) => col(l, 95, 265)).filter(Boolean).join(" ");
    const c = valorBR(col(g.ancora, 335, 430)), d = valorBR(col(g.ancora, 430, 520));
    out.push({ data: dataAtual, historico, documento: col(g.ancora, 265, 335) || null, identificacao: null, valor: c !== null ? c : d });
  }
  return { saldoAnterior, lancamentos: out, declarado };
}

// ============================== ITAÚ ==============================
function lerItau(paginas) {
  let fim = false, saldoAnterior = null;
  const pags = paginas.map((linhas) => linhas.filter((l) => {
    if (fim) return false;
    if (/^aviso:/i.test(txt(l))) { fim = true; return false; }
    return true;
  }));
  const ignorar = (l) => l.y > 640 && /Saldo total|Limite da conta|Lançamentos do período|MERIDIAN ARTIGOS MILITARES E OUTDOOR\s+CNPJ|R\$ 20\.700|Razão Social|^-R\$/.test(txt(l));
  const grupos = [];
  const declarado = {};
  for (const linhas of pags) {
    const uteis = linhas.filter((l) => !ignorar(l) && !/Data\s+Lançamentos/.test(txt(l)));
    for (const l of uteis) if (/SALDO ANTERIOR/.test(col(l, 88, 227))) saldoAnterior = valorBR(col(l, 515, 9999));
    for (const l of uteis) if (/SALDO TOTAL DISPON/.test(col(l, 88, 227))) declarado.saldoFinal = valorBR(col(l, 515, 9999));
    const ehAncora = (l) => dataBR(col(l, 0, 88)) && valorBR(col(l, 455, 515)) !== null;
    const ancoras = uteis.filter(ehAncora).map((a) => ({ ancora: a, extras: [] }));
    for (const l of uteis) {
      if (ehAncora(l) || dataBR(col(l, 0, 88))) continue;
      let melhor = null, dist = Infinity;
      for (const a of ancoras) { const d = Math.abs(a.ancora.y - l.y); if (d < dist) { dist = d; melhor = a; } }
      if (melhor && dist <= 7) melhor.extras.push(l);
    }
    grupos.push(...ancoras);
  }
  return {
    saldoAnterior, declarado,
    lancamentos: grupos.map((g) => {
      const ls = ordemLeitura(g);
      const junta = (x0, x1) => ls.map((l) => col(l, x0, x1)).filter(Boolean).join(" ").replace(/-\s+(\d)/g, "-$1");
      const hist = junta(88, 227), razao = junta(227, 363), doc = junta(363, 455);
      return {
        data: dataBR(col(g.ancora, 0, 88)),
        historico: [hist, razao].filter(Boolean).join(" "),
        documento: null,
        identificacao: doc || null,
        valor: valorBR(col(g.ancora, 455, 515)),
      };
    }),
  };
}

// ============================== INTER ==============================
function lerInter(paginas) {
  let data = null;
  const out = [];
  for (const linhas of paginas) {
    for (const l of linhas) {
      const esq = col(l, 0, 400);
      const sa = semAcento(esq).replace(/\s+/g, "").toUpperCase();
      const m = sa.match(/^(\d{1,2})DE([A-Z]+)DE(\d{4})SALDODODIA/);
      if (m && MESES[m[2]]) { data = `${m[3]}-${String(MESES[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`; continue; }
      if (!data) continue;
      const v = valorBR(col(l, 395, 500));
      if (v === null || l.its[0].x > 60) continue;
      out.push({ data, historico: esq.replace(/"/g, "").replace(/\s+/g, " ").trim(), documento: null, identificacao: null, valor: v, _saldo: valorBR(col(l, 500, 9999)) });
    }
  }
  const p = out[0];
  const saldoAnterior = p && p._saldo !== null ? Math.round((p._saldo - p.valor) * 100) / 100 : null;
  const sequencia = conferirSequencia(out, saldoAnterior, 1);
  const declarado = { saldoFinal: out.length ? out[out.length - 1]._saldo : null };
  out.forEach((o) => delete o._saldo);
  return { saldoAnterior, lancamentos: out, declarado, sequencia };
}

// =============================== C6 ================================
function lerC6(paginas) {
  let ano = null;
  const out = [];
  const declarado = {};
  for (const linhas of paginas) {
    for (const l of linhas) {
      const t = txt(l);
      const me = t.match(/Entradas:\s*R\$\s*([\d.]+,\d{2}).*Saídas:\s*R\$\s*([\d.]+,\d{2})/i);
      if (me) { declarado.creditos = (declarado.creditos || 0) + valorBR(me[1]); declarado.debitos = (declarado.debitos || 0) - valorBR(me[2]); }
      const m = t.match(/Per[ií]odo.*?(\d{4})/);
      if (m && !ano) ano = m[1];
      const dl = col(l, 0, 90);
      if (!/^\d{2}\/\d{2}$/.test(dl)) continue;
      const v = valorBR(col(l, 480, 9999));
      if (v === null) continue;
      const [d, mm] = dl.split("/");
      out.push({ data: `${ano || new Date().getFullYear()}-${mm}-${d}`, historico: col(l, 230, 480), documento: null, identificacao: col(l, 150, 230) || null, valor: v });
    }
  }
  if (declarado.creditos != null) { declarado.creditos = r2(declarado.creditos); declarado.debitos = r2(declarado.debitos); }
  return { saldoAnterior: null, lancamentos: out, declarado };
}

// ======================== BANCO DO BRASIL ==========================
function lerBB(paginas) {
  let saldoAnterior = null;
  const declarado = {};
  const grupos = [];
  for (const linhas of paginas) {
    const uteis = linhas.filter((l) => l.y < 690 || !/Extrato de Conta|Cliente|Nome|MERIDIAN LTDA|Movimentação em|Histórico/.test(txt(l)));
    const ehLinhaData = (l) => dataBR(col(l, 0, 100));
    for (const l of uteis) if (ehLinhaData(l) && /Saldo Anterior/i.test(col(l, 145, 380))) saldoAnterior = valorBR(col(l, 495, 9999));
    for (const l of uteis) if (ehLinhaData(l) && /^Saldo do dia/i.test(col(l, 145, 380)) && declarado.saldoFinal === undefined) declarado.saldoFinal = valorBR(col(l, 495, 9999)); // 1º = mais recente
    const ehAncora = (l) => ehLinhaData(l) && valorBR(col(l, 495, 9999)) !== null && !/^Saldo/i.test(col(l, 145, 380));
    const ancoras = uteis.filter(ehAncora).map((a) => ({ ancora: a, extras: [] }));
    for (const l of uteis) {
      if (ehLinhaData(l)) continue;
      if (/bb\.com\.br|Pág\.|Extrato de Conta|Data\s+Origem/.test(txt(l))) continue;
      let melhor = null, dist = Infinity;
      for (const a of ancoras) { const d = a.ancora.y - l.y; if (d > 0 && d < dist) { dist = d; melhor = a; } } // continuação fica ABAIXO da âncora
      if (melhor && dist <= 12) melhor.extras.push(l);
    }
    grupos.push(...ancoras);
  }
  let ls = grupos.map((g) => ({
    data: dataBR(col(g.ancora, 0, 100)),
    historico: [col(g.ancora, 145, 380), ...g.extras.map((e) => col(e, 145, 380))].filter(Boolean).join(" "),
    documento: col(g.ancora, 380, 460) || null,
    identificacao: null,
    valor: valorBR(col(g.ancora, 495, 9999)),
  }));
  // débito + "Estorno de Débito" (mesmo documento/valor/dia) se anulam
  const usados = new Set();
  ls.forEach((e, i) => {
    if (!/^Estorno de D/i.test(e.historico) || usados.has(i)) return;
    const j = ls.findIndex((x, k) => !usados.has(k) && k !== i && x.data === e.data && x.documento === e.documento && Math.abs(x.valor + e.valor) < 0.005 && x.valor < 0);
    if (j >= 0) { usados.add(i); usados.add(j); }
  });
  ls = ls.filter((_, i) => !usados.has(i)).reverse(); // BB vem do mais recente para o mais antigo
  return { saldoAnterior, lancamentos: ls, declarado };
}

// ============================== CAIXA ==============================
function lerCaixa(paginas) {
  const out = [];
  for (const linhas of paginas) {
    for (const l of linhas) {
      const d = dataBR(col(l, 0, 130));
      if (!d) continue;
      const hist = col(l, 300, 450);
      if (/^SALDO DIA/i.test(hist)) continue;
      const v = valorBR(col(l, 450, 512));
      if (v === null) continue;
      const doc = col(l, 240, 300);
      out.push({ data: d, historico: hist, documento: doc && doc !== "0" ? doc : null, identificacao: null, valor: v, _saldo: valorBR(col(l, 512, 9999)) });
    }
  }
  // o extrato Caixa mostra o saldo sem sinal: testa as duas leituras (positivo / negativo)
  let sequencia = null, saldoAnterior = null;
  for (const sinal of [1, -1]) {
    const ant = out.length && out[0]._saldo !== null ? r2(sinal * out[0]._saldo - out[0].valor) : null;
    const seq = conferirSequencia(out, ant, sinal);
    if (seq.ok || !sequencia) { sequencia = seq; saldoAnterior = ant; }
    if (seq.ok) break;
  }
  out.forEach((o) => delete o._saldo);
  return { saldoAnterior, lancamentos: out, sequencia };
}

// confere linha a linha: saldo anterior + valor = saldo impresso (pega linha pulada ou valor lido errado)
function conferirSequencia(ls, saldoAnterior, sinal) {
  if (saldoAnterior === null || !ls.length) return { ok: null };
  let s = saldoAnterior;
  for (let i = 0; i < ls.length; i++) {
    s = r2(s + ls[i].valor);
    if (ls[i]._saldo === null || ls[i]._saldo === undefined) continue;
    if (Math.abs(s - sinal * ls[i]._saldo) > 0.01) {
      return { ok: false, msg: `saldo não confere a partir de ${ls[i].data.split("-").reverse().join("/")} · ${ls[i].historico} (esperado R$ ${sinal * ls[i]._saldo}, calculado R$ ${s})` };
    }
  }
  return { ok: true };
}

// ------------------------------------------------------------------
export const LEITORES = {
  BRADESCO_EXTRATO: { banco: "BRADESCO PJ", ler: lerBradesco },
  ITAU_EXTRATO: { banco: "ITAU PJ", ler: lerItau },
  INTER_EXTRATO: { banco: "INTER PJ", ler: lerInter },
  C6_EXTRATO: { banco: "C6BANK EXTRATO", ler: lerC6 },
  BB_EXTRATO: { banco: "BB PJ", ler: lerBB },
  CAIXA_EXTRATO: { banco: "CAIXA PJ", ler: lerCaixa },
};

export async function lerArquivo(codigo, buf, senha) {
  const L = LEITORES[codigo];
  if (!L) return null;
  const paginas = await linhasPdf(buf, senha);
  const r = L.ler(paginas);
  r.lancamentos = r.lancamentos.filter((x) => x.data && x.valor !== null && x.valor !== 0);
  r.prova = provaExtrato(r, paginas);
  return { banco: L.banco, ...r };
}

// ======================================================================
//  PROVA REAL: compara o que foi lido com o que o próprio PDF declara
//  → { ok: true | false | null(sem referência), checks: [{rotulo, pdf, lido, ok}], msg }
// ======================================================================
const semTexto = (paginas) => paginas.every((ls) => ls.length === 0);
function fechar(checks, vazio, extraMsg) {
  if (vazio) return { ok: false, checks, msg: vazio };
  const falhas = checks.filter((c) => c.ok === false);
  if (falhas.length) return { ok: false, checks, msg: falhas.map((c) => `${c.rotulo}: PDF ${c.pdf} × lido ${c.lido}`).join(" · ") + (extraMsg ? ` · ${extraMsg}` : "") };
  if (!checks.some((c) => c.ok === true)) return { ok: null, checks, msg: extraMsg || "O PDF não traz total de referência para conferir." };
  return { ok: true, checks, msg: checks.filter((c) => c.ok).map((c) => `${c.rotulo} ${c.pdf}`).join(" · ") };
}
const chk = (rotulo, pdf, lido, tol = 0.01) => (pdf === null || pdf === undefined ? null : { rotulo, pdf: r2(pdf), lido: r2(lido), ok: Math.abs(pdf - lido) <= tol });

function provaExtrato(r, paginas) {
  if (semTexto(paginas)) return fechar([], "PDF sem texto (imagem/impressão) — não dá para ler.");
  const ls = r.lancamentos;
  const cred = ls.filter((x) => x.valor > 0).reduce((a, x) => a + x.valor, 0);
  const deb = ls.filter((x) => x.valor < 0).reduce((a, x) => a + x.valor, 0);
  const d = r.declarado || {};
  const checks = [
    chk("créditos", d.creditos, cred), chk("débitos", d.debitos, deb),
    r.saldoAnterior !== null && r.saldoAnterior !== undefined && d.saldoFinal !== null && d.saldoFinal !== undefined
      ? chk("saldo final", d.saldoFinal, r.saldoAnterior + cred + deb) : null,
  ].filter(Boolean);
  if (r.sequencia && r.sequencia.ok !== null) checks.push({ rotulo: "saldo linha a linha", pdf: "ok", lido: r.sequencia.ok ? "ok" : "erro", ok: r.sequencia.ok });
  const vazio = ls.length ? null : (Object.values(d).some((v) => v) ? "Nenhum lançamento lido, mas o PDF tem movimento — formato pode ter mudado." : null);
  return fechar(checks, vazio, r.sequencia && r.sequencia.ok === false ? r.sequencia.msg : (!ls.length ? "Extrato sem movimentação." : ""));
}

// ======================================================================
//  DOCUMENTOS DE DETALHAMENTO (faturas, cobrança, folha, iFood, pagamentos Itaú)
//  Devolvem { modo, total, dataRef, itens:[{data, historico, identificacao, valor}] }
//  valor do ponto de vista da empresa: despesa NEGATIVA, recebimento POSITIVO.
// ======================================================================
const MES3 = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const soma = (its) => r2(its.reduce((a, i) => a + i.valor, 0));
const todasLinhas = (paginas) => paginas.flatMap((ls, p) => ls.map((l) => ({ ...l, p })));
const ddmm = (s) => { const m = String(s || "").match(/^(\d{2})\/(\d{2})$/); return m ? m : null; };
// compra "dd/mm" sem ano → ano coerente com o vencimento (compra de dez com vencimento em jan = ano anterior)
const dataCompra = (dm, venc) => {
  const [, d, m] = dm; const [va, vm] = venc.split("-").map(Number);
  const ano = Number(m) > vm ? va - 1 : va;
  return `${ano}-${m}-${d}`;
};

// ---------- Fatura Bradesco (1 PDF por portador) ----------
function lerFaturaBradesco(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const venc = dataBR((t.match(/Data de vencimento:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
  const portador = ((t.match(/Nome:\s*([^\n]+)/) || [])[1] || "").replace(/\s*-\s*(VISA|MASTER\w*|ELO)\s*$/i, "").trim();
  let total = null; const itens = [];
  for (const l of ls) {
    const d = col(l, 0, 105);
    if (/^Total:?$/i.test(d)) { total = valorBR(col(l, 480, 9999)); break; }
    const dm = ddmm(d); if (!dm || !venc) continue;
    const v = valorBR(col(l, 480, 9999)); if (v === null) continue;
    const h = col(l, 105, 430);
    itens.push({ data: dataCompra(dm, venc), historico: h, identificacao: `${portador} · COMPRA ${d}`, valor: -v });
  }
  return { modo: "FATURA", total: total !== null ? -total : soma(itens), totalDeclarado: total !== null ? -total : null, dataRef: venc, portador, itens };
}

// ---------- Fatura Itaú (vários portadores) ----------
function lerFaturaItau(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const venc = dataBR((t.match(/vencimento:[^\n]*\n[^\n]*?(\d{2}\/\d{2}\/\d{4})/) || t.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
  const total = valorBR((t.match(/Total da fatura\s+(R\$\s*-?[\d.]+,\d{2})/) || [])[1]);
  let dentro = false, portador = "";
  const itens = [];
  for (const l of ls) {
    const s = txt(l);
    if (/^Lançamentos$/i.test(s)) { dentro = true; continue; }
    if (/^Encargos desta fatura/i.test(s)) break;
    if (!dentro) continue;
    const mp = s.match(/^(.+?)\s+-\s+FINAL\s+(\d{4})$/i); if (mp) { portador = mp[1].trim(); continue; }
    const dm = ddmm(col(l, 0, 100)); if (!dm || !venc) continue;
    const v = valorBR(col(l, 480, 9999)); if (v === null) continue;
    const h = col(l, 100, 480);
    if (/PAGAMENTO EFETUADO/i.test(h)) continue;
    itens.push({ data: dataCompra(dm, venc), historico: h, identificacao: `${portador} · COMPRA ${dm[0]}`, valor: -v });
  }
  return { modo: "FATURA", total: total !== null ? -total : soma(itens), totalDeclarado: total !== null ? -total : null, dataRef: venc, itens };
}

// ---------- Fatura Inter ----------
function lerFaturaInter(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const venc = dataBR((t.match(/(?:Data de )?Vencimento\s*(\d{2}\/\d{2}\/\d{4})/i) || t.match(/VENCIMENTO\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1]);
  let total = null; const itens = [];
  for (const l of ls) {
    const s = txt(l);
    const mt = s.match(/^Total CART[ÃA]O.*?R\$\s*([\d.]+,\d{2})/i); if (mt) { total = (total || 0) + valorBR(mt[1]); continue; }
    const m = semAcento(col(l, 0, 75)).toUpperCase().match(/^(\d{1,2}) DE ([A-Z]{3})\.? (\d{4})$/);
    if (!m || !MES3[m[2]]) continue;
    const vt = col(l, 380, 9999);
    if (/^\+/.test(vt)) continue; // pagamento/crédito da fatura anterior
    const v = valorBR(vt); if (v === null) continue;
    itens.push({ data: `${m[3]}-${String(MES3[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`, historico: col(l, 75, 295), identificacao: `COMPRA ${m[1]}/${String(MES3[m[2]]).padStart(2, "0")}`, valor: -Math.abs(v) });
  }
  return { modo: "FATURA", total: total !== null ? -r2(total) : soma(itens), totalDeclarado: total !== null ? -r2(total) : null, dataRef: venc, itens };
}

// ---------- Fatura C6 (texto; o PDF original vem com senha) ----------
function lerFaturaC6(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const mv = semAcento(t).match(/Vencimento:\s*(\d{1,2}) de ([A-Za-z]+)/i);
  const anoM = t.match(/fechamento desta fatura em (\d{2})\/(\d{2})\/(\d{2})/i);
  let venc = null;
  if (mv && MESES[mv[2].toUpperCase()]) {
    const ano = anoM ? "20" + anoM[3] : String(new Date().getFullYear());
    venc = `${ano}-${String(MESES[mv[2].toUpperCase()]).padStart(2, "0")}-${mv[1].padStart(2, "0")}`;
  }
  const total = valorBR((t.match(/Total a pagar\s+R\$\s*([\d.]+,\d{2})/i) || [])[1]);
  const itens = [];
  let portador = "";
  for (const l of ls) {
    const s = txt(l);
    const mp = s.match(/Final\s+(\d{4})\s*-\s*([^\n]+?)\s{2,}/i) || s.match(/Final\s+(\d{4})\s*-\s*(.+)$/i);
    if (mp) { portador = mp[2].replace(/Cart[aã]o Virtual.*$/i, "").trim(); continue; }
    const m = semAcento(s).match(/^(\d{1,2}) ([a-z]{3})\s+(.+?)\s+(-?[\d.]+,\d{2})$/i);
    if (!m || !MES3[m[2].toUpperCase()] || !venc) continue;
    if (/PAG(AMENTO)? ?FATURA|ESTORNO|INCLUSAO DE PAGAMENTO/i.test(m[3])) continue;
    const mm = String(MES3[m[2].toUpperCase()]).padStart(2, "0");
    itens.push({ data: dataCompra([null, m[1].padStart(2, "0"), mm], venc), historico: m[3], identificacao: `${portador} · COMPRA ${m[1].padStart(2, "0")}/${mm}`.replace(/^ · /, ""), valor: -valorBR(m[4]) });
  }
  return { modo: "FATURA", total: total !== null ? -total : soma(itens), totalDeclarado: total !== null ? -total : null, dataRef: venc, itens };
}

// ---------- Fatura Banco do Brasil (1 PDF por portador) ----------
function lerFaturaBB(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const venc = dataBR((t.match(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
  const total = valorBR((t.match(/Valor da fatura:\s*R\$\s*([\d.]+,\d{2})/) || [])[1]);
  const boleto = ((t.match(/(\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6})/) || [])[1] || "").replace(/\D/g, "");
  let portador = "";
  const itens = [];
  for (const l of ls) {
    const s = txt(l);
    const mp = s.match(/^(.+?)\s*\(Cart[ãa]o\s*(\d{4})\)/); if (mp) { portador = mp[1].trim(); continue; }
    const dm = ddmm(col(l, 0, 70)); if (!dm || !venc) continue;
    const v = valorBR(col(l, 495, 9999)); if (v === null) continue;
    const h = [col(l, 70, 390), col(l, 390, 450)].filter(Boolean).join(" ");
    if (/PGTO DEBITO CONTA|PAGAMENTO/i.test(h) && v < 0) continue;
    itens.push({ data: dataCompra(dm, venc), historico: h, identificacao: `${portador || "EMPRESA"} · COMPRA ${dm[0]}`, valor: -v });
  }
  return { modo: "FATURA", total: total !== null ? -total : soma(itens), totalDeclarado: total !== null ? -total : null, dataRef: venc, boleto, itens };
}

// ---------- Fatura Caixa (Elo) ----------
function lerFaturaCaixa(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const venc = dataBR((t.match(/VENCIMENTO\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
  const total = valorBR((t.match(/Valor total desta fatura\s*R\$\s*([\d.]+,\d{2})/i) || [])[1]);
  let portador = "";
  const itens = [];
  for (const l of ls) {
    const dir = col(l, 300, 9999);
    const mp = dir.match(/^(.+?)\s*\(Cart[ãa]o\s*\d{4}\)$/); if (mp) { portador = mp[1].trim(); continue; }
    const vt = col(l, 525, 9999);
    if (!/[\d.]+,\d{2}\s*[DC]$/.test(vt)) continue;
    const dataTxt = ddmm(col(l, 300, 330)) ? col(l, 300, 330) : "";
    const h = col(l, dataTxt ? 330 : 300, 425);
    if (!h || /^Total|^TOTAL DA FATURA ANTERIOR|OBRIGADO PELO PAGAMENTO|Crédito\/Débito/i.test(h)) continue;
    const v = valorBR(vt);
    if (!v) continue;
    const dm = ddmm(dataTxt);
    itens.push({
      data: dm && venc ? dataCompra(dm, venc) : venc, historico: h.replace(/\s+/g, " "),
      identificacao: `${portador || "EMPRESA"}${dm ? ` · COMPRA ${dm[0]}` : ""}`,
      valor: v, // "D" já vem negativo (despesa); "C" (ajuste/crédito) positivo
    });
  }
  return { modo: "FATURA", total: total !== null ? -total : soma(itens), totalDeclarado: total !== null ? -total : null, dataRef: venc, itens };
}

// ---------- Bradesco · títulos pagos (cobrança) ----------
function lerCobranca(paginas) {
  const itens = [];
  let totalDeclarado = null;
  for (const linhas of paginas) {
    for (const l of linhas) if (/^Total$/i.test(col(l, 0, 60))) totalDeclarado = valorBR(col(l, 385, 450));
    const ancoras = linhas.filter((l) => dataBR(col(l, 240, 315)) && valorBR(col(l, 385, 450)) !== null);
    for (const a of ancoras) {
      const nomes = [col(a, 125, 185)];
      for (const l of linhas) if (l.y < a.y && a.y - l.y <= 26 && !ancoras.includes(l) && col(l, 125, 185) && !col(l, 0, 125)) {
        const prox = ancoras.find((b) => b.y < a.y && b.y >= l.y); if (!prox) nomes.push(col(l, 125, 185));
      }
      itens.push({
        data: dataBR(col(a, 240, 315)), historico: `BOLETO RECEBIDO ${nomes.join(" ").replace(/\s+/g, " ")}`,
        identificacao: `TÍTULO ${col(a, 55, 125)} · VENC ${col(a, 180, 240)}`, valor: valorBR(col(a, 385, 450)),
      });
    }
  }
  return { modo: "COBRANCA", total: soma(itens), totalDeclarado, itens };
}

// ---------- Bradesco · comprovantes de folha (1 por página) ----------
function lerFolha(paginas) {
  const itens = [];
  for (const linhas of paginas) {
    const t = linhas.map(txt).join("\n");
    const nome = (t.match(/Funcionário:\s*(.+?)\s+CPF:/) || [])[1];
    const cpf = (t.match(/CPF:\s*([\d.\-]+)/) || [])[1];
    const data = dataBR((t.match(/Pagamento:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
    const v = valorBR((t.match(/Valor \(R\$\):\s*([\d.]+,\d{2})/) || [])[1]);
    if (nome && data && v) itens.push({ data, historico: `SALÁRIO ${nome.trim()}`, identificacao: cpf ? `CPF ${cpf}` : null, valor: -v });
  }
  return { modo: "FOLHA", total: soma(itens), qtdDeclarada: paginas.filter((ls) => ls.some((l) => /Comprovante de Pagamento/i.test(txt(l)))).length, itens };
}

// ---------- iFood Benefícios · relatório de recarga ----------
const BENEFICIOS = [[150, 205, "ALIMENTAÇÃO + REFEIÇÃO"], [205, 250, "COMER NO IFOOD"], [250, 294, "MOBILIDADE"], [294, 338, "CULTURA"], [338, 382, "EDUCAÇÃO"], [382, 425, "SAÚDE & BEM ESTAR"], [425, 469, "FARMÁCIA"], [469, 513, "HOME OFFICE"], [513, 600, "LIVRE"]];
function lerIfood(paginas) {
  const ls = todasLinhas(paginas);
  const t = ls.map(txt).join("\n");
  const id = (t.match(/ID da recarga:?\s*\n?\s*(#\w+)/) || t.match(/(#\w{3,})/) || [])[1] || "";
  const total = valorBR((t.match(/Valor total da recarga\s*[^\n]*\n\s*(R\$\s*[\d.]+,\d{2})/) || t.match(/R\$\s*([\d.]+,\d{2})/) || [])[1]);
  const criacao = dataBR((t.match(/Data de criação:[\s\S]*?(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
  const mq = t.match(/Valor total da recarga\s+Colaboradores[^\n]*\n\s*R\$\s*[\d.]+,\d{2}\s+(\d+)/);
  const qtdDeclarada = mq ? Number(mq[1]) : null;
  const cpfs = new Set();
  const itens = [];
  for (let p = 0; p < paginas.length; p++) {
    const linhas = paginas[p];
    const ancoras = linhas.filter((l) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(col(l, 70, 150)));
    ancoras.forEach((a, k) => {
      const prox = ancoras[k + 1];
      const nome = [col(a, 0, 70), ...linhas.filter((l) => l.y < a.y && (!prox || l.y > prox.y) && a.y - l.y < 40 && col(l, 0, 70) && !col(l, 70, 9999)).map((l) => col(l, 0, 70))].join(" ").replace(/\s+/g, " ").trim();
      for (const [x0, x1, ben] of BENEFICIOS) {
        const v = valorBR(col(a, x0, x1));
        if (v) itens.push({ data: criacao, historico: `IFOOD ${ben} · ${nome}`, identificacao: `RECARGA ${id} · CPF ${col(a, 70, 150)}`, valor: -v });
        cpfs.add(col(a, 70, 150));
      }
    });
  }
  return { modo: "IFOOD", total: total !== null ? -total : soma(itens), totalDeclarado: total !== null ? -total : null, qtdDeclarada, qtdLida: cpfs.size, rotuloQtd: "colaboradores", dataRef: criacao, itens };
}

// ---------- Itaú · relatório de pagamentos / Pix (detalha o SISPAG) ----------
function lerPagamentosItau(paginas) {
  const itens = [];
  let qtdTodos = 0, somaTodos = 0, totalRel = null, qtdRel = null;
  for (const linhas of paginas) {
    linhas.forEach((l, k) => {
      const s = txt(l);
      const mt = s.match(/^total\s+R\$\s*([\d.]+,\d{2})\s+(\d+)\s+pagamentos/i);
      if (mt) { totalRel = valorBR(mt[1]); qtdRel = Number(mt[2]); return; }
      const m = s.match(/(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})\s+(efetuado|não efetuado|nao efetuado|agendado|cancelado|devolvido|pendente)\s*$/i);
      if (m) { qtdTodos++; somaTodos += valorBR(m[2]); }
      if (!m || !/^efetuado$/i.test(m[3])) return;
      const doc = (s.match(/(\*{3}\.\d{3}\.\d{3}-\*{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1] || "";
      // nome pode quebrar em 2 linhas, logo acima e logo abaixo da linha do valor
      const viz = linhas.filter((x) => x !== l && Math.abs(x.y - l.y) <= 6 && col(x, 0, 135) && !col(x, 135, 9999)).sort((a, b) => b.y - a.y);
      const nome = [...viz.filter((x) => x.y > l.y), l, ...viz.filter((x) => x.y < l.y)].map((x) => col(x, 0, 135)).filter(Boolean).join(" ");
      itens.push({ data: dataBR(m[1]), historico: `PAGAMENTO ${nome.replace(/\s+/g, " ").trim()}`, identificacao: doc || null, valor: -valorBR(m[2]) });
    });
  }
  return { modo: "PAGAMENTOS", total: soma(itens), itens,
    relatorio: { totalDeclarado: totalRel, qtdDeclarada: qtdRel, somaLida: r2(somaTodos), qtdLida: qtdTodos } };
}

export const LEITORES_DETALHE = {
  BRADESCO_FATURA: { banco: "CARTÃO BRD PJ", ler: lerFaturaBradesco },
  ITAU_FATURA: { banco: "CARTÃO ITAU PJ", ler: lerFaturaItau },
  INTER_FATURA: { banco: "CARTÃO INTER PJ", ler: lerFaturaInter },
  C6_FATURA: { banco: "CARTÃO C6 PJ", ler: lerFaturaC6 },
  BB_FATURA: { banco: "CARTÃO BB PJ", ler: lerFaturaBB },
  CAIXA_FATURA: { banco: "CARTÃO CAIXA PJ", ler: lerFaturaCaixa },
  BRADESCO_COBRANCA: { banco: null, ler: lerCobranca },
  BRADESCO_FOLHA: { banco: null, ler: lerFolha },
  IFOOD_RECARGA: { banco: null, ler: lerIfood },
  ITAU_PAGAMENTOS: { banco: null, ler: lerPagamentosItau },
};

export async function lerDetalhe(codigo, buf, senha) {
  const L = LEITORES_DETALHE[codigo];
  if (!L) return null;
  const paginas = await linhasPdf(buf, senha);
  const r = L.ler(paginas);
  const todos = r.itens.length;
  r.itens = r.itens.filter((i) => i.data && i.valor);
  r.semData = todos - r.itens.length;
  r.soma = soma(r.itens);
  r.bancoItens = L.banco;
  r.prova = provaDetalhe(r, paginas);
  return r;
}

function provaDetalhe(r, paginas) {
  if (semTexto(paginas)) return fechar([], "PDF sem texto (imagem/impressão) — não dá para ler. Envie o PDF original.");
  const checks = [];
  if (r.modo === "PAGAMENTOS") {
    const rel = r.relatorio || {};
    const c1 = chk("total do relatório", rel.totalDeclarado, rel.somaLida); if (c1) checks.push(c1);
    const c2 = chk("nº de pagamentos", rel.qtdDeclarada, rel.qtdLida, 0); if (c2) checks.push(c2);
  } else {
    const c = chk(r.modo === "FATURA" ? "total da fatura" : r.modo === "IFOOD" ? "total da recarga" : "total", r.totalDeclarado, r.soma); if (c) checks.push(c);
    if (r.qtdDeclarada !== null && r.qtdDeclarada !== undefined) {
      const q = chk(r.rotuloQtd || "nº de comprovantes", r.qtdDeclarada, r.qtdLida !== undefined ? r.qtdLida : r.itens.length, 0); if (q) checks.push(q);
    }
  }
  if (r.semData) checks.push({ rotulo: "itens sem data", pdf: 0, lido: r.semData, ok: false });
  const zerada = r.totalDeclarado !== null && r.totalDeclarado !== undefined && Math.abs(r.totalDeclarado) < 0.005;
  const vazio = !r.itens.length && !zerada && !(r.modo === "PAGAMENTOS" && r.relatorio?.qtdDeclarada === 0) ? "Nenhum item lido — o formato do PDF pode ter mudado." : null;
  return fechar(checks, vazio, zerada ? "Fatura zerada." : "");
}
