// v1031 — Comprovantes enviados ao favorecido pelo WhatsApp DA EMPRESA (Evolution API rodando na VPS, serviço ce-whats).
// O número que envia é o que leu o QR code (celular da empresa → WhatsApp → Aparelhos conectados).
// Fila: comprovantes do celular já BAIXADOS (conta ou lançamento da semana) ainda não enviados.
// O telefone vem do cadastro: prestador (lançamento da semana / documento / nome) ou fornecedor (CNPJ / nome).
// Telefone digitado na tela fica salvo no cadastro (prestador ou fornecedor) ou, sem cadastro, na memória FinConfig.
import { prisma } from "@/lib/prisma";
import { normRegra } from "@/lib/fin";
import { chaveHash } from "@/lib/finComprovantes";

const URL_EVO = (process.env.EVOLUTION_URL || "http://ce-whats:8080").replace(/\/+$/, "");
const KEY = process.env.EVOLUTION_API_KEY || "ce-whats-interno";
const INST = process.env.EVOLUTION_INSTANCIA || "meridian";
const MEM = "WHATS_FONE|";
const so = (s) => String(s || "").replace(/\D/g, "");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- Evolution API ----------
async function evo(caminho, metodo = "GET", corpo) {
  let r;
  try {
    r = await fetch(`${URL_EVO}${caminho}`, { method: metodo, headers: { apikey: KEY, "content-type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined, cache: "no-store", signal: AbortSignal.timeout(60000) });
  } catch (e) { throw new Error("Serviço do WhatsApp fora do ar (ce-whats). Aguarde o deploy terminar ou reinicie o serviço."); }
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { j = { texto: txt }; }
  if (!r.ok) {
    const m = j?.response?.message ?? j?.message ?? j?.error ?? txt;
    const e = new Error(typeof m === "string" ? m : JSON.stringify(m)); e.status = r.status; e.corpo = j; throw e;
  }
  return j;
}

export async function estadoWhats() {
  try {
    const l = await evo(`/instance/fetchInstances?instanceName=${INST}`);
    const i = (Array.isArray(l) ? l : [l]).find(Boolean);
    if (!i) return { estado: "SEM_INSTANCIA" };
    const st = i.connectionStatus || i.instance?.state || i.state || "close";
    const jid = i.ownerJid || i.owner || "";
    return { estado: st === "open" ? "CONECTADO" : st === "connecting" ? "CONECTANDO" : "DESCONECTADO", numero: so(String(jid).split("@")[0]) || null, perfil: i.profileName || null };
  } catch (e) {
    if (e.status === 404) return { estado: "SEM_INSTANCIA" };
    return { estado: "FORA_DO_AR", erro: e.message };
  }
}

// QR code para o celular da empresa ler (cria a instância na primeira vez)
export async function conectarWhats() {
  const st = await estadoWhats();
  if (st.estado === "FORA_DO_AR") throw new Error(st.erro);
  if (st.estado === "CONECTADO") return st;
  if (st.estado === "SEM_INSTANCIA") {
    const c = await evo("/instance/create", "POST", { instanceName: INST, qrcode: true, integration: "WHATSAPP-BAILEYS", rejectCall: false, groupsIgnore: true, alwaysOnline: false, readMessages: false, syncFullHistory: false });
    if (c?.qrcode?.base64) return { estado: "QR", qr: c.qrcode.base64 };
  }
  const q = await evo(`/instance/connect/${INST}`);
  if (q?.base64) return { estado: "QR", qr: q.base64 };
  if (q?.instance?.state === "open") return await estadoWhats();
  return { estado: "CONECTANDO" };
}
export async function desconectarWhats() {
  try { await evo(`/instance/logout/${INST}`, "DELETE"); } catch { /* já estava fora */ }
  try { await evo(`/instance/delete/${INST}`, "DELETE"); } catch { /* idem */ }
  return { estado: "SEM_INSTANCIA" };
}

// ---------- telefone ----------
// "(81) 9 9999-8888 / 3333-4444" → "5581999998888" (prefere celular)
export function foneWhats(txt) {
  const cands = String(txt || "").split(/[\/;,|]|\s{2,}|\be\b/i).map(so).filter((d) => d.length >= 10);
  const norm = (d) => {
    if (d.startsWith("0")) d = d.replace(/^0+/, "");
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
    if (d.length === 10 || d.length === 11) return `55${d}`;
    return null;
  };
  const ns = cands.map(norm).filter(Boolean);
  const cel = ns.find((n) => n.length === 13 && n[4] === "9") || ns.find((n) => n.length === 12 && /[6-9]/.test(n[4]));
  return cel || ns[0] || null;
}
export const foneBR = (f) => {
  const d = so(f).replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : f || "";
};

// de onde vem (e para onde volta) o telefone de cada comprovante
async function origens(envios) {
  const itemIds = envios.map((e) => e.semanaItemId).filter(Boolean);
  const titIds = envios.filter((e) => !e.semanaItemId).map((e) => e.tituloId).filter(Boolean);
  const itens = itemIds.length ? await prisma.finSemanaItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, nome: true, valor: true, prestadorId: true, prestador: { select: { id: true, nome: true, telefone: true } }, titulo: { select: { titulo: true } } } }) : [];
  const tits = titIds.length ? await prisma.finTitulo.findMany({ where: { id: { in: titIds } }, select: { id: true, titulo: true, parceiro: true, documento: true, numeroDoc: true, nf: { select: { fornecedorId: true } } } }) : [];
  const docs = [...new Set(tits.map((t) => so(t.documento)).filter((d) => d.length >= 11))];
  const cnpjs = docs.length ? await prisma.fornecedorCnpj.findMany({ where: { cnpj: { in: docs } }, select: { cnpj: true, fornecedorId: true } }) : [];
  const fornIds = [...new Set([...cnpjs.map((c) => c.fornecedorId), ...tits.map((t) => t.nf?.fornecedorId).filter(Boolean)])];
  const forns = await prisma.fornecedor.findMany({ where: { OR: [{ id: { in: fornIds } }, { nome: { in: [...new Set(tits.map((t) => t.parceiro))], mode: "insensitive" } }, { razaoSocial: { in: [...new Set(tits.map((t) => t.parceiro))], mode: "insensitive" } }] }, select: { id: true, nome: true, razaoSocial: true, telefone: true, telefones: true } });
  const prests = await prisma.prestador.findMany({ where: { OR: [{ documento: { not: null } }, { nome: { in: [...new Set(tits.map((t) => t.parceiro))], mode: "insensitive" } }] }, select: { id: true, nome: true, telefone: true, documento: true } });
  const mem = await prisma.finConfig.findMany({ where: { chave: { startsWith: MEM } } });
  const porMem = Object.fromEntries(mem.map((m) => [m.chave, m.valor]));
  const porItem = Object.fromEntries(itens.map((i) => [i.id, i]));
  const porTit = Object.fromEntries(tits.map((t) => [t.id, t]));
  const fornPorId = Object.fromEntries(forns.map((f) => [f.id, f]));
  const fornPorCnpj = Object.fromEntries(cnpjs.map((c) => [c.cnpj, fornPorId[c.fornecedorId]]));

  return envios.map((e) => {
    const c = e.dados || {};
    if (e.semanaItemId && porItem[e.semanaItemId]) {
      const it = porItem[e.semanaItemId];
      const p = it.prestador;
      const memK = `${MEM}NOME:${normRegra(it.nome)}`;
      return { nome: p?.nome || it.nome, referencia: it.titulo?.titulo || "", fone: foneWhats(p?.telefone) || porMem[memK] || null,
        destino: p ? { tipo: "PRESTADOR", id: p.id } : { tipo: "MEM", chave: memK } };
    }
    const t = porTit[e.tituloId];
    if (!t) return { nome: c.favorecido || "", referencia: "", fone: null, destino: null };
    const doc = so(t.documento);
    const pn = normRegra(t.parceiro);
    const f = (doc && fornPorCnpj[doc]) || (t.nf?.fornecedorId && fornPorId[t.nf.fornecedorId]) || forns.find((x) => normRegra(x.nome) === pn || normRegra(x.razaoSocial) === pn);
    const p = prests.find((x) => (doc && so(x.documento) === doc) || normRegra(x.nome) === pn);
    const memK = `${MEM}${doc ? `DOC:${doc}` : `NOME:${pn}`}`;
    const fone = (p && foneWhats(p.telefone)) || (f && (foneWhats(f.telefone) || foneWhats(f.telefones))) || porMem[memK] || null;
    const destino = p ? { tipo: "PRESTADOR", id: p.id } : f ? { tipo: "FORNECEDOR", id: f.id } : { tipo: "MEM", chave: memK };
    return { nome: t.parceiro, referencia: `${t.titulo}${t.numeroDoc ? ` · ${t.numeroDoc}` : ""}`, fone, destino };
  });
}

