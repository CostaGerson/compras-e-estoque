// v725 — integração com o Cronograma PCP (Maycon): cadastro de terceirizados e demanda de rota aberta pela OS do PCP.
// Ver claude/integracao-pcp-rota.md. Autenticação nas rotas /api/ext/*: X-Api-Key (o mesmo token de /api/ext/compras).
import { prisma } from "@/lib/prisma";
import { salvarDemanda, cancelarDemanda, motoristas, HORARIOS } from "@/lib/rotas";

const up = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
const so = (s) => String(s || "").replace(/\D/g, "");
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const BASE = () => String(process.env.APP_URL || "https://erp.meridianpro.com.br").replace(/\/$/, "");
const fmtDoc = (d) => {
  const x = so(d);
  if (x.length === 14) return x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (x.length === 11) return x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return x || null;
};

// ---- terceirizados ----
// serviço do cadastro (FACCAO:POLO, SILK:SILK, antigo SERVICO:SILK) → tipo do PCP
const TIPO_PCP = { FACCAO: "costura", CORTE: "corte", BORDADO: "bordado", SILK: "silk", DTF: "dtf", SUBLIMACAO: "sublimacao", OUTRO: "outro" };
const PERSONALIZA = new Set(["bordado", "silk", "dtf", "sublimacao"]);
export function tiposDe(servicos) {
  const s = new Set();
  for (const v of Array.isArray(servicos) ? servicos : []) {
    const [g, k] = String(v).toUpperCase().split(":");
    const t = TIPO_PCP[g === "SERVICO" ? k : g];
    if (t) s.add(t);
  }
  if ([...s].some((t) => PERSONALIZA.has(t))) s.add("personalizacao");
  return [...s];
}
// o cadastro guarda o endereço numa linha só (normalmente no formato do Google: "Rua X, 120 - Bairro, Cidade - UF, 00000-000, Brasil")
export function partesEndereco(txt, geo) {
  const completo = String(txt || "").replace(/\s+/g, " ").trim();
  if (!completo) return null;
  const cepM = completo.match(/\b(\d{5})-?(\d{3})\b/);
  let r = completo.replace(/,?\s*(Brasil|Brazil)\s*$/i, "").replace(/,?\s*\d{5}-?\d{3}\s*,?/, ",").replace(/[,\s]+$/, "").replace(/,\s*,/g, ",").trim();
  const out = { completo, logradouro: null, bairro: null, cidade: null, uf: null, cep: cepM ? `${cepM[1]}-${cepM[2]}` : null, referencia: null };
  const m = r.match(/^(.*?)\s+-\s+([^,]+),\s*([^,]+?)\s*[-/]\s*([A-Za-z]{2})$/);
  if (m) Object.assign(out, { logradouro: m[1].trim(), bairro: m[2].trim(), cidade: m[3].trim(), uf: m[4].toUpperCase() });
  else {
    const c = r.match(/^(.*?),\s*([^,]+?)\s*[-/]\s*([A-Za-z]{2})$/);
    if (c) Object.assign(out, { logradouro: c[1].trim(), cidade: c[2].trim(), uf: c[3].toUpperCase() });
    else out.logradouro = r || null;
  }
  if (!out.cidade && geo?.municipio) out.cidade = geo.municipio;
  if (!out.uf && geo?.uf) out.uf = geo.uf;
  return out;
}

export async function terceirizadosExt({ desde } = {}) {
  const d = desde ? new Date(desde) : null;
  const where = { tipo: "TERCEIRIZADO", ...(d && !isNaN(d) ? { updatedAt: { gt: d } } : {}) };
  const ps = await prisma.prestador.findMany({ where, orderBy: { nome: "asc" } });
  const chaves = ps.map((p) => sem(p.endereco).slice(0, 300)).filter(Boolean);
  const geos = chaves.length ? await prisma.geoCache.findMany({ where: { chave: { in: chaves } } }).catch(() => []) : [];
  const gk = Object.fromEntries(geos.map((g) => [g.chave, g]));
  const terceirizados = ps.map((p) => ({
    id: p.id,
    nome: up(p.nome),
    nomeFantasia: null,
    nomeKm: p.nomeKm || null,
    documento: fmtDoc(p.documento),
    tipos: tiposDe(p.servicos),
    servicosErp: (Array.isArray(p.servicos) ? p.servicos : []).map(String),
    ativo: !!p.ativo,
    telefone: p.telefone || null,
    endereco: partesEndereco(p.endereco, gk[sem(p.endereco).slice(0, 300)]),
    atualizadoEm: p.updatedAt.toISOString(),
  }));
  return { versao: 1, geradoEm: new Date().toISOString(), total: terceirizados.length, terceirizados };
}

