"use client";
// RH (Lorraine) — Meridian e NORT:
//  · Matriz de pessoal: a parte de pessoal da Matriz de custos oficial (editar, admitir, desligar) — o financeiro acompanha na hora
//  · Carômetro: um card por funcionário com dados e documentos
//  · Financeiro: folhas, guias, iFood, rescisões… com a mesma análise e o mesmo vínculo com o contas a pagar
//  · Calendário de obrigações: folha até o 3º dia útil, adiantamento e impostos até o dia 17
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Users2, Contact as IdCard, FileText, CalendarClock, ArrowLeft, Plus, Loader2, Search, UserPlus, UserMinus, Undo2,
  Trash2, Download, Upload, Camera, CheckCircle2, AlertTriangle, Clock, Pencil,
} from "lucide-react";
import { DocumentoModal, ModalContas as Modal, ValorContas as Valor, CoresContas as C } from "./contas";
import { DEPTOS, REGIMES } from "@/lib/matriz";

const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro na operação.");
  return j;
};
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(file); });
const readURL = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const inp = "w-full rounded px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
const nomeDepto = (k) => (DEPTOS.find(([d]) => d === k) || [k, k])[1];
const iniciais = (n) => String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("");
const EMPRESAS = [["TODAS", "Meridian e NORT"], ["MERIDIAN", "Meridian"], ["NORT", "NORT"]];
const TIPOS_DOC = ["RG", "CPF", "CTPS", "COMPROVANTE DE ENDEREÇO", "CONTRATO DE TRABALHO", "EXAME ADMISSIONAL", "EXAME PERIÓDICO", "EXAME DEMISSIONAL",
  "TERMO DE RESCISÃO", "FÉRIAS", "ATESTADO", "ADVERTÊNCIA", "CERTIFICADO", "OUTRO"];
const CAMPOS_FICHA = [
  ["cpf", "CPF"], ["rg", "RG"], ["pis", "PIS"], ["ctps", "CTPS"], ["nascimento", "Nascimento", "date"], ["telefone", "Telefone"],
  ["email", "E-mail"], ["endereco", "Endereço", "wide"], ["banco", "Banco"], ["agencia", "Agência"], ["conta", "Conta"], ["pix", "PIX"],
  ["emergenciaNome", "Contato de emergência"], ["emergenciaTelefone", "Telefone de emergência"], ["uniforme", "Tamanho de uniforme"], ["obs", "Observações", "wide"],
];

