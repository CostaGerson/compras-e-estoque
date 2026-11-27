// v1165 — Catálogo Meridian: todos os artigos de todas as cartelas (origem CARTELA) num HTML único, com guias por fornecedor
//   e por artigo. O arquivo fica na pasta do Google Drive (não pesa o banco); o sistema guarda só o id e serve uma cópia em disco.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { driveEnviar, driveLer, driveExcluir, gravarCacheDrive, caminhoCacheDrive } from "@/lib/artesDrive";

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
      d: num(a.rendimento), t: a.tipoMalha || null, u: a.unidade || null, e: null, k: [], ids: [] });
    const x = m.get(ch);
    x.ids.push(a.id); famDe.set(a.id, x);
    if (a.cor && !x.k.includes(a.cor)) x.k.push(a.cor);
    // especificação comum (sem o detalhe da cor)
    if (!x.e && a.especificacao) x.e = String(a.especificacao).split(" · ").filter((s) => !/ACRÉSCIMO/i.test(s)).join(" · ") || null;
  }
  await ultimasCompras(famDe).catch((e) => console.log("catálogo/preços:", e.message));
  return [...forns.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([f, m]) => ({ f, a: [...m.values()].map(({ ids, ...x }) => x) }));
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
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo Meridian</title>
<style>
:root{--navy:#001E41;--or:#FF6B1A;--orS:#FFF0E6;--bg:#F4F6F9;--pn:#fff;--ln:#E4E7EC;--tx:#1F2733;--sub:#667085}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--tx);font-size:14px}
header{background:var(--navy);color:#fff;padding:18px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;position:sticky;top:0;z-index:5}
header h1{margin:0;font-size:20px;letter-spacing:.5px}header h1 b{color:var(--or)}header .meta{font-size:12px;color:#B8C4D6}
.tabs{display:flex;gap:4px;margin-left:auto}.tabs button{background:transparent;border:1px solid #33506F;color:#DCE4EE;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600}
.tabs button.on{background:var(--or);border-color:var(--or);color:#fff}
.bar{display:flex;gap:8px;align-items:center;padding:12px 24px;background:var(--pn);border-bottom:1px solid var(--ln);flex-wrap:wrap;position:sticky;top:66px;z-index:4}
.bar input{flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--ln);border-radius:8px;font-size:14px}
.chip{padding:6px 12px;border-radius:999px;border:1px solid var(--ln);background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:var(--sub)}.chip.on{background:var(--orS);border-color:var(--or);color:var(--or)}
.wrap{display:flex;gap:0;min-height:calc(100vh - 130px)}
nav.side{width:250px;flex-shrink:0;background:var(--pn);border-right:1px solid var(--ln);padding:10px 0;position:sticky;top:130px;height:calc(100vh - 130px);overflow:auto}
nav.side a{display:flex;justify-content:space-between;padding:8px 18px;color:var(--tx);text-decoration:none;font-size:13px;border-left:3px solid transparent;cursor:pointer}
nav.side a:hover{background:var(--bg)}nav.side a.on{border-left-color:var(--or);background:var(--orS);color:var(--or);font-weight:700}nav.side a span{color:var(--sub);font-size:11px}
main{flex:1;padding:18px 24px;min-width:0}
h2{font-size:16px;color:var(--navy);margin:6px 0 12px;display:flex;align-items:center;gap:8px}h2 small{color:var(--sub);font-weight:400;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:var(--pn);border:1px solid var(--ln);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}
.card .t{font-weight:700;color:var(--navy);font-size:14px}.card .f{font-size:11px;color:var(--or);font-weight:700;text-transform:uppercase}
.tag{display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--bg);color:var(--sub);margin-right:4px}
.tag.MALHA{background:#E7F6EE;color:#12A150}.tag.TECIDO{background:#EAF2FC;color:#2E7CD6}.tag.AVIAMENTO{background:#FFF7E0;color:#B7791F}
.sp{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sp div{background:var(--bg);border-radius:8px;padding:6px 8px}.sp b{display:block;font-size:13px}.sp i{font-style:normal;font-size:10px;color:var(--sub);text-transform:uppercase}
.comp{font-size:12px;color:var(--tx)}.esp{font-size:11px;color:var(--sub)}
.cores{display:flex;flex-wrap:wrap;gap:4px}.cores span{font-size:10.5px;border:1px solid var(--ln);border-radius:6px;padding:2px 6px;background:#fff}
.mais{font-size:11px;color:var(--or);cursor:pointer;font-weight:700;background:none;border:none;padding:0;text-align:left}
.letra{position:sticky;top:130px;background:var(--bg);padding:6px 0;font-weight:800;color:var(--or);font-size:18px;z-index:2}
.row{display:grid;grid-template-columns:minmax(200px,2fr) 140px minmax(160px,1.5fr) 70px 80px 70px 1fr;gap:10px;align-items:center;background:var(--pn);border:1px solid var(--ln);border-radius:10px;padding:9px 12px;margin-bottom:6px;font-size:12.5px}
.row .n{font-weight:700;color:var(--navy)}.row .fo{color:var(--or);font-weight:700;font-size:11px}.row .mut{color:var(--sub)}
.idx{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}.idx a{font-weight:800;color:var(--navy);text-decoration:none;padding:3px 7px;border-radius:6px;background:var(--pn);border:1px solid var(--ln);font-size:12px}
.vazio{color:var(--sub);padding:40px;text-align:center}
.pr{background:#FFF7F0;border:1px solid #FFE0CC;border-radius:8px;padding:6px 8px;font-size:11.5px}.pr i{display:block;font-style:normal;font-size:10px;color:var(--sub);text-transform:uppercase}.pr b{color:var(--or)}.row .pr{background:none;border:none;padding:0}
.row.cab{background:none;border:none;font-size:10px;font-weight:700;color:var(--sub);text-transform:uppercase;padding:2px 12px;margin:0}.mut{color:var(--sub);font-size:10.5px}
@media(max-width:800px){nav.side{display:none}.row{grid-template-columns:1fr 1fr}.bar{top:110px}header{position:static}.bar{position:static}}
@media print{header,.bar,nav.side{position:static}nav.side{display:none}}
</style></head><body>
<header><div><h1>CATÁLOGO <b>MERIDIAN</b></h1><div class="meta">${dados.length} fornecedores · ${nA} artigos · ${nC} cores · atualizado em ${esc(quando)}</div></div>
<div class="tabs"><button id="tF" class="on">Por fornecedor</button><button id="tA">Por artigo</button></div></header>
<div class="bar"><input id="q" placeholder="Buscar artigo, referência, composição, cor ou fornecedor…" autocomplete="off">
<button class="chip on" data-c="">Todos</button><button class="chip" data-c="MALHA">Malha</button><button class="chip" data-c="TECIDO">Tecido</button><button class="chip" data-c="AVIAMENTO">Aviamento</button><button class="chip" data-c="OUTROS">Outros</button></div>
<div class="wrap"><nav class="side" id="side"></nav><main id="main"></main></div>
<script>
const D=${json};
const ALL=[];D.forEach(x=>x.a.forEach(a=>ALL.push(Object.assign({fo:x.f},a))));
let modo='F',forn=null,cat='',Q=[];
const sa=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const norm=s=>sa(s).replace(/(\\b[A-Z])\\.(?=[A-Z]\\b)/g,'$1').replace(/[^A-Z0-9%]+/g,' ').trim();
const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf=(v,d)=>v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d});
const brl=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
const dbr=d=>d?d.split('-').reverse().join('/'):'';
// busca igual à da FPP: casa nome, artigo interno, referência, composição, fornecedor e construção; prefixo, trecho e 1 letra de diferença; palavras que só casam com cores filtram as cores
function lev1(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,d=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++d>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return d+(a.length-i)+(b.length-j)<=1;}
function casaTok(t,toks){for(const h of toks){if(h===t)return 3;if(h.startsWith(t))return 2;if(t.length>=4&&h.includes(t))return 1.5;if(t.length>=5&&h.length>=5&&lev1(t,h))return 1;}return 0;}
ALL.forEach(a=>{const t=norm([a.n,a.i,a.r,a.p,a.fo,a.t,a.e,a.c].join(' ')).split(' ').filter(Boolean);for(let i=0,n=t.length;i<n-1;i++)t.push(t[i]+t[i+1]);a.T=t;a.KT=a.k.map(c=>norm(c).split(' ').filter(Boolean));});
function avalia(a){if(!Q.length)return{s:0,todas:1,k:a.k};let s=0,ok=0;const tc=[];
 for(const t of Q){const x=casaTok(t,a.T);if(x){s+=x;ok++;continue;}if(a.KT.some(ct=>casaTok(t,ct))){tc.push(t);s+=1;ok++;}}
 if(ok<Math.max(1,Math.ceil(Q.length*0.6)))return null;
 let k=a.k;if(tc.length){const f=a.k.filter((c,i)=>tc.every(t=>casaTok(t,a.KT[i])));if(f.length)k=f;}
 return{s,todas:ok===Q.length?1:0,k};}
function lista(filtroForn){const r=[];for(const a of ALL){if(cat&&a.c!==cat)continue;if(filtroForn&&a.fo!==filtroForn)continue;const v=avalia(a);if(v)r.push(Object.assign(a,{V:v}));}
 if(Q.length)r.sort((x,y)=>(y.V.todas-x.V.todas)||(y.V.s-x.V.s)||x.n.localeCompare(y.n));return r;}
window.__c=[];
function cores(a,lim){const k=a.V?a.V.k:a.k;if(!k.length)return'';const v=lim?k.slice(0,lim):k;const id=window.__c.length;window.__c.push(k);
 return '<div class="cores">'+v.map(c=>'<span>'+e(c)+'</span>').join('')+(lim&&k.length>lim?'<button class="mais" onclick="this.parentNode.outerHTML=tdc('+id+')">+'+(k.length-lim)+' cores</button>':'')+(a.V&&a.V.k.length<a.k.length?'<span class="mut">('+a.V.k.length+' de '+a.k.length+')</span>':'')+'</div>';}
window.tdc=i=>'<div class="cores">'+window.__c[i].map(c=>'<span>'+e(c)+'</span>').join('')+'</div>';
function precos(a,curto){if(!a.$||!a.$.length)return curto?'<span class="mut">—</span>':'';
 const l=a.$.map(p=>'<div><b>'+brl(p[0])+'</b>'+(p[1]?'/'+e(String(p[1]).toLowerCase()):'')+' · NF '+e(p[2]||'?')+(p[3]?' · '+dbr(p[3]):'')+(p[4]&&!curto?' · '+e(p[4]):'')+'</div>');
 return curto?'<div class="pr">'+l[0]+'</div>':'<div class="pr"><i>Últimos valores pagos</i>'+l.join('')+'</div>';}
function card(a){const rend=a.d?nf(a.d,2)+' m/kg':'—';
 return '<div class="card"><div><span class="tag '+e(a.c)+'">'+e(a.c)+'</span>'+(a.t?'<span class="tag">'+e(a.t)+'</span>':'')+(a.r?'<span class="tag">REF '+e(a.r)+'</span>':'')+'</div>'
 +'<div class="t">'+e(a.n)+'</div>'+(modo==='A'||!forn?'<div class="f">'+e(a.fo)+'</div>':'')
 +(a.p?'<div class="comp">'+e(a.p)+'</div>':'')
 +'<div class="sp"><div><i>Largura</i><b>'+(a.l?nf(a.l,2)+' m':'—')+'</b></div><div><i>Gramatura</i><b>'+(a.g?nf(a.g,1)+' g/m²':'—')+'</b></div><div><i>Rendimento</i><b>'+rend+'</b></div></div>'
 +precos(a)+(a.e?'<div class="esp">'+e(a.e)+'</div>':'')+(a.i?'<div class="esp">Artigo interno: <b>'+e(a.i)+'</b></div>':'')
 +'<div class="esp">'+a.k.length+' cor(es)</div>'+cores(a,14)+'</div>';}
function side(){const s=document.getElementById('side');if(modo!=='F'){s.innerHTML='';s.style.display='none';return;}s.style.display='';
 const tot=lista(null);const cont={};tot.forEach(a=>cont[a.fo]=(cont[a.fo]||0)+1);
 s.innerHTML='<a class="'+(forn?'':'on')+'" data-f="">Todos os fornecedores<span>'+tot.length+'</span></a>'+D.map(x=>cont[x.f]?'<a class="'+(forn===x.f?'on':'')+'" data-f="'+e(x.f)+'">'+e(x.f)+'<span>'+cont[x.f]+'</span></a>':'').join('');
 s.querySelectorAll('a').forEach(a=>a.onclick=()=>{forn=a.dataset.f||null;render();window.scrollTo(0,0);});}
const semRef=n=>n.replace(/^[0-9A-Z]{0,3}[0-9]+[ .-]*/,'');
function row(a){return '<div class="row"><div><div class="n">'+e(a.n)+'</div>'+(a.r?'<div class="mut">REF '+e(a.r)+'</div>':'')+'</div><div class="fo">'+e(a.fo)+'</div><div>'+e(a.p||'—')+'</div><div>'+(a.l?nf(a.l,2)+' m':'—')+'</div><div>'+(a.g?nf(a.g,1)+' g/m²':'—')+'</div><div>'+precos(a,true)+'</div><div>'+cores(a,6)+'</div></div>';}
function render(){window.__c=[];side();const m=document.getElementById('main');
 if(modo==='F'){const l=lista(forn);const grupos=D.filter(x=>!forn||x.f===forn).map(x=>[x.f,l.filter(a=>a.fo===x.f)]).filter(g=>g[1].length);
  m.innerHTML=grupos.length?grupos.map(([f,l])=>'<h2>'+e(f)+' <small>'+l.length+' artigo(s)</small></h2><div class="grid">'+l.map(card).join('')+'</div>').join('<div style="height:18px"></div>'):'<div class="vazio">Nada encontrado.</div>';return;}
 const l=lista(null);if(!l.length){m.innerHTML='<div class="vazio">Nada encontrado.</div>';return;}
 const cab='<div class="row cab"><div>Artigo</div><div>Fornecedor</div><div>Composição</div><div>Largura</div><div>Gramatura</div><div>Última compra</div><div>Cores</div></div>';
 if(Q.length){m.innerHTML='<h2>'+l.length+' resultado(s) <small>ordenados pela semelhança com a busca</small></h2>'+cab+l.slice(0,400).map(row).join('');return;}
 l.sort((a,b)=>sa(semRef(a.n)).localeCompare(sa(semRef(b.n)))||a.fo.localeCompare(b.fo));
 const L=a=>{const c=sa(semRef(a.n))[0]||'#';return /[A-Z]/.test(c)?c:'#';};const letras=[...new Set(l.map(L))];
 m.innerHTML='<div class="idx">'+letras.map(x=>'<a href="#L'+x+'">'+x+'</a>').join('')+'</div>'+cab+letras.map(x=>'<div class="letra" id="L'+x+'">'+x+'</div>'+l.filter(a=>L(a)===x).map(row).join('')).join('');}
document.getElementById('tF').onclick=()=>{modo='F';tF.classList.add('on');tA.classList.remove('on');render();};
document.getElementById('tA').onclick=()=>{modo='A';tA.classList.add('on');tF.classList.remove('on');render();};
let tm;document.getElementById('q').oninput=ev=>{clearTimeout(tm);tm=setTimeout(()=>{Q=norm(ev.target.value).split(' ').filter(Boolean);render();},150);};
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{cat=c.dataset.c;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c));render();});
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
