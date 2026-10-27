// v521 — cadastro de clientes do KM (MentorSoft, tabela solclien) → Cliente
// · o agente do PC (tools/km/km-sync.ps1) manda TODAS as linhas de solclien (colunas de texto/número/data, sem binários)
//   de hora em hora ou quando alguém pede pela tela Clientes (botão "Buscar do KM")
// · as colunas são reconhecidas pelo nome (cnomeclien, cnfantaclien, ccnpjclien, ...) — a linha crua fica em kmDados
// · casamento: kmId → CNPJ/CPF → código do KM; cliente sem mudança desde o último envio é ignorado (kmHash)
// · KM só PREENCHE o que está vazio aqui; o que foi editado no sistema não é sobrescrito (exceto nome/fantasia vazios)
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const K_PEDIDO = "KM_CLIENTES_PEDIDO";   // pedido feito pela tela (o agente busca na próxima rodada)
export const K_STATUS = "KM_CLIENTES_SYNC";     // resultado da última busca

const limpa = (v) => (v == null ? null : String(v).replace(/\s+/g, " ").trim() || null);
const dig = (v) => String(v ?? "").replace(/\D/g, "");
const up = (v) => { const s = limpa(v); return s ? s.toUpperCase() : null; };

// campos de cobrança/entrega não entram no endereço principal
const secundario = (k) => /cob|entr/.test(k) || /ent(clien)?$/.test(k);
const ehId = (k) => /^n(numero|id)clien$/.test(k) || k === "id" || k === "nnumeroclien";

const REGRAS = [
  ["razaoSocial", (k) => /^c?nome(clien)?$|^razao|^nome_?cliente$|^cliente$/.test(k)],
  ["nomeFantasia", (k) => /fanta/.test(k)],
  ["codigo", (k) => /^c?codigo(clien)?$|^codigo_?cliente$/.test(k)],
  ["cnpj", (k) => /cnpj/.test(k) && !secundario(k)],
  ["cpf", (k) => /cpf/.test(k) && !secundario(k)],
  ["inscricaoEstadual", (k) => (/inscr|insc_?est|^c?ie(clien)?$|^c?rg(clien)?$/.test(k)) && !/munic|suframa/.test(k) && !secundario(k)],
  ["logradouro", (k) => /ender|lograd|^c?rua/.test(k) && !/num|compl|bairr|cid|cep|mail/.test(k) && !secundario(k)],
  ["numero", (k) => /^c(num|nro|numer)[a-z]*$/.test(k) && !ehId(k) && !/pedid|nf/.test(k) && !secundario(k)],
  ["complemento", (k) => /compl/.test(k) && !secundario(k)],
  ["bairro", (k) => /bairr/.test(k) && !secundario(k)],
  ["municipio", (k) => /cidad|munic/.test(k) && !/cod|ibge|^n/.test(k) && !secundario(k)],
  ["uf", (k) => /^c?(uf|estad|est)(clien)?$|^uf$|^estado$|^c?uf[a-z]*clien$/.test(k) && !secundario(k)],
  ["cep", (k) => /cep/.test(k) && !secundario(k)],
  ["telefones", (k) => /fone|tel|celul|whats/.test(k) && !/cob/.test(k)],
  ["email", (k) => /mail/.test(k)],
  ["preposto", (k) => /contat|preposto/.test(k) && !/fone|tel|mail/.test(k)],
];

// linha crua de solclien → campos do Cliente
export function mapearClienteKm(row) {
  const r = {};
  const keys = Object.keys(row || {});
  const vals = {};
  for (const [campo, ok] of REGRAS) {
    const achados = keys.filter((k) => ok(k.toLowerCase())).map((k) => limpa(row[k])).filter(Boolean);
    if (achados.length) vals[campo] = achados;
  }
  const um = (c) => (vals[c] || [])[0] || null;
  const id = keys.find((k) => ehId(k.toLowerCase()));
  r.kmId = id != null && Number.isFinite(Number(row[id])) ? Number(row[id]) : null;
  r.kmCodigo = um("codigo");
  r.razaoSocial = up(um("razaoSocial"));
  r.nomeFantasia = up(um("nomeFantasia"));
  const cnpj = dig(um("cnpj")), cpf = dig(um("cpf"));
  r.cnpj = (cnpj.length >= 11 && !/^0+$/.test(cnpj) ? cnpj : null) || (cpf.length >= 11 && !/^0+$/.test(cpf) ? cpf : null);
  r.inscricaoEstadual = up(um("inscricaoEstadual"));
  r.logradouro = up(um("logradouro"));
  r.numero = up(um("numero"));
  r.complemento = up(um("complemento"));
  r.bairro = up(um("bairro"));
  const mun = um("municipio");
  r.municipio = mun && !/^\d+$/.test(mun) ? up(mun) : null;
  const uf = (vals.uf || []).map((x) => x.toUpperCase()).find((x) => /^[A-Z]{2}$/.test(x));
  r.uf = uf || null;
  const cep = dig(um("cep"));
  r.cep = cep.length === 8 ? cep : null;
  const tels = [...new Set((vals.telefones || []).filter((x) => dig(x).length >= 8))];
  r.telefones = tels.length ? tels.slice(0, 3).join(" / ") : null;
  const mails = [...new Set((vals.email || []).flatMap((x) => x.split(/[;,\s]+/)).map((x) => x.toLowerCase()).filter((x) => /@/.test(x)))];
  r.emailNf = mails.length ? mails.slice(0, 3).join("; ") : null;
  r.preposto = up(um("preposto"));
  return r;
}

