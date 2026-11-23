"use client";
// v1060 — OC em imagem (PNG) para anexar à demanda de rota de coleta/compra: o motorista confere no celular o que pega e quanto se paga
const qtdU = (v, u) => `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: u === "UN" ? 0 : 2, maximumFractionDigits: u === "UN" ? 0 : 3 })} ${String(u || "").toLowerCase()}`;
const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
const FORMAS = { COLETA: "Coleta (nós buscamos)", TRANSPORTADORA: "Transportadora", ENTREGA_PROPRIA: "Entrega do fornecedor" };
let _logo = null;
const logo = () => (_logo ||= new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = "/meridian-wordmark.svg"; }));

export async function desenharOc(o) {
  const W = 1080, P = 56, LH = 28;
  const c0 = document.createElement("canvas"); const x0 = c0.getContext("2d");
  const quebra = (t, w, font) => { x0.font = font; const ps = String(t || "").split(/\s+/); const ls = []; let l = ""; for (const q of ps) { const n = l ? `${l} ${q}` : q; if (x0.measureText(n).width > w && l) { ls.push(l); l = q; } else l = n; } if (l) ls.push(l); return ls.length ? ls : [""]; };
  const col = { n: P, art: P + 40, qtd: 700, vu: 860, tot: W - P };
  const wArt = col.qtd - 170 - col.art;
  const itens = (o.itens || []).map((i) => {
    const a = quebra(i.nfNome || i.nome, wArt, "600 24px Arial");
    const d = quebra([i.cor, i.codigo].filter(Boolean).join(" · "), wArt, "19px Arial").filter(Boolean);
    return { i, a, d, h: Math.max(62, 20 + a.length * LH + d.length * 24) };
  });
  const total = o.total ?? (o.itens || []).reduce((s, i) => s + Number(i.quantidade) * Number(i.valorUnitario), 0);
  const info = [
    ["Condição", o.condicaoFaturamento || "—"], ["Recebimento", FORMAS[o.formaRecebimento] || "—"],
    ["Prazo na fábrica", dBR(o.prazoFabrica)], ["NF do fornecedor", o.nfNumero || "—"],
  ];
  const H = 330 + 56 + itens.reduce((s, l) => s + l.h, 0) + 120 + 140;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.fillStyle = "#0c2342"; x.fillRect(0, 0, W, 14);
  const lg = await logo();
  if (lg) { const h = 42, w = (lg.naturalWidth || 4117) / (lg.naturalHeight || 601) * h; x.drawImage(lg, P, 48, w, h); } else { x.fillStyle = "#0c2342"; x.font = "800 38px Arial"; x.fillText("MERIDIAN", P, 86); }
  x.textAlign = "right"; x.fillStyle = "#ee6500"; x.font = "700 22px Arial"; x.fillText("ORDEM DE COMPRA", W - P, 66);
  x.fillStyle = "#667085"; x.font = "19px Arial"; x.fillText(`${dBR(o.createdAt)}${o.pic ? ` · ${o.pic}` : ""}${o.cotacao ? ` · ${o.cotacao}` : ""}`, W - P, 94); x.textAlign = "left";
  x.fillStyle = "#0c2342"; x.font = "800 44px Arial"; x.fillText(o.numero || "OC", P, 168);
  x.fillStyle = "#667085"; x.font = "19px Arial"; x.fillText("Fornecedor", P, 208);
  x.fillStyle = "#0c2342"; x.font = "700 30px Arial"; x.fillText(String(o.fornecedor?.nome || "").slice(0, 52), P, 244);
  x.fillStyle = "#3e5066"; x.font = "19px Arial"; x.fillText([o.fornecedor?.endereco, o.fornecedor?.telefone].filter(Boolean).join(" · ").slice(0, 95), P, 274);
  let y = 300;
  info.forEach(([k, v], j) => { const xx = P + j * ((W - 2 * P) / 4); x.fillStyle = "#667085"; x.font = "16px Arial"; x.fillText(k.toUpperCase(), xx, y); x.fillStyle = "#0c2342"; x.font = "600 19px Arial"; x.fillText(String(v).slice(0, 22), xx, y + 24); });
  y += 50;
  x.fillStyle = "#f1f6fe"; x.fillRect(P - 16, y, W - P * 2 + 32, 48);
  x.fillStyle = "#3d6799"; x.font = "700 18px Arial"; x.fillText("#", col.n, y + 31); x.fillText("ARTIGO", col.art, y + 31);
  x.textAlign = "right"; x.fillText("QUANTIDADE", col.qtd, y + 31); x.fillText("VALOR UNIT.", col.vu, y + 31); x.fillText("TOTAL", col.tot, y + 31); x.textAlign = "left";
  y += 58;
  itens.forEach((l, k) => {
    x.fillStyle = "#ee6500"; x.font = "700 22px Arial"; x.fillText(String(k + 1), col.n, y + 26);
    x.fillStyle = "#0c2342"; x.font = "600 24px Arial"; l.a.forEach((t, j) => x.fillText(t, col.art, y + 26 + j * LH));
    x.fillStyle = "#667085"; x.font = "19px Arial"; l.d.forEach((t, j) => x.fillText(t, col.art, y + 26 + l.a.length * LH + j * 24));
    x.textAlign = "right"; x.fillStyle = "#0c2342"; x.font = "700 24px Arial"; x.fillText(qtdU(l.i.quantidade, l.i.unidade), col.qtd, y + 28);
    x.font = "20px Arial"; x.fillText(brl(l.i.valorUnitario), col.vu, y + 28);
    x.font = "700 22px Arial"; x.fillText(brl(Number(l.i.quantidade) * Number(l.i.valorUnitario)), col.tot, y + 28); x.textAlign = "left";
    y += l.h; x.strokeStyle = "#e4e7ec"; x.lineWidth = 2; x.beginPath(); x.moveTo(P - 16, y - 8); x.lineTo(W - P + 16, y - 8); x.stroke();
  });
  y += 36;
  x.textAlign = "right"; x.fillStyle = "#667085"; x.font = "20px Arial"; x.fillText("TOTAL DA OC", col.tot - 230, y + 6);
  x.fillStyle = "#0c2342"; x.font = "800 34px Arial"; x.fillText(brl(total), col.tot, y + 8); x.textAlign = "left";
  if (o.obs) { x.fillStyle = "#3e5066"; x.font = "18px Arial"; quebra(o.obs, W - 2 * P, "18px Arial").slice(0, 3).forEach((t, j) => x.fillText(t, P, y + 52 + j * 24)); }
  x.strokeStyle = "#ee6500"; x.setLineDash([10, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(P, H - 40); x.lineTo(W - P, H - 40); x.stroke(); x.setLineDash([]);
  return cv;
}

// anexo pronto para a demanda de rota: { nome, mime, conteudo (base64) }
export async function anexoDaOc(o) {
  const cv = await desenharOc(o);
  return { nome: `${String(o.numero || "OC").replace(/\s+/g, "")}.png`, mime: "image/png", conteudo: cv.toDataURL("image/png").split(",")[1] || "" };
}
