// v1028 — leitura de comprovante pelo TEXTO (sem IA): foto/print → OCR (tesseract) → texto; PDF de outro banco → texto do PDF.
// Layout "rótulo valor" dos apps de banco (Inter, Itaú, Nubank, Bradesco, Santander, Caixa, BB, Sicoob, Mercado Pago…):
// valor (R$), data, bloco de quem recebe (Nome / CPF-CNPJ), ID da transação. Pix ainda agendado/aguardando aprovação
// é marcado (nunca baixa sozinho).
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const run = promisify(execFile);
const num = (s) => { const x = Number(String(s || "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0; };
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const MES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };

// OCR da imagem (JPEG/PNG) → texto
export async function ocrImagem(buf) {
  let b = buf;
  try {
    const sharp = (await import("sharp")).default;
    const m = await sharp(buf).metadata();
    // print pequeno: aumenta; tudo em cinza e com contraste melhora o OCR
    b = await sharp(buf).rotate().resize({ width: Math.max(m.width || 0, 1400) < 1400 ? 1400 : undefined, withoutEnlargement: false }).grayscale().normalize().png().toBuffer();
  } catch { /* vai a original */ }
  const f = join(tmpdir(), `comp-${randomBytes(6).toString("hex")}.png`);
  await writeFile(f, b);
  try {
    const { stdout } = await run("tesseract", [f, "-", "-l", "por", "--psm", "4"], { maxBuffer: 8 * 1048576, timeout: 60000 });
    return stdout;
  } catch (e) {
    if (e.code === "ENOENT") throw new Error("leitor de imagem (tesseract) não instalado no servidor");
    throw e;
  } finally { unlink(f).catch(() => {}); }
}

function dataDe(s) {
  const t = sem(s).toUpperCase();
  let m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/(\d{2})\/(\d{2})\/(\d{2})(?!\d)/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/(\d{1,2})\s*(?:DE\s+)?(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\.?\s*(?:DE\s+)?(\d{4})/);
  if (m) return `${m[3]}-${String(MES[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
// documento de quem recebe: CNPJ/CPF inteiro, ou só os 6 dígitos do meio do CPF mascarado (***.186.736-**)
function docDe(s) {
  const t = String(s || "");
  const cnpj = t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (cnpj) return cnpj[0].replace(/\D/g, "");
  if (/\*/.test(t)) { const m = t.match(/(\d{3})\s*[.,]\s*(\d{3})\s*-/); if (m) return m[1] + m[2]; }
  const cpf = t.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  return cpf ? cpf[0].replace(/\D/g, "") : "";
}

const R_REC = /^(quem (vai )?receb|quem recebeu|recebedor|destinat[aá]rio|destino|favorecido|benefici[aá]rio|dados do recebedor|dados do favorecido|para quem|para$|transferido para|enviado para|pago para)/i;
const R_PAG = /^(quem (vai )?pag|quem pagou|pagador|origem|de$|dados do pagador|conta de origem|debitado de)/i;
const R_NOME = /^(nome|raz[aã]o social|nome do recebedor|nome do favorecido|nome fantasia)\b[:\s]*/i;
const R_DOC = /^(cpf\s*\/?\s*cnpj|cnpj\s*\/?\s*cpf|cpf|cnpj|documento)\b[:\s]*/i;

// texto (OCR ou PDF) → comprovante no mesmo formato do leitor do Bradesco
export function lerTextoComprovante(texto) {
  const L = String(texto || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const T = L.join("\n");
  if (!/R\$\s*[\d.]+,\d{2}/.test(T)) return null;
  const tipo = /\bpix\b/i.test(T) ? "PIX" : /boleto|c[oó]digo de barras|linha digit/i.test(T) ? "BOLETO" : /\bTED\b|\bDOC\b|transfer[eê]ncia/i.test(T) ? "TED" : /DARF|GPS|DAS\b|tributo|imposto|conv[eê]nio/i.test(T) ? "TRIBUTO" : "OUTRO";
  const agendado = /aguardando aprova|agendad|agendamento (solicitado|realizado|efetuado)|pendente de aprova|em processamento|programad/i.test(T);
  // valor: linha "Valor …" (pago/total) → senão o primeiro R$
  const lv = L.find((l) => /^valor( (pago|total|da transa[cç][aã]o|do pix|transferido|cobrado))?\b/i.test(l) && /R?\$?\s*[\d.]+,\d{2}/.test(l));
  const mv = (lv && lv.match(/([\d.]+,\d{2})/)) || T.match(/R\$\s*([\d.]+,\d{2})/);
  const valor = mv ? num(mv[1]) : 0;
  // data: rótulos conhecidos (pagamento antes de agendamento); senão a primeira data do texto
  const ROT_DATA = [/^data (do|de) pagamento/i, /^pago em/i, /^data da transa/i, /^data da transfer/i, /^data do pix/i, /^realizad[oa] em/i, /^efetuad[oa] em/i, /^data e hora/i, /^data\b/i, /^agendamento solicitado em/i, /^agendad[oa] para/i];
  let data = null;
  for (const re of ROT_DATA) {
    const i = L.findIndex((l) => re.test(sem(l)) || re.test(l));
    if (i >= 0) { data = dataDe(L[i]) || dataDe(L[i + 1]); if (data) break; }
  }
  if (!data) data = dataDe(T);
  // bloco de quem recebe: do título até o próximo bloco (pagador / transação)
  let favorecido = "", documento = "";
  const iRec = L.findIndex((l) => R_REC.test(sem(l)));
  if (iRec >= 0) {
    const fim = L.findIndex((l, k) => k > iRec && (R_PAG.test(sem(l)) || /^(sobre a transa|dados da transa|informa[cç][oõ]es adicionais|autentica)/i.test(sem(l))));
    const B = L.slice(iRec + 1, fim > iRec ? fim : iRec + 9);
    // título com o nome na mesma linha ("Para Fulano")
    const resto = L[iRec].replace(/^(quem (vai )?receb\w*|quem recebeu|recebedor|destinat[aá]rio|destino|favorecido|benefici[aá]rio|para|transferido para|enviado para|pago para)[:\s]*/i, "").trim();
    for (let k = 0; k < B.length; k++) {
      const l = B[k];
      if (!favorecido && R_NOME.test(l)) favorecido = l.replace(R_NOME, "").trim() || (B[k + 1] && !R_DOC.test(B[k + 1]) ? B[k + 1] : "");
      if (!documento && R_DOC.test(l)) documento = docDe(l.replace(R_DOC, "")) || docDe(B[k + 1]);
    }
    if (!favorecido && resto && !/\d{2}\/\d{2}/.test(resto)) favorecido = resto;
    if (!favorecido) favorecido = B.find((l) => !R_DOC.test(l) && !/^(institui|banco|ag[eê]ncia|conta|chave|tipo)/i.test(sem(l)) && /[A-Za-z]{3}/.test(l) && !/R\$/.test(l)) || "";
  }
  favorecido = favorecido.replace(/\s+[-–]\s*$/, "").trim().toUpperCase();
  const idm = T.match(/\bE\d{8}\d{12}[A-Z0-9]{11}\b/i)
    || (L.find((l) => /^(id da transa|identificador|c[oó]digo da transa|n[uú]mero de controle|autentica[cç][aã]o)/i.test(sem(l))) || "").match(/[:\s]([A-Z0-9]{10,})\s*$/i);
  const idTransacao = idm ? (idm[1] || idm[0]).toUpperCase() : "";
  const pagadorProprio = /MERIDIAN|NORT SPORTS/i.test(T);
  return { tipo, data, valor, favorecido, documento, agendado, idTransacao, pagadorProprio };
}
