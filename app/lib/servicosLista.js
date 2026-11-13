// v826 — tipos de serviço e a conta-caixa de receita de cada um (sem banco: usado também na tela)
export const SERVICOS = [
  { k: "SILK", nome: "Silk", conta: "1116100", contaNome: "SERVIÇO DE SILK", rx: /SILK|SERIGRAF/ },
  { k: "BORDADO", nome: "Bordado", conta: "1116200", contaNome: "SERVIÇO DE BORDADO", rx: /BORDAD/ },
  { k: "PRENSAGEM_DTF", nome: "Prensagem DTF", conta: "1116500", contaNome: "SERVIÇO DE PRENSAGEM DTF", rx: /PRENS\w*.*DTF|DTF.*PRENS/ },
  { k: "PRENSAGEM_SUBLIMACAO", nome: "Prensagem sublimação", conta: "1116600", contaNome: "SERVIÇO DE PRENSAGEM SUBLIMAÇÃO", rx: /PRENS\w*.*SUBLIM|SUBLIM.*PRENS/ },
  { k: "IMPRESSAO_DTF", nome: "Impressão DTF", conta: "1116300", contaNome: "SERVIÇO DE IMPRESSÃO DTF", rx: /DTF/ },
  { k: "IMPRESSAO_SUBLIMACAO", nome: "Impressão sublimação", conta: "1116400", contaNome: "SERVIÇO DE IMPRESSÃO SUBLIMAÇÃO", rx: /SUBLIM/ },
  { k: "FACCAO", nome: "Facção", conta: "1116000", contaNome: "SERVIÇO DE FACÇÃO", rx: /FAC[CÇ][AÃ]O|COSTUR/ },
];
const up = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
export function servicoDe(tipo, descricao) {
  const t = SERVICOS.find((s) => s.k === tipo);
  if (t) return t;
  const d = up(descricao);
  return SERVICOS.find((s) => s.rx.test(d)) || null;
}

