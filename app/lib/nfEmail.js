// v969 — Gmail → movimento fiscal. A etiqueta "NFs a lançar" manda os XML/PDF do e-mail para cá; cada nota passa pela mesma
// análise da importação manual (ADM › Movimento fiscal) e:
//   · nota já registrada → ignora (ou completa o PDF/XML que faltava);
//   · remessa, retorno, devolução… → só registra (sem conta);
//   · nota com XML, parcelas com vencimento/valor e conta contábil padrão do parceiro → registra e LANÇA as contas
//     (a pagar na entrada, a receber na saída); NF de compra fica pendente de entrada no estoque, como na importação manual;
//   · o resto (só PDF, sem conta padrão, parcela sem vencimento, PDF com senha…) → tarefa "CONFERIR NF" para a Brenda, com os arquivos.
// Um e-mail é processado uma vez só (chave gmail-nf:<id> em FinConfig).
import { prisma } from "@/lib/prisma";
import { analisar, gravar } from "@/lib/fiscal";
import { validarRateio } from "@/lib/finTitulos";
import { abrirPdf } from "@/lib/fin";
import { senhasSalvas } from "@/lib/finImportArquivo";
import { lerBase64 } from "@/lib/arquivos";
import { criar } from "@/lib/tarefas";
import { setorTarefaDe } from "@/lib/acesso";

const semAc = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const ehXml = (a) => /\.xml$/i.test(a.nome || "") || /xml/i.test(a.mime || "");
const ehPdf = (a) => /\.pdf$/i.test(a.nome || "") || /pdf/i.test(a.mime || "");

// por que esta nota não pode ser lançada sozinha (null = pode)
export function motivoConferir(n) {
  if (n.fonte === "PDF") return "só veio o PDF (sem XML) — confira os dados lidos";
  if (n.modelo === "CT-e") return "CT-e — confira o frete";
  const parc = (n.parcelas || []).filter((p) => p.marcado);
  if (!parc.length) return "sem parcelas";
  if (parc.some((p) => p.situacao === "NOVA" && (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.vencimento || "")) || !(Number(p.valor) > 0)))) return "parcela sem vencimento ou valor";
  if (parc.some((p) => p.situacao === "NOVA")) { const rt = validarRateio(n.rateio); if (rt.erro) return `sem conta contábil padrão para ${n.parceiro || "o parceiro"} (${rt.erro})`; }
  if (n.tipo === "SAIDA" && Array.isArray(n.pedidosCandidatos) && n.pedidosCandidatos.length > 1) return "NF de venda que pode atender mais de um pedido — escolha o pedido";
  return null;
}

