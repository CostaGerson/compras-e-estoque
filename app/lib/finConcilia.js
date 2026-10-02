// Conciliação "detalhamento x consolidado" (sem banco de dados — lógica pura).
// Regra do Igor: se a soma do detalhamento BATER com o lançamento consolidado do extrato,
// o consolidado sai e entram os itens; se não bater, vira crítica.

const r2 = (n) => Math.round(n * 100) / 100;
const igual = (a, b) => Math.abs(a - b) < 0.005;
const dias = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);
const somaV = (xs) => r2(xs.reduce((a, x) => a + x.valor, 0));

// Onde procurar o pagamento/recebimento consolidado de cada documento
export const PADROES = {
  BRADESCO_FATURA: { re: /BANCO BRADESCO S\.?A|BRADESCO CART|FATURA CART/i, ini: -3, fim: 12 },
  ITAU_FATURA: { re: /ITAU UNIBANCO|ITAU CART|FATURA CART|PAGAMENTO FATURA/i, ini: -3, fim: 12 },
  INTER_FATURA: { re: /FATURA|CART[AÃ]O INTER|BANCO INTER|DEBITO AUTOMATICO/i, ini: -3, fim: 12 },
  C6_FATURA: { re: /C6|FATURA/i, ini: -3, fim: 12 },
  BB_FATURA: { re: /PAGTO CART[AÃ]O CR[EÉ]DITO|PAGTO CARTAO|OUROCARD/i, ini: -3, fim: 15 },
  CAIXA_FATURA: { re: /CAIXA CART|CARTOES CAIXA|CARTAO CAIXA/i, ini: -3, fim: 12 },
  BRADESCO_COBRANCA: { re: /LIQUIDACAO DE COBRANCA/i, ini: 1, fim: 7 },
  BRADESCO_FOLHA: { re: /PAGAMENTO FUNCIONARIOS|PAGTO FUNCIONARIOS|FOLHA DE PAGAMENTO/i, ini: -3, fim: 3 },
  IFOOD_RECARGA: { re: /IFOOD/i, ini: -2, fim: 20 },
  ITAU_PAGAMENTOS: { re: /SISPAG/i, ini: -1, fim: 1 },
};
// Lançamentos do extrato que SEMPRE deveriam ter detalhamento
export const CONSOLIDADOS = [
  { re: /LIQUIDACAO DE COBRANCA/i, doc: "Títulos pagos (cobrança)" },
  { re: /PAGAMENTO FUNCIONARIOS|PAGTO FUNCIONARIOS/i, doc: "Comprovantes de folha" },
  { re: /IFOOD PAGO/i, doc: "Relatório de recarga iFood" },
  { re: /SISPAG/i, doc: "Relatório de pagamentos Itaú" },
  { re: /BANCO BRADESCO S\.?A|ITAU UNIBANCO HOLDING|CAIXA CARTOES|PAGTO CART[AÃ]O CR[EÉ]DITO/i, doc: "Fatura de cartão" },
];

// docs: [{ arquivoId, codigo, nome, r: {modo,total,dataRef,boleto,itens,bancoItens} }]
// → grupos: [{ chave, codigo, arquivoIds, modo, total, dataRef, itens, bancoItens, rotulo }]
export function montarGrupos(docs) {
  const grupos = [];
  const add = (g) => grupos.push({ ...g, total: r2(g.total) });
  // faturas Bradesco: 1 pagamento para todas as faturas do mesmo vencimento
  const brad = {};
  for (const d of docs) {
    const r = d.r; if (!r) continue;
    if (d.codigo === "BRADESCO_FATURA") { (brad[r.dataRef] = brad[r.dataRef] || []).push(d); continue; }
    if (r.modo === "FATURA" || r.modo === "IFOOD") {
      add({ chave: `A${d.arquivoId}`, codigo: d.codigo, arquivoIds: [d.arquivoId], modo: r.modo, total: r.total, dataRef: r.dataRef, itens: r.itens, bancoItens: r.bancoItens, rotulo: d.nome });
    }
  }
  for (const [venc, ds] of Object.entries(brad)) {
    const ids = ds.map((d) => d.arquivoId).sort((a, b) => a - b);
    add({ chave: `BRADFAT|${venc}|${ids.join(",")}`, codigo: "BRADESCO_FATURA", arquivoIds: ids, modo: "FATURA",
      total: ds.reduce((a, d) => a + d.r.total, 0), dataRef: venc, itens: ds.flatMap((d) => d.r.itens), bancoItens: ds[0].r.bancoItens,
      rotulo: `${ds.length} fatura(s) Bradesco · venc. ${venc.split("-").reverse().join("/")}` });
  }
  // cobrança / folha / pagamentos Itaú: agrupados por data (vários arquivos, sem repetir item)
  for (const [codigo, prefixo] of [["BRADESCO_COBRANCA", "COB"], ["BRADESCO_FOLHA", "FOL"], ["ITAU_PAGAMENTOS", "PAG"]]) {
    const ds = docs.filter((d) => d.codigo === codigo && d.r);
    const vistos = new Set();
    const porData = {};
    for (const d of ds) for (const it of d.r.itens) {
      const k = `${it.data}|${it.valor}|${it.historico}|${it.identificacao}`;
      if (vistos.has(k)) continue; vistos.add(k);
      (porData[it.data] = porData[it.data] || { itens: [], arq: new Set() }).itens.push(it);
      porData[it.data].arq.add(d.arquivoId);
    }
    for (const [data, g] of Object.entries(porData)) {
      add({ chave: `${prefixo}|${data}`, codigo, arquivoIds: [...g.arq], modo: ds[0].r.modo, total: somaV(g.itens), dataRef: data, itens: g.itens, bancoItens: null,
        rotulo: `${{ COB: "Boletos pagos em", FOL: "Folha de", PAG: "Pagamentos Itaú de" }[prefixo]} ${data.split("-").reverse().join("/")}` });
    }
  }
  return grupos;
}

