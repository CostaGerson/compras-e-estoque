// Leitura do "Extrato de identificações" exportado do sistema financeiro anterior (.txt, separado por TAB).
// Linha de lançamento: \tBANCO\tDD/MM/AAAA\tHISTÓRICO\tDOCUMENTO\tIDENTIFICAÇÃO\tCONTA-CAIXA\tDESCRIÇÃO\tVALOR\t  (saldo vem na linha seguinte)

// nomes de banco do sistema anterior → nomes usados pelos leitores deste sistema
const BANCOS = {
  "CARTÃO BB PJ - PDF": "CARTÃO BB PJ",
  "CARTAO ITAU PJ BUSINESS": "CARTÃO ITAU PJ",
  "C6BANK CARTÃO": "CARTÃO C6 PJ",
};

const numBR = (s) => {
  const t = String(s || "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

export function lerHistorico(texto) {
  const linhas = String(texto || "").replace(/\r/g, "").split("\n");
  const itens = [];
  const erros = [];
  linhas.forEach((l, i) => {
    if (!/^\t[^\t]+\t\d{2}\/\d{2}\/\d{4}\t/.test(l)) return;
    const f = l.split("\t");
    const [dd, mm, aa] = f[2].split("/");
    const valor = numBR(f[8]);
    if (valor === null || !valor) { erros.push({ linha: i + 1, msg: "valor inválido" }); return; }
    const bancoOrig = f[1].trim().toUpperCase();
    itens.push({
      linha: i + 1,
      competencia: `${aa}-${mm}`,
      data: `${aa}-${mm}-${dd}`,
      banco: BANCOS[bancoOrig] || bancoOrig,
      historico: (f[3] || "").trim().toUpperCase() || "(SEM HISTÓRICO)",
      documento: (f[4] || "").trim() || null,
      identificacao: (f[5] || "").trim().toUpperCase() || null,
      contaCodigo: (f[6] || "").trim(),
      contaNome: (f[7] || "").trim().toUpperCase(),
      valor,
    });
  });
  return { itens, erros };
}
