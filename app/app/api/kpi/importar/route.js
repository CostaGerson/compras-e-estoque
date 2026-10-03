export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { MESES_NOME, relatorio, usuarioAtivo, ehMaster, negadoKpi as negado } from "@/lib/kpi";

const IDX = {}; MESES_NOME.forEach((m, i) => (IDX[m] = i + 1));
const txt = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) / 100 : null;
  const x = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return isNaN(x) ? null : Math.round(x * 100) / 100;
};
// nome do canal mantém acento (txt() só serve para comparar)
const segNome = (v) => String(v ?? "").toUpperCase().trim();
const ehAno = (v) => typeof v === "number" && Number.isInteger(v) && v >= 2000 && v <= 2100;

// corta o bloco da Nort (a planilha traz Meridian em cima e Nort embaixo)
function soMeridian(linhas) {
  const i = linhas.findIndex((r) => txt(r.slice(0, 3).join(" ")).includes("NORT"));
  return i > 0 ? linhas.slice(0, i) : linhas;
}
function cabecalho(linhas) {
  for (let i = 0; i < Math.min(8, linhas.length); i++) {
    const r = linhas[i] || [];
    if (txt(r[0]) === "MES" && r.some(ehAno)) return { i, r };
  }
  return null;
}
// a meta anual fica na coluna imediatamente antes de "Gap" nas três abas
const colMetaAnual = (h) => { const g = h.findIndex((c) => txt(c) === "GAP"); return g > 0 ? g - 1 : -1; };

