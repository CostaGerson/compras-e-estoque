export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { etiquetaDe, ehEtiqueta } from "@/lib/msgEtiquetas";   // v862

const selUser = { id: true, nome: true, sobrenome: true, fotoBase64: true, setor: true };

// GET /api/mensagens?usuarioId=  -> recebidas (não arquivadas), arquivadas, enviadas, naoLidas
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const usuarioId = Number(searchParams.get("usuarioId"));
  if (!usuarioId) return Response.json({ recebidas: [], arquivadas: [], enviadas: [], naoLidas: 0 });
  // v861 — lixeira: apaga de vez o que está lá há mais de 30 dias
  await prisma.mensagem.deleteMany({ where: { paraId: usuarioId, excluidaEm: { lt: new Date(Date.now() - 30 * 864e5) } } }).catch(() => {});
  const [recebidasTodas, enviadas] = await Promise.all([
    prisma.mensagem.findMany({ where: { paraId: usuarioId }, orderBy: { createdAt: "desc" }, take: 300, include: { de: { select: selUser } } }),
    prisma.mensagem.findMany({ where: { deId: usuarioId }, orderBy: { createdAt: "desc" }, take: 2000, include: { para: { select: selUser } } }),
  ]);
  // v568 — aviso do desenvolvedor ainda sem "ciente" fica fixo no topo das recebidas
  // v761 — mensagem prioritária (ex.: boleto pago via PIX) fica sempre no topo até ser arquivada
  for (const m of recebidasTodas) m.etiqueta = etiquetaDe(m);   // v862
  for (const m of enviadas) m.etiqueta = etiquetaDe(m);
  const lixeira = recebidasTodas.filter((m) => m.excluidaEm);   // v861
  const recebidas = recebidasTodas.filter((m) => !m.arquivada && !m.excluidaEm).sort((a, b) => (Number(b.aviso && !b.lida) - Number(a.aviso && !a.lida)) || (Number(!!b.prioritaria) - Number(!!a.prioritaria)));
  const tids = [...new Set(recebidasTodas.map((m) => m.tituloId).filter(Boolean))];
  if (tids.length) {
    const ts = await prisma.finTitulo.findMany({ where: { id: { in: tids } }, select: { id: true, tipo: true, titulo: true, numeroDoc: true, parceiro: true, vencimento: true, status: true } }).catch(() => []);
    for (const m of recebidasTodas) if (m.tituloId) m.conta = ts.find((t) => t.id === m.tituloId) || null;
  }
  const arquivadas = recebidasTodas.filter((m) => m.arquivada && !m.excluidaEm);
  const naoLidas = recebidas.filter((m) => !m.lida).length;
  // v607 — convite de evento: situação atual da resposta de quem recebeu
  const ids = [...new Set(recebidasTodas.map((m) => m.conviteTarefaId).filter(Boolean))];
  if (ids.length) {
    const cs = await prisma.tarefaConvite.findMany({ where: { usuarioId, tarefaId: { in: ids } }, select: { tarefaId: true, status: true } }).catch(() => []);
    const ts = await prisma.tarefa.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, excluidaEm: true } }).catch(() => []);
    for (const m of recebidasTodas) if (m.conviteTarefaId) {
      const t = ts.find((x) => x.id === m.conviteTarefaId);
      m.convite = !t || t.excluidaEm || t.status === "CANCELADA" ? "CANCELADO" : cs.find((c) => c.tarefaId === m.conviteTarefaId)?.status || "REMOVIDO";
    }
  }
  await ligarTarefas([...recebidasTodas, ...enviadas.slice(0, 300)]).catch(() => null);   // v918
  return Response.json({ recebidas, arquivadas, lixeira, enviadas, naoLidas });
}

