"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingDown, CreditCard, Plus, Save, X, Trash2, AlertTriangle, CheckCircle2, Landmark,
  Grid3x3, Loader2, ChevronRight, Pencil, Info, Banknote,
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
  const [editar, setEditar] = useState(null);   // contrato aberto para edição
  const [pagar, setPagar] = useState(null);     // contrato recebendo pagamento extra
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
            abrirNovo={() => setNovo(true)} abrirEditar={setEditar} abrirPagar={setPagar}
            sincronizar={sincronizar} sincronizando={sincronizando} />}

      {novo && <ContratoModal user={user} catalogos={d.catalogos} onClose={() => setNovo(false)}
        onSalvo={(r) => { setNovo(false); setAviso({ tipo: "ok", texto: `Contrato criado.${r.credito ? " O crédito do capital entrou em contas a receber." : ""} Clique em “Levar para a Matriz” para as parcelas chegarem ao contas a pagar.` }); carregar(); }} />}
      {editar && <ContratoModal user={user} catalogos={d.catalogos} contrato={editar} onClose={() => setEditar(null)}
        onSalvo={() => { setEditar(null); setAviso({ tipo: "ok", texto: "Contrato atualizado. Clique em “Levar para a Matriz” para o contas a pagar acompanhar." }); carregar(); }} />}
      {pagar && <PagamentoExtraModal user={user} contrato={pagar} onClose={() => setPagar(null)}
        onAplicado={(txt) => { setPagar(null); setAviso({ tipo: "ok", texto: txt }); carregar(); }} />}
      {novoLimite && <LimiteModal user={user} onClose={() => setNovoLimite(false)}
        onSalvo={() => { setNovoLimite(false); carregar(); }} />}
    </div>
  );
}

