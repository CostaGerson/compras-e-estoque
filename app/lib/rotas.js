// v425 — Logística › Rotas: demandas de rota, geolocalização, melhor sequência (com janelas de horário), blocos e despacho
import { prisma } from "@/lib/prisma";
import { temGoogle, geocodificar, matrizRuas, chaveTrecho, enderecoReverso } from "@/lib/googleMaps";   // v427 · v485
import { notificar } from "@/lib/push";   // v466

const up = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const so = (s) => String(s || "").replace(/\D/g, "");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();

export const OBJETIVOS = ["COLETA", "ENTREGA", "COMPRA"];
export const VEICULOS = ["CARRO", "MOTO"];
export const HORARIOS = ["FIXO", "MANHA", "TARDE", "ATE", "APOS", "ENTRE", "LIVRE"];
const K_FABRICA = "ROTA|FABRICA";

// Região Metropolitana de Belo Horizonte (34 municípios)
const RMBH = new Set(["BALDIM", "BELO HORIZONTE", "BETIM", "BRUMADINHO", "CAETE", "CAPIM BRANCO", "CONFINS", "CONTAGEM", "ESMERALDAS", "FLORESTAL",
  "IBIRITE", "IGARAPE", "ITAGUARA", "ITATIAIUCU", "JABOTICATUBAS", "JUATUBA", "LAGOA SANTA", "MARIO CAMPOS", "MATEUS LEME", "MATOZINHOS", "NOVA LIMA",
  "NOVA UNIAO", "PEDRO LEOPOLDO", "RAPOSOS", "RIBEIRAO DAS NEVES", "RIO ACIMA", "RIO MANSO", "SABARA", "SANTA LUZIA", "SAO JOAQUIM DE BICAS",
  "SAO JOSE DA LAPA", "SARZEDO", "TAQUARACU DE MINAS", "VESPASIANO"]);
export function regiaoDe(municipio, uf) {
  const m = sem(municipio), u = up(uf);
  if (u === "MG" && RMBH.has(m)) return "RMBH";
  if (u === "MG") return "MG";
  if (u) return "BR";
  return RMBH.has(m) ? "RMBH" : null;
}

// ---------- geolocalização (OpenStreetMap / Nominatim, 1 consulta por segundo, com cache) ----------
let filaGeo = Promise.resolve();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": "meridian-erp/1.0 (rotas)", "Accept-Language": "pt-BR" }, cache: "no-store" });
  if (!r.ok) throw new Error(`geolocalização: HTTP ${r.status}`);
  const j = await r.json();
  const x = Array.isArray(j) ? j[0] : null;
  if (!x) return null;
  const a = x.address || {};
  const uf = String(a["ISO3166-2-lvl4"] || "").replace(/^BR-/, "") || null;
  return { lat: Number(x.lat), lng: Number(x.lon), municipio: a.city || a.town || a.village || a.municipality || a.county || null, uf };
}
export async function geolocalizar(endereco) {
  const chave = sem(endereco).slice(0, 300);
  if (!chave) return null;
  const c = await prisma.geoCache.findUnique({ where: { chave } }).catch(() => null);
  if (c && (c.lat != null || !temGoogle())) return c.lat != null ? c : null;
  // v427 — com a chave do Google, usa o Geocoding do Google
  if (temGoogle()) {
    let g = null; try { g = await geocodificar(endereco); } catch (e) { console.log("rotas/geo google:", e.message); }
    if (g) {
      await prisma.geoCache.upsert({ where: { chave }, create: { chave, lat: g.lat, lng: g.lng, municipio: g.municipio || null, uf: g.uf || null }, update: { lat: g.lat, lng: g.lng, municipio: g.municipio || null, uf: g.uf || null } }).catch(() => null);
      return g;
    }
    if (c) return null;
  }
  const tarefa = filaGeo.then(async () => {
    let g = null;
    try {
      g = await nominatim(endereco);
      // não achou o endereço completo: tenta sem o número/complemento e, por fim, só a cidade
      const partes = String(endereco).split(/\s*[,\-–]\s*/).filter(Boolean);
      if (!g && partes.length > 2) { await espera(1100); g = await nominatim(partes.slice(-3).join(", ")); }
      if (!g && partes.length > 1) { await espera(1100); g = await nominatim(partes.slice(-2).join(", ")); }
    } catch (e) { console.log("rotas/geo:", e.message); }
    await espera(1100);
    return g;
  });
  filaGeo = tarefa.catch(() => null);
  const g = await tarefa;
  await prisma.geoCache.create({ data: { chave, lat: g?.lat ?? null, lng: g?.lng ?? null, municipio: g?.municipio || null, uf: g?.uf || null } }).catch(() => null);
  return g;
}

// ---------- cadastros ----------
const juntaEnd = (o) => [[o.logradouro, o.numero].filter(Boolean).join(", "), o.complemento, o.bairro, [o.municipio, o.uf].filter(Boolean).join(" - "), o.cep ? `CEP ${o.cep}` : null].filter(Boolean).join(", ");
export async function destinos() {
  const [fs, ps, cs, dsx] = await Promise.all([
    prisma.fornecedor.findMany({ where: { ativo: true }, select: { id: true, nome: true, nomeFantasia: true, razaoSocial: true, logradouro: true, numero: true, complemento: true, bairro: true, municipio: true, uf: true, cep: true, contato: true, preposto: true, telefone: true, telefones: true } }),
    prisma.prestador.findMany({ where: { ativo: true, tipo: "TERCEIRIZADO" }, select: { id: true, nome: true, endereco: true, telefone: true } }),
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, cnpj: true, razaoSocial: true, nomeFantasia: true, logradouro: true, numero: true, complemento: true, bairro: true, municipio: true, uf: true, cep: true, preposto: true, telefones: true } }),
    prisma.destinatario.findMany({ where: { ativo: true } }),   // v430
  ]);
  return [
    ...dsx.map((x) => ({ tipo: "DESTINATARIO", id: x.id, nome: up(x.nome), endereco: x.endereco || "", contato: x.contato || null, telefone: x.telefone || null, lat: x.lat, lng: x.lng, municipio: x.municipio, uf: x.uf })),
    ...ps.map((p) => ({ tipo: "TERCEIRIZADO", id: p.id, nome: up(p.nome), endereco: p.endereco || "", contato: null, telefone: p.telefone || null })),
    ...fs.map((f) => ({ tipo: "FORNECEDOR", id: f.id, nome: up(f.nome || f.nomeFantasia || f.razaoSocial), endereco: juntaEnd(f), contato: f.contato || f.preposto || null, telefone: f.telefone || f.telefones || null,
      busca: [f.nome, f.nomeFantasia, f.razaoSocial].filter(Boolean).join(" ") })),
    ...cs.map((c) => ({ tipo: "CLIENTE", id: c.id, nome: up(c.nomeFantasia || c.razaoSocial), endereco: juntaEnd(c), contato: c.preposto || null, telefone: c.telefones || null,
      busca: [c.nomeFantasia, c.razaoSocial, c.cnpj].filter(Boolean).join(" ") })),   // v438 — acha o cliente pela razão social, fantasia ou CNPJ
  ].filter((x) => x.nome).sort((a, b) => a.nome.localeCompare(b.nome));
}

