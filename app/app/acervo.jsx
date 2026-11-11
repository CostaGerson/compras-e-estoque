"use client";
// v780 — sugestão #22: Dados › Meridian (dados da empresa + documentos de constituição), ADM › Documentação
//   (contratos e documentos administrativos) e Gestão › Reuniões (reuniões realizadas, ata e material)
import React, { useEffect, useState } from "react";
import { Plus, Paperclip, Trash2, X, Loader2, Pencil, FileText, Search } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", green: "#12A150", red: "#D92D20", yellow: "#C08401" };
const inp = "w-full px-2 py-1.5 rounded outline-none text-sm";
const inpS = { border: `1px solid ${C.line}`, background: C.panel, color: C.text };
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
async function api(body) {
  const r = await fetch("/api/acervo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || (r.status === 413 ? "Arquivo grande demais para o servidor." : `Erro ${r.status}.`));
  return j;
}

const CONF = {
  EMPRESA: { titulo: "Documentos de constituição", vazio: "Nenhum documento ainda (contrato social, alterações, cartão CNPJ, alvarás, certidões…).",
    categorias: ["CONTRATO SOCIAL", "ALTERAÇÃO CONTRATUAL", "CARTÃO CNPJ", "INSCRIÇÃO ESTADUAL", "ALVARÁ", "CERTIDÃO", "LICENÇA", "PROCURAÇÃO", "OUTRO"], validade: true },
  ADM: { titulo: "Documentação administrativa", vazio: "Nenhum documento ainda (contratos de aluguel, prestadores, seguros, leasing…).",
    categorias: ["CONTRATO", "ADITIVO", "SEGURO", "LOCAÇÃO", "PRESTAÇÃO DE SERVIÇO", "FINANCIAMENTO", "PROCURAÇÃO", "POLÍTICA INTERNA", "OUTRO"], validade: true },
  REUNIAO: { titulo: "Reuniões", vazio: "Nenhuma reunião registrada ainda.", categorias: ["GESTÃO MENSAL", "DIRETORIA", "COMERCIAL", "PRODUÇÃO", "FINANCEIRO", "OUTRA"], reuniao: true },
};

export function Acervo({ user, area }) {
  const cf = CONF[area];
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [ed, setEd] = useState(null);
  const ler = () => fetch(`/api/acervo?u=${user.id}&area=${area}`, { cache: "no-store" }).then((r) => r.json()).then(setD).catch((e) => setD({ error: e.message }));
  useEffect(() => { ler(); }, [area]);
  const lista = (d?.docs || []).filter((x) => !q || `${x.titulo} ${x.categoria || ""} ${x.participantes || ""} ${x.texto || ""} ${x.anexos.map((a) => a.nome).join(" ")}`.toUpperCase().includes(q.toUpperCase()));
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-base font-bold mr-2" style={{ color: C.navy }}>{cf.titulo}</div>
        <div className="flex items-center gap-1 px-2 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><Search size={13} style={{ color: C.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="py-1.5 text-sm outline-none" /></div>
        <div className="flex-1" />
        {d?.podeEditar && <button onClick={() => setEd({ area, titulo: "", categoria: cf.categorias[0], data: cf.reuniao ? hoje : "", validade: "", participantes: "", texto: "" })} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={14} /> {cf.reuniao ? "Nova reunião" : "Novo documento"}</button>}
      </div>
      {!d && <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />}
      {d?.error && <div className="text-sm" style={{ color: C.red }}>{d.error}</div>}
      {d && !d.error && !lista.length && <div className="text-sm rounded-lg p-4" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{cf.vazio}</div>}
      <div className="space-y-2">
        {lista.map((x) => {
          const venc = x.validade && x.validade < hoje, vence = x.validade && !venc && x.validade <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
          return (
            <div key={x.id} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: C.navy }}>{x.titulo}{x.categoria && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: C.panel2, color: C.sub }}>{x.categoria}</span>}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.sub }}>
                    {x.data ? `${cf.reuniao ? "Reunião em" : "Data"} ${dBR(x.data)}` : ""}{x.validade ? <span style={{ color: venc ? C.red : vence ? C.yellow : C.sub }}> · validade {dBR(x.validade)}{venc ? " (vencido)" : vence ? " (vence em breve)" : ""}</span> : null}
                    {x.participantes ? ` · participantes: ${x.participantes}` : ""}{x.atualizadoPorNome ? ` · por ${x.atualizadoPorNome}` : ""}</div>
                  {x.texto && <div className="text-sm mt-2 whitespace-pre-wrap rounded p-2" style={{ background: C.bg, color: C.text }}>{cf.reuniao && <b className="block text-xs mb-1" style={{ color: C.sub }}>ATA</b>}{x.texto}</div>}
                </div>
                {d.podeEditar && <button onClick={() => setEd(x)} title="Editar" style={{ color: C.sub }}><Pencil size={14} /></button>}
                {d.podeEditar && <button onClick={async () => { if (await confirmar(`Excluir ${x.titulo} e os anexos?`)) { try { await api({ usuarioId: user.id, acao: "excluir", id: x.id }); ler(); } catch (e) { alerta(e.message); } } }} title="Excluir" style={{ color: C.sub }}><Trash2 size={14} /></button>}
              </div>
              <Anexos user={user} doc={x} pode={d.podeEditar} rotulo={cf.reuniao ? "Material da reunião" : "Arquivos"} onMudou={ler} />
            </div>
          );
        })}
      </div>
      {ed && <DocModal user={user} doc={ed} cf={cf} onClose={() => setEd(null)} onOk={() => { setEd(null); ler(); }} />}
    </div>
  );
}

