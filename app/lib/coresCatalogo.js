// v1175 — cor (hex) de cada cor das cartelas para a bolinha do Catálogo Meridian. Ordem de confiança:
//   1) amostra da própria cartela (3º item da cor no scripts/cartelas/*.json — ex.: ADAR, lida do PDF)
//   2) Pantone informado na cartela (especificação da cor) ou no catálogo do fornecedor (Golapu) → tabela TCX
//   3) nome da cor (dicionário de cores têxteis + claro/escuro/bebê/flúor/mescla) → aproximada
// Tabela Pantone TCX: pacote pantone-tcx (ISC, Pedro Duque) — lib/pantoneTcx.json.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import TCX from "./pantoneTcx.json";

const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const N = (t) => sa(t).replace(/[-./()*]+/g, " ").replace(/\s+/g, " ").trim();

// ── 1) amostras gravadas nas cartelas (lidas uma vez) ──
let AMOSTRAS = null;
function amostras() {
  if (AMOSTRAS) return AMOSTRAS;
  AMOSTRAS = new Map();
  try {
    const dir = path.join(process.cwd(), "scripts", "cartelas");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const cat = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      for (const a of cat.artigos || []) for (const c of a.cores || []) if (c[2]) AMOSTRAS.set(`${N(a.nome)}|${N(c[0])}`, String(c[2]).toUpperCase());
    }
  } catch (e) { console.log("cores das cartelas:", e.message); }
  return AMOSTRAS;
}

// ── 2) Pantone ──
// Golapu (catalogo.golapu.com.br/nossas-cores, 27/11/2026): código da cor → Pantone TPX (as sem Pantone vão no dicionário)
const GOLAPU = { "0001": "11-0601", "0048": "15-6304", "0003": "18-0306", "0002": "19-4203", "0011": "19-1522", "0066": "15-0942", "0006": "12-0643", "0008": "15-0955",
  "0005": "16-1459", "0010": "18-1763", "0004": "14-4121", "0020": "18-4330", "0012": "19-4050", "0050": "18-4231", "4280": "19-4024", "0051": "14-4811", "0729": "17-4928",
  "0113": "17-6153", "0024": "18-5725", "2203": "19-5917" };
const GOLAPU_SEM = { "0013": "#D4E02B", "0015": "#FF8A5B", "0030": "#1D9FC8", "0760": "#F6539A", "0021": "#6A2C91" };
function pantoneDe(txt) {
  const m = String(txt || "").match(/PANTONE\s+(\d\d-\d{4})\s*(TCX|TPX|TPG|TP|TC|C)?/i);
  return m ? { cod: m[1], suf: (m[2] || "TCX").toUpperCase() } : null;
}