// motoristas: folha (Matriz oficial, cargo com MOTORISTA) + freelancers com função MOTORISTA
export async function motoristas() {
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } });
  const folha = (m?.dados?.pessoal || []).filter((p) => p.ativo !== false && /MOTORISTA/i.test(String(p.cargo || "")));
  const fichas = folha.length ? await prisma.rhFuncionario.findMany({ where: { pessoaId: { in: folha.map((p) => p.id) } }, select: { pessoaId: true, nomeCompleto: true, dados: true } }) : [];
  const fi = Object.fromEntries(fichas.map((f) => [f.pessoaId, f]));
  const free = await prisma.prestador.findMany({ where: { ativo: true, tipo: "FREELANCER", funcao: { contains: "MOTORISTA", mode: "insensitive" } }, select: { id: true, nome: true, telefone: true } });
  const emRota = await prisma.rotaBloco.findMany({ where: { status: "EM_EXECUCAO" }, select: { id: true, motoristaId: true } });
  const ocupado = Object.fromEntries(emRota.map((b) => [b.motoristaId, b.id]));
  const usuarios = await prisma.usuario.findMany({ where: { ativo: true, pessoaId: { in: folha.map((p) => p.id) } }, select: { id: true, pessoaId: true } });
  const usu = Object.fromEntries(usuarios.map((u) => [u.pessoaId, u.id]));
  let l = [
    ...folha.map((p) => ({ id: p.id, nome: up(fi[p.id]?.nomeCompleto || p.nome), apelido: up(p.nome), telefone: fi[p.id]?.dados?.telefone || null, origem: "FOLHA", usuarioId: usu[p.id] || null })),
    ...free.map((p) => ({ id: `F${p.id}`, nome: up(p.nome), apelido: up(p.nome), telefone: p.telefone || null, origem: "FREELANCER", usuarioId: null })),
  ];
  // v561 — sem motorista cadastrado pelo cargo/função: o Antônio (folha ativa ou freelancer ativo) entra como motorista
  if (!l.length) {
    const ant = (m?.dados?.pessoal || []).find((p) => p.ativo !== false && /^ANT[OÔ]NIO\b/i.test(String(p.nome || "").trim()));
    if (ant) {
      const f = await prisma.rhFuncionario.findFirst({ where: { pessoaId: ant.id }, select: { nomeCompleto: true, dados: true } }).catch(() => null);
      const us = await prisma.usuario.findFirst({ where: { ativo: true, pessoaId: ant.id }, select: { id: true } }).catch(() => null);
      l = [{ id: ant.id, nome: up(f?.nomeCompleto || ant.nome), apelido: up(ant.nome), telefone: f?.dados?.telefone || null, origem: "FOLHA", usuarioId: us?.id || null }];
    } else {
      const pf = await prisma.prestador.findFirst({ where: { ativo: true, nome: { startsWith: "ANT", mode: "insensitive" } }, select: { id: true, nome: true, telefone: true } }).catch(() => null);
      if (pf && /^ANT[OÔ]NIO\b/i.test(pf.nome)) l = [{ id: `F${pf.id}`, nome: up(pf.nome), apelido: up(pf.nome), telefone: pf.telefone || null, origem: "FREELANCER", usuarioId: null }];
    }
  }
  // v561 — motorista padrão: enquanto houver um só motorista ativo (o Antônio), ele já vem escolhido em todas as rotas
  const unico = l.length === 1;
  return l.map((x) => ({ ...x, emRota: ocupado[x.id] || null, padrao: unico }));
}
export async function motoristaPadrao() { return (await motoristas()).find((x) => x.padrao) || null; }

export async function fabrica() {
  const c = await prisma.finConfig.findUnique({ where: { chave: K_FABRICA } }).catch(() => null);
  try { return c?.valor ? JSON.parse(c.valor) : null; } catch { return null; }
}
export async function salvarFabrica(endereco, geo) {
  const e = String(endereco || "").trim();
  if (!e) return { error: "Informe o endereço da fábrica." };
  const g = geo && geo.endereco === e && geo.lat != null ? geo : await geolocalizar(e);
  if (!g) return { error: "Não encontrei esse endereço no mapa. Confira rua, número, cidade e UF." };
  const v = { endereco: e, lat: g.lat, lng: g.lng };
  await prisma.finConfig.upsert({ where: { chave: K_FABRICA }, create: { chave: K_FABRICA, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } });
  return { ok: true, fabrica: v };
}

// ---------- horário: janela em minutos do dia ----------
const min = (h) => { const m = /^(\d{1,2}):?(\d{2})?/.exec(String(h || "")); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; };
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
export const DIA_INI = 8 * 60, DIA_FIM = 18 * 60;
export function janela(d) {
  const a = min(d.hora1), b = min(d.hora2);
  switch (d.horarioTipo) {
    case "FIXO": return a != null ? [a - 15, a + 15] : [DIA_INI, DIA_FIM];
    case "MANHA": return [DIA_INI, 12 * 60];
    case "TARDE": return [13 * 60, DIA_FIM];
    case "ATE": return [DIA_INI, a ?? DIA_FIM];
    case "APOS": return [a ?? DIA_INI, Math.max(DIA_FIM, (a ?? 0) + 60)];
    case "ENTRE": return [a ?? DIA_INI, b ?? DIA_FIM];
    default: return [DIA_INI, DIA_FIM];
  }
}
export function horarioTxt(d) {
  switch (d.horarioTipo) {
    case "FIXO": return d.hora1 ? `às ${d.hora1}` : "horário a definir";
    case "MANHA": return "manhã";
    case "TARDE": return "tarde";
    case "ATE": return `até as ${d.hora1 || "?"}`;
    case "APOS": return `após as ${d.hora1 || "?"}`;
    case "ENTRE": return `das ${d.hora1 || "?"} às ${d.hora2 || "?"}`;
    default: return "qualquer horário";
  }
}

