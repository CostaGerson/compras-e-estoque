// v1027 — Comprovantes enviados pelo celular (atalho "Enviar ao ERP" do iPhone, menu Compartilhar).
// Foto ou PDF → leitura sem IA (relatório do Bradesco pelo texto do PDF; foto pelo OCR; outros PDFs pelo texto) → baixa automática SÓ quando
// valor igual, data do comprovante = vencimento e o nome do destinatário aparece no fornecedor da conta,
// com uma única conta nessas condições. Fora disso, o comprovante fica guardado como PENDENTE DE CONFIRMAÇÃO:
// confirmar = baixa + anexo na conta; rejeitar = apaga o comprovante (a conta continua em aberto).
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { lerComprovantes, analisarComprovantes, baixarComprovantes, chaveHash, paginaPdf } from "@/lib/finComprovantes";
import { linhasPdf } from "@/lib/finParse";
import { ocrImagem, lerTextoComprovante } from "@/lib/finComprovanteTexto";
import { normRegra, usuarioMaster } from "@/lib/fin";
import { r2, nomeU } from "@/lib/finTitulos";
import { baixarItemManual } from "@/lib/finSemana";

const PREF = "COMPROVANTE_CEL|";
const so = (s) => String(s || "").replace(/\D/g, "");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const GEN = new Set("LTDA ME EPP EIRELI SA S A DE DA DO DAS DOS E EM PARA COM COMERCIO INDUSTRIA IND COM SERVICOS SERVICO".split(" "));
const palavras = (s) => [...new Set(normRegra(s).split(" ").filter((p) => p.length >= 2 && !GEN.has(p) && !/^\d+$/.test(p)))];

const SEL_T = { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, documento: true };
const saida = (t) => t && ({ k: `T:${t.id}`, id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: iso(t.vencimento), status: t.status });

// ---------- chave do atalho (uma por usuário) ----------
export async function chaveAtalho(usuarioId, nova = false) {
  const k = `${PREF}${Number(usuarioId)}`;
  const c = await prisma.finConfig.findUnique({ where: { chave: k } });
  if (c?.valor && !nova) return c.valor;
  const valor = randomBytes(24).toString("hex");
  await prisma.finConfig.upsert({ where: { chave: k }, create: { chave: k, valor }, update: { valor } });
  return valor;
}
export async function usuarioDaChave(tok) {
  const t = String(tok || "").trim();
  if (t.length < 32) return null;
  const c = await prisma.finConfig.findFirst({ where: { chave: { startsWith: PREF }, valor: t } });
  return c ? usuarioMaster(Number(c.chave.slice(PREF.length))) : null;
}

