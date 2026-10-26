// v501 — contas a pagar de facção vindas do Cronograma PCP (/api/ext/faccao/apagar): só OS FECHADA.
// Regras do Maycon: a chave é o nº da OS (nunca duplica) · paga-se o valorLiquido · valor unitário chega resolvido ·
// itemCode liga ao item de produção · uma OS é de um item (romaneio agrupa a viagem).
// Lançamento só pela tela de conferência: cada OS vira um item dos "terceirizados da semana" (mesma conta-caixa de facção de hoje).
import { prisma } from "@/lib/prisma";
import { getPcp } from "@/lib/cronograma";
import { TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS, contaDoSetor, garantirContasPrestadores } from "@/lib/prestadores";
import { tituloDaData, recalcular } from "@/lib/finSemana";

const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const so = (v) => String(v || "").replace(/\D/g, "");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);

// tipo de peça (conta de facção) pelo nome do produto
export function tipoDePeca(produto) {
  const t = sa(produto);
  if (/JAQUETA|CORTA VENTO|PARKA/.test(t)) return "JAQUETA";
  if (/MOLETOM|BLUSAO|CANGURU/.test(t)) return "MOLETOM";
  if (/POLO/.test(t)) return "POLO";
  if (/CAMISA SOCIAL|CAMISA MANGA|CAMISA M L|CAMISA M C/.test(t)) return "CAMISA_SOCIAL";
  if (/JALECO|GUARDA PO|CAMISA OPERACIONAL|BRIM/.test(t) && !/CALCA/.test(t)) return "JALECO_OPERACIONAL";
  if (/CALCA/.test(t)) return /JEANS/.test(t) ? "CALCA_JEANS" : /SOCIAL|ALFAIATARIA/.test(t) ? "CALCA_SOCIAL" : "CALCA_OPERACIONAL";
  return "CAMISETA";
}
// grupo e setor: costura/facção → FACCAO + tipo de peça; serviço conhecido (silk, bordado…) → o próprio serviço
function grupoSetor(os) {
  const sv = sa(os.servico);
  const serv = SERVICOS_TERCEIRIZADOS.find((s) => sv && (sv === s.k || sv.includes(s.k)));
  if (serv && serv.k !== "OUTRO") return { grupo: serv.k, setor: serv.k };
  return { grupo: "FACCAO", setor: tipoDePeca(os.produto) };
}
async function acharFaccao(os, lista) {
  const doc = so(os.faccaoDocumento), n = sa(os.faccao);
  return (doc && lista.find((p) => so(p.documento) === doc))
    || lista.find((p) => sa(p.nome) === n || sa(p.nomeKm) === n)
    || lista.find((p) => n && (sa(p.nome).startsWith(n + " ") || n.startsWith(sa(p.nome) + " ")))
    || lista.find((p) => n && n.split(" ").length === 1 && sa(p.nome).split(" ")[0] === n) || null;
}
// sexta-feira de pagamento: a do vencimento (ou a seguinte)
function sextaDe(venc) {
  const d = dUTC(venc); const dow = d.getUTCDay(); const add = (5 - dow + 7) % 7;
  return new Date(d.getTime() + add * 86400e3).toISOString().slice(0, 10);
}

// tela de conferência: OS fechadas do PCP + se já foram lançadas + facção e conta encontradas
export async function conferirFaccoes({ desde } = {}) {
  let j;
  try { j = await getPcp(`/api/ext/faccao/apagar${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`); }
  catch (e) { return { erro: /HTTP 404/.test(e.message) ? "O endereço de facções do Cronograma ainda não está publicado (o Maycon está construindo)." : e.message, contas: [] }; }
  const contas = (Array.isArray(j?.contas) ? j.contas : []).filter((c) => String(c.status || "").toUpperCase() === "FECHADA" && Number(c.os));
  const ja = Object.fromEntries((await prisma.faccaoOsPcp.findMany({ where: { os: { in: contas.map((c) => Number(c.os)) } } })).map((x) => [x.os, x]));
  const prest = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" } });
  const out = [];
  for (const c of contas) {
    const p = await acharFaccao(c, prest);
    const { grupo, setor } = grupoSetor(c);
    out.push({ ...c, os: Number(c.os), valorLiquido: r2(c.valorLiquido), valorBruto: r2(c.valorBruto),
      lancada: !!ja[Number(c.os)], lancadaEm: ja[Number(c.os)]?.createdAt || null, lancadaPor: ja[Number(c.os)]?.lancadoPorNome || null,
      prestador: p ? { id: p.id, nome: p.nome, pix: !!p.chavePix, ativo: p.ativo } : null, grupo, setor, conta: contaDoSetor(grupo, setor), sexta: c.vencimento ? sextaDe(c.vencimento) : null });
  }
  out.sort((a, b) => (a.lancada - b.lancada) || String(a.vencimento || "").localeCompare(String(b.vencimento || "")) || a.os - b.os);
  return { ok: true, geradoEm: j?.geradoEm || null, contas: out };
}