// ---------- melhor sequência ----------
// distância em linha reta × 1,35 (fator de ruas); velocidade média urbana: carro 28 km/h, moto 34 km/h; 15 min por parada
export function kmEntre(a, b) {
  if (a?.lat == null || b?.lat == null) return 8;   // sem coordenada: estimativa
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.35;
}
const PARADA_MIN = 15;
// v427 — medir(a, b) → { km, min } por ruas (Google) quando houver; senão linha reta × 1,35 na velocidade média
function simular(seq, origem, saida, vel, medir) {
  let t = saida, km = 0, atraso = 0, pos = origem;
  const etas = [];
  const trecho = (a, b) => { const m = medir?.(a, b); if (m) return m; const k = kmEntre(a, b); return { km: k, min: (k / vel) * 60 }; };
  for (const d of seq) {
    const tr = trecho(pos, d); km += tr.km; t += tr.min;
    const [a, b] = janela(d);
    if (t < a) t = a;                       // espera abrir a janela
    const at = Math.max(0, t - b); atraso += at;
    const fica = Number.isFinite(Number(d.tempoLocal)) && d.tempoLocal != null ? Math.max(0, Number(d.tempoLocal)) : PARADA_MIN;   // v439
    etas.push({ id: d.id, chegada: hhmm(t), saida: hhmm(t + fica), tempoLocal: fica, atrasoMin: Math.round(at), janela: [hhmm(a), hhmm(b)] });
    t += fica; pos = d;
  }
  const volta = trecho(pos, origem); km += volta.km; t += volta.min;
  return { km: Math.round(km * 10) / 10, atraso, retorno: hhmm(t), etas, volta: { km: Math.round(volta.km * 10) / 10, min: Math.round(volta.min) } };   // v440
}
const custo = (s) => s.km + s.atraso * 2;   // 1 min de atraso pesa como 2 km
export function otimizar(demandas, origem, { saida = "08:00", veiculo = "CARRO", medir } = {}) {
  const vel = veiculo === "MOTO" ? 34 : 28;
  const t0 = min(saida) ?? DIA_INI;
  const o = origem || demandas[0] || { lat: null, lng: null };
  const lista = [...demandas];
  let melhor = null;
  const avaliar = (seq) => { const s = simular(seq, o, t0, vel, medir); if (!melhor || custo(s) < custo(melhor.s)) melhor = { seq: [...seq], s }; };
  if (lista.length <= 7) {
    const perm = (arr, k = 0) => { if (k === arr.length) return avaliar(arr); for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; } };
    perm(lista);
  } else {
    // vizinho mais próximo ponderando o fim da janela, depois 2-opt
    const rest = [...lista], seq = []; let pos = o;
    while (rest.length) {
      rest.sort((a, b) => kmEntre(pos, a) + janela(a)[1] / 30 - (kmEntre(pos, b) + janela(b)[1] / 30));
      pos = rest.shift(); seq.push(pos);
    }
    avaliar(seq);
    let mudou = true, voltas = 0;
    while (mudou && voltas++ < 50) {
      mudou = false;
      for (let i = 0; i < seq.length - 1; i++) for (let j = i + 1; j < seq.length; j++) {
        const c = [...melhor.seq.slice(0, i), ...melhor.seq.slice(i, j + 1).reverse(), ...melhor.seq.slice(j + 1)];
        const antes = custo(melhor.s); avaliar(c); if (custo(melhor.s) < antes - 1e-6) mudou = true;
      }
    }
  }
  return { ordem: melhor.seq.map((d) => d.id), ...melhor.s };
}
// mesma conta para uma ordem escolhida pelo usuário
export function avaliarOrdem(seq, origem, { saida = "08:00", veiculo = "CARRO", medir } = {}) {
  return { ordem: seq.map((d) => d.id), ...simular(seq, origem || seq[0], min(saida) ?? DIA_INI, veiculo === "MOTO" ? 34 : 28, medir) };
}
// v427 — medidor por ruas (Google Routes, com cache); moto ~15% mais rápida que o carro no tempo
// v441 — data (YYYY-MM-DD) + saída (HH:MM) → trânsito previsto do Google para aquele dia e horário
export function quandoSai(data, saida) {
  const d = data instanceof Date ? data.toISOString().slice(0, 10) : String(data || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return `${d}T${/^\d{2}:\d{2}$/.test(String(saida || "")) ? saida : "08:00"}:00-03:00`;
}
export async function medidorRuas(pontos, veiculo, quando) {
  let m = {};
  try { m = await matrizRuas(pontos, quando); } catch (e) { console.log("rotas/matriz google:", e.message); return { medir: null, erro: e.message }; }
  if (!Object.keys(m).length) return { medir: null };
  const f = veiculo === "MOTO" ? 0.85 : 1;
  return { medir: (a, b) => { if (a?.lat == null || b?.lat == null) return null; const x = m[chaveTrecho(a, b)]; return x ? { km: x.km, min: x.min * f } : null; }, porRuas: true };
}

// ---------- despacho: Google Maps (até 9 paradas por link) + mensagem de WhatsApp ----------
const ponto = (x) => encodeURIComponent(x.endereco || `${x.lat},${x.lng}`);
export function linksMaps(origem, paradas) {
  const pts = [origem, ...paradas, origem].filter(Boolean);
  const links = [];
  for (let i = 0; i < pts.length - 1; i += 10) {
    const trecho = pts.slice(i, i + 11);
    const meio = trecho.slice(1, -1);
    links.push(`https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${ponto(trecho[0])}&destination=${ponto(trecho[trecho.length - 1])}${meio.length ? `&waypoints=${meio.map(ponto).join("%7C")}` : ""}`);
  }
  return links;
}
export function telefoneWa(t) {
  let d = so(t);
  if (!d) return null;
  if (d.length >= 12 && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d.length >= 10 ? d : null;
}
// v446 — mensagem: título de cada parada em negrito, uma linha em branco entre paradas, sem CEP,
// tempo previsto no local e horário estimado de volta à fábrica
const semCep = (e) => String(e || "").replace(/,?\s*(CEP\s*)?\d{5}-?\d{3}\b/gi, "").replace(/\s+,/g, ",").replace(/,\s*$/, "").trim();
export function mensagemWhats(bloco, paradas, links, av, canceladas = []) {
  const eta = Object.fromEntries((av?.etas || []).map((e) => [e.id, e]));
  const blocos = paradas.map((d, i) => {
    const fica = eta[d.id]?.tempoLocal ?? d.tempoLocal ?? PARADA_MIN;
    return [
      `*${i + 1}. ${d.objetivo} · ${d.destinoNome}${d.tarefa ? ` - ${d.tarefa}` : ""}${d.urgente ? " (URGENTE)" : ""}*`,
      semCep(d.endereco),
      d.telefone ? `Contato: ${[d.contato, d.telefone].filter(Boolean).join(" · ")}` : null,
      `Horário: ${horarioTxt(d)}${eta[d.id]?.chegada ? ` · chegada prevista ${eta[d.id].chegada}` : ""}`,
      `Tempo previsto no local: ${fica} min`,
      d.obs ? `Obs: ${d.obs}` : null,
    ].filter(Boolean).join("\n");
  });
  const alt = !!bloco.alteradaEm;   // v454 — rota alterada depois de despachada
  return [`*Rota ${bloco.id}${alt ? " ALTERADA" : ""} · ${iso(bloco.data).split("-").reverse().join("/")}*`, `Motorista: ${bloco.motoristaNome} · ${bloco.veiculo === "MOTO" ? "Moto" : "Carro"}${!alt && bloco.saida ? ` · saída ${bloco.saida}` : ""}`,
    ...(alt ? [canceladas.length ? `*Cancelada${canceladas.length > 1 ? "s" : ""}: ${canceladas.join("; ")}* (não precisa mais ir)` : null, "Paradas que faltam, na nova ordem:"].filter(Boolean) : []), "",
    blocos.join("\n\n"), "", `*Volta à fábrica no final${av?.retorno ? ` · previsão ${av.retorno}` : ""}.*`, "", ...links.map((l, i) => `Mapa${links.length > 1 ? ` (parte ${i + 1})` : ""}: ${l}`), "", "Marque cada parada como concluída no sistema (Logística › Rotas)."].join("\n");
}
async function estimativa(bl, ds, fab) {
  try {
    const { medir } = await medidorRuas([fab, ...ds], bl.veiculo, quandoSai(bl.data, bl.saida));
    return avaliarOrdem(ds, fab, { saida: bl.saida, veiculo: bl.veiculo, medir });
  } catch { return null; }
}

// ---------- leitura ----------
export const demandaOut = (d) => ({ ...d, data: iso(d.data), freteValorMax: d.freteValorMax != null ? Number(d.freteValorMax) : null, horario: horarioTxt(d), janela: janela(d).map(hhmm) });
export async function painel({ de, ate }) {
  const [ds, bs, fab, mots] = await Promise.all([
    prisma.rotaDemanda.findMany({ where: { data: { gte: dUTC(de), lte: dUTC(ate) }, status: { not: "CANCELADA" } }, orderBy: [{ data: "asc" }, { urgente: "desc" }, { ordem: "asc" }, { id: "asc" }] }),
    prisma.rotaBloco.findMany({ where: { OR: [{ data: { gte: dUTC(de), lte: dUTC(ate) } }, { status: "EM_EXECUCAO" }], NOT: { status: "CANCELADO" } }, orderBy: [{ data: "asc" }, { id: "asc" }] }),
    fabrica(), motoristas(),
  ]);
  // v561 — demandas em aberto sem motorista recebem o motorista padrão (o único ativo)
  const pad = mots.find((x) => x.padrao);
  if (pad) {
    const sem = ds.filter((d) => !d.frete && !d.motoristaId && ["ABERTA", "NO_BLOCO"].includes(d.status));
    if (sem.length) {
      await prisma.rotaDemanda.updateMany({ where: { id: { in: sem.map((d) => d.id) } }, data: { motoristaId: pad.id, motoristaNome: pad.nome } }).catch(() => null);
      for (const d of sem) Object.assign(d, { motoristaId: pad.id, motoristaNome: pad.nome });
    }
  }
  const cot = ds.filter((d) => d.admDemandaId).map((d) => d.admDemandaId);
  const adms = cot.length ? await prisma.admDemanda.findMany({ where: { id: { in: cot } }, select: { id: true, status: true, cotacao: true } }) : [];
  const porAdm = Object.fromEntries(adms.map((a) => [a.id, { status: a.status, valor: a.cotacao?.valor ?? null, prazo: a.cotacao?.prazo ?? null, transportadoras: a.cotacao?.transportadoras ?? null, temAnexo: !!a.cotacao?.anexo }]));
  return {
    demandas: ds.map((d) => ({ ...demandaOut(d), cotacao: d.admDemandaId ? porAdm[d.admDemandaId] || null : null })),
    blocos: bs.map((b) => ({ ...b, data: iso(b.data) })), fabrica: fab, motoristas: mots,
  };
}

// ---------- gravação ----------
// v433 — grava o endereço compatível com o Google no cadastro de origem (e deixa o ponto no cache do mapa)
async function guardarGeo(endereco, g) {
  const chave = sem(endereco).slice(0, 300);
  if (!chave || g.lat == null) return;
  const v = { lat: Number(g.lat), lng: Number(g.lng), municipio: g.municipio || null, uf: g.uf || null };
  await prisma.geoCache.upsert({ where: { chave }, create: { chave, ...v }, update: v }).catch(() => null);
}
export async function atualizarCadastroEndereco(tipo, id, g) {
  id = Number(id);
  if (tipo === "TERCEIRIZADO") {
    const p = await prisma.prestador.findUnique({ where: { id }, select: { endereco: true } });
    if (!p || p.endereco === g.endereco) return;
    await prisma.prestador.update({ where: { id }, data: { endereco: g.endereco } });
    return guardarGeo(g.endereco, g);
  }
  if (!g.rua) return;   // sem a rua separada não dá para preencher os campos do cadastro
  const U = (v) => (v ? String(v).toUpperCase().trim() : null);
  const cep = g.cep ? String(g.cep).replace(/\D/g, "") : null;
  const modelo = tipo === "FORNECEDOR" ? prisma.fornecedor : tipo === "CLIENTE" ? prisma.cliente : null;
  if (!modelo) return;
  const a = await modelo.findUnique({ where: { id }, select: { logradouro: true, numero: true, complemento: true, bairro: true, municipio: true, uf: true, cep: true } });
  if (!a) return;
  const novo = { logradouro: U(g.rua), numero: g.numero || a.numero || null, bairro: U(g.bairro) || a.bairro, municipio: U(g.municipio) || a.municipio, uf: U(g.uf) || a.uf, cep: cep || a.cep };
  if (Object.keys(novo).every((k) => String(novo[k] || "") === String(a[k] || ""))) return;
  await modelo.update({ where: { id }, data: novo });
  return guardarGeo(juntaEnd({ ...a, ...novo }), g);
}

export async function salvarDemanda(b, u) {
  const objetivo = OBJETIVOS.includes(b.objetivo) ? b.objetivo : null;
  if (!objetivo) return { error: "Escolha o objetivo: coleta, entrega ou compra." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.data || ""))) return { error: "Informe a data." };
  const destinoNome = up(b.destinoNome);
  const endereco = String(b.endereco || "").trim();
  if (!destinoNome) return { error: "Informe o destinatário." };
  const tarefa = String(b.tarefa || "").replace(/\s+/g, " ").trim();
  if (!tarefa) return { error: "Informe o que fazer lá." };
  if (!endereco) return { error: "Informe o endereço." };
  const horarioTipo = HORARIOS.includes(b.horarioTipo) ? b.horarioTipo : "LIVRE";
  if (["FIXO", "ATE", "APOS", "ENTRE"].includes(horarioTipo) && !min(b.hora1)) return { error: "Informe o horário." };
  if (horarioTipo === "ENTRE" && !min(b.hora2)) return { error: "Informe o horário final." };
  const frete = !!b.frete;
  const freteTipo = frete ? (b.freteTipo === "FRETEBRAS" ? "FRETEBRAS" : b.freteTipo === "TRANSPORTADORA" ? "TRANSPORTADORA" : null) : null;
  if (frete && !freteTipo) return { error: "Escolha transportadora ou Fretebras." };
  const vMax = Number(String(b.freteValorMax ?? "").replace(/\./g, "").replace(",", ".")) || null;
  const vol = parseInt(b.freteVolumes, 10) || null;
  if (freteTipo === "FRETEBRAS" && (!vMax || !vol)) return { error: "Fretebras: informe o valor máximo e o número de volumes." };
  const ant = b.id ? await prisma.rotaDemanda.findUnique({ where: { id: Number(b.id) } }) : null;
  if (ant && ["EM_EXECUCAO", "CONCLUIDA"].includes(ant.status)) return { error: "Demanda em rota ou concluída não pode ser alterada." };
  let geo = ant && ant.endereco === endereco ? { lat: ant.lat, lng: ant.lng, municipio: ant.municipio, uf: ant.uf } : null;
  // v427 — endereço escolhido no autocomplete do Google já vem com as coordenadas
  if (b.geo && b.geo.endereco === endereco && b.geo.lat != null) geo = { lat: Number(b.geo.lat), lng: Number(b.geo.lng), municipio: b.geo.municipio || null, uf: b.geo.uf || null };
  if (!geo) geo = await geolocalizar(endereco);
  // v430 — destinatário novo (fora dos cadastros) entra em Dados › Destinatários
  let destinoTipo = b.destinoTipo || "OUTRO", destinoId = b.destinoId ? Number(b.destinoId) : null;
  if (destinoTipo === "OUTRO" || destinoTipo === "GOOGLE") {
    const ex = await prisma.destinatario.findUnique({ where: { nome: destinoNome } }).catch(() => null);
    const dd = { endereco, lat: geo?.lat ?? null, lng: geo?.lng ?? null, municipio: geo?.municipio || null, uf: geo?.uf || null,
      contato: String(b.contato || "").trim() || null, telefone: String(b.telefone || "").trim() || null };
    const x = ex ? await prisma.destinatario.update({ where: { id: ex.id }, data: { ...dd, ativo: true } })
      : await prisma.destinatario.create({ data: { nome: destinoNome, ...dd, criadoPorNome: nomeU(u) } });
    destinoTipo = "DESTINATARIO"; destinoId = x.id;
  } else if (destinoTipo === "DESTINATARIO" && destinoId && geo?.lat != null) {
    await prisma.destinatario.update({ where: { id: destinoId }, data: { endereco, lat: geo.lat, lng: geo.lng, municipio: geo.municipio || null, uf: geo.uf || null } }).catch(() => null);
  }
  // v433 — endereço escolhido no Google atualiza o cadastro do terceirizado, fornecedor ou cliente
  if (b.geo && b.geo.endereco === endereco && b.geo.lat != null && destinoId && ["TERCEIRIZADO", "FORNECEDOR", "CLIENTE"].includes(destinoTipo))
    await atualizarCadastroEndereco(destinoTipo, destinoId, b.geo).catch((e) => console.log("rotas/cadastro endereço:", e.message));
  const mPad = frete || b.motoristaId ? null : await motoristaPadrao().catch(() => null);   // v561
  const dados = {
    data: dUTC(b.data), objetivo, destinoTipo, destinoId, destinoNome, tarefa: tarefa.slice(0, 200), endereco,
    contato: String(b.contato || "").trim() || null, telefone: String(b.telefone || "").trim() || null,
    lat: geo?.lat ?? null, lng: geo?.lng ?? null, municipio: geo?.municipio || null, uf: geo?.uf || null, regiao: geo ? regiaoDe(geo.municipio, geo.uf) : null,
    horarioTipo, hora1: b.hora1 || null, hora2: horarioTipo === "ENTRE" ? b.hora2 || null : null,
    motoristaId: frete ? null : b.motoristaId || mPad?.id || null, motoristaNome: frete ? null : up(b.motoristaNome) || (b.motoristaId ? null : mPad?.nome) || null, veiculo: frete ? null : VEICULOS.includes(b.veiculo) ? b.veiculo : null,
    urgente: !!b.urgente, frete, freteTipo, freteValorMax: freteTipo === "FRETEBRAS" ? vMax : null, freteVolumes: frete ? vol : null,
    obs: String(b.obs || "").trim() || null,
    ...(b.ocId ? { ocId: Number(b.ocId) || null } : {}),   // v486 — rota de coleta criada pela OC
    tempoLocal: b.tempoLocal === "" || b.tempoLocal == null ? null : Math.min(600, Math.max(0, parseInt(b.tempoLocal, 10) || 0)),   // v442
  };
  let d = ant ? await prisma.rotaDemanda.update({ where: { id: ant.id }, data: dados })
    : await prisma.rotaDemanda.create({ data: { ...dados, criadoPorId: u.id, criadoPorNome: nomeU(u) } });
  // v450 — criada pela tarefa PROGRAMAR ENTREGA do pedido: a tarefa conclui
  if (b.admOrigemId) { try { const { rotaCriada } = await import("@/lib/faturamentoFluxo"); await rotaCriada(b.admOrigemId, d); } catch (e) { console.log("rotas/adm:", e.message); } }
  // transportadora: demanda ADM de cotação (uma por demanda de rota)
  if (freteTipo === "TRANSPORTADORA" && !d.admDemandaId) {
    const dBR = b.data.split("-").reverse().join("/");
    const adm = await prisma.admDemanda.create({ data: {
      titulo: `COTAR FRETE · ${objetivo} · ${destinoNome} - ${tarefa}`.slice(0, 200), tipo: "COTACAO_FRETE", rotaDemandaId: d.id,
      descricao: [`Demanda de rota #${d.id} para ${dBR} (${horarioTxt(d)}).`, `Destino: ${endereco}`, dados.freteVolumes ? `Volumes: ${dados.freteVolumes}` : null, dados.obs ? `Obs: ${dados.obs}` : null,
        "Concluir anexando a cotação, com valor, prazo de entrega e as transportadoras cotadas."].filter(Boolean).join("\n"),
      prazo: dUTC(b.data), prioridade: d.urgente ? "URGENTE" : "NORMAL", criadoPorId: u.id, criadoPorNome: nomeU(u) } });
    d = await prisma.rotaDemanda.update({ where: { id: d.id }, data: { admDemandaId: adm.id } });
    const adms = await prisma.usuario.findMany({ where: { ativo: true, setor: "ADMINISTRATIVO" }, select: { id: true } });
    const para = adms.map((x) => x.id).filter((x) => x !== u.id);
    if (para.length) await prisma.mensagem.createMany({ data: para.map((paraId) => ({ deId: u.id, paraId, texto: `NOVA DEMANDA ADM${d.urgente ? " (URGENTE)" : ""}: ${adm.titulo} · PARA ${dBR} — VER EM ADM › DEMANDAS ADM.` })) }).catch(() => null);
  }
  return { ok: true, demanda: demandaOut(d), semMapa: d.lat == null, consolidar: await parecidas(d) };   // v467
}

