# v1062 (23/11/2026) — FPP: arte de DTF da lista

- **FPP › Personalização › método DTF**: o campo R$/peça vira uma lista com as artes da **Composição de custo por peça** (Análises operacionais › DTF) e o custo total de cada uma (ex.: DTF NOME 2X10 · R$ 0,55; DTF LOGO 8X6 · R$ 0,66; DTF COSTAS 10X15 · R$ 1,12; DTF A4 FRENTE/COSTAS 29X21 · R$ 2,87). Escolher a arte preenche o valor por peça. **Outros (digitar valor)** mantém o campo livre como antes.
- A linha "METRO LINEAR DTF" não entra na lista. A arte escolhida fica gravada na aplicação (`dtfArte`).
- `api/producao/custoImpressao?artes=DTF`: nome + custo de cada arte, para qualquer usuário ativo.