async function salvarFone(destino, fone) {
  if (!destino || !fone) return;
  if (destino.tipo === "PRESTADOR") await prisma.prestador.update({ where: { id: destino.id }, data: { telefone: foneBR(fone) } });
  else if (destino.tipo === "FORNECEDOR") await prisma.fornecedor.update({ where: { id: destino.id }, data: { telefone: foneBR(fone) } });
  else await prisma.finConfig.upsert({ where: { chave: destino.chave }, create: { chave: destino.chave, valor: fone }, update: { valor: fone } });
}

// ---------- fila ----------
const SEL_E = { id: true, nome: true, mime: true, dados: true, tituloId: true, semanaItemId: true, hashChave: true, whatsStatus: true, whatsFone: true, whatsEm: true, whatsErro: true, createdAt: true, resolvidoEm: true };

export async function filaWhats({ dias = 15, todos = false } = {}) {
  const de = new Date(Date.now() - Math.max(1, Math.min(120, Number(dias) || 15)) * 86400000);
  const es = await prisma.finComprovanteEnvio.findMany({
    where: { status: "BAIXADO", tituloId: { not: null }, createdAt: { gte: de }, ...(todos ? {} : { OR: [{ whatsStatus: null }, { whatsStatus: "ERRO" }] }) },
    orderBy: { createdAt: "desc" }, select: SEL_E,
  });
  const lista = es.filter((e) => !(e.dados || {}).propria);
  const ors = await origens(lista);
  return lista.map((e, i) => {
    const c = e.dados || {};
    return { id: e.id, valor: Number(c.valor) || 0, data: c.data || null, tipo: c.tipo || "", favorecido: c.favorecido || "", nome: ors[i].nome, referencia: ors[i].referencia,
      fone: e.whatsFone || ors[i].fone, cadastro: ors[i].destino?.tipo || null, status: e.whatsStatus || "A_ENVIAR", erro: e.whatsErro, enviadoEm: e.whatsEm, em: e.createdAt };
  });
}

