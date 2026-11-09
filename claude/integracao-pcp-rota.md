# Terceirizados e demanda de rota — resposta do ERP (v725)

**Para:** Maycon (PCP / Cronograma) · **De:** Igor (ERP Meridian) · **Data:** 09/11/2026

As duas partes do pedido de 05/11 estão no ar. Todos os endpoints usam o **mesmo token** de `/api/ext/compras`
(cabeçalho `X-Api-Key`). Base: `https://erp.meridianpro.com.br`.

---

## 1. `GET /api/ext/terceirizados`

Opcional: `?desde=2026-11-04T00:00:00Z` (só quem mudou depois). Volta **ativos e inativos**.

```json
{
  "versao": 1, "geradoEm": "2026-11-09T19:00:00.000Z", "total": 29,
  "terceirizados": [{
    "id": 142,
    "nome": "GISLEY VALADARES",
    "nomeFantasia": null,
    "nomeKm": "GISLEY",
    "documento": "12.345.678/0001-90",
    "tipos": ["costura"],
    "servicosErp": ["FACCAO:CALCA_SOCIAL"],
    "ativo": true,
    "telefone": "31 99999-0000",
    "endereco": {
      "completo": "R. das Palmeiras, 120 - Centro, Contagem - MG, 32000-000, Brasil",
      "logradouro": "R. das Palmeiras, 120", "bairro": "Centro", "cidade": "Contagem", "uf": "MG",
      "cep": "32000-000", "referencia": null
    },
    "atualizadoEm": "2026-11-04T18:20:00.000Z"
  }]
}
```

Observações:
- `id` é o id do cadastro de terceirizados do ERP (o mesmo que já vem em `/api/ext/faccoes`).
- `tipos`: facção → `costura`; `corte`, `bordado`, `silk`, `dtf`, `sublimacao`, `outro`. Quem faz bordado, silk, DTF ou
  sublimação também recebe `personalizacao`. `acabamento` ainda não existe no cadastro do ERP.
- O ERP guarda o endereço numa linha só. `completo` vem sempre; as partes são separadas do texto e podem vir `null`.
- O ERP não tem nome fantasia de terceirizado (`nomeFantasia` vem `null`).

## 2. `GET /api/ext/rota/campos`

Devolve os campos da tela **Logística › Rotas › Nova demanda**, na ordem da tela. Destinatário, endereço e telefone
**não** estão na lista: saem do cadastro do terceirizado (`terceirizadoId`).

Ordem: `objetivo` · `tarefa` · `contato` · `telefone` · `data` · `horarioTipo` · `hora1` · `hora2` · `tempoLocal` · `volumes` ·
`urgente` · `pendente` · `pendencia` · `frete` · `freteTipo` · `freteValorMax` · `freteVolumes` · `motoristaId` · `veiculo` · `obs`.

Campos que dependem de outro trazem `mostrarSe`:

```json
{ "id": "hora1", "rotulo": "Hora", "tipo": "hora", "obrigatorio": true,
  "mostrarSe": { "campo": "horarioTipo", "valores": ["FIXO", "ATE", "APOS", "ENTRE"] },
  "rotulosPor": { "FIXO": "Às", "ATE": "Até as", "APOS": "Após as", "ENTRE": "De" } }
```

- Os motoristas já vêm dentro de `motoristaId.opcoes` (são poucos). O campo `padrao` traz o motorista padrão quando houver.
- `volumes` não existe na tela do ERP: entra no texto da tarefa ("· 3 volumes").
- Vazio em `tarefa`: o ERP escreve sozinho, por exemplo `Levar OS 47 · romaneio 47 · costura · 420 pç · 3 volumes`.

## 3. `POST /api/ext/rota`

```json
{
  "origem": "PCP", "osPcp": 47, "romaneio": 47, "terceirizadoId": 142, "servico": "costura",
  "usuario": "Maycon",
  "itens": [{ "pedido": "26090044", "produto": "CALÇA SOCIAL TWO WAY PRETA", "qtd": 180 }],
  "campos": { "objetivo": "ENTREGA", "data": "2026-11-06", "horarioTipo": "MANHA", "volumes": 3, "obs": "" }
}
```

- `usuario` (opcional): nome de quem confirmou no PCP. Fica registrado na demanda.
- Também aceito o formato do seu rascunho: `tipo: "entrega"` e `periodo: "manha" | "tarde"`.

Resposta:

```json
{ "ok": true, "rotaId": 3012, "numero": "#3012", "status": "ABERTA", "data": "2026-11-06",
  "url": "https://erp.meridianpro.com.br/?v=rota&demanda=3012&data=2026-11-06", "jaExistia": false }
```

O `url` abre o ERP na tela de Rotas, já com a demanda aberta.

Regras:
1. **Não duplica.** Se a mesma `osPcp` já tiver uma demanda que não foi cancelada, volta essa demanda com `jaExistia: true`.
2. **Recusa clara.** Volta `{ "ok": false, "error": "…" }` com HTTP 422 e um texto para mostrar na tela. Exemplos: terceirizado
   sem endereço, terceirizado inativo, sem data, Fretebras sem valor ou volumes.
3. A demanda nasce **Aberta** em Logística › Rotas, com o destino do terceirizado. A observação registra a OS, o romaneio, os itens e quem confirmou.

### Consulta: `GET /api/ext/rota?osPcp=47`
Volta o mesmo formato da resposta acima, com o `status` atual: `ABERTA`, `NO_BLOCO` (já numa rota montada), `EM_EXECUCAO`
(saiu com o motorista), `CONCLUIDA` ou `CANCELADA`. Se a OS não tiver demanda, volta HTTP 404.

## 4. `POST /api/ext/rota/cancelar`

```json
{ "rotaId": 3012, "motivo": "OS apagada no PCP" }
```

Também aceita `{ "osPcp": 47, "motivo": "…" }` no lugar do `rotaId`.

- Funciona enquanto a demanda estiver `ABERTA` ou `NO_BLOCO`. Se estiver numa rota ainda não despachada, ela sai da rota.
- Se a rota já saiu (`EM_EXECUCAO`) ou a demanda já foi concluída, o cancelamento é recusado com o motivo no `error`.
- Só cancela demandas abertas pelo PCP. As demais são canceladas no próprio ERP.
