# v806 — estampas com medidas e arquivos (FPP → pedido → PCP); card do item

- **Card do item (pedido)**: layout em destaque (quadro maior com faixa de título; laranja enquanto falta). Grade com botões – branco e + azul-marinho.
- **Detalhes de personalização** viraram um painel largo no fim do item (faixa azul-marinho):
  - cada **estampa** (silk, DTF, bordado): método, local, cores (silk), **largura × altura (cm)**, detalhes e **arquivos da estampa**;
  - "Outros arquivos de personalização" para o que não é de uma estampa.
  - Os arquivos continuam nos anexos do item (`anexosJson`, categoria PERSONALIZACAO) com `aplicacao: uid` → saem na OP e seguem no `/api/ext/arquivos` (sistema do Maycon) **na mesma ordem e nas mesmas URLs**.
- **FPP**: em cada aplicação de silk/DTF/bordado, faixa "Estampa" com largura × altura, detalhes e arquivos (`FppAnexo.aplicacaoUid`). Antes de salvar, os arquivos ficam guardados e sobem ao salvar. A lista geral de anexos da FPP não mostra os da estampa. Clonar a FPP copia os arquivos das estampas.
- **Indexar FPP** no pedido (ou escolher item padrão com FPP): as estampas entram no item com medidas e arquivos baixados para os anexos (marcadas "da FPP"). Reindexar não duplica. Sem FPP, adiciona-se a estampa direto no pedido ("+ Estampa").
- `PpItem.aplicacoes` (Json) guarda as estampas; OP impressa ganha a linha PERSONALIZAÇÃO ("SILK 2 CORES · PEITO ESQ. · 10 × 8 CM — detalhes").
- `/api/ext/arquivos`: cada arquivo de estampa traz `aplicacao` { metodo, local, cores, larguraCm, alturaCm, obs, descricao }; novo `aplicacoes` com as URLs. Campos existentes não mudaram.