// lança as OS escolhidas: [{ os, prestadorId?, setor? }] (o operador pode corrigir facção e tipo de peça)
export async function lancarFaccoes(escolhas, quem) {
  const conf = await conferirFaccoes();
  if (conf.erro) return { error: conf.erro };
  await garantirContasPrestadores();
  const res = [], semanas = new Set();
  for (const e of escolhas || []) {
    const c = conf.contas.find((x) => x.os === Number(e.os));
    if (!c) { res.push({ os: e.os, erro: "OS não está mais fechada no PCP." }); continue; }
    if (c.lancada || (await prisma.faccaoOsPcp.findUnique({ where: { os: c.os } }))) { res.push({ os: c.os, erro: "Já lançada." }); continue; }
    const p = e.prestadorId ? await prisma.prestador.findUnique({ where: { id: Number(e.prestadorId) } }) : c.prestador ? await prisma.prestador.findUnique({ where: { id: c.prestador.id } }) : null;
    if (!p) { res.push({ os: c.os, erro: `Facção "${c.faccao}" não encontrada no cadastro de terceirizados.` }); continue; }
    const grupo = c.grupo, setor = e.setor && grupo === "FACCAO" ? e.setor : c.setor;
    const conta = await prisma.finConta.findUnique({ where: { codigo: contaDoSetor(grupo, setor) } });
    if (!conta) { res.push({ os: c.os, erro: "Conta-caixa do setor não encontrada." }); continue; }
    const venc = c.vencimento || new Date().toISOString().slice(0, 10);
    const casca = await tituloDaData("TERCEIRIZADO", sextaDe(venc), false);
    const desc = (c.descontos || []).map((d) => `${d.motivo} ${d.quantidade ?? ""} R$ ${r2(d.valor).toFixed(2).replace(".", ",")}`).join("; ");
    const item = await prisma.finSemanaItem.create({ data: {
      tituloId: casca.id, grupo, prestadorId: p.id, nome: p.nome.toUpperCase(), chavePix: p.chavePix || "", setor, contaId: conta.id,
      linhas: [{ pedido: c.pedido || "", item: `${c.produto || ""}${c.itemCode ? ` (${c.itemCode})` : ""}`.toUpperCase().slice(0, 200), qtd: 1, unitario: c.valorLiquido, total: c.valorLiquido }],
      valor: c.valorLiquido, dataRecebimento: c.retornadoEm ? dUTC(c.retornadoEm) : null, vencimentoNegociado: dUTC(venc), prazoDias: 0,
      descricao: `OS ${c.os} PCP · ${c.servico || "FACÇÃO"}`.toUpperCase(),
      observacao: [`PCP OS ${c.os}${c.romaneio ? ` · ROMANEIO ${c.romaneio}` : ""}`, c.itemCode ? `ITEM ${c.itemCode}` : null, c.refProduto ? `REF ${c.refProduto}` : null,
        `ENVIADAS ${c.quantidadeEnviada ?? "—"} · APROVADAS ${c.quantidadeAprovada ?? "—"}${c.quantidadePerdida ? ` · PERDA ${c.quantidadePerdida}` : ""}${c.quantidadeSegunda ? ` · 2ª ${c.quantidadeSegunda}` : ""}`,
        `UNIT. R$ ${r2(c.valorUnitario).toFixed(2).replace(".", ",")} · BRUTO R$ ${c.valorBruto.toFixed(2).replace(".", ",")}${desc ? ` · DESCONTOS: ${desc}` : ""}`, `FECHADA EM ${c.fechadaEm || "—"} · VENC. ${venc.split("-").reverse().join("/")}`,
        p.chavePix ? null : "SEM PIX NO CADASTRO"].filter(Boolean).join(" · ").toUpperCase().slice(0, 1000),
      criadoPorNome: quem || null,
    } });
    await prisma.faccaoOsPcp.create({ data: { os: c.os, dados: c, semanaItemId: item.id, tituloId: casca.id, prestadorId: p.id, valor: c.valorLiquido, lancadoPorNome: quem || null } });
    semanas.add(casca.id);
    res.push({ os: c.os, ok: true, valor: c.valorLiquido, sexta: sextaDe(venc), faccao: p.nome });
  }
  for (const t of semanas) await recalcular(t);
  return { ok: true, resultados: res };
}

// lista de facções (terceirizados) para o Cronograma, uma vez na implantação
export async function listaFaccoes() {
  const l = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" }, orderBy: { nome: "asc" } });
  return l.map((p) => ({ id: p.id, nome: p.nome, documento: so(p.documento) || "", nomeKm: p.nomeKm || null, ativo: p.ativo,
    servicos: (Array.isArray(p.servicos) ? p.servicos : []).map(String) }));
}
