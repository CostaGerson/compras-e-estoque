// Propostas de contas recorrentes a partir da Matriz de custos oficial.
// · itens marcados como CDB + provisões do pessoal → UMA conta "PROVISÃO GERAL (CDB)" no dia 30
// · demais custos → uma conta recorrente cada (pessoal: salário por pessoa + guias/benefícios com rateio por área)
// · faturas de cartão (Bradesco, BB, Itaú, Caixa) com valor zero
import { calcularMatriz } from "@/lib/matriz";

const N = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// conta-caixa sugerida por área/nome (o usuário ajusta depois)
function contaItem(area, nome) {
  const n = N(nome);
  if (area === "vidaVegetativa") return "2121000";
  if (area === "sistemas") return "2122000";
  if (area === "logistica") {
    if (n.includes("PARCELA")) return "2131100";
    if (n.includes("IPVA")) return "2134000";
    if (n.includes("ELEVADOR")) return "2121000";
    return "2116200";
  }
  if (area === "administracao") {
    if (/SINDICAL|TFLF|TFLS|TX |TAXA/.test(n)) return "2134000";
    if (/TAR\.? |TARIFA/.test(n)) return "2132000";
    if (/SEGURO VIDA|PCMSO|ASO|PLANO/.test(n)) return "2128100";
    if (/CONFRATERNIZ|NATALINO/.test(n)) return "2124000";
    if (/FIEMG|JOVEM|EDUCA/.test(n)) return "2125000";
    return "2122000";
  }
  if (area === "dividas") {
    if (/MAYCON|MUTUO|SOCIO/.test(n)) return "2131200";
    if (/TRIBUT/.test(n)) return "2115110";   // parcelamento de tributos = impostos sobre vendas
    if (/MAQ|WELLTEC/.test(n)) return "2133300";
    return "2131100";
  }
  return "2220000";
}
const CONTA_DEPTO = { DIR: "2126000", ADM: "2128200", COR: "2113100", SIL: "2113310", BOR: "2113320", COS: "2113500", EXP: "2113200", LOG: "2113600" };
const ADM = (d) => d === "DIR" || d === "ADM";
// Adiantamento salarial: 40% do salário base, pago no dia 20 e abatido do salário do dia 5.
export const PCT_ADIANTAMENTO = 0.4;
// Pró-labore dos sócios (IGOR, PEDRO, MAYCON): fixo por mês
export const PRO_LABORE_FIXO = 6000;

// soma por conta → rateio em % (fecha 100 no último)
function rateioDe(mapa) {
  const tot = Object.values(mapa).reduce((s, v) => s + v, 0);
  const ents = Object.entries(mapa).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!tot || !ents.length) return [];
  let acc = 0;
  return ents.map(([codigo, v], i) => {
    const pct = i === ents.length - 1 ? r2(100 - acc) : r2((v / tot) * 100);
    acc = r2(acc + pct);
    return { codigo, pct };
  });
}

