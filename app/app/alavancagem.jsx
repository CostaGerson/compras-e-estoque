"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingDown, CreditCard, Plus, Save, X, Trash2, AlertTriangle, CheckCircle2, Landmark,
  Grid3x3, Loader2, ChevronRight, Pencil, Info,
} from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41", trilho: "#E9EDF3",
};
/* ordem validada para daltonismo — não troque sem revalidar */
const CORES = ["#2E7CD6", "#FF6B1A", "#0E9384", "#C08401", "#DD2590"];

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compacto = (v) => {
  const x = Number(v) || 0;
  if (Math.abs(x) >= 1e6) return `R$ ${(x / 1e6).toFixed(2).replace(".", ",")} mi`;
  if (Math.abs(x) >= 1e4) return `R$ ${(x / 1e3).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${brl(x)}`;
};
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(0)}%`);
const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");
const inteiro = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");

const api = async (url, method, body) => {
  const r = await fetch(url, method ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro na operação.");
  return d;
};

/* ============================================================ */
export default function Alavancagem({ user, master, aba = "dividas" }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [novo, setNovo] = useState(false);
  const [novoLimite, setNovoLimite] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = async () => {
    setErro("");
    try { setD(await api(`/api/fin/alavancagem?u=${user.id}`)); }
    catch (e) { setErro(e.message); setD(null); }
  };
  useEffect(() => { carregar(); }, []);

  const sincronizar = async () => {
    const novos = (d.previaMatriz || []).filter((p) => p.estado !== "IGUAL").length;
    if (!confirm(`Levar ${d.previaMatriz.length} contrato(s) para a aba Dívidas da Matriz oficial?\n${novos} item(ns) serão criados ou atualizados.\n\nDe lá, as parcelas seguem para o contas a pagar pelo caminho que já existe.`)) return;
    setSincronizando(true);
    try {
      const r = await api("/api/fin/alavancagem/matriz", "POST", { usuarioId: user.id });
      setAviso({ tipo: "ok", texto: `Matriz atualizada: ${r.criados} novo(s), ${r.atualizados} alterado(s), ${r.removidos} removido(s). Peso mensal das dívidas: R$ ${brl(r.mensal)}.` });
      carregar();
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
    setSincronizando(false);
  };

  if (erro) return <div className="p-3 rounded" style={{ background: C.redSoft, color: C.red }}>{erro}</div>;
  if (!d) return <div style={{ color: C.sub }}>Carregando…</div>;

  const t = d.totais;
  const fatias = [
    ...d.grupos.map((g, i) => ({ nome: g.label, valor: g.saldo, cor: CORES[i % CORES.length] })),
    { nome: "Tributos", valor: t.tributos, cor: CORES[4] },
  ].filter((f) => f.valor > 0);

  return (
    <div>
      {aviso && (
        <div className="p-3 rounded mb-4 flex items-start gap-2 text-sm"
          style={{ background: aviso.tipo === "ok" ? C.greenSoft : C.redSoft, color: aviso.tipo === "ok" ? C.green : C.red }}>
          <div className="flex-1">{aviso.texto}</div>
          <button onClick={() => setAviso(null)}><X size={14} /></button>
        </div>
      )}

      {aba === "credito"
        ? <Credito user={user} master={master} d={d} onMudou={carregar} abrirNovo={() => setNovoLimite(true)} />
        : <Dividas user={user} master={master} d={d} fatias={fatias} onMudou={carregar}
            abrirNovo={() => setNovo(true)} sincronizar={sincronizar} sincronizando={sincronizando} />}

      {novo && <ContratoModal user={user} catalogos={d.catalogos} onClose={() => setNovo(false)}
        onSalvo={(r) => { setNovo(false); setAviso({ tipo: "ok", texto: `Contrato criado.${r.credito ? " O crédito do capital entrou em contas a receber." : ""} Clique em “Levar para a Matriz” para as parcelas chegarem ao contas a pagar.` }); carregar(); }} />}
      {novoLimite && <LimiteModal user={user} onClose={() => setNovoLimite(false)}
        onSalvo={() => { setNovoLimite(false); carregar(); }} />}
    </div>
  );
}

/* ---------------- DÍVIDAS ---------------- */
function Dividas({ user, master, d, fatias, onMudou, abrirNovo, sincronizar, sincronizando }) {
  const t = d.totais;
  const val = (v) => (master ? compacto(v) : "•••••");
  const pendentes = (d.previaMatriz || []).filter((p) => p.estado !== "IGUAL").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="text-xs" style={{ color: C.sub }}>Posição em {dBR(d.hoje)}</div>
        <div className="flex-1" />
        {master && (
          <>
            <button onClick={abrirNovo} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: C.accent, color: "#fff" }}>
              <Plus size={15} /> Novo contrato
            </button>
            <button onClick={sincronizar} disabled={sincronizando}
              title="Cria/atualiza os itens na aba Dívidas da Matriz oficial; de lá vão para o contas a pagar"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border: `1px solid ${pendentes ? C.accent : C.line}`, color: pendentes ? C.accent : C.sub }}>
              {sincronizando ? <Loader2 size={15} className="animate-spin" /> : <Grid3x3 size={15} />}
              Levar para a Matriz{pendentes ? ` (${pendentes})` : ""}
            </button>
          </>
        )}
      </div>

      {/* números do topo */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        <Kpi rotulo="Alavancagem total" valor={val(t.alavancagem)} sub="dívida + tributos, mútuos pelo capital" forte />
        <Kpi rotulo="Dívida (capital a pagar)" valor={val(t.dividaCapital)} sub="saldo dos contratos" />
        <Kpi rotulo="Passivo tributário" valor={val(t.tributos)} sub="RFB, PGFN e estaduais" />
        <Kpi rotulo="Compromisso mensal" valor={val(t.mensal)} sub={`inclui R$ ${brl(t.mensalTributos)} de parcelamentos fiscais`} cor={C.accent} />
      </div>

      <div className="rounded-xl p-3 mb-6 text-xs flex items-start gap-2" style={{ background: C.blueSoft, color: C.text }}>
        <Info size={15} className="shrink-0 mt-0.5" style={{ color: C.blue }} />
        <div>
          A alavancagem total usa a mesma régua da sua planilha: saldo a vencer nos parcelados e <b>capital</b> nos mútuos.
          Somando também os juros já contratados dos mútuos até o vencimento, o compromisso vai para <b>{val(t.alavancagemComJuros)}</b>.
        </div>
      </div>

      {/* composição */}
      {fatias.length > 0 && master && (
        <div className="rounded-xl p-4 mb-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-xs font-semibold mb-2" style={{ color: C.sub }}>Composição da alavancagem</div>
          <Barra fatias={fatias} />
        </div>
      )}

      {/* divergências encontradas */}
      {d.avisos.length > 0 && (
        <div className="rounded-xl p-4 mb-6" style={{ background: C.panel, border: `1px solid #F5C2BD`, borderTop: `3px solid ${C.yellow}` }}>
          <div className="font-semibold flex items-center gap-2 mb-1" style={{ color: C.text }}>
            <AlertTriangle size={16} style={{ color: C.yellow }} /> {d.avisos.length} contrato(s) com número da planilha diferente do cálculo
          </div>
          <div className="text-xs mb-2" style={{ color: C.sub }}>
            Os valores importados foram mantidos como estavam. Abra o contrato e use o cálculo quando quiser corrigir.
          </div>
          <div className="flex flex-col gap-1">
            {d.avisos.map((a) => (
              <div key={a.nome} className="text-xs rounded px-2 py-1.5" style={{ background: C.panel2 }}>
                <b style={{ color: C.text }}>{a.nome}</b>
                <ul className="mt-0.5" style={{ color: C.sub }}>{a.avisos.map((x, i) => <li key={i}>· {x}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* contratos por grupo */}
      {d.grupos.map((g, gi) => (
        <div key={g.grupo} className="mb-7">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block rounded" style={{ width: 10, height: 10, background: CORES[gi % CORES.length] }} />
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>{g.label.toUpperCase()}</div>
            <span className="text-xs" style={{ color: C.sub }}>
              {g.itens.length} contrato(s) · saldo {val(g.saldo)} · {val(g.mensal)}/mês
            </span>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 940 }}>
              <thead><tr style={{ background: C.panel2, color: C.sub }}>
                <th className="px-2 py-2 text-left font-semibold">Contrato</th>
                <th className="px-2 py-2 text-right font-semibold">Capital</th>
                <th className="px-2 py-2 text-right font-semibold">Taxa a.m.</th>
                <th className="px-2 py-2 text-left font-semibold">Prazo</th>
                <th className="px-2 py-2 text-right font-semibold">No mês</th>
                <th className="px-2 py-2 text-right font-semibold">A pagar</th>
                <th className="px-2 py-2 text-left font-semibold">Até</th>
                <th className="px-2 py-2"></th>
              </tr></thead>
              <tbody>
                {g.itens.map((c) => <LinhaContrato key={c.id} c={c} master={master} user={user} onMudou={onMudou} />)}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* tributos */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block rounded" style={{ width: 10, height: 10, background: CORES[4] }} />
        <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>PASSIVO TRIBUTÁRIO</div>
        <span className="text-xs" style={{ color: C.sub }}>{val(t.tributos)} · {val(t.mensalTributos)}/mês em parcelamentos</span>
        <div className="flex-1 h-px" style={{ background: C.line }} />
      </div>
      <div className="rounded-xl overflow-auto mb-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead><tr style={{ background: C.panel2, color: C.sub }}>
            <th className="px-2 py-2 text-left font-semibold">Órgão</th>
            <th className="px-2 py-2 text-left font-semibold">Descrição</th>
            <th className="px-2 py-2 text-right font-semibold">Valor</th>
            <th className="px-2 py-2 text-right font-semibold">Parcela/mês</th>
            <th className="px-2 py-2 text-left font-semibold">Situação</th>
          </tr></thead>
          <tbody>
            {d.tributos.map((gr) => gr.itens.map((x, i) => (
              <tr key={x.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-2 py-1.5" style={{ color: i === 0 ? C.text : C.sub, fontWeight: i === 0 ? 600 : 400 }}>{i === 0 ? gr.label : ""}</td>
                <td className="px-2 py-1.5" style={{ color: C.text }}>{x.descricao}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.text }}>{master ? brl(x.valor) : "•••••"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.sub }}>{x.parcelado ? (master ? brl(x.parcelaMensal) : "•••••") : "—"}</td>
                <td className="px-2 py-1.5">
                  <span className="px-1.5 rounded text-[10px] font-semibold"
                    style={{ background: x.exigivel ? C.redSoft : C.panel2, color: x.exigivel ? C.red : C.sub }}>
                    {x.exigivel ? "EXIGÍVEL" : "NÃO EXIGÍVEL"}
                  </span>
                  {x.parcelado && <span className="ml-1 px-1.5 rounded text-[10px] font-semibold" style={{ background: C.blueSoft, color: C.blue }}>PARCELADO</span>}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinhaContrato({ c, master, user, onMudou }) {
  const [abrindo, setAbrindo] = useState(false);
  const cor = c.vencido ? C.red : c.quitado ? C.sub : C.text;
  const prazo = c.tipo === "MUTUO"
    ? `${inteiro(c.prazoDias)} dias`
    : `${c.parcelasPagas}/${c.prazoMeses} pagas`;
  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.line}` }}>
        <td className="px-2 py-1.5">
          <div style={{ color: cor, fontWeight: 600 }}>{c.nome}</div>
          <div className="text-[11px]" style={{ color: C.sub }}>
            {c.credor || "—"}
            {c.avisos.length > 0 && <span className="ml-1" style={{ color: C.yellow }}>· {c.avisos.length} divergência(s)</span>}
            {c.vencido && <span className="ml-1 font-semibold" style={{ color: C.red }}>· VENCIDO</span>}
          </div>
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: cor }}>{master ? brl(c.capital) : "•••••"}</td>
        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.sub }}>{c.taxaMensal ? `${brl(c.taxaMensal)}%` : "—"}</td>
        <td className="px-2 py-1.5" style={{ color: C.sub }}>{prazo}</td>
        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: cor }}>{master ? brl(c.mensal) : "•••••"}</td>
        <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: cor }}>{master ? brl(c.compromisso) : "•••••"}</td>
        <td className="px-2 py-1.5" style={{ color: C.sub }}>{dBR(c.tipo === "MUTUO" ? c.vencimento : c.pagarAte)}</td>
        <td className="px-2">
          <button onClick={() => setAbrindo((x) => !x)} title="Detalhes" style={{ color: C.sub }}>
            <ChevronRight size={14} style={{ transform: abrindo ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          </button>
        </td>
      </tr>
      {abrindo && (
        <tr style={{ background: C.panel2 }}>
          <td colSpan={8} className="px-3 py-2">
            <div className="grid gap-3 text-[11px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", color: C.sub }}>
              <Det rot="Contratado em" v={dBR(c.dataContrato)} />
              {c.tipo === "MUTUO" ? (
                <>
                  <Det rot="Juros ao mês" v={master ? `R$ ${brl(c.jurosMes)}` : "•••••"} />
                  <Det rot="Juros até o vencimento" v={master ? `R$ ${brl(c.jurosTotais)}` : "•••••"} />
                  <Det rot="Juros já corridos" v={master ? `R$ ${brl(c.jurosAcumulados)}` : "•••••"} />
                  <Det rot="Valor a pagar" v={master ? `R$ ${brl(c.valorAPagar)}` : "•••••"} />
                  <Det rot="Dias para o vencimento" v={c.diasRestantes == null ? "—" : inteiro(c.diasRestantes)} />
                </>
              ) : (
                <>
                  <Det rot="1ª parcela" v={dBR(c.inicio)} />
                  <Det rot="Parcela" v={master ? `R$ ${brl(c.parcela)}` : "•••••"} />
                  <Det rot="Débito total" v={master ? `R$ ${brl(c.debitoTotal)}` : "•••••"} />
                  <Det rot="Pelas datas já teriam sido pagas" v={`${c.parcelasPagasCalculadas} parcela(s)`} />
                  {c.entrada ? <Det rot="Entrada" v={master ? `R$ ${brl(c.entrada)}` : "•••••"} /> : null}
                </>
              )}
              <Det rot="Na Matriz" v={c.naMatriz ? "sim" : "ainda não"} />
            </div>
            {c.avisos.length > 0 && (
              <div className="mt-2 text-[11px] rounded p-2" style={{ background: C.yellowSoft, color: C.yellow }}>
                {c.avisos.map((a, i) => <div key={i}>· {a}</div>)}
              </div>
            )}
            {c.observacao && <div className="mt-2 text-[11px]" style={{ color: C.sub }}>{c.observacao}</div>}
          </td>
        </tr>
      )}
    </>
  );
}
const Det = ({ rot, v }) => (<div><div style={{ fontWeight: 600 }}>{rot}</div><div style={{ color: C.text }}>{v}</div></div>);

function Kpi({ rotulo, valor, sub, cor, forte }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: forte ? `3px solid ${C.navy}` : "none" }}>
      <div className="text-xs font-semibold" style={{ color: C.sub }}>{rotulo}</div>
      <div className="mt-1 font-semibold" style={{ fontSize: forte ? 28 : 24, color: cor || C.text }}>{valor}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}

function Barra({ fatias }) {
  const [hover, setHover] = useState(null);
  const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  return (
    <div>
      <div className="flex rounded-full overflow-hidden" style={{ height: 12, gap: 2 }}>
        {fatias.map((f, i) => (
          <div key={f.nome} title={f.nome} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ width: `${(f.valor / total) * 100}%`, background: f.cor, opacity: hover === null || hover === i ? 1 : 0.45 }} />
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {fatias.map((f, i) => (
          <div key={f.nome} className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover === null || hover === i ? 1 : 0.5 }}>
            <span className="shrink-0 rounded" style={{ width: 10, height: 10, background: f.cor }} />
            <span className="flex-1 truncate" style={{ color: C.text }}>{f.nome}</span>
            <span style={{ color: C.sub }}>{pct(f.valor / total)}</span>
            <span className="font-medium tabular-nums" style={{ color: C.text, minWidth: 110, textAlign: "right" }}>R$ {brl(f.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- POSIÇÃO DE CRÉDITO ---------------- */
function Credito({ user, master, d, onMudou, abrirNovo }) {
  const t = d.totais;
  const val = (v) => (master ? compacto(v) : "•••••");
  const porBanco = useMemo(() => {
    const m = [];
    d.credito.forEach((c) => { let g = m.find((x) => x.banco === c.banco); if (!g) m.push(g = { banco: c.banco, itens: [] }); g.itens.push(c); });
    return m.map((g) => ({
      ...g,
      limite: g.itens.reduce((s, x) => s + x.limite, 0),
      utilizado: g.itens.reduce((s, x) => s + x.utilizado, 0),
    }));
  }, [d]);

  const editar = async (id, campo, valor) => {
    try { await api("/api/fin/alavancagem/limites", "PUT", { usuarioId: user.id, id, campo, valor }); onMudou(); }
    catch (e) { alert(e.message); }
  };
  const excluir = async (c) => {
    if (!confirm(`Excluir ${c.banco} · ${c.produto}?`)) return;
    await fetch(`/api/fin/alavancagem/limites?u=${user.id}&id=${c.id}`, { method: "DELETE" });
    onMudou();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="text-xs" style={{ color: C.sub }}>Posição em {dBR(d.hoje)}</div>
        <div className="flex-1" />
        {master && (
          <button onClick={abrirNovo} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.accent, color: "#fff" }}>
            <Plus size={15} /> Novo limite
          </button>
        )}
      </div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        <Kpi rotulo="Limite total" valor={val(t.limiteTotal)} sub={`${d.credito.length} produto(s) em ${porBanco.length} praça(s)`} forte />
        <Kpi rotulo="Utilizado" valor={val(t.usadoTotal)} sub={`${pct(t.usoLimite)} do limite`} cor={t.usoLimite > 0.8 ? C.red : C.text} />
        <Kpi rotulo="Disponível" valor={val(t.disponivelTotal)} sub="fôlego imediato" cor={C.green} />
      </div>

      {porBanco.map((g) => (
        <div key={g.banco} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Landmark size={14} style={{ color: C.accent }} />
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>{g.banco}</div>
            <span className="text-xs" style={{ color: C.sub }}>limite {val(g.limite)} · usado {val(g.utilizado)}</span>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr style={{ background: C.panel2, color: C.sub }}>
                <th className="px-2 py-2 text-left font-semibold">Produto</th>
                <th className="px-2 py-2 text-right font-semibold">Limite</th>
                <th className="px-2 py-2 text-right font-semibold">Utilizado</th>
                <th className="px-2 py-2 text-right font-semibold">Disponível</th>
                <th className="px-2 py-2 text-left font-semibold" style={{ width: 160 }}>Uso</th>
                <th className="px-2 py-2 text-right font-semibold">Taxa a.m.</th>
                <th className="px-2 py-2"></th>
              </tr></thead>
              <tbody>
                {g.itens.map((c) => {
                  const cor = c.uso >= 0.9 ? C.red : c.uso >= 0.6 ? C.yellow : C.green;
                  return (
                    <tr key={c.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="px-2 py-1.5" style={{ color: C.text }}>
                        {c.produto}
                        {c.automatico && <span className="ml-1 px-1.5 rounded text-[10px] font-semibold" style={{ background: C.blueSoft, color: C.blue }} title="Somado dos contratos de mútuo deste credor">automático</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.text }}>{master ? brl(c.limite) : "•••••"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.text }}>
                        {master
                          ? (c.automatico ? brl(c.utilizado) : <CelulaNum valor={c.utilizado} onSalvar={(v) => editar(c.id, "utilizado", v)} disabled={!master} />)
                          : "•••••"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: c.disponivel > 0 ? C.green : C.red }}>{master ? brl(c.disponivel) : "•••••"}</td>
                      <td className="px-2 py-1.5">
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: C.trilho }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, (c.uso || 0) * 100))}%`, height: "100%", background: cor, borderRadius: 999 }} />
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>{pct(c.uso)}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.sub }}>{c.taxaMensal ? `${brl(c.taxaMensal)}%` : "—"}</td>
                      <td className="px-2">
                        {master && <button onClick={() => excluir(c)} title="Excluir" style={{ color: C.sub }}><Trash2 size={13} /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function CelulaNum({ valor, onSalvar, disabled }) {
  const [v, setV] = useState(brl(valor));
  useEffect(() => { setV(brl(valor)); }, [valor]);
  const mudou = v !== brl(valor);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} disabled={disabled}
      onBlur={() => mudou && onSalvar(v)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="rounded px-1 py-0.5 text-xs text-right tabular-nums w-24"
      style={{ border: `1px solid ${mudou ? C.accent : "transparent"}`, background: "transparent", color: C.text }} />
  );
}

/* ---------------- novo contrato ---------------- */
const Campo = ({ rotulo, valor, onChange, tipo = "text", dica, children }) => (
  <label className="block">
    <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>{rotulo}</div>
    {children || (
      <input value={valor ?? ""} onChange={(e) => onChange(e.target.value)} type={tipo} placeholder={dica}
        className={`w-full rounded-lg px-2 py-1.5 text-sm ${tipo === "text" ? "" : "text-right tabular-nums"}`}
        style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} />
    )}
  </label>
);

function ContratoModal({ user, catalogos, onClose, onSalvo }) {
  const [f, setF] = useState({
    tipo: "MUTUO", grupo: "MUTUO_GIRO", nome: "", credor: "", capital: "", taxaMensal: "3",
    dataContrato: new Date().toISOString().slice(0, 10), prazoDias: "", vencimentoUnico: "",
    prazoMeses: "", inicioPagamento: "", parcela: "", entrada: "", observacao: "",
  });
  const [lancarCredito, setLancarCredito] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const num = (v) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

  // prévia do que o sistema vai calcular
  const previa = useMemo(() => {
    const cap = num(f.capital), taxa = num(f.taxaMensal);
    if (!cap) return null;
    if (f.tipo === "MUTUO") {
      let dias = Number(f.prazoDias) || 0;
      if (!dias && f.vencimentoUnico && f.dataContrato) dias = Math.round((new Date(f.vencimentoUnico) - new Date(f.dataContrato)) / 86400000);
      const jm = cap * (taxa / 100);
      return dias > 0 ? { jurosMes: jm, jurosTotais: jm * (dias / 30), total: cap + jm * (dias / 30), dias } : { jurosMes: jm };
    }
    const n0 = Number(f.prazoMeses) || 0;
    if (!n0) return null;
    const base = cap - num(f.entrada);
    const i = taxa / 100;
    const parcela = num(f.parcela) || (i ? (base * i * Math.pow(1 + i, n0)) / (Math.pow(1 + i, n0) - 1) : base / n0);
    return { parcela, total: parcela * n0, juros: parcela * n0 - base, meses: n0 };
  }, [f]);

  const salvar = async () => {
    setSalvando(true); setErro("");
    try { onSalvo(await api("/api/fin/alavancagem", "POST", { usuarioId: user.id, contrato: f, lancarCredito })); }
    catch (e) { setErro(e.message); setSalvando(false); }
  };

  const ehMutuo = f.tipo === "MUTUO";
  return (
    <Modal titulo="Novo contrato de dívida" onClose={onClose} largura={760}>
      <div className="text-xs mb-3 p-2 rounded" style={{ background: C.blueSoft, color: C.text }}>
        Informe capital, taxa e prazo — o sistema calcula parcela, juros, total e data final.
        Depois clique em <b>Levar para a Matriz</b> para a parcela entrar na Matriz oficial e seguir para o contas a pagar.
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Campo rotulo="Tipo">
          <select value={f.tipo} onChange={(e) => {
              const t = e.target.value;
              setF((x) => ({ ...x, tipo: t, grupo: t === "MUTUO" ? "MUTUO_GIRO" : t === "INVESTIMENTO" ? "INVESTIMENTO" : "GIRO_LP" }));
            }}
            className="w-full rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }}>
            {Object.entries(catalogos.tipos).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Grupo">
          <select value={f.grupo} onChange={(e) => set("grupo")(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }}>
            {catalogos.ordemGrupos.map((g) => <option key={g} value={g}>{catalogos.grupos[g]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Nome do contrato" valor={f.nome} onChange={set("nome")} dica="EX.: OP 16 - EMANUEL - GIRO" />
        <Campo rotulo="Credor" valor={f.credor} onChange={set("credor")} dica="EX.: EMANUEL" />
        <Campo rotulo="Capital contratado (R$)" valor={f.capital} onChange={set("capital")} tipo="tel" />
        <Campo rotulo="Taxa ao mês (%)" valor={f.taxaMensal} onChange={set("taxaMensal")} tipo="tel" dica="3" />
        <Campo rotulo="Contratado em" valor={f.dataContrato} onChange={set("dataContrato")} tipo="date" />
        {ehMutuo ? (
          <>
            <Campo rotulo="Prazo (dias)" valor={f.prazoDias} onChange={set("prazoDias")} tipo="tel" dica="441" />
            <Campo rotulo="ou data de pagamento" valor={f.vencimentoUnico} onChange={set("vencimentoUnico")} tipo="date" />
          </>
        ) : (
          <>
            <Campo rotulo="Prazo (meses)" valor={f.prazoMeses} onChange={set("prazoMeses")} tipo="tel" dica="36" />
            <Campo rotulo="1ª parcela em" valor={f.inicioPagamento} onChange={set("inicioPagamento")} tipo="date" />
            <Campo rotulo="Parcela (R$)" valor={f.parcela} onChange={set("parcela")} tipo="tel" dica="em branco = o sistema calcula" />
            <Campo rotulo="Entrada (R$)" valor={f.entrada} onChange={set("entrada")} tipo="tel" />
          </>
        )}
      </div>

      {previa && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: C.panel2 }}>
          <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>O sistema vai lançar</div>
          {ehMutuo ? (
            <div style={{ color: C.text }}>
              Juros de <b>R$ {brl(previa.jurosMes)}</b> por mês
              {previa.dias ? <> · {inteiro(previa.dias)} dias · juros totais <b>R$ {brl(previa.jurosTotais)}</b> · a pagar no vencimento <b>R$ {brl(previa.total)}</b></> : " · informe o prazo para ver o total"}
            </div>
          ) : (
            <div style={{ color: C.text }}>
              Parcela de <b>R$ {brl(previa.parcela)}</b> × {previa.meses} meses · débito total <b>R$ {brl(previa.total)}</b> · juros <b>R$ {brl(previa.juros)}</b>
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 mt-3 text-sm" style={{ color: C.text }}>
        <input type="checkbox" checked={lancarCredito} onChange={(e) => setLancarCredito(e.target.checked)} />
        Lançar o crédito recebido em <b>contas a receber</b> na data da contratação
      </label>

      <Campo rotulo="Observação" valor={f.observacao} onChange={set("observacao")} dica="OPCIONAL" />

      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          <Save size={15} /> {salvando ? "Salvando…" : "Criar contrato"}
        </button>
      </div>
    </Modal>
  );
}

function LimiteModal({ user, onClose, onSalvo }) {
  const [f, setF] = useState({ banco: "", produto: "", limite: "", taxaMensal: "", utilizado: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setSalvando(true); setErro("");
    try { await api("/api/fin/alavancagem/limites", "POST", { usuarioId: user.id, ...f }); onSalvo(); }
    catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo="Novo limite de crédito" onClose={onClose} largura={560}>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Campo rotulo="Banco / credor" valor={f.banco} onChange={set("banco")} dica="EX.: BRADESCO" />
        <Campo rotulo="Produto" valor={f.produto} onChange={set("produto")} dica="EX.: CONTA GARANTIDA" />
        <Campo rotulo="Limite (R$)" valor={f.limite} onChange={set("limite")} tipo="tel" />
        <Campo rotulo="Taxa ao mês (%)" valor={f.taxaMensal} onChange={set("taxaMensal")} tipo="tel" />
        <Campo rotulo="Utilizado (R$)" valor={f.utilizado} onChange={set("utilizado")} tipo="tel" dica="vazio nos mútuos" />
      </div>
      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          <Save size={15} /> {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ titulo, onClose, children, largura = 560 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto" style={{ background: "rgba(0,30,65,0.35)" }}>
      <div className="rounded-xl my-8" style={{ background: C.panel, width: "100%", maxWidth: largura }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
