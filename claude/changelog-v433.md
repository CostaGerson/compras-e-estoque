# v431–v433 — Endereços do Google nas rotas

- **v431:** erro do Google aparece embaixo dos campos Endereço e Destinatário (antes era engolido).
- **v432:** sugestão do Google que vem só com a rua recebe o número digitado e é localizada no número exato (Geocoding).
- **v433:** ao salvar a demanda com endereço escolhido no Google, o cadastro de origem é atualizado:
  - **Terceirizado:** campo endereço = endereço do Google.
  - **Fornecedor / Cliente:** logradouro, número, bairro, município, UF e CEP (em maiúsculas); complemento é mantido.
  - **Destinatário:** já era atualizado (v430).
  - O ponto fica no cache do mapa (`GeoCache`) com o endereço novo, então as próximas demandas já saem localizadas.
  - Só grava quando muda; importações de NF/clientes só preenchem campos vazios, então não desfazem a correção.