const CAMPOS = ["nomeFantasia", "inscricaoEstadual", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "cep", "telefones", "emailNf", "preposto"];
const vazio = (v) => v == null || String(v).trim() === "";
const hashDe = (o) => createHash("sha256").update("v521|" + JSON.stringify(o)).digest("hex");

export async function sincronizarClientesKm(linhas, { previa = false } = {}) {
  const lista = (Array.isArray(linhas) ? linhas : []).filter((x) => x && typeof x === "object");
  const res = { recebidos: lista.length, novos: 0, atualizados: 0, iguais: 0, semNome: 0, erros: [] };
  if (previa) {
    res.amostra = lista.slice(0, 15).map((row) => ({ km: row, mapeado: mapearClienteKm(row) }));
    res.colunas = [...new Set(lista.flatMap((x) => Object.keys(x)))];
    return res;
  }
  const todos = await prisma.cliente.findMany({ select: { id: true, kmId: true, kmCodigo: true, cnpj: true, kmHash: true, razaoSocial: true, ...Object.fromEntries(CAMPOS.map((c) => [c, true])) } });
  const porKmId = new Map(), porCnpj = new Map(), porCod = new Map();
  for (const c of todos) {
    if (c.kmId != null) porKmId.set(c.kmId, c);
    if (c.cnpj) porCnpj.set(c.cnpj, c);
    if (c.kmCodigo) porCod.set(c.kmCodigo, c);
  }
  const agora = new Date();
  for (const row of lista) {
    try {
      const m = mapearClienteKm(row);
      if (!m.razaoSocial && !m.nomeFantasia) { res.semNome++; continue; }
      const h = hashDe(row);
      const at = (m.kmId != null && porKmId.get(m.kmId)) || (m.cnpj && porCnpj.get(m.cnpj)) || (m.kmCodigo && porCod.get(m.kmCodigo)) || null;
      if (at && at.kmHash === h) { res.iguais++; continue; }
      const km = { kmCodigo: m.kmCodigo, kmDados: row, kmHash: h, kmSyncEm: agora };
      if (m.kmId != null && (!at || at.kmId == null || at.kmId === m.kmId) && !(porKmId.get(m.kmId) && porKmId.get(m.kmId) !== at)) km.kmId = m.kmId;
      if (!at) {
        const data = { razaoSocial: m.razaoSocial || m.nomeFantasia, cnpj: m.cnpj && !porCnpj.has(m.cnpj) ? m.cnpj : null, ...km };
        for (const c of CAMPOS) if (!vazio(m[c])) data[c] = m[c];
        const novo = await prisma.cliente.create({ data, select: { id: true, kmId: true, kmCodigo: true, cnpj: true } });
        if (novo.kmId != null) porKmId.set(novo.kmId, { ...novo, kmHash: h });
        if (novo.cnpj) porCnpj.set(novo.cnpj, { ...novo, kmHash: h });
        if (novo.kmCodigo) porCod.set(novo.kmCodigo, { ...novo, kmHash: h });
        res.novos++;
      } else {
        const data = { ...km };
        if (vazio(at.razaoSocial) && m.razaoSocial) data.razaoSocial = m.razaoSocial;
        if (!at.cnpj && m.cnpj && !porCnpj.has(m.cnpj)) { data.cnpj = m.cnpj; porCnpj.set(m.cnpj, at); }
        for (const c of CAMPOS) if (vazio(at[c]) && !vazio(m[c])) data[c] = m[c];
        await prisma.cliente.update({ where: { id: at.id }, data });
        at.kmHash = h;
        if (data.kmId != null) porKmId.set(data.kmId, at);
        res.atualizados++;
      }
    } catch (e) {
      if (res.erros.length < 20) res.erros.push(`${limpa(row?.cnomeclien) || "?"}: ${String(e.message).slice(0, 160)}`);
    }
  }
  await prisma.finConfig.upsert({ where: { chave: K_STATUS }, update: { valor: JSON.stringify({ em: agora.toISOString(), ...res }) },
    create: { chave: K_STATUS, valor: JSON.stringify({ em: agora.toISOString(), ...res }) } });
  await prisma.finConfig.deleteMany({ where: { chave: K_PEDIDO } });
  return res;
}
