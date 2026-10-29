# v576 — rotas: estado no calendário, link de acompanhamento e aviso de demanda atendida

- Calendário: demandas da mesma rota num card de grupo — cinza com botão ▶ "despachar" (abre a montagem para despachar) enquanto não despachada; laranja com seta andando em andamento; verde concluída.
- Link de acompanhamento (`RotaBloco.acompToken`): gerado no despacho (tela de despacho) ou pelo botão "Link de acompanhamento" na rota. "Copiar mensagem para o grupo" / "Copiar só o link".
- Página pública `/acompanhar/<token>` (mobile, sem login): rota ao vivo resumida (paradas, previsões, posição, volta prevista), demandas do dia e botão "Nova demanda de rota" (nome de quem pede fica gravado no aparelho; a demanda entra com obs "Lançada pelo link da rota Rn por X"). API `api/acompanhar/[token]` com limite de 40 lançamentos/hora por link.
- Quem criou a demanda de rota recebe mensagem e notificação no celular quando ela é atendida (parada concluída ou concluída sem rota): nome, rota e horário.
