// v865 — no navegador: arquivo até 8 MB vira data URL (como antes); maior sobe em partes para /api/arquivos e vira "arq:<token>"
export const GRANDE = 8 * 1024 * 1024;
export const LIMITE_MB = 2048;
const dataUrl = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
export const tokenDe = (s) => { const m = String(s || "").match(/(?:^|,)arq:([A-Za-z0-9_-]{24,64})$/); return m ? m[1] : null; };
export const urlDoArquivo = (s, baixar = true) => { const t = tokenDe(s); return t ? `/api/arquivos?t=${t}${baixar ? "&baixar=1" : ""}` : null; };

// onProgresso(0..1) opcional
export async function subirArquivo(file, uid, onProgresso, nome) {
  if (file.size <= GRANDE) return dataUrl(file);
  if (!uid) { try { uid = JSON.parse(localStorage.getItem("ce_user") || "null")?.id; } catch {} }   // v868
  const ini = await fetch("/api/arquivos", { method: "POST", headers: { "Content-Type": "application/json", "x-usuario-id": String(uid || "") }, body: JSON.stringify({ nome: nome || file.name, mime: file.type || null, tamanho: file.size }) });
  const j = await ini.json().catch(() => ({}));
  if (!ini.ok) throw new Error(j.error || "Não consegui iniciar o envio.");
  const P = j.parte || GRANDE;
  let off = 0, falhas = 0;
  while (off < file.size) {
    try {
      const r = await fetch(`/api/arquivos?t=${j.token}&off=${off}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: file.slice(off, off + P) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || `Erro ${r.status}`);
      off = x.recebido; falhas = 0;
      onProgresso && onProgresso(off / file.size);
    } catch (e) {
      if (++falhas > 4) throw new Error(`${nome || file.name}: envio interrompido (${e.message}).`);
      await new Promise((r) => setTimeout(r, 1500 * falhas));
    }
  }
  return `arq:${j.token}`;
}
