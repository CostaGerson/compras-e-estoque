"use client";
// v1080 — sugestão #102 (Maycon): botões "Ver OC" (rota de coleta da OC) e "Ver OS" (rota de facção aberta pelo PCP).
// OC: dados atuais do ERP desenhados em imagem (mesmo desenho da v1060), em tela cheia.
// OS: PDF do PCP, sem preços, aberto numa nova aba pelo proxy /api/rotas?osDemanda= (o token do PCP fica no servidor).
import React, { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

export const osDe = (d) => (d?.origem === "PCP" ? String(d.origemDados?.osPcp ?? d.origemRef ?? "").trim() || null : null);
export const temDocs = (d) => !!(d?.ocId || osDe(d));
const cap = (s) => String(s || "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
export const rotuloOs = (d) => [`OS ${osDe(d)}`, d.origemDados?.servico ? cap(d.origemDados.servico) : null, d.destinoNome ? cap(d.destinoNome) : null].filter(Boolean).join(" · ");

const ESTILO = {
  grande: { className: "w-full rounded-xl px-4 py-3 text-lg font-extrabold flex items-center justify-center gap-2", style: { background: "#0c2342", color: "#fff", minHeight: 52 } },
  normal: { className: "text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1.5", style: { border: "1px solid #0c2342", color: "#0c2342", background: "#fff" } },
  mini: { className: "text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shrink-0", style: { background: "#0c2342", color: "#fff" } },
  escuro: { className: "text-[11px] px-2 py-1 rounded font-semibold flex items-center gap-1 shrink-0", style: { background: "#fff", color: "#0c2342" } },
};

export default function DocsDemanda({ user, d, estilo = "normal" }) {
  const [img, setImg] = useState(null);
  const [oc, setOc] = useState(false);
  const [erro, setErro] = useState("");
  const os = osDe(d);
  if (!d?.id || (!d.ocId && !os)) return null;
  const e = ESTILO[estilo] || ESTILO.normal;
  const grande = estilo === "grande";
  const ico = grande ? null : <FileText size={estilo === "mini" ? 10 : 13} />;

  const verOc = async (ev) => {
    ev.stopPropagation(); setErro(""); setOc(true);
    try {
      const r = await fetch(`/api/rotas?u=${user.id}&ocDemanda=${d.id}`, { cache: "no-store" });
      const x = await r.json().catch(() => ({}));
      if (!r.ok || !x.oc) throw new Error(x.error || "Não deu para carregar a OC.");
      const { desenharOc } = await import("./ocImagem");
      const cv = await desenharOc(x.oc);
      setImg({ src: cv.toDataURL("image/png"), nome: `${x.oc.numero} · ${x.oc.fornecedor?.nome || ""}` });
    } catch (err) { setErro(err.message); }
    setOc(false);
  };
  const verOs = (ev) => {
    ev.stopPropagation();
    const url = `/api/rotas?u=${user.id}&osDemanda=${d.id}`;
    const w = window.open("", "_blank");
    if (!w) { window.location.href = url; return; }
    try { w.document.write(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;padding:32px;color:#0c2342">Carregando OS ${os}…</body>`); } catch {}
    w.location.href = url;
  };

  return (
    <>
      {d.ocId && (
        <button type="button" onClick={verOc} disabled={oc} title="Ver a OC desta coleta (dados atuais)" className={e.className} style={e.style}>
          {oc ? <Loader2 size={grande ? 18 : 12} className="animate-spin" /> : grande ? "🧾" : ico} {oc ? "Carregando OC…" : "Ver OC"}
        </button>
      )}
      {os && (
        <button type="button" onClick={verOs} title={`${rotuloOs(d)} — itens, grade e fichas, sem preços`} className={e.className} style={e.style}>
          {grande ? "📋" : ico} Ver OS{estilo === "mini" ? ` ${os}` : ""}
          {estilo !== "mini" && <span className="font-normal opacity-80 truncate">{grande ? ` · ${rotuloOs(d).replace(/^OS /, "")}` : ` · ${rotuloOs(d)}`}</span>}
        </button>
      )}
      {erro && <span className="text-xs" style={{ color: "#D92D20" }} onClick={(ev) => ev.stopPropagation()}>{erro}</span>}
      {img && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "rgba(0,0,0,.92)" }} onClick={(ev) => { ev.stopPropagation(); setImg(null); }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ color: "#fff" }}>
            <div className="flex-1 font-bold truncate">{img.nome}</div>
            <button type="button" onClick={(ev) => { ev.stopPropagation(); setImg(null); }} className="text-3xl leading-none px-2" aria-label="Fechar">×</button>
          </div>
          <div className="flex-1 overflow-auto flex justify-center" onClick={(ev) => ev.stopPropagation()} style={{ touchAction: "pinch-zoom" }}>
            <img src={img.src} alt={img.nome} className="w-full h-auto" style={{ background: "#fff", maxWidth: 900, alignSelf: "flex-start" }} />
          </div>
        </div>
      )}
    </>
  );
}
