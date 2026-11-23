# v1059 (23/11/2026) — unidade comercial na cotação

- **Cotações › item › "unidade comercial"**: abre os campos **Embalagem** (autocompletar: ROLO, PEÇA, UNIDADE, CAIXA, PACOTE, CONE, GROSA, MILHEIRO, FARDO, BOBINA — ou livre), **X** (quanto tem em cada uma) e **Unidade** (M, KG, UN…).
  - Padrão: tecido plano = **ROLO de 100 M**; malha = **PEÇA de 20 KG**; aviamentos e outros = livre.
  - Calcula o nº de embalagens (arredonda para cima) e mostra lado a lado **Demanda real** × **Comercial** (ex.: 322 m × 4 ROLOS × 100 M = 400 m, +78 m). O nº de embalagens pode ser editado sempre (enquanto a cotação não vira OC). "Voltar à unidade padrão" desfaz.
- A coluna Quantidade mostra a real e a comercial; o **total** e o card da cotação (imagem) usam a comercial ("4 ROLOS × 100 M = 400 m"). Valor unitário continua por M/KG.
- **Gerar OC**: a OC sai com a quantidade comercial (a diferença entra na 1ª linha do PIC daquele artigo).
- `lib/cotacoes.js`: `salvarComercial`, `baseComercial`; ação `comercial` em `api/compras/cotacoes`; categoria do artigo em cada item.
