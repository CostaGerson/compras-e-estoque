// v919 — prévia leve de imagem grande (ex.: layout PNG de 24.000 × 24.000 px que o navegador não consegue abrir).
//   Gera uma versão de até 2.000 px (WebP) e guarda em disco para as próximas vezes. O original continua para baixar.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DIR } from "./arquivos";

export const precisaPrevia = (mime, nome, tamanho) => /^image\/(png|jpe?g|webp|tiff|gif|bmp)/i.test(String(mime || "")) || /\.(png|jpe?g|webp|tiff?|bmp)$/i.test(String(nome || ""))
  ? (Number(tamanho) || 0) > 1.5 * 1024 * 1024 : false;

export async function previa(chave, lerBytes, max = 2000) {
  const arq = path.join(DIR, `prev-${crypto.createHash("sha1").update(String(chave)).digest("hex")}.webp`);
  try { return await fs.readFile(arq); } catch {}
  const sharp = (await import("sharp")).default;
  const buf = Buffer.from(await lerBytes());
  const out = await sharp(buf, { limitInputPixels: false, sequentialRead: true })
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  await fs.mkdir(DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(arq, out).catch(() => {});
  return out;
}
