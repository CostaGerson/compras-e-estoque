# v325 — Importação em massa pela "Posição Geral de Vendas" (KM) + leitor do banco do KM

## Posição Geral de Vendas (KM)
- O relatório "Posição Geral de Vendas" do KM (PDF) é reconhecido no upload de Pedidos e no Lançar PP (arrastar, botão ou Ctrl+V).
- `lerPosicaoVendas` (`lib/pedidosLer.js`) lê todos os pedidos: nº, cliente, emissão, entrega, quantidade, valor líquido, **Qt. a entregar**, **Vl. à entregar** (saldo a faturar), condição de pagamento e vendedor.
  - A leitura usa as duas datas como âncora e cai bem mesmo quando as colunas vêm coladas no PDF.
  - Conferido contra o rodapé do próprio relatório: 786 pedidos, Σ quantidade 152.337 e Σ Vl. à entregar R$ 1.559.680,24 — tudo batendo.
- `aplicarPosicaoVendas` (`lib/pedidos.js`):
  - **Atualiza** todos os pedidos já existentes com o saldo a faturar (Vl. à entregar), a condição (quando faltava) e o vendedor. Não sobrescreve o que o PV já trouxe.
  - **Cria** os pedidos pendentes (Vl. à entregar > 0) que ainda não estavam no sistema, já com condição e entrega — assim a previsão cobre todos sem precisar do PV de cada um. Pedidos já entregues sem PV não são criados.
  - `fonte` marca a origem: PV, RELATORIO ou PV+RELATORIO.
- **Previsão:** quando o pedido vem do relatório, a base da previsão passa a ser o **saldo a faturar** (Vl. à entregar), não o total — o que já foi entregue sai da conta. PVs sem relatório continuam pelo total.
- Pedidos NORT SPORTS continuam internos (não entram na previsão).

## Leitor do banco do KM (tools/km) — em andamento
- `tools/km/descobrir.mjs`: lê a estrutura do PostgreSQL do MentorSoft (só leitura) para mapear as tabelas de pedidos. Falta a senha do banco (pedir ao suporte do KM um usuário só de leitura).
- Banco identificado: PostgreSQL em 192.168.0.107:5435, base `mentorsoft`.
