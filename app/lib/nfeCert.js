// v1188 — certificado digital A1 (e-CNPJ) de cada empresa emitente, para a NF-e direto na SEFAZ.
//   O .pfx é aberto com a senha só na hora do envio; o que fica no banco é a chave e o certificado em PEM,
//   cifrados com AES-256-GCM (chave do servidor: NFE_CERT_KEY ou, sem ela, derivada do DATABASE_URL). A senha não é guardada.
//   node-forge abre .pfx antigos (RC2/3DES) que o OpenSSL 3 do Node recusa.
import crypto from "crypto";
import forge from "node-forge";
import { prisma } from "@/lib/prisma";

export const EMPRESAS_NFE = { MERIDIAN: "48011287000181", NORT: "55116246000115" };
const K = (emp) => `NFE|CERT|${emp}`;
const so = (s) => String(s || "").replace(/\D/g, "");

function chave() {
  const base = process.env.NFE_CERT_KEY || process.env.DATABASE_URL || "ce-nfe";
  return crypto.createHash("sha256").update(`nfe-cert|${base}`).digest();
}
function cifrar(txt) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(txt, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decifrar(s) {
  const [iv, tag, enc] = String(s).split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", chave(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// abre o .pfx: chave + certificado do titular (o que casa com a chave) + cadeia
export function lerPfx(b64, senha) {
  let p12;
  try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(Buffer.from(String(b64 || ""), "base64").toString("binary")), false, String(senha ?? "")); }
  catch (e) { throw new Error(/MAC|password|Invalid/i.test(e.message) ? "Senha do certificado inválida." : `Não consegui abrir o certificado (${e.message}).`); }
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map((x) => x.cert).filter(Boolean);
  const kb = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]
    || (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
  if (!kb?.key) throw new Error("O arquivo não tem a chave privada (precisa ser o certificado A1 completo, .pfx).");
  const titular = certs.find((c) => c.publicKey?.n && c.publicKey.n.equals(kb.key.n)) || certs[0];
  if (!titular) throw new Error("O arquivo não tem o certificado.");
  const cn = titular.subject.getField("CN")?.value || "";
  const cadeia = certs.filter((c) => c !== titular).map((c) => forge.pki.certificateToPem(c));
  return {
    keyPem: forge.pki.privateKeyToPem(kb.key), certPem: forge.pki.certificateToPem(titular), cadeia,
    cn, cnpj: so(cn.split(":").pop()).slice(-14), de: titular.validity.notBefore.toISOString(), ate: titular.validity.notAfter.toISOString(),
    emissor: titular.issuer.getField("CN")?.value || "",
  };
}

export async function salvarCertificado(emp, b64, senha, quem) {
  if (!EMPRESAS_NFE[emp]) return { error: "Empresa inválida." };
  const c = lerPfx(b64, senha);
  if (c.cnpj && c.cnpj !== EMPRESAS_NFE[emp]) return { error: `Este certificado é do CNPJ ${c.cnpj} (${c.cn}), não da ${emp}.` };
  if (new Date(c.ate) < new Date()) return { error: `Certificado vencido em ${c.ate.slice(0, 10).split("-").reverse().join("/")}.` };
  const meta = { cn: c.cn, cnpj: c.cnpj, de: c.de, ate: c.ate, emissor: c.emissor, enviadoEm: new Date().toISOString(), enviadoPor: quem || null };
  const valor = JSON.stringify({ meta, segredo: cifrar(JSON.stringify({ keyPem: c.keyPem, certPem: c.certPem, cadeia: c.cadeia })) });
  await prisma.finConfig.upsert({ where: { chave: K(emp) }, create: { chave: K(emp), valor }, update: { valor } });
  return { ok: true, certificado: meta };
}

export async function infoCertificados() {
  const out = {};
  for (const emp of Object.keys(EMPRESAS_NFE)) {
    const r = await prisma.finConfig.findUnique({ where: { chave: K(emp) } }).catch(() => null);
    try { const m = JSON.parse(r?.valor || "null")?.meta || null; out[emp] = m ? { ...m, dias: Math.floor((new Date(m.ate) - Date.now()) / 86400000) } : null; } catch { out[emp] = null; }
  }
  return out;
}

// chave e certificado em PEM para o TLS mútuo com a SEFAZ e para assinar o XML
export async function certificado(emp) {
  const r = await prisma.finConfig.findUnique({ where: { chave: K(emp) } }).catch(() => null);
  if (!r?.valor) throw new Error(`Certificado digital da ${emp} não cadastrado (Dados › Tributário › Emitente).`);
  const { meta, segredo } = JSON.parse(r.valor);
  if (new Date(meta.ate) < new Date()) throw new Error(`Certificado da ${emp} vencido.`);
  return { ...JSON.parse(decifrar(segredo)), meta };
}

export async function excluirCertificado(emp) {
  await prisma.finConfig.delete({ where: { chave: K(emp) } }).catch(() => null);
  return { ok: true };
}
