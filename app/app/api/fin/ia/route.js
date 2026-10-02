export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida, garantirContas, sugerirTermo, descartarPagamentosFatura } from "@/lib/fin";
import { indiceHistorico, candidatos, topConta, chaveHist, iaDisponivel, perguntarIA, acharCnpj, consultarCnpj } from "@/lib/finIA";

const r2 = (n) => Math.round(n * 100) / 100;
const LOTE = 50;
const LOTE_WEB = 8;

const SYS_WEB = `Você é o analista financeiro da Meridian, indústria de uniformes corporativos em Belo Horizonte/MG (compra tecidos, malhas e aviamentos; usa facções, bordado, silk, sublimação, DTF; tem frota, frete e equipe administrativa).
Você recebe lançamentos de extrato/fatura SEM NENHUM PRECEDENTE no histórico da empresa. Descubra do que se trata e escolha a conta-caixa.
Como pesquisar:
- Para EMPRESAS, estabelecimentos, marcas, sites e apps (nome fantasia, razão social, descritor de cartão como "MP *LOJAX", "PAG*FULANO", "EC *", "IFD*"), use a busca na internet: descubra o ramo (posto, restaurante, software, loja de tecidos, gráfica, transportadora...). Se vier "Dados do CNPJ", já use-os e só pesquise se ainda faltar clareza.
- Descritores comuns: "MP*" = Mercado Pago, "PAG*"/"PAGSEGURO" = PagSeguro, "IFD*"/"IFOOD" = iFood, "UBER*"/"99*" = transporte, "EC *" = maquininha.
- NÃO pesquise nomes de PESSOAS FÍSICAS (privacidade). Para PIX/TED a pessoas, deduza pelo contexto (valor, banco, padrão: na Meridian pagamentos a pessoas costumam ser facção, freelancer de corte/costura/expedição, ou pessoal) e dê confiança BAIXA.
- Faça no máximo 1 ou 2 buscas por lançamento; agrupe quando possível.
Regras de conta: 1xxxxxx receitas (entradas), 2xxxxxx despesas (saídas), 3000000 CONCILIAÇÃO (transferência entre contas da própria empresa). Nunca invente conta fora do plano; respeite o sinal (C = entrada, D = saída).
Ao final, responda com a lista JSON entre <json> e </json>:
<json>[{"g": <número do grupo>, "contaCodigo": "2111100" | null, "confianca": "ALTA"|"MEDIA"|"BAIXA", "achado": "o que você descobriu, em até 15 palavras (ex.: posto de combustível em Contagem/MG)", "motivo": "por que essa conta, frase curta", "termo": "PALAVRA-CHAVE curta para o futuro" | null}]</json>`;

const SYS_SUG = `Você é o analista financeiro da Meridian (indústria de uniformes). Classifica lançamentos de extratos e faturas em contas-caixa.
Para cada grupo de lançamentos A IDENTIFICAR você recebe: histórico, banco, sinal (C = entrada, D = saída), quantidade, valor total e os CANDIDATOS vindos do histórico de identificações da empresa (histórico parecido → conta usada e quantas vezes).
Regras:
- O histórico da empresa é a fonte principal. Se a chave exata tem uma conta dominante, use-a com confiança ALTA.
- Contas 1xxxxxx são receitas (entradas), 2xxxxxx despesas (saídas), 3000000 é CONCILIAÇÃO (transferência entre contas da própria empresa — Meridian Ltda, Meridian Artigos Militares, Igor Santos Costa como sócio pode ser empréstimo/pró-labore, confira pelo histórico).
- Sem candidato bom, use o seu conhecimento (nome de fornecedor, tipo de serviço) e dê confiança MEDIA ou BAIXA. Se não der para saber, contaCodigo = null.
- Nunca invente conta fora do plano enviado. Respeite o sinal: entrada raramente vai para despesa e vice-versa (só estornos).
- termo: a palavra-chave curta que identificaria esse lançamento no futuro (nome do fornecedor/cliente, sem datas e números). null se for genérico demais.
Responda SOMENTE um JSON (lista), sem texto fora dele: [{"g": <número do grupo>, "contaCodigo": "2112100" | null, "confianca": "ALTA"|"MEDIA"|"BAIXA", "motivo": "frase curta em português", "termo": "TEXTO" | null}]`;

