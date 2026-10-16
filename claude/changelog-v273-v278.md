# Changelog v273–v278 — Compras & Estoque (Meridian)

Sessão de 16/10/2026. Entrega por commit + push no GitHub (`CostaGerson/compras-e-estoque`) e deploy com:

```
ssh root@147.93.35.189 "cd /opt/compras-e-estoque && git pull && docker compose up -d --build"
```

## v273 — Conta da semana: saldo em aberto
- Semana paga parcialmente aparece no contas a pagar só pelo **saldo** (`valor = saldo`, com `valorTotal` e `pagoParcial`).
- Itens pagos descem na lista; os em aberto sobem. Rodapé com o saldo e "pago X de Y".
- Base: `lib/finSemana.js` (baixa por item, baixa parcial com sugestão por combinação de valores, OBS, desfazer, fechar a semana quando quitada).

## v274 — Matriz: botão "Contratações" na simulação
- Ao lado de Metas e resultado (só em cenário/simulação), abre `app/capacidadeSim.jsx`.
- Tabela por setor: **hoje** (média de 3 meses) × **A** (só freelancer) × **B** (contrata acima de 1 freelancer/dia), com o cenário aplicado destacado e o mês a mês do período em aberto (`CapacidadeMensal`).
- Meta = média de peças dos meses em aberto da simulação.

## v275 — Ajuste de freelancers/dia na simulação
- Coluna **Sua simulação** com −/+ de freelancers/dia por setor (parte do cenário aplicado ou do último ajuste salvo).
- Freelancer/mês = freelancers/dia × dias úteis médios × diária; setor sem mudança usa o freelancer do cenário; setor sem diária fica com o valor de hoje.
- % freelancer = Σ freelancer ÷ (Σ folha + Σ freelancer). No cenário B, a folha inclui as contratações.
- **Salvar na simulação** → POST `/api/fin/matriz/[id]` `{acao:"freelancers", ajustes}`: grava `razaoInternaAuto=false`, `razaoInternaManual = 1 − %`, e `simulacaoCapacidade.freeDiaAjustado`, `pctFreelancer`, `freelancerMes`. A versão anterior vai para o Histórico.
- Conta compartilhada entre tela e servidor: `lib/capAjuste.js`.

## v276 → v277 — Média das análises operacionais
- v276 trocou para média simples dos meses; **revertida na v277** a pedido do Igor. Fica a **média ponderada** (soma da contribuição ÷ soma das peças, últimos 3 meses com registro).
- Esclarecido: personalização (R$ 0,60) e costura (R$ 0,58) no card = contribuição bruta ÷ **peças produzidas no mês** (expedição). Dentro da análise aparece por **peça feita dentro** (silk R$ 2,69; costura R$ 3,06). O card dilui porque só parte das peças passa por essas etapas.

## v278 — KPI: peças faturadas = análise da expedição
- Fonte única: `sincronizarPecasKpi()` / `pecasExpedicao()` em `lib/opAnalise.js` grava em `KpiMes.pecasFaturadas` o total da análise da expedição (só quando difere).
- Roda ao abrir o KPI/Gestão (`dadosDoAno`), na Capacidade (`analisarCapacidade`), ao salvar/importar a análise da expedição e após a importação do Excel do KPI.
- Lápis/importação: em mês com análise da expedição, o valor digitado é ignorado (aviso no formulário).
- Efeito: set/2026 passa de 15.648 para **19.017**; jan/2026 de 6.869 para **6.816**. Muda ticket por peça, atingido × meta de peças, peças por trabalhador e simulações.

## Pendências
- Simulação A sugere freelancer em logística e bordado por causa da conta linear (meta ≈ 1,76× a produção) + arredondamento para cima. Proposta sem resposta: marcar setores como "fora da projeção por volume".
- Personalização e costura só têm análise de set/2026 — lançar agosto (internalizado desde então) para a média usar mais meses.
- Conferir na tela: v275 (modal de ajuste) e v278 (peças do KPI) não foram vistas em produção.
