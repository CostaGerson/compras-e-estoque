// v168 — leitor do "Cartão de Ponto Calculado" (iPonto / Inspell).
// Lê pelas posições do texto no PDF: marcações (5 períodos) e as colunas H. Trab. · H. Falt. · H. Extra · H. Extra Exced.
// Um PDF pode trazer um ou vários funcionários (cada cartão começa numa página com "Nome:").

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
export const minutos = (hhmm) => { const m = String(hhmm || "").match(/^(\d{1,4}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
export const hhmm = (min) => { const n = Math.round(Number(min) || 0); const s = n < 0 ? "-" : ""; const a = Math.abs(n); return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`; };
const dISO = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const DIAS = { DOMINGO: 0, SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5, SABADO: 6, DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6,
  "SEGUNDA-FEIRA": 1, "TERCA-FEIRA": 2, "QUARTA-FEIRA": 3, "QUINTA-FEIRA": 4, "SEXTA-FEIRA": 5 };

// ocorrência escrita no lugar da marcação
export function ocorrenciaDe(w) {
  const t = semAcento(w).replace(/[^A-Z]/g, "");
  if (!t) return null;
  if (t.startsWith("FERIAD")) return "FERIADO";
  if (t.startsWith("FOLG")) return "FOLGA";
  if (t.startsWith("FALT")) return "FALTA";
  if (t.startsWith("ATEST")) return "ATESTADO";
  if (t.startsWith("FERIA")) return "FERIAS";
  if (t.startsWith("SABAD")) return "SABADO";
  if (t.startsWith("DOMING")) return "DOMINGO";
  if (t.startsWith("AFAST") || t.startsWith("LICEN")) return "AFASTAMENTO";
  if (t.startsWith("ABON")) return "ABONO";
  if (t.startsWith("COMPENS")) return "COMPENSACAO";
  return t.slice(0, 14);
}

async function paginas(buf) {
  const mod = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  const PDFJS = mod.default || mod;
  PDFJS.disableWorker = true;
  const doc = await PDFJS.getDocument({ data: new Uint8Array(buf) });
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.filter((x) => String(x.str).trim()).map((x) => ({ x: x.transform[4], y: x.transform[5], s: String(x.str).trim() })));
  }
  doc.destroy();
  return out;
}

// agrupa itens por linha (y com tolerância), de cima para baixo
function linhas(itens, tol = 2.6) {
  const ord = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const out = [];
  for (const it of ord) {
    const l = out.find((r) => Math.abs(r.y - it.y) <= tol);
    if (l) l.itens.push(it); else out.push({ y: it.y, itens: [it] });
  }
  for (const l of out) l.itens.sort((a, b) => a.x - b.x);
  return out;
}

const textoLinha = (l) => l.itens.map((i) => i.s).join(" ");
const depois = (l, rotulo) => {
  const i = l.itens.findIndex((x) => semAcento(x.s).startsWith(semAcento(rotulo)));
  if (i < 0) return null;
  const resto = l.itens[i].s.slice(rotulo.length).trim();
  if (resto) return resto;
  const prox = l.itens[i + 1];
  return prox && !/:$/.test(prox.s) ? prox.s : null;
};

// v168.3 — quando o quadro "Horário de Trabalho" não vem (ou não foi lido), deduz o horário pelos próprios dias:
// dia com H. Trab. ou H. Falt. é dia de trabalho; a entrada prevista é a entrada mais comum daquele dia da semana
// (arredondada aos 15 min).
export function inferirHorario(dias, horario = {}) {
  const out = { ...(horario || {}) };
  const porDow = {};
  for (const d of dias) {
    if (!((d.trab || 0) + (d.falta || 0) > 0)) continue;
    const l = (porDow[d.dow] ||= []);
    if (d.primeiro === "M" && d.marcacoes?.length) l.push(Math.round(minutos(d.marcacoes[0]) / 15) * 15);
    else l.push(null);
  }
  const todas = Object.values(porDow).flat().filter((v) => v != null);
  const moda = (l) => { const c = {}; for (const v of l) c[v] = (c[v] || 0) + 1; return Number(Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]); };
  for (const [dow, l] of Object.entries(porDow)) {
    if (out[dow]?.length) continue;
    const v = l.filter((x) => x != null);
    const m = v.length ? moda(v) : todas.length ? moda(todas) : null;
    if (m != null && Number.isFinite(m)) out[dow] = [hhmm(m)];
  }
  return out;
}

export async function lerCartoesPonto(buf) {
  const pags = await paginas(buf);
  const textoTudo = pags.map((p) => p.map((i) => i.s).join(" ")).join(" ");
  if (!/Cart[aã]o de Ponto/i.test(textoTudo)) throw new Error("Não parece um cartão de ponto (procurei \"Cartão de Ponto Calculado\").");
  const cartoes = [];
  let atual = null;
  let col = { trab: 352, falt: 380, extra: 407, exced: 434, marcIni: 80, marcFim: 340 };
  for (const itens of pags) {
    const ls = linhas(itens);
    const nomeL = ls.find((l) => l.itens.some((i) => /^Nome:?$/.test(i.s) || /^Nome:/.test(i.s)));
    if (nomeL) {
      atual = { nome: null, cpf: null, cracha: null, cargo: null, admissao: null, empresa: null, cnpj: null, inicio: null, fim: null, horario: {}, dias: [], totais: null };
      cartoes.push(atual);
      for (const l of ls) {
        const t = textoLinha(l);
        if (/Per[ií]odo de refer[eê]ncia/i.test(t)) { const ds = t.match(/\d{2}\/\d{2}\/\d{4}/g) || []; atual.inicio = dISO(ds[0]); atual.fim = dISO(ds[1]); }
        if (/Empresa:/.test(t)) atual.empresa = (depois(l, "Empresa:") || "").toUpperCase();
        if (/CNPJ:/.test(t)) atual.cnpj = (t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [])[0] || null;
        if (/CPF:/.test(t)) atual.cpf = (t.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/) || [])[0] || null;
        if (/Crach/i.test(t)) atual.cracha = (t.match(/Crach[aá]:\s*(\d+)/i) || [])[1] || (l.itens.find((i) => /^\d{5,}$/.test(i.s)) || {}).s || null;
        if (/^Nome:/.test(l.itens.find((i) => /^Nome:/.test(i.s))?.s || "")) atual.nome = (depois(l, "Nome:") || "").toUpperCase().trim();
        if (/Admiss[aã]o:/i.test(t)) atual.admissao = dISO(t);
        // horário de trabalho: "Segunda 08:00 12:00 13:00 18:00" (a palavra do dia pode vir numa linha vizinha)
        for (const it of l.itens) {
          const d = DIAS[semAcento(it.s).replace(/[.:]/g, "").trim()];
          if (d === undefined || it.x < 250) continue;
          const viz = ls.filter((o) => Math.abs(o.y - l.y) <= 2.6).flatMap((o) => o.itens).filter((o) => o.x > it.x + 10 && o.x < it.x + 140);
          const hs = viz.map((o) => o.s).filter((s) => /^\d{2}:\d{2}$/.test(s));
          if (hs.length >= 2 && !atual.horario[d]) atual.horario[d] = hs.slice(0, 4);
        }
      }
      // cargo vem numa linha própria ao lado de "Cargo:"
      const cargoL = ls.find((l) => l.itens.some((i) => /^Cargo:/.test(i.s)));
      if (cargoL) {
        const c = depois(cargoL, "Cargo:") || ls.filter((o) => Math.abs(o.y - cargoL.y) <= 3).flatMap((o) => o.itens).find((i) => i.x > 60 && i.x < 250 && !/:$/.test(i.s))?.s;
        atual.cargo = c ? c.toUpperCase() : null;
      }
      // colunas de horas pelo cabeçalho
      const hT = itens.find((i) => /^H\.\s*Trab/i.test(i.s)), hF = itens.find((i) => /^H\.\s*Falt/i.test(i.s));
      const ext = itens.filter((i) => /^Extra$/i.test(i.s)).sort((a, b) => a.x - b.x);
      if (hT && hF) col = { ...col, trab: hT.x + 3, falt: hF.x + 2, extra: ext[0] ? ext[0].x + 1 : col.extra, exced: ext[1] ? ext[1].x + 1 : col.exced, marcFim: hT.x - 8 };
    }
    if (!atual) continue;
    const ano0 = Number((atual.inicio || "").slice(0, 4)) || new Date().getFullYear();
    for (const l of ls) {
      const dt = l.itens[0];
      // totais do cartão
      if (l.itens.some((i) => /D\.\s*Trab/i.test(i.s))) {
        const lt = textoLinha(l);
        const nums = (re) => Number((lt.match(re) || [])[1]) || 0;
        const horas = ls.filter((o) => Math.abs(o.y - l.y) <= 3).flatMap((o) => o.itens).filter((i) => /^\d{1,4}:\d{2}$/.test(i.s));
        const pega = (cx) => { const h = horas.find((i) => Math.abs(i.x - cx) < 13); return h ? minutos(h.s) : 0; };
        atual.totais = { diasTrab: nums(/D\.\s*Trab\.?:\s*(\d+)/i), diasFalta: nums(/D\.\s*Falt\.?:\s*(\d+)/i), trab: pega(col.trab), falta: pega(col.falt), extra: pega(col.extra), exced: pega(col.exced) };
        continue;
      }
      if (!dt || dt.x > 45 || !/^\d{2}\/\d{2}$/.test(dt.s)) continue;
      const [dd, mm] = dt.s.split("/").map(Number);
      let ano = ano0;
      const ult = atual.dias[atual.dias.length - 1];
      if (ult && mm < Number(ult.data.slice(5, 7))) ano = Number(ult.data.slice(0, 4)) + 1;
      else if (ult) ano = Number(ult.data.slice(0, 4));
      const data = `${ano}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      // a palavra (Feriado, Falta…) às vezes fica 1 ponto acima/abaixo da data
      const juntos = ls.filter((o) => o === l || (Math.abs(o.y - l.y) <= 2.6 && !(o.itens[0] && o.itens[0].x <= 45 && /^\d{2}\/\d{2}$/.test(o.itens[0].s)))).flatMap((o) => o.itens);
      const marc = [], ocs = [];
      let trab = 0, falta = 0, extra = 0, exced = 0;
      for (const it of juntos) {
        if (it.x < col.marcIni - 4) continue;
        if (it.x < col.marcFim) {
          if (/^\d{2}:\d{2}$/.test(it.s)) marc.push({ x: it.x, h: it.s });
          else { const o = ocorrenciaDe(it.s); if (o) ocs.push({ x: it.x, o }); }
        } else if (/^\d{1,3}:\d{2}$/.test(it.s)) {
          const alvo = [["trab", col.trab], ["falt", col.falt], ["extra", col.extra], ["exced", col.exced]]
            .map(([k, cx]) => [k, Math.abs(it.x - cx)]).sort((a, b) => a[1] - b[1])[0][0];
          const v = minutos(it.s);
          if (alvo === "trab") trab = v; else if (alvo === "falt") falta = v; else if (alvo === "extra") extra = v; else exced = v;
        }
      }
      marc.sort((a, b) => a.x - b.x); ocs.sort((a, b) => a.x - b.x);
      // a ocorrência da 1ª posição (entrada) diz se a falta foi de manhã
      const primeiro = [...marc.map((m) => ({ x: m.x, t: "M" })), ...ocs.map((o) => ({ x: o.x, t: o.o }))].sort((a, b) => a.x - b.x)[0];
      const ocorrencias = [...new Set(ocs.map((o) => o.o))];
      const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
      atual.dias.push({
        data, dow, marcacoes: marc.map((m) => m.h), ocorrencias, primeiro: primeiro ? primeiro.t : null,
        trab, falta, extra, exced,
      });
    }
  }
  if (!cartoes.length) throw new Error("Não encontrei nenhum cartão (falta o cabeçalho com \"Nome:\").");
  for (const c of cartoes) {
    if (!c.dias.length) throw new Error(`O cartão de ${c.nome || "?"} não tem nenhum dia.`);
    if (!c.inicio) c.inicio = c.dias[0].data;
    if (!c.fim) c.fim = c.dias[c.dias.length - 1].data;
    c.horarioLido = Object.keys(c.horario || {}).length > 0;
    c.horario = inferirHorario(c.dias, c.horario);
    // prova: a soma dos dias bate com o rodapé
    const s = (k) => c.dias.reduce((a, d) => a + d[k], 0);
    c.soma = { trab: s("trab"), falta: s("falta"), extra: s("extra"), exced: s("exced") };
    c.prova = c.totais ? ["trab", "falta", "extra", "exced"].every((k) => Math.abs(c.totais[k] - c.soma[k]) <= 2) : null;   // o relatório arredonda 1 minuto
  }
  return cartoes;
}