// ---------- arquivo ----------
export function tipoArquivo(buf, mime = "", nome = "") {
  const h = buf.subarray(0, 16);
  if (h.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (h[0] === 0xff && h[1] === 0xd8) return "image/jpeg";
  if (h[0] === 0x89 && h.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (h.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(h.subarray(8, 12).toString("latin1"))) return "image/heic";
  if (h.subarray(0, 4).toString("latin1") === "RIFF" && h.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (/pdf/i.test(mime) || /\.pdf$/i.test(nome)) return "application/pdf";
  return String(mime || "").toLowerCase() || "application/octet-stream";
}
// foto do iPhone (HEIC ou JPEG grande) → JPEG de até 2000 px (o OCR lê melhor e o anexo fica leve)
async function prepararImagem(buf, mime) {
  let b = buf;
  if (mime === "image/heic") {
    const convert = (await import("heic-convert")).default;
    b = Buffer.from(await convert({ buffer: buf, format: "JPEG", quality: 0.9 }));
  }
  try {
    const sharp = (await import("sharp")).default;
    b = await sharp(b).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch (e) { if (mime === "image/heic") throw e; }
  return b;
}

// ---------- leitura sem IA (v1028): foto → OCR; PDF de outro banco → texto do PDF ----------
function normalizar(x) {
  let documento = so(x.documento);
  if (documento.length === 15 && documento.startsWith("0")) documento = documento.slice(1);
  const favorecido = String(x.favorecido || "").trim().toUpperCase();
  return {
    tipo: x.tipo || "OUTRO", data: x.data || null, valor: r2(x.valor), favorecido, fantasia: "", final: "", documento, docFinal: "", descricao: "", codBarras: "",
    vencBoleto: null, agendado: !!x.agendado,
    propria: ["48011287", "55116246"].includes(documento.slice(0, 8)) || /^(MERIDIAN|NORT SPORTS)\b/.test(normRegra(favorecido)),
    principal: null, juros: 0, multa: 0, desconto: 0, encargos: 0, lido: "TEXTO",
    chave: x.idTransacao ? ["CEL", x.tipo || "OUTRO", x.idTransacao].join("|") : null,
  };
}
async function lerPeloTexto(buf, mime) {
  if (mime === "application/pdf") {
    const pags = await linhasPdf(buf);
    return pags.map((p) => lerTextoComprovante(p.map((l) => l.its.map((x) => x.s).join(" ")).join("\n"))).filter(Boolean).map(normalizar).filter((c) => c.valor > 0);
  }
  const c = lerTextoComprovante(await ocrImagem(buf));
  return c && c.valor > 0 ? [normalizar(c)] : [];
}

// ---------- regra da baixa automática ----------
// o nome do destinatário aparece no fornecedor da conta (inteiro, ou todas as palavras dele)
export function nomeBate(favorecido, parceiro) {
  const f = normRegra(favorecido), p = normRegra(parceiro);
  if (!f || !p) return false;
  if (` ${p} `.includes(` ${f} `)) return true;
  const pf = palavras(favorecido), pp = new Set(palavras(parceiro));
  return pf.length > 0 && pf.every((x) => pp.has(x));
}
export function contasExatas(c, titulos) {
  if (!c?.data || !c?.valor || c.propria || c.agendado) return [];
  return titulos.filter((t) => iso(t.vencimento) === c.data && Math.abs(Number(t.valor) - c.valor) < 0.005 && nomeBate(c.favorecido, t.parceiro));
}
async function abertasNoDia(data) {
  if (!data) return [];
  const ts = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", status: "ABERTO", vencimento: new Date(`${data}T00:00:00Z`) },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, chaveImport: true },
  });
  return ts.filter((t) => !String(t.chaveImport || "").startsWith("SEMANA|"));
}
// v1030 — lançamentos que compõem a conta da semana (freelancers, facções, serviços): cada um pode ser pago por um comprovante
const SEL_I = { id: true, tituloId: true, grupo: true, nome: true, chavePix: true, valor: true, pago: true, vencimentoNegociado: true,
  prestador: { select: { nome: true, documento: true } }, titulo: { select: { titulo: true, vencimento: true, status: true } } };
const DIA = 86400000;
const saidaI = (it) => ({ k: `I:${it.id}`, id: it.tituloId, itemId: it.id, titulo: `${it.titulo.titulo} · ${it.nome}`, parceiro: it.nome, grupo: it.grupo,
  nomes: [it.nome, it.prestador?.nome].filter(Boolean), docs: [so(it.prestador?.documento), so(it.chavePix)].filter((d) => d.length >= 11),
  valor: Number(it.valor), vencimento: iso(it.vencimentoNegociado || it.titulo.vencimento), status: it.pago ? "PAGO" : it.titulo.status });
async function itensDaSemana(datas) {
  const ds = datas.filter(Boolean).map((d) => new Date(`${d}T00:00:00Z`).getTime());
  if (!ds.length) return [];
  const de = new Date(Math.min(...ds) - 25 * DIA), ate = new Date(Math.max(...ds) + 25 * DIA);
  const its = await prisma.finSemanaItem.findMany({ where: { pago: false, titulo: { tipo: "PAGAR", status: "ABERTO", vencimento: { gte: de, lte: ate } } }, select: SEL_I });
  return its.map(saidaI);
}
// CPF/CNPJ do comprovante (inteiro ou os 6 dígitos do meio do CPF mascarado) no cadastro / chave PIX do prestador
const docBate = (c, docs) => { const d = so(c.documento); return d.length >= 6 && docs.some((x) => x === d || (d.length === 6 && x.length === 11 && x.slice(3, 9) === d)); };
const nomeItem = (c, o) => o.nomes.some((n) => nomeBate(c.favorecido, n));
export function itensExatos(c, itens) {
  if (!c?.data || !c?.valor || c.propria || c.agendado) return [];
  return itens.filter((o) => o.vencimento === c.data && Math.abs(o.valor - c.valor) < 0.005 && nomeItem(c, o));
}
// nota da parecença comprovante × lançamento da semana (0 = não serve)
function notaItem(c, o) {
  if (!c?.valor) return 0;
  const igual = Math.abs(o.valor - c.valor) < 0.005, nome = nomeItem(c, o), doc = docBate(c, o.docs);
  const dias = c.data && o.vencimento ? Math.abs(Math.round((new Date(c.data) - new Date(o.vencimento)) / DIA)) : 99;
  if (igual && (nome || doc)) return 3 + (dias === 0 ? 0.5 : 0);
  if (igual && dias <= 7) return 2 - dias / 10;
  if ((nome || doc) && Math.abs(o.valor - c.valor) / c.valor <= 0.15) return 1;
  return 0;
}
const NOTA_CONF = { ALTA: 3, MEDIA: 2, BAIXA: 1 };

// por que não baixou sozinho (texto do card amarelo)
function motivoPendente(c, alvo, exatas) {
  if (!c.valor || !c.data) return "Não consegui ler valor e data do comprovante — informe e escolha a conta.";
  if (c.agendado) return "Pix ainda AGENDADO / AGUARDANDO APROVAÇÃO no banco — confirme só depois que ele for pago.";
  if (c.propria) return "Transferência para a própria empresa — confira se é mesmo pagamento de conta.";
  if (exatas.length > 1) return `${exatas.length} contas/lançamentos com o mesmo valor, vencimento e fornecedor — escolha qual baixar.`;
  if (!alvo) return "Nenhuma conta em aberto com esse valor/fornecedor perto dessa data — escolha a conta ou rejeite.";
  const f = [];
  if (Math.abs(alvo.valor - c.valor) >= 0.005) f.push(`valor pago ${brl(c.valor)} ≠ conta ${brl(alvo.valor)}`);
  if (alvo.vencimento !== c.data) f.push(`pago em ${dBR(c.data)}, vencimento ${dBR(alvo.vencimento)}`);
  if (!(alvo.nomes || [alvo.parceiro]).some((n) => nomeBate(c.favorecido, n))) f.push(`destinatário "${c.favorecido || "?"}" não aparece no fornecedor "${alvo.parceiro}"`);
  return f.length ? `Sugestão: ${alvo.titulo} — ${f.join(" · ")}.` : `Sugestão: ${alvo.titulo}.`;
}

// baixa a conta (T) ou o lançamento da semana (I) e anexa o comprovante na conta
async function baixarAlvo(o, c, arq, quem) {
  const chave = c.chave;
  const h = chaveHash(chave);
  if (await prisma.finTituloAnexo.findFirst({ where: { hash: h, titulo: { status: { not: "CANCELADO" } } }, select: { id: true } })) throw new Error("comprovante já usado em outra baixa");
  if (o.itemId) {
    const r = await baixarItemManual({ itemId: o.itemId, data: c.data, observacao: `COMPROVANTE ${c.tipo || ""} ${c.favorecido || ""}`.trim(), quem });
    if (!r.ok) throw new Error(r.erro || "não consegui baixar o lançamento");
    const ext = arq.mime === "application/pdf" ? "pdf" : "jpg";
    await prisma.finTituloAnexo.create({ data: { tituloId: o.id, nome: `COMPROVANTE ${c.tipo || ""} ${c.data.split("-").reverse().join("-")} ${String(o.parceiro || c.favorecido || "").slice(0, 40)}.${ext}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " "),
      mime: arq.mime, tamanho: Math.floor(arq.conteudo.length * 3 / 4), conteudo: arq.conteudo, hash: h, criadoPorNome: quem } });
    return;
  }
  const r = await baixarComprovantes([{ tituloId: o.id, arquivo: arq.nome, pagina: 1, data: c.data, valor: c.valor, tipo: c.tipo || "OUTRO", favorecido: c.favorecido || o.parceiro, chave, juros: c.juros, multa: c.multa, desconto: c.desconto }],
    [{ nome: arq.nome, conteudo: arq.conteudo, mime: arq.mime, separado: true }], { quem });
  if (!r.baixadas) throw new Error(r.erros[0] || r.linhas[0] || "não consegui baixar a conta");
}
// melhor sugestão para o pendente: conta (pela análise dos comprovantes) ou lançamento da semana
async function sugestao(c, arqNome, itens) {
  const [an] = c.valor && c.data ? await analisarComprovantes([{ ...c, arquivo: arqNome, pagina: 1 }]) : [null];
  const t = an?.alvo ? { ...an.alvo, k: `T:${an.alvo.id}`, nota: NOTA_CONF[an.alvo.confianca] || 1 } : null;
  const i = itens.map((o) => ({ ...o, nota: notaItem(c, o) })).filter((o) => o.nota > 0).sort((a, b) => b.nota - a.nota)[0] || null;
  return i && (!t || i.nota > t.nota) ? i : t;
}

// ---------- recebimento (atalho) ----------
// arquivos: [{ nome, mime, buf }] → { linhas: [texto para o celular] }
export async function receberComprovantes(u, arquivos) {
  const quem = nomeU(u), linhas = [];
  for (const a0 of arquivos) {
    const nomeArq = String(a0.nome || "comprovante").slice(0, 120);
    try {
      if (!a0.buf?.length) { linhas.push(`⚠️ ${nomeArq}: arquivo vazio.`); continue; }
      if (a0.buf.length > 25 * 1048576) { linhas.push(`⚠️ ${nomeArq}: maior que 25 MB.`); continue; }
      const hashArquivo = sha(a0.buf);
      if (await prisma.finComprovanteEnvio.findFirst({ where: { hashArquivo, status: "PENDENTE" }, select: { id: true } })) { linhas.push("ℹ️ Este comprovante já está pendente de confirmação no Contas a pagar."); continue; }
      let mime = tipoArquivo(a0.buf, a0.mime, nomeArq);
      if (!/^(application\/pdf|image\/(jpeg|png|heic|webp))$/.test(mime)) { linhas.push(`⚠️ ${nomeArq}: envie foto ou PDF.`); continue; }
      let buf = a0.buf;
      if (mime !== "application/pdf") { buf = await prepararImagem(buf, mime); mime = "image/jpeg"; }
      // 1) relatório do Bradesco (texto do PDF, uma página por comprovante); 2) foto (OCR) ou PDF de outro banco, sem IA
      let comps = [];
      if (mime === "application/pdf") { try { comps = await lerComprovantes(nomeArq, buf); } catch { comps = []; } }
      const peloTexto = comps.length > 0;
      if (!peloTexto) { try { comps = await lerPeloTexto(buf, mime); } catch (e) { comps = []; linhas.push(`⚠️ Não consegui ler o comprovante (${e.message}).`); } }
      const b64 = buf.toString("base64");
      if (!comps.length) comps = [{ tipo: "OUTRO", data: null, valor: 0, favorecido: "", documento: "", naoLido: true }];
      for (const [i, c0] of comps.entries()) {
        const c = { ...c0, chave: c0.chave || `CEL|ARQ|${hashArquivo}|${i + 1}` };
        const hA = i ? `${hashArquivo}|${i + 1}` : hashArquivo;
        const hashChave = chaveHash(c.chave);
        if (await prisma.finTituloAnexo.findFirst({ where: { hash: hashChave, titulo: { status: { not: "CANCELADO" } } }, select: { id: true } })
          || await prisma.finComprovanteEnvio.findFirst({ where: { hashChave, status: "PENDENTE" }, select: { id: true } })) {
          linhas.push(`ℹ️ ${c.favorecido || "Comprovante"} ${brl(c.valor)}: já está no sistema.`); continue;
        }
        // a página do comprovante (relatório com várias) vira um PDF próprio
        let conteudo = b64;
        if (peloTexto && comps.length > 1) { try { conteudo = await paginaPdf(b64, c.pagina || i + 1); } catch { /* vai inteiro */ } }
        const arqNome = `${nomeArq}${comps.length > 1 ? ` (${i + 1})` : ""}`;
        const itens = c.data ? await itensDaSemana([c.data]) : [];
        const exatas = [...contasExatas(c, await abertasNoDia(c.data)).map((t) => ({ ...saida(t), k: `T:${t.id}` })), ...itensExatos(c, itens)];
        if (exatas.length === 1) {
          const o = exatas[0];
          try {
            await baixarAlvo(o, c, { nome: arqNome, conteudo, mime }, `${quem} (CELULAR)`);
            await prisma.finComprovanteEnvio.create({ data: { status: "BAIXADO", usuarioId: u.id, enviadoPor: quem, nome: arqNome, mime, tamanho: buf.length, conteudo: "", hashArquivo: hA, hashChave, dados: c, tituloId: o.id, semanaItemId: o.itemId || null, motivo: "BAIXA AUTOMÁTICA", resolvidoPor: "AUTOMÁTICO", resolvidoEm: new Date() } });
            linhas.push(`✅ Baixada: ${o.titulo} · ${brl(c.valor)} · pago em ${dBR(c.data)}. Comprovante anexado.`);
            continue;
          } catch { /* segue como pendente */ }
        }
        // pendente de confirmação: guarda o comprovante com a melhor sugestão (conta ou lançamento da semana)
        const alvo = await sugestao(c, arqNome, itens);
        await prisma.finComprovanteEnvio.create({ data: { status: "PENDENTE", usuarioId: u.id, enviadoPor: quem, nome: arqNome, mime, tamanho: Math.floor(conteudo.length * 3 / 4), conteudo, hashArquivo: hA, hashChave, dados: c, tituloId: alvo?.id || null, semanaItemId: alvo?.itemId || null, motivo: motivoPendente(c, alvo, exatas) } });
        linhas.push(`🟡 Pendente de confirmação: ${c.favorecido || "comprovante"}${c.valor ? ` · ${brl(c.valor)}` : ""}${c.data ? ` · ${dBR(c.data)}` : ""}.${c.agendado ? " Pix ainda aguardando aprovação." : ""}${alvo ? ` Sugestão: ${alvo.titulo}.` : " Sem conta sugerida."} Confirme no Contas a pagar.`);
      }
    } catch (e) { linhas.push(`⚠️ ${nomeArq}: ${e.message}`); }
  }
  return { linhas };
}

// ---------- tela: pendentes, confirmar, rejeitar ----------

export async function listarPendentes() {
  const ps = await prisma.finComprovanteEnvio.findMany({ where: { status: "PENDENTE" }, orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, mime: true, tamanho: true, dados: true, tituloId: true, semanaItemId: true, motivo: true, enviadoPor: true, createdAt: true } });
  if (!ps.length) return [];
  const comps = ps.map((p) => ({ ...(p.dados || {}), arquivo: String(p.id), pagina: 1 }));
  const lidos = comps.filter((c) => c.valor && c.data);
  const an = lidos.length ? await analisarComprovantes(lidos) : [];
  const porK = Object.fromEntries(an.map((x) => [x.arquivo, x]));
  const itens = await itensDaSemana(lidos.map((c) => c.data));
  const sugT = await prisma.finTitulo.findMany({ where: { id: { in: ps.filter((p) => !p.semanaItemId).map((p) => p.tituloId).filter(Boolean) } }, select: SEL_T });
  const sugI = await prisma.finSemanaItem.findMany({ where: { id: { in: ps.map((p) => p.semanaItemId).filter(Boolean) } }, select: SEL_I });
  const porT = Object.fromEntries(sugT.map((t) => [t.id, saida(t)])), porI = Object.fromEntries(sugI.map((it) => [it.id, saidaI(it)]));
  return ps.map((p) => {
    const c = p.dados || {};
    const a = porK[String(p.id)];
    const sugerida = (p.semanaItemId ? porI[p.semanaItemId] : p.tituloId ? porT[p.tituloId] : null) || null;
    const doT = ((a?.opcoes) || []).map((o) => ({ k: `T:${o.id}`, id: o.id, titulo: o.titulo, parceiro: o.parceiro, valor: o.valor, vencimento: o.vencimento, status: "ABERTO" }));
    const doI = itens.map((o) => ({ ...o, nota: notaItem(c, o) })).filter((o) => o.nota > 0).sort((x, y) => y.nota - x.nota).slice(0, 6);
    const vistos = new Set(), opcoes = [];
    for (const o of [...(sugerida ? [sugerida] : []), ...doT, ...doI]) if (!vistos.has(o.k)) { vistos.add(o.k); opcoes.push(o); }
    return { id: p.id, nome: p.nome, mime: p.mime, tamanho: p.tamanho, dados: c, motivo: p.motivo, enviadoPor: p.enviadoPor, em: p.createdAt, tituloId: p.tituloId, sugerida, opcoes: opcoes.slice(0, 12) };
  });
}

export async function buscarContas(q) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const v = Number(t.replace(/\./g, "").replace(",", "."));
  const porValor = Number.isFinite(v) && v > 0;
  const where = { tipo: "PAGAR", status: { in: ["ABERTO", "PAGO"] } };
  const ts = await prisma.finTitulo.findMany({
    where: porValor ? { ...where, valor: v } : { ...where, OR: [{ parceiro: { contains: t, mode: "insensitive" } }, { titulo: { contains: t, mode: "insensitive" } }] },
    select: SEL_T, orderBy: { vencimento: "desc" }, take: 25,
  });
  // lançamentos de dentro das contas da semana (freelancer / terceirizado)
  const its = await prisma.finSemanaItem.findMany({
    where: { titulo: { status: { in: ["ABERTO", "PAGO"] } }, ...(porValor ? { valor: v } : { OR: [{ nome: { contains: t, mode: "insensitive" } }, { prestador: { nome: { contains: t, mode: "insensitive" } } }] }) },
    select: SEL_I, orderBy: { id: "desc" }, take: 25,
  });
  const ab = (x) => (x.status === "ABERTO" ? 0 : 1);
  return [...ts.map(saida), ...its.map(saidaI)].sort((a, b) => ab(a) - ab(b) || String(b.vencimento).localeCompare(String(a.vencimento))).slice(0, 40);
}

// confirmar: baixa a conta / o lançamento da semana (ou só anexa, se já estava pago) e o comprovante vai para a conta
// alvo: "T:<id da conta>" | "I:<id do lançamento da semana>" (tituloId sozinho = conta)
export async function confirmarPendente(id, { alvo, tituloId, data, valor }, u) {
  const p = await prisma.finComprovanteEnvio.findUnique({ where: { id: Number(id) } });
  if (!p || p.status !== "PENDENTE") throw new Error("Comprovante não está mais pendente.");
  const [kind, idS] = String(alvo || (tituloId ? `T:${tituloId}` : "")).split(":");
  let o = null;
  if (kind === "I") {
    const it = await prisma.finSemanaItem.findUnique({ where: { id: Number(idS) }, select: SEL_I });
    o = it && saidaI(it);
  } else if (kind === "T") {
    const t = await prisma.finTitulo.findUnique({ where: { id: Number(idS) }, select: { ...SEL_T, tipo: true } });
    o = t && t.tipo === "PAGAR" ? saida(t) : null;
  }
  if (!o) throw new Error("Escolha a conta a pagar.");
  const c = { ...(p.dados || {}) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) c.data = data;
  if (Number(valor) > 0) c.valor = r2(valor);
  if (!c.data || !c.valor) throw new Error("Informe a data e o valor pago.");
  c.chave = c.chave || `CEL|ARQ|${p.hashArquivo}`;
  const quem = nomeU(u);
  const ext = p.mime === "application/pdf" ? "pdf" : "jpg";
  if (o.status === "PAGO") {
    await prisma.finTituloAnexo.create({ data: { tituloId: o.id, nome: `COMPROVANTE ${c.tipo || ""} ${c.data.split("-").reverse().join("-")} ${String(o.parceiro || c.favorecido || "").slice(0, 40)}.${ext}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " "), mime: p.mime, tamanho: p.tamanho, conteudo: p.conteudo, hash: chaveHash(c.chave), criadoPorNome: quem } });
  } else if (o.status === "ABERTO") {
    await baixarAlvo(o, c, { nome: p.nome, conteudo: p.conteudo, mime: p.mime }, quem);
  } else throw new Error("Conta cancelada.");
  await prisma.finComprovanteEnvio.update({ where: { id: p.id }, data: { status: "BAIXADO", conteudo: "", tituloId: o.id, semanaItemId: o.itemId || null, dados: c, resolvidoPor: quem, resolvidoEm: new Date() } });
  return { ok: true, texto: o.status === "PAGO" ? `Comprovante anexado em ${o.titulo} (já estava pago).` : `${o.titulo} baixado em ${dBR(c.data)} · ${brl(c.valor)}. Comprovante anexado.` };
}

// rejeitar: o comprovante é apagado e a conta fica como estava
export async function rejeitarPendente(id) {
  const p = await prisma.finComprovanteEnvio.findUnique({ where: { id: Number(id) }, select: { id: true, status: true } });
  if (!p || p.status !== "PENDENTE") throw new Error("Comprovante não está mais pendente.");
  await prisma.finComprovanteEnvio.delete({ where: { id: p.id } });
  return { ok: true, texto: "Comprovante rejeitado e excluído. A conta continua em aberto." };
}
