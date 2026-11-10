// v647 — cadastro de itens padrão (alto giro / padronizados)
//   nome interno (como chamamos) · nome NF (sai na NF ao faturar) · clientes · FPP de origem · dados do item do pedido
//   (tipo de peça, código, parâmetros, foto) · preço praticado · NCM · GTIN/EAN · anexos de layout e tabela de medidas
import { prisma } from "@/lib/prisma";

const up = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim().toUpperCase());
const so = (v) => String(v || "").replace(/\D/g, "");
const num = (v) => { if (v == null || v === "") return null; const s = String(v).trim(); const n = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s); return Number.isFinite(n) ? n : null; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function quemDe(req) {
  const id = Number(req.headers.get("x-usuario-id")) || null;
  if (!id) return null;
  const u = await prisma.usuario.findUnique({ where: { id }, select: { nome: true, sobrenome: true } }).catch(() => null);
  return u ? [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() : null;
}

// crítica: valor de venda da FPP diferente do preço praticado
export function criticaPreco(preco, fppValor) {
  if (preco == null || fppValor == null) return null;
  const p = r2(preco), f = r2(fppValor);
  if (Math.abs(p - f) < 0.005) return null;
  const pct = f ? ((p - f) / f) * 100 : null;
  return { fpp: f, preco: p, dif: r2(p - f), pct: pct == null ? null : Math.round(pct * 10) / 10 };
}

export async function dadosItemPadrao(b) {
  const nomeInterno = up(b.nomeInterno), nomeNf = up(b.nomeNf);
  if (b.codigoPadrao && !/^[A-Z]{2,4}\.\d{3}\.\d{4}$/.test(String(b.codigoPadrao).trim().toUpperCase())) return { error: "Código padrão no formato SIGLA.000.0000 (ex.: CL.001.0001)." };
  if (b.codigoPadrao) { const dono = await prisma.itemPadrao.findUnique({ where: { codigoPadrao: String(b.codigoPadrao).trim().toUpperCase() }, select: { id: true, nomeInterno: true } }); if (dono && dono.id !== Number(b.id)) return { error: `Código ${String(b.codigoPadrao).toUpperCase()} já é do item ${dono.nomeInterno}.` }; }
  if (!nomeInterno) return { error: "Informe o nome interno." };
  if (!nomeNf) return { error: "Informe o nome que sai na NF." };
  const fppId = Number(b.fppId) || null;
  const fpp = fppId ? await prisma.fpp.findUnique({ where: { id: fppId }, select: { numero: true } }) : null;
  const params = b.parametros && typeof b.parametros === "object" ? Object.fromEntries(Object.entries(b.parametros).filter(([, v]) => v != null && v !== "")) : null;
  return {
    nomeInterno, nomeNf,
    clienteIds: [...new Set((Array.isArray(b.clienteIds) ? b.clienteIds : []).map(Number).filter(Boolean))],
    fppId: fpp ? fppId : null, fppNumero: fpp?.numero ?? null,
    tipoPecaNome: up(b.tipoPecaNome), codigo: up(b.codigo), parametros: params,
    codigoPadrao: up(b.codigoPadrao),   // v682
    fotoBase64: b.fotoBase64 || null, precoAtual: num(b.precoAtual), ncm: so(b.ncm).slice(0, 8) || null, gtin: so(b.gtin).slice(0, 14) || null,
    obs: b.obs ? String(b.obs).trim().slice(0, 2000) : null,
  };
}

async function contexto(itens) {
  const fppIds = [...new Set(itens.map((i) => i.fppId).filter(Boolean))];
  const cliIds = [...new Set(itens.flatMap((i) => (Array.isArray(i.clienteIds) ? i.clienteIds : [])))];
  const [fpps, clis] = await Promise.all([
    fppIds.length ? prisma.fpp.findMany({ where: { id: { in: fppIds } }, select: { id: true, numero: true, item: true, nomeComercial: true, clienteNome: true, valorProposto: true } }) : [],
    cliIds.length ? prisma.cliente.findMany({ where: { id: { in: cliIds } }, select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } }) : [],
  ]);
  return { F: Object.fromEntries(fpps.map((f) => [f.id, f])), Cl: Object.fromEntries(clis.map((c) => [c.id, c])) };
}
const montar = (i, { F, Cl }) => {
  const f = i.fppId ? F[i.fppId] : null;
  const preco = i.precoAtual != null ? Number(i.precoAtual) : null;
  return {
    ...i, precoAtual: preco,
    clientes: (Array.isArray(i.clienteIds) ? i.clienteIds : []).map((id) => Cl[id]).filter(Boolean).map((c) => ({ id: c.id, nome: c.nomeFantasia || c.razaoSocial, razaoSocial: c.razaoSocial, cnpj: c.cnpj })),
    fpp: f ? { id: f.id, numero: f.numero, item: f.nomeComercial || f.item, cliente: f.clienteNome, valorProposto: f.valorProposto } : null,
    critica: criticaPreco(preco, f?.valorProposto),
  };
};

