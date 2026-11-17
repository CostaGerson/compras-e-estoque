"use client";
// v205 — Cobrança das contas a receber atrasadas
//  · CardCobrancaModal: card em PNG (um por cliente) com os títulos em aberto, NF, emissão, vencimento, atraso, valor e período em aberto
//  · EmailCobrancaModal: rascunho do e-mail de cobrança por cliente (envio pelo Resend fica para depois: hoje copia ou abre no e-mail)
import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Download, Copy, Mail, X, Image as ImageIcon, Send, CheckCircle2, FileDown } from "lucide-react";
import { alerta } from "./dialogo";   // v424 — popups do sistema

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", bg: "#F5F6F8", yellow: "#C08401", yellowSoft: "#FFF6DD",
};
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDoc = (d) => { const s = String(d || "").replace(/\D/g, ""); return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : s.length === 11 ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : s; };
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

// NF de referência: "NF 1991", "NF 1793-2/2", "NF-e 123 · PARC 1"
export function nfDe(t) {
  const a = String(t.titulo || "").match(/\bNF[\s-]*(?:E\s*)?(\d+)(?:\s*-\s*(\d+\/\d+))?/i);
  if (a) return `NF ${a[1]}${a[2] ? ` · parc. ${a[2]}` : ""}`;
  const b = String(t.numeroDoc || "").match(/\bNFS?-?e?\s*(\d+)(?:.*PARC\s*(\S+))?/i);
  if (b) return `NF ${b[1]}${b[2] ? ` · parc. ${b[2]}` : ""}`;
  return t.numeroDoc || "—";
}
// contas → grupos por cliente (CNPJ, senão nome)
export function porCliente(contas) {
  const g = {};
  for (const t of contas) {
    const k = String(t.documento || "").replace(/\D/g, "") || String(t.parceiro || "").toUpperCase();
    (g[k] ||= { chave: k, cliente: t.parceiro, documento: t.documento, contato: t.contato || null, contas: [] }).contas.push(t);
  }
  return Object.values(g).map((x) => {
    const cs = [...x.contas].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    return { ...x, contas: cs, total: cs.reduce((s, t) => s + Number(t.valor || 0), 0), de: cs[0]?.vencimento, ate: cs[cs.length - 1]?.vencimento,
      maiorAtraso: Math.max(...cs.map((t) => Number(t.diasAtraso || 0))) };
  }).sort((a, b) => b.total - a.total);
}

// ---------------- card PNG ----------------
const MSG_PADRAO = "Identificamos os títulos abaixo em aberto. Pedimos a gentileza de regularizar o pagamento. Caso já tenha pago, desconsidere este aviso e nos envie o comprovante.";
function carregarImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
function cortar(ctx, txt, max) {
  let s = String(txt || "");
  if (ctx.measureText(s).width <= max) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}
