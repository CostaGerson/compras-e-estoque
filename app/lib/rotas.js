// v425 — Logística › Rotas: demandas de rota, geolocalização, melhor sequência (com janelas de horário), blocos e despacho
import { prisma } from "@/lib/prisma";
import { temGoogle, geocodificar, matrizRuas, chaveTrecho } from "@/lib/googleMaps";   // v427

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
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, razaoSocial: true, nomeFantasia: true, logradouro: true, numero: true, complemento: true, bairro: true, municipio: true, uf: true, cep: true, preposto: true, telefones: true } }),
    prisma.destinatario.findMany({ where: { ativo: true } }),   // v430
  ]);
  return [
    ...dsx.map((x) => ({ tipo: "DESTINATARIO", id: x.id, nome: up(x.nome), endereco: x.endereco || "", contato: x.contato || null, telefone: x.telefone || null, lat: x.lat, lng: x.lng, municipio: x.municipio, uf: x.uf })),
    ...ps.map((p) => ({ tipo: "TERCEIRIZADO", id: p.id, nome: up(p.nome), endereco: p.endereco || "", contato: null, telefone: p.telefone || null })),
    ...fs.map((f) => ({ tipo: "FORNECEDOR", id: f.id, nome: up(f.nome || f.nomeFantasia || f.razaoSocial), endereco: juntaEnd(f), contato: f.contato || f.preposto || null, telefone: f.telefone || f.telefones || null })),
    ...cs.map((c) => ({ tipo: "CLIENTE", id: c.id, nome: up(c.nomeFantasia || c.razaoSocial), endereco: juntaEnd(c), contato: c.preposto || null, telefone: c.telefones || null })),
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
  return [
    ...folha.map((p) => ({ id: p.id, nome: up(fi[p.id]?.nomeCompleto || p.nome), apelido: up(p.nome), telefone: fi[p.id]?.dados?.telefone || null, origem: "FOLHA", usuarioId: usu[p.id] || null })),
    ...free.map((p) => ({ id: `F${p.id}`, nome: up(p.nome), apelido: up(p.nome), telefone: p.telefone || null, origem: "FREELANCER", usuarioId: null })),
  ].map((x) => ({ ...x, emRota: ocupado[x.id] || null }));
}

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
    etas.push({ id: d.id, chegada: hhmm(t), atrasoMin: Math.round(at), janela: [hhmm(a), hhmm(b)] });
    t += PARADA_MIN; pos = d;
  }
  const volta = trecho(pos, origem); km += volta.km; t += volta.min;
  return { km: Math.round(km * 10) / 10, atraso, retorno: hhmm(t), etas };
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
export async function medidorRuas(pontos, veiculo) {
  let m = {};
  try { m = await matrizRuas(pontos); } catch (e) { console.log("rotas/matriz google:", e.message); return { medir: null, erro: e.message }; }
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
export function mensagemWhats(bloco, paradas, links) {
  const linhas = paradas.map((d, i) => `${i + 1}. ${d.objetivo} · ${d.destinoNome}${d.tarefa ? ` - ${d.tarefa}` : ""}${d.urgente ? " (URGENTE)" : ""}\n   ${d.endereco}${d.telefone ? `\n   Contato: ${[d.contato, d.telefone].filter(Boolean).join(" · ")}` : ""}\n   Horário: ${horarioTxt(d)}${d.obs ? `\n   Obs: ${d.obs}` : ""}`);
  return [`*Rota ${bloco.id} · ${iso(bloco.data).split("-").reverse().join("/")}*`, `Motorista: ${bloco.motoristaNome} · ${bloco.veiculo === "MOTO" ? "Moto" : "Carro"}${bloco.saida ? ` · saída ${bloco.saida}` : ""}`, "",
    ...linhas, "", `Volta à fábrica no final.`, "", ...links.map((l, i) => `Mapa${links.length > 1 ? ` (parte ${i + 1})` : ""}: ${l}`), "", "Marque cada parada como concluída no sistema (Logística › Rotas)."].join("\n");
}

// ---------- leitura ----------
export const demandaOut = (d) => ({ ...d, data: iso(d.data), freteValorMax: d.freteValorMax != null ? Number(d.freteValorMax) : null, horario: horarioTxt(d), janela: janela(d).map(hhmm) });
export async function painel({ de, ate }) {
  const [ds, bs, fab, mots] = await Promise.all([
    prisma.rotaDemanda.findMany({ where: { data: { gte: dUTC(de), lte: dUTC(ate) }, status: { not: "CANCELADA" } }, orderBy: [{ data: "asc" }, { urgente: "desc" }, { ordem: "asc" }, { id: "asc" }] }),
    prisma.rotaBloco.findMany({ where: { OR: [{ data: { gte: dUTC(de), lte: dUTC(ate) } }, { status: "EM_EXECUCAO" }], NOT: { status: "CANCELADO" } }, orderBy: [{ data: "asc" }, { id: "asc" }] }),
    fabrica(), motoristas(),
  ]);
  const cot = ds.filter((d) => d.admDemandaId).map((d) => d.admDemandaId);
  const adms = cot.length ? await prisma.admDemanda.findMany({ where: { id: { in: cot } }, select: { id: true, status: true, cotacao: true } }) : [];
  const porAdm = Object.fromEntries(adms.map((a) => [a.id, { status: a.status, valor: a.cotacao?.valor ?? null, prazo: a.cotacao?.prazo ?? null, transportadoras: a.cotacao?.transportadoras ?? null, temAnexo: !!a.cotacao?.anexo }]));
  return {
    demandas: ds.map((d) => ({ ...demandaOut(d), cotacao: d.admDemandaId ? porAdm[d.admDemandaId] || null : null })),
    blocos: bs.map((b) => ({ ...b, data: iso(b.data) })), fabrica: fab, motoristas: mots,
  };
}

// ---------- gravação ----------
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
  const dados = {
    data: dUTC(b.data), objetivo, destinoTipo, destinoId, destinoNome, tarefa: tarefa.slice(0, 200), endereco,
    contato: String(b.contato || "").trim() || null, telefone: String(b.telefone || "").trim() || null,
    lat: geo?.lat ?? null, lng: geo?.lng ?? null, municipio: geo?.municipio || null, uf: geo?.uf || null, regiao: geo ? regiaoDe(geo.municipio, geo.uf) : null,
    horarioTipo, hora1: b.hora1 || null, hora2: horarioTipo === "ENTRE" ? b.hora2 || null : null,
    motoristaId: frete ? null : b.motoristaId || null, motoristaNome: frete ? null : up(b.motoristaNome) || null, veiculo: frete ? null : VEICULOS.includes(b.veiculo) ? b.veiculo : null,
    urgente: !!b.urgente, frete, freteTipo, freteValorMax: freteTipo === "FRETEBRAS" ? vMax : null, freteVolumes: frete ? vol : null,
    obs: String(b.obs || "").trim() || null,
  };
  let d = ant ? await prisma.rotaDemanda.update({ where: { id: ant.id }, data: dados })
    : await prisma.rotaDemanda.create({ data: { ...dados, criadoPorId: u.id, criadoPorNome: nomeU(u) } });
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
  return { ok: true, demanda: demandaOut(d), semMapa: d.lat == null };
}

