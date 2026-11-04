# v654 — Demanda de layout (arte finalista) · Itens padrão no menu

- **Layout no lugar da foto**: no lançamento, o quadro da peça agora é **Layout da peça** (obrigatório). Mesmo campo de antes (`PpItem.fotoBase64`), sai na OP.
- **Pedido efetivado com item sem layout** segue normal e gera a tarefa **CRIAÇÃO DE LAYOUT · PEDIDO N · CLIENTE** para o arte finalista (setor novo `ARTE`), com prazo no mesmo dia. Não duplica enquanto houver criação/aprovação em aberto do pedido.
- **Usuário criado no boot** (`scripts/seed.mjs`): login `ayrllon`, senha `ayrllon123`, setor ARTE FINALISTA (tipo operacional: agenda e tarefas).
- **Na tarefa de criação** (abre no detalhe, não na edição): OP dos itens sem layout (descrição, tipo, código, FPP, grade, parâmetros), botão **Abrir OP** (impressão com os anexos), **Anexar layout** em cada item (clique ou arraste) e **Enviar para aprovação do vendedor**.
- **Aprovação de layout**: tarefa para o vendedor do pedido (casado pelo nome com os usuários; sem casar, quem efetivou). **Aprovar** grava o layout no cadastro do item do pedido (imagem → layout do item; PDF → arquivos do item). **Reprovar** exige motivo e devolve uma nova criação (urgente) ao arte finalista.
- Campo `Tarefa.layout` (Json) com o contexto · `lib/layoutFluxo.js` · `api/tarefas/[id]/layout`.
- **Correção**: Itens padrão não aparecia no menu Dados (faltava a regra de acesso).
