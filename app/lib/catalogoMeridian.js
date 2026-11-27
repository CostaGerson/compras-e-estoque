// v1165 — Catálogo Meridian: todos os artigos de todas as cartelas (origem CARTELA) num HTML único, com guias por fornecedor
//   e por artigo. O arquivo fica na pasta do Google Drive (não pesa o banco); o sistema guarda só o id e serve uma cópia em disco.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { driveEnviar, driveLer, driveExcluir, gravarCacheDrive, caminhoCacheDrive } from "@/lib/artesDrive";
import { corHex } from "@/lib/coresCatalogo";   // v1175 — bolinha da cor

export const PASTA_CATALOGO = "1LAmuOWnn0z3PbHbSeWMxtVlAZuokmUCJ";
const K = "CATALOGO|MERIDIAN";
const NOME_ARQ = "Catalogo Meridian.html";
const num = (v) => (v == null ? null : Number(v));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function estadoCatalogo() {
  const c = await prisma.finConfig.findUnique({ where: { chave: K } }).catch(() => null);
  try { return JSON.parse(c?.valor || "{}"); } catch { return {}; }
}
async function salvarEstado(v) {
  await prisma.finConfig.upsert({ where: { chave: K }, create: { chave: K, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
}

// artigos do catálogo agrupados: fornecedor → artigo (mesmo nome/ref/composição) → cores
export async function dadosCatalogo() {
  const arts = await prisma.artigo.findMany({ where: { ativo: true, origem: "CARTELA" },
    select: { id: true, nome: true, artigoInterno: true, codigoFornecedor: true, categoria: true, composicao: true, largura: true, gramatura: true, rendimento: true,
      tipoMalha: true, unidade: true, especificacao: true, cor: true, fornecedor: { select: { id: true, nome: true, nomeFantasia: true, razaoSocial: true } } },
    orderBy: [{ nome: "asc" }] });
  const forns = new Map(), famDe = new Map();
  for (const a of arts) {
    const fn = (a.fornecedor?.nomeFantasia || a.fornecedor?.nome || a.fornecedor?.razaoSocial || "SEM FORNECEDOR").trim();   // v1168 — + razão social
    if (!forns.has(fn)) forns.set(fn, new Map());
    const m = forns.get(fn);
    const ch = [a.nome, a.codigoFornecedor, a.composicao, num(a.largura), num(a.gramatura)].join("|");
    if (!m.has(ch)) m.set(ch, { n: a.nome, i: a.artigoInterno || null, r: a.codigoFornecedor || null, c: a.categoria, p: a.composicao || null, l: num(a.largura), g: num(a.gramatura),
      d: num(a.rendimento), t: a.tipoMalha || null, u: a.unidade || null, e: null, k: [], h: [], o: [], m: [], x: [], ids: [] });
    const x = m.get(ch);
    x.ids.push(a.id); famDe.set(a.id, x);
    if (a.cor && !x.k.includes(a.cor)) {
      x.k.push(a.cor);
      const c = corHex({ artigo: a.nome, cor: a.cor, especificacao: a.especificacao, fornecedor: fn });   // v1175 — amostra › Pantone › nome
      x.h.push(c.h ? c.h.slice(1) : ""); const pt = (String(a.especificacao || "").match(/PANTONE\s+(\d\d-\d{4}\s*[A-Z]*)/i) || [])[1];
      x.o.push(c.o === "amostra" ? (pt ? `A:Pantone ${pt.trim()}` : "A") : c.o === "nome" ? "N" : c.o || ""); x.m.push(c.m ? 1 : 0);
    }
    // especificação comum (sem o detalhe da cor)
    if (!x.e && a.especificacao) x.e = String(a.especificacao).split(" · ").filter((s) => !/ACRÉSCIMO|PANTONE|^GRUPO|^COR\b|TINGIMENTO|ESGOTADO|ALTA VISIBILIDADE/i.test(s.trim())).join(" · ") || null;
  }
  await ultimasCompras(famDe).catch((e) => console.log("catálogo/preços:", e.message));
  await correspondencias(famDe).catch((e) => console.log("catálogo/correspondências:", e.message));
  return [...forns.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([f, m]) => ({ f, a: [...m.values()].map(({ ids, x, ...r }) => ({ ...r, ...(x.length ? { x } : {}) })) }));
}

// v1175 — correspondência com artigo interno: o artigo interno da cartela + os vínculos NF × catálogo (equivalências)
async function correspondencias(famDe) {
  const eqs = await prisma.artigoEquivalencia.findMany({ select: { artigoInterno: true, dados: true } }).catch(() => []);
  for (const e of eqs) {
    const fam = famDe.get(Number(e.dados?.catalogoId)); const n = String(e.artigoInterno || "").trim().toUpperCase();
    if (fam && n && n !== String(fam.i || "").toUpperCase() && !fam.x.includes(n)) fam.x.push(n);
  }
}

// v1169 — últimos valores pagos: NFs que entraram no próprio item do catálogo ou em artigo interno casado com ele (vínculo NF × catálogo)
async function ultimasCompras(famDe) {
  const ids = [...famDe.keys()];
  if (!ids.length) return;
  const eqs = await prisma.artigoEquivalencia.findMany({ where: { artigoId: { not: null } }, select: { artigoId: true, dados: true } });
  const porArtigo = new Map();   // artigo (interno ou do catálogo) → famílias do catálogo
  const liga = (artId, fam) => { if (!porArtigo.has(artId)) porArtigo.set(artId, new Set()); porArtigo.get(artId).add(fam); };
  for (const id of ids) liga(id, famDe.get(id));
  for (const e of eqs) { const c = Number(e.dados?.catalogoId); if (c && famDe.has(c)) liga(e.artigoId, famDe.get(c)); }
  const itens = await prisma.nfItem.findMany({ where: { artigoId: { in: [...porArtigo.keys()] }, valorUnitario: { not: null } },
    select: { artigoId: true, valorUnitario: true, descricaoNf: true, nf: { select: { numero: true, dataEmissao: true } }, artigo: { select: { cor: true, unidade: true } } } });
  for (const it of itens) for (const fam of porArtigo.get(it.artigoId) || []) {
    (fam.$ ||= []).push([Number(it.valorUnitario), it.artigo?.unidade || fam.u || null, it.nf?.numero || null, it.nf?.dataEmissao ? it.nf.dataEmissao.toISOString().slice(0, 10) : null, it.artigo?.cor || null]);
  }
  for (const fam of new Set(famDe.values())) if (fam.$) {
    const vistos = new Set();
    fam.$ = fam.$.sort((a, b) => String(b[3] || "").localeCompare(String(a[3] || ""))).filter((p) => { const k = `${p[2]}|${p[4]}`; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 3);
  }
}

export function htmlCatalogo(dados, geradoEm = new Date()) {
  const nA = dados.reduce((s, x) => s + x.a.length, 0), nC = dados.reduce((s, x) => s + x.a.reduce((t, a) => t + a.k.length, 0), 0);
  const quando = geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");
  // v1175 — identidade visual do ERP (Montserrat, navy/laranja, cartões brancos) + bolinha da cor e card da cor
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo Meridian</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--navy:#001E41;--navyL:#0C2C52;--navyS:#9FB0C7;--or:#FF6B1A;--orS:#FFF0E6;--bg:#F5F6F8;--pn:#fff;--pn2:#F1F3F5;--ln:#E4E7EC;--tx:#1F2733;--sub:#667085;--gr:#12A150;--grS:#E7F6EE;--bl:#2E7CD6;--blS:#EAF2FC;--ye:#C08401;--yeS:#FFF7E0}
*{box-sizing:border-box}body{margin:0;font-family:Montserrat,system-ui,sans-serif;background:var(--bg);color:var(--tx);font-size:13px}
button,input{font-family:inherit}
header{background:var(--navy);color:#fff;padding:14px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;position:sticky;top:0;z-index:6}
.logo{display:flex;align-items:center;gap:12px}.logo .ic{width:40px;height:40px;border-radius:12px;background:rgba(255,107,26,.15);display:grid;place-items:center;color:var(--or);font-weight:800;font-size:18px}
header h1{margin:0;font-size:17px;font-weight:800;letter-spacing:.2px}header h1 b{color:var(--or)}header .meta{font-size:11px;color:var(--navyS);margin-top:2px}
.tabs{display:flex;gap:4px;margin-left:auto;background:var(--navyL);padding:4px;border-radius:10px}.tabs button{background:transparent;border:0;color:var(--navyS);padding:7px 14px;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px}
.tabs button.on{background:var(--or);color:#fff}
.bar{display:flex;gap:8px;align-items:center;padding:10px 24px;background:var(--pn);border-bottom:1px solid var(--ln);flex-wrap:wrap;position:sticky;top:68px;z-index:5}
.bar input{flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--ln);border-radius:10px;font-size:13px;outline:none;background:var(--pn2)}.bar input:focus{border-color:var(--or);background:#fff}
.chip{padding:6px 12px;border-radius:8px;border:1px solid var(--ln);background:var(--pn2);cursor:pointer;font-size:12px;font-weight:600;color:var(--tx)}.chip.on{background:var(--or);border-color:var(--or);color:#fff}
.wrap{display:flex;min-height:calc(100vh - 122px)}
nav.side{width:240px;flex-shrink:0;background:var(--navy);padding:10px 8px;position:sticky;top:122px;height:calc(100vh - 122px);overflow:auto}
nav.side .tit{font-size:10px;font-weight:700;color:var(--navyS);text-transform:uppercase;letter-spacing:.08em;padding:6px 10px 8px}
nav.side a{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;color:#DCE4EE;text-decoration:none;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;margin-bottom:2px}
nav.side a:hover{background:var(--navyL)}nav.side a.on{background:var(--or);color:#fff}nav.side a span{color:var(--navyS);font-size:10.5px;font-weight:600}nav.side a.on span{color:#FFE3D1}
main{flex:1;padding:18px 24px;min-width:0}
h2{font-size:15px;color:var(--navy);font-weight:800;margin:6px 0 12px;display:flex;align-items:center;gap:8px}h2 small{color:var(--sub);font-weight:500;font-size:11.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-items:start}
.card{background:var(--pn);border:1px solid var(--ln);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:9px;transition:box-shadow .15s}
.card:hover{box-shadow:0 6px 20px rgba(0,30,65,.08)}.card.open{grid-column:1/-1;border-color:var(--or);box-shadow:0 10px 30px rgba(0,30,65,.12)}
.card .t{font-weight:800;color:var(--navy);font-size:14px;line-height:1.25}.card .f{font-size:10.5px;color:var(--or);font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.tag{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--pn2);color:var(--sub);margin:0 4px 2px 0}
.tag.MALHA{background:var(--grS);color:var(--gr)}.tag.TECIDO{background:var(--blS);color:var(--bl)}.tag.AVIAMENTO{background:var(--yeS);color:var(--ye)}
.sp{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sp div{background:var(--pn2);border-radius:10px;padding:7px 9px}.sp b{display:block;font-size:12.5px;font-weight:700}.sp i{font-style:normal;font-size:9.5px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.04em}
.comp{font-size:12px;font-weight:600}.esp{font-size:11px;color:var(--sub)}
.int{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11px;color:var(--sub)}.int b{background:var(--orS);color:var(--or);border-radius:6px;padding:2px 7px;font-size:10.5px;font-weight:700}.int b.eq{background:var(--grS);color:var(--gr)}
.cores{display:flex;flex-wrap:wrap;gap:4px}
.cor{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;border:1px solid var(--ln);border-radius:999px;padding:2px 8px 2px 3px;background:#fff;cursor:pointer;color:var(--tx);line-height:1.3}
.cor:hover{border-color:var(--or)}.cor.on{border-color:var(--or);background:var(--orS);color:var(--or)}
.bol{width:14px;height:14px;border-radius:50%;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.14),inset -2px -2px 3px rgba(0,0,0,.12),inset 2px 2px 3px rgba(255,255,255,.35)}
.bol.sem{background:repeating-linear-gradient(45deg,#fff 0 3px,#E4E7EC 3px 5px)!important;box-shadow:inset 0 0 0 1px #C9CED6}
.msc{background-image:radial-gradient(rgba(255,255,255,.45) .6px,transparent .9px),radial-gradient(rgba(0,0,0,.28) .6px,transparent .9px)!important;background-size:3px 3px,4px 4px!important;background-position:0 0,1px 2px!important}
.mais{font-size:11px;color:var(--or);cursor:pointer;font-weight:700;background:none;border:none;padding:0 4px;text-align:left}
.det{border-top:1px dashed var(--ln);padding-top:12px;margin-top:2px;display:grid;grid-template-columns:180px 1fr;gap:18px}
.det .sw{width:180px;height:180px;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12),0 6px 18px rgba(0,0,0,.12)}
.det .sw.msc{background-size:5px 5px,7px 7px!important}
.det h3{margin:0 0 2px;font-size:18px;font-weight:800;color:var(--navy)}.det .cod{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--sub)}
.det .org{display:inline-block;margin-top:6px;font-size:10.5px;font-weight:700;border-radius:6px;padding:3px 8px}
.org.A{background:var(--grS);color:var(--gr)}.org.P{background:var(--blS);color:var(--bl)}.org.N{background:var(--yeS);color:var(--ye)}.org.S{background:var(--pn2);color:var(--sub)}
.fx{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:12px}.fx div{background:var(--pn2);border-radius:10px;padding:7px 10px}.fx i{display:block;font-style:normal;font-size:9.5px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.04em}.fx b{font-size:12.5px;font-weight:700}
.fechar{float:right;border:1px solid var(--ln);background:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;color:var(--sub);cursor:pointer}
.letra{position:sticky;top:122px;background:var(--bg);padding:6px 0;font-weight:800;color:var(--or);font-size:17px;z-index:2}
.row{display:grid;grid-template-columns:minmax(200px,2fr) 140px minmax(160px,1.5fr) 70px 80px 90px 2.4fr;gap:10px;align-items:center;background:var(--pn);border:1px solid var(--ln);border-radius:12px;padding:9px 12px;margin-bottom:6px;font-size:12px}
.row .n{font-weight:700;color:var(--navy)}.row .fo{color:var(--or);font-weight:800;font-size:10.5px;text-transform:uppercase}.row .mut{color:var(--sub)}
.rdet{background:var(--pn);border:1px solid var(--or);border-radius:16px;padding:14px 16px;margin:-2px 0 10px}
.idx{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}.idx a{font-weight:800;color:var(--navy);text-decoration:none;padding:4px 8px;border-radius:8px;background:var(--pn);border:1px solid var(--ln);font-size:12px}.idx a:hover{border-color:var(--or);color:var(--or)}
.vazio{color:var(--sub);padding:40px;text-align:center}
.pr{background:var(--orS);border-radius:10px;padding:7px 9px;font-size:11.5px}.pr i{display:block;font-style:normal;font-size:9.5px;font-weight:700;color:var(--sub);text-transform:uppercase}.pr b{color:var(--or)}.row .pr{background:none;padding:0}
.row.cab{background:none;border:none;font-size:9.5px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.04em;padding:2px 12px;margin:0}.mut{color:var(--sub);font-size:10.5px}
.leg{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--sub);margin:-4px 0 12px}.leg span{display:inline-flex;align-items:center;gap:5px}
@media(max-width:800px){nav.side{display:none}.row{grid-template-columns:1fr 1fr}.bar,header{position:static}.det{grid-template-columns:1fr}.det .sw{width:100%;height:120px}}
@media print{header,.bar,nav.side{position:static}nav.side{display:none}}
</style></head><body>
<header><div class="logo"><div class="ic">◆</div><div><h1>CATÁLOGO <b>MERIDIAN</b></h1><div class="meta">${dados.length} fornecedores · ${nA} artigos · ${nC} cores · atualizado em ${esc(quando)}</div></div></div>
<div class="tabs"><button id="tF" class="on">Por fornecedor</button><button id="tA">Por artigo</button></div></header>
<div class="bar"><input id="q" placeholder="Buscar artigo, referência, composição, cor, fornecedor ou artigo interno…" autocomplete="off">
<button class="chip on" data-c="">Todos</button><button class="chip" data-c="MALHA">Malha</button><button class="chip" data-c="TECIDO">Tecido</button><button class="chip" data-c="AVIAMENTO">Aviamento</button><button class="chip" data-c="OUTROS">Outros</button></div>
<div class="wrap"><nav class="side" id="side"></nav><main id="main"></main></div>
<script>
const D=${json};
const ALL=[];D.forEach(x=>x.a.forEach(a=>{a.fo=x.f;a.id=ALL.length;ALL.push(a);}));
let modo='F',forn=null,cat='',Q=[],SEL=null;
const sa=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();
const norm=s=>sa(s).replace(/(\\b[A-Z])\\.(?=[A-Z]\\b)/g,'$1').replace(/[^A-Z0-9%]+/g,' ').trim();
const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf=(v,d)=>v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d});
const brl=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
const dbr=d=>d?d.split('-').reverse().join('/'):'';
function lev1(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,d=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++d>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return d+(a.length-i)+(b.length-j)<=1;}
function casaTok(t,toks){for(const h of toks){if(h===t)return 3;if(h.startsWith(t))return 2;if(t.length>=4&&h.includes(t))return 1.5;if(t.length>=5&&h.length>=5&&lev1(t,h))return 1;}return 0;}
ALL.forEach(a=>{const t=norm([a.n,a.i,(a.x||[]).join(' '),a.r,a.p,a.fo,a.t,a.e,a.c].join(' ')).split(' ').filter(Boolean);for(let i=0,n=t.length;i<n-1;i++)t.push(t[i]+t[i+1]);a.T=t;a.KT=a.k.map(c=>norm(c).split(' ').filter(Boolean));});
function avalia(a){if(!Q.length)return{s:0,todas:1,k:a.k};let s=0,ok=0;const tc=[];
 for(const t of Q){const x=casaTok(t,a.T);if(x){s+=x;ok++;continue;}if(a.KT.some(ct=>casaTok(t,ct))){tc.push(t);s+=1;ok++;}}
 if(ok<Math.max(1,Math.ceil(Q.length*0.6)))return null;
 let k=a.k;if(tc.length){const f=a.k.filter((c,i)=>tc.every(t=>casaTok(t,a.KT[i])));if(f.length)k=f;}
 return{s,todas:ok===Q.length?1:0,k};}
function lista(filtroForn){const r=[];for(const a of ALL){if(cat&&a.c!==cat)continue;if(filtroForn&&a.fo!==filtroForn)continue;const v=avalia(a);if(v){a.V=v;r.push(a);}}
 if(Q.length)r.sort((x,y)=>(y.V.todas-x.V.todas)||(y.V.s-x.V.s)||x.n.localeCompare(y.n));return r;}
// bolinha: amostra da cartela, Pantone ou aproximada pelo nome; tracejada quando a cartela só tem o código
function bol(a,i,cls){const h=a.h&&a.h[i];return '<i class="'+(cls||'bol')+(h?'':' sem')+(a.m&&a.m[i]?' msc':'')+'"'+(h?' style="background-color:#'+h+'"':'')+'></i>';}
function chip(a,c){const i=a.k.indexOf(c);const on=SEL&&SEL.a===a.id&&SEL.i===i;return '<span class="cor'+(on?' on':'')+'" onclick="abre('+a.id+','+i+',event)" title="'+e(c)+'">'+bol(a,i)+e(c)+'</span>';}
window.__c=[];
function cores(a,lim){const k=a.V?a.V.k:a.k;if(!k.length)return'';const v=lim?k.slice(0,lim):k;const id=window.__c.length;window.__c.push([a.id,k]);
 return '<div class="cores">'+v.map(c=>chip(a,c)).join('')+(lim&&k.length>lim?'<button class="mais" onclick="this.parentNode.outerHTML=tdc('+id+')">+'+(k.length-lim)+' cores</button>':'')+(a.V&&a.V.k.length<a.k.length?'<span class="mut">('+a.V.k.length+' de '+a.k.length+')</span>':'')+'</div>';}
window.tdc=i=>{const[id,k]=window.__c[i];const a=ALL[id];return '<div class="cores">'+k.map(c=>chip(a,c)).join('')+'</div>';};
function precos(a,curto){if(!a.$||!a.$.length)return curto?'<span class="mut">—</span>':'';
 const l=a.$.map(p=>'<div><b>'+brl(p[0])+'</b>'+(p[1]?'/'+e(String(p[1]).toLowerCase()):'')+' · NF '+e(p[2]||'?')+(p[3]?' · '+dbr(p[3]):'')+(p[4]&&!curto?' · '+e(p[4]):'')+'</div>');
 return curto?'<div class="pr">'+l[0]+'</div>':'<div class="pr"><i>Últimos valores pagos</i>'+l.join('')+'</div>';}
function interno(a){if(!a.i&&!(a.x&&a.x.length))return '<div class="int">Artigo interno: <span class="mut">sem correspondência</span></div>';
 return '<div class="int">Artigo interno:'+(a.i?' <b title="Artigo interno da cartela">'+e(a.i)+'</b>':'')+((a.x||[]).map(n=>' <b class="eq" title="Vinculado pela NF">'+e(n)+'</b>').join(''))+'</div>';}
const semCod=c=>{const t=String(c).trim().split(/\\s+/);while(t.length>1&&(/\\d/.test(t[0])||(/^[A-Z]{2,3}$/.test(t[0])&&(!/[AEIOU]/.test(t[0])||/\\d/.test(t[1]||'')))))t.shift();return t.join(' ');};
const ORG={A:['A','Cor da amostra da cartela'],N:['N','Cor aproximada pelo nome'],S:['S','Cartela só com o código: sem cor']};
function detalhe(a,i){const c=a.k[i],h=a.h&&a.h[i],o=a.o&&a.o[i],n=semCod(c),cod=String(c).trim().slice(0,String(c).trim().length-n.length).trim();
 const og=!h?ORG.S:o&&o.startsWith('Pantone')?['P',o]:o&&o.startsWith('A:')?['A','Cor da amostra da cartela · '+o.slice(2)]:ORG[o]||ORG.N;
 return '<div class="det"><div class="sw'+(h?'':' bol sem')+(a.m&&a.m[i]?' msc':'')+'"'+(h?' style="background-color:#'+h+'"':'')+'></div><div>'
 +'<button class="fechar" onclick="fecha(event)">Fechar ✕</button><h3>'+e(n||c)+'</h3><div class="cod">'+(cod?'Cód. da cor '+e(cod)+' · ':'')+(h?'#'+h:'')+'</div>'
 +'<span class="org '+og[0]+'" style="margin-top:6px">'+e(og[1])+'</span>'
 +'<div class="fx"><div><i>Artigo</i><b>'+e(a.n)+'</b></div><div><i>Fornecedor</i><b>'+e(a.fo)+'</b></div>'+(a.r?'<div><i>Referência</i><b>'+e(a.r)+'</b></div>':'')
 +'<div><i>Categoria</i><b>'+e(a.c)+(a.t?' · '+e(a.t):'')+'</b></div><div><i>Composição</i><b>'+e(a.p||'—')+'</b></div><div><i>Largura</i><b>'+(a.l?nf(a.l,2)+' m':'—')+'</b></div>'
 +'<div><i>Gramatura</i><b>'+(a.g?nf(a.g,1)+' g/m²':'—')+'</b></div><div><i>Rendimento</i><b>'+(a.d?nf(a.d,2)+' m/kg':'—')+'</b></div><div><i>Unidade</i><b>'+e(a.u||'—')+'</b></div>'
 +'<div><i>Cores no artigo</i><b>'+a.k.length+'</b></div></div>'
 +'<div style="margin-top:10px">'+interno(a)+'</div>'+(a.e?'<div class="esp" style="margin-top:6px">'+e(a.e)+'</div>':'')+(a.$?'<div style="margin-top:8px">'+precos(a)+'</div>':'')+'</div></div>';}
window.abre=(id,i,ev)=>{ev&&ev.stopPropagation();SEL=SEL&&SEL.a===id&&SEL.i===i?null:{a:id,i};const y=window.scrollY;render();window.scrollTo(0,y);const el=document.getElementById('sel');if(el){const r=el.getBoundingClientRect();if(r.top<130||r.bottom>innerHeight)el.scrollIntoView({block:'nearest',behavior:'smooth'});}};
window.fecha=ev=>{ev&&ev.stopPropagation();SEL=null;const y=window.scrollY;render();window.scrollTo(0,y);};
function card(a){const open=SEL&&SEL.a===a.id;
 return '<div class="card'+(open?' open':'')+'"'+(open?' id="sel"':'')+'><div><span class="tag '+e(a.c)+'">'+e(a.c)+'</span>'+(a.t?'<span class="tag">'+e(a.t)+'</span>':'')+(a.r?'<span class="tag">REF '+e(a.r)+'</span>':'')+'</div>'
 +'<div class="t">'+e(a.n)+'</div>'+(modo==='A'||!forn?'<div class="f">'+e(a.fo)+'</div>':'')
 +(a.p?'<div class="comp">'+e(a.p)+'</div>':'')
 +'<div class="sp"><div><i>Largura</i><b>'+(a.l?nf(a.l,2)+' m':'—')+'</b></div><div><i>Gramatura</i><b>'+(a.g?nf(a.g,1)+' g/m²':'—')+'</b></div><div><i>Rendimento</i><b>'+(a.d?nf(a.d,2)+' m/kg':'—')+'</b></div></div>'
 +interno(a)+(open?'':precos(a)+(a.e?'<div class="esp">'+e(a.e)+'</div>':''))
 +'<div class="esp">'+a.k.length+' cor(es) · clique na cor para ver</div>'+cores(a,open?0:16)+(open?detalhe(a,SEL.i):'')+'</div>';}
function side(){const s=document.getElementById('side');if(modo!=='F'){s.innerHTML='';s.style.display='none';return;}s.style.display='';
 const tot=lista(null);const cont={};tot.forEach(a=>cont[a.fo]=(cont[a.fo]||0)+1);
 s.innerHTML='<div class="tit">Fornecedores</div><a class="'+(forn?'':'on')+'" data-f="">Todos<span>'+tot.length+'</span></a>'+D.map(x=>cont[x.f]?'<a class="'+(forn===x.f?'on':'')+'" data-f="'+e(x.f)+'">'+e(x.f)+'<span>'+cont[x.f]+'</span></a>':'').join('');
 s.querySelectorAll('a').forEach(a=>a.onclick=()=>{forn=a.dataset.f||null;SEL=null;render();window.scrollTo(0,0);});}
const semRef=n=>n.replace(/^[0-9A-Z]{0,3}[0-9]+[ .-]*/,'');
function row(a){const open=SEL&&SEL.a===a.id;return '<div class="row"><div><div class="n">'+e(a.n)+'</div>'+(a.r?'<div class="mut">REF '+e(a.r)+'</div>':'')+(a.i||(a.x&&a.x.length)?'<div class="mut">Interno: '+e([a.i].concat(a.x||[]).filter(Boolean).join(' · '))+'</div>':'')+'</div><div class="fo">'+e(a.fo)+'</div><div>'+e(a.p||'—')+'</div><div>'+(a.l?nf(a.l,2)+' m':'—')+'</div><div>'+(a.g?nf(a.g,1)+' g/m²':'—')+'</div><div>'+precos(a,true)+'</div><div>'+cores(a,6)+'</div></div>'
 +(open?'<div class="rdet" id="sel"><div class="cores">'+a.k.map(c=>chip(a,c)).join('')+'</div>'+detalhe(a,SEL.i)+'</div>':'');}
const LEG='<div class="leg"><span><i class="bol" style="background:#00806C"></i>amostra da cartela</span><span><i class="bol" style="background:#2E64B0"></i>Pantone informado</span><span><i class="bol" style="background:#D4A22B"></i>aproximada pelo nome</span><span><i class="bol msc" style="background-color:#8E9196"></i>mescla</span><span><i class="bol sem"></i>só código</span></div>';
function render(){window.__c=[];side();const m=document.getElementById('main');
 if(modo==='F'){const l=lista(forn);const grupos=D.filter(x=>!forn||x.f===forn).map(x=>[x.f,l.filter(a=>a.fo===x.f)]).filter(g=>g[1].length);
  m.innerHTML=grupos.length?LEG+grupos.map(([f,l])=>'<h2>'+e(f)+' <small>'+l.length+' artigo(s)</small></h2><div class="grid">'+l.map(card).join('')+'</div>').join('<div style="height:18px"></div>'):'<div class="vazio">Nada encontrado.</div>';return;}
 const l=lista(null);if(!l.length){m.innerHTML='<div class="vazio">Nada encontrado.</div>';return;}
 const cab='<div class="row cab"><div>Artigo</div><div>Fornecedor</div><div>Composição</div><div>Largura</div><div>Gramatura</div><div>Última compra</div><div>Cores</div></div>';
 if(Q.length){m.innerHTML=LEG+'<h2>'+l.length+' resultado(s) <small>ordenados pela semelhança com a busca</small></h2>'+cab+l.slice(0,400).map(row).join('');return;}
 l.sort((a,b)=>sa(semRef(a.n)).localeCompare(sa(semRef(b.n)))||a.fo.localeCompare(b.fo));
 const L=a=>{const c=sa(semRef(a.n))[0]||'#';return /[A-Z]/.test(c)?c:'#';};const letras=[...new Set(l.map(L))];
 m.innerHTML=LEG+'<div class="idx">'+letras.map(x=>'<a href="#L'+x+'">'+x+'</a>').join('')+'</div>'+cab+letras.map(x=>'<div class="letra" id="L'+x+'">'+x+'</div>'+l.filter(a=>L(a)===x).map(row).join('')).join('');}
document.getElementById('tF').onclick=()=>{modo='F';SEL=null;tF.classList.add('on');tA.classList.remove('on');render();};
document.getElementById('tA').onclick=()=>{modo='A';SEL=null;tA.classList.add('on');tF.classList.remove('on');render();};
let tm;document.getElementById('q').oninput=ev=>{clearTimeout(tm);tm=setTimeout(()=>{Q=norm(ev.target.value).split(' ').filter(Boolean);SEL=null;render();},150);};
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{cat=c.dataset.c;SEL=null;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c));render();});
render();
</script></body></html>`;
}

let rodando = null;
// gera o HTML e, se mudou, sobe para a pasta do Drive (o anterior vai para a lixeira)
export async function publicarCatalogo({ forcar = false } = {}) {
  if (rodando) return rodando;
  rodando = (async () => {
    const dados = await dadosCatalogo();
    const md5 = crypto.createHash("md5").update(JSON.stringify(dados)).digest("hex");
    const ant = await estadoCatalogo();
    if (!forcar && ant.md5 === md5 && ant.driveId) return { ok: true, igual: true, ...ant };
    const html = htmlCatalogo(dados);
    const base64 = Buffer.from(html, "utf8").toString("base64");
    const j = await driveEnviar({ pasta: PASTA_CATALOGO, nome: NOME_ARQ, mime: "text/html", base64 });
    await gravarCacheDrive(j.id, base64, { mime: "text/html; charset=utf-8", nome: NOME_ARQ });
    const novo = { driveId: j.id, link: j.link || null, md5, em: new Date().toISOString(), fornecedores: dados.length, artigos: dados.reduce((s, x) => s + x.a.length, 0),
      cores: dados.reduce((s, x) => s + x.a.reduce((t, a) => t + a.k.length, 0), 0), bytes: html.length };
    await salvarEstado(novo);
    if (ant.driveId && ant.driveId !== j.id) driveExcluir(ant.driveId).catch(() => null);
    console.log(`Catálogo Meridian publicado no Drive: ${novo.artigos} artigos, ${novo.fornecedores} fornecedores (${j.id}).`);
    return { ok: true, ...novo };
  })().finally(() => { rodando = null; });
  return rodando;
}

// HTML para abrir no navegador: cópia em disco do arquivo do Drive; se não houver, busca no Drive
export async function htmlPublicado() {
  const st = await estadoCatalogo();
  if (!st.driveId) { await publicarCatalogo(); return htmlPublicado(); }
  const c = await caminhoCacheDrive(st.driveId);
  if (c) { const fs = await import("fs/promises"); return fs.readFile(c.bin, "utf8"); }
  const j = await driveLer(st.driveId);
  await gravarCacheDrive(st.driveId, j.base64, { mime: "text/html; charset=utf-8", nome: NOME_ARQ });
  return Buffer.from(j.base64, "base64").toString("utf8");
}
