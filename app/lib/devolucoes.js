// v1086 — Compras › Devoluções
//   1. Devolver itens de uma OC (veio errado): a quantidade devolvida volta ao PIC (item novo, compra de novo) e entra na guia Devoluções.
//      Com NF do fornecedor já anexada à OC → demanda para o ADM emitir a NF de devolução (chave copiável, emitente, itens, NCM, CFOP, arquivos).
//   2. Ordem de devolução (OD): itens em devolução do mesmo fornecedor → crédito com ele (conta corrente FornecedorCredito).
//   3. Crédito: baixa boletos (contas a pagar em aberto) do fornecedor ou é usado numa OC nova (reserva; a OC sai abatida).
//      Quando a NF dessa OC chega: aceitar a NF com valor (o crédito volta ao saldo) ou usar o crédito para baixar as contas da NF.
import { prisma } from "@/lib/prisma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const so = (s) => String(s || "").replace(/\D/g, "");
const num = (v) => { const s = String(v ?? "").trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const brl = (n) => r2(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomeForn = (f) => (f ? f.nomeFantasia || f.nome || f.razaoSocial || `#${f.id}` : "");

// ---------- 1. devolver itens da OC ----------
// b: { ocId, itens: [{ ocItemId, quantidade }], motivo }
export async function devolverItens(b, quem) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(b.ocId) || 0 }, include: { fornecedor: true,
    itens: { include: { artigo: { select: { nome: true, cor: true, codigo: true, unidade: true } }, picItem: true } } } });
  if (!oc) return { error: "OC não encontrada." };
  if (oc.status === "CANCELADA") return { error: "OC cancelada." };
  const motivo = String(b.motivo || "").trim().toUpperCase().slice(0, 500);
  if (motivo.length < 3) return { error: "Descreva o motivo da devolução (o que veio errado)." };
  const ja = await prisma.ocDevolucao.findMany({ where: { ocId: oc.id, status: { not: "CANCELADA" } }, select: { ocItemId: true, quantidade: true } });
  const devolvido = (id) => ja.filter((d) => d.ocItemId === id).reduce((s, d) => s + Number(d.quantidade), 0);
  const pedidos = (Array.isArray(b.itens) ? b.itens : []).map((x) => ({ it: oc.itens.find((i) => i.id === Number(x.ocItemId)), q: r3(num(x.quantidade)) })).filter((x) => x.it && x.q > 0);
  if (!pedidos.length) return { error: "Informe a quantidade devolvida de ao menos um item." };
  for (const { it, q } of pedidos) {
    const livre = r3(Number(it.quantidade) - devolvido(it.id));
    if (q > livre + 1e-6) return { error: `${it.artigo.nome}: só dá para devolver até ${String(livre).replace(".", ",")} ${String(it.artigo.unidade || "").toLowerCase()}.` };
  }
  // NF do fornecedor anexada à OC (a mais recente)
  const nf = await prisma.fiscalNota.findFirst({ where: { ocId: oc.id }, orderBy: { id: "desc" } });
  const criadas = [];
  for (const { it, q } of pedidos) {
    // volta ao PIC: item novo com a quantidade devolvida (mesmo artigo, fornecedor e preço como sugestão)
    let picItemId = null;
    const picId = it.picItem?.picId || oc.picId;
    if (picId) {
      const info = { ...(it.picItem?.info || {}), nome: it.picItem?.info?.nome || it.artigo.nome, unidade: it.picItem?.info?.unidade || it.artigo.unidade,
        devolucao: { oc: oc.numero, motivo, quantidade: q, em: new Date().toISOString() } };
      const pi = await prisma.picItem.create({ data: { picId, artigoId: it.artigoId, ppItemId: it.picItem?.ppItemId || null, quantidade: q, fornecedorId: oc.fornecedorId, valorUnitario: it.valorUnitario, info } });
      picItemId = pi.id;
      await prisma.pic.updateMany({ where: { id: picId, status: "OC" }, data: { status: "ABERTO" } });
    }
    criadas.push(await prisma.ocDevolucao.create({ data: {
      ocId: oc.id, ocNumero: oc.numero, ocItemId: it.id, artigoId: it.artigoId, fornecedorId: oc.fornecedorId,
      nome: [it.nfNome || it.artigo.nome, it.artigo.cor].filter(Boolean).join(" · ").slice(0, 200), unidade: it.artigo.unidade || null,
      quantidade: q, valorUnitario: it.valorUnitario, total: r2(q * Number(it.valorUnitario)), motivo,
      fiscalNotaId: nf?.id || null, nfNumero: nf?.numero || null, nfChave: nf?.chave || null, picItemId, criadoPorNome: quem || null } }));
  }
  let demanda = null;
  if (nf) demanda = await demandaNfDevolucao(oc, nf, criadas, motivo, quem);
  const notaOc = `DEVOLUÇÃO ${new Date().toLocaleDateString("pt-BR")}${quem ? ` por ${quem}` : ""}: ${criadas.map((d) => `${d.nome} ${String(Number(d.quantidade)).replace(".", ",")}`).join("; ")} · ${motivo}`;
  await prisma.ordemCompra.update({ where: { id: oc.id }, data: { obs: [oc.obs, notaOc].filter(Boolean).join("\n").slice(0, 4000) } });
  return { ok: true, devolucoes: criadas.length, voltaramAoPic: criadas.filter((d) => d.picItemId).length, demandaAdm: demanda ? demanda.id : null, semNf: !nf };
}