const SYS_INC = `Você é o auditor financeiro da Meridian (indústria de uniformes). Revise lançamentos JÁ identificados que o sistema marcou como suspeitos: a conta usada diverge do histórico da empresa, ou o sinal não combina com o tipo de conta, ou uma palavra-chave genérica pode ter pego o lançamento errado (conflito de nomes).
Contas 1xxxxxx = receitas, 2xxxxxx = despesas, 3000000 = conciliação entre contas da própria empresa.
Para cada item decida: "TROCAR" (a conta atual está errada; diga a conta certa do plano) ou "OK" (é um caso legítimo, ex.: estorno, compra pontual diferente). Seja criterioso: só TROCAR com evidência.
Responda SOMENTE um JSON (lista): [{"i": <número do item>, "acao": "TROCAR"|"OK", "contaCodigo": "2112100" | null, "motivo": "frase curta em português"}]`;

// POST { usuarioId, competencia } → { sugestoes:[], incongruencias:[], ia, aviso }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const comp = b.competencia;
  if (!competenciaValida(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  await garantirContas();
  const pagFatura = await descartarPagamentosFatura(comp);

  const [contas, ls, regras, idx] = await Promise.all([
    prisma.finConta.findMany({ orderBy: { codigo: "asc" } }),
    prisma.finLancamento.findMany({ where: { competencia: comp, desmembrado: false, substituido: false } }),
    prisma.finRegra.findMany({ select: { id: true, termo: true } }),
    indiceHistorico(comp),
  ]);
  if (!idx.total) return Response.json({ error: "Ainda não há histórico de identificações. Importe o histórico primeiro." }, { status: 400 });
  const cId = Object.fromEntries(contas.map((c) => [c.id, c]));
  const cCod = Object.fromEntries(contas.map((c) => [c.codigo, c]));
  const nomeC = (id) => (cId[id] ? `${cId[id].codigo} ${cId[id].nome}` : "?");
  const plano = contas.filter((c) => c.ativo).map((c) => `${c.codigo} ${c.nome}`).join("\n");
  const regraTermo = Object.fromEntries(regras.map((r) => [r.id, r.termo]));

  // ---------- 1. A IDENTIFICAR: agrupa por histórico parecido + sinal ----------
  const gMap = new Map();
  for (const l of ls.filter((x) => !x.contaId)) {
    const v = Number(l.valor);
    const k = `${v > 0 ? "C" : "D"}|${l.banco}|${chaveHist(l.historico)}`;
    let g = gMap.get(k);
    if (!g) { g = { historico: l.historico, banco: l.banco, sinal: v > 0 ? "C" : "D", ids: [], total: 0, ex: l }; gMap.set(k, g); }
    g.ids.push(l.id); g.total += v;
  }
  const grupos = [...gMap.values()].map((g, i) => {
    const cand = candidatos(idx, g.ex);
    const top = cand.exata ? topConta(cand.exata.contas) : null;
    const lista = [
      ...(cand.exata ? [{ tipo: "EXATO", exemplo: cand.exata.exemplo, contas: cand.exata.contas }] : []),
      ...cand.parecidos.map((p) => ({ tipo: `PARECIDO ${Math.round(p.s * 100)}%`, exemplo: p.c.exemplo, contas: p.c.contas })),
    ];
    // palpite do próprio sistema (vale se a IA estiver fora)
    const pTop = !top && cand.parecidos[0] ? topConta(cand.parecidos[0].c.contas) : null;
    const base = top || pTop;
    return {
      g: i + 1, ...g, total: r2(g.total), candidatos: lista,
      sistema: base ? { contaId: base.contaId, confianca: top && top.share >= 0.8 && top.tot >= 2 ? "ALTA" : top ? "MEDIA" : "BAIXA",
        motivo: `${top ? "Mesmo histórico" : "Histórico parecido"}: ${base.n} de ${base.tot} vezes em ${nomeC(base.contaId)}` } : null,
    };
  });

  // grupos sem precedente no histórico → pesquisa na internet (com cache)
  grupos.forEach((g) => {
    const c = candidatos(idx, g.ex, 1);
    g.chavePesq = `${g.sinal}|${chaveHist(g.historico)}`;
    g.semHist = !c.exata && (!c.parecidos.length || c.parecidos[0].s < 0.5);
  });
  const semHist = grupos.filter((g) => g.semHist);
  const salvas = semHist.length ? await prisma.finPesquisa.findMany({ where: { chave: { in: semHist.map((g) => g.chavePesq) } } }) : [];
  const salvaPor = Object.fromEntries(salvas.map((p) => [p.chave, p]));
  if (b.refazerPesquisa) {
    await prisma.finPesquisa.deleteMany({ where: { chave: { in: semHist.map((g) => g.chavePesq) } } });
    for (const k of Object.keys(salvaPor)) delete salvaPor[k];
  }

  // ---------- 2. SUSPEITOS entre os identificados ----------
  const suspeitos = [];
  for (const l of ls.filter((x) => x.contaId)) {
    const conta = cId[l.contaId];
    if (!conta) continue;
    const v = Number(l.valor);
    const motivos = [];
    const cand = candidatos(idx, l, 3);
    const top = cand.exata ? topConta(cand.exata.contas) : null;
    if (top && top.contaId !== l.contaId && top.tot >= 3 && top.share >= 0.6 && (cand.exata.contas[l.contaId] || 0) / top.tot < 0.3)
      motivos.push(`histórico usa ${nomeC(top.contaId)} em ${top.n} de ${top.tot} vezes`);
    if (conta.codigo !== "3000000" && ((v > 0 && conta.codigo.startsWith("2")) || (v < 0 && conta.codigo.startsWith("1"))))
      motivos.push(v > 0 ? "entrada numa conta de despesa" : "saída numa conta de receita");
    if (l.regraId && regraTermo[l.regraId] && regraTermo[l.regraId].split(";").some((t) => t.trim().length <= 4) && top && top.contaId !== l.contaId)
      motivos.push(`palavra-chave curta "${regraTermo[l.regraId]}" pode ter conflito de nome`);
    if (motivos.length) suspeitos.push({ l, conta, motivos, cand, top });
  }
  suspeitos.sort((a, b) => Math.abs(Number(b.l.valor)) - Math.abs(Number(a.l.valor)));
  const susp = suspeitos.slice(0, 120).map((s, i) => ({ i: i + 1, ...s }));

  // ---------- 3. IA ----------
  let ia = false, aviso = "";
  const respSug = {}, respInc = {};
  if (iaDisponivel() && (grupos.length || susp.length)) {
    const fmtContas = (c) => Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${nomeC(id)} ×${n}`).join("; ");
    const txtG = (g) => `#${g.g} | ${g.sinal} | ${g.banco} | ${g.historico} | ${g.ids.length} lanç. | R$ ${g.total.toFixed(2)}\n` +
      (g.candidatos.length ? g.candidatos.map((c) => `   ${c.tipo}: "${c.exemplo}" → ${fmtContas(c.contas)}`).join("\n") : "   (sem candidatos no histórico)");
    const txtS = (s) => `#${s.i} | ${Number(s.l.valor) > 0 ? "C" : "D"} | ${s.l.banco} | ${s.l.data.toISOString().slice(0, 10)} | ${s.l.historico}${s.l.identificacao ? " / " + s.l.identificacao : ""} | R$ ${Number(s.l.valor).toFixed(2)}\n` +
      `   conta atual: ${s.conta.codigo} ${s.conta.nome} (por ${s.l.identificadoPor || "?"})\n   alerta: ${s.motivos.join("; ")}\n` +
      (s.cand.exata ? `   histórico exato → ${fmtContas(s.cand.exata.contas)}\n` : "") +
      s.cand.parecidos.slice(0, 2).map((p) => `   parecido "${p.c.exemplo}" → ${fmtContas(p.c.contas)}`).join("\n");
    const tarefas = [];
    // a) grupos com histórico: IA decide com base nos candidatos
    const comHist = grupos.filter((g) => !g.semHist);
    for (let i = 0; i < comHist.length; i += LOTE) {
      const lote = comHist.slice(i, i + LOTE);
      tarefas.push(perguntarIA(SYS_SUG, `PLANO DE CONTAS:\n${plano}\n\nGRUPOS A IDENTIFICAR:\n${lote.map(txtG).join("\n")}`).then((r) => r.forEach((x) => (respSug[x.g] = x))));
    }
    // b) grupos sem histórico: pesquisa salva ou pesquisa na internet (+ dados do CNPJ)
    const novos = semHist.filter((g) => {
      const p = salvaPor[g.chavePesq];
      if (p) respSug[g.g] = { g: g.g, contaCodigo: p.contaCodigo, confianca: p.confianca, motivo: p.motivo, termo: p.termo, achado: p.achado, salva: true };
      return !p;
    });
    if (novos.length) {
      await Promise.all(novos.map(async (g) => {
        const cnpj = acharCnpj(`${g.historico} ${g.ex.identificacao || ""} ${g.ex.documento || ""}`);
        g.cnpj = cnpj ? await consultarCnpj(cnpj) : null;
      }));
      const txtW = (g) => `#${g.g} | ${g.sinal} | ${g.banco} | ${g.historico}${g.ex.identificacao ? " / " + g.ex.identificacao : ""} | ${g.ids.length} lanç. | R$ ${g.total.toFixed(2)}` +
        (g.cnpj ? `\n   Dados do CNPJ: ${g.cnpj.razao}${g.cnpj.fantasia ? " (" + g.cnpj.fantasia + ")" : ""} · atividade: ${g.cnpj.atividade} · ${g.cnpj.cidade}` : "");
      for (let i = 0; i < novos.length; i += LOTE_WEB) {
        const lote = novos.slice(i, i + LOTE_WEB);
        tarefas.push(perguntarIA(SYS_WEB, `PLANO DE CONTAS:\n${plano}\n\nLANÇAMENTOS SEM HISTÓRICO:\n${lote.map(txtW).join("\n")}`, { web: true, maxBuscas: lote.length * 2 })
          .then(async (r) => {
            for (const x of r) {
              const g = lote.find((y) => y.g === Number(x.g));
              if (!g) continue;
              respSug[g.g] = { ...x, web: true };
              const dado = { historico: g.historico, achado: x.achado || null, contaCodigo: x.contaCodigo || null, confianca: x.confianca || null, motivo: x.motivo || null, termo: x.termo || null };
              await prisma.finPesquisa.upsert({ where: { chave: g.chavePesq }, update: dado, create: { chave: g.chavePesq, ...dado } }).catch(() => {});
            }
          }));
      }
    }
    for (let i = 0; i < susp.length; i += LOTE) {
      const lote = susp.slice(i, i + LOTE);
      tarefas.push(perguntarIA(SYS_INC, `PLANO DE CONTAS:\n${plano}\n\nITENS SUSPEITOS:\n${lote.map(txtS).join("\n")}`).then((r) => r.forEach((x) => (respInc[x.i] = x))));
    }
    const res = await Promise.allSettled(tarefas);
    const falhas = res.filter((r) => r.status === "rejected");
    ia = falhas.length < res.length;
    if (falhas.length) aviso = `IA: ${falhas[0].reason?.message || "falha"}${ia ? " (parte da análise ficou só com o histórico)" : " — usei só o histórico."}`;
  } else if (!iaDisponivel()) aviso = "Chave da IA não configurada na VPS — sugestões feitas só com o histórico.";

  const sugestoes = grupos.map((g) => {
    const r = respSug[g.g];
    const conta = r && r.contaCodigo ? cCod[r.contaCodigo] : null;
    const contaId = conta ? conta.id : r ? null : g.sistema?.contaId || null;
    return {
      g: g.g, ids: g.ids, historico: g.historico, banco: g.banco, sinal: g.sinal, total: g.total, qtd: g.ids.length,
      contaId, confianca: r ? r.confianca : g.sistema?.confianca || null,
      motivo: r ? r.motivo : g.sistema?.motivo || "Sem histórico parecido.",
      termo: r ? r.termo || null : g.sistema ? sugerirTermo(g.historico) : null,
      fonte: r ? (r.salva ? "PESQUISA SALVA" : r.web ? "INTERNET" : "IA") : g.sistema ? "HISTÓRICO" : null,
      achado: r?.achado || null, semHist: !!g.semHist,
    };
  }).sort((a, b) => (b.contaId ? 1 : 0) - (a.contaId ? 1 : 0) || Math.abs(b.total) - Math.abs(a.total));

  const incongruencias = susp.map((s) => {
    const r = respInc[s.i];
    if (r && r.acao === "OK") return null;
    const sugId = r && r.contaCodigo ? cCod[r.contaCodigo]?.id : s.top && s.top.contaId !== s.l.contaId ? s.top.contaId : null;
    return {
      i: s.i, id: s.l.id, data: s.l.data.toISOString().slice(0, 10), banco: s.l.banco, historico: s.l.historico, valor: Number(s.l.valor),
      contaAtualId: s.l.contaId, contaSugeridaId: sugId || null, alertas: s.motivos, motivo: r ? r.motivo : s.motivos.join("; "),
      fonte: r ? "IA" : "HISTÓRICO",
    };
  }).filter(Boolean);

  return Response.json({ ia, aviso, pagFatura, pesquisados: semHist.length, historico: idx.total, sugestoes, incongruencias, descartadas: susp.length - incongruencias.length });
}
