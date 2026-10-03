export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { perguntarIA, iaDisponivel, consultarCnpj } from "@/lib/finIA";
import { formatarCnpj } from "@/lib/finNfSaida";

const brl = (v) => Number(v).toFixed(2);

const SYSTEM = `Você cruza recebimentos bancários de uma confecção de uniformes (MERIDIAN) com as notas fiscais de saída do mês.
Para cada LINHA de recebimento, descubra a NF (ou NFs) correspondente e o nome e CNPJ do pagador.

Regras:
- Case primeiro pelo VALOR: o valor recebido costuma ser igual ao valor da nota.
- O valor pode ser a SOMA de 2 ou 3 notas do mesmo cliente — nesse caso devolva os números separados por " ; ".
- O valor pode vir MENOR que a nota por retenção na fonte (IR/CSLL/INSS/ISS, normalmente entre 1% e 11%).
  Nesse caso case a nota e escreva na observação "HOUVE RETENÇÃO NA FONTE".
- O valor pode ser ADIANTAMENTO (sinal/entrada antes de faturar): não existe nota ainda. Use nf = "ADIANTAMENTO".
- O nome do pagador no extrato vem TRUNCADO (ex.: "AUTOLOG SOLUCOES LOGI"). Case pelo começo do nome.
- Nunca invente número de nota, nome ou CNPJ que não esteja nos dados recebidos.
- Pessoa física sem nota: nf = "ADIANTAMENTO", cnpj = null.

Responda SÓ com uma lista JSON entre <json></json>, um objeto por linha que você conseguiu resolver:
[{"id":123,"nf":"1873","nome":"OITAVA IGREJA PRESBITERIANA","cnpj":"21.854.112/0001-80","obs":null,"confianca":"ALTA","motivo":"valor idêntico à NF 1873"}]
confianca: ALTA | MEDIA | BAIXA. Use null no que não souber. Não escreva nada fora do <json>.`;

// POST { usuarioId, competencia }                  → sugestões
// POST { usuarioId, aplicar:[{id,nf,nome,cnpj,obs}] } → grava as escolhidas
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();

  // ---- aplicar ----
  if (Array.isArray(b.aplicar)) {
    let n = 0;
    for (const s of b.aplicar) {
      const d = { origem: "IA", editado: true };
      if (s.nf !== undefined) d.nf = s.nf ? String(s.nf).toUpperCase() : null;
      if (s.nome !== undefined && s.nome) d.nomePagador = String(s.nome).toUpperCase();
      if (s.cnpj !== undefined && s.cnpj) d.cnpj = formatarCnpj(s.cnpj);
      if (s.obs !== undefined && s.obs) d.obs = String(s.obs).toUpperCase();
      const r = await prisma.finRecebimento.update({ where: { id: Number(s.id) }, data: d }).catch(() => null);
      if (r) n++;
    }
    return Response.json({ ok: true, aplicadas: n });
  }

  // ---- analisar ----
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  if (!iaDisponivel()) return Response.json({ error: "Sem ANTHROPIC_API_KEY no .env da VPS — a análise com IA não está disponível." }, { status: 503 });

  const [linhas, notas] = await Promise.all([
    prisma.finRecebimento.findMany({
      where: { competencia: b.competencia },
      orderBy: [{ data: "asc" }, { ordem: "asc" }],
      select: { id: true, bloco: true, data: true, titulo: true, valor: true, nf: true, nomePagador: true, cnpj: true, obs: true },
    }),
    prisma.finNfSaida.findMany({
      where: { competencia: b.competencia },
      orderBy: { emissao: "asc" },
      select: { numero: true, valor: true, destNome: true, destCnpj: true, emissao: true },
    }),
  ]);
  if (!notas.length) return Response.json({ error: "Nenhuma nota de saída lida neste mês. Envie os XMLs na guia Contabilidade." }, { status: 400 });

  const pendentes = linhas.filter((l) => !l.nf || !l.cnpj || !l.nomePagador);
  if (!pendentes.length) return Response.json({ ok: true, sugestoes: [], msg: "Todas as linhas já têm NF, nome e CNPJ." });

  const conteudo = [
    `MÊS: ${b.competencia}`,
    "",
    "NOTAS DE SAÍDA DO MÊS (numero | valor | destinatário | CNPJ | emissão):",
    ...notas.map((n) => `${n.numero} | ${brl(n.valor)} | ${n.destNome} | ${n.destCnpj || "-"} | ${n.emissao.toISOString().slice(0, 10)}`),
    "",
    "LINHAS DE RECEBIMENTO A RESOLVER (id | data | título | valor | nf atual | nome atual | cnpj atual):",
    ...pendentes.map((l) => `${l.id} | ${l.data ? l.data.toISOString().slice(0, 10) : "-"} | ${l.titulo || "-"} | ${brl(l.valor)} | ${l.nf || "-"} | ${l.nomePagador || "-"} | ${l.cnpj || "-"}`),
  ].join("\n");

  let sug = [];
  try { sug = await perguntarIA(SYSTEM, conteudo); } catch (e) { return Response.json({ error: e.message }, { status: 502 }); }

  const porId = new Map(pendentes.map((l) => [l.id, l]));
  const saida = [];
  for (const s of sug) {
    const l = porId.get(Number(s.id));
    if (!l) continue;
    let cnpj = s.cnpj ? formatarCnpj(s.cnpj) : null;
    let razao = null;
    if (cnpj && !s.nome) {
      const c = await consultarCnpj(cnpj.replace(/\D/g, "")).catch(() => null);
      razao = c?.razao || null;
    }
    saida.push({
      id: l.id,
      atual: { data: l.data, titulo: l.titulo, valor: l.valor, nf: l.nf, nome: l.nomePagador, cnpj: l.cnpj },
      nf: s.nf ? String(s.nf).toUpperCase() : null,
      nome: s.nome ? String(s.nome).toUpperCase() : razao ? razao.toUpperCase() : null,
      cnpj,
      obs: s.obs ? String(s.obs).toUpperCase() : null,
      confianca: ["ALTA", "MEDIA", "BAIXA"].includes(String(s.confianca).toUpperCase()) ? String(s.confianca).toUpperCase() : "BAIXA",
      motivo: s.motivo || null,
    });
  }
  const peso = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
  saida.sort((a, c) => peso[a.confianca] - peso[c.confianca]);
  return Response.json({ ok: true, analisadas: pendentes.length, sugestoes: saida });
}