export async function listarItensPadrao({ q, cliente } = {}) {
  const itens = await prisma.itemPadrao.findMany({ where: { ativo: true }, orderBy: { nomeInterno: "asc" },
    select: { id: true, codigoPadrao: true, nomeInterno: true, nomeNf: true, clienteIds: true, fppId: true, fppNumero: true, tipoPecaNome: true, codigo: true, precoAtual: true, ncm: true, gtin: true,
      parametros: true, updatedAt: true, atualizadoPorNome: true, fotoBase64: !!q, anexos: { select: { id: true, tipo: true, nome: true } } } });
  const ctx = await contexto(itens);
  let l = itens.map((i) => montar(i, ctx));
  if (cliente) {
    // v658 — cliente de um grupo vê os itens padrão de todo o grupo (cliente que entrar no grupo depois já recebe)
    const c = await prisma.cliente.findUnique({ where: { id: Number(cliente) }, select: { grupoId: true } }).catch(() => null);
    const ids = new Set([Number(cliente)]);
    if (c?.grupoId) for (const x of await prisma.cliente.findMany({ where: { grupoId: c.grupoId }, select: { id: true } })) ids.add(x.id);
    l = l.filter((i) => (i.clienteIds || []).map(Number).some((id) => ids.has(id)));
  }
  if (q) {
    const n = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    const pal = n(q).split(/\s+/).filter(Boolean);
    l = l.filter((i) => pal.every((w) => n([i.codigoPadrao, i.nomeInterno, i.nomeNf, i.codigo, i.tipoPecaNome, ...i.clientes.map((c) => c.nome)].join(" ")).includes(w))).slice(0, 15);
  }
  return l;
}