// dados da NF do fornecedor para a NF de devolução: chave, emitente e os itens devolvidos (NCM, CFOP, unidade, valores)
async function demandaNfDevolucao(oc, nf, devs, motivo, quem) {
  let x = null;
  if (nf.xml) { try { x = (await import("@/lib/nf")).parseXmlNfe(nf.xml); } catch { x = null; } }
  let pares = [];
  try { const c = await (await import("@/lib/ocNf")).conferirOc(oc.id); pares = c.pares || []; } catch { pares = []; }
  const f = oc.fornecedor;
  const emit = x?.emit || { razaoSocial: f.razaoSocial || f.nome, cnpj: nf.documento, inscricaoEstadual: f.inscricaoEstadual, logradouro: f.logradouro, numero: f.numero, complemento: f.complemento, bairro: f.bairro, municipio: f.municipio, uf: f.uf, cep: f.cep };
  const interestadual = emit.uf && String(emit.uf).toUpperCase() !== "MG";
  const itens = devs.map((d) => {
    const p = pares.find((q) => q.ocItemId === d.ocItemId && q.nfId === nf.id);
    const ni = p && x ? x.itens[p.idx] : null;
    return { devolucaoId: d.id, nome: ni?.xProd || d.nome, codigo: ni?.cProd || null, ncm: ni?.ncm || null, cfopNf: ni?.cfop || null,
      cfopDevolucao: interestadual ? "6201" : "5201", unidade: ni?.uCom || d.unidade, quantidade: Number(d.quantidade), valorUnitario: r2(ni?.vUn ?? Number(d.valorUnitario)),
      total: r2(Number(d.quantidade) * Number(ni?.vUn ?? d.valorUnitario)), itemNf: p ? p.idx + 1 : null };
  });
  const total = r2(itens.reduce((s, i) => s + i.total, 0));
  const chave = x?.chave || nf.chave || null;
  const dados = { devolucao: true, ocId: oc.id, ocNumero: oc.numero, nfId: nf.id, nfNumero: nf.numero, nfSerie: x?.serie || nf.serie || null, nfEmissao: nf.emissao ? nf.emissao.toISOString().slice(0, 10) : null,
    nfValor: r2(nf.valor), chave, temXml: !!nf.temXml, temPdf: !!nf.temPdf, emitente: { razaoSocial: emit.razaoSocial || null, cnpj: so(emit.cnpj) || null, ie: emit.inscricaoEstadual || null,
      endereco: [emit.logradouro && `${emit.logradouro}${emit.numero ? `, ${emit.numero}` : ""}`, emit.complemento, emit.bairro, emit.municipio && `${emit.municipio}${emit.uf ? `/${emit.uf}` : ""}`, emit.cep && `CEP ${String(emit.cep).replace(/\D/g, "").padStart(8, "0")}`].filter(Boolean).join(" · ") },
    itens, total, motivo, devolucaoIds: devs.map((d) => d.id), natureza: "DEVOLUÇÃO DE COMPRA PARA INDUSTRIALIZAÇÃO", cfopSugerido: interestadual ? "6201" : "5201" };
  const resp = await prisma.usuario.findFirst({ where: { ativo: true, setor: "ADMINISTRATIVO", nome: { contains: "BRENDA", mode: "insensitive" } }, select: { id: true, nome: true, sobrenome: true } })
    || await prisma.usuario.findFirst({ where: { ativo: true, setor: "ADMINISTRATIVO" }, orderBy: { id: "asc" }, select: { id: true, nome: true, sobrenome: true } });
  const desc = [`Emitir NF de devolução ao fornecedor ${emit.razaoSocial || nomeForn(f)} (CNPJ ${so(emit.cnpj) || "—"}).`,
    `NF de origem: ${nf.numero}${dados.nfSerie ? ` série ${dados.nfSerie}` : ""} de ${dados.nfEmissao ? dados.nfEmissao.split("-").reverse().join("/") : "—"} · ${oc.numero}.`, chave ? `Chave da NF de origem: ${chave}` : "NF de origem sem chave (sem XML).",
    `CFOP sugerido: ${dados.cfopSugerido} (${dados.natureza}).`, "Itens:", ...itens.map((i) => `• ${i.nome}${i.ncm ? ` · NCM ${i.ncm}` : ""} · ${String(i.quantidade).replace(".", ",")} ${String(i.unidade || "").toLowerCase()} × ${brl(i.valorUnitario)} = ${brl(i.total)}`),
    `Total da devolução: ${brl(total)}.`, `Motivo: ${motivo}`, "Ao concluir, informe no retorno o número da NF de devolução emitida."].join("\n");
  const d = await prisma.admDemanda.create({ data: {
    titulo: `EMITIR NF DE DEVOLUÇÃO — ${(emit.razaoSocial || nomeForn(f)).toUpperCase()} · NF ${nf.numero} · ${oc.numero}`.slice(0, 200), descricao: desc.slice(0, 4000),
    responsavelId: resp?.id || null, responsavelNome: resp ? [resp.nome, resp.sobrenome].filter(Boolean).join(" ").toUpperCase() : null,
    prazo: dUTC(hojeSP()), prioridade: "URGENTE", tipo: "NF_DEVOLUCAO", ref: `DEV:${devs.map((x) => x.id).join(",")}`, dados, criadoPorNome: quem || "COMPRAS" } });
  await prisma.ocDevolucao.updateMany({ where: { id: { in: devs.map((x) => x.id) } }, data: { admDemandaId: d.id } });
  const para = resp ? [resp.id] : (await prisma.usuario.findMany({ where: { ativo: true, setor: "ADMINISTRATIVO" }, select: { id: true } })).map((u) => u.id);
  if (para.length) await prisma.mensagem.createMany({ data: para.map((id) => ({ deId: id, paraId: id, texto: `📦 NF DE DEVOLUÇÃO A EMITIR — ${(emit.razaoSocial || nomeForn(f)).toUpperCase()} · NF ${nf.numero} · ${brl(total)}. Chave, itens e arquivos em ADM › Demandas ADM.`.slice(0, 2000) })) }).catch(() => null);
  return d;
}
// ADM concluiu a demanda: guarda o nº da NF de devolução nos itens
export async function concluidaNfDevolucao(dm, retorno) {
  const ids = Array.isArray(dm?.dados?.devolucaoIds) ? dm.dados.devolucaoIds : [];
  if (ids.length) await prisma.ocDevolucao.updateMany({ where: { id: { in: ids.map(Number) } }, data: { nfDevolucao: String(retorno || "").slice(0, 300) || null } });
}

