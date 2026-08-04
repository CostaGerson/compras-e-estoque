// Verifica o estoque mínimo de um artigo e, se cruzou pra baixo do mínimo,
// avisa (por mensagem) os setores COMPRAS e FINANCEIRO. Evita spam com a flag
// abaixoMinimoAvisado (só avisa na virada; reseta quando volta ao/acima do mínimo).
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function checarEstoqueMinimo(prisma, artigoId, remetenteId) {
  const a = await prisma.artigo.findUnique({ where: { id: Number(artigoId) } });
  if (!a || !a.estoqueMinimoAtivo || a.estoqueMinimo == null) return;
  const saldo = Number(a.quantidade) || 0;
  const min = Number(a.estoqueMinimo) || 0;

  if (saldo < min && !a.abaixoMinimoAvisado) {
    const destinatarios = await prisma.usuario.findMany({
      where: { ativo: true, setor: { in: ["COMPRAS", "FINANCEIRO"] } },
      select: { id: true },
    });
    let sender = remetenteId ? Number(remetenteId) : null;
    if (!sender) { const m = await prisma.usuario.findFirst({ where: { isMaster: true }, select: { id: true } }); sender = m?.id || null; }
    if (sender) {
      const texto = `⚠ Estoque mínimo atingido: ${a.nome}${a.cor ? " (" + a.cor + ")" : ""} está com saldo ${fmt(saldo)} ${a.unidade || ""} — mínimo ${fmt(min)}. Necessário repor.`;
      const alvos = destinatarios.map((d) => d.id).filter((id) => id && id !== sender);
      if (alvos.length) await prisma.mensagem.createMany({ data: alvos.map((paraId) => ({ deId: sender, paraId, texto })) });
    }
    await prisma.artigo.update({ where: { id: a.id }, data: { abaixoMinimoAvisado: true } });
  } else if (saldo >= min && a.abaixoMinimoAvisado) {
    await prisma.artigo.update({ where: { id: a.id }, data: { abaixoMinimoAvisado: false } });
  }
}
