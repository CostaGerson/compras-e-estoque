// v231 — Remessa de cobrança CNAB 400 do Bradesco (.REM), cadastrada na Transmissão.
// 1) lerRemessa: texto → cabeçalho (nº da remessa) + boletos
// 2) analisarRemessas: cada boleto casa com a conta a receber (mesmo casador do retorno);
//    boleto sem conta no sistema = CRÍTICA
// 3) aplicarRemessas: grava o nº da remessa nas contas casadas, anexa o .REM e guarda a remessa com as críticas.
//    O registro (título registrado · nº do retorno · data) vem depois, pelo retorno (ocorrência 02).
import { prisma } from "@/lib/prisma";
import { dataUTC, r2 } from "@/lib/finTitulos";
import { hashTexto, montarCasador, nfsDeSaida, nfDoSeuNumero } from "@/lib/finRetorno";

const sub = (l, a, b) => l.slice(a - 1, b);
const num = (l, a, b) => r2(Number(sub(l, a, b).replace(/\D/g, "") || 0) / 100);
const data6 = (l, a, b) => {
  const t = sub(l, a, b);
  if (!/^\d{6}$/.test(t) || t === "000000") return null;
  return `20${t.slice(4, 6)}-${t.slice(2, 4)}-${t.slice(0, 2)}`;
};
const dBR = (s) => (s ? s.split("-").reverse().join("/") : "");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const OCORRENCIAS_REM = {
  "01": "REMESSA (ENTRADA)", "02": "PEDIDO DE BAIXA", "04": "CONCESSÃO DE ABATIMENTO", "05": "CANCELAMENTO DE ABATIMENTO",
  "06": "ALTERAÇÃO DE VENCIMENTO", "07": "ALTERAÇÃO DO CONTROLE DO PARTICIPANTE", "08": "ALTERAÇÃO DE SEU NÚMERO", "09": "PEDIDO DE PROTESTO",
  "18": "SUSTAR PROTESTO E BAIXAR", "19": "SUSTAR PROTESTO E MANTER", "31": "ALTERAÇÃO DE OUTROS DADOS",
};

export const ehRemessaCnab = (txt) => {
  const h = String(txt || "").split(/\r?\n/).find((l) => l.trim());
  return !!h && h[0] === "0" && /REMESSA/.test(h.slice(0, 20));
};

// ---------------- 1) ler ----------------
export function lerRemessa(nome, b64) {
  const txt = Buffer.from(String(b64 || ""), "base64").toString("latin1");
  const L = txt.split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  const h = L.find((l) => l[0] === "0");
  if (!h || !/REMESSA/.test(sub(h, 3, 9)) || sub(h, 77, 79) !== "237") throw new Error(`${nome}: não é uma remessa CNAB 400 do Bradesco.`);
  const cab = {
    arquivo: nome, banco: "237", empresa: sub(h, 47, 76).trim(), dataArquivo: data6(h, 95, 100),
    sequencia: String(Number(sub(h, 111, 117).replace(/\D/g, "") || 0)) || null,
  };
  const registros = L.filter((l) => l[0] === "1").map((l) => ({
    seq: sub(l, 395, 400).trim(),
    controle: sub(l, 38, 62).trim(),
    nosso: sub(l, 71, 82).trim(),                 // 11 dígitos + DV (0–9 ou P)
    ocorrencia: sub(l, 109, 110),
    numeroDoc: sub(l, 111, 120).trim(),
    vencimento: data6(l, 121, 126),
    valor: num(l, 127, 139),
    emissao: data6(l, 151, 156),
    documento: sub(l, 221, 234).replace(/\D/g, "").replace(/^0{3}(?=\d{11}$)/, ""),
    parceiro: sub(l, 235, 274).trim(),
  }));
  return { ...cab, registros, valor: r2(registros.reduce((s, x) => s + x.valor, 0)) };
}

