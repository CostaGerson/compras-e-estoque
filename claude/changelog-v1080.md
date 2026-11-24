# v1080 (24/11/2026) — sugestão #102 (Maycon): Ver OC e Ver OS na rota

- **Ver OC** em toda demanda de rota criada pela OC (`ocId`): mostra a OC com os dados atuais (mesmo desenho da v1060), em tela cheia.
  No app do motorista substitui a imagem anexada na criação (que podia estar desatualizada).
- **Ver OS** em toda demanda aberta pelo PCP (`origem = PCP`): abre numa nova aba o PDF da OS gerado pelo PCP
  (`GET {PCP}/api/ext/os/documento?os=N`, v127 do PCP) — itens, grade e fichas, **sem preços**. Rótulo "OS 85 · Costura · Marcio".
  Proxy no ERP: `GET /api/rotas?u=&osDemanda=ID` (timeout 30 s). O token do PCP fica só no servidor. Erros: OS não encontrada,
  falha de integração (401/403) ou PCP fora do ar, em página simples.
- Onde aparecem: formulário da demanda (Logística › Rotas), linhas do card da rota, "Minha rota" e o app do motorista (parada atual com botão grande; demais paradas com botão normal).
- `lib/rotaDocs.js` (novo), `app/rotaDocs.jsx` (novo), `listarOcs({ ids })` em `lib/pic.js`.