// v467 — mesmo destinatário, mesmo dia e mesmo horário: candidatas a virar uma demanda só
const mesmoDestino = (a, b) => (a.destinoId && b.destinoId && a.destinoTipo === b.destinoTipo ? a.destinoId === b.destinoId : up(a.destinoNome) === up(b.destinoNome));
const mesmoHorario = (a, b) => a.horarioTipo === b.horarioTipo && (a.hora1 || "") === (b.hora1 || "") && (a.hora2 || "") === (b.hora2 || "");
const juntavel = (d) => ["ABERTA", "NO_BLOCO"].includes(d.status) && !d.frete;
async function parecidas(d) {
  if (!juntavel(d)) return [];
  const l = await prisma.rotaDemanda.findMany({ where: { data: d.data, id: { not: d.id }, status: { in: ["ABERTA", "NO_BLOCO"] }, frete: false } });
  return l.filter((x) => mesmoDestino(x, d) && mesmoHorario(x, d) && !(x.blocoId && d.blocoId && x.blocoId !== d.blocoId))
    .map((x) => ({ id: x.id, tarefa: x.tarefa, objetivo: x.objetivo }));
}
export async function consolidarDemandas(ids, u) {
  const l = await prisma.rotaDemanda.findMany({ where: { id: { in: (ids || []).map(Number).filter(Boolean) } }, orderBy: { id: "asc" } });
  if (l.length < 2) return { error: "Escolha ao menos duas demandas." };
  if (l.some((x) => !juntavel(x))) return { error: "Só junta demandas abertas ou em rota ainda não despachada (sem frete)." };
  if (l.some((x) => !mesmoDestino(x, l[0]) || !mesmoHorario(x, l[0]) || +x.data !== +l[0].data)) return { error: "As demandas precisam ser do mesmo destinatário, dia e horário." };
  const blocos = [...new Set(l.map((x) => x.blocoId).filter(Boolean))];
  if (blocos.length > 1) return { error: "As demandas estão em rotas diferentes." };
  const fica = l.find((x) => x.blocoId) || l[0], saem = l.filter((x) => x.id !== fica.id);
  const tarefas = [...new Set(l.map((x) => String(x.tarefa || "").trim()).filter(Boolean))];
  const objs = [...new Set(l.map((x) => x.objetivo))];
  const obs = [...new Set(l.map((x) => x.obs).filter(Boolean))].join(" · ") || null;
  const tl = l.map((x) => x.tempoLocal).filter((x) => x != null);
  const d = await prisma.rotaDemanda.update({ where: { id: fica.id }, data: {
    tarefa: tarefas.join(" + ").slice(0, 200), objetivo: objs.length === 1 ? objs[0] : fica.objetivo, urgente: l.some((x) => x.urgente), obs,
    tempoLocal: tl.length ? Math.min(600, Math.max(...tl) + 5 * (l.length - 1)) : null,
    motoristaId: fica.motoristaId || l.find((x) => x.motoristaId)?.motoristaId || null, motoristaNome: fica.motoristaNome || l.find((x) => x.motoristaNome)?.motoristaNome || null,
  } });
  for (const x of saem) await prisma.rotaDemanda.update({ where: { id: x.id }, data: { status: "CANCELADA", blocoId: null, ordem: null, obs: [x.obs, `Consolidada na demanda #${fica.id} por ${nomeU(u) || "?"}`].filter(Boolean).join(" · ") } });
  return { ok: true, demanda: demandaOut(d), juntadas: saem.map((x) => x.id) };
}