function Anexos({ user, doc, pode, rotulo, onMudou }) {
  const [sub, setSub] = useState(0);
  const anexar = async (fs) => {
    fs = [...(fs || [])]; if (!fs.length) return;
    setSub(fs.length);
    for (const f of fs) { try { await api({ usuarioId: user.id, acao: "anexar", docId: doc.id, nome: f.name, mime: f.type, conteudo: await readB64(f) }); } catch (e) { alerta(`${f.name}: ${e.message}`); } setSub((n) => n - 1); }
    onMudou();
  };
  return (
    <div className="mt-2" onDragOver={(e) => { if (pode && e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }} onDrop={(e) => { if (!pode) return; e.preventDefault(); anexar(e.dataTransfer.files); }}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold flex items-center gap-1" style={{ color: C.sub }}><Paperclip size={12} /> {rotulo} ({doc.anexos.length})</span>
        {doc.anexos.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded" style={{ background: C.panel2 }}>
            <FileText size={12} style={{ color: C.accent }} />
            <a href={`/api/acervo?u=${user.id}&anexo=${a.id}`} target="_blank" rel="noreferrer" style={{ color: C.text }} title={`${a.nome} · ${kb(a.tamanho)}`}>{a.nome.length > 40 ? `${a.nome.slice(0, 38)}…` : a.nome}</a>
            {pode && <button onClick={async () => { if (await confirmar(`Tirar ${a.nome}?`)) { await api({ usuarioId: user.id, acao: "tirarAnexo", id: a.id }).catch((e) => alerta(e.message)); onMudou(); } }} style={{ color: C.sub }}><X size={11} /></button>}
          </span>))}
        {pode && <label className="cursor-pointer font-semibold px-2 py-1 rounded" style={{ color: C.accent, border: `1px dashed ${C.accent}` }}>{sub > 0 ? `anexando ${sub}…` : "+ anexar (ou arraste aqui)"}
          <input type="file" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; anexar(fs); }} /></label>}
      </div>
    </div>
  );
}

