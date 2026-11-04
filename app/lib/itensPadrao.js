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
    select: { id: true, nomeInterno: true, nomeNf: true, clienteIds: true, fppId: true, fppNumero: true, tipoPecaNome: true, codigo: true, precoAtual: true, ncm: true, gtin: true,
      parametros: true, updatedAt: true, atualizadoPorNome: true, fotoBase64: !!q, anexos: { select: { id: true, tipo: true, nome: true } } } });
  const ctx = await contexto(itens);
  let l = itens.map((i) => montar(i, ctx));
  if (cliente) l = l.filter((i) => (i.clienteIds || []).map(Number).includes(Number(cliente)));
  if (q) {
    const n = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    const pal = n(q).split(/\s+/).filter(Boolean);
    l = l.filter((i) => pal.every((w) => n([i.nomeInterno, i.nomeNf, i.codigo, i.tipoPecaNome, ...i.clientes.map((c) => c.nome)].join(" ")).includes(w))).slice(0, 15);
  }
  return l;
}

export async function detalheItemPadrao(id) {
  const i = await prisma.itemPadrao.findUnique({ where: { id: Number(id) }, include: { anexos: { select: { id: true, tipo: true, nome: true, mime: true, tamanho: true, criadoPorNome: true, createdAt: true }, orderBy: { id: "asc" } } } });
  if (!i) return null;
  return montar(i, await contexto([i]));
}