export function propostasDaMatriz(dados) {
  const calc = calcularMatriz(dados);
  const out = [];
  const add = (o) => out.push({ dia: 10, parceiro: "A DEFINIR", ...o, valor: r2(o.valor) });

  for (const [area, grupo] of [["vidaVegetativa", "Vida vegetativa"], ["logistica", "Logística/Manutenção"], ["administracao", "Administração"], ["sistemas", "Sistemas"], ["dividas", "Dívidas"]]) {
    for (const it of dados[area] || []) {
      if (it.ativo === false || it.cdb) continue; // CDB entra na provisão geral
      // o item pode definir dia próprio e periodicidade; num item periódico o `valor` da Matriz
      // é o peso MENSAL e `valorParcela` é o que sai do caixa de fato naquele mês
      const per = Math.max(1, Number(it.periodicidade) || 1);
      add({
        chave: `MATRIZ|${area}|${it.id}`, grupo, titulo: it.natureza,
        valor: per > 1 ? (it.valorParcela ?? r2(Number(it.valor) * per)) : it.valor,
        pesoMensal: r2(it.valor), periodicidade: per, inicio: it.inicio || null,
        ...(it.dia ? { dia: Number(it.dia) } : {}),
        ...(it.parceiro ? { parceiro: String(it.parceiro).toUpperCase() } : {}),
        rateio: [{ codigo: contaItem(area, it.natureza), pct: 100 }],
      });
    }
  }

  // Pessoal, um pagamento por data:
  //   SALÁRIO (5º dia útil)  = salário líquido − adiantamento + bônus + assiduidade
  //                            (o desconto de 6% do VT não sai daqui: sai do iFood)
  //   ADIANTAMENTO (dia 20)  = 40% do salário base de quem tem a caixa marcada na matriz
  //   IFOOD (dia 29)         = VT já líquido dos 6% + VA + saldo livre
  //   INSS e FGTS (dia 20)   · PLANO DE SAÚDE (dia 10) · provisões → PROVISÃO GERAL (CDB)
  // A soma das linhas dá exatamente o custo de pessoal da Matriz.
  const sal = {}, adi = {}, inss = {}, fgts = {}, ifood = {}, ps = {};
  const soma = (m, k, v) => { if (v) m[k] = (m[k] || 0) + v; };
  const quemAdi = [];
  const socios = [];   // pró-labore: conta própria por sócio, mesmo vencimento do salário (5º dia útil com sábado)
  for (const p of calc.pessoas) {
    const c = p.c;
    if (p.regime === "DIRETOR" || p.depto === "DIR") socios.push(p);
    const conta = CONTA_DEPTO[p.depto] || "2128200";
    const adiant = p.adiantamento ? r2(c.F * PCT_ADIANTAMENTO) : 0;   // 40% do salário base
    if (adiant) quemAdi.push(p.nome || p.cargo);
    soma(adi, conta, adiant);
    // c.liquido já traz o desconto do VT (c.vtDesc, negativo); aqui ele volta, porque
    // quem fica com esse desconto é o iFood, não a folha do dia 5
    if (!(p.regime === "DIRETOR" || p.depto === "DIR")) soma(sal, conta, c.liquido - c.vtDesc + c.G + c.ass - adiant);
    soma(inss, conta, c.inssPatronal + c.inssFunc);
    soma(fgts, conta, c.fgts);
    soma(ifood, ADM(p.depto) ? "2128300" : "2113400", c.vt + c.vtDesc);   // VT líquido dos 6%
    soma(ifood, ADM(p.depto) ? "2128100" : "2113700", c.vr + c.saldoLivre);
    soma(ps, ADM(p.depto) ? "2128100" : "2113700", c.ps);
  }
  const tot = (m) => Object.values(m).reduce((s, v) => s + v, 0);
  for (const p of socios) {
    add({ chave: `MATRIZ|pessoal|PROLABORE|${p.id}`, grupo: "Pessoal", titulo: `PRÓ-LABORE ${p.nome || p.cargo}`, parceiro: p.nome || p.cargo,
      valor: PRO_LABORE_FIXO, dia: 5, util: true, rateio: [{ codigo: "2126000", pct: 100 }],
      obs: "Pró-labore fixo do sócio — vence junto com o salário (5º dia útil, sábado conta)" });
  }
  add({ chave: "MATRIZ|pessoal|SALARIO", grupo: "Pessoal", titulo: "SALÁRIO", parceiro: "FOLHA DE PAGAMENTO", valor: tot(sal), dia: 5, util: true, rateio: rateioDe(sal),
    obs: `Líquido de ${calc.pessoas.length - socios.length} funcionário(s) + bônus + assiduidade − adiantamento do dia 20 · sócios no pró-labore`
      + ` · VT, VA e saldo livre vão no iFood (dia 29); encargos, plano de saúde e provisões têm linha própria` });
  add({ chave: "MATRIZ|pessoal|ADIANTAMENTO", grupo: "Pessoal", titulo: "ADIANTAMENTO SALARIAL", parceiro: "FOLHA DE PAGAMENTO", valor: tot(adi), dia: 20,
    rateio: tot(adi) ? rateioDe(adi) : [{ codigo: "2128200", pct: 100 }],
    obs: quemAdi.length ? `40% do salário base: ${quemAdi.join(", ")}` : "Ninguém marcado com adiantamento na matriz" });
  if (tot(inss)) add({ chave: "MATRIZ|pessoal|INSS", grupo: "Pessoal", titulo: "INSS (GPS) — PATRONAL + FUNCIONÁRIOS", parceiro: "RECEITA FEDERAL", valor: tot(inss), dia: 20, rateio: rateioDe(inss) });
  if (tot(fgts)) add({ chave: "MATRIZ|pessoal|FGTS", grupo: "Pessoal", titulo: "FGTS", parceiro: "CAIXA ECONÔMICA FEDERAL", valor: tot(fgts), dia: 20, rateio: rateioDe(fgts) });
  if (tot(ifood)) add({ chave: "MATRIZ|pessoal|IFOOD", grupo: "Pessoal", titulo: "IFOOD", parceiro: "IFOOD BENEFÍCIOS", valor: tot(ifood), dia: 29, rateio: rateioDe(ifood),
    obs: "Vale-transporte já líquido do desconto de 6%, vale-alimentação e saldo livre" });
  if (tot(ps)) add({ chave: "MATRIZ|pessoal|PS", grupo: "Pessoal", titulo: "PLANO DE SAÚDE", valor: tot(ps), dia: 10, rateio: rateioDe(ps) });

  // provisão geral (CDB)
  add({
    chave: "MATRIZ|CDB", grupo: "Provisão (CDB)", titulo: "PROVISÃO GERAL (CDB)", parceiro: "MERIDIAN (APLICAÇÃO CDB)", valor: calc.cdb, dia: 30,
    rateio: [{ codigo: "2133100", pct: 100 }],
    obs: `Provisões do pessoal ${r2(calc.cdbPessoal)} + ${calc.cdbItens.map((i) => i.natureza).join(", ")}`,
  });

  // faturas de cartão (valor do mês informado na conferência)
  for (const b of ["BRADESCO", "BB", "ITAÚ", "CAIXA"]) {
    add({ chave: `CARTAO|${N(b)}`, grupo: "Cartões", titulo: `FATURA CARTÃO ${b}`, parceiro: b === "BB" ? "BANCO DO BRASIL" : b === "CAIXA" ? "CAIXA ECONÔMICA FEDERAL" : b, valor: 0, dia: 10,
      rateio: [{ codigo: "3000000", pct: 100 }], obs: "Os itens da fatura são identificados na análise mensal." });
  }
  return { propostas: out, totalMatriz: calc.custoNegocio };
}