// ── 3) nomes ──
const H = {
  BRANCO: "#F7F7F5", "BRANCO OPTICO": "#FFFFFF", "OFF WHITE": "#F2EEE3", WHITE: "#F7F7F5", PRETO: "#1E1E21", BLACK: "#1E1E21", NATURAL: "#EFE7D6", CRU: "#E9DFC9",
  MARFIM: "#F1E9D2", PEROLA: "#E9E4DA", GELO: "#E3E7EA", NEVOA: "#D4DADF", NUVEM: "#DCE1E5", ICE: "#E3E9EE", MILK: "#F3EFE6", LINHO: "#E6DCC8", CREME: "#F2E6C9", BAUNILHA: "#F3E5BF", VANILLA: "#F3E5BF", MAISENA: "#F2EAD7", DANONE: "#F3EFEA",
  CINZA: "#8E9196", GRAY: "#8E9196", GREY: "#8E9196", PRATA: "#BFC3C7", SILVER: "#BFC3C7", ARGENTO: "#C3C6CC", ALUMINIO: "#A9AEB2", ACO: "#6F777E", METAL: "#7C838A", CHUMBO: "#4A4F55", GRAFITE: "#3F4247", CARBONO: "#35383C",
  CIMENTO: "#8C8780", CONCRETO: "#9A9690", GRANITO: "#6E6E6E", ROCHA: "#6F6A64", STONE: "#8A877F", "SMOKED GREY": "#6A6C6E", CINDER: "#5C5B5A", STORM: "#5B6670", MOON: "#C9CBCF", MOONLIGHT: "#D3D6DA", LUNAR: "#BFC2C6", LUNE: "#CDCDD3", OSTRA: "#D8D1C5", TAUPE: "#8B7D72", VAPOR: "#D7DBDE", CASCALHO: "#A59E92",
  AZUL: "#2D5DA8", BLUE: "#2D5DA8", ROYAL: "#2541A8", COBALTO: "#1F4FB8", MARINHO: "#1F2A44", NAVY: "#1F2A44", MARINE: "#203558", "DARK NAVY": "#141C30", NOITE: "#1B2236", MIDNIGHT: "#1A2238", NOTURNO: "#1C2438",
  CEU: "#7EB6E3", "AZUL CEU": "#7EB6E3", SKY: "#87BDE6", CELESTE: "#8CC4E8", "BABY BLUE": "#A9CCE8", BIC: "#1D45B5", "AZUL BIC": "#1D45B5", "ROYAL BIC": "#1D45B5", ANIL: "#2F4FA8", INDIGO: "#2B3A67", DENIM: "#3B5378", JEANS: "#3E5C86",
  TURQUESA: "#14A9B8", PETROLEO: "#1E5566", ACQUA: "#3CC1C4", AQUA: "#56C9C9", "ARTIC ACQUA": "#3AB0AE", ARUBA: "#7FD3C8", CAPRI: "#2BA3C6", CYAN: "#13B5D8", PISCINA: "#3FBCD6", AZZURRO: "#3C8FD6", "FRENCH BLUE": "#2E64B0", FRANCA: "#2E64B0",
  OCEANO: "#1F5FA8", "MAR DO NORTE": "#2F4F6F", HAWAI: "#00A6B5", "BLUE GEL": "#5DADE2", ELBA: "#2F6DB5", ETHER: "#BFD7EA", LAVANDA: "#B9A9D6", LAVANDER: "#B9A9D6", ALFAZEMA: "#A895C9", LILAS: "#B48CC8", LILAC: "#C3A6D6",
  MONACO: "#2A57A0", IMPERIAL: "#25407E", SAFIRA: "#1F3F8F", ULTRAMARINE: "#2A3FA0", NAUTICO: "#1E2E52", MARITIMO: "#245079", CIVICO: "#21305A", PACIFICO: "#1F6E8C", CARIBE: "#13A0B5", RIVIERA: "#3277B5", PALACE: "#2B3F7A",
  VERDE: "#1F8A4C", GREEN: "#2E8B57", BANDEIRA: "#007A3D", "VERDE BANDEIRA": "#007A3D", FOLHA: "#2F7D32", "VERDE FOLHA": "#2F7D32", GRAMA: "#3E9B3A", SELVA: "#1F5B3A", MATA: "#2C5E3B", FLORESTA: "#24503A", "VERDE GARRAFA": "#1F4D36",
  MUSGO: "#5A6B3B", OLIVA: "#6B6E3A", MILITAR: "#4B5A3A", "VERDE MILITAR": "#4B5A3A", JADE: "#1FA37A", ESMERALDA: "#13906A", MENTA: "#98D8C1", "VERDE AGUA": "#8FD6C5", AGUA: "#8FD6C5", LIMAO: "#C5D82B", LIME: "#B8D432", LEMON: "#F3E53D",
  MACA: "#7DC142", "VERDE MACA": "#7DC142", PISTACHE: "#A8C686", SALVIA: "#9DAE94", ALECRIM: "#6B8E6B", CACTO: "#5E8B5A", "ALOE VERA": "#8FB98B", GREENERY: "#88B04B", EVERGREEN: "#1F4D3A", "ICE GREEN": "#BFE6D6", BOTANICAL: "#4F7A55",
  LAGUM: "#2E8B7A", LAGUNA: "#2D9C9C", THURF: "#4F7942", TWIST: "#7BC043", ENERGY: "#C6D92E", ERVA: "#7A8F48", "ERVA DOCE": "#B8C77A", ALCAPARRA: "#5F6B39", CANA: "#9ACD5B", AMAZON: "#2F6B4E", AMAZONIA: "#245F3E", PRIMAVERA: "#77C26B", BRASIL: "#009C3B", SELECAO: "#FFD100",
  AMARELO: "#F7D117", YELLOW: "#F7D117", CANARIO: "#FFE14D", OURO: "#F2A900", GOLD: "#E9B021", "AMARELO OURO": "#F2A900", GEMA: "#F9A01B", MOSTARDA: "#D4A22B", MILHO: "#F4C430", MANGA: "#FFB21F", BANANA: "#F7E27A", SUNSHINE: "#FFD100", SOLAR: "#FFC72C", SOLEIL: "#FFCB2E", SKOL: "#F5D300", LEMONADE: "#F5EE9E", RADIANTE: "#FFD320", AMBAR: "#FFB000", OCRE: "#C88B2F",
  LARANJA: "#F26B1D", ORANGE: "#F26B1D", "RED ORANGE": "#F04E23", ABOBORA: "#F07F22", CENOURA: "#F06E2A", TELHA: "#B5532F", APRICOT: "#F7A26B", PESSEGO: "#F6B497", SALMAO: "#F3907A", CORAL: "#F47560", MELAO: "#FF9E6B", CITRUS: "#F7A21B",
  VERMELHO: "#C8102E", RED: "#C8102E", "TRUE RED": "#BF1932", ESCARLATE: "#D21F3C", FERRARI: "#D40000", CEREJA: "#A4122F", CHERRY: "#A4122F", RUBI: "#9B111E", CARMIM: "#A50E2D", CARDEAL: "#8C1C2B", ROUGE: "#B3002D", PAIXAO: "#C4122F", GOIABA: "#E8577E",
  BORDO: "#6D1F2E", VINHO: "#5E1A2B", WINE: "#5E1A2B", AMORA: "#5B1F3E", UVA: "#4E2A5A", ACAI: "#3E1F3A", JASPER: "#8A3B2E",
  ROSA: "#F2A7C3", ROSE: "#E8A3B5", ROSÉ: "#E8A3B5", PINK: "#E5368C", "SUPER PINK": "#F0329A", "PINK GLOW": "#F6539A", CHICLETE: "#F57AB5", "TUTI FRUTI": "#F06EAA", "TUTTI FRUTTI": "#F06EAA", PETALA: "#F4C2CF", ROMANTIC: "#E9A9B8", NUDE: "#E3BFA8", CANDY: "#F6A8C8",
  ANGELICA: "#E8A0BF", CAMAFEU: "#E7C3B5", HORTENSIA: "#A88BC6", HORTENCIA: "#A88BC6", AZALEIA: "#E05C8B", GIRL: "#F4A6C1", FLAMB: "#FF4F9A", MALVA: "#B07AA1", DOCE: "#F4B6C2", "ROSA ANTIGO": "#C48A8F", JUJUBA: "#E2447B", CHOQUE: "#EC1C8E", MALIBU: "#F7A1B5",
  ROXO: "#5B2C83", PURPLE: "#6A2C91", VIOLETA: "#7B3FA0", AMETISTA: "#8A5BAE", "VIOLET ICE": "#C9B6E4", BERINJELA: "#4A2140",
  MARROM: "#5C3A21", CAFE: "#4B2E1E", EXPRESSO: "#4B2E23", CACAU: "#5A3A2A", CHOCOLATE: "#4A2C1D", CASTOR: "#7A6A5E", CANELA: "#A0613A", CARAMELO: "#B3713A", CAPUCCINO: "#8E6E57", MADEIRA: "#8B5A2B", FREIJO: "#9A6B43", KARITE: "#E8D9BE",
  BEGE: "#D9C3A1", AREIA: "#D2BC94", DUNAS: "#D6C29A", DESERTO: "#C9A97A", CAQUI: "#B39B6E", KHAKI: "#B39B6E", CAMEL: "#B5895B", SAFARI: "#A89060", CARGO: "#8C7B55", NOUGAT: "#B7926B", BISCOITO: "#D8B98C", KRAFT: "#B88A57", CHINO: "#CBB892", TRUFFA: "#5E4536", MUSTANG: "#8A6547", MANTEIGA: "#F3E3A1", VINTAGE: "#9B2D30",
  EXCALIBUR: "#7D8590", MONTANA: "#5C6F7E", FROZEN: "#BCDDEB", AQUATIC: "#37A0C1", PRISMA: "#3E8DCB", STEEPLE: "#6F7C8A", BOING: "#4F6D8F", ECLIPSE: "#2B2D42", MEDIEVAL: "#5C4B6E", PROVENCE: "#7E8EC6", PLACIDO: "#86A8C9", AZULITO: "#5C9BD6", INK: "#26324A",
  ANGEL: "#BFD8EE", "ANGEL BLUE": "#9EC5E6", "BLUE BELL": "#93A9D8", ICELANDIC: "#CFE3EA", SUECIA: "#1F5AA6", DINAMARCA: "#C8102E", PARISIAN: "#3B4F8C", NIAGARA: "#5D8AA8", "DEEP LAKE": "#14505C", STELLAR: "#46647E", "BLUE NIGHT": "#1F2C4D", "AQUA GRAY": "#A5B8B5", "AQUA SKY": "#7BC4C4",
  PIMENTA: "#9E2B25", ANGELITA: "#E7B7C8", DARK: "#1F2433", JASMIN: "#F7E8A6", SOLDADO: "#5A5F3C", BIKE: "#C8102E", DRIVER: "#2A4D8F", FERA: "#1E2A44", VERONESI: "#2E7D6B", JUI: "#B5A642", THATY: "#E9A6B9", 
  "CAMUFLADA EXERCITO": "#5B5E3B", "EB CAMUFLADA EXERCITO": "#5B5E3B", TOPAZIO: "#2A4A7A", AURORA: "#F6A04D", ARTICO: "#D9EEF2", AZULADO: "#7E9BB5", ESVERDEADO: "#7E9A86", ACINZENTADO: "#8A8F93", AVERMELHADO: "#D9472B", 
};
const ABREV = { CZ: "CINZA", AM: "AMARELO", AMAR: "AMARELO", V: "VERDE", VERM: "VERMELHO", INTERM: "INTERMEDIARIO", ESVERD: "ESVERDEADO", MARINHA: "MARINHO", MARINHAO: "MARINHO", BRODO: "BORDO", DENIN: "DENIM", KAKHI: "KHAKI", CAKI: "CAQUI", HORTENCIA: "HORTENSIA", PLACIDO: "PLACIDO", FLUORESCENTE: "FLUOR", NEON: "FLUOR", BEBE: "BB", BABY: "BB", CLARA: "CLARO", ESCURA: "ESCURO", MEDIA: "MEDIO", WORK: "", COR: "" };
const FLUOR = { AMARELO: "#E8FF1C", LARANJA: "#FF6A13", VERDE: "#5CFF3A", ROSA: "#FF3EA5", PINK: "#FF2E93", MELAO: "#FF7A4F", LIMAO: "#C8FF1F", CORAL: "#FF5A4C", VERMELHO: "#FF2A3C" };
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toH = (r) => "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a, b, t) => { const x = hx(a), y = hx(b); return toH(x.map((v, i) => v + (y[i] - v) * t)); };