// v453 — pode cancelar mesmo em rota em execução: sai da rota, os links do Maps são refeitos e o motorista é avisado
export async function cancelarDemanda(id, u) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d) return { error: "Demanda não encontrada." };
  if (d.status === "CONCLUIDA") return { error: "Demanda já concluída." };
  if (d.status === "CANCELADA") return { ok: true };
  const obs = d.status === "EM_EXECUCAO" ? [d.obs, `Cancelada em rota por ${nomeU(u) || "?"}`].filter(Boolean).join(" · ") : d.obs;
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { status: "CANCELADA", blocoId: null, ordem: null, obs } });
  if (d.status === "EM_EXECUCAO" && d.blocoId) {
    const bl = await prisma.rotaBloco.findUnique({ where: { id: d.blocoId } });
    if (bl && bl.status === "EM_EXECUCAO") {
      const ds = await prisma.rotaDemanda.findMany({ where: { blocoId: bl.id, status: { not: "CANCELADA" } }, orderBy: { ordem: "asc" } });
      // v461 — rota ficou sem nenhuma parada: encerra sozinha e o motorista volta a ficar disponível
      if (!ds.length) { await prisma.rotaBloco.update({ where: { id: bl.id }, data: { status: "CANCELADO", links: [] } }); return { ok: true, blocoId: null, rotaEncerrada: bl.id }; }
      const fab = await fabrica();
      const links = !ds.length ? [] : fab ? linksMaps(fab, ds) : linksMaps(ds[0], ds.slice(1));
      await prisma.rotaBloco.update({ where: { id: bl.id }, data: { links } }).catch(() => null);
      const usu = bl.motoristaId && !bl.motoristaId.startsWith("F") ? await prisma.usuario.findFirst({ where: { ativo: true, pessoaId: bl.motoristaId }, select: { id: true } }) : null;
      if (usu && u?.id && usu.id !== u.id) await prisma.mensagem.create({ data: { deId: u.id, paraId: usu.id, texto: `PARADA CANCELADA NA SUA ROTA: ${d.destinoNome}${d.tarefa ? ` - ${d.tarefa}` : ""}. NÃO PRECISA MAIS IR LÁ.` } }).catch(() => null);
    }
  }
  return { ok: true, blocoId: d.status === "EM_EXECUCAO" ? d.blocoId : null };
}

// v454 — rota em execução alterada (ex.: parada cancelada): nova ordem das paradas que faltam, links do Maps
// partindo de onde o motorista está e mensagem nova com o título "Rota N ALTERADA"
export async function alterarBloco(b, u) {
  const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(b.id) } });
  if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota não está em execução." };
  const todas = await prisma.rotaDemanda.findMany({ where: { blocoId: bl.id, status: { not: "CANCELADA" } }, orderBy: { ordem: "asc" } });
  const feitas = todas.filter((d) => d.status === "CONCLUIDA");
  const pend = todas.filter((d) => d.status !== "CONCLUIDA");
  const ids = (b.ordem || []).map(Number).filter(Boolean);
  const porId = Object.fromEntries(pend.map((d) => [d.id, d]));
  if (ids.length !== pend.length || ids.some((i) => !porId[i])) return { error: "A rota mudou enquanto você editava. Feche e abra de novo." };
  const tl = tempos(b.tempos);
  const seq = ids.map((i) => (tl[i] != null ? { ...porId[i], tempoLocal: tl[i] } : porId[i]));
  for (const [i, d] of seq.entries()) await prisma.rotaDemanda.update({ where: { id: d.id }, data: { ordem: feitas.length + i + 1, tempoLocal: d.tempoLocal ?? null } });
  const fab = await fabrica();
  // o 1º link sai da posição atual do motorista (sem origem, o Google Maps usa a localização do celular)
  const links = !seq.length ? [] : (fab ? linksMaps(fab, seq) : linksMaps(seq[0], seq.slice(1))).map((l, i) => (i === 0 && fab ? l.replace(/&origin=[^&]*/, "") : l));
  const n = await prisma.rotaBloco.update({ where: { id: bl.id }, data: { links, alteradaEm: new Date() } });
  const canceladas = (b.canceladas || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
  const texto = mensagemWhats(n, seq, links, null, canceladas);
  const tel = telefoneWa(await telefoneAtual(n));
  const usu = n.motoristaId && !n.motoristaId.startsWith("F") ? await prisma.usuario.findFirst({ where: { ativo: true, pessoaId: n.motoristaId }, select: { id: true } }) : null;
  if (usu) await notificar(usu.id, { titulo: `Rota R${n.id} alterada`, texto: canceladas.length ? `Cancelada: ${canceladas.join("; ")}. Veja a nova ordem.` : "Veja a nova ordem das paradas.", tag: `rota-${n.id}` }).catch(() => null);   // v466
  if (usu && u?.id && usu.id !== u.id) await prisma.mensagem.create({ data: { deId: u.id, paraId: usu.id, texto: `SUA ROTA ${n.id} FOI ALTERADA${canceladas.length ? ` (CANCELADA: ${canceladas.join("; ").toUpperCase()})` : ""}. VEJA A NOVA ORDEM NO APP.` } }).catch(() => null);
  return { ok: true, alterada: true, bloco: { ...n, data: iso(n.data) }, whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null, texto };
}