// extrato: lançamentos disponíveis [{id, banco, data, historico, documento, valor}]
// Devolve resultados por grupo: { chave, ok, msg, vinculos:[ids], itens:[...], candidatos:[ids] }
export function conciliar(grupos, extrato, jaFeitos = new Set()) {
  const usados = new Set();
  const res = [];
  const ordem = { FOLHA: 1, IFOOD: 2, FATURA: 3, COBRANCA: 4, PAGAMENTOS: 5 };
  const lista = [...grupos].sort((a, b) => (ordem[a.modo] || 9) - (ordem[b.modo] || 9) || String(a.dataRef).localeCompare(String(b.dataRef)));

  for (const g of lista) {
    if (jaFeitos.has(g.chave)) continue;
    const P = PADROES[g.codigo] || { re: /$^/, ini: 0, fim: 0 };
    const sinal = g.total >= 0 ? 1 : -1;
    const brl = (v) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    if (!g.itens.length || igual(g.total, 0)) { res.push({ chave: g.chave, ok: true, msg: "Sem valores no período (nada a substituir).", vinculos: [], itens: [] }); continue; }

    // Pagamentos Itaú: o que já aparece um a um no extrato não precisa de nada
    if (g.modo === "PAGAMENTOS") {
      const resto = [];
      for (const it of g.itens) {
        const l = extrato.find((x) => !usados.has(x.id) && /^ITAU/i.test(x.banco) && x.data === it.data && igual(x.valor, it.valor) && !/SISPAG/i.test(x.historico));
        if (l) usados.add(l.id); else resto.push(it);
      }
      if (!resto.length) { res.push({ chave: g.chave, ok: true, msg: "Pagamentos já detalhados no extrato.", vinculos: [], itens: [] }); continue; }
      g.itens = resto; g.total = somaV(resto);
    }

    const cand = extrato.filter((x) => !usados.has(x.id) && P.re.test(x.historico) && Math.sign(x.valor) === sinal
      && g.dataRef && dias(x.data, g.dataRef) >= P.ini && dias(x.data, g.dataRef) <= P.fim);

    let vinc = null;
    // 1) um lançamento com o valor exato (o mais próximo da data)
    const um = cand.filter((x) => igual(x.valor, g.total)).sort((a, b) => Math.abs(dias(a.data, g.dataRef)) - Math.abs(dias(b.data, g.dataRef)))[0];
    if (um) vinc = [um];
    // 2) pagamento dividido com o mesmo nº de documento (ex.: BB 882,61 + 3.012,58)
    if (!vinc) {
      const porDoc = {};
      cand.filter((x) => x.documento).forEach((x) => (porDoc[x.documento] = porDoc[x.documento] || []).push(x));
      const hit = Object.values(porDoc).find((xs) => xs.length > 1 && igual(somaV(xs), g.total));
      if (hit) vinc = hit;
    }
    // 3) dois lançamentos quaisquer que somem o total
    if (!vinc && cand.length <= 40) {
      for (let i = 0; i < cand.length && !vinc; i++) for (let j = i + 1; j < cand.length && !vinc; j++) if (igual(cand[i].valor + cand[j].valor, g.total)) vinc = [cand[i], cand[j]];
    }

    if (vinc) {
      vinc.forEach((x) => usados.add(x.id));
      const ultimo = vinc.map((x) => x.data).sort().pop();
      const banco = g.bancoItens || vinc[0].banco;
      res.push({
        chave: g.chave, ok: true, vinculos: vinc.map((x) => x.id),
        msg: `Bateu com ${vinc.length > 1 ? `${vinc.length} lançamentos` : "o lançamento"} de ${vinc[0].banco} em ${ultimo.split("-").reverse().join("/")} (R$ ${brl(g.total)}).`,
        itens: g.itens.map((it) => ({ ...it, banco, data: g.modo === "FATURA" || g.modo === "IFOOD" || g.modo === "COBRANCA" ? ultimo : it.data })),
      });
    } else {
      const perto = cand.length ? cand : extrato.filter((x) => !usados.has(x.id) && Math.sign(x.valor) === sinal && g.dataRef && Math.abs(dias(x.data, g.dataRef)) <= 15);
      // o lançamento consolidado cairia só no mês seguinte (ex.: boletos pagos no último dia útil)
      const fimMes = g.dataRef ? new Date(Date.UTC(+g.dataRef.slice(0, 4), +g.dataRef.slice(5, 7), 0)).toISOString().slice(0, 10) : null;
      if (!cand.length && fimMes && P.ini > 0 && dias(fimMes, g.dataRef) < P.ini) {
        res.push({ chave: g.chave, ok: false, aviso: true, vinculos: [], itens: g.itens, candidatos: [],
          msg: `R$ ${brl(g.total)} entra no extrato só no mês seguinte — será conferido lá.` });
        continue;
      }
      res.push({
        chave: g.chave, ok: false, vinculos: [], itens: g.itens,
        msg: cand.length
          ? `Detalhamento soma R$ ${brl(g.total)}, mas nenhum lançamento do extrato bate. Mais próximo: R$ ${brl(cand.sort((a, b) => Math.abs(a.valor - g.total) - Math.abs(b.valor - g.total))[0].valor)} (diferença R$ ${brl(cand[0].valor - g.total)}).`
          : `Detalhamento soma R$ ${brl(g.total)} e não há lançamento correspondente no extrato (o extrato do banco pagador foi enviado?).`,
        candidatos: perto.slice(0, 30).map((x) => x.id),
      });
    }
  }
  return res;
}