// ---------- 2. guia Devoluções e OD ----------
export async function saldoCredito(fornecedorId) {
  const l = await prisma.fornecedorCredito.findMany({ where: { fornecedorId: Number(fornecedorId) } });
  return r2(l.reduce((s, x) => s + (x.tipo === "CREDITO" ? 1 : -1) * Number(x.valor), 0));
}
export async function painel() {
  const devs = await prisma.ocDevolucao.findMany({ where: { status: { not: "CANCELADA" } }, orderBy: { id: "desc" }, take: 500 });
  const ods = await prisma.ordemDevolucao.findMany({ orderBy: { id: "desc" }, take: 200 });
  const movs = await prisma.fornecedorCredito.findMany({ orderBy: { id: "desc" } });
  const fIds = [...new Set([...devs.map((d) => d.fornecedorId), ...ods.map((o) => o.fornecedorId), ...movs.map((m) => m.fornecedorId)])];
  const fs = fIds.length ? await prisma.fornecedor.findMany({ where: { id: { in: fIds } } }) : [];
  const F = Object.fromEntries(fs.map((f) => [f.id, nomeForn(f)]));
  const saldos = {};
  for (const m of movs) saldos[m.fornecedorId] = r2((saldos[m.fornecedorId] || 0) + (m.tipo === "CREDITO" ? 1 : -1) * Number(m.valor));
  const dmIds = [...new Set(devs.map((d) => d.admDemandaId).filter(Boolean))];
  const dms = dmIds.length ? Object.fromEntries((await prisma.admDemanda.findMany({ where: { id: { in: dmIds } }, select: { id: true, status: true } })).map((x) => [x.id, x.status])) : {};
  const out = (d) => ({ ...d, quantidade: Number(d.quantidade), valorUnitario: Number(d.valorUnitario), total: Number(d.total), fornecedor: F[d.fornecedorId] || "—", demandaStatus: d.admDemandaId ? dms[d.admDemandaId] || null : null });
  return {
    pendentes: devs.filter((d) => d.status === "PENDENTE").map(out),
    emOd: devs.filter((d) => d.status === "EM_OD").map(out),
    ods: ods.map((o) => ({ ...o, total: Number(o.total), fornecedor: F[o.fornecedorId] || "—", itens: devs.filter((d) => d.odId === o.id).map(out) })),
    creditos: Object.entries(saldos).filter(([, v]) => v > 0.004).map(([id, saldo]) => ({ fornecedorId: Number(id), fornecedor: F[id] || "—", saldo,
      movimentos: movs.filter((m) => m.fornecedorId === Number(id)).slice(0, 30).map((m) => ({ ...m, valor: Number(m.valor) })) })).sort((a, b) => b.saldo - a.saldo),
  };
}
export async function gerarOd(ids, quem, obs) {
  const devs = await prisma.ocDevolucao.findMany({ where: { id: { in: (ids || []).map(Number).filter(Boolean) }, status: "PENDENTE" } });
  if (!devs.length) return { error: "Escolha itens em devolução (sem OD)." };
  if (new Set(devs.map((d) => d.fornecedorId)).size > 1) return { error: "A OD é de um fornecedor só: escolha itens do mesmo fornecedor." };
  const total = r2(devs.reduce((s, d) => s + Number(d.total), 0));
  const fid = devs[0].fornecedorId;
  const od = await prisma.ordemDevolucao.create({ data: { numero: `TMP-${Date.now()}`, fornecedorId: fid, total, obs: obs ? String(obs).slice(0, 500) : null, criadoPorNome: quem || null } });
  const numero = `OD ${String(od.id).padStart(4, "0")}`;
  await prisma.ordemDevolucao.update({ where: { id: od.id }, data: { numero } });
  await prisma.ocDevolucao.updateMany({ where: { id: { in: devs.map((d) => d.id) } }, data: { status: "EM_OD", odId: od.id } });
  await prisma.fornecedorCredito.create({ data: { fornecedorId: fid, tipo: "CREDITO", valor: total, odId: od.id, descricao: `${numero}: ${devs.length} item(ns) devolvido(s)`, criadoPorNome: quem || null } });
  return { ok: true, numero, total, saldo: await saldoCredito(fid) };
}
export async function cancelarDevolucao(id, quem) {
  const d = await prisma.ocDevolucao.findUnique({ where: { id: Number(id) || 0 } });
  if (!d || d.status !== "PENDENTE") return { error: "Só a devolução ainda sem OD pode ser cancelada." };
  await prisma.ocDevolucao.update({ where: { id: d.id }, data: { status: "CANCELADA" } });
  if (d.picItemId) await prisma.picItem.deleteMany({ where: { id: d.picItemId, ocItens: { none: {} } } }).catch(() => null);   // o item que voltou ao PIC sai, se ainda não virou OC
  return { ok: true };
}

