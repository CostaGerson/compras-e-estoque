// Backup diário: um ZIP só (meridian-backup.zip), substituído a cada dia.
//   dados/<Tabela>.json   → todas as tabelas do banco (sem os arquivos em base64)
//   arquivos/<Tabela>/... → cada arquivo enviado ao sistema, já no formato original (PDF, XML, XLSX, RET…)
//   uploads.csv           → a lista da guia Uploads (nome no sistema, nome original, data, quem enviou)
// Fica em /app/backup (pasta backup/ do projeto na VPS) — fora do volume do banco.
import fs from "fs";
import path from "path";
import { Zip, ZipDeflate } from "fflate";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listarUploads, bufDe } from "@/lib/uploads";

export const DIR = process.env.BACKUP_DIR || "/app/backup";
export const ARQ = path.join(DIR, "meridian-backup.zip");
const META = path.join(DIR, "meridian-backup.json");
const GRANDES = new Set(["conteudo", "arquivoPdf", "arquivoXml", "arquivoOrigem", "arquivoPcPdf", "arquivoLancPdf", "arquivoPedidoPdf", "fotoBase64", "foto", "xml", "pdf"]);   // xml/pdf: movimento fiscal (v158)
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const limpa = (s) => String(s || "").replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
const enc = new TextEncoder();

let rodando = null;              // promessa do backup em andamento
let ultimoErro = null;

export function infoBackup() {
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(META, "utf8")); } catch { /* ainda não há backup */ }
  let tamanho = 0;
  try { tamanho = fs.statSync(ARQ).size; } catch { meta = null; }
  return { existe: !!meta, ...(meta || {}), tamanho, gerando: !!rodando, erro: ultimoErro, hoje: hojeSP() };
}

function zipEm(arquivo) {
  const fd = fs.openSync(arquivo, "w");
  let fim, falha;
  const pronto = new Promise((ok, ko) => { fim = ok; falha = ko; });
  const zip = new Zip((e, chunk, final) => {
    if (e) return falha(e);
    if (chunk?.length) fs.writeSync(fd, chunk);
    if (final) { fs.closeSync(fd); fim(); }
  });
  const add = (nome, dados, nivel = 6) => {
    const f = new ZipDeflate(nome, { level: nivel });
    zip.add(f);
    f.push(typeof dados === "string" ? enc.encode(dados) : new Uint8Array(dados), true);
  };
  // arquivo em pedaços (tabelas grandes)
  const aberto = (nome) => { const f = new ZipDeflate(nome, { level: 6 }); zip.add(f); return { push: (s) => f.push(enc.encode(s), false), fim: (s = "") => f.push(enc.encode(s), true) }; };
  return { add, aberto, terminar: async () => { zip.end(); await pronto; } };
}

const delegado = (m) => prisma[m.name[0].toLowerCase() + m.name.slice(1)];

export async function gerarBackup({ quem } = {}) {
  if (rodando) return rodando;
  rodando = (async () => {
    const ini = Date.now();
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = ARQ + ".tmp";
    const z = zipEm(tmp);
    const contagem = {};
    let nArquivos = 0;
    try {
      const modelos = Prisma.dmmf.datamodel.models;
      for (const m of modelos) {
        const d = delegado(m);
        if (!d) continue;
        const escalares = m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
        const grandes = escalares.filter((f) => f.type === "String" && GRANDES.has(f.name)).map((f) => f.name);
        const select = Object.fromEntries(escalares.filter((f) => !grandes.includes(f.name)).map((f) => [f.name, true]));
        const temId = escalares.some((f) => f.name === "id" && f.type === "Int");
        const out = z.aberto(`dados/${m.name}.json`);
        out.push("[");
        let n = 0;
        for (let skip = 0; ; skip += 500) {
          const lote = await d.findMany({ select, ...(temId ? { orderBy: { id: "asc" }, skip, take: 500 } : {}) });
          for (const row of lote) {
            if (grandes.length && temId) {
              const big = await d.findUnique({ where: { id: row.id }, select: Object.fromEntries(grandes.map((g) => [g, true])) });
              const arqs = {};
              for (const g of grandes) {
                if (!big?.[g]) continue;
                const nomeBase = limpa(row.nome || row.arquivo || row.numero || row.titulo || "") || g;
                const ext = /\.[a-z0-9]{2,4}$/i.test(nomeBase) ? "" : g.toLowerCase().includes("xml") ? ".xml" : /pdf/i.test(g) ? ".pdf" : "";
                const p = `arquivos/${m.name}/${row.id}-${g}-${nomeBase}${ext}`;
                z.add(p, bufDe(big[g]), 1);
                arqs[g] = p; nArquivos++;
              }
              if (Object.keys(arqs).length) row.__arquivos = arqs;
            }
            out.push((n ? ",\n" : "\n") + JSON.stringify(row));
            n++;
          }
          if (lote.length < 500 || !temId) break;
        }
        out.fim("\n]\n");
        contagem[m.name] = n;
      }
      // índice legível dos uploads
      const ups = await listarUploads().catch(() => []);
      const csv = ["DATA;NOME NO SISTEMA;NOME ORIGINAL;ORIGEM;ENVIADO POR"]
        .concat(ups.map((u) => [u.data.slice(0, 19).replace("T", " "), u.nomeSistema, u.nomeOriginal, u.origemNome, u.usuario || ""].map((v) => `"${String(v || "").replace(/"/g, "'")}"`).join(";")));
      z.add("uploads.csv", "\uFEFF" + csv.join("\r\n"));
      z.add("LEIA-ME.txt", [
        "BACKUP DO SISTEMA COMPRAS & ESTOQUE (MERIDIAN)",
        `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${quem ? ` por ${quem}` : " (automático)"}.`,
        "",
        "dados/      todas as tabelas do banco em JSON (uma por arquivo).",
        "arquivos/   os documentos enviados, no formato original. O campo __arquivos de cada linha aponta o arquivo.",
        "uploads.csv lista de documentos como aparece na guia Dados > Uploads.",
      ].join("\r\n"));
      await z.terminar();
      fs.renameSync(tmp, ARQ);                     // substitui o de ontem
      const meta = { data: hojeSP(), geradoEm: new Date().toISOString(), por: quem || "AUTOMÁTICO", tabelas: Object.keys(contagem).length,
        registros: Object.values(contagem).reduce((a, b) => a + b, 0), arquivos: nArquivos, segundos: Math.round((Date.now() - ini) / 1000) };
      fs.writeFileSync(META, JSON.stringify(meta));
      ultimoErro = null;
      return meta;
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* nada */ }
      ultimoErro = e.message || String(e);
      throw e;
    }
  })();
  try { return await rodando; } finally { rodando = null; }
}

// roda uma vez por dia (horário de Brasília): confere a cada 30 min se o backup de hoje já existe
export function agendarBackup() {
  if (globalThis.__backupAgendado) return;
  globalThis.__backupAgendado = true;
  const checar = () => {
    const i = infoBackup();
    if (i.gerando || (i.existe && i.data === hojeSP())) return;
    gerarBackup().catch((e) => console.error("[backup]", e.message));
  };
  setTimeout(checar, 3 * 60 * 1000);
  setInterval(checar, 30 * 60 * 1000);
}