function quebrar(ctx, txt, max) {
  const out = []; let l = "";
  for (const w of String(txt || "").split(/\s+/)) {
    const t = l ? `${l} ${w}` : w;
    if (ctx.measureText(t).width > max && l) { out.push(l); l = w; } else l = t;
  }
  if (l) out.push(l);
  return out;
}
// v904 — card no manual de marca Meridian (jan/2026): Oxford Blue #0C2342, Steel Blue #3D6799, Branco Gelo #F1F6FE,
//   apoio Azul Cinzento #3E5066 e Azure #3B82F6, toque de Laranja Vibrante #EE6500; Montserrat ExtraBold (títulos),
//   Regular (texto) e Light (legendas); logo claro sobre o Oxford; blocos quadrados da marca como grafismo
const MB = { ox: "#0C2342", steel: "#3D6799", gelo: "#F1F6FE", cinz: "#3E5066", azure: "#3B82F6", lar: "#EE6500", linha: "#DCE5F2" };
export async function desenharCard(g, { mensagem = MSG_PADRAO, contato = "" } = {}) {
  try { await document.fonts?.ready; await Promise.all(["300", "400", "600", "700", "800"].map((w) => document.fonts?.load?.(`${w} 20px Montserrat`))); } catch { /* segue */ }
  const F = "Montserrat, Arial, sans-serif";
  const W = 1080, P = 72, linhaH = 54;
  const logo = (await carregarImg("/meridian-logo.svg")) || (await carregarImg("/meridian-logo.png"));
  const cv = document.createElement("canvas");
  const ctx0 = cv.getContext("2d");
  ctx0.font = `400 22px ${F}`;
  const msgL = quebrar(ctx0, mensagem, W - 2 * P);
  const contL = contato ? quebrar(ctx0, contato, W - 2 * P) : [];
  const H = 130 + 64 + 40 + 36 + msgL.length * 34 + 44 + 130 + 54 + 60 + g.contas.length * linhaH + 76 + (contL.length ? 64 + contL.length * 32 : 0) + 30 + 96;
  const esc = 2;
  cv.width = W * esc; cv.height = H * esc;
  const ctx = cv.getContext("2d");
  ctx.scale(esc, esc);
  const ret = (x, y, w, h, cor) => { ctx.fillStyle = cor; ctx.fillRect(x, y, w, h); };
  const txt = (t, x, y, { peso = 400, tam = 20, cor = MB.cinz, al = "left", esp = 0 } = {}) => {
    ctx.font = `${peso} ${tam}px ${F}`; ctx.fillStyle = cor; ctx.textAlign = al;
    try { ctx.letterSpacing = `${esp}px`; } catch { /* sem suporte */ }
    ctx.fillText(t, x, y);
    try { ctx.letterSpacing = "0px"; } catch { /* sem suporte */ }
  };
  // blocos quadrados (grafismo do manual)
  const blocos = (x0, y0, q, gap, mapa) => mapa.forEach((l, i) => [...l].forEach((c, j) => {
    const cor = { o: MB.ox, s: MB.steel, a: MB.azure, l: MB.lar, c: MB.cinz, g: "#24406A" }[c]; if (!cor) return;
    ctx.fillStyle = cor; const r = 4; const x = x0 + j * (q + gap), y = y0 + i * (q + gap);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + q, y, x + q, y + q, r); ctx.arcTo(x + q, y + q, x, y + q, r); ctx.arcTo(x, y + q, x, y, r); ctx.arcTo(x, y, x + q, y, r); ctx.fill();
  }));
  ret(0, 0, W, H, "#FFFFFF");
  // cabeçalho Oxford com logo claro
  // v905 — cabeçalho baixo: logo à esquerda, título e data à direita (sem os blocos)
  ret(0, 0, W, 130, MB.ox);
  if (logo) { const h = 40, w = (logo.width / logo.height) * h; ctx.drawImage(logo, P, 45, Math.min(w, 260), h); }
  else txt("MERIDIAN", P, 80, { peso: 800, tam: 34, cor: MB.gelo });
  txt("AVISO DE TÍTULOS EM ABERTO", W - P, 64, { peso: 700, tam: 17, cor: MB.gelo, al: "right", esp: 2 });
  txt(`Belo Horizonte, ${dBR(hojeISO())}`, W - P, 92, { peso: 300, tam: 16, cor: "#AFC3E0", al: "right" });
  let y = 130 + 64;
  // cliente e mensagem
  txt(cortar((ctx.font = `800 32px ${F}`, ctx), g.cliente, W - 2 * P), P, y, { peso: 800, tam: 32, cor: MB.ox });
  if (g.documento) { y += 36; txt(`CNPJ/CPF ${fmtDoc(g.documento)}`, P, y, { peso: 400, tam: 19, cor: MB.steel }); }
  y += 52;
  for (const l of msgL) { txt(l, P, y, { peso: 400, tam: 22, cor: MB.cinz }); y += 34; }
  y += 26;
  // resumo sobre Branco Gelo
  ret(P, y, W - 2 * P, 112, MB.gelo);
  ret(P, y, 6, 112, MB.ox);
  const cols3 = [["TOTAL EM ABERTO", moeda(g.total)], ["PERÍODO", g.de === g.ate ? dBR(g.de) : `${dBR(g.de)} a ${dBR(g.ate)}`], ["TÍTULOS · MAIOR ATRASO", `${g.contas.length} · ${g.maiorAtraso} dia(s)`]];
  const cw = (W - 2 * P) / 3;
  cols3.forEach(([r, v], i) => {
    const x = P + i * cw + 30;
    if (i) ret(P + i * cw, y + 24, 1, 64, "#C9D6EA");
    txt(r, x, y + 44, { peso: 600, tam: 14, cor: MB.steel, esp: 1.5 });
    ctx.font = `800 ${v.length > 22 ? 20 : 25}px ${F}`;
    txt(cortar(ctx, v, cw - 44), x, y + 82, { peso: 800, tam: v.length > 22 ? 20 : 25, cor: MB.ox });
  });
  y += 112 + 54;
  // tabela
  const cols = [["NF / TÍTULO", P, "left"], ["EMISSÃO", P + 400, "left"], ["VENCIMENTO", P + 560, "left"], ["ATRASO", P + 790, "right"], ["VALOR", W - P, "right"]];
  for (const [t, x, al] of cols) txt(t, x, y, { peso: 600, tam: 14, cor: MB.steel, al, esp: 1.5 });
  y += 16; ret(P, y, W - 2 * P, 2, MB.ox);
  g.contas.forEach((t) => {
    const yy = y + 36;
    ctx.font = `700 20px ${F}`;
    txt(cortar(ctx, nfDe(t), 380), cols[0][1], yy, { peso: 700, tam: 20, cor: MB.ox });
    txt(dBR(t.emissao), cols[1][1], yy, { tam: 20 });
    txt(dBR(t.vencimento), cols[2][1], yy, { tam: 20 });
    txt(`${t.diasAtraso || 0} dia(s)`, cols[3][1], yy, { tam: 20, al: "right" });
    txt(moeda(t.valor), cols[4][1], yy, { peso: 700, tam: 20, cor: MB.ox, al: "right" });
    y += linhaH; ret(P, y, W - 2 * P, 1, MB.linha);
  });
  // total com o toque de laranja
  y += 14;
  ret(P, y, W - 2 * P, 62, MB.gelo);
  txt("TOTAL EM ABERTO", P + 24, y + 40, { peso: 800, tam: 18, cor: MB.ox, esp: 1.5 });
  txt(moeda(g.total), W - P - 24, y + 41, { peso: 800, tam: 24, cor: MB.lar, al: "right" });
  y += 62;
  if (contL.length) {
    y += 56;
    txt("CONTATO E PAGAMENTO", P, y, { peso: 600, tam: 14, cor: MB.steel, esp: 1.5 }); y += 34;
    contL.forEach((l) => { txt(l, P, y, { tam: 21, cor: MB.cinz }); y += 32; });
  }
  // rodapé Oxford
  ret(0, H - 96, W, 96, MB.ox);
  ret(0, H - 96, W, 4, MB.steel);
  txt("Valores sem juros e multa por atraso. Caso o pagamento já tenha sido feito, desconsidere este aviso.", P, H - 52, { peso: 300, tam: 16, cor: MB.gelo });
  txt("meridianpro.com.br", W - P, H - 26, { peso: 600, tam: 15, cor: "#AFC3E0", al: "right" });
  txt("Meridian Ltda · CNPJ 48.011.287/0001-81", P, H - 26, { peso: 300, tam: 15, cor: "#AFC3E0" });
  ctx.textAlign = "left";
  return cv.toDataURL("image/png");
}

