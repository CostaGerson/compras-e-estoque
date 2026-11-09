"use client";
// v595 — Lançamento de pedido sem o KM: tipo (venda/interno), nº automático, cliente por nome ou CNPJ, prazo de entrega → despacho,
// itens do cadastro do KM + FPP indexada (artigo e rendimento), entregas única/fracionada/terceiros com grade por local,
// prazo de pagamento (entrada + parcelas por emissão / NF / entrega), obs da NF e anexos por arraste.
import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Printer, Paperclip, FileText, X, Copy, Search, Wand2, RotateCcw } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import DadosUnitarios from "./dadosUnitarios";
import { ClienteFinalResumo } from "./clienteFinal";   // v709 — cliente final e envio (pedido do portal)   // v699 — dados por peça (nome, tipo sanguíneo…) e link para o cliente preencher
import { imprimirPedido } from "./impressaoPedido";   // v615 — PP (sem valores) e PV (com valores)
import { pecaParaItem, condicaoParaPagamento, prazoParaDias, corNaFpp } from "@/lib/lancamentoSkill";   // v696
import {
  num, hojeISO, dataBR, somaDias, qtdGrade, conferirEntregas, parcelasCalc, textoCondicao, textoObsNf, MODOS_ENTREGA, DOCS_ENTREGA, BASES,
  paramFora, tecidoDaFpp, numFpp,
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
export function GradeEditor({ grade, tamanhos, onChange }) {
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
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(linhas.length, 7)}, minmax(0, 1fr))` }}>
              {linhas.map((g) => (
                <div key={g.tam} className="rounded-lg px-1 pt-1 pb-0.5 text-center" style={{ background: C.panel2, border: `1px solid ${num(g.qtd) ? C.accent : C.line}` }}>
                  <div className="text-[11px] font-semibold" style={{ color: C.sub }}>{k === "BL" ? g.tam.slice(3) : g.tam}</div>
                  {/* v672 — sem a barrinha piscando (digitar substitui o número) e botões – / + maiores */}
                  <input value={g.qtd} onChange={(e) => up(g.tam, e.target.value.replace(/[^\d]/g, ""))} onFocus={(e) => e.target.select()} inputMode="numeric" placeholder="0"
                    className="w-full bg-transparent outline-none text-center text-lg font-bold" style={{ color: num(g.qtd) ? C.text : "#98A2B3", caretColor: "transparent" }} />
                  <div className="flex justify-between gap-1 pb-0.5">
                    <button type="button" onClick={() => passo(g, -1)} className="flex-1 flex items-center justify-center rounded-md text-lg font-bold leading-none select-none" style={{ height: 28, color: C.sub, background: "#fff", border: `1px solid ${C.line}` }}>–</button>
                    <button type="button" onClick={() => passo(g, 1)} className="flex-1 flex items-center justify-center rounded-md text-lg font-bold leading-none select-none" style={{ height: 28, color: "#fff", background: C.accent }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {faltam.length > 0 && <div className="relative inline-block">
        <button type="button" onClick={() => setMenu(!menu)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.accent, border: `1px dashed ${C.accent}` }}><Plus size={12} /> Inserir grade especial</button>
        {menu && <div className="absolute z-20 mt-1 rounded-md shadow-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          {faltam.map((k) => <button key={k} type="button" onClick={() => inserir(k)} className="block w-full text-left px-3 py-1.5 text-sm whitespace-nowrap hover:bg-gray-50" style={{ color: C.text }}>{G[k].rot}</button>)}
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
function Card({ titulo, extra, children }) {
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
  pagamento: { entrada: null, parcelas: [] }, status: "EM_LANCAMENTO", efetivadoEm: null,
  arquivoPcPdf: "", arquivoLancPdf: "", arquivoPedidoPdf: "", arquivoOpPdf: "",
});

export default function PedidoEditor({ ppId: ppId0, onVoltar, podeLancar = true, veVal = true, uid, componentes, tamanhos, imprimir }) {
  const TIPOS = Object.keys(componentes);
  const novoItem = () => ({ tipoPecaNome: "",   // v631 — sem pré-preenchimento: o vendedor escolhe
    codigo: "", descricao: "", valorUnitario: "", grade: tamanhos.map((t) => ({ tam: t, qtd: "" })), parametros: {}, fotoBase64: "", fppId: null, fppNumero: null, fpp: null });
  // v614 — pedido de serviço: item = tipo de serviço (texto livre) · quantidade · valor unitário (total calculado)
  const novoServico = () => ({ tipoPecaNome: "SERVIÇO", codigo: "", descricao: "", valorUnitario: "", quantidade: "", grade: [], parametros: {}, fotoBase64: "", fppId: null, fppNumero: null, fpp: null });
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
        clienteCnpj: fmtCnpj(d.clienteCnpj), servico: d.tipoPedido === "SERVIÇO",
      });
      setRecDet(!!d.recebendoDetalhes);
      setClienteFinal(d.clienteFinal || null);
      const its = (d.itens || []).map((it) => {
        let par = {}; try { par = it.parametrosJson ? JSON.parse(it.parametrosJson) : {}; } catch {}
        let grade = []; try { grade = it.gradeJson ? JSON.parse(it.gradeJson) : []; } catch {}
        const tams = new Set(grade.map((g) => g.tam));
        if (d.tipoPedido === "SERVIÇO") return { ...novoServico(), descricao: it.descricao || "", valorUnitario: it.valorUnitario != null ? String(it.valorUnitario).replace(".", ",") : "",
          quantidade: String(grade.reduce((q, g) => q + (Number(g.qtd) || 0), 0) || "").replace(".", ",") };
        return { tipoPecaNome: TIPOS.includes(it.tipoPecaNome) ? it.tipoPecaNome : (tipoPeca(it.descricao, TIPOS) || ""), codigo: it.codigo || "", descricao: it.descricao || "",
          valorUnitario: it.valorUnitario != null ? String(it.valorUnitario).replace(".", ",") : "",
          grade: [...grade.filter((g) => num(g.qtd) > 0 || secaoTam(g.tam) !== "MASC" || tamanhos.includes(g.tam)), ...tamanhos.filter((t) => !tams.has(t)).map((t) => ({ tam: t, qtd: "" }))],
          parametros: Object.fromEntries(Object.entries(par).filter(([k]) => !paramFora(k))), fotoBase64: it.fotoBase64 || "", fppId: it.fppId || null, fppNumero: it.fppNumero ?? null, fpp: null,
          anexos: Array.isArray(it.anexosJson) ? it.anexosJson : [],   // v650
          dadosUnitarios: it.dadosUnitarios && Array.isArray(it.dadosUnitarios.campos) ? it.dadosUnitarios : null,   // v699
          itemPadraoId: it.itemPadraoId || null, valorVenda: it.valorVenda != null ? String(it.valorVenda) : "" };   // v711 — portal: mantém ao salvar aqui
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
  const totalGeral = itens.reduce((s, it) => s + totalItem(it), 0);
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
    const params = Object.fromEntries((p.parametros || []).filter((x) => x.v && !paramFora(x.t)).map((x) => [x.t, x.v]));
    if (it.parametros?.TECIDO && typeof it.parametros.TECIDO === "object") params.TECIDO = it.parametros.TECIDO;   // tecido da FPP fica
    return { ...it, codigo: p.codigo, descricao: p.descricao, tipoPecaNome: tipo, parametros: params,
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
  };
  // v647 — itens padrão do cliente: campo em destaque com autocompletar; o item escolhido entra preenchido (nome NF, preço, parâmetros, foto, FPP)
  const [padroes, setPadroes] = useState([]);
  const [buscaPadrao, setBuscaPadrao] = useState("");
  const clienteIdSel = (() => { const d = dig(f.clienteCnpj); return d ? clientes.find((c) => dig(c.cnpj) === d)?.id || null : null; })();
  useEffect(() => {
    if (!clienteIdSel) { setPadroes([]); return; }
    fetch(`/api/itens-padrao?cliente=${clienteIdSel}`).then((r) => r.json()).then((d) => setPadroes(Array.isArray(d) ? d : [])).catch(() => setPadroes([]));
  }, [clienteIdSel]);
  const usarPadrao = async (p) => {
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
    setItens((arr) => { const k = arr.findIndex((it) => !String(it.descricao || "").trim() && !String(it.codigo || "").trim() && !qtdGrade(it.grade)); return k >= 0 ? arr.map((it, j) => (j === k ? item : it)) : [...arr, item]; });
    setBuscaPadrao("");
    if (d.critica) alerta(`Atenção: o preço praticado (${money(d.critica.preco)}) está diferente do valor de venda da FPP ${numFpp(d.fppNumero)} (${money(d.critica.fpp)}).`);
  };
  const opPadrao = (() => { const t = norm(buscaPadrao); if (!t) return padroes.slice(0, 12); const pal = t.split(/\s+/).filter(Boolean); return padroes.filter((p) => pal.every((w) => norm([p.nomeInterno, p.nomeNf, p.codigo].join(" ")).includes(w))).slice(0, 12); })();
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
      if (!it.fotoBase64) av.push(`Item ${i + 1}: sem layout — ao efetivar, vira tarefa para o arte-finalista.`);
      if (veVal && it.fpp?.valorProposto && Math.abs(num(it.valorUnitario) - Number(it.fpp.valorProposto)) > 0.009) av.push(`Item ${i + 1}: valor unitário ${money(num(it.valorUnitario))} diferente do valor da FPP ${numFpp(it.fppNumero)} (${money(it.fpp.valorProposto)}).`);
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
    anexos: anexos.map((a) => (a.id ? { id: a.id, categoria: a.categoria } : a)),
  });
  const salvar = async () => {
    const r = await api(ppId ? `/api/pp/${ppId}` : "/api/pp", { method: ppId ? "PUT" : "POST", body: JSON.stringify(payload()) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Erro ao salvar.");
    if (!ppId) setPpId(d.id);
    // anexos novos passam a ter id: recarrega a lista (sem o conteúdo)
    const atual = await api(`/api/pp/${d.id}`).then((x) => x.json()).catch(() => null);
    if (atual?.anexos) setAnexos(atual.anexos);
    return d.id;
  };
  const salvarRascunho = async () => {
    setSalvando(true);
    try { await salvar(); setResultado({ ok: true, rascunho: true }); } catch (e) { alerta(e.message); }
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
          <button onClick={onVoltar} className="text-sm" style={{ color: C.sub }}>← Voltar</button>
          <span className="text-lg font-bold">Pedido {numeroExib || "—"}{!f.numero && numeroExib ? <span className="text-xs font-normal ml-1" style={{ color: C.sub }}>(prévia — número gravado ao efetivar)</span> : null}</span>
          <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: badge[1], border: `1px solid ${badge[1]}` }}>{badge[0]}</span>
          {f.interno && <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: C.panel2, color: C.sub }}>INTERNO</span>}
          {f.servico && <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: C.panel2, color: C.sub }}>SERVIÇO</span>}
        </div>
        <div className="flex gap-2">
          {!f.servico && <button onClick={() => imprimirAgora("PP")} title="Ordem de produção — sem valores" className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}><Printer size={16} /> Imprimir OP</button>}
          {veVal && <button onClick={() => imprimirAgora("PV")} title="Pedido de venda — com valores" className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}><Printer size={16} /> Imprimir PV</button>}
          {/* v705 — resetar: limpa o pedido em lançamento (cliente, itens, anexos, prazos); o rascunho salvo só muda ao salvar de novo */}
          {podeLancar && !efetivado && <button onClick={async () => {
            if (!(await confirmar("Resetar o pedido? Cliente, itens (com grades e personalização exclusiva), anexos, prazo e pagamento são apagados da tela." + (ppId ? "\n\nO rascunho salvo só muda quando você salvar de novo." : "")))) return;
            setF((s) => ({ ...vazioF(), numero: s.numero, emissao: hojeISO() })); setItens([novoItem()]); setAnexos([]);
          }} title="Limpa tudo e começa o pedido de novo" className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ background: C.panel, color: C.red, border: `1px solid ${C.line}` }}><RotateCcw size={14} /> Resetar pedido</button>}
          {podeLancar && !efetivado && <button onClick={salvarRascunho} disabled={salvando} className="px-3 py-2 rounded text-sm" style={{ background: C.panel, color: C.accent, border: `1px solid ${C.accent}` }}>Salvar rascunho</button>}
          {podeLancar && <button onClick={efetivar} disabled={salvando} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando…" : efetivado ? "Salvar alterações" : "Efetivar lançamento"}</button>}
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
          <In label="Vendedor" value={f.vendedor} onChange={(e) => set("vendedor", e.target.value)} />
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
              <span className="text-sm" style={{ color: despacho ? C.text : C.sub }}>→ despacho <b style={{ color: C.accent }}>{despacho ? `${dataBR(despacho)} (${diaSem(despacho)})` : "—"}</b></span>
            </div>
          </Campo>
          <Campo label="Observações internas" cls="col-span-4">
            <textarea value={f.obs} onChange={(e) => set("obs", e.target.value)} rows={2} className="w-full px-3 py-2 rounded outline-none text-sm" style={inp} />
          </Campo>
        </div>
      </Card>

      {/* ---------- Itens ---------- */}
      {f.servico && <Card titulo="Serviços" extra={veVal && <span className="text-sm">Total <b style={{ color: C.accent }}>{money(totalGeral)}</b></span>}>
        <div className="grid gap-2 text-xs font-semibold mb-1" style={{ color: C.sub, gridTemplateColumns: "1fr 110px 140px 140px 28px" }}>
          <span>Tipo de serviço</span><span className="text-right">Quantidade</span>{veVal ? <><span className="text-right">Valor unit. (R$)</span><span className="text-right">Total</span></> : <><span /><span /></>}<span />
        </div>
        {itens.map((it, i) => (
          <div key={i} className="grid gap-2 items-center mb-2" style={{ gridTemplateColumns: "1fr 110px 140px 140px 28px" }}>
            <input value={it.descricao} onChange={(e) => upItem(i, { descricao: e.target.value })} placeholder="ex.: bordado de logo no peito, silk 2 cores, costura de faixa…" className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inp} />
            <input value={it.quantidade} onChange={(e) => upItem(i, { quantidade: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 rounded outline-none text-sm text-right" style={inp} />
            {veVal ? <>
              <input value={it.valorUnitario} onChange={(e) => upItem(i, { valorUnitario: e.target.value })} placeholder="0,00" className="w-full px-2 py-1.5 rounded outline-none text-sm text-right" style={inp} />
              <div className="text-right text-sm font-semibold" style={{ color: C.text }}>{money(totalItem(it))}</div>
            </> : <><span /><span /></>}
            {podeLancar && itens.length > 1 ? <button type="button" onClick={() => setItens((arr) => arr.filter((_, j) => j !== i))} style={{ color: "#C77" }}><Trash2 size={15} /></button> : <span />}
          </div>
        ))}
        {podeLancar && <button type="button" onClick={() => setItens((arr) => [...arr, novoServico()])} className="mt-1 px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Adicionar serviço</button>}
      </Card>}
      {!f.servico && podeLancar && padroes.length > 0 && (
        <div className="rounded-lg p-4 mb-4" style={{ background: C.accentSoft, border: `2px solid ${C.accent}` }}>
          <div className="flex items-center gap-2 mb-2"><Search size={16} style={{ color: C.accent }} /><span className="font-bold text-sm" style={{ color: C.accent }}>Itens padrão de {f.clienteNome || "este cliente"} ({padroes.length})</span>
            <span className="text-xs" style={{ color: C.sub }}>· digite o nome do item: os dados entram preenchidos (nome da NF, preço, parâmetros, layout e FPP)</span></div>
          <div style={{ position: "relative" }}>
            <input value={buscaPadrao} onChange={(e) => setBuscaPadrao(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && opPadrao[0]) { e.preventDefault(); usarPadrao(opPadrao[0]); } }}
              placeholder="nome interno, nome da NF ou código do item padrão…" className="w-full px-3 py-2.5 rounded outline-none text-base font-semibold" style={{ background: C.panel, border: `1px solid ${C.accent}`, textTransform: "uppercase" }} />
            {buscaPadrao && (
              <div style={{ position: "absolute", zIndex: 40, top: "100%", left: 0, right: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 300, overflowY: "auto" }}>
                {opPadrao.length ? opPadrao.map((p) => (
                  <button key={p.id} onMouseDown={(e) => { e.preventDefault(); usarPadrao(p); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
                    <b>{p.nomeInterno}</b><span style={{ color: C.sub }}>· NF: {p.nomeNf}{p.codigo ? ` · ${p.codigo}` : ""}</span>
                    <span className="ml-auto" style={{ color: C.text }}>{veVal && p.precoAtual != null ? money(p.precoAtual) : ""}</span>
                    {p.critica && <span className="text-[10px] font-bold" style={{ color: C.red }}>≠ FPP</span>}
                  </button>
                )) : <div className="px-3 py-2 text-sm" style={{ color: C.sub }}>Nenhum item padrão com esse nome.</div>}
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
          <Card key={i} titulo={`Item ${i + 1}`} extra={podeLancar && <button type="button" onClick={() => setItens((arr) => arr.filter((_, j) => j !== i))} style={{ color: "#C77" }}><Trash2 size={16} /></button>}>
            <div className="grid grid-cols-6 gap-3 mb-3">
              <Campo label="Tipo de peça">
                <select value={it.tipoPecaNome} onChange={(e) => upItem(i, { tipoPecaNome: e.target.value })} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inp, ...(it.tipoPecaNome ? {} : { color: C.sub }) }}>
                  <option value="" disabled>Selecione…</option>
                  {TIPOS.map((t) => <option key={t} value={t} style={{ color: C.text }}>{t}</option>)}
                </select>
              </Campo>
              {/* v668 — código do KM de volta: ao digitar, busca o item e puxa as informações técnicas */}
              <Campo label="Código (cadastro do KM)">
                <Auto value={it.codigo} onChange={(v) => upItem(i, { codigo: v })} buscar={buscarItemKm} onPick={(p) => pickItemKm(i, p)} placeholder="código…" exato="codigo"
                  render={(p) => <span><b>{p.codigo}</b> <span style={{ color: C.sub }}>· {p.descricao}{p.parametros?.length ? ` · ${p.parametros.length} parâmetros` : ""}</span></span>} />
              </Campo>
              <Campo label="Descrição do produto · busca no cadastro do KM" cls="col-span-3">
                <Auto value={it.descricao} onChange={(v) => upItem(i, { descricao: v })} buscar={buscarItemKm} onPick={(p) => pickItemKm(i, p)} placeholder="digite para buscar o item…"
                  render={(p) => <span><b>{p.descricao}</b> <span style={{ color: C.sub }}>· {p.codigo}{p.parametros?.length ? ` · ${p.parametros.length} parâmetros` : ""}</span></span>} />
              </Campo>
              {veVal ? <In label="Valor unitário (R$)" upper={false} value={it.valorUnitario} onChange={(e) => upItem(i, { valorUnitario: e.target.value })} placeholder="0,00" /> : <div />}
            </div>

            {/* FPP */}
            <div className="rounded px-3 py-2 mb-3 text-sm flex items-center gap-3 flex-wrap" style={{ background: it.fppId ? C.greenSoft : C.accentSoft, border: `1px solid ${it.fppId ? C.green : C.accent}55` }}>
              {it.fppId ? <>
                <span className="font-semibold" style={{ color: C.green }}>FPP {numFpp(it.fppNumero)}</span>
                <span style={{ color: C.text }}>{it.fpp ? `${it.fpp.nomeComercial || it.fpp.item}${it.fpp.cliente ? " · " + it.fpp.cliente : ""}` : ""}</span>
                {it.fpp && <span style={{ color: C.sub }}>· {it.fpp.tecidoTipo} · {it.fpp.artigo || "sem artigo"}{it.fpp.medida ? ` · ${it.fpp.medida}` : ""}{it.fpp.forro ? ` · forro ${it.fpp.forro}` : ""}</span>}
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
              <div className="w-36 shrink-0">
                <div className="text-xs mb-1" style={{ color: it.fotoBase64 ? C.sub : C.accent }}>Layout da peça{it.fotoBase64 ? "" : " (obrigatório)"}</div>
                <label className="block rounded cursor-pointer overflow-hidden relative" style={{ border: `1px dashed ${C.line}`, height: 136, background: C.panel2 }}>
                  {/* v673 — remover o layout direto na imagem */}
                  {it.fotoBase64 && podeLancar && <button type="button" title="Remover layout" onClick={(e) => { e.preventDefault(); e.stopPropagation(); upItem(i, { fotoBase64: "" }); }}
                    className="absolute top-1 right-1 z-10 flex items-center justify-center rounded-full shadow" style={{ width: 26, height: 26, background: "#fff", color: C.red, border: `1px solid ${C.line}` }}><Trash2 size={14} /></button>}
                  {it.fotoBase64 ? <img src={it.fotoBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <div className="flex items-center justify-center h-full text-xs text-center px-2" style={{ color: C.sub }}>Clique para adicionar o layout<br/><span style={{ fontSize: 10 }}>sem layout → tarefa para o arte finalista</span></div>}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upItem(i, { fotoBase64: await readB64(file) }); }} />
                </label>
                {it.fotoBase64 && podeLancar && <button type="button" onClick={() => upItem(i, { fotoBase64: "" })} className="text-xs mt-1 flex items-center gap-1 font-semibold" style={{ color: C.red }}><Trash2 size={12} /> remover layout</button>}
                {/* v650 — arquivos do item (além da foto): saem na OP abaixo dos detalhes do item */}
                <div className="mt-2" style={{ width: 120 }}>
                  <label className="block text-[11px] text-center px-1 py-1 rounded cursor-pointer" style={{ border: `1px dashed ${C.accent}`, color: C.accent }}>
                    <Paperclip size={11} className="inline mr-0.5" />Arquivos do item
                    <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => { const fs = Array.from(e.target.files || []); const add = await Promise.all(fs.map(async (x) => ({ nome: x.name, mime: x.type || null, base64: await readB64(x) }))); upItem(i, { anexos: [...(it.anexos || []), ...add] }); e.target.value = ""; }} />
                  </label>
                  {(it.anexos || []).map((a, k) => (
                    <div key={k} className="flex items-center gap-1 text-[11px] mt-1">
                      <button type="button" onClick={() => { const w = window.open(); if (w) w.document.write(/pdf/i.test(a.mime || a.nome) ? `<iframe src="${a.base64}" style="border:0;width:100%;height:100%"></iframe>` : `<img src="${a.base64}" style="max-width:100%"/>`); }} className="truncate flex-1 text-left" style={{ color: C.text }} title={a.nome}>{a.nome}</button>
                      <button type="button" onClick={() => upItem(i, { anexos: it.anexos.filter((_, j) => j !== k) })} style={{ color: "#C77" }}><X size={11} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs mb-1" style={{ color: C.sub }}>Grade · total {somaItem(it)} pç{veVal ? ` · ${money(totalItem(it))}` : ""}
                  {it.fpp?.leadTime > 0 && <span className="ml-2 px-1.5 py-0.5 rounded font-semibold" style={{ background: C.accentSoft, color: C.accent }} title="Lead time da FPP, contado da emissão do pedido">entrega prevista {dataBR(somaDias(f.emissao || hojeISO(), it.fpp.leadTime, "CORRIDOS"))} · lead time {it.fpp.leadTime} dias</span>}</div>
                <GradeEditor grade={it.grade} tamanhos={tamanhos} onChange={(grade) => upItem(i, { grade })} />
                {/* v699 — dado unitário: lista peça a peça (colada, digitada ou pelo link do cliente) */}
                <DadosUnitarios du={it.dadosUnitarios || null} onChange={(v) => upItem(i, { dadosUnitarios: v })} grade={it.grade} onGrade={(grade) => upItem(i, { grade })}
                  tamanhos={tamanhos} uid={uid} titulo={[f.clienteNome, it.descricao].filter(Boolean).join(" · ") || "PEDIDO"} clienteNome={f.clienteNome}
                  ppId={!efetivado ? ppId : null} itemIdx={i} onLinkCriado={(du) => gravarLink(i, du)}
                  semLinkTxt={efetivado ? "Pedido já enviado para a produção: não recebe detalhes pelo link." : undefined}
                  onReplicarItens={itens.length > 1 ? () => setItens((arr) => arr.map((x, j) => (j === i ? x : { ...x, dadosUnitarios: { ...(x.dadosUnitarios || {}), campos: it.dadosUnitarios.campos.map((c) => ({ ...c })), linhas: x.dadosUnitarios?.linhas || [] } }))) : null} />
                <div className="mb-3" />
                <div className="text-xs mb-1" style={{ color: C.sub }}>Parâmetros de produção — {it.tipoPecaNome}</div>
                <div className="grid grid-cols-2 gap-2">
                  {[...comps, ...extras].map((comp) => comp === "TECIDO" ? (
                    <div key={comp} className="col-span-2 flex items-center gap-2">
                      <span className="w-40 text-sm" style={{ color: C.sub }}>TECIDO</span>
                      {tec ? <div className="flex-1 px-2 py-1 rounded text-sm" style={{ background: C.greenSoft, color: C.text }} title="vem da FPP">
                        <b>{tec.tipo}</b> · {tec.artigo || "—"}{tec.medida ? ` · ${tec.medida}` : ""}{tec.forro ? ` · forro ${tec.forro}` : ""} <span className="text-xs" style={{ color: C.green }}>(FPP {numFpp(tec.fpp)})</span>
                      </div> : <input value={typeof it.parametros?.TECIDO === "string" ? it.parametros.TECIDO : ""} onChange={(e) => upParam(i, "TECIDO", e.target.value)} placeholder="indexe a FPP para trazer artigo e rendimento"
                        className="flex-1 px-2 py-1 rounded outline-none text-sm" style={inp} />}
                    </div>
                  ) : (
                    <div key={comp} className="flex items-center gap-2">
                      <span className="w-40 text-sm truncate" style={{ color: C.sub }} title={comp}>{comp}</span>
                      <input value={it.parametros?.[comp] || ""} onChange={(e) => upParam(i, comp, e.target.value)} className="flex-1 px-2 py-1 rounded outline-none text-sm" style={inp} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
        {f.entregaModo === "UNICA" ? <div className="text-sm" style={{ color: C.sub }}>Entrega no endereço do cliente, com a grade inteira do pedido.</div> : <>
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

      {/* ---------- Pagamento ---------- */}
      
      {!f.interno ? veVal && (
        <Card titulo="Prazo de pagamento" extra={<span className="text-sm">Total do pedido <b style={{ color: C.accent }}>{money(totalGeral)}</b></span>}>
          <div className="flex gap-2 mb-3">
            {!f.pagamento?.entrada && <button type="button" onClick={() => setPag((p) => ({ ...p, entrada: { data: f.emissao, valor: "" } }))} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Inserir entrada</button>}
            <button type="button" onClick={() => setPag((p) => ({ ...p, parcelas: [...(p.parcelas || []), { dias: "30", tipo: "CORRIDOS", base: "NF", valor: "" }] }))} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Plus size={14} /> Inserir parcela</button>
          </div>
          {f.pagamento?.entrada && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className="w-24 font-semibold">Entrada</span>
              <input type="date" value={f.pagamento.entrada.data || ""} onChange={(e) => setPag((p) => ({ ...p, entrada: { ...p.entrada, data: e.target.value } }))} className="px-2 py-1 rounded outline-none text-sm" style={inp} />
              <input value={f.pagamento.entrada.valor} onChange={(e) => setPag((p) => ({ ...p, entrada: { ...p.entrada, valor: e.target.value } }))} placeholder="valor R$" className="w-32 px-2 py-1 rounded outline-none text-sm" style={inp} />
              {totalGeral > 0 && num(f.pagamento.entrada.valor) > 0 && <span className="text-xs" style={{ color: C.sub }}>{Math.round(num(f.pagamento.entrada.valor) / totalGeral * 1000) / 10}%</span>}
              <span className="text-xs" style={{ color: C.sub }}>vai para o contas a receber ao efetivar</span>
              <button type="button" onClick={() => setPag((p) => ({ ...p, entrada: null }))} style={{ color: "#C77" }}><Trash2 size={14} /></button>
            </div>
          )}
          {(f.pagamento?.parcelas || []).map((x, k) => {
            const c = calc.parcelas[k];
            return (
              <div key={k} className="flex items-center gap-2 mb-2 text-sm flex-wrap">
                <span className="w-24 font-semibold">Parcela {k + 1}</span>
                <input type="number" min="0" value={x.dias} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, dias: e.target.value } : y)) }))} className="w-16 px-2 py-1 rounded outline-none text-sm" style={inp} />
                <select value={x.tipo} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, tipo: e.target.value } : y)) }))} className="px-2 py-1 rounded outline-none text-sm" style={inp}>
                  <option value="CORRIDOS">dias corridos</option><option value="UTEIS">dias úteis</option>
                </select>
                <span style={{ color: C.sub }}>a contar da</span>
                <select value={x.base} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, base: e.target.value } : y)) }))} className="px-2 py-1 rounded outline-none text-sm" style={inp}>
                  {Object.entries(BASES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <input value={x.valor} onChange={(e) => setPag((p) => ({ ...p, parcelas: p.parcelas.map((y, j) => (j === k ? { ...y, valor: e.target.value } : y)) }))} placeholder={c ? `auto ${money(c.valor)}` : "valor"} className="w-36 px-2 py-1 rounded outline-none text-sm" style={inp} />
                <span className="text-xs" style={{ color: C.sub }}>{c?.data ? `vence ${dataBR(c.data)} · lança ao efetivar` : x.base === "ENTREGA" ? "lança no faturamento (pede a previsão de entrega)" : "lança no faturamento (data da NF)"}</span>
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
          <div className="text-xs" style={{ color: C.sub }}>{rf.tecidoTipo} · {rf.artigo || "sem artigo"}{rf.medida ? ` · ${rf.medida}` : ""}{rf.forro ? ` · forro ${rf.forro}` : ""}</div>
        </button>
      ))}
    </Modal>
  );
}