// ---- campos do formulário (na ordem da tela Logística › Rotas) ----
// mostrarSe: o campo só aparece quando o outro campo tem um destes valores
export async function camposRota() {
  const ms = await motoristas().catch(() => []);
  const padrao = ms.find((m) => m.padrao);
  return {
    versao: 1,
    observacao: "Destinatário, endereço e telefone vêm do cadastro do terceirizado (terceirizadoId). Se 'tarefa' vier vazia, o ERP escreve a partir da OS e dos itens.",
    campos: [
      { id: "objetivo", rotulo: "Objetivo", tipo: "opcao", obrigatorio: true, padrao: "ENTREGA",
        opcoes: [{ valor: "ENTREGA", rotulo: "Entrega" }, { valor: "COLETA", rotulo: "Coleta" }, { valor: "COLETA_ENTREGA", rotulo: "Coleta e entrega" }] },
      { id: "tarefa", rotulo: "O que fazer lá", tipo: "texto", obrigatorio: false, max: 200, dica: "ex.: levar OS 47 · 420 pç" },
      { id: "contato", rotulo: "Contato", tipo: "texto", obrigatorio: false },
      { id: "telefone", rotulo: "Telefone", tipo: "texto", obrigatorio: false, dica: "vazio = telefone do cadastro" },
      { id: "data", rotulo: "Data", tipo: "data", obrigatorio: true },
      { id: "horarioTipo", rotulo: "Horário", tipo: "opcao", obrigatorio: true, padrao: "LIVRE",
        opcoes: [["FIXO", "Horário fixo"], ["MANHA", "Manhã"], ["TARDE", "Tarde"], ["ATE", "Até as…"], ["APOS", "Após as…"], ["ENTRE", "De … até …"], ["LIVRE", "Qualquer horário"]].map(([valor, rotulo]) => ({ valor, rotulo })) },
      { id: "hora1", rotulo: "Hora", tipo: "hora", obrigatorio: true, mostrarSe: { campo: "horarioTipo", valores: ["FIXO", "ATE", "APOS", "ENTRE"] },
        rotulosPor: { FIXO: "Às", ATE: "Até as", APOS: "Após as", ENTRE: "De" } },
      { id: "hora2", rotulo: "Até", tipo: "hora", obrigatorio: true, mostrarSe: { campo: "horarioTipo", valores: ["ENTRE"] } },
      { id: "tempoLocal", rotulo: "Tempo previsto no local (min)", tipo: "numero", obrigatorio: false, padrao: 15 },
      { id: "volumes", rotulo: "Volumes", tipo: "numero", obrigatorio: false, dica: "entra no texto da tarefa" },
      { id: "urgente", rotulo: "Urgente", tipo: "sim/nao", obrigatorio: false, padrao: false },
      { id: "pendente", rotulo: "Pendente", tipo: "sim/nao", obrigatorio: false, padrao: false, dica: "só registro: ainda não está pronta para despachar" },
      { id: "pendencia", rotulo: "Pendência (o que falta para ficar pronta)", tipo: "texto", obrigatorio: false, max: 120, mostrarSe: { campo: "pendente", valores: [true] } },
      { id: "frete", rotulo: "Frete (contratado à parte)", tipo: "sim/nao", obrigatorio: false, padrao: false },
      { id: "freteTipo", rotulo: "Tipo de frete", tipo: "opcao", obrigatorio: true, mostrarSe: { campo: "frete", valores: [true] },
        opcoes: [{ valor: "TRANSPORTADORA", rotulo: "Transportadora" }, { valor: "FRETEBRAS", rotulo: "Fretebras" }, { valor: "UBER_CARRO", rotulo: "Uber carro" }, { valor: "UBER_MOTO", rotulo: "Uber moto" }] },   // v836/v837 — #79
      { id: "freteValorMax", rotulo: "Valor máximo a pagar (R$)", tipo: "numero", obrigatorio: true, mostrarSe: { campo: "freteTipo", valores: ["FRETEBRAS"] } },
      { id: "freteVolumes", rotulo: "Número de volumes", tipo: "numero", obrigatorio: false, mostrarSe: { campo: "frete", valores: [true] }, dica: "obrigatório na Fretebras" },
      { id: "motoristaId", rotulo: "Motorista", tipo: "opcao", obrigatorio: false, mostrarSe: { campo: "frete", valores: [false] }, padrao: padrao?.id || "",
        opcoes: [{ valor: "", rotulo: "A definir" }, ...ms.map((m) => ({ valor: m.id, rotulo: `${m.nome}${m.origem === "FREELANCER" ? " (freelancer)" : ""}`, emRota: !!m.emRota }))] },
      { id: "veiculo", rotulo: "Veículo", tipo: "opcao", obrigatorio: false, mostrarSe: { campo: "frete", valores: [false] },
        opcoes: [{ valor: "CARRO", rotulo: "Carro" }, { valor: "MOTO", rotulo: "Moto" }] },
      { id: "obs", rotulo: "Observação", tipo: "textoLongo", obrigatorio: false },
    ],
  };
}