// v918 — tarefa de cada mensagem (clicar abre o card). Mensagens antigas, sem o vínculo: pelo texto
//   "(#123)", "LAYOUT … pedido N" e "DEMANDA …: título"
async function ligarTarefas(ms) {
  const semAc = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const busca = {};   // chave → [mensagens]
  for (const m of ms) {
    if (m.tarefaId || m.conviteTarefaId) { m.tarefaId = m.tarefaId || m.conviteTarefaId; continue; }
    const t = String(m.texto || "");
    let k = null;
    const h = t.match(/\(#(\d+)\)/); if (h) k = `ID|${h[1]}`;
    const l = !k && semAc(t).match(/(CRIACAO DE LAYOUT|APROVACAO DE LAYOUT|LAYOUT REPROVADO|LAYOUT APROVADO)\s*[—-]\s*PEDIDO\s+(\d+)/);
    if (l) k = `LAY|${/APROVACAO DE|APROVADO/.test(l[1]) && !/REPROVADO/.test(l[1]) ? "APROVA" : "CRIA"}|${l[2]}`;
    const d = !k && t.match(/^(?:📌 NOVA DEMANDA(?: URGENTE)?|📌 DEMANDA PASSADA PARA VOCÊ|✅ DEMANDA CONCLUÍDA|✅ APROVADO|↩ REPROVADO|🖼 .+? enviou para aprovação)[^:]*:\s*(.+?)(?:\s+\(\d+ arquivo|\s+—\s|\s+\(|$)/);
    if (d && d[1].trim().length >= 3) k = `TIT|${d[1].trim().replace(/\.$/, "")}`;
    if (k) (busca[k] ||= []).push(m);
  }
  const ks = Object.keys(busca).slice(0, 80);
  for (const k of ks) {
    const [tipo, a, b] = k.split("|");
    let t = null;
    if (tipo === "ID") t = await prisma.tarefa.findUnique({ where: { id: Number(a) }, select: { id: true } });
    else if (tipo === "LAY") t = await prisma.tarefa.findFirst({ where: { titulo: { startsWith: a === "APROVA" ? "APROVAÇÃO DE LAYOUT" : "CRIAÇÃO DE LAYOUT" }, AND: [{ titulo: { contains: `PEDIDO ${b} ` } }] }, orderBy: { id: "desc" }, select: { id: true } });
    else t = await prisma.tarefa.findFirst({ where: { titulo: k.slice(4) }, orderBy: { id: "desc" }, select: { id: true } });
    if (t) for (const m of busca[k]) m.tarefaId = t.id;
  }
}

// POST /api/mensagens  { deId, paraId, texto } · { deId, texto, aviso: true } → aviso do desenvolvedor para todos (só master)
export async function POST(req) {
  const b = await req.json();
  const deId = Number(b.deId), paraId = Number(b.paraId);
  const texto = String(b.texto || "").trim();
  if (b.aviso) {   // v568
    const de = deId ? await prisma.usuario.findUnique({ where: { id: deId }, select: { isMaster: true, ativo: true } }) : null;
    if (!de?.ativo || !de.isMaster) return Response.json({ error: "Só o desenvolvedor (master) envia avisos." }, { status: 403 });
    if (!texto) return Response.json({ error: "Escreva o aviso" }, { status: 400 });
    const todos = await prisma.usuario.findMany({ where: { ativo: true, NOT: { id: deId } }, select: { id: true } });
    const quando = new Date();
    await prisma.mensagem.createMany({ data: todos.map((u) => ({ deId, paraId: u.id, texto, aviso: true, createdAt: quando })) });
    try { const { notificar } = await import("@/lib/push"); for (const u of todos) await notificar(u.id, { titulo: "📢 Aviso do desenvolvedor", texto: texto.slice(0, 180), url: "/", tag: `aviso-${+quando}` }).catch(() => null); } catch {}
    return Response.json({ ok: true, enviados: todos.length }, { status: 201 });
  }
  if (!deId || !paraId) return Response.json({ error: "Remetente e destinatário são obrigatórios" }, { status: 400 });
  if (!texto) return Response.json({ error: "Escreva a mensagem" }, { status: 400 });
  const m = await prisma.mensagem.create({ data: { deId, paraId, texto, etiqueta: ehEtiqueta(b.etiqueta) ? b.etiqueta : "COMUNICACAO" } });   // v862 — sem escolher, comunicação
  return Response.json(m, { status: 201 });
}