function DocModal({ user, doc, cf, onClose, onOk }) {
  const [f, setF] = useState({ ...doc });
  const [arqs, setArqs] = useState([]);
  const [st, setSt] = useState(false);
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setSt(true);
    try {
      const r = await api({ usuarioId: user.id, acao: "salvar", doc: f });
      for (const a of arqs) { try { await api({ usuarioId: user.id, acao: "anexar", docId: r.id, nome: a.name, mime: a.type, conteudo: await readB64(a) }); } catch (e) { alerta(`${a.name}: ${e.message}`); } }
      onOk();
    } catch (e) { alerta(e.message); setSt(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onMouseDown={onClose}>
      <div className="rounded-xl w-full max-w-2xl p-5 overflow-y-auto" style={{ background: C.bg, maxHeight: "90vh" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3"><div className="text-lg font-bold flex-1" style={{ color: C.navy }}>{f.id ? "Editar" : cf.reuniao ? "Nova reunião" : "Novo documento"}</div><button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button></div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <label className="text-xs" style={{ color: C.sub }}>{cf.reuniao ? "Assunto / pauta" : "Título"}<input value={f.titulo || ""} onChange={(e) => s("titulo", e.target.value)} className={inp} style={inpS} /></label>
          <label className="text-xs" style={{ color: C.sub }}>Categoria<select value={f.categoria || ""} onChange={(e) => s("categoria", e.target.value)} className={inp} style={inpS}>{cf.categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-xs" style={{ color: C.sub }}>{cf.reuniao ? "Data da reunião" : "Data do documento"}<input type="date" value={f.data || ""} onChange={(e) => s("data", e.target.value)} className={inp} style={inpS} /></label>
          {cf.validade && <label className="text-xs" style={{ color: C.sub }}>Validade / vencimento<input type="date" value={f.validade || ""} onChange={(e) => s("validade", e.target.value)} className={inp} style={inpS} /></label>}
          {cf.reuniao && <label className="text-xs" style={{ color: C.sub }}>Participantes<input value={f.participantes || ""} onChange={(e) => s("participantes", e.target.value)} placeholder="IGOR, PEDRO, MAYCON…" className={inp} style={inpS} /></label>}
          <label className="text-xs col-span-2" style={{ color: C.sub }}>{cf.reuniao ? "Ata da reunião" : "Observações"}<textarea value={f.texto || ""} onChange={(e) => s("texto", e.target.value)} rows={cf.reuniao ? 10 : 3} className={inp} style={inpS} /></label>
          {!f.id && <label className="text-xs col-span-2 cursor-pointer rounded-lg p-3 text-center" style={{ border: `1.5px dashed ${C.line}`, color: C.sub, background: C.panel }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setArqs((a) => [...a, ...e.dataTransfer.files]); }}>
            <Paperclip size={13} className="inline mr-1" />{cf.reuniao ? "Material utilizado" : "Arquivos"}: arraste aqui ou clique{arqs.length ? ` · ${arqs.length} arquivo(s): ${arqs.map((a) => a.name).join(", ")}` : ""}
            <input type="file" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; setArqs((a) => [...a, ...fs]); }} /></label>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
          <button onClick={salvar} disabled={st || !String(f.titulo || "").trim()} className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff", opacity: st || !String(f.titulo || "").trim() ? 0.5 : 1 }}>{st && <Loader2 size={14} className="animate-spin" />} Salvar</button>
        </div>
      </div>
    </div>
  );
}

// Dados › Meridian
const CAMPOS_EMPRESA = [
  ["razaoSocial", "Razão social", 2], ["nomeFantasia", "Nome fantasia"], ["cnpj", "CNPJ"], ["inscricaoEstadual", "Inscrição estadual"], ["inscricaoMunicipal", "Inscrição municipal"],
  ["abertura", "Data de abertura", 1, "date"], ["naturezaJuridica", "Natureza jurídica"], ["regimeTributario", "Regime tributário"], ["cnaePrincipal", "CNAE principal", 2], ["cnaesSecundarios", "CNAEs secundários", 2],
  ["capitalSocial", "Capital social"], ["socios", "Sócios e participação", 3], ["administradores", "Administradores"], ["endereco", "Endereço completo", 3], ["cep", "CEP"],
  ["telefone", "Telefone"], ["email", "E-mail"], ["site", "Site"], ["contador", "Contador / escritório", 2], ["contadorContato", "Contato do contador"],
  ["bancos", "Bancos e contas", 3], ["obs", "Observações", 4, "textarea"],
];
export function EmpresaMeridian({ user }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState({});
  const [st, setSt] = useState("");
  useEffect(() => { fetch(`/api/acervo?u=${user.id}&empresa=1`, { cache: "no-store" }).then((r) => r.json()).then((j) => { setD(j); setF(j.dados || {}); }).catch((e) => setD({ error: e.message })); }, []);
  const salvar = async () => { setSt("Salvando…"); try { await api({ usuarioId: user.id, acao: "empresa", dados: f }); setSt("Salvo."); setTimeout(() => setSt(""), 3000); } catch (e) { setSt(e.message); } };
  if (!d) return <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  return (
    <div>
      <div className="rounded-xl p-4 mb-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center mb-3"><div className="text-base font-bold flex-1" style={{ color: C.navy }}>Dados da empresa</div>
          {f.atualizadoPor && <span className="text-[11px] mr-3" style={{ color: C.sub }}>atualizado por {f.atualizadoPor}</span>}
          {d.podeEditar && <button onClick={salvar} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>}
          {st && <span className="text-xs ml-2" style={{ color: C.sub }}>{st}</span>}</div>
        <fieldset disabled={!d.podeEditar} className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", border: 0, padding: 0, margin: 0 }}>
          {CAMPOS_EMPRESA.map(([k, l, span = 1, tipo]) => (
            <label key={k} className="text-xs" style={{ color: C.sub, gridColumn: `span ${span}` }}>{l}
              {tipo === "textarea" ? <textarea value={f[k] || ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} rows={3} className={inp} style={inpS} />
                : <input type={tipo || "text"} value={f[k] || ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={inp} style={inpS} />}
            </label>))}
        </fieldset>
      </div>
      <Acervo user={user} area="EMPRESA" />
    </div>
  );
}
