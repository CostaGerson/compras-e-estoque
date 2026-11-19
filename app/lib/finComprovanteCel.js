// v1027 — Comprovantes enviados pelo celular (atalho "Enviar ao ERP" do iPhone, menu Compartilhar).
// Foto ou PDF → leitura (relatório do Bradesco pelo texto; o resto pela IA) → baixa automática SÓ quando
// valor igual, data do comprovante = vencimento e o nome do destinatário aparece no fornecedor da conta,
// com uma única conta nessas condições. Fora disso, o comprovante fica guardado como PENDENTE DE CONFIRMAÇÃO:
// confirmar = baixa + anexo na conta; rejeitar = apaga o comprovante (a conta continua em aberto).
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { lerComprovantes, analisarComprovantes, baixarComprovantes, chaveHash, paginaPdf } from "@/lib/finComprovantes";
import { iaDisponivel, perguntarIA } from "@/lib/finIA";
import { normRegra, usuarioMaster } from "@/lib/fin";
import { r2, nomeU } from "@/lib/finTitulos";

const PREF = "COMPROVANTE_CEL|";
const so = (s) => String(s || "").replace(/\D/g, "");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const GEN = new Set("LTDA ME EPP EIRELI SA S A DE DA DO DAS DOS E EM PARA COM COMERCIO INDUSTRIA IND COM SERVICOS SERVICO".split(" "));
const palavras = (s) => [...new Set(normRegra(s).split(" ").filter((p) => p.length >= 2 && !GEN.has(p) && !/^\d+$/.test(p)))];

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
// foto do iPhone (HEIC ou JPEG grande) → JPEG de até 2000 px (a IA aceita e o anexo fica leve)
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

// ---------- leitura pela IA (foto, print ou PDF de outro banco) ----------
const SISTEMA = `Você lê comprovantes de pagamento de bancos brasileiros (PIX, boleto, TED/DOC, tributo) em foto, print ou PDF.
Devolva só uma lista JSON entre <json></json>, um objeto por comprovante:
[{"tipo":"PIX|BOLETO|TED|TRIBUTO|OUTRO","data":"AAAA-MM-DD","valor":1234.56,"favorecido":"NOME DE QUEM RECEBEU","documento":"dígitos do CPF/CNPJ de quem recebeu","pagador":"NOME DE QUEM PAGOU","idTransacao":"ID/E2E/autenticação","vencimento":"AAAA-MM-DD ou null","juros":0,"multa":0,"desconto":0}]
Regras: data = data do pagamento/débito (não a do vencimento); valor = total pago, número com ponto decimal e sem milhar;
favorecido = recebedor/destinatário/beneficiário (no boleto, a razão social do beneficiário); documento só com os dígitos visíveis,
na ordem (CPF mascarado ***.210.046-** → "210046"); campo que não aparece → null (juros/multa/desconto → 0).
Não invente nada. Se a imagem não for um comprovante de pagamento, devolva [].`;