export async function cancelarDemanda(id) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d) return { error: "Demanda não encontrada." };
  if (d.status === "EM_EXECUCAO") return { error: "Está numa rota em execução." };
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: { status: "CANCELADA", blocoId: null } });
  return { ok: true };
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
  const seq = ids.map((i) => porId[i]).filter(Boolean);
  const fab = await fabrica();
  const { medir } = await medidorRuas([fab, ...seq], b.veiculo);
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
  for (const [i, d] of seq.entries()) await prisma.rotaDemanda.update({ where: { id: d.id }, data: { blocoId: bl.id, ordem: i + 1, status: "NO_BLOCO", motoristaId: mot.id, motoristaNome: mot.nome, veiculo: dados.veiculo } });
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
  const tel = telefoneWa(bl.telefone);
  const texto = mensagemWhats(n, ds, links);
  // motorista com usuário no sistema também recebe a rota por mensagem
  const usu = bl.motoristaId && !bl.motoristaId.startsWith("F") ? await prisma.usuario.findFirst({ where: { ativo: true, pessoaId: bl.motoristaId }, select: { id: true } }) : null;
  return { ok: true, bloco: { ...n, data: iso(n.data) }, whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null, texto, usuarioMotorista: usu?.id || null };
}

export async function concluirParada(id, u, desfazer = false) {
  const d = await prisma.rotaDemanda.findUnique({ where: { id: Number(id) } });
  if (!d || !d.blocoId) return { error: "Parada não encontrada." };
  const bl = await prisma.rotaBloco.findUnique({ where: { id: d.blocoId } });
  if (!bl || bl.status !== "EM_EXECUCAO") return { error: "A rota não está em execução." };
  await prisma.rotaDemanda.update({ where: { id: d.id }, data: desfazer ? { status: "EM_EXECUCAO", concluidaEm: null, concluidaPorNome: null } : { status: "CONCLUIDA", concluidaEm: new Date(), concluidaPorNome: nomeU(u) } });
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
