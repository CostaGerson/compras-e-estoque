"use client";
// v595 — Lançamento de pedido sem o KM: tipo (venda/interno), nº automático, cliente por nome ou CNPJ, prazo de entrega → despacho,
// itens do cadastro do KM + FPP indexada (artigo e rendimento), entregas única/fracionada/terceiros com grade por local,
// prazo de pagamento (entrada + parcelas por emissão / NF / entrega), obs da NF e anexos por arraste.
import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Printer, Paperclip, FileText, X, Copy, Search, Wand2, RotateCcw } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import DadosUnitarios from "./dadosUnitarios";
import { vazioDU } from "@/lib/dadosUnitarios";   // v743
import { ClienteFinalResumo } from "./clienteFinal";   // v709 — cliente final e envio (pedido do portal)   // v699 — dados por peça (nome, tipo sanguíneo…) e link para o cliente preencher
import PersonalizacaoItem, { juntarAplicacoesFpp } from "./personalizacaoItem";
import { SERVICOS, servicoDe } from "@/lib/servicosLista";   // v826 — tipo de serviço → receita   // v806 — estampas com medidas e arquivos
import { imprimirPedido } from "./impressaoPedido";   // v615 — PP (sem valores) e PV (com valores)
import { pecaParaItem, condicaoParaPagamento, prazoParaDias, corNaFpp } from "@/lib/lancamentoSkill";   // v696
import {
  num, hojeISO, dataBR, somaDias, qtdGrade, conferirEntregas, parcelasCalc, textoCondicao, textoRestricao, DOWS, DOWS_LONGO, textoObsNf, MODOS_ENTREGA, DOCS_ENTREGA, BASES, freteTotal, valorDesconto, precoComDesconto,
  paramFora, tecidoDaFpp, numFpp, partesTecido, tecidoDoResumo,
} from "@/lib/pedidoLanc";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", yellow: "#C08401", red: "#C33",
};
const inp = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const money = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dig = (s) => String(s || "").replace(/\D/g, "");
const fmtCnpj = (s) => { const d = dig(s); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : s || ""; };
const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSem = (s) => (s ? DIAS_SEM[new Date(s + "T12:00:00Z").getUTCDay()] : "");
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
// v632 — grades: masculina (padrão, sempre) + especiais (infantil em anos, babylook "BL …") inseridas pelo botão
const TAM_INF = ["2", "4", "6", "8", "10", "12", "14"];
const secaoTam = (t) => (/^\d+$/.test(String(t)) && Number(t) <= 16 ? "INF" : /^BL /.test(String(t)) ? "BL" : "MASC");
const gradesDe = (tamanhos) => ({ MASC: { rot: "Adulto (masculino)", tams: tamanhos }, INF: { rot: "Infantil (anos)", tams: TAM_INF }, BL: { rot: "Babylook", tams: tamanhos.map((t) => "BL " + t) } });
// v750 — desconto na peça: R$ ou % sobre o preço cheio; o valor unitário do item passa a ser o preço com desconto
const fmtV = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const descItem = (d) => ({ desconto: d, valorUnitario: fmtV(precoComDesconto(d)) });
function DescontoPeca({ it, onChange }) {
  const d = it.desconto;
  const TipoBtn = ({ k, t }) => <button type="button" onClick={() => onChange({ ...d, tipo: k })} className="px-2 py-0.5 text-[11px] font-semibold rounded" style={{ background: d?.tipo === k ? "#fff" : "transparent", color: d?.tipo === k ? C.text : C.sub, boxShadow: d?.tipo === k ? "0 1px 2px rgba(0,0,0,.12)" : "none" }}>{t}</button>;
  if (!d) return <button type="button" onClick={() => onChange({ tipo: "PCT", valor: "", base: it.valorUnitario })} className="text-[11px] mt-1" style={{ color: C.accent }}>+ desconto na peça</button>;
  return (
    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px]">
      <span style={{ color: C.sub }}>Desconto</span>
      <span className="inline-flex rounded p-0.5" style={{ background: C.panel2, border: `1px solid ${C.line}` }}><TipoBtn k="PCT" t="%" /><TipoBtn k="VALOR" t="R$" /></span>
      <input value={d.valor} onChange={(e) => onChange({ ...d, valor: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="0" inputMode="decimal" className="w-14 px-1 py-0.5 rounded outline-none text-right" style={inp} />
      <span style={{ color: C.green }}>= {money(precoComDesconto(d))}/pç</span>
      <button type="button" onClick={() => onChange(null)} title="Tirar o desconto" style={{ color: C.sub }}><X size={11} /></button>
    </div>
  );
}
// v750 — desconto no total do pedido: R$ ou % sobre o valor dos itens (o frete não entra)
function DescontoCard({ f, set, totalItens, descV, podeLancar }) {
  const d = f.desconto || { tipo: "PCT", valor: "" };
  const on = num(d.valor) > 0 || d.ligado;
  return (
    <Card titulo="Desconto no total do pedido">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {[[false, "Não"], [true, "Sim"]].map(([k, t]) => <label key={t} className="flex items-center gap-1 cursor-pointer"><input type="radio" disabled={!podeLancar} checked={!!on === k} onChange={() => set("desconto", k ? { ...d, ligado: true } : { tipo: "PCT", valor: "" })} /> {t}</label>)}
        {on && <>
          <div className="inline-flex rounded-md p-0.5" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
            {[["PCT", "%"], ["VALOR", "R$"]].map(([k, t]) => <button key={k} type="button" disabled={!podeLancar} onClick={() => set("desconto", { ...d, tipo: k })} className="px-3 py-1 text-xs font-semibold rounded" style={{ background: d.tipo === k ? "#fff" : "transparent", color: d.tipo === k ? C.text : C.sub, boxShadow: d.tipo === k ? "0 1px 2px rgba(0,0,0,.12)" : "none" }}>{t}</button>)}
          </div>
          <input value={d.valor ?? ""} disabled={!podeLancar} onChange={(e) => set("desconto", { ...d, valor: e.target.value.replace(/[^\d,.]/g, "") })} placeholder={d.tipo === "PCT" ? "0 %" : "0,00"} inputMode="decimal" className="w-24 px-2 py-1.5 rounded outline-none text-sm text-right" style={{ ...inp, background: C.panel }} />
          {descV > 0 && <span>Desconto <b style={{ color: C.red }}>− {money(descV)}</b> <span className="text-xs" style={{ color: C.sub }}>sobre itens de {money(totalItens)}</span></span>}
        </>}
      </div>
    </Card>
  );
}
// v747 — venda comissionada: vendedor (Dados › Vendedores) + comissão em % (sobre os itens, sem frete) ou em R$
function ComissaoCard({ f, set, uid, totalItens, podeLancar }) {
  const [vs, setVs] = useState(null);
  const [novo, setNovo] = useState(false);
  const carregar = () => fetch(`/api/vendedores?u=${uid}`).then((r) => r.json()).then((j) => setVs(j.vendedores || [])).catch(() => setVs([]));
  const c = f.comissao || { vendedorId: null, tipo: "PCT", valor: "" };
  const on = !!c.vendedorId || c.ligada;
  useEffect(() => { if (on && !vs) carregar(); }, [on]);
  // v773 — #63: ao ligar a venda comissionada, já vem o vendedor do pedido
  const doPedido = (l) => (l || []).find((x) => x.nome === String(f.vendedor || "").toUpperCase().trim()) || (l || []).find((x) => x.nome.split(/\s+/)[0] === String(f.vendedor || "").toUpperCase().trim().split(/\s+/)[0]);
  useEffect(() => { if (on && vs && !c.vendedorId) { const x = doPedido(vs); if (x) up({ vendedorId: x.id }); } }, [on, vs, f.vendedor]);
  const up = (patch) => set("comissao", { ...c, ...patch });
  const v = (vs || []).find((x) => x.id === Number(c.vendedorId));
  const total = c.tipo === "PCT" ? totalItens * num(c.valor) / 100 : num(c.valor);
  return (
    <Card titulo="Venda comissionada">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {[[false, "Não"], [true, "Sim"]].map(([k, t]) => <label key={t} className="flex items-center gap-1 cursor-pointer"><input type="radio" disabled={!podeLancar} checked={on === k} onChange={() => set("comissao", k ? { ...c, ligada: true } : { vendedorId: null, tipo: "PCT", valor: "" })} /> {t}</label>)}
        {on && <>
          <select value={c.vendedorId || ""} disabled={!podeLancar} onChange={(e) => (e.target.value === "__novo" ? setNovo(true) : up({ vendedorId: e.target.value ? Number(e.target.value) : null }))} className="px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, background: C.panel, minWidth: 220, borderColor: c.vendedorId ? C.line : C.accent }}>
            <option value="">{vs ? "Selecione o vendedor…" : "Carregando…"}</option>
            {(vs || []).map((x) => <option key={x.id} value={x.id}>{x.nome}{x.fechamento === "MENSAL" ? " · mensal" : " · spot"}</option>)}
            <option value="__novo">+ Cadastrar vendedor</option>
          </select>
          <div className="inline-flex rounded-md p-0.5" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
            {[["PCT", "%"], ["VALOR", "R$"]].map(([k, t]) => <button key={k} type="button" disabled={!podeLancar} onClick={() => up({ tipo: k })} className="px-3 py-1 text-xs font-semibold rounded" style={{ background: c.tipo === k ? "#fff" : "transparent", color: c.tipo === k ? C.text : C.sub, boxShadow: c.tipo === k ? "0 1px 2px rgba(0,0,0,.12)" : "none" }}>{t}</button>)}
          </div>
          <input value={c.valor ?? ""} disabled={!podeLancar} onChange={(e) => up({ valor: e.target.value.replace(/[^\d,.]/g, "") })} placeholder={c.tipo === "PCT" ? "0 %" : "0,00"} inputMode="decimal" className="w-24 px-2 py-1.5 rounded outline-none text-sm text-right" style={{ ...inp, background: C.panel }} />
          {total > 0 && <span className="text-sm">Comissão <b style={{ color: C.accent }}>{money(total)}</b>{c.tipo === "PCT" && <span className="text-xs ml-1" style={{ color: C.sub }}>(sobre os itens, sem frete)</span>}</span>}
        </>}
      </div>
      {on && v && <div className="text-xs mt-2" style={{ color: C.sub }}>{v.fechamento === "MENSAL"
        ? "Fechamento mensal: a comissão de cada conta a receber que vence no mês entra numa só conta a pagar no dia 10 do mês seguinte."
        : "Fechamento spot: em cada vencimento de conta a receber do pedido entra a comissão proporcional àquela conta (parcelado/faturado: em cada fatura)."}</div>}
      {novo && <NovoVendedor uid={uid} onClose={() => setNovo(false)} onSalvo={(x) => { carregar(); up({ vendedorId: x.id }); }} />}
    </Card>
  );
}
// v773 — #65: valor em R$ ou em % do total
function ReaisPct({ x, total, auto, onChange, placeholder }) {
  const pct = !!x?.pct;
  const eq = num(x?.valor) > 0 ? (pct ? money(total * num(x.valor) / 100) : total > 0 ? `${Math.round(num(x.valor) / total * 1000) / 10}%` : "") : "";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex rounded-md p-0.5" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        {[[false, "R$"], [true, "%"]].map(([k, t]) => <button key={t} type="button" onClick={() => onChange({ pct: k, valor: "" })} className="px-2 py-0.5 text-[11px] font-semibold rounded"
          style={{ background: pct === k ? "#fff" : "transparent", color: pct === k ? C.text : C.sub }}>{t}</button>)}
      </span>
      <input value={x?.valor ?? ""} onChange={(e) => onChange({ valor: e.target.value.replace(/[^\d,.]/g, "") })} inputMode="decimal"
        placeholder={auto ? `auto ${money(auto.valor)}` : placeholder || (pct ? "%" : "valor")} className="w-28 px-2 py-1 rounded outline-none text-sm" style={inp} />
      {eq && <span className="text-xs" style={{ color: C.sub }}>{eq}</span>}
    </span>
  );
}

// v773 — #66: restrição de pagamento do cliente — só em certos dias do mês, dias da semana ou "1ª quinta do mês"
function Restricao({ r, onChange }) {
  const [aberto, setAberto] = useState(false);
  const on = !!r?.tipo;
  const t = r || { tipo: "DIA_MES", dias: [], dows: [], n: 1, dow: 4 };
  const up = (patch) => onChange({ ...t, ...patch });
  return (
    <span className="relative inline-flex items-center">
      <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer px-1.5 py-0.5 rounded" style={{ background: on ? C.accentSoft : "transparent", color: on ? C.accent : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}
        title={on ? textoRestricao(r) : "Cliente só paga em certos dias"}>
        <input type="checkbox" checked={on} onChange={(e) => { if (e.target.checked) { onChange(t); setAberto(true); } else { onChange(null); setAberto(false); } }} />
        restrição{on ? `: ${textoRestricao(r)}` : " de pagamento"}
      </label>
      {on && <button type="button" onClick={() => setAberto((x) => !x)} className="ml-1 text-[11px] underline" style={{ color: C.sub }}>{aberto ? "ok" : "editar"}</button>}
      {on && aberto && (
        <div className="absolute z-30 top-full left-0 mt-1 p-3 rounded-lg shadow-lg text-xs" style={{ background: C.panel, border: `1px solid ${C.line}`, width: 300 }}>
          <div className="flex gap-1 mb-2">
            {[["DIA_MES", "Dia do mês"], ["DIA_SEMANA", "Dia da semana"], ["NESIMO", "Sequencial"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => up({ tipo: k })} className="flex-1 px-2 py-1 rounded font-semibold" style={{ background: t.tipo === k ? C.accent : C.panel2, color: t.tipo === k ? "#fff" : C.sub }}>{l}</button>))}
          </div>
          {t.tipo === "DIA_MES" && <>
            <div className="mb-1" style={{ color: C.sub }}>Dias do mês em que o cliente paga:</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => { const sel = (t.dias || []).includes(d); return (
                <button key={d} type="button" onClick={() => up({ dias: sel ? t.dias.filter((x) => x !== d) : [...(t.dias || []), d].sort((a, b) => a - b) })}
                  className="py-1 rounded" style={{ background: sel ? C.accent : C.panel2, color: sel ? "#fff" : C.text }}>{d}</button>); })}
            </div>
          </>}
          {t.tipo === "DIA_SEMANA" && <>
            <div className="mb-1" style={{ color: C.sub }}>Dias da semana em que o cliente paga:</div>
            <div className="flex gap-1">{DOWS.map((n, d) => { const sel = (t.dows || []).includes(d); return (
              <button key={d} type="button" onClick={() => up({ dows: sel ? t.dows.filter((x) => x !== d) : [...(t.dows || []), d].sort() })}
                className="flex-1 py-1 rounded" style={{ background: sel ? C.accent : C.panel2, color: sel ? "#fff" : C.text }}>{n}</button>); })}</div>
          </>}
          {t.tipo === "NESIMO" && <div className="flex items-center gap-1">
            <select value={t.n} onChange={(e) => up({ n: Number(e.target.value) })} className="px-1 py-1 rounded" style={inp}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 5 ? "última" : `${n}ª`}</option>)}</select>
            <select value={t.dow} onChange={(e) => up({ dow: Number(e.target.value) })} className="px-1 py-1 rounded" style={inp}>{DOWS_LONGO.map((n, d) => <option key={d} value={d}>{n}</option>)}</select>
            <span style={{ color: C.sub }}>do mês</span>
          </div>}
          <div className="mt-2" style={{ color: C.sub }}>O vencimento vai para a primeira data que atende. A data pode ser alterada à mão.</div>
        </div>
      )}
    </span>
  );
}