export default function Rh({ user }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [tela, setTela] = useState("inicio");
  const [aviso, setAviso] = useState("");
  const carregar = () => api(`/api/rh?u=${user.id}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const ok = (t) => { setAviso(t); setTimeout(() => setAviso(""), 6000); carregar(); };
  const ativos = (d?.pessoas || []).filter((p) => p.ativo !== false);
  const TITULOS = { matriz: "Matriz de pessoal", carometro: "Carômetro", financeiro: "Financeiro do RH" };

  return (
    <div>
      {tela !== "inicio" && (
        <div className="flex items-center gap-1 text-sm mb-4">
          <button onClick={() => setTela("inicio")} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}><ArrowLeft size={15} /> Voltar</button>
          <button onClick={() => setTela("inicio")} style={{ color: C.sub }}>RH</button>
          <span style={{ color: C.sub }}>›</span>
          <span className="font-semibold">{TITULOS[tela]}</span>
        </div>
      )}
      {aviso && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d ? <div className="flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          {(tela === "inicio" || tela === "financeiro") && <Calendario cal={d.calendario} />}
          {tela === "inicio" && (
            <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {[
                ["matriz", Users2, "Matriz de pessoal", `${ativos.length} ativos · ${ativos.filter((p) => p.empresa === "NORT").length} na NORT`, "Salários, benefícios, setor, admissão e desligamento — a Matriz do financeiro acompanha"],
                ["carometro", IdCard, "Carômetro", `${ativos.length} funcionários`, "Um card por funcionário com dados e documentos"],
                ["financeiro", FileText, "Financeiro", `${(d.envios || []).filter((e) => e.competencia === d.competencia).length} documento(s) neste mês`, "Folhas, guias de INSS e FGTS, iFood, rescisões e outros — direto no contas a pagar"],
              ].map(([k, Ico, t, sub, desc]) => (
                <button key={k} onClick={() => setTela(k)} className="text-left rounded-xl p-5 transition-shadow hover:shadow-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <Ico size={26} style={{ color: C.accent }} />
                  <div className="font-bold text-base mt-2" style={{ color: C.navy }}>{t}</div>
                  <div className="text-xs font-semibold mt-0.5" style={{ color: C.text }}>{sub}</div>
                  <div className="text-xs mt-1" style={{ color: C.sub }}>{desc}</div>
                </button>
              ))}
            </div>
          )}
          {tela === "matriz" && <MatrizPessoal user={user} d={d} onSalvo={ok} />}
          {tela === "carometro" && <Carometro user={user} d={d} onMudou={carregar} />}
          {tela === "financeiro" && <FinanceiroRH user={user} d={d} onSalvo={ok} />}
        </>
      )}
    </div>
  );
}

/* ---------------- calendário de obrigações ---------------- */
const COR_ST = { OK: [C.green, C.greenSoft, "Enviado"], ATRASADO: [C.red, C.redSoft, "Atrasado"], VENCENDO: [C.yellow, C.yellowSoft, "Vence já"], PENDENTE: [C.blue, C.blueSoft, "Pendente"] };
function Calendario({ cal }) {
  if (!cal) return null;
  const pend = cal.itens.filter((i) => i.status !== "OK");
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${pend.some((i) => i.status === "ATRASADO") ? C.red + "66" : C.line}` }}>
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={18} style={{ color: C.accent }} />
        <div className="font-bold text-sm" style={{ color: C.navy }}>Calendário de obrigações · {["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][cal.mes - 1]}/{cal.ano}</div>
        <div className="text-xs ml-auto" style={{ color: C.sub }}>Folha até o 3º dia útil · adiantamento e impostos até o dia 17</div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {cal.itens.map((i) => {
          const [c, bg, t] = COR_ST[i.status];
          return (
            <div key={`${i.empresa}-${i.obrigacao}`} className="rounded-lg p-3" style={{ background: bg }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold" style={{ color: C.sub }}>{i.empresa}</span>
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: c }}>
                  {i.status === "OK" ? <CheckCircle2 size={12} /> : i.status === "ATRASADO" ? <AlertTriangle size={12} /> : <Clock size={12} />} {t}
                </span>
              </div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{i.descricao}</div>
              <div className="text-xs" style={{ color: C.sub }}>
                até {dBR(i.prazo)}{i.status !== "OK" && (i.dias >= 0 ? ` · faltam ${i.dias} dia(s)` : ` · ${-i.dias} dia(s) de atraso`)}
                {i.parcial && ` · falta ${i.faltam.join(" e ")}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Matriz de pessoal ---------------- */
function MatrizPessoal({ user, d, onSalvo }) {
  const [emp, setEmp] = useState("TODAS");
  const [mostrar, setMostrar] = useState("ATIVOS");
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState(null);   // { pessoa, novo }
  const lista = (d.pessoas || []).filter((p) => (emp === "TODAS" || p.empresa === emp) && (mostrar === "ATIVOS" ? p.ativo !== false : p.ativo === false)
    && (!busca || `${p.nome} ${p.nomeCompleto || ""} ${p.cargo}`.toUpperCase().includes(busca.toUpperCase())));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {EMPRESAS.map(([k, t]) => (
          <button key={k} onClick={() => setEmp(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={emp === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
        ))}
        <select value={mostrar} onChange={(e) => setMostrar(e.target.value)} className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inpS}>
          <option value="ATIVOS">Ativos</option><option value="DESLIGADOS">Desligados</option>
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none" style={{ ...inpS, width: 200 }} />
        </div>
        <div className="flex-1" />
        <button onClick={() => setEdit({ novo: true, pessoa: { nome: "", cargo: "", depto: emp === "NORT" ? "NORT" : "COS", regime: "CLT", salario: 0, bonus: 0, vt: 287.5, descontaVt: true, vr: 100, ps: 54.9, assPct: 0.05, saldoLivre: 0, rFerias: 0, adiantamento: false, admissao: new Date().toISOString().slice(0, 10), obs: "" } })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><UserPlus size={15} /> Admitir funcionário</button>
      </div>
      <div className="text-[11px] mb-2" style={{ color: C.sub }}>
        É a mesma Matriz de custos do financeiro (última alteração: {d.atualizadaPor || "—"}). Toda mudança atualiza as contas de pessoal e avisa o financeiro e a operação.
      </div>
      <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, background: C.panel2 }}>
            {["Funcionário", "Empresa", "Setor", "Cargo", "Regime", "Salário", "Bônus", "VT", "VA/VR", "Plano", "Adiant.", mostrar === "ATIVOS" ? "Admissão" : "Desligamento", ""].map((h, i) => (
              <th key={i} className={`px-2 py-2 font-semibold ${["Salário", "Bônus", "VT", "VA/VR", "Plano"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{DEPTOS.map(([dk, dt]) => {
            const ps = lista.filter((p) => p.depto === dk);
            if (!ps.length) return null;
            return (
              <React.Fragment key={dk}>
                <tr><td colSpan={13} className="px-2 pt-3 pb-1 text-[11px] font-bold" style={{ color: C.navy }}>{dt} · {ps.length}</td></tr>
                {ps.map((p) => (
                  <tr key={p.id} onClick={() => setEdit({ pessoa: p })} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2 py-1.5"><div className="font-semibold" style={{ color: C.navy }}>{p.nome || "(vaga sem nome)"}</div>{p.nomeCompleto && <div className="text-[10px]" style={{ color: C.sub }}>{p.nomeCompleto}</div>}</td>
                    <td className="px-2 py-1.5">{p.empresa}</td>
                    <td className="px-2 py-1.5">{nomeDepto(p.depto)}</td>
                    <td className="px-2 py-1.5">{p.cargo}</td>
                    <td className="px-2 py-1.5">{REGIMES[p.regime] || p.regime}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{brl(p.salario)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(p.bonus)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(p.vt)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(p.vr)}</td>
                    <td className="px-2 py-1.5 text-right">{brl(p.ps)}</td>
                    <td className="px-2 py-1.5">{p.adiantamento ? "sim" : "—"}</td>
                    <td className="px-2 py-1.5">{dBR(mostrar === "ATIVOS" ? p.admissao : p.demissao)}</td>
                    <td className="px-2 py-1.5"><Pencil size={13} style={{ color: C.sub }} /></td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}</tbody>
        </table>
        {!lista.length && <div className="p-6 text-center text-sm" style={{ color: C.sub }}>Ninguém aqui.</div>}
      </div>
      {edit && <PessoaModal user={user} {...edit} onClose={() => setEdit(null)} onSalvo={(m) => { setEdit(null); onSalvo(m); }} />}
    </div>
  );
}

function PessoaModal({ user, pessoa, novo, onClose, onSalvo }) {
  const [p, setP] = useState({ ...pessoa });
  const [nomeCompleto, setNomeCompleto] = useState(pessoa.nomeCompleto || "");
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [deslig, setDeslig] = useState(null);   // { demissao, obs }
  const s = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const enviar = async (acao, extra = {}) => {
    setSt("Salvando…"); setErro("");
    try {
      const r = await api("/api/rh/pessoal", "POST", { usuarioId: user.id, acao, pessoa: { ...p, ...extra }, nomeCompleto });
      onSalvo(r.semMudanca ? "Nada mudou." : `${r.resumo || "Salvo"}. Matriz e contas de pessoal atualizadas${r.avisados ? ` · aviso enviado a ${r.avisados} pessoa(s) do financeiro e da operação` : ""}.`);
    } catch (e) { setErro(e.message); setSt(""); }
  };
  const num = (k, t) => (
    <label className="text-xs" style={{ color: C.sub }}>{t}<Valor value={p[k] || 0} width="100%" onChange={(v) => s(k, v)} /></label>
  );
  return (
    <Modal titulo={novo ? "Admitir funcionário" : `${p.nome || "Funcionário"} · ${p.ativo === false ? "desligado" : "ativo"}`} icone={novo ? UserPlus : Users2} onClose={onClose} largura={760}
      rodape={<>
        {!novo && p.ativo !== false && <button onClick={() => setDeslig({ demissao: new Date().toISOString().slice(0, 10), obs: p.obs || "" })} className="mr-auto flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ color: C.red }}><UserMinus size={15} /> Desligar</button>}
        {!novo && p.ativo === false && <button onClick={() => enviar("REATIVAR")} className="mr-auto flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ color: C.blue }}><Undo2 size={15} /> Reativar</button>}
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={() => enviar(novo ? "ADMITIR" : "EDITAR")} disabled={!!st} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
          {st && <Loader2 size={14} className="animate-spin" />} {novo ? "Admitir" : "Salvar"}
        </button>
      </>}>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label className="text-xs" style={{ color: C.sub, gridColumn: "span 2" }}>Nome na Matriz (curto)<input value={p.nome || ""} onChange={(e) => s("nome", e.target.value.toUpperCase())} className={inp} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub, gridColumn: "span 2" }}>Nome completo<input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value.toUpperCase())} className={inp} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub, gridColumn: "span 2" }}>Cargo<input value={p.cargo || ""} onChange={(e) => s("cargo", e.target.value.toUpperCase())} className={inp} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Setor
          <select value={p.depto} onChange={(e) => s("depto", e.target.value)} className={inp} style={inpS}>{DEPTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
        <label className="text-xs" style={{ color: C.sub }}>Regime
          <select value={p.regime} onChange={(e) => s("regime", e.target.value)} className={inp} style={inpS}>{Object.entries(REGIMES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
        {num("salario", p.regime === "DIRETOR" ? "Pró-labore" : p.regime === "ESTAGIO" ? "Bolsa" : "Salário")}
        {num("bonus", "Bônus")}
        {num("vt", "Vale-transporte")}
        {num("vr", "VA / VR")}
        {num("ps", "Plano de saúde")}
        {num("saldoLivre", "Saldo livre (iFood)")}
        <label className="text-xs" style={{ color: C.sub }}>Assiduidade (%)
          <input type="number" step="0.5" value={Math.round((Number(p.assPct) || 0) * 1000) / 10} onChange={(e) => s("assPct", (Number(e.target.value) || 0) / 100)} className={inp} style={inpS} />
        </label>
        {num("rFerias", "Reflexo de férias")}
        <label className="text-xs" style={{ color: C.sub }}>Admissão<input type="date" value={p.admissao || ""} onChange={(e) => s("admissao", e.target.value)} className={inp} style={inpS} /></label>
        <div className="flex flex-col gap-1 text-xs pt-4" style={{ color: C.text }}>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!p.adiantamento} onChange={(e) => s("adiantamento", e.target.checked)} /> recebe adiantamento (40%)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!p.descontaVt} onChange={(e) => s("descontaVt", e.target.checked)} /> desconta 6% de VT</label>
        </div>
        <label className="text-xs" style={{ color: C.sub, gridColumn: "1 / -1" }}>Observação<input value={p.obs || ""} onChange={(e) => s("obs", e.target.value.toUpperCase())} className={inp} style={inpS} /></label>
      </div>
      {p.depto === "NORT" && <div className="text-[11px] mt-2" style={{ color: C.sub }}>Setor NORT: os custos vão para as contas da loja (NORT — folha, adiantamento, benefícios, INSS e FGTS).</div>}
      {deslig && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: C.redSoft }}>
          <div className="text-sm font-bold mb-2" style={{ color: C.red }}>Desligar {p.nome}</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 3fr" }}>
            <label className="text-xs" style={{ color: C.sub }}>Data<input type="date" value={deslig.demissao} onChange={(e) => setDeslig((x) => ({ ...x, demissao: e.target.value }))} className={inp} style={inpS} /></label>
            <label className="text-xs" style={{ color: C.sub }}>Motivo / observação<input value={deslig.obs} onChange={(e) => setDeslig((x) => ({ ...x, obs: e.target.value.toUpperCase() }))} className={inp} style={inpS} /></label>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => enviar("DESLIGAR", deslig)} disabled={!!st} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.red, color: "#fff" }}>Confirmar desligamento</button>
            <button onClick={() => setDeslig(null)} className="px-3 py-1.5 text-xs" style={{ color: C.sub }}>Cancelar</button>
          </div>
          <div className="text-[11px] mt-1" style={{ color: C.sub }}>Sai da Matriz ativa (fica no histórico), as contas de pessoal são recalculadas e o termo de rescisão pode ser anexado no carômetro.</div>
        </div>
      )}
      {erro && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* ---------------- carômetro ---------------- */
function Carometro({ user, d, onMudou }) {
  const [emp, setEmp] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [desl, setDesl] = useState(false);
  const [aberto, setAberto] = useState(null);
  const lista = (d.pessoas || []).filter((p) => (desl ? p.ativo === false : p.ativo !== false) && (emp === "TODAS" || p.empresa === emp)
    && (!busca || `${p.nome} ${p.nomeCompleto || ""} ${p.cargo}`.toUpperCase().includes(busca.toUpperCase())))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {EMPRESAS.map(([k, t]) => (
          <button key={k} onClick={() => setEmp(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={emp === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>
        ))}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none" style={{ ...inpS, width: 200 }} />
        </div>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={desl} onChange={(e) => setDesl(e.target.checked)} /> desligados</label>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {lista.map((p) => (
          <button key={p.id} onClick={() => setAberto(p)} className="rounded-xl p-4 text-center transition-shadow hover:shadow-md" style={{ background: C.panel, border: `1px solid ${C.line}`, opacity: p.ativo === false ? 0.6 : 1 }}>
            {p.foto ? <img src={p.foto} alt="" className="mx-auto rounded-full object-cover" style={{ width: 72, height: 72 }} />
              : <div className="mx-auto rounded-full flex items-center justify-center text-xl font-bold" style={{ width: 72, height: 72, background: C.accentSoft, color: C.accent }}>{iniciais(p.nomeCompleto || p.nome)}</div>}
            <div className="font-bold text-sm mt-2" style={{ color: C.navy }}>{p.nome || "(vaga sem nome)"}</div>
            <div className="text-[11px] truncate" style={{ color: C.sub }} title={p.nomeCompleto || ""}>{p.nomeCompleto || "nome completo não cadastrado"}</div>
            <div className="text-xs mt-1" style={{ color: C.text }}>{p.cargo}</div>
            <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>{p.empresa} · {nomeDepto(p.depto)}</div>
            <div className="text-[10px] mt-1 font-semibold" style={{ color: p.nDocs ? C.green : C.yellow }}>{p.nDocs ? `${p.nDocs} documento(s)` : "sem documentos"}</div>
          </button>
        ))}
      </div>
      {!lista.length && <div className="p-6 text-center text-sm" style={{ color: C.sub }}>Ninguém aqui.</div>}
      {aberto && <FichaModal user={user} pessoa={aberto} onClose={() => { setAberto(null); onMudou(); }} />}
    </div>
  );
}

function FichaModal({ user, pessoa, onClose }) {
  const [f, setF] = useState(null);
  const [dados, setDados] = useState({});
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [tipo, setTipo] = useState("RG");
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const refDoc = useRef(null), refFoto = useRef(null);
  const url = `/api/rh/funcionario/${pessoa.id}`;
  const carregar = () => api(`${url}?u=${user.id}`).then((j) => { setF(j); setDados(j.dados || {}); setNomeCompleto(j.nomeCompleto || ""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    setSt("Salvando…"); setErro("");
    try { await api(url, "PUT", { usuarioId: user.id, dados, nomeCompleto }); setMsg("Ficha salva."); setTimeout(() => setMsg(""), 3000); } catch (e) { setErro(e.message); }
    setSt("");
  };
  const foto = async (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setErro("Foto muito grande (máx. 3 MB).");
    try { const u = await readURL(file); await api(url, "PUT", { usuarioId: user.id, foto: u }); setF((x) => ({ ...x, foto: u })); } catch (e) { setErro(e.message); }
  };
  const subir = async (files) => {
    setSt("Enviando…"); setErro("");
    try {
      for (const file of [...files]) {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: maior que 15 MB.`);
        await api(url, "POST", { usuarioId: user.id, tipo, nome: file.name, mime: file.type, conteudo: await readB64(file) });
      }
      await carregar();
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const apagar = async (doc) => {
    if (!confirm(`Remover "${doc.nome}"?`)) return;
    try { await api(url, "DELETE", { usuarioId: user.id, docId: doc.id }); await carregar(); } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo={`${pessoa.nome || "Funcionário"} · ${pessoa.empresa} · ${nomeDepto(pessoa.depto)}`} icone={IdCard} onClose={onClose} largura={880}
      rodape={<>
        {msg && <span className="text-xs mr-auto" style={{ color: C.green }}>{msg}</span>}
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Fechar</button>
        <button onClick={salvar} disabled={!!st || !f} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>{st && <Loader2 size={14} className="animate-spin" />} Salvar dados</button>
      </>}>
      {!f ? <Loader2 size={16} className="animate-spin" /> : (
        <div className="flex gap-5">
          <div className="shrink-0 text-center" style={{ width: 140 }}>
            {f.foto ? <img src={f.foto} alt="" className="rounded-xl object-cover mx-auto" style={{ width: 130, height: 130 }} />
              : <div className="rounded-xl flex items-center justify-center text-3xl font-bold mx-auto" style={{ width: 130, height: 130, background: C.accentSoft, color: C.accent }}>{iniciais(nomeCompleto || pessoa.nome)}</div>}
            <button onClick={() => refFoto.current?.click()} className="mt-2 text-xs flex items-center gap-1 mx-auto" style={{ color: C.blue }}><Camera size={13} /> trocar foto</button>
            <input ref={refFoto} type="file" accept="image/*" className="hidden" onChange={(e) => { foto(e.target.files[0]); e.target.value = ""; }} />
            <div className="text-[11px] mt-3 text-left" style={{ color: C.sub }}>
              <div>{pessoa.cargo}</div>
              <div>{REGIMES[pessoa.regime] || pessoa.regime}</div>
              <div>Admissão: {dBR(pessoa.admissao)}</div>
              {pessoa.ativo === false && <div style={{ color: C.red }}>Desligado em {dBR(pessoa.demissao)}</div>}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs block mb-2" style={{ color: C.sub }}>Nome completo<input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value.toUpperCase())} className={inp} style={inpS} /></label>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {CAMPOS_FICHA.map(([k, t, tp]) => (
                <label key={k} className="text-xs" style={{ color: C.sub, gridColumn: tp === "wide" ? "1 / -1" : undefined }}>{t}
                  <input type={tp === "date" ? "date" : "text"} value={dados[k] || ""} onChange={(e) => setDados((x) => ({ ...x, [k]: tp === "date" ? e.target.value : e.target.value.toUpperCase() }))} className={inp} style={inpS} />
                </label>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg" style={{ background: C.panel2 }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-bold flex-1" style={{ color: C.navy }}>Documentos ({f.documentos.length})</div>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded px-2 py-1 text-xs outline-none" style={inpS}>{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</select>
                <button onClick={() => refDoc.current?.click()} disabled={!!st} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.accent }}>
                  {st === "Enviando…" ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Anexar
                </button>
                <input ref={refDoc} type="file" multiple className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
              </div>
              {f.documentos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-xs py-1" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: C.blueSoft, color: C.blue }}>{doc.tipo}</span>
                  <a href={`${url}?u=${user.id}&doc=${doc.id}`} target="_blank" rel="noreferrer" className="flex-1 truncate underline" style={{ color: C.blue }}>{doc.nome}</a>
                  <span style={{ color: C.sub }}>{kb(doc.tamanho)} · {dBR(doc.createdAt)}</span>
                  <a href={`${url}?u=${user.id}&doc=${doc.id}&baixar=1`} title="Baixar" style={{ color: C.sub }}><Download size={13} /></a>
                  <button onClick={() => apagar(doc)} title="Remover" style={{ color: C.sub }}><Trash2 size={13} /></button>
                </div>
              ))}
              {!f.documentos.length && <div className="text-xs" style={{ color: C.sub }}>Nenhum documento. Escolha o tipo e anexe (RG, CPF, CTPS, contrato, exames, rescisão…).</div>}
            </div>
          </div>
        </div>
      )}
      {erro && <div className="mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* ---------------- financeiro do RH ---------------- */
const CAT = { FOLHA: "Folha", ADIANTAMENTO: "Adiantamento", INSS: "INSS", FGTS: "FGTS", IFOOD: "iFood", RESCISAO: "Rescisão", ESTAGIO: "Estágio", OUTRO: "Outro" };
function FinanceiroRH({ user, d, onSalvo }) {
  const [imp, setImp] = useState(false);
  const envios = d.envios || [];
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-sm" style={{ color: C.sub }}>Suba as folhas (fopag + líquidos), as guias de INSS e FGTS, relatórios e boletos do iFood, termos de rescisão e outros. O sistema reconhece cada documento, acha a conta a pagar certa, atualiza e anexa.</div>
        <button onClick={() => setImp(true)} className="ml-auto shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Upload size={15} /> Importar documentos</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-4 py-2.5 text-sm font-bold" style={{ background: C.panel2, color: C.navy }}>Documentos enviados · este mês e o anterior</div>
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub }}>{["Data", "Empresa", "Tipo", "Arquivo", "Conta do mês", "Valor", "Por"].map((h) => <th key={h} className={`px-3 py-2 font-semibold ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
          <tbody>{envios.map((e) => (
            <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-3 py-1.5">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
              <td className="px-3 py-1.5">{e.empresa}</td>
              <td className="px-3 py-1.5">{CAT[e.categoria] || e.categoria}</td>
              <td className="px-3 py-1.5">{e.arquivo}</td>
              <td className="px-3 py-1.5">{e.competencia.split("-").reverse().join("/")}</td>
              <td className="px-3 py-1.5 text-right">{e.valor != null ? brl(e.valor) : "—"}</td>
              <td className="px-3 py-1.5">{e.criadoPorNome || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
        {!envios.length && <div className="p-6 text-center text-sm" style={{ color: C.sub }}>Nenhum documento enviado ainda.</div>}
      </div>
      {imp && <DocumentoModal user={user} contas={d.contas || []} onClose={() => setImp(false)} onSalvo={(m) => { setImp(false); onSalvo(m); }} />}
    </div>
  );
}