// nome da cor sem o código (01 BRANCO · 003-01 BRANCO · BR 3443 BRANCO · YGK CINZA)
export function nomeSemCodigo(cor) {
  const t = N(cor).split(" ");
  // código na frente: tem dígito; ou 2–3 letras sem vogal (YGK, CPD, MFL); ou 2–3 letras seguidas de número (BR 3443, CZ 0788)
  while (t.length > 1 && (/\d/.test(t[0]) || (/^[A-Z]{2,3}$/.test(t[0]) && !H[t[0]] && (ABREV[t[0]] === undefined || /\d/.test(t[1] || "")) && (!/[AEIOU]/.test(t[0]) || /\d/.test(t[1] || ""))))) t.shift();
  return t.join(" ");
}
export function codigoDaCor(cor) {
  const s = String(cor || "").trim(), n = nomeSemCodigo(s);
  const cod = N(s).slice(0, Math.max(0, N(s).length - n.length)).trim();
  return cod || null;
}

function porNome(cor) {
  let toks = nomeSemCodigo(cor).split(" ").map((w) => (ABREV[w] !== undefined ? ABREV[w] : w)).filter(Boolean);
  const mods = { claro: 0, escuro: 0, bb: 0, fluor: 0, mescla: 0 };
  const resto = [];
  for (const w of toks) {
    if (w === "CLARO") mods.claro++; else if (w === "ESCURO" || (w === "DARK" && toks.length > 1)) mods.escuro++; else if (w === "BB") mods.bb++;
    else if (w === "FLUOR") mods.fluor++; else if (w === "MESCLA") mods.mescla++; else if (["MEDIO", "INTERMEDIARIO", "E", "SUPER", "ESPECIAL", "FORTE", "VIBRANTE", "GLACE", "DESBOTAVEL"].includes(w)) { if (w === "INTERMEDIARIO" || w === "MEDIO") mods.medio = 1; }
    else resto.push(w);
  }
  let base = null, achou = null;
  // frase de 2–3 palavras do dicionário; senão a palavra de cor mais específica (a última: AMARELO RADIANTE → RADIANTE)
  for (let n = Math.min(3, resto.length); n >= 2 && !base; n--) for (let i = 0; i + n <= resto.length; i++) { const k = resto.slice(i, i + n).join(" "); if (H[k]) { base = H[k]; achou = k; break; } }
  if (!base) {
    const ADJ = ["ACINZENTADO", "AZULADO", "ESVERDEADO", "AVERMELHADO"];
    const cs = resto.filter((w) => H[w]);
    const fortes = cs.filter((w) => !ADJ.includes(w)), adj = cs.find((w) => ADJ.includes(w));
    if (fortes.length) { achou = fortes[fortes.length - 1]; base = H[achou]; if (adj) base = mix(base, H[adj], 0.35); if (fortes.length > 1 && /^(PRETO|BRANCO)$/.test(achou) && mods.mescla) base = mix(H[fortes[0]], base, 0.4); }
    else if (adj) { achou = adj; base = H[adj]; }
  }
  if (!base && mods.mescla) base = "#8E9196";
  if (!base) return null;
  const chave = achou ? achou.split(" ").pop() : "";
  if (mods.fluor) base = FLUOR[chave] || FLUOR[resto[0]] || mix(base, "#FFFF00", 0.25);
  if (mods.bb) base = mix(base, "#FFFFFF", 0.6);
  if (mods.claro) base = mix(base, "#FFFFFF", 0.38);
  if (mods.escuro) base = mix(base, "#000000", 0.32);
  if (mods.mescla) base = mix(base, "#9A9A9A", 0.3);
  return { h: base, m: !!mods.mescla };
}

// { h: "#RRGGBB" | null, o: "amostra" | "Pantone 19-4024 TPX" | "nome", m: mescla }
export function corHex({ artigo, cor, especificacao, fornecedor }) {
  const am = amostras().get(`${N(artigo)}|${N(cor)}`);
  const mescla = /MESCLA/.test(N(cor));
  if (am) return { h: am, o: "amostra", m: mescla };
  let p = pantoneDe(especificacao);
  if (!p && /GOLAPU/.test(N(fornecedor))) {
    const c = (String(cor).match(/^\s*(\d{4})/) || [])[1];
    if (c && GOLAPU[c]) p = { cod: GOLAPU[c], suf: "TPX" };
    else if (c && GOLAPU_SEM[c]) return { h: GOLAPU_SEM[c], o: "nome", m: mescla };
  }
  if (p && TCX[p.cod]) return { h: "#" + TCX[p.cod], o: `Pantone ${p.cod} ${p.suf}`, m: mescla };
  const n = porNome(cor);
  return n ? { h: n.h, o: "nome", m: n.m || mescla } : { h: null, o: null, m: mescla };
}