function lerAba(wb, nomes) {
  const nome = wb.SheetNames.find((s) => nomes.some((x) => txt(s).includes(x)));
  if (!nome) return null;
  const linhas = soMeridian(XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null }));
  const cab = cabecalho(linhas);
  if (!cab) return null;
  const anos = cab.r.map((c, i) => (ehAno(c) ? { ano: c, col: i } : null)).filter(Boolean);
  if (anos.length < 1) return null;
  return { nome, linhas: linhas.slice(cab.i + 1), header: cab.r, anos, metaCol: colMetaAnual(cab.r) };
}

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioAtivo(b?.usuarioId);
  if (!ehMaster(u)) return negado("Só o financeiro importa KPIs.");
  if (!b.conteudo) return Response.json({ error: "Arquivo vazio." }, { status: 400 });

  let wb;
  try { wb = XLSX.read(Buffer.from(String(b.conteudo), "base64"), { type: "buffer" }); }
  catch { return Response.json({ error: "Não consegui abrir a planilha." }, { status: 422 }); }

  const mes = {};   // "ano-mes" → campos
  const rec = [];   // {ano,mes,segmento,valor}
  const metasAno = {};
  const avisos = [];
  const põe = (ano, m, campo, valor) => {
    if (valor === null || valor === undefined) return;
    const k = `${ano}-${m}`;
    (mes[k] = mes[k] || { ano, mes: m })[campo] = valor;
  };

  // ---- Vendas ----
  const semNota = (aba, campo) => {
    for (const r of aba.linhas) {
      if (!txt(r[0]).startsWith("SEM NOTA")) continue;
      aba.anos.forEach((a) => { const val = num(r[a.col]); if (val) metasAno[a.ano] = { ...(metasAno[a.ano] || {}), [campo]: val }; });
    }
  };

  const v = lerAba(wb, ["VENDA"]);
  if (v) {
    semNota(v, "semNotaVendas");
    for (const r of v.linhas) {
      const m = IDX[txt(r[0])];
      if (!m) continue;
      v.anos.forEach((a) => põe(a.ano, m, "vendasValor", num(r[a.col])));
      if (v.metaCol > 0 && num(r[v.metaCol]) && v.anos.length) {
        const alvo = v.anos[v.anos.length - 1].ano;
        metasAno[alvo] = { ...(metasAno[alvo] || {}), metaVendas: num(r[v.metaCol]) };
      }
    }
  } else avisos.push("Aba de Vendas não encontrada.");

  // ---- Faturamento ----
  const f = lerAba(wb, ["FATURAMENTO"]);
  if (f) {
    semNota(f, "semNotaFaturamento");
    const atual = f.anos[f.anos.length - 1];
    const colPecas = f.header.findIndex((c) => txt(c).includes("PECAS FATURADAS"));
    const colMetaV = atual ? atual.col + 1 : -1;   // META $
    const colMetaP = atual ? atual.col + 2 : -1;   // META (p)
    for (const r of f.linhas) {
      const m = IDX[txt(r[0])];
      if (!m) continue;
      f.anos.forEach((a) => põe(a.ano, m, "faturamentoValor", num(r[a.col])));
      if (atual) {
        if (colPecas > 0) põe(atual.ano, m, "pecasFaturadas", num(r[colPecas]) === null ? null : Math.round(num(r[colPecas])));
        if (txt(f.header[colMetaV]).startsWith("META")) põe(atual.ano, m, "metaFaturamentoValor", num(r[colMetaV]));
        if (txt(f.header[colMetaP]).startsWith("META")) {
          const p = num(r[colMetaP]);
          põe(atual.ano, m, "metaFaturamentoPecas", p === null ? null : Math.round(p));
        }
        if (f.metaCol > 0 && num(r[f.metaCol])) metasAno[atual.ano] = { ...(metasAno[atual.ano] || {}), metaFaturamento: num(r[f.metaCol]) };
      }
    }
  } else avisos.push("Aba de Faturamento não encontrada.");

  // ---- Receita (por segmento) ----
  const rc = lerAba(wb, ["RECEITA"]);
  if (rc) {
    let atualMes = null;
    for (const r of rc.linhas) {
      const m = IDX[txt(r[0])];
      if (m) atualMes = m;
      const seg = segNome(r[1]);
      const comp = txt(r[1]);
      if (!atualMes || !seg || comp === "SEGMENTO" || comp === "TOTAL") continue;
      rc.anos.forEach((a) => { const val = num(r[a.col]); if (val !== null) rec.push({ ano: a.ano, mes: atualMes, segmento: seg, valor: val }); });
      if (rc.metaCol > 0 && num(r[rc.metaCol]) && rc.anos.length) {
        const alvo = rc.anos[rc.anos.length - 1].ano;
        metasAno[alvo] = { ...(metasAno[alvo] || {}), metaReceita: num(r[rc.metaCol]) };
      }
    }
  } else avisos.push("Aba de Receita não encontrada.");

  const linhas = Object.values(mes);
  if (!linhas.length && !rec.length) {
    return Response.json({ error: "Não achei meses nessa planilha. Confira se as abas são Vendas, Faturamento e Receita, com os meses na primeira coluna.", avisos }, { status: 422 });
  }

  // grava (o que veio na planilha manda; o que não veio fica como está)
  for (const l of linhas) {
    const { ano, mes: m, ...campos } = l;
    await prisma.kpiMes.upsert({
      where: { ano_mes: { ano, mes: m } },
      create: { ano, mes: m, ...campos, atualizadoPorNome: "IMPORTAÇÃO EXCEL" },
      update: { ...campos, atualizadoPorNome: "IMPORTAÇÃO EXCEL" },
    });
  }
  for (const r of rec) {
    await prisma.kpiReceita.upsert({
      where: { ano_mes_segmento: { ano: r.ano, mes: r.mes, segmento: r.segmento } },
      create: r, update: { valor: r.valor },
    });
  }
  for (const [ano, m] of Object.entries(metasAno)) {
    await prisma.kpiAno.upsert({ where: { ano: Number(ano) }, create: { ano: Number(ano), ...m }, update: m });
  }

  const anos = [...new Set([...linhas.map((l) => l.ano), ...rec.map((r) => r.ano)])].sort();
  return Response.json({
    ok: true, avisos, anos,
    meses: linhas.length, receitas: rec.length,
    metas: Object.keys(metasAno).map(Number),
    relatorio: await relatorio(anos[anos.length - 1]),
  });
}
