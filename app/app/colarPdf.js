// v321 — Ctrl+V de PDFs: lê clipboardData.files e também clipboardData.items (alguns navegadores só preenchem um dos dois)
export function pdfsDoColar(e) {
  const cd = e.clipboardData;
  if (!cd) return { pdfs: [], outros: 0, texto: "" };
  const vistos = new Set(), lista = [];
  const add = (f) => { if (!f) return; const k = `${f.name}|${f.size}`; if (!vistos.has(k)) { vistos.add(k); lista.push(f); } };
  for (const f of cd.files || []) add(f);
  for (const it of cd.items || []) if (it.kind === "file") add(it.getAsFile());
  const pdfs = lista.filter((f) => /\.pdf$/i.test(f.name || "") || f.type === "application/pdf");
  return { pdfs, outros: lista.length - pdfs.length, texto: lista.length ? "" : (cd.getData && cd.getData("text")) || "" };
}
// liga o Ctrl+V da tela inteira; avisar(msg) é chamado quando o que foi colado não tem PDF
export function ouvirColar(enviar, avisar) {
  const fn = (e) => {
    const t = e.target;
    const { pdfs, outros, texto } = pdfsDoColar(e);
    if (pdfs.length) { e.preventDefault(); enviar(pdfs); return; }
    const emCampo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (emCampo && !outros) return;   // colando texto num campo: deixa
    if (outros) avisar?.(`Os ${outros} arquivo(s) colados não são PDF.`);
    else if (!emCampo) avisar?.(texto ? "O que foi colado é texto, não arquivo. No Explorer, selecione os PDFs, Ctrl+C, e cole aqui." : "Nenhum arquivo na área de transferência. No Explorer, selecione os PDFs, Ctrl+C, e cole aqui.");
  };
  window.addEventListener("paste", fn);
  return () => window.removeEventListener("paste", fn);
}