export function mensagem({ nome, valor, data, referencia }) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  const ola = primeiro && !/\b(LTDA|ME|EIRELI|S\/?A|EPP)\b/i.test(nome) ? `Olá, ${primeiro.charAt(0)}${primeiro.slice(1).toLowerCase()}!` : "Olá!";
  return `${ola} Segue o comprovante do pagamento de *${brl(valor)}*${data ? ` feito em ${dBR(data)}` : ""}${referencia ? ` (${referencia})` : ""}.\n\nMeridian · Financeiro`;
}

// envia UM comprovante (a tela chama um por vez, com intervalo, e mostra o andamento)
export async function enviarWhats(id, { fone, salvar = true } = {}) {
  const e = await prisma.finComprovanteEnvio.findUnique({ where: { id: Number(id) }, select: SEL_E });
  if (!e || !e.tituloId) throw new Error("Comprovante não encontrado.");
  const [o] = await origens([e]);
  const numero = foneWhats(fone) || o.fone;
  if (!numero) throw new Error("Sem telefone. Informe o WhatsApp do favorecido.");
  const c = e.dados || {};
  const anexo = await prisma.finTituloAnexo.findFirst({ where: { tituloId: e.tituloId, hash: { in: [c.chave ? chaveHash(c.chave) : "", e.hashChave].filter(Boolean) } }, orderBy: { id: "desc" }, select: { nome: true, mime: true, conteudo: true } });
  if (!anexo?.conteudo) throw new Error("O arquivo do comprovante não está mais anexado na conta.");
  try {
    const st = await estadoWhats();
    if (st.estado !== "CONECTADO") throw new Error("WhatsApp da empresa desconectado. Conecte pelo QR code.");
    // confere o número no WhatsApp (também acerta o 9º dígito)
    let destino = numero;
    try {
      const v = await evo(`/chat/whatsappNumbers/${INST}`, "POST", { numbers: [numero] });
      const r = (Array.isArray(v) ? v : [])[0];
      if (r && r.exists === false) throw Object.assign(new Error(`O número ${foneBR(numero)} não tem WhatsApp.`), { definitivo: true });
      if (r?.jid) destino = so(String(r.jid).split("@")[0]) || numero;
    } catch (x) { if (x.definitivo) throw x; }
    const pdf = anexo.mime === "application/pdf";
    await evo(`/message/sendMedia/${INST}`, "POST", {
      number: destino, mediatype: pdf ? "document" : "image", mimetype: anexo.mime, media: anexo.conteudo,
      fileName: pdf ? (/\.pdf$/i.test(anexo.nome) ? anexo.nome : `${anexo.nome}.pdf`) : undefined,
      caption: mensagem({ nome: o.nome, valor: c.valor, data: c.data, referencia: o.referencia }),
    });
    await prisma.finComprovanteEnvio.update({ where: { id: e.id }, data: { whatsStatus: "ENVIADO", whatsFone: numero, whatsEm: new Date(), whatsErro: null } });
    if (salvar && foneWhats(fone) && foneWhats(fone) !== o.fone) { try { await salvarFone(o.destino, numero); } catch { /* o envio já foi */ } }
    return { ok: true, fone: numero };
  } catch (x) {
    await prisma.finComprovanteEnvio.update({ where: { id: e.id }, data: { whatsStatus: "ERRO", whatsFone: numero, whatsErro: String(x.message).slice(0, 300) } });
    throw x;
  }
}

export async function ignorarWhats(id, voltar = false) {
  await prisma.finComprovanteEnvio.update({ where: { id: Number(id) }, data: { whatsStatus: voltar ? null : "IGNORADO", whatsErro: null } });
  return { ok: true };
}