async function lerPelaIA(buf, mime) {
  if (!iaDisponivel()) return [];
  const b64 = buf.toString("base64");
  const bloco = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };
  const l = await perguntarIA(SISTEMA, [bloco, { type: "text", text: "Leia o(s) comprovante(s)." }]);
  return (Array.isArray(l) ? l : []).map((x) => {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(x.data || "")) ? x.data : null;
    const valor = r2(x.valor);
    const tipo = ["PIX", "BOLETO", "TED", "TRIBUTO"].includes(String(x.tipo || "").toUpperCase()) ? String(x.tipo).toUpperCase() : "OUTRO";
    const favorecido = String(x.favorecido || "").trim().toUpperCase();
    let documento = so(x.documento);
    if (documento.length === 15 && documento.startsWith("0")) documento = documento.slice(1);
    const juros = r2(x.juros), multa = r2(x.multa), desconto = r2(x.desconto);
    const id = String(x.idTransacao || "").replace(/\s/g, "").toUpperCase();
    return {
      tipo, data, valor, favorecido, fantasia: "", final: "", documento, docFinal: "", descricao: "", codBarras: "",
      vencBoleto: /^\d{4}-\d{2}-\d{2}$/.test(String(x.vencimento || "")) ? x.vencimento : null,
      pagador: String(x.pagador || "").trim().toUpperCase(),
      propria: ["48011287", "55116246"].includes(documento.slice(0, 8)) || /^(MERIDIAN|NORT SPORTS)\b/.test(normRegra(favorecido)),
      principal: null, juros, multa, desconto, encargos: r2(juros + multa), ia: true,
      chave: id ? ["CEL", tipo, id].join("|") : null,
    };
  }).filter((c) => c.valor > 0);
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
  if (!c?.data || !c?.valor || c.propria) return [];
  return titulos.filter((t) => iso(t.vencimento) === c.data && Math.abs(Number(t.valor) - c.valor) < 0.005 && nomeBate(c.favorecido, t.parceiro));
}
async function abertasNoDia(data) {
  if (!data) return [];
  const ts = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", status: "ABERTO", vencimento: new Date(`${data}T00:00:00Z`) },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, chaveImport: true },
  });
  return ts.filter((t) => !String(t.chaveImport || "").startsWith("SEMANA|"));
}
// por que não baixou sozinho (texto do card amarelo)
function motivoPendente(c, alvo, exatas) {
  if (!c.valor || !c.data) return "Não consegui ler valor e data do comprovante — informe e escolha a conta.";
  if (c.propria) return "Transferência para a própria empresa — confira se é mesmo pagamento de conta.";
  if (exatas.length > 1) return `${exatas.length} contas com o mesmo valor, vencimento e fornecedor — escolha qual baixar.`;
  if (!alvo) return "Nenhuma conta em aberto com esse valor/fornecedor perto dessa data — escolha a conta ou rejeite.";
  const f = [];
  if (Math.abs(alvo.valor - c.valor) >= 0.005) f.push(`valor pago ${brl(c.valor)} ≠ conta ${brl(alvo.valor)}`);
  if (alvo.vencimento !== c.data) f.push(`pago em ${dBR(c.data)}, vencimento ${dBR(alvo.vencimento)}`);
  if (!nomeBate(c.favorecido, alvo.parceiro)) f.push(`destinatário "${c.favorecido || "?"}" não aparece no fornecedor "${alvo.parceiro}"`);
  return f.length ? `Sugestão: ${alvo.titulo} — ${f.join(" · ")}.` : `Sugestão: ${alvo.titulo}.`;
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
      // 1) relatório do Bradesco (texto do PDF, uma página por comprovante); 2) IA
      let comps = [];
      if (mime === "application/pdf") { try { comps = await lerComprovantes(nomeArq, buf); } catch { comps = []; } }
      const peloTexto = comps.length > 0;
      if (!peloTexto) { try { comps = await lerPelaIA(buf, mime); } catch (e) { comps = []; linhas.push(`⚠️ Leitura pela IA falhou (${e.message}).`); } }
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
        const exatas = contasExatas(c, await abertasNoDia(c.data));
        if (exatas.length === 1) {
          const t = exatas[0];
          const r = await baixarComprovantes([{ tituloId: t.id, arquivo: arqNome, pagina: 1, data: c.data, valor: c.valor, tipo: c.tipo, favorecido: c.favorecido, chave: c.chave, juros: c.juros, multa: c.multa, desconto: c.desconto }],
            [{ nome: arqNome, conteudo, mime, separado: true }], { quem: `${quem} (CELULAR)` });
          if (r.baixadas) {
            await prisma.finComprovanteEnvio.create({ data: { status: "BAIXADO", usuarioId: u.id, enviadoPor: quem, nome: arqNome, mime, tamanho: buf.length, conteudo: "", hashArquivo: hA, hashChave, dados: c, tituloId: t.id, motivo: "BAIXA AUTOMÁTICA", resolvidoPor: "AUTOMÁTICO", resolvidoEm: new Date() } });
            linhas.push(`✅ Baixada: ${t.titulo} · ${brl(c.valor)} · pago em ${dBR(c.data)}. Comprovante anexado.`);
            continue;
          }
        }
        // pendente de confirmação: guarda o comprovante com a melhor sugestão
        const [an] = c.valor && c.data ? await analisarComprovantes([{ ...c, arquivo: arqNome, pagina: 1 }]) : [null];
        const alvo = an?.alvo || null;
        await prisma.finComprovanteEnvio.create({ data: { status: "PENDENTE", usuarioId: u.id, enviadoPor: quem, nome: arqNome, mime, tamanho: Math.floor(conteudo.length * 3 / 4), conteudo, hashArquivo: hA, hashChave, dados: c, tituloId: alvo?.id || null, motivo: motivoPendente(c, alvo, exatas) } });
        linhas.push(`🟡 Pendente de confirmação: ${c.favorecido || "comprovante"}${c.valor ? ` · ${brl(c.valor)}` : ""}${c.data ? ` · ${dBR(c.data)}` : ""}.${alvo ? ` Sugestão: ${alvo.titulo}.` : " Sem conta sugerida."} Confirme no Contas a pagar.`);
      }
    } catch (e) { linhas.push(`⚠️ ${nomeArq}: ${e.message}`); }
  }
  return { linhas };
}

// ---------- tela: pendentes, confirmar, rejeitar ----------
const SEL_T = { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, documento: true };
const saida = (t) => t && ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: iso(t.vencimento), status: t.status });