// v463 — posição do celular do motorista (app aberto) na rota em execução dele
export async function registrarPosicao(pessoaId, lat, lng, rumo) {
  const la = Number(lat), lo = Number(lng);
  if (!pessoaId || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return { ok: false };
  const bs = await prisma.rotaBloco.findMany({ where: { motoristaId: pessoaId, status: "EM_EXECUCAO" } });
  if (!bs.length) return { ok: true, rotas: 0 };
  const a = bs[0];
  const novo = { lat: la, lng: lo };
  // v485 — direção: a do celular quando vem; senão, calculada pelo deslocamento desde a última posição
  let dir = Number.isFinite(Number(rumo)) && rumo !== null && rumo !== "" ? Number(rumo) : null;
  if (dir == null && a.posLat != null && kmEntre({ lat: a.posLat, lng: a.posLng }, novo) > 0.015) {
    const rad = (x) => (x * Math.PI) / 180, y = Math.sin(rad(lo - a.posLng)) * Math.cos(rad(la)), x = Math.cos(rad(a.posLat)) * Math.sin(rad(la)) - Math.sin(rad(a.posLat)) * Math.cos(rad(la)) * Math.cos(rad(lo - a.posLng));
    dir = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  // rua e bairro: só consulta de novo quando andou mais de 40 m
  let end = {};
  if (!a.posEndereco || a.posEndLat == null || kmEntre({ lat: a.posEndLat, lng: a.posEndLng }, novo) > 0.04) {
    const e = await enderecoReverso(la, lo).catch(() => null);
    if (e) end = { posEndereco: e, posEndLat: la, posEndLng: lo };
  }
  const r = await prisma.rotaBloco.updateMany({ where: { motoristaId: pessoaId, status: "EM_EXECUCAO" }, data: { posLat: la, posLng: lo, posEm: new Date(), ...(dir != null ? { posRumo: Math.round(dir) } : {}), ...end } });
  return { ok: true, rotas: r.count };
}
// v463 — painel ao vivo: o que cada motorista em rota está fazendo agora e a previsão de volta à fábrica
const POS_FRESCA_MIN = 10;
export async function aoVivo() {
  const bs = await prisma.rotaBloco.findMany({ where: { status: "EM_EXECUCAO" }, orderBy: { despachadoEm: "asc" } });
  if (!bs.length) return { rotas: [] };
  const ds = await prisma.rotaDemanda.findMany({ where: { blocoId: { in: bs.map((b) => b.id) }, status: { not: "CANCELADA" } }, orderBy: { ordem: "asc" } });
  const fab = await fabrica();
  const agora = new Date(), agoraMin = (() => { const x = new Date(agora.getTime() - 3 * 3600e3); return x.getUTCHours() * 60 + x.getUTCMinutes(); })();
  const desde = (d) => (d ? (agora - new Date(d)) / 60000 : 0);
  const rotas = [];
  for (const bl of bs) {
    const l = ds.filter((d) => d.blocoId === bl.id);
    const feitas = l.filter((d) => d.status === "CONCLUIDA"), pend = l.filter((d) => d.status !== "CONCLUIDA");
    const ultima = feitas.length ? feitas[feitas.length - 1] : null;
    const prox = pend[0] || null;
    const gpsMin = bl.posEm ? desde(bl.posEm) : null;
    const gps = gpsMin != null && gpsMin <= POS_FRESCA_MIN ? { lat: bl.posLat, lng: bl.posLng } : null;
    const vel = bl.veiculo === "MOTO" ? 34 : 28;
    let medir = null;
    try { ({ medir } = await medidorRuas([fab, ...l].filter(Boolean), bl.veiculo, quandoSai(bl.data, bl.saida))); } catch { medir = null; }
    const trecho = (a, b) => { const m = medir?.(a, b); if (m) return m; const k = kmEntre(a, b); return { km: k, min: (k / vel) * 60 }; };
    // fase atual
    let fase, alvo = null;
    if (prox) {
      if (prox.iniciadaEm) { fase = "INDO"; alvo = prox.id; }
      else if (ultima) fase = "NA_PARADA";
      else fase = "SAINDO";
    } else fase = bl.voltaIniciadaEm ? "VOLTANDO" : "FIM_PARADAS";
    // previsão a partir de agora (posição do celular quando houver)
    let t = agoraMin, pos = gps || ultima || fab;
    const etas = {};
    pend.forEach((d, i) => {
      const tr = trecho(pos, d);
      let m = tr.min;
      if (i === 0 && !gps && d.iniciadaEm) m = Math.max(2, m - desde(d.iniciadaEm));   // já está a caminho
      t += m;
      const [a] = janela(d); if (t < a) t = a;
      etas[d.id] = hhmm(t);
      t += d.tempoLocal != null ? Math.max(0, Number(d.tempoLocal)) : PARADA_MIN;
      pos = d;
    });
    let volta = fab ? trecho(pos, fab).min : 0;
    if (!pend.length && bl.voltaIniciadaEm && !gps) volta = Math.max(2, volta - desde(bl.voltaIniciadaEm));
    t += volta;
    rotas.push({
      id: bl.id, motoristaId: bl.motoristaId, motoristaNome: bl.motoristaNome, veiculo: bl.veiculo, despachadoEm: bl.despachadoEm, alterada: !!bl.alteradaEm,
      fase, alvo, retornoPrevisto: fab ? hhmm(t) : null,
      posicao: bl.posEm ? { lat: bl.posLat, lng: bl.posLng, minAtras: Math.round(gpsMin), fresca: !!gps, rumo: bl.posRumo, endereco: bl.posEndereco || null } : null,
      paradas: l.map((d) => ({ id: d.id, nome: d.destinoNome, tarefa: d.tarefa, objetivo: d.objetivo, status: d.status === "CONCLUIDA" ? "FEITA" : d.id === alvo ? "INDO" : "PENDENTE",
        concluidaEm: d.concluidaEm, eta: etas[d.id] || null })),
    });
  }
  return { rotas, agora: hhmm(agoraMin) };
}

// v465 — reativar demanda concluída por engano: volta para a rota se ela ainda está em execução; senão fica aberta para outra rota
export async function reativarDemanda(id, u) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d) return { error: "Demanda não encontrada." };
  if (d.status !== "CONCLUIDA") return { error: "Só demanda concluída pode ser reativada." };
  const bl = d.blocoId ? await prisma.rotaBloco.findUnique({ where: { id: d.blocoId } }) : null;
  const nota = [d.obs, `Reativada por ${nomeU(u) || "?"}`].filter(Boolean).join(" · ");
  if (bl?.status === "EM_EXECUCAO") {
    await prisma.rotaDemanda.update({ where: { id: d.id }, data: { status: "EM_EXECUCAO", concluidaEm: null, concluidaPorNome: null, obs: nota } });
    if (bl.voltaIniciadaEm) await prisma.rotaBloco.update({ where: { id: bl.id }, data: { voltaIniciadaEm: null } });
    return { ok: true, naRota: bl.id };
  }
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { status: "ABERTA", blocoId: null, ordem: null, iniciadaEm: null, concluidaEm: null, concluidaPorNome: null, obs: nota } });
  return { ok: true, naRota: null };
}

// v507 — concluir a demanda direto no calendário, mesmo sem rota (ex.: alguém resolveu por fora)
export async function concluirDemandaAvulsa(id, u) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d) return { error: "Demanda não encontrada." };
  if (d.status === "CONCLUIDA") return { ok: true };
  if (d.status === "CANCELADA") return { error: "Demanda cancelada." };
  if (d.status === "EM_EXECUCAO") return concluirParada(d.id, u);   // está numa rota em andamento: conclui como parada
  const sai = d.blocoId && d.status === "NO_BLOCO" ? d.blocoId : null;   // estava numa rota ainda em montagem: sai dela
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u), blocoId: null, ordem: null,
    obs: [d.obs, `Concluída sem rota por ${nomeU(u) || "?"}`].filter(Boolean).join(" · ") } });
  if (sai && !(await prisma.rotaDemanda.count({ where: { blocoId: sai } }))) await prisma.rotaBloco.update({ where: { id: sai }, data: { status: "CANCELADO" } }).catch(() => null);
  return { ok: true };
}

// v461 — "motorista está na fábrica": encerra as rotas em execução dele (lançadas por engano ou esquecidas).
// Paradas concluídas ficam; as que faltam voltam a ficar abertas para outra rota.
export async function liberarMotorista(motoristaId, u) {
  if (!motoristaId) return { error: "Motorista?" };
  const bs = await prisma.rotaBloco.findMany({ where: { motoristaId: String(motoristaId), status: "EM_EXECUCAO" } });
  let reabertas = 0;
  for (const bl of bs) {
    const r = await prisma.rotaDemanda.updateMany({ where: { blocoId: bl.id, status: { notIn: ["CONCLUIDA", "CANCELADA"] } }, data: { blocoId: null, ordem: null, status: "ABERTA", iniciadaEm: null } });
    reabertas += r.count;
    const feitas = await prisma.rotaDemanda.count({ where: { blocoId: bl.id, status: "CONCLUIDA" } });
    await prisma.rotaBloco.update({ where: { id: bl.id }, data: feitas ? { status: "CONCLUIDO", retornoEm: new Date() } : { status: "CANCELADO" } });
  }
  await limparRetornos();   // v521
  return { ok: true, rotas: bs.map((b) => b.id), reabertas, porNome: nomeU(u) };
}