// v773 — #63: vendedor do pedido escolhido entre os cadastrados (Dados › Vendedores); sem acesso ao cadastro, campo livre
function CampoVendedor({ uid, value, onChange }) {
  const [vs, setVs] = useState(null);
  useEffect(() => { fetch(`/api/vendedores?u=${uid}`).then((r) => (r.ok ? r.json() : null)).then((j) => setVs(j?.vendedores || [])).catch(() => setVs([])); }, []);
  const atual = String(value || "").toUpperCase();
  if (vs && !vs.length) return <In label="Vendedor" value={value} onChange={(e) => onChange(e.target.value)} />;
  return (
    <Campo label="Vendedor">
      <select value={atual} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, background: C.panel, borderColor: atual ? C.line : C.accent }}>
        <option value="">{vs ? "Selecione…" : "Carregando…"}</option>
        {atual && vs && !vs.some((x) => x.nome === atual) && <option value={atual}>{atual}</option>}
        {(vs || []).map((x) => <option key={x.id} value={x.nome}>{x.nome}</option>)}
      </select>
    </Campo>
  );
}

function NovoVendedor({ uid, onClose, onSalvo }) {
  const [M, setM] = useState(null);
  useEffect(() => { import("./vendedores").then((m) => setM(() => m.VendedorModal)); }, []);
  return M ? <M user={{ id: uid }} pixTipos={["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"]} onClose={onClose} onSalvo={onSalvo} /> : null;
}
// v746 — frete contratado de uma entrega (valor soma no total do pedido; não é distribuído entre os itens)
function FreteCampo({ v, onChange, veVal = true }) {
  const x = v || { contratado: false, valor: "" };
  return (
    <div className="flex flex-wrap items-center gap-3 my-2 text-sm">
      <span className="text-xs font-semibold" style={{ color: C.sub }}>Frete contratado?</span>
      {[[false, "Não"], [true, "Sim"]].map(([k, t]) => <label key={t} className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={!!x.contratado === k} onChange={() => onChange({ ...x, contratado: k, valor: k ? x.valor : "" })} /> {t}</label>)}
      {x.contratado && veVal && <label className="flex items-center gap-1"><span className="text-xs" style={{ color: C.sub }}>Valor do frete R$</span>
        <input value={x.valor ?? ""} onChange={(e) => onChange({ ...x, valor: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="0,00" inputMode="decimal" className="w-28 px-2 py-1 rounded outline-none text-sm text-right" style={{ ...inp, background: C.panel, borderColor: num(x.valor) > 0 ? C.line : C.accent }} /></label>}
      {x.contratado && veVal && <span className="text-xs" style={{ color: C.sub }}>soma no total do pedido (não entra no valor dos itens)</span>}
    </div>
  );
}
export function GradeEditor({ grade, tamanhos, onChange, personalizada = null, onPersonalizada = null }) {   // v744 — personalizada: opção do menu de grade especial
  const G = gradesDe(tamanhos);
  const ativas = ["MASC", ...["INF", "BL"].filter((k) => grade.some((g) => secaoTam(g.tam) === k))];
  const [menu, setMenu] = useState(false);
  const up = (tam, qtd) => onChange(grade.map((g) => (g.tam === tam ? { ...g, qtd } : g)));
  const passo = (g, d) => up(g.tam, String(Math.max(0, num(g.qtd) + d)));
  const inserir = (k) => { const tem = new Set(grade.map((g) => g.tam)); onChange([...grade, ...G[k].tams.filter((t) => !tem.has(t)).map((t) => ({ tam: t, qtd: "" }))]); setMenu(false); };
  const remover = async (k) => {
    const q = grade.filter((g) => secaoTam(g.tam) === k).reduce((s, g) => s + num(g.qtd), 0);
    if (q && !(await confirmar(`Remover a grade ${G[k].rot.toLowerCase()} com ${q} peça(s)?`))) return;
    onChange(grade.filter((g) => secaoTam(g.tam) !== k));
  };
  const faltam = ["INF", "BL"].filter((k) => !ativas.includes(k));
  return (
    <div className="mb-3">
      {ativas.map((k) => {
        const linhas = grade.filter((g) => secaoTam(g.tam) === k);
        return (
          <div key={k} className="mb-2">
            <div className="flex items-center text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: C.sub }}>{G[k].rot}
              <span className="ml-2 font-normal normal-case">{linhas.reduce((s, g) => s + num(g.qtd), 0)} pç</span>
              {k !== "MASC" && <button type="button" onClick={() => remover(k)} className="ml-auto normal-case font-normal flex items-center gap-1" style={{ color: C.red }}><X size={12} /> remover</button>}
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(linhas.length, 7)}, minmax(0, 1fr))` }}>
              {linhas.map((g) => (
                <div key={g.tam} className="rounded-md px-0.5 pt-0.5 pb-0.5 text-center" style={{ background: C.panel2, border: `1px solid ${num(g.qtd) ? "#001E41" : C.line}` }}>
                  <div className="text-[11px] font-semibold" style={{ color: C.sub }}>{k === "BL" ? g.tam.slice(3) : g.tam}</div>
                  {/* v672 — sem a barrinha piscando (digitar substitui o número) e botões – / + maiores */}
                  <input value={g.qtd} onChange={(e) => up(g.tam, e.target.value.replace(/[^\d]/g, ""))} onFocus={(e) => e.target.select()} inputMode="numeric" placeholder="0"
                    className="w-full bg-transparent outline-none text-center text-base font-bold leading-6" style={{ color: num(g.qtd) ? C.text : "#98A2B3", caretColor: "transparent" }} />
                  <div className="flex justify-between gap-0.5">
                    <button type="button" onClick={() => passo(g, -1)} className="flex-1 flex items-center justify-center rounded text-sm font-bold leading-none select-none" style={{ height: 22, color: "#001E41", background: "#fff", border: "1px solid #001E4155" }}>–</button>
                    <button type="button" onClick={() => passo(g, 1)} className="flex-1 flex items-center justify-center rounded text-sm font-bold leading-none select-none" style={{ height: 22, color: "#fff", background: "#001E41" }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {(faltam.length > 0 || (onPersonalizada && !personalizada)) && <div className="relative inline-block">
        <button type="button" onClick={() => setMenu(!menu)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.accent, border: `1px dashed ${C.accent}` }}><Plus size={12} /> Inserir grade especial</button>
        {menu && <div className="absolute z-20 mt-1 rounded-md shadow-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          {faltam.map((k) => <button key={k} type="button" onClick={() => inserir(k)} className="block w-full text-left px-3 py-1.5 text-sm whitespace-nowrap hover:bg-gray-50" style={{ color: C.text }}>{G[k].rot}</button>)}
          {onPersonalizada && !personalizada && <button type="button" onClick={() => { setMenu(false); onPersonalizada(); }} className="block w-full text-left px-3 py-1.5 text-sm whitespace-nowrap hover:bg-gray-50" style={{ color: "#3D6799", borderTop: faltam.length ? `1px solid ${C.line}` : "none" }}>Personalizada <span className="text-xs" style={{ color: C.sub }}>(lista por peça: nome, número…)</span></button>}
        </div>}
      </div>}
    </div>
  );
}

const CATS = { OC: "OC do cliente", SOLICITACAO: "Solicitação", LAYOUT: "Layout / arte", OUTRO: "Outro" };
const catDoNome = (nome, tipo) => {
  const n = norm(nome);
  if (/solic|lancamento/.test(n)) return "SOLICITACAO";
  if (/\boc\b|ordem|compra|\bpc\b|pedido/.test(n.replace(/[_\-.]/g, " "))) return "OC";
  if (/layout|arte|mock|logo/.test(n) || /^image\//.test(tipo || "")) return "LAYOUT";
  return "OUTRO";
};
const tipoPeca = (d, tipos) => {
  const n = norm(d).toUpperCase();
  const t = /CAMISETA|T-SHIRT|REGATA|BABY ?LOOK/.test(n) ? "CAMISETA" : /\bPOLO\b/.test(n) ? "POLO" : /CAMISA/.test(n) ? "CAMISA"
    : /JAQUETA|MOLETOM|BLUSAO|CASACO|AGASALHO|COLETE|PARKA/.test(n) ? "JAQUETA" : /CALCA|BERMUDA|SHORT|MACACAO/.test(n) ? "CALÇA"
    : /JALECO/.test(n) ? "JALECO" : /AVENTAL/.test(n) ? "AVENTAL" : null;
  return t && tipos.includes(t) ? t : null;
};

function Campo({ label, children, cls = "" }) {
  return <div className={cls}><div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>{children}</div>;
}
function In({ label, cls, upper = true, ...p }) {
  return <Campo label={label} cls={cls}><input {...p} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, textTransform: upper ? "uppercase" : "none" }} /></Campo>;
}
function Card({ titulo, extra, children, destaque }) {
  if (destaque) return (   // v811 — título em faixa azul-marinho (itens do pedido)
    <div className="rounded-lg mb-4 overflow-hidden" style={{ background: C.panel, border: "1px solid #001E4133" }}>
      <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#001E41", color: "#fff" }}><div className="font-bold text-sm flex-1 min-w-0 truncate">{titulo}</div>{extra}</div>
      <div className="p-4">{children}</div>
    </div>
  );
  return (
    <div className="rounded-lg p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      {(titulo || extra) && <div className="flex items-center justify-between mb-3"><div className="font-semibold text-sm">{titulo}</div>{extra}</div>}
      {children}
    </div>
  );
}
function Auto({ value, onChange, onPick, buscar, render, placeholder, minimo = 2, exato }) {
  const [aberto, setAberto] = useState(false);
  const [ops, setOps] = useState([]);
  const timer = useRef(null);
  const tipo = (v) => {
    onChange(v);
    clearTimeout(timer.current);
    if (!v || v.length < minimo) { setOps([]); setAberto(false); return; }
    timer.current = setTimeout(async () => {
      const r = await buscar(v);
      // v668 — código digitado igual ao de um item do KM: puxa os dados sozinho
      const ex = exato ? (r || []).find((o) => String(o[exato] || "").trim().toUpperCase() === String(v).trim().toUpperCase()) : null;
      if (ex) { onPick(ex); setOps([]); setAberto(false); return; }
      setOps((r || []).slice(0, 10)); setAberto((r || []).length > 0);
    }, 250);
  };
  return (
    <div style={{ position: "relative" }}>
      <input value={value || ""} placeholder={placeholder} onChange={(e) => tipo(e.target.value)} onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, textTransform: "uppercase" }} />
      {aberto && (
        <div style={{ position: "absolute", zIndex: 40, top: "100%", left: 0, right: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 280, overflowY: "auto" }}>
          {ops.map((o, i) => (
            <button key={i} onMouseDown={(e) => { e.preventDefault(); onPick(o); setAberto(false); }} className="w-full text-left px-3 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
              {render(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function Modal({ titulo, onFechar, children, largura = 640 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }} onMouseDown={onFechar}>
      <div className="rounded-lg p-4 w-full" style={{ background: C.panel, maxWidth: largura, maxHeight: "90vh", overflowY: "auto" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">{titulo}</div><button onClick={onFechar} style={{ color: C.sub }}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

const vazioF = () => ({
  numero: "", emissao: hojeISO(), interno: false, servico: false, clienteNome: "", clienteCnpj: "", clienteIe: "", clienteEndereco: "", clienteContato: "",
  oc: "", vendedor: "", obs: "", nfObs: "", prazoDias: "", prazoTipo: "UTEIS", entregaModo: "UNICA", entregas: [],
  frete: { contratado: false, valor: "" },   // v746 — frete da entrega única
  comissao: { vendedorId: null, tipo: "PCT", valor: "" },   // v747 — venda comissionada
  desconto: { tipo: "PCT", valor: "" },   // v750 — desconto no total do pedido
  pagamento: { entrada: null, parcelas: [] }, status: "EM_LANCAMENTO", efetivadoEm: null,
  arquivoPcPdf: "", arquivoLancPdf: "", arquivoPedidoPdf: "", arquivoOpPdf: "",
});

// v801 — #71: campo de estampa (texto longo, uma linha por aplicação)
const nkParam = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b(DA|DO|DE|DAS|DOS|E)\b/g, " ").replace(/\s+/g, " ").trim();
const ehEstampa = (c) => /ESTAMP/.test(nkParam(c));
// v801 — #72: parâmetros do KM → campos do tipo de peça. Casa pelo nome normalizado (sem acento, sem "da/de/do", plural);
//   o que não casa entra em maiúsculas; nomes repetidos no KM juntam o texto em vez de virar dois campos
const singular = (w) => w.length > 3 ? w.replace(/S$/, "") : w;
const chaveParam = (t) => nkParam(t).split(" ").map(singular).join(" ");
export function paramsDoKm(lista, comps = []) {
  const porChave = new Map(comps.filter((c) => c !== "TECIDO").map((c) => [chaveParam(c), c]));
  const acha = (t) => {
    const k = chaveParam(t);
    if (porChave.has(k)) return porChave.get(k);
    const pk = k.split(" ");
    for (const [kc, c] of porChave) { const pc = kc.split(" "); if (pc[0] === pk[0] && (pc.every((w) => pk.includes(w)) || pk.every((w) => pc.includes(w)))) return c; }
    return String(t).trim().toUpperCase();
  };
  const out = {};
  for (const x of Array.isArray(lista) ? lista : []) {
    if (!x?.t || !String(x.v || "").trim() || paramFora(x.t)) continue;
    const nome = acha(x.t), v = String(x.v).trim();
    if (!out[nome]) out[nome] = v;
    else if (!out[nome].toUpperCase().includes(v.toUpperCase())) out[nome] = `${out[nome]}\n${v}`;
  }
  return out;
}
// descrição do KM sem espaços/sinais repetidos e sem os parâmetros colados no nome
export const limparDescKm = (d) => String(d || "").split(/\*{3,}/)[0].replace(/([-·,/])(\s*\1)+/g, "$1").replace(/\s+/g, " ").replace(/^[\s\-·,/]+|[\s\-·,/]+$/g, "").trim().toUpperCase();

export default function PedidoEditor({ ppId: ppId0, onVoltar, podeLancar = true, veVal = true, uid, componentes, tamanhos, imprimir }) {
  const TIPOS = Object.keys(componentes);
  const novoItem = () => ({ tipoPecaNome: "",   // v631 — sem pré-preenchimento: o vendedor escolhe
    codigo: "", descricao: "", valorUnitario: "", grade: tamanhos.map((t) => ({ tam: t, qtd: "" })), parametros: {}, fotoBase64: "", fppId: null, fppNumero: null, fpp: null, aplicacoes: [] });
  // v614 — pedido de serviço: item = tipo de serviço (texto livre) · quantidade · valor unitário (total calculado)
  const novoServico = () => ({ tipoPecaNome: "SERVIÇO", anexos: [], codigo: "", descricao: "", valorUnitario: "", quantidade: "", grade: [], parametros: {}, fotoBase64: "", fppId: null, fppNumero: null, fpp: null });
  const api = (url, o = {}) => fetch(url, { cache: "no-store", ...o, headers: { ...(o.headers || {}), "Content-Type": "application/json", "x-usuario-id": String(uid || "") } });
  const [ppId, setPpId] = useState(ppId0 || null);
  const [f, setF] = useState(vazioF());
  const [itens, setItens] = useState([novoItem()]);
  const [anexos, setAnexos] = useState([]);
  const [carregado, setCarregado] = useState(!ppId0);
  const [recDet, setRecDet] = useState(false);
  const [clienteFinal, setClienteFinal] = useState(null);   // v707 — fase "recebendo detalhes" (link de preenchimento aberto)
  const [salvando, setSalvando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [proximo, setProximo] = useState("");
  const [fppModal, setFppModal] = useState(null);   // índice do item
  const [resultado, setResultado] = useState(null);
  const [fat, setFat] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setPag = (fn) => setF((s) => ({ ...s, pagamento: fn(s.pagamento || { entrada: null, parcelas: [] }) }));

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then((d) => setClientes(Array.isArray(d) ? d : [])).catch(() => {});
    api("/api/pp?proximo=1").then((r) => r.json()).then((d) => setProximo(d.numero || "")).catch(() => {});
  }, []);
  useEffect(() => {
    if (!ppId0) return;
    api(`/api/pp/${ppId0}`).then((r) => r.json()).then(async (d) => {
      const base = vazioF();
      setF({
        ...base, ...Object.fromEntries(Object.keys(base).filter((k) => d[k] != null).map((k) => [k, d[k]])),
        emissao: d.emissao || (d.createdAt ? String(d.createdAt).slice(0, 10) : hojeISO()),
        prazoDias: d.prazoDias != null ? String(d.prazoDias) : "", prazoTipo: d.prazoTipo || "UTEIS", entregaModo: d.entregaModo || "UNICA",
        entregas: Array.isArray(d.entregas) ? d.entregas : [], pagamento: d.pagamento || { entrada: null, parcelas: [] },
        frete: d.frete && typeof d.frete === "object" ? { contratado: !!d.frete.contratado, valor: d.frete.contratado ? String(d.frete.valor ?? "").replace(".", ",") : "" } : { contratado: false, valor: "" },
        clienteCnpj: fmtCnpj(d.clienteCnpj), servico: d.tipoPedido === "SERVIÇO",
      });
      setRecDet(!!d.recebendoDetalhes);
      setClienteFinal(d.clienteFinal || null);
      const its = (d.itens || []).map((it) => {
        let par = {}; try { par = it.parametrosJson ? JSON.parse(it.parametrosJson) : {}; } catch {}
        let grade = []; try { grade = it.gradeJson ? JSON.parse(it.gradeJson) : []; } catch {}
        const tams = new Set(grade.map((g) => g.tam));
        if (d.tipoPedido === "SERVIÇO") return { ...novoServico(), descricao: it.descricao || "", valorUnitario: it.valorUnitario != null ? String(it.valorUnitario).replace(".", ",") : "",
          quantidade: String(grade.reduce((q, g) => q + (Number(g.qtd) || 0), 0) || "").replace(".", ","), anexos: Array.isArray(it.anexosJson) ? it.anexosJson : [] };   // v792
        return { tipoPecaNome: TIPOS.includes(it.tipoPecaNome) ? it.tipoPecaNome : (tipoPeca(it.descricao, TIPOS) || ""), codigo: it.codigo || "", descricao: it.descricao || "",
          valorUnitario: it.valorUnitario != null ? String(it.valorUnitario).replace(".", ",") : "",
          grade: [...grade.filter((g) => num(g.qtd) > 0 || secaoTam(g.tam) !== "MASC" || tamanhos.includes(g.tam)), ...tamanhos.filter((t) => !tams.has(t)).map((t) => ({ tam: t, qtd: "" }))],
          parametros: Object.fromEntries(Object.entries(par).filter(([k]) => !paramFora(k))), fotoBase64: it.fotoBase64 || "", fppId: it.fppId || null, fppNumero: it.fppNumero ?? null, fpp: null,
          anexos: Array.isArray(it.anexosJson) ? it.anexosJson : [],   // v650
          aplicacoes: Array.isArray(it.aplicacoes) ? it.aplicacoes : [],   // v806
          dispensaDesign: !!it.dispensaDesign,   // v796
          dadosUnitarios: it.dadosUnitarios && Array.isArray(it.dadosUnitarios.campos) ? it.dadosUnitarios : null,   // v699
          itemPadraoId: it.itemPadraoId || null, valorVenda: it.valorVenda != null ? String(it.valorVenda) : "",   // v711 — portal: mantém ao salvar aqui
          desconto: it.desconto && it.desconto.base ? { tipo: it.desconto.tipo, valor: String(it.desconto.valor).replace(".", ","), base: String(it.desconto.base).replace(".", ",") } : null };   // v750
      });
      setItens(its.length ? its : [novoItem()]);
      setAnexos((d.anexos || []).map((a) => ({ ...a })));
      setCarregado(true);
      // resumo das FPPs indexadas
      for (const [i, it] of its.entries()) if (it.fppId) {
        const rf = await api(`/api/pp/catalogo?fppId=${it.fppId}`).then((r) => r.json()).catch(() => null);
        if (rf) setItens((arr) => arr.map((x, j) => (j === i ? { ...x, fpp: rf } : x)));
      }
    });
  }, [ppId0]);

  // ---------- cálculos ----------
  const somaItem = (it) => (f.servico ? num(it.quantidade) : qtdGrade(it.grade));
  const totalItem = (it) => somaItem(it) * num(it.valorUnitario);
  const totalItens = itens.reduce((s, it) => s + totalItem(it), 0);
  const descV = valorDesconto(f.desconto, totalItens);   // v750 — desconto no total do pedido
  const freteV = f.servico ? 0 : freteTotal(f);   // v746 — frete contratado: soma no total do pedido, não entra nos itens
  const totalGeral = totalItens - descV + freteV;
  const totalPecas = itens.reduce((s, it) => s + somaItem(it), 0);
  const despacho = f.prazoDias !== "" ? somaDias(f.emissao, num(f.prazoDias), f.prazoTipo) : null;
  const calc = parcelasCalc(f.pagamento, totalGeral, { emissao: f.emissao });
  const confEnt = conferirEntregas(itens, f.entregas, f.entregaModo);
  const numeroExib = f.numero || proximo;
  const obsNf = textoObsNf({ numero: f.numero || (proximo ? `${proximo} (prévia)` : ""), oc: f.oc, nfObs: f.nfObs });
  const efetivado = !!f.efetivadoEm;
  const faturado = f.status === "FATURADO";

  // ---------- cliente ----------
  const buscarCliente = async (q) => {
    const n = norm(q), d = dig(q);
    return clientes.filter((c) => (d.length >= 3 && dig(c.cnpj).includes(d)) || norm([c.razaoSocial, c.nomeFantasia].filter(Boolean).join(" ")).includes(n));
  };
  const pickCliente = (c) => setF((s) => ({
    ...s, clienteNome: c.razaoSocial || c.nomeFantasia || "", clienteCnpj: fmtCnpj(c.cnpj), clienteIe: c.inscricaoEstadual || "",
    clienteEndereco: [c.logradouro, c.numero, c.complemento, c.bairro, c.municipio && `${c.municipio}${c.uf ? "/" + c.uf : ""}`, c.cep].filter(Boolean).join(", "),
    clienteContato: [c.preposto, c.telefones].filter(Boolean).join(" · "),
  }));
  const aoCnpj = (v) => {
    set("clienteCnpj", v);
    const d = dig(v);
    if (d.length === 14 || d.length === 11) { const c = clientes.find((x) => dig(x.cnpj) === d); if (c) pickCliente(c); }
  };
  const cnpjSemCadastro = (() => { const d = dig(f.clienteCnpj); return (d.length === 14 || d.length === 11) && clientes.length > 0 && !clientes.some((x) => dig(x.cnpj) === d); })();

  // v614 — troca o tipo do pedido; produto ↔ serviço converte os itens (descrição, quantidade e valor ficam)
  const trocarTipo = (v) => {
    const serv = v === "SERVICO";
    setF((s) => ({ ...s, servico: serv, interno: v === "INTERNO", ...(serv ? { entregaModo: "UNICA", entregas: [] } : {}) }));
    if (serv !== f.servico) setItens((arr) => arr.map((it) => serv
      ? { ...novoServico(), descricao: it.descricao, valorUnitario: it.valorUnitario, quantidade: qtdGrade(it.grade) ? String(qtdGrade(it.grade)) : "" }
      : { ...novoItem(), descricao: it.descricao, valorUnitario: it.valorUnitario }));
  };
  // ---------- itens ----------
  const upItem = (i, patch) => setItens((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const upGrade = (i, gi, qtd) => setItens((arr) => arr.map((it, j) => (j === i ? { ...it, grade: it.grade.map((g, k) => (k === gi ? { ...g, qtd } : g)) } : it)));
  const upParam = (i, nome, val) => setItens((arr) => arr.map((it, j) => (j === i ? { ...it, parametros: { ...it.parametros, [nome]: val } } : it)));
  const buscarItemKm = async (q) => api(`/api/pp/catalogo?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => []);
  const pickItemKm = (i, p) => setItens((arr) => arr.map((it, j) => {
    if (j !== i) return it;
    const tipo = tipoPeca(p.descricao, TIPOS) || it.tipoPecaNome;
    // v801 — #72: nomes do KM casados com os campos do tipo de peça (sem duplicar)
    // v822 — #72: o que já estava preenchido (ficha/PP) e o KM não traz continua; o KM só completa/atualiza
    const doKm = paramsDoKm(p.parametros, componentes[tipo] || []);
    const params = { ...Object.fromEntries(Object.entries(it.parametros || {}).filter(([k, v]) => k !== "TECIDO" && v != null && String(v).trim() !== "")), ...doKm };
    if (it.parametros?.TECIDO && typeof it.parametros.TECIDO === "object") params.TECIDO = it.parametros.TECIDO;   // tecido da FPP fica
    return { ...it, codigo: p.codigo, descricao: limparDescKm(p.descricao), tipoPecaNome: tipo, parametros: params,
      valorUnitario: it.valorUnitario || (p.preco ? String(Number(p.preco).toFixed(2)).replace(".", ",") : "") };
  }));
  // v702 — item com FPP: o lead time dela sugere o prazo de entrega do pedido (quando ainda está vazio)
  const sugerirPrazo = (rf) => { if (rf?.leadTime > 0) setF((s) => (String(s.prazoDias ?? "").trim() ? s : { ...s, prazoDias: String(rf.leadTime), prazoTipo: "CORRIDOS" })); };
  const indexarFpp = (i, rf) => {
    sugerirPrazo(rf);
    setItens((arr) => arr.map((it, j) => (j !== i ? it : {
      ...it, fppId: rf.id, fppNumero: rf.numero, fpp: rf, parametros: { ...it.parametros, TECIDO: tecidoDaFpp(rf) },
      tipoPecaNome: it.descricao ? it.tipoPecaNome : (tipoPeca(rf.item, TIPOS) || it.tipoPecaNome),
      descricao: it.descricao || String(rf.nomeComercial || rf.item || "").toUpperCase(),
      valorUnitario: it.valorUnitario || (veVal && rf.valorProposto ? String(Number(rf.valorProposto).toFixed(2)).replace(".", ",") : ""),
    })));
    setFppModal(null);
    puxarEstampas(i, rf.id);   // v806
  };
  // v806 — estampas da FPP (medidas e arquivos) entram no item; o que já está no item fica
  const baixarArqFpp = (fppId, id) => fetch(`/api/fpp/${fppId}/anexos?arquivo=${id}`).then((r) => { if (!r.ok) throw new Error(); return r.blob(); });
  const itensRef = useRef(itens); itensRef.current = itens;
  const puxarEstampas = async (i, fppId) => {
    const rf = await api(`/api/pp/catalogo?fppId=${fppId}`).then((r) => r.json()).catch(() => null);
    if (!rf?.aplicacoes?.length) return;
    await new Promise((r) => setTimeout(r, 0));
    const alvo = itensRef.current[i];
    if (!alvo) return;
    const patch = await juntarAplicacoesFpp(alvo, rf, baixarArqFpp);
    if (!patch.aplicacoes) return;
    const novos = patch.anexos.slice((alvo.anexos || []).length);
    setItens((arr) => arr.map((it, j) => (j === i ? { ...it, aplicacoes: patch.aplicacoes, anexos: [...(it.anexos || []), ...novos] } : it)));
  };
  // v647 — itens padrão do cliente: campo em destaque com autocompletar; o item escolhido entra preenchido (nome NF, preço, parâmetros, foto, FPP)
  const [padroes, setPadroes] = useState([]);
  const [buscaPadrao, setBuscaPadrao] = useState("");
  const clienteIdSel = (() => { const d = dig(f.clienteCnpj); return d ? clientes.find((c) => dig(c.cnpj) === d)?.id || null : null; })();
  useEffect(() => {
    if (!clienteIdSel) { setPadroes([]); return; }
    fetch(`/api/itens-padrao?cliente=${clienteIdSel}`).then((r) => r.json()).then((d) => setPadroes(Array.isArray(d) ? d : [])).catch(() => setPadroes([]));
  }, [clienteIdSel]);
  const usarPadrao = async (p, alvo = null) => {
    const d = await fetch(`/api/itens-padrao/${p.id}`).then((r) => r.json()).catch(() => null);
    if (!d || d.error) return alerta("Não consegui ler o item padrão.");
    const rf = d.fppId ? await api(`/api/pp/catalogo?fppId=${d.fppId}`).then((r) => r.json()).catch(() => null) : null;
    const params = Object.fromEntries(Object.entries(d.parametros || {}).filter(([k, v]) => v && !paramFora(k) && k !== "TECIDO"));
    if (rf) params.TECIDO = tecidoDaFpp(rf);
    const tipo = TIPOS.includes(d.tipoPecaNome) ? d.tipoPecaNome : tipoPeca(d.nomeNf, TIPOS) || "";
    sugerirPrazo(rf);
    // v650 — layout e tabela de medidas do item padrão viram arquivos do item (saem na OP)
    const anexosPadrao = [];
    for (const a of d.anexos || []) {
      try { const b = await fetch(`/api/itens-padrao/${d.id}?anexo=${a.id}`).then((r) => r.blob()); anexosPadrao.push({ nome: `${a.tipo === "MEDIDAS" ? "Tabela de medidas" : "Layout"} · ${a.nome}`, mime: a.mime || b.type || null, base64: await readB64(b) }); } catch {}
    }
    const item = { ...novoItem(), anexos: anexosPadrao, tipoPecaNome: tipo, codigo: d.codigo || "", descricao: d.nomeNf || "", parametros: params, fotoBase64: d.fotoBase64 || "",
      valorUnitario: veVal && d.precoAtual != null ? String(Number(d.precoAtual).toFixed(2)).replace(".", ",") : "", fppId: rf ? rf.id : null, fppNumero: rf ? rf.numero : null, fpp: rf || null, itemPadraoId: d.id };
    // ocupa o primeiro item vazio; senão acrescenta
    // v754 — escolhido no próprio item (código/descrição): entra nele, mantendo a grade já digitada
    if (alvo != null) { setItens((arr) => arr.map((it, j) => (j === alvo ? { ...item, grade: qtdGrade(it.grade) ? it.grade : item.grade, dadosUnitarios: it.dadosUnitarios || null } : it))); setBuscaPadrao(""); if (rf) puxarEstampas(alvo, rf.id); /* v806 */ if (d.critica) alerta(`Atenção: o preço praticado (${money(d.critica.preco)}) está diferente do valor de venda da FPP ${numFpp(d.fppNumero)} (${money(d.critica.fpp)}).`); return; }
    setItens((arr) => { const k = arr.findIndex((it) => !String(it.descricao || "").trim() && !String(it.codigo || "").trim() && !qtdGrade(it.grade)); return k >= 0 ? arr.map((it, j) => (j === k ? item : it)) : [...arr, item]; });
    if (rf) { const arr0 = itensRef.current, k0 = arr0.findIndex((it) => !String(it.descricao || "").trim() && !String(it.codigo || "").trim() && !qtdGrade(it.grade)); puxarEstampas(k0 >= 0 ? k0 : arr0.length, rf.id); }   // v806
    setBuscaPadrao("");
    if (d.critica) alerta(`Atenção: o preço praticado (${money(d.critica.preco)}) está diferente do valor de venda da FPP ${numFpp(d.fppNumero)} (${money(d.critica.fpp)}).`);
  };
  // v754 — busca em todo o cadastro de itens (código, código padrão, descrição, nome interno, cliente); os do cliente vêm primeiro
  const [globais, setGlobais] = useState([]);
  useEffect(() => {
    const t = buscaPadrao.trim(); if (t.length < 2) { setGlobais([]); return; }
    const h = setTimeout(() => fetch(`/api/itens-padrao?q=${encodeURIComponent(t)}`).then((r) => r.json()).then((d) => setGlobais(Array.isArray(d) ? d : [])).catch(() => setGlobais([])), 250);
    return () => clearTimeout(h);
  }, [buscaPadrao]);
  const opPadrao = (() => { const t = norm(buscaPadrao); if (!t) return padroes.slice(0, 12); const pal = t.split(/\s+/).filter(Boolean);
    const doCli = padroes.filter((p) => pal.every((w) => norm([p.nomeInterno, p.nomeNf, p.codigo, p.codigoPadrao].join(" ")).includes(w)));
    const ids = new Set(doCli.map((p) => p.id));
    return [...doCli, ...globais.filter((p) => !ids.has(p.id))].slice(0, 15); })();
  // v754 — campos Código/Descrição do item: cadastro de itens primeiro (puxa tudo), depois o cadastro do KM
  const buscarItem = async (q) => {
    const [ps, km] = await Promise.all([fetch(`/api/itens-padrao?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => []), buscarItemKm(q)]);
    return [...(Array.isArray(ps) ? ps : []).slice(0, 6).map((p) => ({ _padrao: p, codigo: p.codigo || p.codigoPadrao || "", descricao: p.nomeNf })), ...(Array.isArray(km) ? km : [])];
  };
  const pickItem = (i, o) => (o._padrao ? usarPadrao(o._padrao, i) : pickItemKm(i, o));
  const renderItem = (p, codigoPrimeiro) => p._padrao
    ? <span><span className="text-[10px] font-bold px-1 rounded mr-1" style={{ background: C.accentSoft, color: C.accent }}>CADASTRO</span>{codigoPrimeiro ? <><b>{p.codigo || "sem código"}</b> · {p._padrao.nomeNf}</> : <><b>{p._padrao.nomeNf}</b>{p.codigo ? ` · ${p.codigo}` : ""}</>}
        <span style={{ color: C.sub }}>{p._padrao.clientes?.length ? ` · ${p._padrao.clientes.map((c) => c.nome).slice(0, 2).join(", ")}` : ""}{veVal && p._padrao.precoAtual != null ? ` · ${money(p._padrao.precoAtual)}` : ""}</span></span>
    : codigoPrimeiro ? <span><b>{p.codigo}</b> <span style={{ color: C.sub }}>· {p.descricao}{p.parametros?.length ? ` · ${p.parametros.length} parâmetros` : ""} · KM</span></span>
      : <span><b>{p.descricao}</b> <span style={{ color: C.sub }}>· {p.codigo}{p.parametros?.length ? ` · ${p.parametros.length} parâmetros` : ""} · KM</span></span>;
  const tirarFpp = (i) => setItens((arr) => arr.map((it, j) => { if (j !== i) return it; const { TECIDO, ...p } = it.parametros || {}; return { ...it, fppId: null, fppNumero: null, fpp: null, parametros: p }; }));

  // ---------- entregas ----------
  const upEnt = (k, patch) => set("entregas", f.entregas.map((e, j) => (j === k ? { ...e, ...patch } : e)));
  const upEntGrade = (k, idx, tam, v) => set("entregas", f.entregas.map((e, j) => (j !== k ? e : { ...e, grade: { ...(e.grade || {}), [idx]: { ...((e.grade || {})[idx] || {}), [tam]: v } } })));
  const novaEntrega = () => set("entregas", [...f.entregas, { endereco: "", local: "", responsavel: "", contato: "", documento: f.entregaModo === "TERCEIROS" ? "" : "VENDA", grade: {} }]);
  const restanteNoLocal = (k) => set("entregas", f.entregas.map((e, j) => {
    if (j !== k) return e;
    const g = { ...(e.grade || {}) };
    itens.forEach((it, idx) => {
      const linha = { ...(g[idx] || {}) };
      for (const x of it.grade) {
        const outros = f.entregas.reduce((s, o, m) => s + (m === k ? 0 : num(o.grade?.[idx]?.[x.tam])), 0);
        const r = num(x.qtd) - outros;
        if (num(x.qtd) > 0) linha[x.tam] = r > 0 ? String(r) : "";
      }
      g[idx] = linha;
    });
    return { ...e, grade: g };
  }));

  // ---------- anexos ----------
  const adicionarArquivos = async (files) => {
    const l = [...(files || [])];
    const novos = [];
    for (const file of l) {
      if (file.size > 20 * 1024 * 1024) { alerta(`${file.name}: maior que 20 MB.`); continue; }
      novos.push({ nome: file.name, tipo: file.type || null, tamanho: file.size, categoria: catDoNome(file.name, file.type), base64: await readB64(file) });
    }
    if (novos.length) setAnexos((a) => [...a, ...novos]);
    // v696 — PDF da solicitação de lançamento (skill do vendedor): preenche o pedido sozinho
    for (const a of novos) if (/pdf/i.test(a.tipo || a.nome) && !f.servico) { if (await preencherDaSolicitacao(a.base64, a.nome, true)) { setAnexos((l) => l.map((x) => (x === a ? { ...x, categoria: "SOLICITACAO" } : x))); break; } }
  };
  // ---------- v696 — solicitação de lançamento → pedido preenchido ----------
  const [importando, setImportando] = useState(false);
  const [importado, setImportado] = useState(null);   // resumo do que entrou + avisos
  const pedidoTemDados = () => !!(String(f.clienteNome || "").trim() || itens.some((it) => String(it.descricao || "").trim() || qtdGrade(it.grade)));
  const preencherDaSolicitacao = async (base64, nome, auto = false) => {
    setImportando(true);
    let d;
    try { d = await api("/api/pp/lancamento", { method: "POST", body: JSON.stringify({ base64, nome }) }).then((r) => r.json()); }
    catch (e) { setImportando(false); if (!auto) alerta("Não consegui ler o PDF: " + e.message); return false; }
    setImportando(false);
    if (d.error) { if (!auto) alerta(d.error); return false; }
    if (!d.solicitacao) { if (!auto) alerta(d.erro || "Este PDF não é uma solicitação de lançamento."); return false; }
    if (efetivado) { alerta("Pedido já efetivado: a solicitação ficou só como anexo (não substitui os dados)."); return true; }
    if (pedidoTemDados() && !(await confirmar("Preencher o pedido com os dados da solicitação de lançamento? Cliente, itens, grade, prazo e pagamento serão substituídos."))) return true;
    const doc = d.doc, cli = d.cliente;
    if (d.clienteCriado && cli) setClientes((l) => [...l, cli]);
    else if (cli) setClientes((l) => l.map((c) => (c.id === cli.id ? { ...c, ...cli } : c)));
    // itens
    const unico = doc.fpps.length === 1 ? doc.fpps[0] : null;
    const novosItens = doc.pecas.map((pc, i) => {
      const it = pecaParaItem(pc, { componentes, tamanhos });
      const nFpp = pc.fpp || unico || (doc.fpps.length === doc.pecas.length ? doc.fpps[i] : null);
      const rf = nFpp ? d.fpps?.[nFpp] : null;
      if (rf) Object.assign(it, { fppId: rf.id, fppNumero: rf.numero, fpp: rf, parametros: { ...it.parametros, TECIDO: tecidoDaFpp(rf, corNaFpp(pc.cor, rf)) } });
      if (rf && it._doc.cor && !corNaFpp(pc.cor, rf) && (rf.cores || []).length) it.parametros["COR DO TECIDO"] = String(it._doc.cor).toUpperCase();
      if (!it.tipoPecaNome && TIPOS.length) it.tipoPecaNome = "";
      if (pc.imagem) it.fotoBase64 = pc.imagem;
      delete it._doc;
      return it;
    });
    const total = novosItens.reduce((s, it) => s + qtdGrade(it.grade) * num(it.valorUnitario), 0);
    const pz = prazoParaDias(doc.prazoTexto, f.emissao);
    const contato = [cli ? [cli.preposto, cli.telefones].filter(Boolean).join(" · ") : "", doc.email].filter(Boolean).join(" · ");
    const end = doc.faturamento.endereco || (cli ? [cli.logradouro, cli.numero, cli.complemento, cli.bairro, cli.municipio && `${cli.municipio}${cli.uf ? "/" + cli.uf : ""}`, cli.cep].filter(Boolean).join(", ") : "");
    setF((s) => ({
      ...s, servico: false, interno: false,
      clienteNome: (cli?.razaoSocial || doc.faturamento.razaoSocial || doc.cliente || "").toUpperCase(),
      clienteCnpj: fmtCnpj(doc.faturamento.cnpj || cli?.cnpj || ""), clienteIe: String(doc.faturamento.ie || cli?.inscricaoEstadual || "").toUpperCase(),
      clienteEndereco: String(end || "").toUpperCase(), clienteContato: contato,
      vendedor: String(doc.vendedor || s.vendedor || "").toUpperCase(), oc: String(doc.oc || "").toUpperCase(),
      ...(pz ? { prazoDias: String(pz.prazoDias), prazoTipo: pz.prazoTipo } : {}),
      pagamento: condicaoParaPagamento(doc.condicao, total, s.emissao),
      obs: [s.obs, doc.observacoes].filter((x) => String(x || "").trim()).join("\n"),
      entregaModo: "UNICA", entregas: [],
    }));
    setItens(novosItens.length ? novosItens : [novoItem()]);
    if (d.imagensSoltas?.length) setAnexos((l) => [...l, ...d.imagensSoltas.map((u, k) => ({ nome: `Layout ${k + 1} (da solicitação).${/jpeg/.test(u) ? "jpg" : "png"}`, tipo: /jpeg/.test(u) ? "image/jpeg" : "image/png", tamanho: Math.round(u.length * 0.75), categoria: "LAYOUT", base64: u }))]);
    // resumo para o vendedor conferir
    const av = [...(d.avisos || [])];
    if (pz?.passou) av.push(`Prazo de entrega do documento (${doc.prazoTexto}) já passou: confira o prazo.`);
    if (doc.prazoTexto && !pz) av.push(`Prazo de entrega "${doc.prazoTexto}" não reconhecido: preencha os dias.`);
    if (doc.condicao && !condicaoParaPagamento(doc.condicao, total).parcelas.length && !condicaoParaPagamento(doc.condicao, total).entrada) av.push(`Condição de pagamento "${doc.condicao}" não reconhecida: monte as parcelas.`);
    novosItens.forEach((it, i) => {
      if (!it.tipoPecaNome) av.push(`Item ${i + 1} (${doc.pecas[i].categoria}): tipo de peça não reconhecido — escolha o tipo.`);
      const fora = it.grade.filter((g) => num(g.qtd) > 0 && !tamanhos.includes(g.tam) && !/^\d+$/.test(g.tam) && !/^BL /.test(g.tam)).map((g) => g.tam);
      if (fora.length) av.push(`Item ${i + 1}: tamanhos fora da grade padrão (${fora.join(", ")}) — entraram no fim da grade.`);
      if (!it.fotoBase64 && !it.dispensaDesign) av.push(`Item ${i + 1}: sem layout — ao efetivar, vira tarefa para o arte-finalista.`);
      if (veVal && it.fpp?.valorProposto && Math.abs(num(it.desconto ? it.desconto.base : it.valorUnitario) - Number(it.fpp.valorProposto)) > 0.009) av.push(`Item ${i + 1}: valor unitário ${money(num(it.valorUnitario))} diferente do valor da FPP ${numFpp(it.fppNumero)} (${money(it.fpp.valorProposto)}).`);
    });
    if (doc.valorTotal != null && Math.abs(doc.valorTotal - total) > 0.05) av.push(`Total calculado ${money(total)} diferente do total do documento ${money(doc.valorTotal)}.`);
    setImportado({ nome, cliente: doc.cliente, clienteCriado: d.clienteCriado, clienteCompletado: d.clienteCompletado || [], pecas: novosItens.reduce((s2, it) => s2 + qtdGrade(it.grade), 0), total, fpps: doc.fpps, avisos: av });
    return true;
  };
  const lerAnexoSalvo = async (a) => {
    if (a.base64) return preencherDaSolicitacao(a.base64, a.nome);
    try { const b = await fetch(`/api/pp/${ppId}?anexo=${a.id}&_u=${uid}`).then((r) => r.blob()); return preencherDaSolicitacao(await readB64(b), a.nome); }
    catch { alerta("Não consegui abrir o anexo."); return false; }
  };
  const abrirAnexo = (a) => {
    if (a.base64) { const w = window.open(); if (w) w.document.write(`<iframe src="${a.base64}" style="border:0;width:100%;height:100%"></iframe>`); return; }
    window.open(`/api/pp/${ppId}?anexo=${a.id}&_u=${uid}`, "_blank");
  };
  const legados = [["arquivoPcPdf", "PC do cliente"], ["arquivoLancPdf", "Solicitação de lançamento"], ["arquivoPedidoPdf", "PV (KM)"], ["arquivoOpPdf", "Ordem de produção (KM)"]].filter(([k]) => f[k]);

  // ---------- salvar / efetivar / faturar ----------
  const payload = () => ({
    ...f, prazoDias: f.prazoDias === "" ? null : num(f.prazoDias), clienteCnpj: dig(f.clienteCnpj) ? fmtCnpj(f.clienteCnpj) : "",
    itens: itens.map((it) => ({ ...it, fpp: undefined })),
    comissao: veVal ? f.comissao : undefined,   // v747 — quem não vê valores não mexe na comissão
    desconto: veVal ? f.desconto : undefined,   // v750
    anexos: anexos.map((a) => (a.id ? { id: a.id, categoria: a.categoria } : a)),
  });
  // v810 — item padrão do cliente com parâmetros de produção editados no pedido: pergunta se atualiza o item padrão
  const respPadrao = useRef({});   // "id|assinatura" → já respondido nesta tela (não pergunta de novo)
  const chaveParams = (p) => JSON.stringify(Object.entries(p || {}).filter(([k, v]) => k !== "TECIDO" && !paramFora(k) && v != null && String(typeof v === "object" ? JSON.stringify(v) : v).trim() !== "")
    .map(([k, v]) => [k.trim().toUpperCase(), typeof v === "object" ? JSON.stringify(v) : String(v).trim().toUpperCase()]).sort((a, b) => a[0].localeCompare(b[0])));
  const conferirPadroes = async () => {
    for (const it of itens) {
      if (!it.itemPadraoId) continue;
      const d = await fetch(`/api/itens-padrao/${it.itemPadraoId}`).then((r) => r.json()).catch(() => null);
      if (!d || d.error) continue;
      const nova = chaveParams(it.parametros), k = `${it.itemPadraoId}|${nova}`;
      if (nova === chaveParams(d.parametros) || respPadrao.current[k] != null) continue;
      const sim = await confirmar(`Salvar edições nos parâmetros no item padrão "${d.nomeInterno || d.nomeNf}"?\n\nSim: o item padrão fica atualizado e os próximos pedidos já vêm com estes parâmetros.\nNão: as edições valem só para este pedido.`, { okTexto: "Sim, atualizar o item padrão", cancelar: "Não, só neste pedido" });
      respPadrao.current[k] = sim;
      if (!sim) continue;
      const parametros = { ...Object.fromEntries(Object.entries(it.parametros || {}).filter(([kk, v]) => kk !== "TECIDO" && !paramFora(kk) && v != null && String(v).trim() !== "")), ...(d.parametros?.TECIDO ? { TECIDO: d.parametros.TECIDO } : {}) };
      const r = await fetch(`/api/itens-padrao/${it.itemPadraoId}`, { method: "PUT", headers: { "Content-Type": "application/json", "x-usuario-id": String(uid || "") }, body: JSON.stringify({ acao: "parametros", parametros }) }).then((x) => x.json()).catch(() => ({ error: "falha de conexão" }));
      if (r.error) alerta(`Não consegui atualizar o item padrão: ${r.error}`);
    }
  };
  const salvar = async () => {
    await conferirPadroes();
    const r = await api(ppId ? `/api/pp/${ppId}` : "/api/pp", { method: ppId ? "PUT" : "POST", body: JSON.stringify(payload()) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Erro ao salvar.");
    if (!ppId) setPpId(d.id);
    // anexos novos passam a ter id: recarrega a lista (sem o conteúdo)
    const atual = await api(`/api/pp/${d.id}`).then((x) => x.json()).catch(() => null);
    if (atual?.anexos) setAnexos(atual.anexos);
    return d.id;
  };
  // v729 — sem rascunho: só pedido efetivado fica no sistema. Sair sem efetivar descarta o que foi gravado na tentativa.
  const sair = async () => {
    if (efetivado || !podeLancar) return onVoltar(f.numero || null);
    if (f.status === "RASCUNHO") return onVoltar();   // v777 — rascunho fica salvo
    if (ppId0) return onVoltar();   // pedido que já existia (ex.: do portal aguardando efetivação): fica como está
    const preenchido = !!(ppId || f.clienteNome || itens.some((it) => it.descricao || qtdGrade(it.grade) > 0));
    if (preenchido && !(await confirmar("Sair sem gerar o pedido? O que foi lançado não fica salvo. Para continuar depois, use \"Salvar rascunho\"."))) return;
    if (ppId && !ppId0) await api(`/api/pp/${ppId}`, { method: "DELETE" }).catch(() => null);   // só o criado nesta tela (pedido do portal aberto aqui não é apagado)
    onVoltar();
  };
  // v777 — #62: rascunho — salva tudo com o número reservado; fica fora da produção e dos indicadores até "Gerar pedido"
  const salvarRascunho = async () => {
    setSalvando(true);
    try {
      const id = await salvar();
      const d = await api(`/api/pp/${id}`, { method: "POST", body: JSON.stringify({ acao: "rascunho" }) }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setF((s) => ({ ...s, numero: d.numero || s.numero, status: "RASCUNHO" }));
      alerta(`Rascunho salvo — pedido nº ${d.numero} reservado. Ele aparece em Produção como RASCUNHO e só entra na produção ao clicar em "Gerar pedido".`);
    } catch (e) { alerta(e.message); }
    setSalvando(false);
  };
  const efetivar = async () => {
    const semTipo = itens.findIndex((it) => !it.tipoPecaNome);   // v631
    if (semTipo >= 0) { alerta(`Item ${semTipo + 1}: escolha o tipo de peça.`); return; }
    if (!confEnt.ok && f.entregaModo !== "UNICA") { alerta("A soma das grades das entregas não bate com o pedido. Confira os locais de entrega."); return; }
    setSalvando(true);
    try {
      const id = await salvar();
      const d = await api(`/api/pp/${id}`, { method: "POST", body: JSON.stringify({ acao: "efetivar" }) }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      if (d.ok) setF((s) => ({ ...s, numero: d.numero, efetivadoEm: new Date().toISOString(), status: s.status === "FATURADO" ? "FATURADO" : "LANCADO" }));
      setResultado(d);
      if (d.tarefaLayout) alerta("Há item sem layout: o pedido seguiu normal e foi criada a tarefa de criação de layout para o arte finalista.");   // v654
    } catch (e) { alerta(e.message); }
    setSalvando(false);
  };
  const faturar = async () => {
    setSalvando(true);
    try {
      const d = await api(`/api/pp/${ppId}`, { method: "POST", body: JSON.stringify({ acao: "faturar", nf: fat.nf, emissaoNf: fat.emissaoNf, entrega: fat.entrega || null }) }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      if (d.pedirEntrega) { setFat((s) => ({ ...s, pedirEntrega: true })); alerta("Há parcelas contadas da data de entrega: informe a previsão de entrega."); }
      else if (d.ok) { setF((s) => ({ ...s, status: "FATURADO" })); setFat(null); setResultado({ ok: true, faturado: true, lancadas: d.lancadas }); }
    } catch (e) { alerta(e.message); }
    setSalvando(false);
  };
  const precisaEntrega = (f.pagamento?.parcelas || []).some((x) => x.base === "ENTREGA");

  const imprimirAgora = (tipo) => imprimirPedido(tipo, {
    ...f, clienteFinal, numero: numeroExib, valorTotal: totalGeral, dtDespacho: dataBR(despacho), prazoEntrega: f.prazoDias !== "" ? `${f.prazoDias} dias ${f.prazoTipo === "UTEIS" ? "úteis" : "corridos"}` : "",
    condicaoPagamento: f.interno ? "INTERNO" : veVal ? textoCondicao(f.pagamento, totalGeral) : "", tipoPedido: f.servico ? "SERVIÇO" : f.interno ? "INTERNO" : "VENDA NORMAL", obsNfTexto: obsNf,
    entregasTexto: f.entregaModo === "UNICA" ? "" : f.entregas.map((e, k) => `${k + 1}. ${e.local || "—"} · ${e.endereco || "—"} · resp. ${e.responsavel || "—"} ${e.contato || ""} · ${DOCS_ENTREGA[e.documento] || "—"}`).join("\n"),
  }, f.servico ? itens.map((it) => ({ ...it, grade: [{ tam: "UN", qtd: it.quantidade }] })) : itens, { componentes, alerta,
    anexos: anexos.map((a) => ({ nome: a.nome, mime: a.tipo, src: a.base64 || (a.id && ppId ? `/api/pp/${ppId}?anexo=${a.id}&_u=${uid}` : "") })) });   // v650

  if (!carregado) return <div style={{ color: C.sub }}>Carregando…</div>;

  const badge = faturado ? ["FATURADO", C.blue] : efetivado ? ["LANÇADO", C.green] : recDet ? ["RECEBENDO DETALHES", C.accent] : ["RASCUNHO", C.yellow];
  // v707 — link criado: grava o pedido na hora (o link fica ligado ao item) e marca a fase
  const gravarLink = async (i, du) => {
    try {
      const its = itens.map((it, j) => (j === i ? { ...it, dadosUnitarios: du } : it));
      const r = await api(`/api/pp/${ppId}`, { method: "PUT", body: JSON.stringify({ ...payload(), itens: its.map((it) => ({ ...it, fpp: undefined })) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
      setRecDet(true);
      alerta("Link criado e pedido salvo. Ele fica em \"recebendo detalhes\" até você fechar o preenchimento e trazer as respostas.");
    } catch (e) { alerta("O link foi criado, mas o pedido não foi salvo: " + e.message + " — salve o rascunho."); }
  };
  return (
    <div className="pb-10">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={sair} className="text-sm" style={{ color: C.sub }}>← Voltar</button>
          <span className="text-lg font-bold">Pedido {numeroExib || "—"}{!f.numero && numeroExib ? <span className="text-xs font-normal ml-1" style={{ color: C.sub }}>(prévia — número gravado no rascunho ou ao gerar o pedido)</span> : null}</span>
          <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: badge[1], border: `1px solid ${badge[1]}` }}>{badge[0]}</span>
          {f.interno && <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: C.panel2, color: C.sub }}>INTERNO</span>}
          {f.servico && <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: C.panel2, color: C.sub }}>SERVIÇO</span>}
        </div>
        <div className="flex gap-2">
          {!f.servico && <button onClick={() => imprimirAgora("PP")} title="Ordem de produção — sem valores" className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}><Printer size={16} /> Imprimir OP</button>}
          {veVal && <button onClick={() => imprimirAgora("PV")} title="Pedido de venda — com valores" className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}><Printer size={16} /> Imprimir PV</button>}
          {/* v705 — resetar: limpa o pedido em lançamento (cliente, itens, anexos, prazos); o rascunho salvo só muda ao salvar de novo */}
          {podeLancar && !efetivado && <button onClick={async () => {
            if (!(await confirmar("Resetar o pedido? Cliente, itens (com grades e personalização exclusiva), anexos, prazo e pagamento são apagados da tela."))) return;
            setF((s) => ({ ...vazioF(), numero: s.numero, status: s.status, emissao: hojeISO() }));   // v793 — rascunho continua rascunho setItens([novoItem()]); setAnexos([]);
          }} title="Limpa tudo e começa o pedido de novo" className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ background: C.panel, color: C.red, border: `1px solid ${C.line}` }}><RotateCcw size={14} /> Resetar pedido</button>}
          {podeLancar && !efetivado && <button onClick={salvarRascunho} disabled={salvando} title="Salva com o número reservado, fora da produção e dos indicadores" className="px-4 py-2 rounded font-semibold text-sm" style={{ background: C.panel, color: C.yellow, border: `1px solid ${C.yellow}`, opacity: salvando ? 0.6 : 1 }}>
            Salvar rascunho</button>}
          {podeLancar && <button onClick={efetivar} disabled={salvando} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando…" : efetivado ? "Salvar alterações" : "Gerar pedido"}</button>}
          {podeLancar && efetivado && !faturado && !f.interno && <button onClick={() => setFat({ nf: "", emissaoNf: hojeISO(), entrega: despacho || "", pedirEntrega: false })} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: C.blue, color: "#fff" }}>Faturar</button>}
        </div>
      </div>

      {!podeLancar && <div className="rounded-lg px-4 py-2 mb-4 text-xs" style={{ background: C.panel2, color: C.sub }}>Somente leitura{veVal ? "" : " · valores do pedido ocultos"}.</div>}
      <fieldset disabled={!podeLancar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

      {/* ---------- Anexos ---------- */}
      <Card titulo={`Anexos${anexos.length + legados.length ? ` (${anexos.length + legados.length})` : ""}`}>
        <div onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionarArquivos(e.dataTransfer.files); }}
          className="rounded-lg px-4 py-3 text-xs text-center mb-3" style={{ border: `2px dashed ${arrastando ? C.accent : C.line}`, background: arrastando ? C.accentSoft : C.panel2, color: C.sub }}>
          <Paperclip size={14} className="inline mr-1" />Arraste aqui a OC do cliente, a solicitação, o layout… (vários de uma vez) ou{" "}
          <label className="cursor-pointer font-semibold" style={{ color: C.accent }}>selecione<input type="file" multiple className="hidden" onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = ""; }} /></label>
          <div className="mt-1" style={{ fontSize: 11 }}><Wand2 size={11} className="inline mr-1" style={{ color: C.accent }} />O PDF da <b>solicitação de lançamento</b> (gerado pela skill do vendedor) preenche o pedido sozinho: cliente, faturamento, vendedor, OC, prazo, pagamento, itens, grade, valores, parâmetros, FPP e layout.</div>
        </div>
        {importando && <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ background: C.accentSoft, color: C.accent }}><Wand2 size={14} className="inline mr-1" />Lendo a solicitação de lançamento…</div>}
        {importado && <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ background: importado.avisos.length ? "#FFF8E6" : C.greenSoft, border: `1px solid ${importado.avisos.length ? C.yellow : C.green}55` }}>
          <div className="flex items-start gap-2">
            <Wand2 size={15} style={{ color: C.green, marginTop: 2 }} />
            <div className="flex-1">
              <div className="font-semibold" style={{ color: C.text }}>Pedido preenchido pela solicitação {importado.nome ? `(${importado.nome})` : ""}</div>
              <div className="text-xs mt-0.5" style={{ color: C.sub }}>
                {importado.cliente}{importado.clienteCriado ? " · cliente cadastrado agora em Clientes" : ""}{importado.clienteCompletado.length ? ` · cadastro completado (${importado.clienteCompletado.join(", ")})` : ""}
                {" · "}{importado.pecas} pç{veVal ? ` · ${money(importado.total)}` : ""}{importado.fpps.length ? ` · FPP ${importado.fpps.map(numFpp).join(" / ")}` : ""}
              </div>
              {importado.avisos.length > 0 && <ul className="mt-1 text-xs list-disc pl-4" style={{ color: "#8A5A00" }}>{importado.avisos.map((a, k) => <li key={k}>{a}</li>)}</ul>}
              <div className="text-xs mt-1" style={{ color: C.sub }}>Confira e ajuste o que precisar antes de efetivar.</div>
            </div>
            <button type="button" onClick={() => setImportado(null)} style={{ color: C.sub }}><X size={15} /></button>
          </div>
        </div>}
        {(anexos.length > 0 || legados.length > 0) && <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {anexos.map((a, k) => {
            const img = /^image\//.test(a.tipo || "");
            const src = a.base64 || (a.id && ppId ? `/api/pp/${ppId}?anexo=${a.id}&_u=${uid}` : "");
            return (
              <div key={a.id || `n${k}`} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${a.id ? C.line : C.accent}` }}>
                <button type="button" onClick={() => abrirAnexo(a)} className="block w-full" style={{ height: 90, background: C.panel2 }} title="Abrir">
                  {img && src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <div className="flex flex-col items-center justify-center h-full" style={{ color: C.accent }}><FileText size={28} /><span className="text-xs mt-1 font-semibold">{(a.nome.split(".").pop() || "").toUpperCase()}</span></div>}
                </button>
                <div className="px-2 py-1.5">
                  <div className="text-xs font-medium truncate" title={a.nome}>{a.nome}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <select value={a.categoria || "OUTRO"} onChange={(e) => setAnexos((l) => l.map((x, j) => (j === k ? { ...x, categoria: e.target.value } : x)))} className="flex-1 text-xs px-1 py-0.5 rounded outline-none" style={inp}>
                      {Object.entries(CATS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    {/pdf/i.test(a.tipo || a.nome) && !f.servico && !efetivado && <button type="button" onClick={() => lerAnexoSalvo(a)} style={{ color: C.accent }} title="Preencher o pedido com esta solicitação de lançamento"><Wand2 size={14} /></button>}
                    <button type="button" onClick={() => setAnexos((l) => l.filter((_, j) => j !== k))} style={{ color: "#C77" }} title="Remover"><Trash2 size={14} /></button>
                  </div>
                  {!a.id && <div className="text-[10px] mt-0.5" style={{ color: C.accent }}>novo · grava ao salvar</div>}
                </div>
              </div>
            );
          })}
          {legados.map(([k, t]) => (
            <div key={k} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              <button type="button" onClick={() => ppId && window.open(`/api/pp/${ppId}?arquivo=${k}&_u=${uid}`, "_blank")} className="block w-full" style={{ height: 90, background: C.panel2 }}>
                <div className="flex flex-col items-center justify-center h-full" style={{ color: C.accent }}><FileText size={28} /><span className="text-xs mt-1 font-semibold">PDF</span></div>
              </button>
              <div className="px-2 py-1.5 text-xs font-medium truncate">{t}</div>
            </div>
          ))}
        </div>}
      </Card>

      {/* ---------- Dados do pedido ---------- */}
      <Card titulo="Dados do pedido">
        <div className="grid grid-cols-4 gap-3">
          <Campo label="Tipo de pedido">
            <div className="flex rounded overflow-hidden text-sm" style={{ border: `1px solid ${C.line}` }}>
              {[["VENDA", "Venda normal"], ["INTERNO", "Interno"], ["SERVICO", "Serviço"]].map(([v, t]) => { const atual = f.servico ? "SERVICO" : f.interno ? "INTERNO" : "VENDA"; return (
                <button key={t} type="button" disabled={efetivado && (v === "SERVICO") !== f.servico} title={efetivado && (v === "SERVICO") !== f.servico ? "Pedido já efetivado: não muda entre produto e serviço" : ""}
                  onClick={() => trocarTipo(v)} className="flex-1 px-2 py-1.5" style={{ background: atual === v ? C.accent : C.panel2, color: atual === v ? "#fff" : C.sub, fontWeight: atual === v ? 600 : 400 }}>{t}</button>
              ); })}
            </div>
          </Campo>
          <Campo label="Nº do pedido"><div className="px-2 py-1.5 rounded text-sm font-semibold" style={{ ...inp, color: f.numero ? C.text : C.sub }}>{f.numero || (proximo ? `${proximo} (automático)` : "automático")}</div></Campo>
          <In label="Data de emissão" type="date" upper={false} value={f.emissao} onChange={(e) => set("emissao", e.target.value || hojeISO())} />
          <CampoVendedor uid={uid} value={f.vendedor} onChange={(v) => set("vendedor", v)} />
          <Campo label="Cliente · nome ou CNPJ" cls="col-span-2">
            <Auto value={f.clienteNome} onChange={(v) => set("clienteNome", v)} buscar={buscarCliente} onPick={pickCliente} placeholder="Digite o nome ou o CNPJ…"
              render={(c) => <span><b>{c.razaoSocial || c.nomeFantasia}</b> <span style={{ color: C.sub }}>· {fmtCnpj(c.cnpj)}{c.municipio ? " · " + c.municipio : ""}</span></span>} />
          </Campo>
          <Campo label="CNPJ / CPF">
            <input value={f.clienteCnpj} onChange={(e) => aoCnpj(e.target.value)} onBlur={() => set("clienteCnpj", fmtCnpj(f.clienteCnpj))} placeholder="puxa o cadastro" className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inp} />
            {cnpjSemCadastro && <div className="text-[11px] mt-0.5" style={{ color: C.yellow }}>CNPJ sem cadastro em Clientes</div>}
          </Campo>
          <In label="Inscr. estadual" value={f.clienteIe} onChange={(e) => set("clienteIe", e.target.value)} />
          <In label="Endereço" cls="col-span-3" value={f.clienteEndereco} onChange={(e) => set("clienteEndereco", e.target.value)} />
          <In label="Contato" value={f.clienteContato} onChange={(e) => set("clienteContato", e.target.value)} />
          <In label="OC do cliente" value={f.oc} onChange={(e) => set("oc", e.target.value)} />
          <Campo label="Prazo de entrega" cls="col-span-2">
            <div className="flex gap-2 items-center">
              <input type="number" min="0" value={f.prazoDias} onChange={(e) => set("prazoDias", e.target.value)} placeholder="dias" className="w-20 px-2 py-1.5 rounded outline-none text-sm" style={inp} />
              <select value={f.prazoTipo} onChange={(e) => set("prazoTipo", e.target.value)} className="px-2 py-1.5 rounded outline-none text-sm" style={inp}>
                <option value="UTEIS">dias úteis</option><option value="CORRIDOS">dias corridos</option>
              </select>
              {/* v773 — #64: a data de despacho também pode ser escolhida no calendário (vira dias corridos a partir da emissão) */}
              <span className="text-sm" style={{ color: C.sub }}>→ despacho</span>
              <input type="date" value={despacho || ""} min={f.emissao || undefined} onChange={(e) => { const d = e.target.value; if (!d) return set("prazoDias", "");
                const dias = Math.round((new Date(`${d}T00:00:00Z`) - new Date(`${f.emissao || hojeISO()}T00:00:00Z`)) / 86400000);
                setF((x) => ({ ...x, prazoDias: String(Math.max(0, dias)), prazoTipo: "CORRIDOS" })); }}
                className="px-2 py-1 rounded outline-none text-sm font-semibold" style={{ ...inp, color: C.accent }} title="Escolha a data no calendário" />
              {despacho && <span className="text-xs" style={{ color: C.sub }}>{diaSem(despacho)}</span>}
            </div>
          </Campo>
          <Campo label="Observações internas" cls="col-span-4">
            <textarea value={f.obs} onChange={(e) => set("obs", e.target.value)} rows={2} className="w-full px-3 py-2 rounded outline-none text-sm" style={inp} />
          </Campo>
        </div>
      </Card>

      {/* ---------- Itens ---------- */}
      {f.servico && <Card titulo="Serviços" extra={veVal && <span className="text-sm">Total <b style={{ color: C.accent }}>{money(totalGeral)}</b></span>}>
        <div className="grid gap-2 text-xs font-semibold mb-1" style={{ color: C.sub, gridTemplateColumns: "190px 1fr 110px 140px 140px 28px" }}>
          <span>Tipo de serviço</span><span>Descrição</span><span className="text-right">Quantidade</span>{veVal ? <><span className="text-right">Valor unit. (R$)</span><span className="text-right">Total</span></> : <><span /><span /></>}<span />
        </div>
        {itens.map((it, i) => (
          <div key={i} className="grid gap-2 items-center mb-2" style={{ gridTemplateColumns: "190px 1fr 110px 140px 140px 28px" }}>
            {(() => { const tp = it.tipoServico ?? it.parametros?.TIPO_SERVICO ?? servicoDe(null, it.descricao)?.k ?? ""; return (
              <select value={tp} onChange={(e) => upItem(i, { tipoServico: e.target.value })} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, borderColor: tp ? undefined : C.accent }} title="Define a conta de receita do serviço no financeiro">
                <option value="">Escolha…</option>{SERVICOS.map((s) => <option key={s.k} value={s.k}>{s.nome}</option>)}
              </select>); })()}
            <input value={it.descricao} onChange={(e) => upItem(i, { descricao: e.target.value })} placeholder="ex.: bordado de logo no peito, silk 2 cores, costura de faixa…" className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inp} />
            <input value={it.quantidade} onChange={(e) => upItem(i, { quantidade: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 rounded outline-none text-sm text-right" style={inp} />
            {veVal ? <>
              <input value={it.valorUnitario} onChange={(e) => upItem(i, { valorUnitario: e.target.value })} placeholder="0,00" className="w-full px-2 py-1.5 rounded outline-none text-sm text-right" style={inp} />
              <div className="text-right text-sm font-semibold" style={{ color: C.text }}>{money(totalItem(it))}</div>
            </> : <><span /><span /></>}
            {podeLancar && itens.length > 1 ? <button type="button" onClick={() => setItens((arr) => arr.filter((_, j) => j !== i))} style={{ color: "#C77" }}><Trash2 size={15} /></button> : <span />}
            {/* v792 — todo serviço tem anexos (layout, arte, referência…): saem com o item, como nos produtos */}
            <div className="flex items-center gap-2 flex-wrap" style={{ gridColumn: "1 / -1" }}>
              <label className="text-[11px] px-2 py-1 rounded cursor-pointer" style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentSoft }}
                onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }}
                onDrop={async (e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer?.files || []); if (!fs.length) return; const add = await Promise.all(fs.map(async (x) => ({ nome: x.name, mime: x.type || null, base64: await readB64(x), categoria: "PERSONALIZACAO" }))); upItem(i, { anexos: [...(it.anexos || []), ...add] }); }}>
                <Paperclip size={11} className="inline mr-0.5" />Anexos do serviço <span style={{ color: C.sub }}>· arraste ou clique</span>
                <input type="file" multiple className="hidden" onChange={async (e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; const add = await Promise.all(fs.map(async (x) => ({ nome: x.name, mime: x.type || null, base64: await readB64(x), categoria: "PERSONALIZACAO" }))); upItem(i, { anexos: [...(it.anexos || []), ...add] }); }} />
              </label>
              {(it.anexos || []).map((a, k) => (
                <span key={k} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded" style={{ background: C.panel2 }}>
                  <button type="button" onClick={() => { const w = window.open(); if (w) w.document.write(/pdf/i.test(a.mime || a.nome) ? `<iframe src="${a.base64}" style="border:0;width:100%;height:100%"></iframe>` : `<img src="${a.base64}" style="max-width:100%"/>`); }} className="truncate text-left" style={{ color: C.text, maxWidth: 220 }} title={a.nome}><Paperclip size={10} className="inline mr-0.5" />{a.nome}</button>
                  {podeLancar && <button type="button" onClick={() => upItem(i, { anexos: it.anexos.filter((_, j) => j !== k) })} style={{ color: "#C77" }}><X size={11} /></button>}
                </span>
              ))}
            </div>
          </div>
        ))}
        {podeLancar && <button type="button" onClick={() => setItens((arr) => [...arr, novoServico()])} className="mt-1 px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Adicionar serviço</button>}
      </Card>}
      {!f.servico && podeLancar && (
        <div className="rounded-lg p-4 mb-4" style={{ background: C.accentSoft, border: `2px solid ${C.accent}` }}>
          <div className="flex items-center gap-2 mb-2"><Search size={16} style={{ color: C.accent }} /><span className="font-bold text-sm" style={{ color: C.accent }}>Buscar item cadastrado{padroes.length ? ` · ${padroes.length} de ${f.clienteNome || "este cliente"}` : ""}</span>
            <span className="text-xs" style={{ color: C.sub }}>· código, descrição, nome interno ou cliente: os dados entram preenchidos (nome da NF, preço, parâmetros, layout e FPP)</span></div>
          <div style={{ position: "relative" }}>
            <input value={buscaPadrao} onChange={(e) => setBuscaPadrao(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && opPadrao[0]) { e.preventDefault(); usarPadrao(opPadrao[0]); } }}
 placeholder="código, descrição, nome interno ou cliente…" className="w-full px-3 py-2.5 rounded outline-none text-base font-semibold" style={{ background: C.panel, border: `1px solid ${C.accent}`, textTransform: "uppercase" }} />
            {buscaPadrao && (
              <div style={{ position: "absolute", zIndex: 40, top: "100%", left: 0, right: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 300, overflowY: "auto" }}>
                {opPadrao.length ? opPadrao.map((p) => (
                  <button key={p.id} onMouseDown={(e) => { e.preventDefault(); usarPadrao(p); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
                    <b>{p.nomeInterno}</b><span style={{ color: C.sub }}>· NF: {p.nomeNf}{p.codigo || p.codigoPadrao ? ` · ${p.codigo || p.codigoPadrao}` : ""}{p.clientes?.length ? ` · ${p.clientes.map((c) => c.nome).slice(0, 2).join(", ")}` : ""}</span>
                    <span className="ml-auto" style={{ color: C.text }}>{veVal && p.precoAtual != null ? money(p.precoAtual) : ""}</span>
                    {p.critica && <span className="text-[10px] font-bold" style={{ color: C.red }}>≠ FPP</span>}
                  </button>
                )) : <div className="px-3 py-2 text-sm" style={{ color: C.sub }}>Nenhum item cadastrado com isso.</div>}
              </div>
            )}
          </div>
          {!buscaPadrao && <div className="flex flex-wrap gap-1.5 mt-2">{padroes.slice(0, 10).map((p) => <button key={p.id} onClick={() => usarPadrao(p)} className="text-xs px-2 py-1 rounded" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text }}>+ {p.nomeInterno}</button>)}</div>}
        </div>
      )}
      {!f.servico && itens.map((it, i) => {
        const comps = componentes[it.tipoPecaNome] || [];
        const extras = Object.keys(it.parametros || {}).filter((k) => !comps.includes(k) && !paramFora(k));
        const tec = it.parametros?.TECIDO && typeof it.parametros.TECIDO === "object" ? it.parametros.TECIDO : null;
        return (
          <Card key={i} destaque titulo={<>Item {i + 1}{it.descricao ? <span className="font-semibold opacity-80"> · {it.descricao}</span> : null}</>} extra={podeLancar && <span className="flex items-center gap-3">
              {/* v822 — #77: duplicar o item (mesmo produto mudando cor, estampa ou valor) */}
              <button type="button" onClick={() => setItens((arr) => { const { id, linkId, linkToken, ...copia } = JSON.parse(JSON.stringify(arr[i])); return [...arr.slice(0, i + 1), copia, ...arr.slice(i + 1)]; })}
                title="Duplicar este item logo abaixo" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#fff" }}><Copy size={14} /> Duplicar</button>
              <button type="button" onClick={() => setItens((arr) => arr.filter((_, j) => j !== i))} title="Excluir item" style={{ color: "#FFB4A8" }}><Trash2 size={16} /></button>
            </span>}>
            <div className="grid grid-cols-6 gap-3 mb-3">
              <Campo label="Tipo de peça">
                <select value={it.tipoPecaNome} onChange={(e) => upItem(i, { tipoPecaNome: e.target.value })} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, ...(it.tipoPecaNome ? {} : { color: C.sub }) }}>
                  <option value="" disabled>Selecione…</option>
                  {TIPOS.map((t) => <option key={t} value={t} style={{ color: C.text }}>{t}</option>)}
                </select>
              </Campo>
              {/* v668 — código do KM de volta: ao digitar, busca o item e puxa as informações técnicas */}
              <Campo label="Código">
                <Auto value={it.codigo} onChange={(v) => upItem(i, { codigo: v })} buscar={buscarItem} onPick={(p) => pickItem(i, p)} placeholder="código…" exato="codigo"
                  render={(p) => renderItem(p, true)} />
              </Campo>
              <Campo label="Descrição do produto · busca no cadastro de itens e no KM" cls="col-span-3">
                <Auto value={it.descricao} onChange={(v) => upItem(i, { descricao: v })} buscar={buscarItem} onPick={(p) => pickItem(i, p)} placeholder="código, descrição ou cliente…"
                  render={(p) => renderItem(p, false)} />
              </Campo>
              {veVal ? <div>
                <In label={it.desconto ? "Valor unitário cheio (R$)" : "Valor unitário (R$)"} upper={false} value={it.desconto ? it.desconto.base : it.valorUnitario}
                  onChange={(e) => upItem(i, it.desconto ? descItem({ ...it.desconto, base: e.target.value }) : { valorUnitario: e.target.value })} placeholder="0,00" />
                <DescontoPeca it={it} onChange={(d) => upItem(i, d ? descItem(d) : { desconto: null, valorUnitario: it.desconto ? it.desconto.base : it.valorUnitario })} />
              </div> : <div />}
            </div>

            {/* FPP */}
            <div className="rounded px-3 py-2 mb-3 text-sm flex items-center gap-3 flex-wrap" style={{ background: it.fppId ? C.greenSoft : C.accentSoft, border: `1px solid ${it.fppId ? C.green : C.accent}55` }}>
              {it.fppId ? <>
                <span className="font-semibold" style={{ color: C.green }}>FPP {numFpp(it.fppNumero)}</span>
                <span style={{ color: C.text }}>{it.fpp ? `${it.fpp.nomeComercial || it.fpp.item}${it.fpp.cliente ? " · " + it.fpp.cliente : ""}` : ""}</span>
                {it.fpp && <span style={{ color: C.sub }}>· {tecidoDoResumo(it.fpp).join(" · ")}</span>}
                {/* v664 — FPP com várias cores do mesmo tecido: escolher a cor deste item (vai para compras) */}
                {it.fpp && (it.fpp.cores || []).length > 1 && <select value={it.parametros?.TECIDO?.cor || ""} onChange={(e) => upItem(i, { parametros: { ...it.parametros, TECIDO: tecidoDaFpp(it.fpp, e.target.value) } })}
                  className="px-2 py-1 rounded text-xs font-semibold" style={{ ...inp, borderColor: it.parametros?.TECIDO?.cor ? C.line : C.accent }}>
                  <option value="">cor do tecido…</option>{it.fpp.cores.map((c) => <option key={c.cor} value={c.cor}>{c.cor}{c.codigo ? ` · ${c.codigo}` : ""}</option>)}
                </select>}
                {podeLancar && <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => setFppModal(i)} className="text-xs underline" style={{ color: C.accent }}>trocar</button>
                  <button type="button" onClick={() => tirarFpp(i)} className="text-xs underline" style={{ color: C.sub }}>tirar</button>
                </span>}
              </> : <>
                <span style={{ color: C.accent }}>Sem FPP — artigo e rendimento vêm da FPP indexada.</span>
                {podeLancar && <button type="button" onClick={() => setFppModal(i)} className="ml-auto px-3 py-1 rounded text-xs font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}><Search size={13} /> Indexar FPP</button>}
              </>}
            </div>

            <div className="flex gap-4">
              {/* v806 — layout em destaque */}
              <div className="shrink-0" style={{ width: 380 }}>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #001E4155" }}>
                  <div className="px-2.5 py-1.5 text-xs font-bold flex items-center gap-1" style={{ background: "#001E41", color: "#fff" }}>
                    Layout da peça{it.fotoBase64 || it.dispensaDesign ? "" : <span className="font-normal opacity-90">· obrigatório</span>}</div>
                  <label className="block cursor-pointer relative" style={{ height: 380, background: it.fotoBase64 ? "#fff" : C.panel2 }}>
                    {it.fotoBase64 && podeLancar && <button type="button" title="Remover layout" onClick={(e) => { e.preventDefault(); e.stopPropagation(); upItem(i, { fotoBase64: "" }); }}
                      className="absolute top-1 right-1 z-10 flex items-center justify-center rounded-full shadow" style={{ width: 26, height: 26, background: "#fff", color: C.red, border: `1px solid ${C.line}` }}><Trash2 size={14} /></button>}
                    {it.fotoBase64 ? <img src={it.fotoBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <div className="flex flex-col items-center justify-center h-full text-xs text-center px-3 gap-1" style={{ color: C.sub }}>
                          <Paperclip size={20} style={{ color: it.dispensaDesign ? C.sub : "#001E41" }} />
                          <span className="font-semibold" style={{ color: it.dispensaDesign ? C.sub : "#001E41" }}>Clique para adicionar o layout</span>
                          <span style={{ fontSize: 10 }}>{it.dispensaDesign ? "design dispensado" : "sem layout → tarefa para o arte finalista"}</span></div>}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upItem(i, { fotoBase64: await readB64(file) }); }} />
                  </label>
                </div>
                {/* v796 — dispensar design: o item não pede layout e pula a etapa de design */}
                <label className="text-xs mt-1.5 flex items-center gap-1 cursor-pointer" style={{ color: it.dispensaDesign ? C.accent : C.sub }} title="O item não passa pela etapa de design: não pede layout nem gera tarefa para o arte finalista">
                  <input type="checkbox" checked={!!it.dispensaDesign} onChange={(e) => upItem(i, { dispensaDesign: e.target.checked })} /> Dispensar design</label>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs mb-1" style={{ color: C.sub }}>Grade · total {somaItem(it)} pç{veVal ? ` · ${money(totalItem(it))}` : ""}
                  {it.fpp?.leadTime > 0 && <span className="ml-2 px-1.5 py-0.5 rounded font-semibold" style={{ background: C.accentSoft, color: C.accent }} title="Lead time da FPP, contado da emissão do pedido">entrega prevista {dataBR(somaDias(f.emissao || hojeISO(), it.fpp.leadTime, "CORRIDOS"))} · lead time {it.fpp.leadTime} dias</span>}</div>
                <GradeEditor grade={it.grade} tamanhos={tamanhos} onChange={(grade) => upItem(i, { grade })}
                  personalizada={!!(it.dadosUnitarios && Array.isArray(it.dadosUnitarios.campos))} onPersonalizada={podeLancar && !efetivado ? () => upItem(i, { dadosUnitarios: vazioDU() }) : null} />
                {/* v699 — dado unitário: lista peça a peça (colada, digitada ou pelo link do cliente) */}
                {it.dadosUnitarios && Array.isArray(it.dadosUnitarios.campos) && <DadosUnitarios semChave travado={!podeLancar} du={it.dadosUnitarios || null} onChange={(v) => upItem(i, { dadosUnitarios: v })} grade={it.grade} onGrade={(grade) => upItem(i, { grade })}
                  tamanhos={tamanhos} uid={uid} titulo={[f.clienteNome, it.descricao].filter(Boolean).join(" · ") || "PEDIDO"} clienteNome={f.clienteNome}
                  ppId={null} itemIdx={i} onLinkCriado={(du) => gravarLink(i, du)}
                  semLinkTxt={efetivado ? "Pedido já enviado para a produção: não recebe detalhes pelo link." : "O link de preenchimento é do portal do cliente. Aqui, cole ou digite a lista."}
                  onReplicarItens={itens.length > 1 ? () => setItens((arr) => arr.map((x, j) => (j === i ? x : { ...x, dadosUnitarios: { ...(x.dadosUnitarios || {}), campos: it.dadosUnitarios.campos.map((c) => ({ ...c })), linhas: x.dadosUnitarios?.linhas || [] } }))) : null} />}
                <div className="mb-3" />
                <div className="text-xs mb-1" style={{ color: C.sub }}>Parâmetros de produção — {it.tipoPecaNome}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {[...comps, ...extras].map((comp) => comp === "TECIDO" ? (
                    <div key={comp} className="col-span-2 flex items-center gap-2">
                      <span className="w-28 shrink-0 text-[11px]" style={{ color: C.sub }}>TECIDO</span>
                      {tec ? <div className="flex-1 px-2 py-1.5 rounded text-xs" style={{ background: C.greenSoft, color: C.text }} title="vem da FPP">
                        {(() => { const p = partesTecido(tec); return <><b>{p[0]}</b>{p.length > 1 ? ` · ${p.slice(1).join(" · ")}` : ""}</>; })()} <span className="text-xs" style={{ color: C.green }}>(FPP {numFpp(tec.fpp)})</span>
                      </div> : <input value={typeof it.parametros?.TECIDO === "string" ? it.parametros.TECIDO : ""} onChange={(e) => upParam(i, "TECIDO", e.target.value)} placeholder="indexe a FPP para trazer artigo e rendimento"
                        className="flex-1 min-w-0 px-2 py-1.5 rounded outline-none text-xs" style={inp} />}
                    </div>
                  ) : ehEstampa(comp) ? (
                    <div key={comp} className="col-span-2 flex items-start gap-2">   {/* v801 — #71: estampa com 5 linhas, uma por aplicação */}
                      <span className="w-28 shrink-0 text-[11px] pt-1" style={{ color: C.sub }} title={comp}>{comp}<span className="block text-[10px]">uma linha por aplicação</span></span>
                      <textarea value={it.parametros?.[comp] || ""} onChange={(e) => upParam(i, comp, e.target.value)} rows={Math.max(5, String(it.parametros?.[comp] || "").split("\n").length)}
                        placeholder={"1. frente — …\n2. costas — …\n3. manga esq. — …\n4. …\n5. …"} className="flex-1 px-2 py-1.5 rounded outline-none text-xs leading-5" style={inp} />
                    </div>
                  ) : (
                    <div key={comp} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-[11px] truncate" style={{ color: C.sub }} title={comp}>{comp}</span>
                      <input value={it.parametros?.[comp] || ""} onChange={(e) => upParam(i, comp, e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 rounded outline-none text-xs" style={inp} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* v806 — detalhes de personalização: estampas (medidas + arquivos) e demais arquivos; saem na OP e vão para o PCP */}
            <PersonalizacaoItem it={it} onChange={(patch) => upItem(i, patch)} />
          </Card>
        );
      })}
      {podeLancar && !f.servico && <button type="button" onClick={() => setItens((arr) => [...arr, novoItem()])} className="px-4 py-2 rounded font-medium flex items-center gap-1 mb-4" style={{ background: C.panel, color: C.accent, border: `1px solid ${C.accent}` }}>
        <Plus size={16} /> Adicionar item
      </button>}

      {/* ---------- Entrega ---------- */}
      {clienteFinal && <div className="mb-4"><ClienteFinalResumo c={clienteFinal} titulo="Cliente final e envio (informado no portal do cliente)" /></div>}
      {!f.servico && <Card titulo="Entrega">
        <div className="flex gap-2 mb-3">
          {Object.entries(MODOS_ENTREGA).map(([v, t]) => (
            <button key={v} type="button" onClick={() => { set("entregaModo", v); if (v !== "UNICA" && !f.entregas.length) setF((s) => ({ ...s, entregaModo: v, entregas: [{ endereco: "", local: "", responsavel: "", contato: "", documento: v === "TERCEIROS" ? "" : "VENDA", grade: {} }] })); }}
              className="px-3 py-1.5 rounded text-sm" style={{ background: f.entregaModo === v ? C.accent : C.panel2, color: f.entregaModo === v ? "#fff" : C.sub, fontWeight: f.entregaModo === v ? 600 : 400 }}>{t}</button>
          ))}
        </div>
        {f.entregaModo === "UNICA" ? <div>
          <div className="text-sm" style={{ color: C.sub }}>Entrega no endereço do cliente, com a grade inteira do pedido.</div>
          <FreteCampo v={f.frete} onChange={(x) => set("frete", x)} veVal={veVal} />
        </div> : <>
          {f.entregas.map((e, k) => (
            <div key={k} className="rounded-lg p-3 mb-3" style={{ border: `1px solid ${C.line}`, background: C.panel2 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-sm">Local de entrega {k + 1}</div>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => upEnt(k, { endereco: f.clienteEndereco, local: e.local || f.clienteNome, contato: e.contato || f.clienteContato })} style={{ color: C.accent }}>usar dados do cliente</button>
                  <button type="button" onClick={() => restanteNoLocal(k)} style={{ color: C.accent }}>pôr o restante aqui</button>
                  <button type="button" onClick={() => set("entregas", f.entregas.filter((_, j) => j !== k))} style={{ color: "#C77" }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <In label="Endereço" cls="col-span-2" value={e.endereco} onChange={(x) => upEnt(k, { endereco: x.target.value })} />
                <In label="Nome do local de entrega" cls="col-span-2" value={e.local} onChange={(x) => upEnt(k, { local: x.target.value })} />
                <In label="Resp. recebimento" value={e.responsavel} onChange={(x) => upEnt(k, { responsavel: x.target.value })} />
                <In label="Contato" value={e.contato} onChange={(x) => upEnt(k, { contato: x.target.value })} />
                <Campo label="Documento de entrega" cls="col-span-2">
                  <select value={e.documento || ""} onChange={(x) => upEnt(k, { documento: x.target.value })} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, background: C.panel }}>
                    <option value="">Selecione…</option>
                    {Object.entries(DOCS_ENTREGA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </Campo>
              </div>
              <FreteCampo v={e.frete} onChange={(x) => upEnt(k, { frete: x })} veVal={veVal} />
              <div className="text-xs mb-1" style={{ color: C.sub }}>Grade deste local</div>
              {itens.map((it, idx) => {
                const tams = it.grade.filter((g) => num(g.qtd) > 0);
                if (!tams.length) return null;
                return (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <span className="w-48 text-xs truncate" title={it.descricao}>{idx + 1}. {it.descricao || it.tipoPecaNome}</span>
                    <div className="flex gap-1 flex-wrap">
                      {tams.map((g) => (
                        <label key={g.tam} className="flex items-center gap-0.5 text-xs" style={{ color: C.sub }}>{g.tam}
                          <input value={e.grade?.[idx]?.[g.tam] || ""} onChange={(x) => upEntGrade(k, idx, g.tam, x.target.value)} className="w-12 px-1 py-0.5 rounded outline-none text-center text-sm" style={{ ...inp, background: C.panel }} />
                        </label>
                      ))}
                    </div>
                    <span className="text-xs ml-auto" style={{ color: C.sub }}>{tams.reduce((s, g) => s + num(e.grade?.[idx]?.[g.tam]), 0)} pç</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="button" onClick={novaEntrega} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Local de entrega</button>
            {confEnt.ok ? <span className="text-sm font-semibold" style={{ color: C.green }}>✓ A soma das entregas bate com o pedido ({totalPecas} pç)</span>
              : <span className="text-sm" style={{ color: C.red }}>✗ {confEnt.semLocais ? "Cadastre os locais de entrega." : confEnt.itens.map((x) => `item ${x.idx + 1}: ${Object.entries(x.dif).map(([t, d]) => `${t} ${d > 0 ? "falta " + d : "sobra " + -d}`).join(", ")}`).join(" · ")}</span>}
          </div>
        </>}
      </Card>}

      {/* ---------- v747 — Venda comissionada ---------- */}
      {!f.interno && veVal && <DescontoCard f={f} set={set} totalItens={totalItens} descV={descV} podeLancar={podeLancar} />}
      {!f.interno && veVal && <ComissaoCard f={f} set={set} uid={uid} totalItens={totalItens - descV} podeLancar={podeLancar} />}

      {/* ---------- Pagamento ---------- */}
      
      {!f.interno ? veVal && (
        <Card titulo="Prazo de pagamento" extra={<span className="text-sm">Total do pedido <b style={{ color: C.accent }}>{money(totalGeral)}</b>{freteV > 0 && <span className="text-xs ml-1" style={{ color: C.sub }}>(com frete {money(freteV)})</span>}</span>}>
          <div className="flex gap-2 mb-3">
            {/* v814 — pagamento único: uma parcela só (100%), com as mesmas opções de prazo e base */}
            {!(f.pagamento?.parcelas || []).some((x) => x.unico) && <button type="button" onClick={async () => {
              if ((f.pagamento?.entrada || (f.pagamento?.parcelas || []).length) && !(await confirmar("Trocar a entrada e as parcelas por um pagamento único?"))) return;
              setPag(() => ({ entrada: null, parcelas: [{ dias: "30", tipo: "CORRIDOS", base: "NF", valor: "", unico: true }] }));
            }} className="px-3 py-1.5 rounded text-sm flex items-center gap-1 font-semibold" style={{ color: "#fff", background: "#001E41", border: "1px solid #001E41" }}><Plus size={14} /> Pagamento único</button>}
            {!f.pagamento?.entrada && <button type="button" onClick={() => setPag((p) => ({ ...p, parcelas: (p.parcelas || []).map(({ unico, ...y }) => y), entrada: { data: f.emissao, valor: "" } }))} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Inserir entrada</button>}
            <button type="button" onClick={() => setPag((p) => ({ ...p, parcelas: [...(p.parcelas || []).map(({ unico, ...y }) => y), { dias: "30", tipo: "CORRIDOS", base: "NF", valor: "" }] }))} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Inserir parcela</button>
          </div>
          {f.pagamento?.entrada && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className="w-24 font-semibold">Entrada</span>
              <input type="date" value={f.pagamento.entrada.data || ""} onChange={(e) => setPag((p) => ({ ...p, entrada: { ...p.entrada, data: e.target.value } }))} className="px-2 py-1 rounded outline-none text-sm" style={inp} />
              <ReaisPct x={f.pagamento.entrada} total={totalGeral} onChange={(patch) => setPag((p) => ({ ...p, entrada: { ...p.entrada, ...patch } }))} placeholder="valor" />
              <Restricao r={f.pagamento.entrada.restricao} onChange={(r) => setPag((p) => ({ ...p, entrada: { ...p.entrada, restricao: r } }))} />
              {calc.entrada && calc.entrada.data !== f.pagamento.entrada.data && <span className="text-xs" style={{ color: C.accent }}>vence {dataBR(calc.entrada.data)}</span>}
              <span className="text-xs" style={{ color: C.sub }}>vai para o contas a receber ao efetivar</span>
              <button type="button" onClick={() => setPag((p) => ({ ...p, entrada: null }))} style={{ color: "#C77" }}><Trash2 size={14} /></button>
            </div>
          )}
          {(f.pagamento?.parcelas || []).map((x, k) => {
            const c = calc.parcelas[k];
            return (
              <div key={k} className="flex items-center gap-2 mb-2 text-sm flex-wrap">
                <span className="w-24 font-semibold">{x.unico ? "Pagamento único" : `Parcela ${k + 1}`}</span>
                <input type="number" min="0" value={x.dias} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, dias: e.target.value } : y)) }))} className="w-16 px-2 py-1 rounded outline-none text-sm" style={inp} />
                <select value={x.tipo} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, tipo: e.target.value } : y)) }))} className="px-2 py-1 rounded outline-none text-sm" style={inp}>
                  <option value="CORRIDOS">dias corridos</option><option value="UTEIS">dias úteis</option>
                </select>
                <span style={{ color: C.sub }}>a contar da</span>
                <select value={x.base} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, base: e.target.value } : y)) }))} className="px-2 py-1 rounded outline-none text-sm" style={inp}>
                  {Object.entries(BASES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <ReaisPct x={x} total={totalGeral} auto={c} onChange={(patch) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, ...patch } : y)) }))} />
                <Restricao r={x.restricao} onChange={(r) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, restricao: r } : y)) }))} />
                {/* v773 — #66: o vencimento pode sempre ser editado à mão */}
                <span className="text-xs" style={{ color: C.sub }}>vence</span>
                <input type="date" value={c?.data || ""} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, dataFixa: e.target.value || null } : y)) }))}
                  className="px-2 py-1 rounded outline-none text-xs" style={{ ...inp, color: x.dataFixa ? C.accent : C.text }} title={x.dataFixa ? "Data definida à mão" : "Data calculada — altere para fixar outra"} />
                {x.dataFixa && <button type="button" onClick={() => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, dataFixa: null } : y)) }))} className="text-[11px] underline" style={{ color: C.sub }}>voltar ao cálculo</button>}
                <span className="text-xs" style={{ color: C.sub }}>{c?.data ? "· lança ao efetivar" : x.base === "ENTREGA" ? "lança no faturamento (pede a previsão de entrega)" : "lança no faturamento (data da NF)"}</span>
                <button type="button" onClick={() => setPag((p) => ({ ...p, parcelas: p.parcelas.filter((_, j) => j !== k) }))} style={{ color: "#C77" }}><Trash2 size={14} /></button>
              </div>
            );
          })}
          {(calc.entrada || calc.parcelas.length > 0) && (
            <div className="text-sm mt-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
              <span style={{ color: C.sub }}>Condição: </span><b>{textoCondicao(f.pagamento, totalGeral)}</b>
              <span className="ml-3" style={{ color: calc.ok ? C.green : C.red }}>{calc.ok ? "✓ fecha com o total" : `✗ diferença ${money(calc.dif)}`}</span>
            </div>
          )}
          <div className="text-xs mt-1" style={{ color: C.sub }}>Parcela sem valor divide igualmente o que sobra. Parcelas da emissão do pedido vão para o contas a receber ao efetivar; as da NF e da entrega, ao faturar.</div>
        </Card>
      ) : <Card titulo="Prazo de pagamento"><div className="text-sm" style={{ color: C.sub }}>Pedido interno: não gera contas a receber — entra só nos dados gerenciais (peças produzidas etc.).</div></Card>}

      {/* ---------- NF ---------- */}
      <Card titulo="Observações da NF">
        <textarea value={f.nfObs} onChange={(e) => set("nfObs", e.target.value)} rows={2} placeholder="texto adicional para a NF (o nº do pedido e a OC do cliente entram sozinhos)" className="w-full px-3 py-2 rounded outline-none text-sm mb-2" style={inp} />
        <div className="flex items-start gap-2 rounded px-3 py-2 text-sm" style={{ background: C.panel2 }}>
          <div className="flex-1"><span className="text-xs" style={{ color: C.sub }}>Sai na NF: </span><b>{obsNf}</b></div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(textoObsNf({ numero: f.numero || proximo, oc: f.oc, nfObs: f.nfObs }))} title="Copiar" style={{ color: C.accent }}><Copy size={15} /></button>
        </div>
      </Card>
      </fieldset>

      <div className="mt-2 flex justify-end text-sm" style={{ color: C.sub }}>
        Total do pedido: <b className="ml-2" style={{ color: C.accent }}>{totalPecas} peças{veVal ? ` · ${money(totalGeral)}` : ""}</b>
        {veVal && (freteV > 0 || descV > 0) && <span className="ml-2 text-xs" style={{ color: C.sub }}>(itens {money(totalItens)}{descV > 0 ? ` − desconto ${money(descV)}` : ""}{freteV > 0 ? ` + frete ${money(freteV)}` : ""})</span>}
      </div>

      {/* ---------- modais ---------- */}
      {fppModal != null && <FppBusca api={api} cliente={f.clienteNome} item={itens[fppModal]} veVal={veVal} onPick={(rf) => indexarFpp(fppModal, rf)} onFechar={() => setFppModal(null)} />}
      {fat && (
        <Modal titulo={`Faturar pedido ${f.numero}`} onFechar={() => setFat(null)} largura={460}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <In label="Nº da NF" upper={false} value={fat.nf} onChange={(e) => setFat({ ...fat, nf: e.target.value })} />
            <In label="Emissão da NF" type="date" upper={false} value={fat.emissaoNf} onChange={(e) => setFat({ ...fat, emissaoNf: e.target.value })} />
            {(precisaEntrega || fat.pedirEntrega) && <In label="Previsão de entrega" cls="col-span-2" type="date" upper={false} value={fat.entrega} onChange={(e) => setFat({ ...fat, entrega: e.target.value })} />}
          </div>
          {precisaEntrega && <div className="text-xs mb-3" style={{ color: C.sub }}>Há parcelas contadas da data de entrega: elas vencem a partir desta previsão.</div>}
          <div className="text-xs mb-3" style={{ color: C.sub }}>Lança no contas a receber as parcelas contadas da NF e da entrega. Obs. da NF: <b>{obsNf}</b></div>
          <div className="flex justify-end"><button type="button" onClick={faturar} disabled={salvando || !fat.nf} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: C.blue, color: "#fff", opacity: salvando || !fat.nf ? 0.5 : 1 }}>Faturar e lançar parcelas</button></div>
        </Modal>
      )}
      {resultado && (
        <Modal titulo={resultado.ok ? (resultado.rascunho ? "Rascunho salvo" : resultado.faturado ? "Pedido faturado" : `Pedido ${resultado.numero} efetivado`) : "Falta acertar antes de efetivar"} onFechar={() => setResultado(null)} largura={520}>
          {(resultado.erros || []).map((e, k) => <div key={k} className="text-sm mb-1" style={{ color: C.red }}>✗ {e}</div>)}
          {(resultado.lancadas || []).length > 0 && <div className="mb-2"><div className="text-xs mb-1" style={{ color: C.sub }}>Lançado no contas a receber</div>
            {resultado.lancadas.map((l, k) => <div key={k} className="text-sm">✓ {l.tipo} · {money(l.valor)} · vence {dataBR(l.data)}</div>)}</div>}
          {f.servico ? <div className="text-sm mb-2">✓ Pedido de serviço lançado (não passa por Compras).</div>
            : <div className="text-sm mb-2">{(resultado.compras || []).length > 0 && <>✓ {resultado.compras.length} item(ns) com FPP enviados direto ao <b>levantamento</b> de Compras. </>}
                {itens.length - (resultado.compras || []).length > 0 && <>⚠ {itens.length - (resultado.compras || []).length} item(ns) sem FPP ficam na <b>Sincronização de pedidos</b> para indexar a FPP.</>}</div>}
          {resultado.nfObs && <div className="text-sm mb-2"><span className="text-xs" style={{ color: C.sub }}>Obs. da NF: </span><b>{resultado.nfObs}</b></div>}
          {(resultado.avisos || []).map((e, k) => <div key={k} className="text-xs mb-1" style={{ color: C.yellow }}>⚠ {e}</div>)}
          <div className="flex justify-end mt-3"><button type="button" onClick={() => setResultado(null)} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>OK</button></div>
        </Modal>
      )}
      {/* v815 — salvar rascunho e gerar pedido também no fim da página (canto inferior direito) */}
      {podeLancar && <div className="flex justify-end gap-2 mt-2 mb-6">
        {!efetivado && <button onClick={salvarRascunho} disabled={salvando} title="Salva com o número reservado, fora da produção e dos indicadores" className="px-5 py-2.5 rounded font-semibold text-sm" style={{ background: C.panel, color: C.yellow, border: `1px solid ${C.yellow}`, opacity: salvando ? 0.6 : 1 }}>
          Salvar rascunho</button>}
        <button onClick={efetivar} disabled={salvando} className="px-5 py-2.5 rounded font-semibold text-sm" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Salvando…" : efetivado ? "Salvar alterações" : "Gerar pedido"}</button>
      </div>}
    </div>
  );
}

