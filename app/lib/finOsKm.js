// v209 — Ordem de Serviço do KM (fechamento de facção) → lançamento no fechamento de terceirizados da semana
// · uma OS por PDF; o PDF traz duas vias iguais (lê a primeira)
// · FORNECEDOR "FACÇÃO - ELIAS" → terceirizado do cadastro (nome, ou "nome no KM")
// · FICHA "26080036/4 = 35613-ARTEBRILHO - CALÇA JEANS" → pedido 26080036 · item 4 · cliente ARTEBRILHO · peça CALÇA JEANS
// · tipo de peça = o que está escrito na ficha; prazo = do cadastro do terceirizado (vazio = 0)
// · data de recebimento: pedida na hora de subir
// · OS parcial: lança o que retornou; reenviar a mesma OS depois lança só a diferença
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { salvarItem, programacao } from "@/lib/finSemana";
import { TIPOS_FACCAO } from "@/lib/prestadores";

const num = (s) => { const v = Number(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const isoBR = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
export const semAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const hashB64 = (b64) => createHash("sha256").update(Buffer.from(String(b64 || ""), "base64")).digest("hex");

export const ehOsKm = (t) => /ORDEM DE SERVI[ÇC]O/i.test(t) && /FICHA:/i.test(t) && /FORNECEDOR:/i.test(t) && /Qtde Retorno/i.test(t);

// tipo de peça pelo texto da ficha
export function tipoDaPeca(desc) {
  const d = semAc(desc);
  if (/CALCA/.test(d)) return /JEANS/.test(d) ? "CALCA_JEANS" : /SOCIAL/.test(d) ? "CALCA_SOCIAL" : "CALCA_OPERACIONAL";
  if (/JAQUETA|PARKA|CORTA.?VENTO/.test(d)) return "JAQUETA";
  if (/JALECO|GUARDA.?PO/.test(d)) return "JALECO_OPERACIONAL";
  if (/POLO/.test(d)) return "POLO";
  if (/MOLETOM|AGASALHO|BLUSAO|CASACO/.test(d)) return "MOLETOM";
  if (/CAMISA/.test(d)) return "CAMISA_SOCIAL";
  if (/CAMISETA|BABY ?LOOK|REGATA|T-?SHIRT/.test(d)) return "CAMISETA";
  return null;
}

export function lerOsKm(texto) {
  const t0 = String(texto || "").replace(/\s+/g, " ");
  const k = t0.indexOf("DATA OS", 10);
  const t = k > 0 ? t0.slice(0, k) : t0;   // só a primeira via
  const pega = (re) => (t.match(re) || [])[1] || null;
  const nr = pega(/NR:\s*(\d+)/);
  if (!nr) throw new Error("Não achei o número da OS.");
  const fornecedor = String(pega(/FORNECEDOR:\s*(.+?)\s+FICHA:/) || "").trim();
  const prestador = fornecedor.replace(/^FAC[ÇC][ÃA]O\s*-\s*/i, "").trim().toUpperCase();
  const servico = semAc(pega(/Notas de Envio:\s*(.+?)\s+Inf\.\s*Envio/i) || pega(/SERVI[ÇC]O:\s*([A-ZÇÃÕÉ ]+?)\s+(?:Notas|Inf)/i) || "");
  const ficha = t.match(/(\d{6,})\s*\/\s*(\d+)\s*=\s*(\d+)\s*-\s*(.+?)\s+REFER[ÊE]NCIA:/i);
  const resto = ficha ? ficha[4].trim() : "";
  const sep = resto.indexOf(" - ");
  const cliente = sep > 0 ? resto.slice(0, sep).trim() : resto;
  const peca = (sep > 0 ? resto.slice(sep + 3) : "").replace(/\s*-\s*$/, "").trim().toUpperCase();
  const r = {
    nr, dataOs: isoBR(pega(/DATA OS:\s*(\d{2}\/\d{2}\/\d{4})/)), fornecedor, prestador, servico,
    pedido: ficha ? ficha[1] : null, itemPedido: ficha ? ficha[2] : null, codCliente: ficha ? ficha[3] : null, cliente: cliente.toUpperCase(), peca,
    referencia: pega(/REFER[ÊE]NCIA:\s*(\S+)/i),
    qtdEnvio: num(pega(/Qtde Envio:\s*(?:Ocorr[êe]ncia \(\+\)\s*)?([\d.,]+)/i)),
    qtdRetorno: num(pega(/Qtde Retorno:\s*([\d.,]+)/i)),
    unitario: num(pega(/Vlr\.\s*Unit[áa]rio:\s*([\d.,]+)/i)),
    valorRetornado: num(pega(/Vlr\.\s*Retornado:\s*([\d.,]+)/i)),
    desconto: num(pega(/Vlr\.\s*Desconto:\s*([\d.,]+)/i)),
    total: num(pega(/Tot\.\s*([\d.,]+)/i)),
    saldo: num(pega(/Saldo a Retornar:\s*([\d.,]+)/i)),
  };
  if (!r.pedido) throw new Error(`OS ${nr}: não achei o pedido na FICHA.`);
  r.tipo = tipoDaPeca(r.peca);
  return r;
}

// já lançado desta OS (soma das linhas com os = nr em itens de facção)
async function jaLancadoPorOs() {
  const itens = await prisma.finSemanaItem.findMany({ where: { grupo: "FACCAO" }, select: { id: true, tituloId: true, linhas: true, nome: true } });
  const m = {};
  for (const i of itens) for (const l of Array.isArray(i.linhas) ? i.linhas : []) {
    if (!l.os) continue;
    const k = String(l.os);
    (m[k] ||= { qtd: 0, valor: 0, onde: [] });
    m[k].qtd += Number(l.qtd) || 0; m[k].valor = r2(m[k].valor + (Number(l.total) || 0)); m[k].onde.push(i.tituloId);
  }
  return m;
}

function casarPrestador(nome, ps) {
  const n = semAc(nome);
  return ps.find((p) => semAc(p.nomeKm) === n) || ps.find((p) => semAc(p.nome) === n)
    || (() => { const l = ps.filter((p) => semAc(p.nome).split(" ")[0] === n.split(" ")[0] && n.length >= 3); return l.length === 1 ? l[0] : null; })()
    || (() => { const l = ps.filter((p) => semAc(p.nome).includes(n) && n.length >= 4); return l.length === 1 ? l[0] : null; })();
}

// arquivos: [{ nome, conteudo(b64), texto? }]
export async function analisarOs(arquivos, abrirPdf) {
  const ps = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO", ativo: true }, orderBy: { nome: "asc" } });
  const ja = await jaLancadoPorOs();
  const itens = [];
  for (const a of arquivos || []) {
    try {
      let texto = a.texto;
      if (!texto) { const pdf = await abrirPdf(Buffer.from(String(a.conteudo || ""), "base64")); if (!pdf.ok) throw new Error("PDF não lido"); texto = pdf.texto; }
      if (!ehOsKm(texto)) throw new Error("Não é uma Ordem de Serviço do KM.");
      const os = lerOsKm(texto);
      const p = casarPrestador(os.prestador, ps);
      const lanc = ja[os.nr] || { qtd: 0, valor: 0 };
      const qtd = Math.max(0, r2(os.qtdRetorno - lanc.qtd));
      const unit = os.qtdRetorno ? r2(os.total / os.qtdRetorno) : os.unitario;   // com desconto, o unitário efetivo
      const avisos = [];
      if (os.servico && os.servico !== "COSTURA") avisos.push(`Serviço ${os.servico}: hoje a OS é só de costura — confira.`);
      if (!os.tipo) avisos.push(`Não reconheci o tipo de peça em "${os.peca || "—"}": escolha.`);
      if (!p) avisos.push(`Terceirizado "${os.prestador}" não encontrado no cadastro: escolha (o sistema lembra para as próximas).`);
      if (p && !String(p.chavePix || "").trim()) avisos.push("Terceirizado sem chave PIX no cadastro: informe.");
      if (os.saldo > 0) avisos.push(`OS parcial: ${os.saldo} peça(s) ainda a retornar — lança só o que voltou.`);
      if (os.desconto > 0) avisos.push(`Desconto de R$ ${os.desconto.toFixed(2).replace(".", ",")} aplicado.`);
      if (lanc.qtd > 0) avisos.push(qtd > 0 ? `Já lançadas ${lanc.qtd} peça(s) desta OS — lança só a diferença (${qtd}).` : "OS já lançada por completo.");
      itens.push({ arquivo: a.nome, hash: hashB64(a.conteudo), os, prestadorId: p?.id || null, prazoDias: p?.prazoDias ?? 0, chavePix: p?.chavePix || "",
        qtd, unitario: unit, total: r2(qtd * unit), jaLancado: lanc.qtd, avisos, ok: qtd > 0 });
    } catch (e) { itens.push({ arquivo: a.nome, erro: e.message }); }
  }
  return { itens, prestadores: ps.map((p) => ({ id: p.id, nome: p.nome, nomeKm: p.nomeKm, chavePix: p.chavePix, prazoDias: p.prazoDias ?? 0 })), tipos: TIPOS_FACCAO.map((t) => ({ k: t.k, n: t.n })) };
}

// itens: [{ arquivo, os, prestadorId, tipo, qtd, unitario, chavePix }] · arquivos: [{ nome, conteudo }] · dataRecebimento
export async function aplicarOs({ itens, arquivos, dataRecebimento }, { quem, usuarioId } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRecebimento || "")) return { ok: false, erro: "Informe a data de recebimento." };
  const ps = await prisma.prestador.findMany({ where: { tipo: "TERCEIRIZADO" } });
  const ja = await jaLancadoPorOs();
  const porNome = Object.fromEntries((arquivos || []).map((a) => [a.nome, a]));
  const grupos = {};
  const res = { lancadas: 0, valor: 0, linhas: [], erros: [] };
  for (const it of itens || []) {
    const p = ps.find((x) => x.id === Number(it.prestadorId));
    if (!p) { res.erros.push(`OS ${it.os?.nr}: escolha o terceirizado.`); continue; }
    if (!TIPOS_FACCAO.some((t) => t.k === it.tipo)) { res.erros.push(`OS ${it.os?.nr}: escolha o tipo de peça.`); continue; }
    const lanc = ja[String(it.os.nr)]?.qtd || 0;
    const qtd = Math.min(Number(it.qtd) || 0, Math.max(0, r2(it.os.qtdRetorno - lanc)));
    if (!(qtd > 0)) { res.erros.push(`OS ${it.os.nr}: já lançada.`); continue; }
    // lembra o nome do KM quando o terceirizado foi escolhido à mão
    if (semAc(p.nome) !== semAc(it.os.prestador) && semAc(p.nomeKm) !== semAc(it.os.prestador)) {
      await prisma.prestador.update({ where: { id: p.id }, data: { nomeKm: String(it.os.prestador).toUpperCase() } }).catch(() => null);
    }
    (grupos[p.id] ||= { p, pix: String(it.chavePix || p.chavePix || "").trim(), linhas: [], arqs: [], nrs: [] });
    grupos[p.id].linhas.push({ pedido: it.os.pedido, item: `${it.os.itemPedido ? `ITEM ${it.os.itemPedido} · ` : ""}${it.os.peca || ""}${it.os.cliente ? ` · ${it.os.cliente}` : ""}`.slice(0, 120),
      tipo: it.tipo, qtd, unitario: r2(it.unitario), os: String(it.os.nr), osParcial: it.os.saldo > 0 || undefined });
    grupos[p.id].nrs.push(it.os.nr);
    if (porNome[it.arquivo]) grupos[p.id].arqs.push(porNome[it.arquivo]);
  }
  for (const g of Object.values(grupos)) {
    const prazo = g.p.prazoDias ?? 0;
    const r = await salvarItem(null, {
      grupo: "FACCAO", prestadorId: g.p.id, nome: g.p.nome, chavePix: g.pix, dataRecebimento, prazoDias: prazo, linhas: g.linhas,
      observacao: `OS KM ${g.nrs.join(", ")}`,
    }, { quem, usuarioId });
    if (!r.ok) { res.erros.push(`${g.p.nome}: ${r.erro}`); continue; }
    // os PDFs das OS ficam anexados na conta da semana
    for (const a of g.arqs) {
      const hash = hashB64(a.conteudo);
      if (await prisma.finTituloAnexo.findFirst({ where: { tituloId: r.tituloId, hash }, select: { id: true } })) continue;
      await prisma.finTituloAnexo.create({ data: { tituloId: r.tituloId, nome: String(a.nome).slice(0, 200), mime: "application/pdf", tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, hash, criadoPorNome: quem || null } }).catch(() => null);
    }
    const prog = programacao(dataRecebimento, prazo);
    res.lancadas += g.linhas.length; res.valor = r2(res.valor + Number(r.item.valor));
    res.linhas.push(`${g.p.nome}: OS ${g.nrs.join(", ")} · R$ ${Number(r.item.valor).toFixed(2).replace(".", ",")} · paga na sexta ${prog ? prog.sexta.split("-").reverse().join("/") : "—"}`);
  }
  return { ok: true, ...res };
}