const nomeArq = (g) => `cobranca-${String(g.cliente || "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").toLowerCase().slice(0, 40)}-${hojeISO()}.png`;

export function CardCobrancaModal({ contas, onClose }) {
  const grupos = useMemo(() => porCliente(contas), [contas]);
  const [mensagem, setMensagem] = useState(() => lsGet("cobranca.mensagem", MSG_PADRAO));
  const [contato, setContato] = useState(() => lsGet("cobranca.contato", ""));
  const [imgs, setImgs] = useState({});
  const [st, setSt] = useState("");
  const [copiado, setCopiado] = useState("");
  const gerar = async () => {
    setSt("Gerando…"); lsSet("cobranca.mensagem", mensagem); lsSet("cobranca.contato", contato);
    const o = {};
    for (const g of grupos) o[g.chave] = await desenharCard(g, { mensagem, contato });
    setImgs(o); setSt("");
  };
  useEffect(() => { gerar(); }, []);
  const baixar = (g) => { const a = document.createElement("a"); a.href = imgs[g.chave]; a.download = nomeArq(g); document.body.appendChild(a); a.click(); a.remove(); };
  const copiar = async (g) => {
    try {
      const blob = await (await fetch(imgs[g.chave])).blob();
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      setCopiado(g.chave); setTimeout(() => setCopiado(""), 2500);
    } catch { alerta("Seu navegador não deixou copiar a imagem — use Baixar PNG."); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-h-[94vh] flex flex-col" style={{ background: C.panel, maxWidth: 980 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b className="flex items-center gap-2" style={{ color: C.navy }}><ImageIcon size={18} style={{ color: C.accent }} /> Card de cobrança · {grupos.length} cliente(s)</b>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-5 overflow-auto">
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="text-xs" style={{ color: C.sub }}>Mensagem do card
              <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} className="w-full rounded-lg px-2 py-1.5 text-sm mt-1" style={{ border: `1px solid ${C.line}` }} />
            </label>
            <label className="text-xs" style={{ color: C.sub }}>Contato / dados para pagamento (opcional)
              <textarea value={contato} onChange={(e) => setContato(e.target.value)} rows={3} placeholder="Ex.: Financeiro MERIDIAN · (31) 9 9999-9999 · PIX CNPJ 48.011.287/0001-81"
                className="w-full rounded-lg px-2 py-1.5 text-sm mt-1" style={{ border: `1px solid ${C.line}` }} />
            </label>
          </div>
          <div className="flex justify-end mb-3">
            <button onClick={gerar} disabled={!!st} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.navy }}>
              {st ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} Atualizar cards
            </button>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}>
            {grupos.map((g) => (
              <div key={g.chave} className="rounded-xl p-3" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: C.navy }}>{g.cliente}</div>
                    <div className="text-xs" style={{ color: C.sub }}>{g.contas.length} título(s) · {moeda(g.total)}</div>
                  </div>
                  <button onClick={() => copiar(g)} disabled={!imgs[g.chave]} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: copiado === g.chave ? C.green : C.navy }}>
                    {copiado === g.chave ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copiado === g.chave ? "Copiado" : "Copiar"}
                  </button>
                  <button onClick={() => baixar(g)} disabled={!imgs[g.chave]} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}>
                    <Download size={13} /> Baixar PNG
                  </button>
                </div>
                {imgs[g.chave] ? <img src={imgs[g.chave]} alt={`Card de cobrança ${g.cliente}`} className="w-full rounded-lg" style={{ border: `1px solid ${C.line}` }} />
                  : <div className="flex items-center gap-2 text-xs p-6" style={{ color: C.sub }}><Loader2 size={14} className="animate-spin" /> Gerando…</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- e-mail de cobrança ----------------
function textoEmail(g, assinatura) {
  const linhas = g.contas.map((t) => `• ${nfDe(t)} — emissão ${dBR(t.emissao)} — vencimento ${dBR(t.vencimento)} — ${t.diasAtraso || 0} dia(s) em atraso — ${moeda(t.valor)}`);
  return [
    `Prezados(as) ${g.contato?.preposto ? g.contato.preposto : g.cliente},`, "",
    `Consta em nosso sistema o(s) título(s) abaixo em aberto${g.de === g.ate ? `, vencido em ${dBR(g.de)}` : `, com vencimentos de ${dBR(g.de)} a ${dBR(g.ate)}`}:`, "",
    ...linhas, "", `Total em aberto: ${moeda(g.total)} (sem juros e multa).`, "",
    "Pedimos a gentileza de regularizar o pagamento ou nos informar a previsão. Caso já tenha efetuado o pagamento, por favor desconsidere este e-mail e nos envie o comprovante.", "",
    assinatura || "Atenciosamente,\nFinanceiro MERIDIAN",
  ].join("\n");
}
export function EmailCobrancaModal({ user, contas, onClose }) {
  const grupos = useMemo(() => porCliente(contas), [contas]);
  // v903 — NFs em PDF de cada título (vão anexadas no envio pelo sistema)
  const [nfs, setNfs] = useState(null);
  const [envio, setEnvio] = useState({});   // chave → "enviando" | { ok, ... } | { erro }
  useEffect(() => { if (user?.id) fetch(`/api/fin/cobranca?u=${user.id}&ids=${contas.map((t) => t.id).join(",")}`).then((r) => r.json()).then((j) => setNfs(j.nfs || {})).catch(() => setNfs({})); }, []);
  const enviar = async (g) => {
    const e = ed[g.chave];
    setEnvio((x) => ({ ...x, [g.chave]: "enviando" }));
    try {
      const r = await fetch("/api/fin/cobranca", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, para: e.para, assunto: e.assunto, corpo: e.corpo, tituloIds: g.contas.map((t) => t.id) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não enviou.");
      setEnvio((x) => ({ ...x, [g.chave]: j }));
    } catch (err) { setEnvio((x) => ({ ...x, [g.chave]: { erro: err.message } })); }
  };
  const [assinatura, setAssinatura] = useState(() => lsGet("cobranca.assinatura", "Atenciosamente,\nFinanceiro MERIDIAN"));
  const [ed, setEd] = useState(() => Object.fromEntries(grupos.map((g) => [g.chave, {
    para: g.contato?.email || "", assunto: `Títulos em aberto — MERIDIAN — ${g.cliente}`, corpo: textoEmail(g, lsGet("cobranca.assinatura", "")),
  }])));
  const [copiado, setCopiado] = useState("");
  const set = (k, campo, v) => setEd((x) => ({ ...x, [k]: { ...x[k], [campo]: v } }));
  const refazer = () => { lsSet("cobranca.assinatura", assinatura); setEd((x) => Object.fromEntries(grupos.map((g) => [g.chave, { ...x[g.chave], corpo: textoEmail(g, assinatura) }]))); };
  const copiar = async (g) => {
    const e = ed[g.chave];
    try { await navigator.clipboard.writeText(`Assunto: ${e.assunto}\n\n${e.corpo}`); setCopiado(g.chave); setTimeout(() => setCopiado(""), 2500); } catch { alerta("Não consegui copiar."); }
  };
  const abrir = (g) => { const e = ed[g.chave]; window.location.href = `mailto:${encodeURIComponent(e.para)}?subject=${encodeURIComponent(e.assunto)}&body=${encodeURIComponent(e.corpo)}`; };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-h-[94vh] flex flex-col" style={{ background: C.panel, maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b className="flex items-center gap-2" style={{ color: C.navy }}><Mail size={18} style={{ color: C.accent }} /> E-mail de cobrança · {grupos.length} cliente(s)</b>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-5 overflow-auto">
          <div className="p-2.5 rounded-lg mb-3 text-xs" style={{ background: C.panel2, color: C.sub }}>
            <b style={{ color: C.text }}>Enviar</b> manda pelo sistema, com o PDF das NFs de cada título anexado, e registra o envio na observação das contas. Respostas do cliente vão para o seu e-mail do cadastro.
          </div>
          <label className="text-xs block mb-3" style={{ color: C.sub }}>Assinatura
            <div className="flex gap-2 mt-1">
              <textarea value={assinatura} onChange={(e) => setAssinatura(e.target.value)} rows={2} className="flex-1 rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }} />
              <button onClick={refazer} className="px-3 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: C.navy }}>Aplicar</button>
            </div>
          </label>
          {grupos.map((g) => {
            const e = ed[g.chave];
            return (
              <div key={g.chave} className="rounded-xl p-3 mb-3" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: C.navy }}>{g.cliente}</div>
                    <div className="text-xs" style={{ color: C.sub }}>{g.contas.length} título(s) · {moeda(g.total)}{!g.contato?.email && " · sem e-mail no cadastro de clientes"}</div>
                  </div>
                  <button onClick={() => copiar(g)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: copiado === g.chave ? C.green : C.navy }}>
                    {copiado === g.chave ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copiado === g.chave ? "Copiado" : "Copiar"}
                  </button>
                  <button onClick={() => abrir(g)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.navy }}><Mail size={13} /> Abrir no e-mail</button>
                  {(() => { const s = envio[g.chave]; const ok = s && s.ok; return (
                    <button onClick={() => enviar(g)} disabled={s === "enviando" || ok || !e.para} title={e.para ? "Enviar pelo sistema com as NFs em PDF" : "Informe o e-mail"} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: ok ? C.green : C.accent, opacity: s === "enviando" || !e.para ? 0.55 : 1 }}>
                      {s === "enviando" ? <Loader2 size={13} className="animate-spin" /> : ok ? <CheckCircle2 size={13} /> : <Send size={13} />} {s === "enviando" ? "Enviando…" : ok ? "Enviado" : "Enviar"}</button>); })()}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 2fr" }}>
                  <input value={e.para} onChange={(x) => set(g.chave, "para", x.target.value)} placeholder="Para (e-mail)" className="rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }} />
                  <input value={e.assunto} onChange={(x) => set(g.chave, "assunto", x.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }} />
                </div>
                {(() => {   // v903 — NFs que vão anexadas
                  if (!nfs) return <div className="text-xs mt-2 flex items-center gap-1" style={{ color: C.sub }}><Loader2 size={12} className="animate-spin" /> procurando as NFs em PDF…</div>;
                  const com = g.contas.filter((t) => nfs[t.id]?.arquivos?.length), sem = g.contas.filter((t) => !nfs[t.id]?.arquivos?.length);
                  return <div className="text-xs mt-2" style={{ color: C.sub }}>
                    <span style={{ color: C.text }}>Anexos: </span>{com.length ? [...new Set(com.flatMap((t) => nfs[t.id].arquivos))].join(", ") : "nenhuma NF em PDF encontrada"}
                    {sem.length > 0 && com.length > 0 && <span> · sem PDF: {sem.map((t) => nfDe(t)).join(", ")}</span>}</div>;
                })()}
                {envio[g.chave]?.ok && <div className="text-xs mt-1" style={{ color: C.green }}>Enviado para {envio[g.chave].para.join(", ")}{envio[g.chave].anexos.length ? ` com ${envio[g.chave].anexos.length} PDF(s)` : " sem anexos"}.</div>}
                {envio[g.chave]?.erro && <div className="text-xs mt-1" style={{ color: C.red }}>{envio[g.chave].erro}</div>}
                <textarea value={e.corpo} onChange={(x) => set(g.chave, "corpo", x.target.value)} rows={Math.min(16, 9 + g.contas.length)} className="w-full rounded-lg px-2 py-1.5 text-sm mt-2 font-mono" style={{ border: `1px solid ${C.line}`, fontSize: 12 }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// v903 — baixar as NFs (PDF) das contas a receber marcadas: cada PDF separado e um ZIP com todos
export function BotaoNfs({ user, ids, estilo, rotulo = "Baixar NFs" }) {
  const [st, setSt] = useState("");
  const baixarUrl = (url, nome) => { const a = document.createElement("a"); a.href = url; if (nome) a.download = nome; document.body.appendChild(a); a.click(); a.remove(); };
  const ir = async () => {
    if (!ids.length) return;
    setSt("Procurando…");
    try {
      const j = await fetch(`/api/fin/cobranca?u=${user.id}&ids=${ids.join(",")}`).then((r) => r.json());
      const arqs = [], vistos = new Set();
      for (const v of Object.values(j.nfs || {})) for (const c of v.chaves || []) if (!vistos.has(c.k)) { vistos.add(c.k); arqs.push(c); }
      const sem = ids.filter((id) => !(j.nfs?.[id]?.chaves || []).length).length;
      if (!arqs.length) { setSt(""); alerta("Nenhuma NF em PDF encontrada para as contas marcadas."); return; }
      for (const [i, c] of arqs.entries()) {
        setSt(`Baixando ${i + 1}/${arqs.length}…`);
        baixarUrl(`/api/fin/cobranca?u=${user.id}&arq=${c.k}&nome=${encodeURIComponent(c.nome)}`, c.nome);
        await new Promise((r) => setTimeout(r, 450));
      }
      setSt("Montando o ZIP…");
      baixarUrl(`/api/fin/cobranca?u=${user.id}&ids=${ids.join(",")}&zip=1`);
      setTimeout(() => setSt(""), 1500);
      if (sem) alerta(`${arqs.length} NF(s) baixada(s) separadas e no ZIP. ${sem} conta(s) sem NF em PDF no sistema.`);
    } catch (e) { setSt(""); alerta(e.message); }
  };
  return <button onClick={ir} disabled={!!st || !ids.length} title="Baixa o PDF de cada NF e um ZIP com todas" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={estilo || { border: `1px solid ${C.line}`, color: C.navy }}>
    {st ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {st || rotulo}</button>;
}