function FppBusca({ api, cliente, item, veVal, onPick, onFechar }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(null);
  const timer = useRef(null);
  const buscar = (t) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api(`/api/pp/catalogo?fpp=${encodeURIComponent(t)}&cliente=${encodeURIComponent(cliente || "")}`).then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d : [])).catch(() => setLista([])), 200);
  };
  useEffect(() => { buscar(""); }, []);
  return (
    <Modal titulo={`Indexar FPP · ${item?.descricao || "item"}`} onFechar={onFechar} largura={720}>
      <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); buscar(e.target.value); }} placeholder="nº da FPP, item, nome comercial ou cliente…" className="w-full px-3 py-2 rounded outline-none text-sm mb-3" style={inp} />
      {!q && cliente && <div className="text-xs mb-2" style={{ color: C.sub }}>FPPs do cliente {cliente}:</div>}
      {lista == null ? <div className="text-sm" style={{ color: C.sub }}>Buscando…</div> : !lista.length ? <div className="text-sm" style={{ color: C.sub }}>Nenhuma FPP encontrada.</div> : lista.map((rf) => (
        <button key={rf.id} type="button" onClick={() => onPick(rf)} className="w-full text-left rounded px-3 py-2 mb-1 text-sm" style={{ border: `1px solid ${C.line}` }}>
          <div><b style={{ color: C.accent }}>FPP {numFpp(rf.numero)}</b> · <b>{rf.nomeComercial || rf.item}</b> <span style={{ color: C.sub }}>· {rf.item}{rf.cliente ? ` · ${rf.cliente}` : ""}</span>
            {veVal && rf.valorProposto ? <span className="float-right" style={{ color: C.accent }}>{money(rf.valorProposto)}</span> : null}</div>
          <div className="text-xs" style={{ color: C.sub }}>{tecidoDoResumo(rf).join(" · ")}</div>
        </button>
      ))}
    </Modal>
  );
}