export async function listarPendentes() {
  const ps = await prisma.finComprovanteEnvio.findMany({ where: { status: "PENDENTE" }, orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, mime: true, tamanho: true, dados: true, tituloId: true, motivo: true, enviadoPor: true, createdAt: true } });
  if (!ps.length) return [];
  const comps = ps.map((p) => ({ ...(p.dados || {}), arquivo: String(p.id), pagina: 1 }));
  const lidos = comps.filter((c) => c.valor && c.data);
  const an = lidos.length ? await analisarComprovantes(lidos) : [];
  const porK = Object.fromEntries(an.map((x) => [x.arquivo, x]));
  const sug = await prisma.finTitulo.findMany({ where: { id: { in: ps.map((p) => p.tituloId).filter(Boolean) } }, select: SEL_T });
  const sugPor = Object.fromEntries(sug.map((t) => [t.id, saida(t)]));
  return ps.map((p) => {
    const a = porK[String(p.id)];
    const sugerida = (p.tituloId && sugPor[p.tituloId]) || null;
    const opcoes = [...(sugerida ? [sugerida] : []), ...((a?.opcoes) || []).filter((o) => o.id !== sugerida?.id).map((o) => ({ id: o.id, titulo: o.titulo, parceiro: o.parceiro, valor: o.valor, vencimento: o.vencimento, status: "ABERTO" }))];
    return { id: p.id, nome: p.nome, mime: p.mime, tamanho: p.tamanho, dados: p.dados, motivo: p.motivo, enviadoPor: p.enviadoPor, em: p.createdAt, tituloId: p.tituloId, sugerida, opcoes };
  });
}

export async function buscarContas(q) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const v = Number(t.replace(/\./g, "").replace(",", "."));
  const where = { tipo: "PAGAR", status: { in: ["ABERTO", "PAGO"] } };
  const ts = await prisma.finTitulo.findMany({
    where: Number.isFinite(v) && v > 0 ? { ...where, valor: v } : { ...where, OR: [{ parceiro: { contains: t, mode: "insensitive" } }, { titulo: { contains: t, mode: "insensitive" } }] },
    select: SEL_T, orderBy: { vencimento: "desc" }, take: 25,
  });
  return ts.sort((a, b) => (a.status === b.status ? 0 : a.status === "ABERTO" ? -1 : 1)).map(saida);
}

// confirmar: baixa a conta (ou só anexa, se ela já estava paga) e o comprovante vai para a conta
export async function confirmarPendente(id, { tituloId, data, valor }, u) {
  const p = await prisma.finComprovanteEnvio.findUnique({ where: { id: Number(id) } });
  if (!p || p.status !== "PENDENTE") throw new Error("Comprovante não está mais pendente.");
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) }, select: { ...SEL_T, tipo: true } });
  if (!t || t.tipo !== "PAGAR") throw new Error("Escolha a conta a pagar.");
  const c = { ...(p.dados || {}) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) c.data = data;
  if (Number(valor) > 0) c.valor = r2(valor);
  if (!c.data || !c.valor) throw new Error("Informe a data e o valor pago.");
  const quem = nomeU(u);
  const chave = c.chave || `CEL|ARQ|${p.hashArquivo}`;
  const ext = p.mime === "application/pdf" ? "pdf" : "jpg";
  if (t.status === "PAGO") {
    await prisma.finTituloAnexo.create({ data: { tituloId: t.id, nome: `COMPROVANTE ${c.tipo || ""} ${c.data.split("-").reverse().join("-")} ${String(c.favorecido || "").slice(0, 40)}.${ext}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " "), mime: p.mime, tamanho: p.tamanho, conteudo: p.conteudo, hash: chaveHash(chave), criadoPorNome: quem } });
  } else if (t.status === "ABERTO") {
    const r = await baixarComprovantes([{ tituloId: t.id, arquivo: p.nome, pagina: 1, data: c.data, valor: c.valor, tipo: c.tipo || "OUTRO", favorecido: c.favorecido || t.parceiro, chave, juros: c.juros, multa: c.multa, desconto: c.desconto }],
      [{ nome: p.nome, conteudo: p.conteudo, mime: p.mime, separado: true }], { quem });
    if (!r.baixadas) throw new Error(r.erros[0] || r.linhas[0] || "Não consegui baixar a conta.");
  } else throw new Error("Conta cancelada.");
  await prisma.finComprovanteEnvio.update({ where: { id: p.id }, data: { status: "BAIXADO", conteudo: "", tituloId: t.id, dados: c, resolvidoPor: quem, resolvidoEm: new Date() } });
  return { ok: true, texto: t.status === "PAGO" ? `Comprovante anexado em ${t.titulo} (já estava paga).` : `${t.titulo} baixada em ${dBR(c.data)} · ${brl(c.valor)}. Comprovante anexado.` };
}

// rejeitar: o comprovante é apagado e a conta fica como estava
export async function rejeitarPendente(id) {
  const p = await prisma.finComprovanteEnvio.findUnique({ where: { id: Number(id) }, select: { id: true, status: true } });
  if (!p || p.status !== "PENDENTE") throw new Error("Comprovante não está mais pendente.");
  await prisma.finComprovanteEnvio.delete({ where: { id: p.id } });
  return { ok: true, texto: "Comprovante rejeitado e excluído. A conta continua em aberto." };
}