// ---------- 3. uso do crédito ----------
// contas a pagar em aberto do fornecedor (CNPJ do cadastro ou nome), com a sugestão de quanto do crédito vai em cada uma
export async function boletosDoFornecedor(fornecedorId) {
  const f = await prisma.fornecedor.findUnique({ where: { id: Number(fornecedorId) || 0 }, include: { cnpjs: true } });
  if (!f) return { error: "Fornecedor não encontrado." };
  const docs = [...new Set((f.cnpjs || []).map((c) => so(c.cnpj)).filter(Boolean))];
  const nomes = [...new Set([f.nome, f.razaoSocial, f.nomeFantasia].filter(Boolean).map((s) => String(s).trim()))];
  const ts = await prisma.finTitulo.findMany({ where: { tipo: "PAGAR", status: "ABERTO", OR: [...(docs.length ? [{ documento: { in: docs } }] : []), ...nomes.map((n) => ({ parceiro: { equals: n, mode: "insensitive" } }))] },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }], take: 100 });
  let resto = await saldoCredito(f.id);
  const saldo = resto;
  return { fornecedor: nomeForn(f), saldo, titulos: ts.map((t) => { const v = r2(t.valor), sug = r2(Math.min(v, Math.max(0, resto))); resto = r2(resto - sug);
    return { id: t.id, titulo: t.titulo, numeroDoc: t.numeroDoc, vencimento: t.vencimento.toISOString().slice(0, 10), valor: v, sugestao: sug }; }) };
}
async function abaterTitulo(t, valor, quem, origem) {
  const v = r2(Math.min(valor, Number(t.valor)));
  const hoje = hojeSP();
  const nota = { texto: `${brl(v)} ABATIDO COM CRÉDITO DE DEVOLUÇÃO (${origem})${quem ? ` POR ${quem}` : ""}`, por: quem || null, em: new Date().toISOString() };
  const notas = [...(Array.isArray(t.notas) ? t.notas : []), nota];
  if (v >= Number(t.valor) - 0.004) await prisma.finTitulo.update({ where: { id: t.id }, data: { status: "PAGO", dataPagamento: dUTC(hoje), valorPago: v, notas, atualizadoPorNome: quem || null,
    observacao: [t.observacao, `Baixado com crédito de devolução (${origem}), sem movimento no banco.`].filter(Boolean).join("\n").slice(0, 4000) } });
  else await prisma.finTitulo.update({ where: { id: t.id }, data: { valor: r2(Number(t.valor) - v), notas, atualizadoPorNome: quem || null,
    alteracoes: [...(Array.isArray(t.alteracoes) ? t.alteracoes : []), { campo: "valor", texto: `Valor reduzido em ${brl(v)} pelo crédito de devolução (${origem})`, em: new Date().toISOString(), por: quem || null }] } });
  return v;
}
// usar o crédito em boletos: [{ id, valor }]
export async function usarEmBoletos(fornecedorId, itens, quem) {
  let saldo = await saldoCredito(fornecedorId);
  const usados = [];
  for (const x of Array.isArray(itens) ? itens : []) {
    const v = r2(num(x.valor));
    if (!(v > 0)) continue;
    if (v > saldo + 0.004) return { error: `Crédito insuficiente: saldo ${brl(saldo)}.`, usados };
    const t = await prisma.finTitulo.findUnique({ where: { id: Number(x.id) || 0 } });
    if (!t || t.tipo !== "PAGAR" || t.status !== "ABERTO") continue;
    const ab = await abaterTitulo(t, v, quem, "boleto");
    await prisma.fornecedorCredito.create({ data: { fornecedorId: Number(fornecedorId), tipo: "USO", valor: ab, tituloId: t.id, descricao: `Abatido em ${t.titulo}${t.numeroDoc ? ` (${t.numeroDoc})` : ""}`, criadoPorNome: quem || null } });
    saldo = r2(saldo - ab); usados.push({ id: t.id, valor: ab });
  }
  return { ok: true, usados, saldo };
}
// OC nova: reserva o crédito (até o total da OC)
export async function reservarNaOc(ocId, quem) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(ocId) || 0 }, include: { itens: true } });
  if (!oc) return { error: "OC não encontrada." };
  if (oc.creditoStatus === "RESERVADO") return { ok: true, valor: Number(oc.creditoUsado) };
  const total = r2(oc.itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valorUnitario), 0));
  const saldo = await saldoCredito(oc.fornecedorId);
  const v = r2(Math.min(saldo, total));
  if (!(v > 0)) return { error: "Sem crédito com este fornecedor." };
  await prisma.fornecedorCredito.create({ data: { fornecedorId: oc.fornecedorId, tipo: "USO", valor: v, ocId: oc.id, reserva: true, descricao: `Reservado na ${oc.numero}`, criadoPorNome: quem || null } });
  await prisma.ordemCompra.update({ where: { id: oc.id }, data: { creditoUsado: v, creditoStatus: "RESERVADO" } });
  return { ok: true, valor: v, aPagar: r2(total - v) };
}
// NF da OC com crédito chegou: ACEITAR_NF (crédito volta ao saldo) | BAIXAR_CONTAS (crédito abate as contas a pagar da NF)
export async function decidirNf(ocId, decisao, quem) {
  const oc = await prisma.ordemCompra.findUnique({ where: { id: Number(ocId) || 0 } });
  if (!oc || oc.creditoStatus !== "RESERVADO") return { error: "Esta OC não tem crédito reservado." };
  const reservas = await prisma.fornecedorCredito.findMany({ where: { ocId: oc.id, reserva: true } });
  const valor = r2(reservas.reduce((s, x) => s + Number(x.valor), 0));
  if (decisao === "ACEITAR_NF") {
    await prisma.fornecedorCredito.deleteMany({ where: { id: { in: reservas.map((x) => x.id) } } });
    await prisma.ordemCompra.update({ where: { id: oc.id }, data: { creditoStatus: "DEVOLVIDO" } });
    return { ok: true, devolvido: valor };
  }
  if (decisao !== "BAIXAR_CONTAS") return { error: "Decisão inválida." };
  const nfs = await prisma.fiscalNota.findMany({ where: { ocId: oc.id }, select: { parcelas: true, numero: true } });
  const ids = [...new Set(nfs.flatMap((n) => (Array.isArray(n.parcelas) ? n.parcelas : []).map((p) => p.tituloId)).filter(Boolean))];
  const ts = ids.length ? await prisma.finTitulo.findMany({ where: { id: { in: ids }, tipo: "PAGAR", status: "ABERTO" }, orderBy: [{ vencimento: "asc" }] }) : [];
  if (!ts.length) return { error: "A NF desta OC ainda não gerou contas a pagar em aberto. Lance a NF no Movimento fiscal ou aceite a NF com valor." };
  let resto = valor;
  await prisma.fornecedorCredito.deleteMany({ where: { id: { in: reservas.map((x) => x.id) } } });
  for (const t of ts) {
    if (resto <= 0.004) break;
    const ab = await abaterTitulo(t, resto, quem, oc.numero);
    await prisma.fornecedorCredito.create({ data: { fornecedorId: oc.fornecedorId, tipo: "USO", valor: ab, ocId: oc.id, tituloId: t.id, descricao: `${oc.numero}: abatido em ${t.titulo}`, criadoPorNome: quem || null } });
    resto = r2(resto - ab);
  }
  await prisma.ordemCompra.update({ where: { id: oc.id }, data: { creditoStatus: "APLICADO", creditoUsado: r2(valor - resto) } });
  return { ok: true, aplicado: r2(valor - resto), sobra: resto };
}
// OC cancelada com crédito reservado: o crédito volta
export async function liberarReservaOc(ocId) {
  const n = await prisma.fornecedorCredito.deleteMany({ where: { ocId: Number(ocId), reserva: true } });
  if (n.count) await prisma.ordemCompra.update({ where: { id: Number(ocId) }, data: { creditoStatus: "DEVOLVIDO" } }).catch(() => null);
}
// créditos de vários fornecedores (para perguntar ao gerar OC)
export async function saldos(fornecedorIds) {
  const ids = [...new Set((fornecedorIds || []).map(Number).filter(Boolean))];
  const out = {};
  for (const id of ids) { const s = await saldoCredito(id); if (s > 0.004) out[id] = s; }
  return out;
}
