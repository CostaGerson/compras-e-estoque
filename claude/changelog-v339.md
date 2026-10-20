# v339 — Vencimento das NFs lançadas pelo XML

- Causa: no lançamento da NF, marcar "pago à vista" troca o vencimento das parcelas novas pela data do pagamento (padrão = emissão). Ao desmarcar, as datas do XML não voltavam — a conta ficava em aberto vencendo na emissão (ex.: Doptex NF 76457: 16/11, 15/12, 14/01 → todas 16/10).
- Tela (`app/adm.jsx`): guarda o vencimento original; desmarcar o à vista devolve as datas da nota. Data digitada à mão continua valendo.
- Correção única (`corrigirVencimentosVista` em `lib/fiscal.js`, roda ao abrir o contas a pagar): conta EM ABERTO do XML com vencimento = emissão, quando o XML traz outra data, volta ao vencimento do XML. Paga ou editada à mão não muda. Marca `FIX|V339_VENC_VISTA` no FinConfig.
- Artind NF 27069: o XML vence em 16/10 mesmo — está certa.