// v439 — { id: minutos } vindo da tela (0 a 600 min)
export function tempos(t) {
  const o = {};
  for (const [k, v] of Object.entries(t || {})) { const n = parseInt(v, 10); if (Number.isFinite(n)) o[Number(k)] = Math.min(600, Math.max(0, n)); }
  return o;
}
// monta (ou remonta) um bloco com a ordem escolhida
export async function salvarBloco(b, u) {
  const ids = (b.ordem || []).map(Number).filter(Boolean);
  if (!ids.length) return { error: "Escolha as demandas." };
  const mot = (await motoristas()).find((m) => m.id === b.motoristaId);
  if (!mot) return { error: "Escolha o motorista." };
  const ds = await prisma.rotaDemanda.findMany({ where: { id: { in: ids } } });
  if (ds.some((d) => d.frete)) return { error: "Demanda de frete é contratada à parte e não entra na rota." };
  if (ds.some((d) => ["EM_EXECUCAO", "CONCLUIDA", "CANCELADA"].includes(d.status) || (d.blocoId && d.blocoId !== Number(b.id || 0)))) return { error: "Alguma demanda já está em outra rota ou foi concluída." };
  const porId = Object.fromEntries(ds.map((d) => [d.id, d]));
  const tl = tempos(b.tempos);   // v439 — tempo previsto no local
  const seq = ids.map((i) => porId[i]).filter(Boolean).map((d) => (tl[d.id] != null ? { ...d, tempoLocal: tl[d.id] } : d));
  const fab = await fabrica();
  const { medir } = await medidorRuas([fab, ...seq], b.veiculo, quandoSai(seq[0].data, b.saida));
  const av = avaliarOrdem(seq, fab, { saida: b.saida, veiculo: b.veiculo, medir });
  const dados = { data: seq[0].data, motoristaId: mot.id, motoristaNome: mot.nome, telefone: mot.telefone || null, veiculo: VEICULOS.includes(b.veiculo) ? b.veiculo : "CARRO",
    saida: b.saida || null, distanciaKm: av.km, links: fab ? linksMaps(fab, seq) : linksMaps(seq[0], seq.slice(1)) };
  let bl;
  if (b.id) {
    bl = await prisma.rotaBloco.findUnique({ where: { id: Number(b.id) } });
    if (!bl || bl.status !== "MONTAGEM") return { error: "Rota já despachada." };
    await prisma.rotaDemanda.updateMany({ where: { blocoId: bl.id, id: { notIn: ids } }, data: { blocoId: null, ordem: null, status: "ABERTA" } });
    bl = await prisma.rotaBloco.update({ where: { id: bl.id }, data: dados });
  } else bl = await prisma.rotaBloco.create({ data: { ...dados, criadoPorNome: nomeU(u) } });
  for (const [i, d] of seq.entries()) await prisma.rotaDemanda.update({ where: { id: d.id }, data: { blocoId: bl.id, ordem: i + 1, status: "NO_BLOCO", tempoLocal: d.tempoLocal ?? null, motoristaId: mot.id, motoristaNome: mot.nome, veiculo: dados.veiculo } });
  await limparRetornos();   // v521
  return { ok: true, bloco: { ...bl, data: iso(bl.data) }, avaliacao: av };
}

export async function despachar(id) {
  const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(id) } });
  if (!bl) return { error: "Rota não encontrada." };
  if (bl.status !== "MONTAGEM") return { error: "Rota já despachada." };
  const ocupado = await prisma.rotaBloco.findFirst({ where: { motoristaId: bl.motoristaId, status: "EM_EXECUCAO", NOT: { id: bl.id } } });
  if (ocupado) return { error: `${bl.motoristaNome} ainda está na rota ${ocupado.id}. Ele fica disponível quando concluir o retorno à fábrica.` };
  const ds = await prisma.rotaDemanda.findMany({ where: { blocoId: bl.id }, orderBy: { ordem: "asc" } });
  const fab = await fabrica();
  const links = fab ? linksMaps(fab, ds) : linksMaps(ds[0], ds.slice(1));
  const n = await prisma.rotaBloco.update({ where: { id: bl.id }, data: { status: "EM_EXECUCAO", despachadoEm: new Date(), links } });
  await prisma.rotaDemanda.updateMany({ where: { blocoId: bl.id }, data: { status: "EM_EXECUCAO" } });
  const tel = telefoneWa(await telefoneAtual(bl));   // v449
  const texto = mensagemWhats(n, ds, links, await estimativa(n, ds, fab));
  // motorista com usuário no sistema também recebe a rota por mensagem
  const usu = bl.motoristaId && !bl.motoristaId.startsWith("F") ? await prisma.usuario.findFirst({ where: { ativo: true, pessoaId: bl.motoristaId }, select: { id: true } }) : null;
  return { ok: true, bloco: { ...n, data: iso(n.data) }, whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null, texto, usuarioMotorista: usu?.id || null, nParadas: ds.length };
}

// v449 — telefone do motorista lido na hora (ficha do RH ou freelancer); atualiza a rota se mudou
async function telefoneAtual(bl) {
  const m = (await motoristas().catch(() => [])).find((x) => x.id === bl.motoristaId);
  const t = m?.telefone || bl.telefone || null;
  if (t && t !== bl.telefone) await prisma.rotaBloco.update({ where: { id: bl.id }, data: { telefone: t } }).catch(() => null);
  return t;
}
// v443 — mensagem da rota (para copiar ou reenviar no WhatsApp) a qualquer momento, sem mudar o status
export async function mensagemBloco(id) {
  const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(id) } });
  if (!bl) return { error: "Rota não encontrada." };
  let ds = await prisma.rotaDemanda.findMany({ where: { blocoId: bl.id, status: { not: "CANCELADA" } }, orderBy: { ordem: "asc" } });
  const fab = await fabrica();
  if (bl.alteradaEm) ds = ds.filter((d) => d.status !== "CONCLUIDA");   // v454 — rota alterada: só o que falta
  const links = bl.links?.length ? bl.links : fab ? linksMaps(fab, ds) : linksMaps(ds[0], ds.slice(1));
  const texto = mensagemWhats(bl, ds, links, bl.alteradaEm ? null : await estimativa(bl, ds, fab));
  const tel = telefoneWa(await telefoneAtual(bl));   // v449 — telefone atual da ficha (pode ter sido cadastrado depois da rota)
  return { ok: true, bloco: { ...bl, data: iso(bl.data), links }, whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null, texto };
}

export async function concluirParada(id, u, desfazer = false) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d || !d.blocoId) return { error: "Parada não encontrada." };
  const bl = await prisma.rotaBloco.findUnique({ where: { id: d.blocoId } });
  if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota não está em execução." };
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: desfazer ? { status: "EM_EXECUCAO", concluidaEm: null, concluidaPorNome: null } : { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u) } });
  return { ok: true };
}

// v452 — app do motorista: as rotas dele (em execução e as próximas montadas), com as paradas em ordem
export async function minhasRotas(pessoaId) {
  if (!pessoaId) return { rotas: [], fabrica: await fabrica() };
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const bs = await prisma.rotaBloco.findMany({ where: { motoristaId: pessoaId, OR: [{ status: "EM_EXECUCAO" }, { status: "MONTAGEM", data: { gte: dUTC(hoje) } }, { status: "CONCLUIDO", data: { gte: dUTC(hoje) } }] },
    orderBy: [{ data: "asc" }, { id: "asc" }] });
  const ds = bs.length ? await prisma.rotaDemanda.findMany({ where: { blocoId: { in: bs.map((b) => b.id) }, status: { not: "CANCELADA" } }, orderBy: { ordem: "asc" } }) : [];
  const ordemSt = { EM_EXECUCAO: 0, MONTAGEM: 1, CONCLUIDO: 2 };
  return {
    fabrica: await fabrica(),
    rotas: bs.sort((a, b) => (ordemSt[a.status] - ordemSt[b.status]) || (a.data - b.data)).map((b) => ({ ...b, data: iso(b.data), paradas: ds.filter((d) => d.blocoId === b.id).map(demandaOut) })),
  };
}
// v452 — o motorista inicia uma perna: até a parada (id) ou a volta à fábrica (volta)
export async function iniciarPerna({ id, blocoId, volta }) {
  if (volta) {
    const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(blocoId) } });
    if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota não está em execução." };
    const faltam = await prisma.rotaDemanda.count({ where: { blocoId: bl.id, status: { not: "CONCLUIDA" } } });
    if (faltam) return { error: `Ainda falta concluir ${faltam} parada(s).` };
    await prisma.rotaBloco.update({ where: { id: bl.id }, data: { voltaIniciadaEm: bl.voltaIniciadaEm || new Date() } });
    return { ok: true };
  }
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d?.blocoId) return { error: "Parada não encontrada." };
  const bl = await prisma.rotaBloco.findUnique({ where: { id: d.blocoId } });
  if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota ainda não foi despachada." };
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { iniciadaEm: d.iniciadaEm || new Date() } });
  return { ok: true };
}

export async function registrarRetorno(id) {
  const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(id) } });
  if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota não está em execução." };
  const faltam = await prisma.rotaDemanda.count({ where: { blocoId: bl.id, status: { not: "CONCLUIDA" } } });
  if (faltam) return { error: `Ainda falta concluir ${faltam} parada(s) antes do retorno.` };
  const n = await prisma.rotaBloco.update({ where: { id: bl.id }, data: { status: "CONCLUIDO", retornoEm: new Date() } });
  return { ok: true, bloco: { ...n, data: iso(n.data) } };
}