export async function nfDoEmail(b) {
  const id = String(b.idEmail || "").trim();
  if (!id) return { error: "idEmail?" };
  const chave = `gmail-nf:${id}`.slice(0, 190);
  const ja = await prisma.finConfig.findUnique({ where: { chave } });
  if (ja) { try { return { ...JSON.parse(ja.valor), ja: true }; } catch { return { ja: true }; } }

  const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true, email: true, setor: true, isMaster: true, diretoria: true } });
  const em = String(b.solicitante || "").toLowerCase().trim();
  const quem = (em && us.find((u) => String(u.email || "").toLowerCase().trim() === em)) || us.find((u) => u.isMaster);
  if (!quem) return { error: "Nenhum usuário master para registrar as notas." };
  const brenda = us.find((u) => semAc(u.nome).startsWith("BRENDA")) || quem;

  // arquivos do e-mail (base64 direto ou já subidos em partes)
  const arqs = [], outros = [], brutos = [];
  for (const a of Array.isArray(b.arquivos) ? b.arquivos : []) {
    const nome = String(a.nome || "arquivo").slice(0, 250);
    const b64 = a.token ? await lerBase64(`arq:${a.token}`).catch(() => null) : String(a.conteudo || "");
    if (!b64) { outros.push(`${nome}: não chegou`); continue; }
    brutos.push({ nome, mime: a.mime || null, b64 });
    if (ehXml(a)) arqs.push({ nome, xml: Buffer.from(b64, "base64").toString("utf8") });
    else if (ehPdf(a)) arqs.push({ nome, b64 });
    else outros.push(`${nome}: não é XML nem PDF (ignorado)`);
  }
  if (!arqs.length) {
    const out = { resultados: [], pendentes: [], erros: outros.length ? outros : ["e-mail sem XML nem PDF"] };
    await prisma.finConfig.create({ data: { chave, valor: JSON.stringify(out) } }).catch(() => null);
    return out;
  }

  const senhas = await senhasSalvas().catch(() => []);
  const { notas, erros } = await analisar(arqs, { abrirPdf, senhas });
  const auto = [], pend = [];
  for (const n of notas) {
    if (n.decisao === "IGNORAR" || n.decisao === "COMPLETAR" || n.decisao === "REGISTRAR") { auto.push(n); continue; }
    const m = motivoConferir(n);
    if (m) pend.push({ n, motivo: m }); else auto.push(n);
  }
  const u = { ...quem, nome: `${quem.nome || ""}${quem.sobrenome ? " " + quem.sobrenome : ""} (E-MAIL)`.trim(), sobrenome: "" };
  const resultados = auto.length ? await gravar(auto, u) : [];
  for (const r of resultados) if (r.situacao === "ERRO") { const n = auto.find((x) => String(x.numero || "").replace(/^0+(?=\d)/, "") === String(r.numero)); if (n) pend.push({ n, motivo: r.motivo || "erro ao lançar" }); }

  // o que não deu para lançar sozinho vira tarefa para a Brenda, com os arquivos do e-mail
  let tarefaId = null;
  const problemas = [...pend.map(({ n, motivo }) => `NF ${n.numero || "?"} · ${n.parceiro || "—"} · ${motivo}`), ...erros, ...outros];
  if (problemas.length) {
    const assunto = String(b.assunto || "(sem assunto)").replace(/^\s*((ENC|FWD?|RES|RE)\s*:\s*)+/i, "").trim();
    const lancadas = resultados.filter((r) => r.situacao === "LANCADA").map((r) => `NF ${r.numero} lançada (${r.criadas || 0} conta(s) nova(s), ${r.ligadas || 0} ligada(s))`);
    const descricao = [`E-MAIL de ${b.de || "—"}${b.data ? ` · ${b.data}` : ""}`, `Assunto: ${b.assunto || "—"}`, "",
      "CONFERIR NO MOVIMENTO FISCAL (ADM › Movimento fiscal → importar os arquivos anexos):", ...problemas.map((x) => `• ${x}`),
      ...(lancadas.length ? ["", "JÁ LANÇADAS AUTOMATICAMENTE:", ...lancadas.map((x) => `• ${x}`)] : [])].join("\n");
    const r = await criar({ titulo: `CONFERIR NF · e-mail: ${assunto}`.slice(0, 200), descricao, setor: setorTarefaDe(brenda), responsavelId: brenda.id, prazo: hojeSP(), tipo: "PADRAO" }, quem);
    if (!r.error) {
      tarefaId = r.tarefa.id;
      for (const a of brutos) await prisma.tarefaArquivo.create({ data: { tarefaId, nome: a.nome, mime: a.mime, tamanho: Math.floor(a.b64.length * 3 / 4), conteudo: a.b64, criadoPorNome: "E-MAIL" } }).catch(() => null);
    }
  }
  const out = {
    resultados: resultados.map((r) => ({ numero: r.numero, parceiro: r.parceiro, situacao: r.situacao, criadas: r.criadas, ligadas: r.ligadas, estoque: !!r.estoque })),
    pendentes: pend.map(({ n, motivo }) => ({ numero: n.numero, parceiro: n.parceiro, motivo })), erros: [...erros, ...outros], tarefaId,
  };
  await prisma.finConfig.create({ data: { chave, valor: JSON.stringify(out) } }).catch(() => null);
  return out;
}