export async function detalheItemPadrao(id) {
  const i = await prisma.itemPadrao.findUnique({ where: { id: Number(id) }, include: { anexos: { select: { id: true, tipo: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } } });
  if (!i) return null;
  return montar(i, await contexto([i]));
}

// ---------- v682 — padrão de códigos dos produtos (sugestão #45) ----------
//   SIGLA (tipo do produto) . VARIAÇÃO (3 dígitos, cadastro por tipo: 001 calça de elástico, 002 calça social…) . SEQUÊNCIA (4 dígitos, automática)
//   ex.: CL.001.0001 = calça de elástico com 2 bolsos frontais e 2 traseiros · CL.001.0002 = …
const K_COD = "COD|PADRAO";
export const SIGLAS_PADRAO = { CAMISETA: "CT", POLO: "PL", CAMISA: "CM", JAQUETA: "JQ", "CALÇA": "CL", JALECO: "JL", AVENTAL: "AV", BERMUDA: "BM", AGASALHO: "AG", "BONÉ": "BN", MEIA: "MA", SERVIÇO: "SV" };
export async function padraoCodigos() {
  const c = await prisma.finConfig.findUnique({ where: { chave: K_COD } }).catch(() => null);
  let v = {}; try { v = JSON.parse(c?.valor || "{}"); } catch {}
  const tipos = { ...Object.fromEntries(Object.entries(SIGLAS_PADRAO).map(([t, s]) => [t, { sigla: s, variacoes: [] }])), ...(v.tipos || {}) };
  return { tipos };
}
export async function salvarPadraoCodigos(tipos) {
  const limpo = {};
  const siglas = new Set();
  for (const [t, x] of Object.entries(tipos || {})) {
    const tipo = up(t); const sigla = String(x?.sigla || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
    if (!tipo || !sigla) continue;
    if (siglas.has(sigla)) return { error: `Sigla ${sigla} repetida.` };
    siglas.add(sigla);
    const vs = (Array.isArray(x.variacoes) ? x.variacoes : []).map((y) => ({ n: Math.max(1, Math.min(999, Number(y.n) || 0)), nome: up(y.nome) })).filter((y) => y.nome);
    limpo[tipo] = { sigla, variacoes: [...new Map(vs.map((y) => [y.n, y])).values()].sort((a, b) => a.n - b.n) };
  }
  await prisma.finConfig.upsert({ where: { chave: K_COD }, create: { chave: K_COD, valor: JSON.stringify({ tipos: limpo }) }, update: { valor: JSON.stringify({ tipos: limpo }) } });
  return { ok: true };
}
const p3 = (n) => String(n).padStart(3, "0"), p4 = (n) => String(n).padStart(4, "0");
// próximo código livre para SIGLA.VAR
export async function proximoCodigo(sigla, variacao) {
  const pre = `${String(sigla).toUpperCase()}.${p3(Number(variacao) || 1)}.`;
  const l = await prisma.itemPadrao.findMany({ where: { codigoPadrao: { startsWith: pre } }, select: { codigoPadrao: true } });
  const max = l.reduce((m, x) => Math.max(m, Number(String(x.codigoPadrao).slice(pre.length)) || 0), 0);
  return `${pre}${p4(max + 1)}`;
}
// sugestão para um item (tipo de peça + código do KM): sigla do tipo; variação pelo KM (CT.01.001.0001 → 001) ou pelo nome; sequência livre
export async function sugerirCodigo({ tipoPeca, codigoKm, nome } = {}) {
  const { tipos } = await padraoCodigos();
  const t = tipos[up(tipoPeca)];
  if (!t) return { error: "Tipo de peça sem sigla no padrão de códigos." };
  const nz = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  let v = null;
  const mKm = String(codigoKm || "").match(/(?:^|\.)(\d{3})\.\d{3,4}$/);
  if (mKm) v = Number(mKm[1]);
  const porNome = (t.variacoes || []).filter((x) => nz(nome).includes(nz(x.nome))).sort((a, b) => b.nome.length - a.nome.length)[0];
  if (porNome) v = porNome.n;
  if (!v) v = (t.variacoes || [])[0]?.n || 1;
  return { sigla: t.sigla, variacao: v, variacaoNome: (t.variacoes || []).find((x) => x.n === v)?.nome || null, codigo: await proximoCodigo(t.sigla, v) };
}

// v754 — ao efetivar o pedido, cada produto vira (ou atualiza) um item do cadastro: pelo item de origem, pelo código
//   ou pela descrição. Novo: entra com descrição, tipo, código, parâmetros, FPP, layout (foto) e preço praticado, ligado
//   ao cliente; já existente: ganha o cliente, o preço praticado mais recente e o que faltava (foto, FPP, parâmetros).
export async function registrarItensDoPedido(ppId, quem = null) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(ppId) }, include: { itens: true } });
  if (!pp || pp.tipoPedido === "SERVIÇO") return { novos: 0, atualizados: 0 };
  const doc = so(pp.clienteCnpj);
  const cli = doc ? await prisma.cliente.findFirst({ where: { OR: [{ cnpj: doc }, { cnpj: pp.clienteCnpj }] }, select: { id: true } }).catch(() => null) : null;
  const safe = (s, d) => { try { return JSON.parse(s || ""); } catch { return d; } };
  let novos = 0, atualizados = 0;
  for (const it of pp.itens) {
    const desc = up(it.descricao);
    if (!desc || up(it.tipoPecaNome) === "SERVIÇO") continue;
    const codigo = up(it.codigo);
    const preco = it.desconto && it.desconto.base ? num(it.desconto.base) : num(it.valorUnitario);
    const params = Object.fromEntries(Object.entries(safe(it.parametrosJson, {})).filter(([, v]) => v != null && v !== ""));
    let ex = it.itemPadraoId ? await prisma.itemPadrao.findUnique({ where: { id: it.itemPadraoId } }) : null;
    if (!ex && codigo) ex = await prisma.itemPadrao.findFirst({ where: { ativo: true, OR: [{ codigo }, { codigoPadrao: codigo }] }, orderBy: { id: "asc" } });
    // sem código: só junta com item de mesma descrição do mesmo cliente (descrição genérica de outro cliente pode ser outro produto)
    if (!ex && !codigo && cli) ex = await prisma.itemPadrao.findFirst({ where: { ativo: true, OR: [{ nomeNf: desc }, { nomeInterno: desc }], clienteIds: { array_contains: [cli.id] } }, orderBy: { id: "asc" } }).catch(() => null);
    if (ex) {
      const ids = [...new Set([...(Array.isArray(ex.clienteIds) ? ex.clienteIds : []).map(Number), ...(cli ? [cli.id] : [])])];
      await prisma.itemPadrao.update({ where: { id: ex.id }, data: {
        clienteIds: ids, ...(preco != null ? { precoAtual: preco } : {}),
        ...(!ex.fotoBase64 && it.fotoBase64 ? { fotoBase64: it.fotoBase64 } : {}),
        ...(!ex.fppId && it.fppId ? { fppId: it.fppId, fppNumero: it.fppNumero } : {}),
        ...(!ex.codigo && codigo ? { codigo } : {}),
        ...((!ex.parametros || !Object.keys(ex.parametros).length) && Object.keys(params).length ? { parametros: params } : {}),
        atualizadoPorNome: quem,
      } }).catch(() => null);
      if (!it.itemPadraoId) await prisma.ppItem.update({ where: { id: it.id }, data: { itemPadraoId: ex.id } }).catch(() => null);
      atualizados++;
      continue;
    }
    let codigoPadrao = null;
    if (it.tipoPecaNome) { const sg = await sugerirCodigo({ tipoPeca: it.tipoPecaNome, codigoKm: codigo, nome: desc }).catch(() => null); if (sg?.codigo) codigoPadrao = sg.codigo; }
    const n = await prisma.itemPadrao.create({ data: {
      nomeInterno: desc, nomeNf: desc, clienteIds: cli ? [cli.id] : [], fppId: it.fppId || null, fppNumero: it.fppNumero || null,
      tipoPecaNome: up(it.tipoPecaNome), codigo, codigoPadrao, parametros: Object.keys(params).length ? params : null,
      fotoBase64: it.fotoBase64 || null, precoAtual: preco, obs: `Cadastrado pelo pedido ${pp.numero || pp.id}`, criadoPorNome: quem, atualizadoPorNome: quem,
    } }).catch(() => null);
    if (n) { novos++; await prisma.ppItem.update({ where: { id: it.id }, data: { itemPadraoId: n.id } }).catch(() => null); }
  }
  return { novos, atualizados };
}
