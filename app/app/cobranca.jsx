"use client";
// v205 — Cobrança das contas a receber atrasadas
//  · CardCobrancaModal: card em PNG (um por cliente) com os títulos em aberto, NF, emissão, vencimento, atraso, valor e período em aberto
//  · EmailCobrancaModal: rascunho do e-mail de cobrança por cliente (envio pelo Resend fica para depois: hoje copia ou abre no e-mail)
import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Download, Copy, Mail, X, Image as ImageIcon, Send, CheckCircle2 } from "lucide-react";
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
export async function desenharCard(g, { mensagem = MSG_PADRAO, contato = "" } = {}) {
  try { await document.fonts?.ready; } catch { /* segue */ }
  const F = "Montserrat, Arial, sans-serif";
  const W = 1080, P = 56, linhaH = 46;
  const logo = await carregarImg("/meridian-logo.png");
  const cv = document.createElement("canvas");
  const ctx0 = cv.getContext("2d");
  ctx0.font = `500 24px ${F}`;
  const msgL = quebrar(ctx0, mensagem, W - 2 * P);
  const contL = contato ? quebrar(ctx0, contato, W - 2 * P - 40) : [];
  const H = 290 + msgL.length * 34 + 150 + 60 + g.contas.length * linhaH + 40 + 170 + (contL.length ? contL.length * 32 + 40 : 0) + 70;
  const esc = 2;
  cv.width = W * esc; cv.height = H * esc;
  const ctx = cv.getContext("2d");
  ctx.scale(esc, esc);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // cabeçalho
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, 120);
  if (logo) { const h = 64, w = (logo.width / logo.height) * h; ctx.drawImage(logo, P, 28, Math.min(w, 320), h); }
  else { ctx.fillStyle = C.navy; ctx.font = `800 40px ${F}`; ctx.fillText("MERIDIAN", P, 78); }
  ctx.fillStyle = C.sub; ctx.font = `500 20px ${F}`; ctx.textAlign = "right";
  ctx.fillText(`Emitido em ${dBR(hojeISO())}`, W - P, 70); ctx.textAlign = "left";
  ctx.fillStyle = C.navy; ctx.fillRect(0, 120, W, 96);
  ctx.fillStyle = C.accent; ctx.fillRect(0, 216, W, 6);
  ctx.fillStyle = "#FFFFFF"; ctx.font = `800 38px ${F}`; ctx.fillText("AVISO DE TÍTULOS EM ABERTO", P, 180);
  let y = 270;
  // cliente
  ctx.fillStyle = C.navy; ctx.font = `700 30px ${F}`; ctx.fillText(cortar(ctx, g.cliente, W - 2 * P), P, y);
  y += 34;
  if (g.documento) { ctx.fillStyle = C.sub; ctx.font = `500 22px ${F}`; ctx.fillText(`CNPJ/CPF ${fmtDoc(g.documento)}`, P, y); y += 10; }
  y += 30;
  ctx.fillStyle = C.text; ctx.font = `500 24px ${F}`;
  for (const l of msgL) { ctx.fillText(l, P, y); y += 34; }
  y += 16;
  // resumo (3 caixas)
  const caixas = [["TOTAL EM ABERTO", moeda(g.total), C.accent], ["PERÍODO EM ABERTO", g.de === g.ate ? dBR(g.de) : `${dBR(g.de)} a ${dBR(g.ate)}`, C.navy],
    ["TÍTULOS · MAIOR ATRASO", `${g.contas.length} · ${g.maiorAtraso} dia(s)`, C.red]];
  const cw = (W - 2 * P - 2 * 20) / 3;
  caixas.forEach(([r, v, cor], i) => {
    const x = P + i * (cw + 20);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x, y, cw, 110);
    ctx.fillStyle = cor; ctx.fillRect(x, y, 6, 110);
    ctx.fillStyle = C.sub; ctx.font = `700 17px ${F}`; ctx.fillText(r, x + 22, y + 38);
    ctx.fillStyle = cor; ctx.font = `800 ${v.length > 20 ? 22 : 28}px ${F}`; ctx.fillText(cortar(ctx, v, cw - 34), x + 22, y + 82);
  });
  y += 150;
  // tabela
  const cols = [["NF / TÍTULO", P + 16, "left"], ["EMISSÃO", P + 420, "left"], ["VENCIMENTO", P + 570, "left"], ["ATRASO", P + 790, "right"], ["VALOR", W - P - 16, "right"]];
  ctx.fillStyle = C.navy; ctx.fillRect(P, y, W - 2 * P, 52);
  ctx.fillStyle = "#FFFFFF"; ctx.font = `700 18px ${F}`;
  for (const [t, x, al] of cols) { ctx.textAlign = al; ctx.fillText(t, x, y + 33); }
  y += 52;
  g.contas.forEach((t, i) => {
    ctx.fillStyle = i % 2 ? "#FAFBFC" : "#FFFFFF"; ctx.fillRect(P, y, W - 2 * P, linhaH);
    ctx.font = `600 20px ${F}`; ctx.fillStyle = C.text; ctx.textAlign = "left";
    ctx.fillText(cortar(ctx, nfDe(t), 390), cols[0][1], y + 30);
    ctx.font = `500 20px ${F}`;
    ctx.fillText(dBR(t.emissao), cols[1][1], y + 30);
    ctx.fillText(dBR(t.vencimento), cols[2][1], y + 30);
    ctx.textAlign = "right"; ctx.fillStyle = Number(t.diasAtraso) > 30 ? C.red : C.text;
    ctx.fillText(`${t.diasAtraso || 0} dia(s)`, cols[3][1], y + 30);
    ctx.fillStyle = C.navy; ctx.font = `700 20px ${F}`; ctx.fillText(moeda(t.valor), cols[4][1], y + 30);
    y += linhaH;
  });
  ctx.fillStyle = C.accentSoft; ctx.fillRect(P, y, W - 2 * P, 56);
  ctx.fillStyle = C.navy; ctx.font = `800 22px ${F}`; ctx.textAlign = "left"; ctx.fillText("TOTAL", P + 16, y + 36);
  ctx.textAlign = "right"; ctx.fillStyle = C.accent; ctx.fillText(moeda(g.total), W - P - 16, y + 36);
  ctx.textAlign = "left";
  y += 56 + 40;
  // contato
  if (contL.length) {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(P, y, W - 2 * P, contL.length * 32 + 24);
    ctx.fillStyle = C.accent; ctx.fillRect(P, y, 6, contL.length * 32 + 24);
    ctx.fillStyle = C.text; ctx.font = `500 22px ${F}`;
    contL.forEach((l, i) => ctx.fillText(l, P + 24, y + 38 + i * 32));
    y += contL.length * 32 + 24 + 30;
  }
  ctx.fillStyle = C.sub; ctx.font = `500 17px ${F}`;
  ctx.fillText("Valores sem juros e multa por atraso. Este aviso foi gerado pelo financeiro da MERIDIAN.", P, H - 40);
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
export function EmailCobrancaModal({ contas, onClose }) {
  const grupos = useMemo(() => porCliente(contas), [contas]);
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
          <div className="p-2.5 rounded-lg mb-3 text-xs" style={{ background: C.yellowSoft, color: C.text }}>
            O envio automático pelo sistema (Resend) entra numa próxima versão. Por enquanto: <b>Copiar</b> o texto ou <b>Abrir no e-mail</b> já preenchido.
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
                  <button disabled title="Envio pelo sistema (Resend) — em breve" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent, opacity: 0.45 }}><Send size={13} /> Enviar</button>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 2fr" }}>
                  <input value={e.para} onChange={(x) => set(g.chave, "para", x.target.value)} placeholder="Para (e-mail)" className="rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }} />
                  <input value={e.assunto} onChange={(x) => set(g.chave, "assunto", x.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }} />
                </div>
                <textarea value={e.corpo} onChange={(x) => set(g.chave, "corpo", x.target.value)} rows={Math.min(16, 9 + g.contas.length)} className="w-full rounded-lg px-2 py-1.5 text-sm mt-2 font-mono" style={{ border: `1px solid ${C.line}`, fontSize: 12 }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
