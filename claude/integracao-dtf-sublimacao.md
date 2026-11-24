# Integração ERP Meridian → Sistema de Produção NORT (DTF e Sublimação)

> **Para quem é:** o sistema de produção da NORT (Flask, repositório `nort-producao`) e quem for mexer nele.
> **Estado:** ERP v1085 (24/11/2026). Do lado do ERP já está no ar; falta o sistema da NORT ler e devolver.

---

## 1. O que muda

A partir de agora, **todo pedido é lançado no ERP Meridian**, qualquer que seja o canal:

| Canal | Onde é lançado no ERP |
|---|---|
| Venda Meridian (comercial) | Lançamento de pedido normal |
| Venda NORT (até 70 peças) | Comercial › **Pedido NORT** |
| Loja física | Comercial › **Frente de caixa** |
| Loja Way | Portal da Way (já integrado) |

Sempre que um pedido efetivado tem item com **DTF** ou **sublimação**, o ERP cria uma **demanda** para o sistema da NORT.
O sistema da NORT **lê** essas demandas, produz e **devolve o status**. O ERP repassa o status para o PCP do Maycon, que continua vendo
o item em DTF/sublimação.

**O ERP não lê mais os pedidos da calculadora** (`GET /api/erp/pedidos`), porque a loja passou a vender pelo ERP. A leitura do estoque (`GET /api/erp/estoque`) e os movimentos de estoque continuam iguais.

---

## 2. Autenticação

- Endereço base: `https://erp.meridianpro.com.br`
- Cabeçalho: `X-Api-Key: <token da NORT>`. É o **mesmo token** que o sistema da NORT já usa em `/api/ext/nort/*` (pedido, estoque, itens).
- Token errado: `401 { ok: false, error: "Token inválido." }`.

---

## 3. Ler as demandas

```
GET /api/ext/personalizacao?desde=<ISO>
X-Api-Key: <token>
```

Parâmetros (todos opcionais):

| Parâmetro | Uso |
|---|---|
| `desde` | ISO 8601. Devolve as demandas **criadas ou alteradas** desde essa hora, em qualquer status. Sem `desde`, devolve todas as **abertas** (sem ENTREGUE e CANCELADA). |
| `status` | Lista separada por vírgula, por exemplo `NOVA,RECEBIDA`. |
| `pedido` | Número do pedido no ERP. |
| `metodo` | `DTF` ou `SUBLIMACAO`. |

**Como ler (recomendado):**
1. A cada **1 a 2 minutos**, chame com `desde = geradoEm da leitura anterior − 5 min`. Repetir não faz mal, porque a chave é única.
2. Na primeira vez, ou para conferir uma vez por dia, chame **sem `desde`** e acerte a lista de abertas.
3. Faça o *upsert* pela **`chave`** (ou pelo `id`). A mesma demanda volta toda vez que muda.

**Resposta:**
```json
{
  "ok": true, "versao": 1, "geradoEm": "2026-11-24T14:02:10.000Z", "total": 1,
  "demandas": [{
    "id": 37,
    "chave": "26115100|1|DTF",
    "pedido": "26115100",
    "itemSeq": 1,
    "metodo": "DTF",
    "canal": "LOJA",
    "versao": 1,
    "status": "NOVA",
    "statusEm": null, "statusObs": null, "refExterna": null,
    "criadaEm": "2026-11-24T13:50:00.000Z", "atualizadaEm": "2026-11-24T13:50:00.000Z",
    "emissao": "2026-11-24",
    "entrega": "2026-12-01",
    "cliente": "NORT SPORTS LTDA",
    "clienteFinal": { "nome": "JOÃO DA SILVA", "telefone": "31999998888" },
    "vendedor": "LOJA FÍSICA NORT",
    "obsPedido": "LOJA FÍSICA · VENDA 12",
    "item": {
      "seq": 1, "descricao": "CAMISETA PV GOLA VIES PRETO", "codigo": null, "tipoPeca": "CAMISETA", "fppNumero": 221, "quantidade": 3,
      "grade": [{ "tam": "M", "qtd": 2 }, { "tam": "G", "qtd": 1 }],
      "parametros": { "PERSONALIZAÇÃO": "DTF · FRENTE ESQUERDO 8X6", "PEÇA DO ESTOQUE DA LOJA": "SIM (SÓ PERSONALIZAR)" }
    },
    "aplicacoes": [{ "local": "FRENTE ESQUERDO", "larguraCm": 8, "alturaCm": 6, "cores": null, "obs": null }],
    "personalizacaoTexto": "DTF · FRENTE ESQUERDO 8X6",
    "dadosUnitarios": null,
    "artes": [
      { "id": "I812.0", "nome": "logo.png", "mime": "image/png", "url": "https://erp.meridianpro.com.br/api/ext/personalizacao/arquivo?demanda=37&arte=I812.0" },
      { "id": "P50", "nome": "arte.pdf", "mime": "application/pdf", "doPedido": true, "url": "…" }
    ],
    "urlPedido": "https://erp.meridianpro.com.br/?v=pedido&numero=26115100"
  }]
}
```

**Campos importantes:**