/* ---------------- DÍVIDAS ---------------- */
function Dividas({ user, master, d, fatias, onMudou, abrirNovo, abrirEditar, abrirPagar, sincronizar, sincronizando }) {
  const t = d.totais;
  const novoTributo = async () => {
    const descricao = prompt("Descrição do tributo (ex.: PARCELAMENTO FEDERAL 4)");
    if (!descricao) return;
    const grupo = (prompt("Órgão: RFB, PGFN, ESTADUAL ou OUTRO", "RFB") || "OUTRO").toUpperCase();
    try { await api("/api/fin/alavancagem/tributos", "POST", { usuarioId: user.id, grupo, descricao, valor: "", parcelado: true }); onMudou(); }
    catch (e) { alert(e.message); }
  };
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

      {master && (
        <div className="text-xs mb-2" style={{ color: C.sub }}>
          Clique no nome do contrato para editar. No fim da linha: <b>cédula</b> lança um pagamento extra, <b>lápis</b> edita, <b>seta</b> abre os detalhes.
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
                <th className="px-2 py-2 sticky right-0" style={{ background: C.panel2 }}></th>
              </tr></thead>
              <tbody>
                {g.itens.map((c) => <LinhaContrato key={c.id} c={c} master={master} user={user} onMudou={onMudou} onEditar={abrirEditar} onPagar={abrirPagar} />)}
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
        {master && (
          <button onClick={() => novoTributo()} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
            <Plus size={13} /> Novo tributo
          </button>
        )}
      </div>
      <div className="rounded-xl overflow-auto mb-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 980 }}>
          <thead><tr style={{ background: C.panel2, color: C.sub }}>
            <th className="px-2 py-2 text-left font-semibold">Órgão</th>
            <th className="px-2 py-2 text-left font-semibold">Descrição</th>
            <th className="px-2 py-2 text-right font-semibold">Valor</th>
            <th className="px-2 py-2 text-right font-semibold">Parcela/mês</th>
            <th className="px-2 py-2 text-right font-semibold">Parcelas</th>
            <th className="px-2 py-2 text-left font-semibold">1ª parcela</th>
            <th className="px-2 py-2 text-right font-semibold">Pagas</th>
            <th className="px-2 py-2 text-right font-semibold">Saldo</th>
            <th className="px-2 py-2 text-left font-semibold">Até</th>
            <th className="px-2 py-2"></th>
          </tr></thead>
          <tbody>
            {d.tributos.map((gr) => gr.itens.map((x, i) => (
              <LinhaTributo key={x.id} x={x} grupo={i === 0 ? gr.label : ""} master={master} user={user} onMudou={onMudou} />
            )))}
          </tbody>
        </table>
      </div>
      {master && (
        <div className="text-[11px] mb-6" style={{ color: C.sub }}>
          Preencha dois entre valor, parcela e nº de parcelas — o sistema sugere o terceiro (em azul) e calcula saldo, pagas e data final.
          Os quatro parcelamentos em branco já ficam criados para você completar quando os números chegarem.
        </div>
      )}
    </div>
  );
}

function LinhaContrato({ c, master, user, onMudou, onEditar, onPagar }) {
  const [abrindo, setAbrindo] = useState(false);
  const excluir = async () => {
    if (!confirm(`Excluir o contrato ${c.nome}?\nEle também sai da aba Dívidas da Matriz na próxima sincronização.`)) return;
    await fetch(`/api/fin/alavancagem?u=${user.id}&id=${c.id}`, { method: "DELETE" });
    onMudou();
  };
  const cor = c.vencido ? C.red : c.quitado ? C.sub : C.text;
  const prazo = c.tipo === "MUTUO"
    ? `${inteiro(c.prazoDias)} dias`
    : `${c.parcelasPagas}/${c.prazoMeses} pagas`;
  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.line}` }}>
        <td className="px-2 py-1.5">
          {master ? (
            <button onClick={() => onEditar(c)} title="Clique para editar este contrato"
              className="flex items-center gap-1.5 text-left hover:underline" style={{ color: cor, fontWeight: 600 }}>
              {c.nome} <Pencil size={11} style={{ color: C.accent }} />
            </button>
          ) : (
            <div style={{ color: cor, fontWeight: 600 }}>{c.nome}</div>
          )}
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
        <td className="px-2 whitespace-nowrap sticky right-0" style={{ background: C.panel, boxShadow: `-6px 0 6px -6px rgba(0,0,0,.15)` }}>
          {master && (
            <>
              <button onClick={() => onPagar(c)} title="Lançar pagamento extra (amortizar)" className="mr-1" style={{ color: C.accent }}><Banknote size={14} /></button>
              <button onClick={() => onEditar(c)} title="Editar contrato" className="mr-1" style={{ color: C.sub }}><Pencil size={13} /></button>
              <button onClick={excluir} title="Excluir contrato" className="mr-1" style={{ color: C.sub }}><Trash2 size={13} /></button>
            </>
          )}
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
            {c.amort && !c.amort.bullet && (
              <div className="mt-3 rounded p-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-[11px] font-semibold mb-1" style={{ color: C.navy }}>Juros × amortização</div>
                <div className="grid gap-3 text-[11px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", color: C.sub }}>
                  <Det rot="Capital pela parcela e prazo" v={master ? `R$ ${brl(c.amort.principal)}` : "•••••"} />
                  <Det rot="Juros do contrato inteiro" v={master ? `R$ ${brl(c.amort.jurosTotais)}` : "•••••"} />
                  <Det rot="Juros já pagos" v={master ? `R$ ${brl(c.amort.jurosPagos)}` : "•••••"} />
                  <Det rot="Capital já amortizado" v={master ? `R$ ${brl(c.amort.amortizado)}` : "•••••"} />
                  <Det rot="Saldo devedor (só capital)" v={master ? `R$ ${brl(c.amort.saldoDevedor)}` : "•••••"} />
                  <Det rot="Juros que ainda vão correr" v={master ? `R$ ${brl(c.amort.jurosAVencer)}` : "•••••"} />
                  {c.amort.proxima && (
                    <Det rot={`Próxima parcela (${c.amort.proxima.n}ª)`}
                      v={master ? `R$ ${brl(c.amort.proxima.juros)} de juros + R$ ${brl(c.amort.proxima.amortizacao)} de capital` : "•••••"} />
                  )}
                  <Det rot="Parcelas pagas contadas por" v={
                    c.amort.fonte === "BAIXAS" ? `baixa no contas a pagar (${c.amort.titulosPagos} baixada(s))`
                    : c.amort.fonte === "MANUAL" ? "ajuste à mão no contrato" : "datas do calendário"} />
                </div>
                {Math.abs(c.amort.diferencaCapital || 0) > 1 && (
                  <div className="mt-2 text-[11px]" style={{ color: C.yellow }}>
                    A parcela e o prazo implicam R$ {brl(c.amort.principal)} de capital, mas o contrato traz
                    R$ {brl(c.capital)} — diferença de R$ {brl(c.amort.diferencaCapital)}. Confira a taxa.
                  </div>
                )}
              </div>
            )}
            {c.amort && c.amort.bullet && (
              <div className="mt-3 rounded p-2 text-[11px]" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>
                <b style={{ color: C.navy }}>Juros × amortização:</b> no mútuo nada amortiza antes do vencimento —
                são R$ {brl(c.amort.jurosMes)} de juros por mês e o capital de R$ {brl(c.amort.principal)} volta inteiro no fim.
              </div>
            )}
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
function LinhaTributo({ x, grupo, master, user, onMudou }) {
  const c = x.calculo || {};
  const editar = async (campo, valor) => {
    try { await api("/api/fin/alavancagem/tributos", "PUT", { usuarioId: user.id, id: x.id, campo, valor }); onMudou(); }
    catch (e) { alert(e.message); }
  };
  const excluir = async () => {
    if (!confirm(`Excluir ${x.descricao}?`)) return;
    await fetch(`/api/fin/alavancagem/tributos?u=${user.id}&id=${x.id}`, { method: "DELETE" });
    onMudou();
  };
  const Cel = ({ valor, campo, tipo = "num", largura = 90, sugerido }) => (
    master
      ? <CelulaEdit valor={valor} tipo={tipo} largura={largura} sugerido={sugerido} onSalvar={(v) => editar(campo, v)} />
      : <span>{valor === null || valor === undefined ? "—" : tipo === "num" ? brl(valor) : String(valor)}</span>
  );
  const vazio = c.emBranco;
  return (
    <tr style={{ borderTop: `1px solid ${C.line}`, opacity: vazio ? 0.75 : 1 }}>
      <td className="px-2 py-1.5" style={{ color: grupo ? C.text : C.sub, fontWeight: grupo ? 600 : 400 }}>{grupo}</td>
      <td className="px-2 py-1.5" style={{ color: C.text }}>
        <Cel valor={x.descricao} campo="descricao" tipo="texto" largura={230} />
        {vazio && <span className="ml-1 px-1.5 rounded text-[10px] font-semibold" style={{ background: C.yellowSoft, color: C.yellow }}>a preencher</span>}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums"><Cel valor={x.valor} campo="valor" /></td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        <Cel valor={x.parcelaMensal ?? (c.sugeriuParcela ? c.parcela : null)} campo="parcelaMensal" sugerido={c.sugeriuParcela} />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        <Cel valor={x.parcelas ?? (c.sugeriuParcelas ? c.parcelas : null)} campo="parcelas" tipo="int" largura={60} sugerido={c.sugeriuParcelas} />
      </td>
      <td className="px-2 py-1.5"><Cel valor={x.inicio ? String(x.inicio).slice(0, 10) : ""} campo="inicio" tipo="data" largura={120} /></td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        <Cel valor={x.parcelasPagas ?? c.parcelasPagas} campo="parcelasPagas" tipo="int" largura={60} sugerido={x.parcelasPagas == null && c.parcelasPagas != null} />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: C.text }}>{c.saldo == null ? "—" : (master ? brl(c.saldo) : "•••••")}</td>
      <td className="px-2 py-1.5" style={{ color: C.sub }}>{dBR(c.fim)}</td>
      <td className="px-2 whitespace-nowrap">
        <button onClick={() => editar("exigivel", !x.exigivel)} disabled={!master} title="Exigível / não exigível"
          className="px-1.5 rounded text-[10px] font-semibold mr-1"
          style={{ background: x.exigivel ? C.redSoft : C.panel2, color: x.exigivel ? C.red : C.sub }}>
          {x.exigivel ? "EXIGÍVEL" : "NÃO EXIG."}
        </button>
        {master && <button onClick={excluir} title="Excluir" style={{ color: C.sub }}><Trash2 size={13} /></button>}
      </td>
    </tr>
  );
}

// célula que vira input ao clicar; o valor sugerido pelo sistema aparece em azul
function CelulaEdit({ valor, tipo, largura, sugerido, onSalvar }) {
  const fmt = (v) => (v === null || v === undefined || v === "" ? "" : tipo === "num" ? brl(v) : String(v));
  const [v, setV] = useState(fmt(valor));
  useEffect(() => { setV(fmt(valor)); }, [valor]);
  const mudou = v !== fmt(valor);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} type={tipo === "data" ? "date" : "text"}
      onBlur={() => mudou && onSalvar(v)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      placeholder="—"
      className={`rounded px-1 py-0.5 text-xs ${tipo === "texto" || tipo === "data" ? "" : "text-right tabular-nums"}`}
      style={{ width: largura, border: `1px solid ${mudou ? C.accent : "transparent"}`,
        background: "transparent", color: sugerido ? C.blue : C.text, fontStyle: sugerido ? "italic" : "normal" }}
      title={sugerido ? "Sugerido pelo sistema — digite para fixar" : undefined} />
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

function ContratoModal({ user, catalogos, contrato, onClose, onSalvo }) {
  const b = contrato?.bruto || null;
  const edicao = !!b;
  const dt = (v) => (v ? String(v).slice(0, 10) : "");
  const nm = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
  const [f, setF] = useState(() => b ? {
    tipo: b.tipo, grupo: b.grupo, nome: b.nome || "", credor: b.credor || "",
    capital: nm(b.capital), taxaMensal: nm(b.taxaMensal), dataContrato: dt(b.dataContrato),
    prazoDias: b.prazoDias ?? "", vencimentoUnico: dt(b.vencimentoUnico),
    prazoMeses: b.prazoMeses ?? "", inicioPagamento: dt(b.inicioPagamento),
    parcela: nm(b.parcela), entrada: nm(b.entrada), observacao: b.observacao || "",
    parcelasPagas: b.parcelasPagas ?? "", quitado: !!b.quitado,
  } : {
    tipo: "MUTUO", grupo: "MUTUO_GIRO", nome: "", credor: "", capital: "", taxaMensal: "3",
    dataContrato: new Date().toISOString().slice(0, 10), prazoDias: "", vencimentoUnico: "",
    prazoMeses: "", inicioPagamento: "", parcela: "", entrada: "", observacao: "",
    parcelasPagas: "", quitado: false,
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

  const salvar = async (extra = {}) => {
    setSalvando(true); setErro("");
    try {
      if (edicao) {
        await api("/api/fin/alavancagem", "PUT", { usuarioId: user.id, id: b.id, campos: { ...f, ...extra } });
        onSalvo({ editado: true });
      } else {
        onSalvo(await api("/api/fin/alavancagem", "POST", { usuarioId: user.id, contrato: f, lancarCredito }));
      }
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  // apaga os números que vieram da planilha: o contrato passa a valer só pelo cálculo
  const usarCalculo = () => {
    if (!confirm("Descartar os números que vieram da planilha e deixar o contrato valer pelo cálculo do sistema?")) return;
    salvar({ debitoTotalInformado: "", aVencerInformado: "", pagarAteInformado: "",
             valorAPagarInformado: "", jurosTotaisInformado: "", jurosMesInformado: "", parcelasPagasInformadas: "" });
  };

  const temInformado = edicao && [b.debitoTotalInformado, b.aVencerInformado, b.pagarAteInformado,
    b.valorAPagarInformado, b.jurosTotaisInformado, b.jurosMesInformado, b.parcelasPagasInformadas].some((x) => x !== null && x !== undefined);

  const ehMutuo = f.tipo === "MUTUO";
  return (
    <Modal titulo={edicao ? `Editar · ${b.nome}` : "Novo contrato de dívida"} onClose={onClose} largura={760}>
      <div className="text-xs mb-3 p-2 rounded" style={{ background: C.blueSoft, color: C.text }}>
        Informe capital, taxa e prazo — o sistema calcula parcela, juros, total e data final.
        Depois clique em <b>Levar para a Matriz</b> para a parcela entrar na Matriz oficial e seguir para o contas a pagar.
      </div>

      {temInformado && (
        <div className="text-xs mb-3 p-2 rounded flex flex-wrap items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}>
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">Este contrato ainda carrega números digitados na planilha, que estão prevalecendo sobre o cálculo.</span>
          <button onClick={usarCalculo} className="px-2 py-1 rounded font-semibold" style={{ background: C.panel, color: C.navy }}>
            Usar o cálculo do sistema
          </button>
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Campo rotulo="Tipo">
          <select value={f.tipo} disabled={edicao} onChange={(e) => {
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

      {edicao ? (
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {!ehMutuo && <Campo rotulo="Parcelas já pagas" valor={f.parcelasPagas} onChange={set("parcelasPagas")} tipo="tel" dica="vazio = conta pela data" />}
          <label className="flex items-end gap-2 text-sm pb-1" style={{ color: C.text }}>
            <input type="checkbox" checked={!!f.quitado} onChange={(e) => setF((x) => ({ ...x, quitado: e.target.checked }))} />
            Contrato quitado
          </label>
        </div>
      ) : (
        <label className="flex items-center gap-2 mt-3 text-sm" style={{ color: C.text }}>
          <input type="checkbox" checked={lancarCredito} onChange={(e) => setLancarCredito(e.target.checked)} />
          Lançar o crédito recebido em <b>contas a receber</b> na data da contratação
        </label>
      )}

      <Campo rotulo="Observação" valor={f.observacao} onChange={set("observacao")} dica="OPCIONAL" />

      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={() => salvar()} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          <Save size={15} /> {salvando ? "Salvando…" : edicao ? "Salvar alterações" : "Criar contrato"}
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

/* ---------------- pagamento extra (amortização) ---------------- */
function PagamentoExtraModal({ user, contrato, onClose, onAplicado }) {
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [sim, setSim] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [aplicando, setAplicando] = useState("");
  const [erro, setErro] = useState("");

  const simular = async () => {
    setCalculando(true); setErro(""); setSim(null);
    try {
      const r = await api("/api/fin/alavancagem/pagamento", "POST", { usuarioId: user.id, contratoId: contrato.id, valor, simular: true });
      setSim(r.simulacao);
    } catch (e) { setErro(e.message); }
    setCalculando(false);
  };

  const aplicar = async (modo) => {
    const txt = modo === "PRAZO" ? "abater o prazo" : modo === "PARCELA" ? "reduzir a parcela" : "abater o capital";
    if (!confirm(`Confirma o pagamento de R$ ${brl(valor)} em ${contrato.nome} para ${txt}?`)) return;
    setAplicando(modo); setErro("");
    try {
      await api("/api/fin/alavancagem/pagamento", "POST", { usuarioId: user.id, contratoId: contrato.id, valor, data, modo });
      onAplicado(`Pagamento de R$ ${brl(valor)} lançado em ${contrato.nome}. Clique em “Levar para a Matriz” para o contas a pagar acompanhar.`);
    } catch (e) { setErro(e.message); setAplicando(""); }
  };

  const Opcao = ({ titulo, sub, linhas, economia, modo, destaque }) => (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: C.panel, border: `1px solid ${destaque ? C.accent : C.line}` }}>
      <div className="font-semibold" style={{ color: C.text }}>{titulo}</div>
      <div className="text-[11px] mb-2" style={{ color: C.sub }}>{sub}</div>
      <div className="flex flex-col gap-1 text-xs">
        {linhas.map(([r, v], i) => (
          <div key={i} className="flex justify-between gap-2">
            <span style={{ color: C.sub }}>{r}</span>
            <span className="tabular-nums font-medium" style={{ color: C.text }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded p-2 text-xs" style={{ background: C.greenSoft, color: C.green }}>
        Economia de juros: <b>R$ {brl(economia)}</b>
      </div>
      {modo && (
        <button onClick={() => aplicar(modo)} disabled={!!aplicando}
          className="mt-3 w-full py-2 rounded-lg text-sm font-semibold"
          style={{ background: destaque ? C.accent : C.panel2, color: destaque ? "#fff" : C.navy, opacity: aplicando ? 0.6 : 1 }}>
          {aplicando === modo ? "Aplicando…" : "Escolher esta"}
        </button>
      )}
    </div>
  );

  return (
    <Modal titulo={`Pagamento extra · ${contrato.nome}`} onClose={onClose} largura={820}>
      <div className="text-xs mb-3 p-2 rounded" style={{ background: C.blueSoft, color: C.text }}>
        Informe quanto você vai pagar além da parcela. O sistema calcula o saldo devedor de hoje e mostra os dois caminhos:
        manter a parcela e <b>encurtar o prazo</b>, ou manter o prazo e <b>reduzir a parcela</b>.
      </div>

      <div className="grid gap-3 items-end" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <Campo rotulo="Valor do pagamento (R$)" valor={valor} onChange={setValor} tipo="tel" />
        <Campo rotulo="Data do pagamento" valor={data} onChange={setData} tipo="date" />
        <button onClick={simular} disabled={calculando || !valor}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ border: `1px solid ${C.accent}`, color: C.accent, opacity: calculando || !valor ? 0.5 : 1 }}>
          {calculando ? <Loader2 size={15} className="animate-spin" /> : <Banknote size={15} />} Calcular
        </button>
      </div>

      {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {sim && sim.tipo === "PARCELADO" && (
        <>
          <div className="mt-4 text-xs" style={{ color: C.sub }}>
            Saldo devedor hoje (valor presente das {sim.atual.parcelasRestantes} parcelas que faltam, a {brl(sim.taxaMensal)}% a.m.):
            <b style={{ color: C.text }}> R$ {brl(sim.saldo)}</b> · continuando como está você pagaria <b style={{ color: C.text }}>R$ {brl(sim.atual.total)}</b>.
          </div>
          <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Opcao destaque modo="PRAZO" titulo="Abater o prazo"
              sub="mantém a parcela e antecipa o fim do contrato"
              linhas={[["Parcela", `R$ ${brl(sim.prazo.parcela)} (igual)`],
                       ["Parcelas restantes", `${sim.prazo.parcelasRestantes} (−${sim.prazo.mesesAMenos})`],
                       ["Última parcela", dBR(sim.prazo.pagarAte)],
                       ["Total até quitar", `R$ ${brl(sim.prazo.total)}`]]}
              economia={sim.prazo.economia} />
            <Opcao modo="PARCELA" titulo="Reduzir a parcela"
              sub="mantém o prazo e alivia o mês"
              linhas={[["Parcela", `R$ ${brl(sim.parcelaMenor.parcela)} (−R$ ${brl(sim.parcelaMenor.reducao)})`],
                       ["Parcelas restantes", `${sim.parcelaMenor.parcelasRestantes} (igual)`],
                       ["Última parcela", dBR(sim.parcelaMenor.pagarAte)],
                       ["Total até quitar", `R$ ${brl(sim.parcelaMenor.total)}`]]}
              economia={sim.parcelaMenor.economia} />
          </div>
        </>
      )}

      {sim && sim.tipo === "MUTUO" && (
        <div className="mt-4">
          <div className="text-xs mb-2" style={{ color: C.sub }}>{sim.nota}</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Opcao titulo="Como está hoje" sub={`${inteiro(sim.diasRestantes)} dias até o vencimento`}
              linhas={[["Capital", `R$ ${brl(sim.antes.capital)}`], ["Juros por mês", `R$ ${brl(sim.antes.jurosMes)}`],
                       ["A pagar no vencimento", `R$ ${brl(sim.antes.totalNoVencimento)}`]]}
              economia={0} />
            <Opcao destaque modo="MUTUO" titulo="Depois do pagamento" sub="o capital é abatido e os juros caem"
              linhas={[["Capital", `R$ ${brl(sim.depois.capital)}`], ["Juros por mês", `R$ ${brl(sim.depois.jurosMes)}`],
                       ["A pagar no vencimento", `R$ ${brl(sim.depois.totalNoVencimento)}`]]}
              economia={sim.economia} />
          </div>
        </div>
      )}

      {sim && sim.tipo === "QUITA" && (
        <div className="mt-4 rounded-xl p-4" style={{ background: C.greenSoft, border: `1px solid ${C.green}` }}>
          <div className="font-semibold" style={{ color: C.green }}>Esse valor quita o contrato</div>
          <div className="text-xs mt-1" style={{ color: C.text }}>{sim.nota} Economia de juros: <b>R$ {brl(sim.economia)}</b>.</div>
          <button onClick={() => aplicar("QUITA")} disabled={!!aplicando}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.green, color: "#fff", opacity: aplicando ? 0.6 : 1 }}>
            {aplicando ? "Aplicando…" : "Marcar como quitado"}
          </button>
        </div>
      )}

      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Fechar</button>
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
