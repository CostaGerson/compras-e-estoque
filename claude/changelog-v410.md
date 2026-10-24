# v410 — FPP: elástico e faixa por metro, tipos de faixa e de botão

- **Banco de dados › Elásticos:** cada especificação tem consumo (m/peça) e R$/m. Com os dois preenchidos, o R$/peça é calculado (consumo × R$/m) e gravado com histórico.
- **Faixas refletivas:** a aplicação (camisa tórax + mangas, calça…) tem o consumo (m/peça). Grupo novo **Tipos de faixa (R$/m)**: simples 2,5 / 5 cm, montada c/ tactel 2,5 (5 total) / 5 (10 total), pronta gorgurão 2,5 (5 total) / 5 (10 total). R$/peça = consumo da aplicação × R$/m do tipo.
- **Botões (R$/un):** massa 4 furos, pressão /100 ferro/latão, pressão /80 ferro/latão, flexível para calça. Sem tipo vale o BOTAO_UNIT.
- **Ficha:** a faixa abre "Tipo de faixa"; montada/pronta abre a cor (verde fluor / laranja fluor). Botão com qtde abre "Tipo de botão". A conta (m × R$/m = R$/pç) aparece embaixo do campo.
- Sem consumo ou R$/m preenchidos, continua valendo o R$/peça antigo (FPPs existentes não mudam).
- **Compras:** elástico e faixa com consumo entram na demanda em **metros** (faixa com o nome do tipo + cor); botão sai com o tipo, em unidades (grosa de 144). Artigo é casado também pela unidade.
- Corrigido: `valorEstimado` do consolidado do levantamento voltou a ser arredondado (estava dentro de um comentário).
