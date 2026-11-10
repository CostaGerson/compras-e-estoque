# v752 — Modo demonstração: só o ícone do olho (sem a palavra "Demo" e sem a chave).

# v753 — Lançamentos de documento excluído
- Ao abrir o Financeiro (resumo e lançamentos do mês) os lançamentos cujo documento já não existe são apagados.
- Card **Origem dos lançamentos do mês** na Identificação: de qual documento vem cada grupo (marca parcial e documento de outro mês), com excluir o documento e os lançamentos dele; "sem documento" = manual/histórico/antecipação.

# v754 — Produtos do pedido no cadastro de itens + busca
- Ao **efetivar** o pedido, cada produto entra no cadastro (**Dados › Itens padrão**) ligado ao cliente: descrição, tipo, código, parâmetros, FPP, layout (foto) e preço praticado (preço cheio se tiver desconto), com código padrão sugerido. Se já existe (pelo item de origem, pelo código, ou pela mesma descrição do mesmo cliente), só ganha o cliente, o preço mais recente e o que faltava.
- No lançamento: os campos **Código** e **Descrição** do item buscam primeiro no cadastro de itens (marca CADASTRO, mostra cliente e preço) e depois no KM; escolher um do cadastro preenche o item inteiro (mantém a grade digitada). Código igual ao cadastrado preenche sozinho.
- A caixa "Buscar item cadastrado" aparece sempre e busca em todo o cadastro (código, código padrão, descrição, nome interno, cliente), com os itens do cliente primeiro.
- Menu: "Itens KM" passou a se chamar **Itens**.