// ---- demanda de rota ----
const urlDemanda = (d) => `${BASE()}/?v=rota&demanda=${d.id}&data=${new Date(d.data).toISOString().slice(0, 10)}`;
const saida = (d, extra = {}) => ({ ok: true, rotaId: d.id, numero: `#${d.id}`, status: d.status, data: new Date(d.data).toISOString().slice(0, 10), url: urlDemanda(d), ...extra });
const doPcp = (os) => ({ origem: "PCP", origemRef: String(os) });

export async function statusRotaPcp(osPcp) {
  if (!osPcp) return { ok: false, error: "Informe a OS (osPcp)." };
  const l = await prisma.rotaDemanda.findMany({ where: doPcp(osPcp), orderBy: { id: "desc" } });
  if (!l.length) return { ok: false, error: `A OS ${osPcp} não tem demanda de rota no ERP.` };
  const at = l.find((d) => d.status !== "CANCELADA") || l[0];
  return saida(at);
}

export async function criarRotaPcp(b) {
  const os = parseInt(b?.osPcp, 10);
  if (!os) return { ok: false, error: "Falta o número da OS do PCP." };
  const ja = await prisma.rotaDemanda.findFirst({ where: { ...doPcp(os), status: { not: "CANCELADA" } }, orderBy: { id: "desc" } });
  if (ja) return saida(ja, { jaExistia: true });
  const p = b.terceirizadoId ? await prisma.prestador.findUnique({ where: { id: Number(b.terceirizadoId) } }) : null;
  if (!p || p.tipo !== "TERCEIRIZADO") return { ok: false, error: "Terceirizado não encontrado no ERP. Atualize a lista de terceirizados e escolha de novo." };
  if (!p.ativo) return { ok: false, error: `${up(p.nome)} está inativo no ERP. Peça para reativar o cadastro antes de mandar na rota.` };
  if (!String(p.endereco || "").trim()) return { ok: false, error: `${up(p.nome)} não tem endereço no cadastro do ERP. Peça para preencher em Dados › Terceirizados antes de mandar na rota.` };
  const c = b.campos && typeof b.campos === "object" ? b.campos : {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.data || ""))) return { ok: false, error: "Escolha a data da rota." };
  const objetivo = ["ENTREGA", "COLETA", "COLETA_ENTREGA"].includes(up(c.objetivo || c.tipo)) ? up(c.objetivo || c.tipo) : null;
  if (!objetivo) return { ok: false, error: "Escolha o objetivo: entrega, coleta ou coleta e entrega." };
  const itens = Array.isArray(b.itens) ? b.itens : [];
  const pc = itens.reduce((s, x) => s + (Number(x.qtd) || 0), 0);
  const vol = parseInt(c.volumes, 10) || 0;
  const verbo = objetivo === "COLETA" ? "Buscar" : objetivo === "COLETA_ENTREGA" ? "Levar e buscar" : "Levar";
  const auto = [`${verbo} OS ${os}`, b.romaneio ? `romaneio ${b.romaneio}` : null, b.servico ? String(b.servico).toLowerCase() : null,
    pc ? `${pc.toLocaleString("pt-BR")} pç` : null, vol ? `${vol} volume${vol > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ");
  let tarefa = String(c.tarefa || "").replace(/\s+/g, " ").trim() || auto;
  if (c.tarefa && vol && !/volume/i.test(tarefa)) tarefa = `${tarefa} · ${vol} volume${vol > 1 ? "s" : ""}`;
  const itensTxt = itens.length ? `Itens: ${itens.map((x) => [x.pedido ? `ped. ${x.pedido}` : null, x.produto, x.qtd ? `${x.qtd} pç` : null].filter(Boolean).join(" ")).join("; ")}` : null;
  const quem = String(b.usuario || "").trim();
  const obs = [String(c.obs || "").trim() || null, `Aberta pelo PCP (OS ${os}${b.romaneio ? `, romaneio ${b.romaneio}` : ""}${quem ? `, por ${quem}` : ""}).`, itensTxt].filter(Boolean).join("\n").slice(0, 2000);
  const horarioTipo = HORARIOS.includes(up(c.horarioTipo)) ? up(c.horarioTipo) : { manha: "MANHA", tarde: "TARDE" }[String(c.periodo || "").toLowerCase()] || "LIVRE";
  // salvarDemanda pede um usuário: o PCP entra como sistema (sem id), quem confirmou fica no nome
  const u = { id: null, nome: quem ? `PCP · ${quem}` : "PCP" };
  const r = await salvarDemanda({
    objetivo, data: c.data, destinoTipo: "TERCEIRIZADO", destinoId: p.id, destinoNome: p.nome, endereco: p.endereco, tarefa,
    contato: c.contato || null, telefone: c.telefone || p.telefone || null,
    horarioTipo, hora1: c.hora1 || null, hora2: c.hora2 || null, tempoLocal: c.tempoLocal ?? null,
    urgente: !!c.urgente, pendente: !!c.pendente, pendencia: c.pendencia || null,
    frete: !!c.frete, freteTipo: c.freteTipo || null, freteValorMax: c.freteValorMax ?? null, freteVolumes: c.freteVolumes ?? (c.frete ? vol || null : null),
    motoristaId: c.frete ? null : c.motoristaId || null, motoristaNome: c.motoristaNome || null, veiculo: c.veiculo || null, obs,
  }, u).catch((e) => ({ error: e.message }));
  if (r.error) return { ok: false, error: r.error };
  const d = await prisma.rotaDemanda.update({ where: { id: r.demanda.id }, data: { ...doPcp(os), origemDados: { osPcp: os, romaneio: b.romaneio ?? null, servico: b.servico || null, itens, usuario: quem || null } } });
  return saida(d, { jaExistia: false, semMapa: !!r.semMapa });
}

export async function cancelarRotaPcp(b) {
  const id = parseInt(b?.rotaId, 10);
  const d = id ? await prisma.rotaDemanda.findUnique({ where: { id } }) : b?.osPcp ? await prisma.rotaDemanda.findFirst({ where: { ...doPcp(b.osPcp), status: { not: "CANCELADA" } }, orderBy: { id: "desc" } }) : null;
  if (!d) return { ok: false, error: "Demanda de rota não encontrada no ERP." };
  if (d.origem !== "PCP") return { ok: false, error: `A demanda #${d.id} não foi aberta pelo PCP; cancele direto no ERP.` };
  if (d.status === "CANCELADA") return { ok: true, rotaId: d.id, jaCancelada: true };
  if (d.status === "EM_EXECUCAO") return { ok: false, error: `A rota já saiu: a demanda #${d.id} está com o motorista. Fale com a logística para tirar a parada.` };
  if (d.status === "CONCLUIDA") return { ok: false, error: `A demanda #${d.id} já foi feita pelo motorista.` };
  const r = await cancelarDemanda(d.id, { id: null, nome: "PCP" });
  if (r.error) return { ok: false, error: r.error };
  const motivo = String(b.motivo || "").trim();
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { obs: [d.obs, `Cancelada pelo PCP${motivo ? `: ${motivo}` : ""}.`].filter(Boolean).join("\n").slice(0, 2000) } }).catch(() => null);
  return { ok: true, rotaId: d.id };
}
