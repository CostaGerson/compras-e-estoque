# v751 — Excluir documento financeiro tira os lançamentos da DRE

- Função única `excluirArquivoFin` (`lib/fin.js`), usada na Importação, na Contabilidade e em Uploads: apaga **explicitamente** os lançamentos do documento e as partes desmembradas (não depende mais só do cascade do banco), tira o vínculo das contas que tinham baixa por eles, apaga as cópias na Contabilidade e as NFs lidas delas, e refaz a conciliação de todos os meses afetados.
- **Contabilidade**: excluir a cópia de um documento da Importação agora exclui o documento de origem e os lançamentos (antes só a cópia saía e voltava ao recarregar). Aviso no botão e na confirmação.
- Limpeza de **lançamentos órfãos** (de documento que já não existe) a cada exclusão — tira da DRE o que ficou de exclusões anteriores.