export async function desfazerBloco(id) {
  const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(id) } });
  if (!bl) return { error: "Rota não encontrada." };
  if (bl.status === "CONCLUIDO") return { error: "Rota já concluída." };
  if (bl.status === "EM_EXECUCAO" && (await prisma.rotaDemanda.count({ where: { blocoId: bl.id, status: "CONCLUIDA" } }))) return { error: "Já há parada concluída nessa rota." };
  await prisma.rotaDemanda.updateMany({ where: { blocoId: bl.id }, data: { blocoId: null, ordem: null, status: "ABERTA" } });
  await prisma.rotaBloco.update({ where: { id: bl.id }, data: { status: "CANCELADO" } });
  await limparRetornos();   // v521
  return { ok: true };
}

// v430 — Dados › Destinatários
export async function listarDestinatarios() {
  const l = await prisma.destinatario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
  const usos = await prisma.rotaDemanda.groupBy({ by: ["destinoId"], where: { destinoTipo: "DESTINATARIO" }, _count: { _all: true } }).catch(() => []);
  const n = Object.fromEntries(usos.map((x) => [x.destinoId, x._count._all]));
  return l.map((x) => ({ ...x, demandas: n[x.id] || 0 }));
}
export async function salvarDestinatario(b, u) {
  const nome = up(b.nome), endereco = String(b.endereco || "").trim();
  if (!nome) return { error: "Informe o nome." };
  if (!endereco) return { error: "Informe o endereço." };
  const ant = b.id ? await prisma.destinatario.findUnique({ where: { id: Number(b.id) } }) : null;
  let geo = b.geo && b.geo.endereco === endereco && b.geo.lat != null ? b.geo : ant && ant.endereco === endereco ? ant : await geolocalizar(endereco);
  const data = { nome, endereco, lat: geo?.lat ?? null, lng: geo?.lng ?? null, municipio: geo?.municipio || null, uf: geo?.uf || null,
    contato: String(b.contato || "").trim() || null, telefone: String(b.telefone || "").trim() || null, obs: String(b.obs || "").trim() || null };
  try {
    const x = ant ? await prisma.destinatario.update({ where: { id: ant.id }, data }) : await prisma.destinatario.create({ data: { ...data, criadoPorNome: nomeU(u) } });
    return { ok: true, destinatario: x, semMapa: x.lat == null };
  } catch (e) { if (String(e.code) === "P2002") return { error: "Já existe um destinatário com esse nome." }; throw e; }
}
export async function excluirDestinatario(id) {
  await prisma.destinatario.update({ where: { id: Number(id) }, data: { ativo: false } });
  return { ok: true };
}

// ---------- v521 — retorno à fábrica no meio da rota (sugestão #19) ----------
// é uma parada como as outras (objetivo RETORNO, destino FÁBRICA): entra na ordem, no Maps e na mensagem
async function novaParadaRetorno(data, u, extra = {}) {
  const fab = await fabrica();
  if (!fab?.endereco) return { error: "Cadastre o endereço da fábrica (botão Fábrica)." };
  const d = await prisma.rotaDemanda.create({ data: {
    data, objetivo: "RETORNO", destinoTipo: "FABRICA", destinoNome: "FÁBRICA", tarefa: "RETORNO À FÁBRICA", endereco: fab.endereco,
    lat: fab.lat ?? null, lng: fab.lng ?? null, municipio: fab.municipio || null, uf: fab.uf || null, regiao: "RMBH",
    horarioTipo: "LIVRE", tempoLocal: 20, criadoPorId: u?.id || null, criadoPorNome: nomeU(u), ...extra } });
  return { d };
}
// demanda de retorno solta (rota desfeita, removida da rota, motorista liberado) não fica no calendário
async function limparRetornos() {
  await prisma.rotaDemanda.updateMany({ where: { objetivo: "RETORNO", blocoId: null, status: { in: ["ABERTA", "NO_BLOCO"] } }, data: { status: "CANCELADA" } }).catch(() => null);
}
// montagem da rota: cria a parada de retorno para entrar na ordem (fica solta até a rota ser salva)
export async function criarRetorno(b, u) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.data || ""))) return { error: "Informe a data." };
  const r = await novaParadaRetorno(dUTC(b.data), u);
  if (r.error) return r;
  return { ok: true, demanda: demandaOut(r.d) };
}
// rota em execução: retorno vira a PRÓXIMA parada. Motorista precisa justificar; quem monta as rotas não.
export async function retornoNaRota(b, u, pode) {
  const bl = await prisma.rotaBloco.findUnique({ where: { id: Number(b.blocoId) } });
  if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota não está em execução." };
  if (!pode && bl.motoristaId !== u.pessoaId) return { error: "Só o motorista da rota ou quem monta as rotas." };
  const just = String(b.justificativa || "").replace(/\s+/g, " ").trim();
  if (!pode && just.length < 5) return { error: "Escreva a justificativa do retorno à fábrica." };
  const ds = await prisma.rotaDemanda.findMany({ where: { blocoId: bl.id, status: { not: "CANCELADA" } }, orderBy: { ordem: "asc" } });
  const pend = ds.filter((d) => d.status !== "CONCLUIDA");
  if (!pend.length) return { error: "Não há paradas pendentes: é só iniciar a volta à fábrica." };
  if (pend[0].objetivo === "RETORNO") return { error: "O retorno à fábrica já é a próxima parada." };
  const pos = pend[0].ordem ?? (ds.length + 1);
  for (const d of [...ds].reverse()) if ((d.ordem ?? 0) >= pos) await prisma.rotaDemanda.update({ where: { id: d.id }, data: { ordem: (d.ordem ?? 0) + 1 } });
  const quem = nomeU(u) || "?";
  const r = await novaParadaRetorno(bl.data, u, { blocoId: bl.id, ordem: pos, status: "EM_EXECUCAO", motoristaId: bl.motoristaId, motoristaNome: bl.motoristaNome, veiculo: bl.veiculo,
    tarefa: just ? `RETORNO À FÁBRICA - ${just}`.slice(0, 200) : "RETORNO À FÁBRICA",
    obs: `${pode && bl.motoristaId !== u.pessoaId ? "Incluído por" : "Pedido pelo motorista"} ${quem}${just ? ` · justificativa: ${just}` : ""}`.slice(0, 500) });
  if (r.error) return r;
  const todas = await prisma.rotaDemanda.findMany({ where: { blocoId: bl.id, status: { notIn: ["CANCELADA", "CONCLUIDA"] } }, orderBy: { ordem: "asc" } });
  const fab = await fabrica();
  const links = fab ? linksMaps(fab, todas) : linksMaps(todas[0], todas.slice(1));
  await prisma.rotaBloco.update({ where: { id: bl.id }, data: { links, alteradaEm: new Date(), voltaIniciadaEm: null } });
  // motorista pediu: avisa quem montou a rota / quem monta rotas (mensagem interna)
  if (bl.motoristaId === u.pessoaId) {
    try {
      const us = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ setor: { in: ["ADMINISTRATIVO", "LOGISTICA"] } }, { diretoria: true }] }, select: { id: true } }).catch(() => []);
      const para = us.map((x) => x.id).filter((x) => x !== u.id);
      if (para.length) await prisma.mensagem.createMany({ data: para.map((paraId) => ({ deId: u.id, paraId, texto: `ROTA ${bl.id}: ${bl.motoristaNome} VAI VOLTAR À FÁBRICA NO MEIO DA ROTA. JUSTIFICATIVA: ${just.toUpperCase()}` })) });
    } catch (e) { console.log("rotas/retorno aviso:", e.message); }
  }
  return { ok: true, demanda: demandaOut(r.d), ordem: pos };
}
// v521 — arrastar a demanda para outro dia (e para manhã/tarde, quando o horário é por período)
export async function moverDemanda(b, u) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(b.id) } });
  if (!d) return { error: "Demanda não encontrada." };
  if (d.objetivo === "RETORNO") return { error: "O retorno à fábrica é parte da rota." };
  if (d.status !== "ABERTA" || d.blocoId) return { error: "Só demanda aberta (fora de rota) pode mudar de dia. Tire da rota primeiro." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.data || ""))) return { error: "Data?" };
  const data = { data: dUTC(b.data) };
  if (["MANHA", "TARDE"].includes(b.periodo) && ["MANHA", "TARDE", "LIVRE"].includes(d.horarioTipo)) Object.assign(data, { horarioTipo: b.periodo, hora1: null, hora2: null });
  const de = iso(d.data);
  if (de !== b.data) data.obs = [d.obs, `Movida de ${de.split("-").reverse().join("/")} por ${nomeU(u) || "?"}`].filter(Boolean).join(" · ").slice(0, 1000);
  const n = await prisma.rotaDemanda.update({ where: { id: d.id }, data });
  if (n.admDemandaId) await prisma.admDemanda.update({ where: { id: n.admDemandaId }, data: { prazo: n.data } }).catch(() => null);
  return { ok: true, demanda: demandaOut(n) };
}