| Campo | Significado |
|---|---|
| `chave` | `<pedido>|<itemSeq>|<metodo>`. É única e não muda. Um item com DTF **e** sublimação gera duas demandas. |
| `canal` | `MERIDIAN`, `NORT`, `LOJA` (loja física) ou `PORTAL` (Loja Way). |
| `versao` | Sobe quando o pedido muda no ERP (grade, arte, personalização, entrega). Se a versão subir depois de `RECEBIDA`, **confira a produção**. |
| `status` | Situação atual (ver item 5). `CANCELADA` = pedido cancelado no ERP ou item que deixou de ter DTF/sublimação. **Pare a produção.** |
| `aplicacoes` | Onde e de que tamanho vai cada estampa (cm). Na sublimação total vem `local: "TOTAL"`. Pode vir vazio quando o pedido só tem o texto de personalização: nesse caso use `personalizacaoTexto`. |
| `dadosUnitarios` | Nome e número por peça (`campos` + `linhas` por tamanho), quando o pedido tem personalização exclusiva. Essencial na sublimação de uniforme. |
| `artes` | Arquivos do item e do pedido. Baixe pelo `url` com o mesmo `X-Api-Key`. |
| `entrega` | Data prevista de despacho do pedido (AAAA-MM-DD). |
| `item.parametros["PEÇA DO ESTOQUE DA LOJA"]` | Na loja física: a peça lisa sai do estoque da loja e só precisa ser personalizada. |

---

## 4. Baixar as artes

```
GET /api/ext/personalizacao/arquivo?demanda=<id>&arte=<id da arte>
X-Api-Key: <token>
```
Devolve o arquivo (Content-Type do arquivo), ou `404` se ele não existir mais.

---

## 5. Devolver o status (a devolutiva)

```
POST /api/ext/personalizacao/status
X-Api-Key: <token>
Content-Type: application/json

{ "chave": "26115100|1|DTF", "status": "EM_PRODUCAO", "refExterna": "MER-26115100-1", "obs": "impressão do filme", "em": "2026-11-24T15:10:00-03:00", "por": "GERSON" }
```

- Identifique a demanda por `id` **ou** por `chave`.
- `status` aceitos (nesta ordem):

| Status | Quando mandar |
|---|---|
| `RECEBIDA` | Assim que a demanda entrar no sistema da NORT. Mande sempre, porque o ERP mostra que chegou. |
| `EM_PRODUCAO` | Começou a impressão, prensagem ou sublimação. |
| `PRONTA` | Peças personalizadas prontas. |
| `ENTREGUE` | Devolvidas para a fábrica (costura/expedição) ou entregues ao cliente. |
| `PROBLEMA` | Algo impede a produção (arte faltando, peça errada…). **`obs` obrigatório na prática**: o ERP avisa a gestão e o PCP. |

- `refExterna`: o id da demanda no sistema da NORT (opcional, mas ajuda a rastrear).
- `em`: quando aconteceu. Se não vier, vale a hora do envio.
- **Várias de uma vez:** `{ "atualizacoes": [ { "chave": "…", "status": "PRONTA" }, { "id": 38, "status": "RECEBIDA" } ] }` (até 200).
- Respostas:
  - OK: `200 { ok: true, demanda: { …retrato atualizado… } }`.
  - Status inválido ou demanda não encontrada: `400 { ok: false, error }`.
  - Demanda **CANCELADA** no ERP recusa status: `400 { ok: false, error: "Demanda cancelada no ERP…" }`.
- Mandar o mesmo status de novo não tem problema.

---

## 6. O que o PCP do Maycon passa a ver

O PCP já lê `GET /api/ext/compras`. Cada item que tem DTF ou sublimação ganha um campo novo:

```json
"personalizacao": [{ "metodo": "DTF", "etapa": "DTF", "sistema": "NORT", "status": "EM_PRODUCAO", "statusEm": "2026-11-24T18:10:00.000Z", "obs": "impressão do filme" }]
```

É um campo a mais, então o PCP não precisa mudar nada para continuar funcionando. Se quiser, ele pode mostrar o andamento da NORT no item.

---

## 7. Checklist de implementação no sistema da NORT

1. Guardar o token do ERP (o mesmo de `/api/ext/nort/*`) e o endereço base.
2. Tarefa periódica (1–2 min): `GET /api/ext/personalizacao?desde=…` → *upsert* pela `chave` → baixar as artes novas.
3. Ao criar a demanda no sistema da NORT: `POST …/status` com `RECEBIDA` e `refExterna`.
4. Ao mudar a etapa na tela da produção: `POST …/status` (EM_PRODUCAO, PRONTA, ENTREGUE ou PROBLEMA com `obs`).
5. Tratar `versao` maior (pedido mudou) e `status: CANCELADA` (parar).
6. Falha de rede: tentar de novo na próxima volta. O ERP aceita repetição.
7. Parar de mandar pedidos da calculadora para o ERP, porque a loja vende pelo ERP agora. Os movimentos e o saldo de estoque continuam.

---

## 8. Teste rápido (curl)

```bash
curl -H "X-Api-Key: $TOKEN" "https://erp.meridianpro.com.br/api/ext/personalizacao"
curl -X POST -H "X-Api-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{"chave":"26115100|1|DTF","status":"RECEBIDA","refExterna":"TESTE-1"}' \
  "https://erp.meridianpro.com.br/api/ext/personalizacao/status"
```