// ---------------- 2) analisar ----------------
export async function analisarRemessas(arquivos) {
  const lidos = arquivos.map((a) => ({ ...lerRemessa(a.nome, a.conteudo), hash: hashTexto(a.conteudo) }));
  const ja = await prisma.finRemessa.findMany({ where: { hash: { in: lidos.map((x) => x.hash) } }, select: { hash: true, createdAt: true } });
  const jaPor = Object.fromEntries(ja.map((x) => [x.hash, x.createdAt]));
  const casar = await montarCasador();
  const nfInfo = await nfsDeSaida();
  const out = lidos.map((f) => ({
    arquivo: f.arquivo, sequencia: f.sequencia, dataArquivo: f.dataArquivo, empresa: f.empresa, valor: f.valor, hash: f.hash,
    jaProcessado: jaPor[f.hash] || null,
    itens: f.registros.map((r) => {
      const cs = casar(r);
      const t = cs.t;
      let situacao = "OK", aviso = null;
      if (!t) {
        situacao = "CRITICA";
        const sn = nfDoSeuNumero(r.numeroDoc), nf = sn && nfInfo.get(sn.nf);
        aviso = cs.recusado || (nf
          ? `Boleto não consta no sistema: a NF ${nf.numero} existe (${nf.fonte}), mas não há conta a receber ${sn.parc}/${sn.total}.`
          : "Boleto não consta no sistema: nenhuma conta a receber com esse nº de título / nosso número.");
      } else {
        const dif = [];
        if (Math.abs(Number(t.valor) - r.valor) > 0.01) dif.push(`valor da conta R$ ${brl(t.valor)} × boleto R$ ${brl(r.valor)}`);
        const vt = t.vencimento.toISOString().slice(0, 10);
        if (r.vencimento && vt !== r.vencimento) dif.push(`vencimento da conta ${dBR(vt)} × boleto ${dBR(r.vencimento)}`);
        if (dif.length) { situacao = "DIVERGE"; aviso = `Diverge: ${dif.join(" · ")}.`; }
        if (t.status === "CANCELADO") { situacao = "CRITICA"; aviso = "A conta a receber está cancelada no sistema."; }
        if (t.remessa && t.remessa !== f.sequencia) aviso = [aviso, `Já constava na remessa ${t.remessa}.`].filter(Boolean).join(" ");
      }
      return {
        k: `${f.arquivo}#${r.seq}`, arquivo: f.arquivo, ...r, nomeOcorrencia: OCORRENCIAS_REM[r.ocorrencia] || `OCORRÊNCIA ${r.ocorrencia}`,
        situacao, aviso, por: cs.por || null,
        alvo: t ? { id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: t.vencimento.toISOString().slice(0, 10), status: t.status, remessa: t.remessa || null, registrado: !!t.registradoEm } : null,
      };
    }),
  }));
  return { arquivos: out };
}

// ---------------- 3) aplicar ----------------
async function anexar(tituloId, a, hash, quem) {
  if (!a?.conteudo) return;
  const ja = await prisma.finTituloAnexo.findFirst({ where: { tituloId, hash }, select: { id: true } });
  if (ja) return;
  await prisma.finTituloAnexo.create({ data: { tituloId, nome: a.nome, mime: "text/plain", tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, hash, criadoPorNome: quem || null } });
}

// grava a remessa inteira: casados recebem o nº da remessa; sem conta ficam como crítica da remessa
export async function aplicarRemessas(arquivos, { quem } = {}) {
  const an = await analisarRemessas(arquivos);
  const r = { remessas: [], marcadas: 0, criticas: 0, divergentes: 0, erros: [] };
  for (const f of an.arquivos) {
    const a = arquivos.find((x) => x.nome === f.arquivo);
    let marcadas = 0;
    for (const it of f.itens) {
      if (it.situacao === "CRITICA" || !it.alvo) continue;
      try {
        const t = await prisma.finTitulo.findUnique({ where: { id: it.alvo.id }, select: { id: true, nossoNumero: true, formaPagamento: true } });
        if (!t) continue;
        await prisma.finTitulo.update({ where: { id: t.id }, data: {
          remessa: f.sequencia || f.arquivo, remessaEm: f.dataArquivo ? dataUTC(f.dataArquivo) : null,
          nossoNumero: t.nossoNumero || it.nosso || null, formaPagamento: t.formaPagamento || "BOLETO", atualizadoPorNome: quem || null,
        } });
        await anexar(t.id, a, f.hash, quem);
        marcadas++;
      } catch (e) { r.erros.push(`${it.numeroDoc}: ${e.message}`); }
    }
    const criticas = f.itens.filter((x) => x.situacao === "CRITICA").map((x) => ({ numeroDoc: x.numeroDoc, nosso: x.nosso, parceiro: x.parceiro, documento: x.documento, valor: x.valor, vencimento: x.vencimento, motivo: x.aviso }));
    const divergentes = f.itens.filter((x) => x.situacao === "DIVERGE").map((x) => ({ numeroDoc: x.numeroDoc, titulo: x.alvo?.titulo, motivo: x.aviso }));
    const resumo = { registros: f.itens.length, valor: f.valor, casados: marcadas, criticas, divergentes };
    await prisma.finRemessa.upsert({
      where: { hash: f.hash },
      create: { banco: "237", sequencia: f.sequencia, nome: f.arquivo, dataArquivo: f.dataArquivo ? dataUTC(f.dataArquivo) : null, hash: f.hash, conteudo: a?.conteudo || "", resumo, criadoPorNome: quem || null },
      update: { resumo },
    });
    r.marcadas += marcadas; r.criticas += criticas.length; r.divergentes += divergentes.length;
    r.remessas.push({ sequencia: f.sequencia, arquivo: f.arquivo, registros: f.itens.length, marcadas, criticas });
  }
  return r;
}

// remessas já cadastradas (com as críticas)
export async function listarRemessas(limite = 30) {
  const l = await prisma.finRemessa.findMany({ orderBy: { createdAt: "desc" }, take: limite, select: { id: true, sequencia: true, nome: true, dataArquivo: true, resumo: true, criadoPorNome: true, createdAt: true } });
  return l.map((x) => ({ ...x, dataArquivo: x.dataArquivo ? x.dataArquivo.toISOString().slice(0, 10) : null }));
}
