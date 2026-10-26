// v425 — Logística › Rotas
export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";
import { painel, destinos, salvarDemanda, cancelarDemanda, salvarFabrica, fabrica, otimizar, avaliarOrdem, salvarBloco, despachar, concluirParada, registrarRetorno, desfazerBloco, medidorRuas, mensagemBloco, minhasRotas, iniciarPerna, quandoSai, tempos, listarDestinatarios, salvarDestinatario, excluirDestinatario } from "@/lib/rotas";
import { autocompletar, lugar, temGoogle } from "@/lib/googleMaps";   // v427

// monta e despacha rotas: master, diretoria, administrativo e logística
const podeMontar = (u) => !!u && (u.isMaster || !!u.diretoria || ["ADMINISTRATIVO", "LOGISTICA", "FINANCEIRO"].includes(u.setor));
async function quem(id) {
  const u = await usuarioAtivoFin(id);
  if (!u) return null;
  const x = await prisma.usuario.findUnique({ where: { id: u.id }, select: { pessoaId: true } });
  return { ...u, pessoaId: x?.pessoaId || null };
}
const negado = (m = "Sem acesso.") => Response.json({ error: m }, { status: 403 });

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const u = await quem(q.get("u"));
  if (!u) return negado();
  if (q.get("destinos")) return Response.json(await destinos());
  if (q.get("minhas")) return Response.json({ ...(await minhasRotas(u.pessoaId)), pessoaId: u.pessoaId, nome: u.nome });   // v452 — app do motorista
  if (q.get("destinatarios")) return Response.json(await listarDestinatarios());   // v430
  // v427 — autocomplete de endereço do Google
  if (q.get("auto") != null) { try { return Response.json(await autocompletar(q.get("auto"), q.get("sessao"))); } catch (e) { return Response.json({ error: e.message }, { status: 502 }); } }
  if (q.get("lugar")) { try { return Response.json(await lugar(q.get("lugar"), q.get("sessao"), q.get("digitado"))); } catch (e) { return Response.json({ error: e.message }, { status: 502 }); } }
  const de = q.get("de"), ate = q.get("ate");
  if (!de || !ate) return Response.json({ error: "Período?" }, { status: 400 });
  return Response.json({ ...(await painel({ de, ate })), podeMontar: podeMontar(u), pessoaId: u.pessoaId, google: temGoogle() });
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await quem(b.usuarioId);
  if (!u) return negado();
  const r = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
  switch (b.acao) {
    case "demanda": return r(await salvarDemanda(b.demanda || {}, u));
    case "cancelar": return r(await cancelarDemanda(b.id, u));
    case "destinatario": return r(await salvarDestinatario(b.destinatario || {}, u));   // v430
    case "excluirDestinatario": return r(await excluirDestinatario(b.id));
    case "fabrica": if (!podeMontar(u)) return negado(); return r(await salvarFabrica(b.endereco, b.geo));
    case "otimizar": case "avaliar": {
      if (!podeMontar(u)) return negado();
      const ds = await prisma.rotaDemanda.findMany({ where: { id: { in: (b.ids || []).map(Number) } } });
      const por = Object.fromEntries(ds.map((d) => [d.id, d]));
      const tl = tempos(b.tempos);   // v439
      const seq = (b.ids || []).map((i) => por[Number(i)]).filter(Boolean).map((d) => (tl[d.id] != null ? { ...d, tempoLocal: tl[d.id] } : d));
      const fab = await fabrica();
      const { medir, porRuas, erro } = await medidorRuas([fab, ...seq], b.veiculo, seq[0] ? quandoSai(seq[0].data, b.saida) : null);   // v427 — distância e tempo por ruas
      const o = { saida: b.saida, veiculo: b.veiculo, medir };
      return r({ ...(b.acao === "otimizar" ? otimizar(seq, fab, o) : avaliarOrdem(seq, fab, o)), porRuas: !!porRuas, avisoRuas: erro || null });
    }
    case "bloco": if (!podeMontar(u)) return negado(); return r(await salvarBloco(b, u));
    case "despachar": {
      if (!podeMontar(u)) return negado();
      const x = await despachar(b.id);
      if (x.ok && x.usuarioMotorista && x.usuarioMotorista !== u.id)
        await prisma.mensagem.create({ data: { deId: u.id, paraId: x.usuarioMotorista, texto: x.texto.slice(0, 2000) } }).catch(() => null);
      return r(x);
    }
    case "mensagem": if (!podeMontar(u)) return negado(); return r(await mensagemBloco(b.id));   // v443
    case "desfazerBloco": if (!podeMontar(u)) return negado(); return r(await desfazerBloco(b.id));
    case "perna": {   // v452 — motorista inicia a perna (até a parada ou a volta)
      const bid = b.volta ? Number(b.blocoId) : (await prisma.rotaDemanda.findUnique({ where: { id: Number(b.id) }, select: { blocoId: true } }))?.blocoId;
      const bl = bid ? await prisma.rotaBloco.findUnique({ where: { id: bid } }) : null;
      if (!bl) return r({ error: "Rota não encontrada." });
      if (!podeMontar(u) && bl.motoristaId !== u.pessoaId) return negado("Só o motorista da rota.");
      return r(await iniciarPerna(b));
    }
    case "parada": case "retorno": {
      // o motorista da rota (pelo usuário ligado à folha) ou quem monta as rotas
      const bl = b.acao === "retorno" ? await prisma.rotaBloco.findUnique({ where: { id: Number(b.id) } })
        : await prisma.rotaBloco.findFirst({ where: { id: (await prisma.rotaDemanda.findUnique({ where: { id: Number(b.id) }, select: { blocoId: true } }))?.blocoId || 0 } });
      if (!bl) return r({ error: "Rota não encontrada." });
      if (!podeMontar(u) && bl.motoristaId !== u.pessoaId) return negado("Só o motorista da rota ou o administrativo.");
      return r(b.acao === "retorno" ? await registrarRetorno(b.id) : await concluirParada(b.id, u, !!b.desfazer));
    }
    default: return r({ error: "Ação?" });
  }
}
