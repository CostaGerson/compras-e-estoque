"use client";
// v780 — sugestão #22: Dados › Meridian (dados da empresa + documentos de constituição), ADM › Documentação
//   (contratos e documentos administrativos) e Gestão › Reuniões (reuniões realizadas, ata e material)
import React, { useEffect, useState } from "react";
import { Plus, Paperclip, Trash2, X, Loader2, Pencil, FileText, Search, Copy, Check, Folder, FolderOpen, ChevronRight, ChevronDown, FileArchive, Eye, EyeOff, KeyRound } from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";   // v901 — importar pasta (ZIP)
import { alerta, confirmar } from "./dialogo";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", navy: "#001E41", green: "#12A150", red: "#D92D20", yellow: "#C08401" };
const inp = "w-full px-2 py-1.5 rounded outline-none text-sm";
const inpS = { border: `1px solid ${C.line}`, background: C.panel, color: C.text };
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
// v901 — Uint8Array → base64 (em blocos, sem estourar a pilha)
const u8b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const MIME = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pfx: "application/x-pkcs12", p12: "application/x-pkcs12", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
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
    categorias: ["CONTRATO SOCIAL", "DOCUMENTOS DOS SÓCIOS", "REGULARIDADE FISCAL", "ECONÔMICO-FINANCEIRA", "QUALIFICAÇÃO TÉCNICA", "MARCA",
      "CONTRATO", "ADITIVO", "SEGURO", "LOCAÇÃO", "PRESTAÇÃO DE SERVIÇO", "FINANCIAMENTO", "PROCURAÇÃO", "POLÍTICA INTERNA", "OUTRO"], validade: true, pastas: true },   // v901 — pastas por categoria
  REUNIAO: { titulo: "Reuniões", vazio: "Nenhuma reunião registrada ainda.", categorias: ["GESTÃO MENSAL", "DIRETORIA", "COMERCIAL", "PRODUÇÃO", "FINANCEIRO", "OUTRA"], reuniao: true },
};

export function Acervo({ user, area }) {
  const cf = CONF[area];
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [ed, setEd] = useState(null);
  const [fechadas, setFechadas] = useState({});
  const [imp, setImp] = useState(null);   // { feitos, total, atual }
  // v901 — importar ZIP: cada pasta vira uma categoria (pasta); "_indice.json" opcional { "pasta/arquivo.pdf": { titulo, categoria, data, validade, texto, area } }
  const importarZip = async (file) => {
    if (!file) return;
    let ents;
    try { ents = unzipSync(new Uint8Array(await file.arrayBuffer())); } catch (e) { alerta(`Não consegui abrir o ZIP: ${e.message}`); return; }
    let indice = {};
    const ki = Object.keys(ents).find((k) => /(^|\/)_indice\.json$/i.test(k));
    if (ki) { try { indice = JSON.parse(strFromU8(ents[ki])); } catch {} }
    const arqs = Object.keys(ents).filter((k) => !k.endsWith("/") && k !== ki && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i.test(k) && ents[k].length);
    if (!arqs.length) { alerta("O ZIP está vazio."); return; }
    if (!(await confirmar(`Importar ${arqs.length} arquivo(s) para ${cf.titulo}? Cada pasta do ZIP vira uma pasta aqui.`))) return;
    const erros = [];
    setImp({ feitos: 0, total: arqs.length, atual: "" });
    for (const [i, k] of arqs.entries()) {
      const partes = k.split("/"), nomeArq = partes[partes.length - 1], meta = indice[k] || indice[nomeArq] || {};
      const pasta = meta.categoria || (partes.length > 1 ? partes[partes.length - 2] : "OUTRO");
      setImp({ feitos: i, total: arqs.length, atual: nomeArq });
      try {
        const doc = { area: meta.area || area, titulo: meta.titulo || nomeArq.replace(/\.[^.]+$/, ""), categoria: String(pasta).replace(/^\d+[\s._-]+/, "").toUpperCase(),
          data: meta.data || "", validade: meta.validade || "", texto: meta.texto || "" };
        const r = await api({ usuarioId: user.id, acao: "salvar", doc });
        const ext = (nomeArq.split(".").pop() || "").toLowerCase();
        await api({ usuarioId: user.id, acao: "anexar", docId: r.id, nome: nomeArq, mime: MIME[ext] || null, conteudo: u8b64(ents[k]) });
      } catch (e) { erros.push(`${nomeArq}: ${e.message}`); }
    }
    setImp(null); ler();
    alerta(erros.length ? `Importados ${arqs.length - erros.length} de ${arqs.length}.\n${erros.join("\n")}` : `${arqs.length} arquivo(s) importado(s).`);
  };
  const ler = () => fetch(`/api/acervo?u=${user.id}&area=${area}`, { cache: "no-store" }).then((r) => r.json()).then(setD).catch((e) => setD({ error: e.message }));
  useEffect(() => { ler(); }, [area]);
  const lista = (d?.docs || []).filter((x) => !q || `${x.titulo} ${x.categoria || ""} ${x.participantes || ""} ${x.texto || ""} ${x.anexos.map((a) => a.nome).join(" ")}`.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-base font-bold mr-2" style={{ color: C.navy }}>{cf.titulo}</div>
        <div className="flex items-center gap-1 px-2 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><Search size={13} style={{ color: C.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="py-1.5 text-sm outline-none" /></div>
        <div className="flex-1" />
        {d?.podeEditar && cf.pastas && <label className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.panel }} title="Cada pasta do ZIP vira uma pasta aqui">
          {imp ? <Loader2 size={14} className="animate-spin" /> : <FileArchive size={14} />} {imp ? `Importando ${imp.feitos + 1}/${imp.total}…` : "Importar ZIP"}
          <input type="file" accept=".zip" className="hidden" disabled={!!imp} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importarZip(f); }} /></label>}
        {d?.podeEditar && <button onClick={() => setEd({ area, titulo: "", categoria: cf.categorias[0], data: cf.reuniao ? hoje : "", validade: "", participantes: "", texto: "" })} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={14} /> {cf.reuniao ? "Nova reunião" : "Novo documento"}</button>}
      </div>
      {!d && <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />}
      {d?.error && <div className="text-sm" style={{ color: C.red }}>{d.error}</div>}
      {d && !d.error && !lista.length && <div className="text-sm rounded-lg p-4" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{cf.vazio}</div>}
      {(() => {
        // v916 — clicar no documento baixa na hora (todos os anexos dele)
        const baixarAnexos = (l) => (l || []).forEach((a, k) => setTimeout(() => { const el = document.createElement("a"); el.href = `/api/acervo?u=${user.id}&anexo=${a.id}&baixar=1`; el.download = a.nome; document.body.appendChild(el); el.click(); el.remove(); }, k * 400));
        const card = (x) => {
          const venc = x.validade && x.validade < hoje, vence = x.validade && !venc && x.validade <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
            return (
              <div key={x.id} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${(x.anexos || []).length ? "cursor-pointer hover:underline" : ""}`} style={{ color: C.navy }} title={(x.anexos || []).length ? "Baixar o documento" : undefined}
                      onClick={() => baixarAnexos(x.anexos)}>{x.titulo}{x.categoria && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: C.panel2, color: C.sub }}>{x.categoria}</span>}</div>
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
        };
        if (!cf.pastas) return <div className="space-y-2">{lista.map(card)}</div>;
        // v901 — pastas por categoria (clicar abre/fecha)
        const grupos = {};
        for (const x of lista) (grupos[x.categoria || "SEM PASTA"] ||= []).push(x);
        const ordem = [...cf.categorias.filter((c) => grupos[c]), ...Object.keys(grupos).filter((c) => !cf.categorias.includes(c)).sort()];
        return <div className="space-y-2">{ordem.map((g) => {
          const aberta = q ? true : !fechadas[g], vencidos = grupos[g].filter((x) => x.validade && x.validade < hoje).length;
          return (
            <div key={g} className="rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.bg }}>
              <button onClick={() => setFechadas((s) => ({ ...s, [g]: !s[g] }))} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold" style={{ color: C.navy }}>
                {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{aberta ? <FolderOpen size={16} style={{ color: C.accent }} /> : <Folder size={16} style={{ color: C.accent }} />}
                <span className="flex-1 text-left">{g}</span>
                {vencidos > 0 && <span className="text-[11px] font-semibold" style={{ color: C.red }}>{vencidos} vencido(s)</span>}
                <span className="text-xs font-normal" style={{ color: C.sub }}>{grupos[g].length} doc(s)</span></button>
              {aberta && <div className="space-y-2 px-3 pb-3">{grupos[g].map(card)}</div>}
            </div>);
        })}</div>;
      })()}
      {ed && <DocModal user={user} doc={ed} cf={cf} pastas={[...new Set((d?.docs || []).map((x) => x.categoria).filter(Boolean))]} onClose={() => setEd(null)} onOk={() => { setEd(null); ler(); }} />}
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
            <a href={`/api/acervo?u=${user.id}&anexo=${a.id}&baixar=1`} download={a.nome} style={{ color: C.text }} title={`${a.nome} · ${kb(a.tamanho)}`}>{a.nome.length > 40 ? `${a.nome.slice(0, 38)}…` : a.nome}</a>
            {pode && <button onClick={async () => { if (await confirmar(`Tirar ${a.nome}?`)) { await api({ usuarioId: user.id, acao: "tirarAnexo", id: a.id }).catch((e) => alerta(e.message)); onMudou(); } }} style={{ color: C.sub }}><X size={11} /></button>}
          </span>))}
        {pode && <label className="cursor-pointer font-semibold px-2 py-1 rounded" style={{ color: C.accent, border: `1px dashed ${C.accent}` }}>{sub > 0 ? `anexando ${sub}…` : "+ anexar (ou arraste aqui)"}
          <input type="file" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; anexar(fs); }} /></label>}
      </div>
    </div>
  );
}

function DocModal({ user, doc, cf, onClose, onOk, pastas }) {
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
          <label className="text-xs" style={{ color: C.sub }}>{cf.pastas ? "Pasta (categoria)" : "Categoria"}{cf.pastas
            ? <><input list="acervo-pastas" value={f.categoria || ""} onChange={(e) => s("categoria", e.target.value.toUpperCase())} placeholder="Escolha ou digite uma pasta nova" className={inp} style={inpS} />
              <datalist id="acervo-pastas">{[...new Set([...cf.categorias, ...(pastas || [])])].map((c) => <option key={c} value={c} />)}</datalist></>
            : <select value={f.categoria || ""} onChange={(e) => s("categoria", e.target.value)} className={inp} style={inpS}>{cf.categorias.map((c) => <option key={c}>{c}</option>)}</select>}</label>
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
  ["capitalSocial", "Capital social"], ["socios", "Sócios e participação", 3, "textarea"], ["administradores", "Administradores", 1, "textarea"], ["endereco", "Endereço completo", 3], ["cep", "CEP"],
  ["telefone", "Telefone"], ["email", "E-mail"], ["site", "Site"], ["contador", "Contador / escritório", 2], ["contadorContato", "Contato do contador"],
  ["bancos", "Bancos e contas", 3, "textarea"], ["obs", "Observações", 4, "textarea"],   // v899 — bancos em várias linhas
];
export function EmpresaMeridian({ user }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState({});
  const [st, setSt] = useState("");
  const [copiado, setCopiado] = useState("");
  const valorTxt = (k, tipo) => (tipo === "date" && f[k] ? dBR(f[k])
    : k === "endereco" && f.endereco ? [String(f.endereco).trim(), f.cep ? `CEP: ${String(f.cep).trim()}` : ""].filter(Boolean).join(", ")   // v900 — endereço sai inteiro (com o CEP)
    : String(f[k] || ""));
  const copiar = async (k, txt) => {
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); }
    catch { const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
    setCopiado(k); setTimeout(() => setCopiado((x) => (x === k ? "" : x)), 1500);
  };
  // v899 — cópia geral no formato da mensagem de cadastro enviada a clientes e fornecedores
  const copiarTudo = () => {
    const v = (k) => String(f[k] || "").trim();
    const end = [v("endereco"), v("cep") ? `CEP: ${v("cep")}` : ""].filter(Boolean).join(", ");
    const cad = [["CNPJ", v("cnpj")], ["Inscrição Estadual", v("inscricaoEstadual")], ["Inscrição Municipal", v("inscricaoMunicipal")], ["Razão Social", v("razaoSocial")],
      ["Nome Fantasia", v("nomeFantasia")], ["CNAE Principal", v("cnaePrincipal")], ["Endereço de Entrega/Cobrança", end], ["Telefones de Contato", v("telefone")], ["Email", v("email")], ["Site", v("site")]]
      .filter(([, x]) => x).map(([l, x]) => `${l}: ${x}`);
    const partes = [];
    if (cad.length) partes.push(`Dados Cadastro:\n\n${cad.join("\n")}`);
    if (v("bancos")) partes.push(`Dados bancários:\n\n${v("bancos")}`);
    copiar("__tudo", partes.join("\n\n"));
  };
  useEffect(() => { fetch(`/api/acervo?u=${user.id}&empresa=1`, { cache: "no-store" }).then((r) => r.json()).then((j) => { setD(j); setF(j.dados || {}); }).catch((e) => setD({ error: e.message })); }, []);
  const salvar = async () => { setSt("Salvando…"); try { await api({ usuarioId: user.id, acao: "empresa", dados: f }); setSt("Salvo."); setTimeout(() => setSt(""), 3000); } catch (e) { setSt(e.message); } };
  if (!d) return <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  return (
    <div>
      <div className="rounded-xl p-4 mb-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center mb-3"><div className="text-base font-bold flex-1" style={{ color: C.navy }}>Dados da empresa</div>
          <button onClick={copiarTudo} title="Copia CNPJ, inscrições, razão social, endereço, telefones, e-mail e dados bancários no formato de mensagem" className="px-3 py-1.5 rounded text-sm flex items-center gap-1 mr-2" style={{ border: `1px solid ${C.line}`, color: copiado === "__tudo" ? C.green : C.text }}>{copiado === "__tudo" ? <Check size={14} /> : <Copy size={14} />} Copiar cadastro</button>
          {f.atualizadoPor && <span className="text-[11px] mr-3" style={{ color: C.sub }}>atualizado por {f.atualizadoPor}</span>}
          {d.podeEditar && <button onClick={salvar} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>}
          {st && <span className="text-xs ml-2" style={{ color: C.sub }}>{st}</span>}</div>
        {/* v898 — botão de copiar ao lado de cada dado (e "Copiar tudo" no topo) */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
          {CAMPOS_EMPRESA.map(([k, l, span = 1, tipo]) => (
            <label key={k} className="text-xs" style={{ color: C.sub, gridColumn: `span ${span}` }}>{l}
              <div className="relative">
                {tipo === "textarea" ? <textarea value={f[k] || ""} readOnly={!d.podeEditar} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} rows={3} className={inp} style={{ ...inpS, paddingRight: 34 }} />
                  : <input type={tipo || "text"} value={f[k] || ""} readOnly={!d.podeEditar} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={inp} style={{ ...inpS, paddingRight: tipo === "date" ? 60 : 34 }} />}
                <button type="button" onClick={(e) => { e.preventDefault(); copiar(k, valorTxt(k, tipo)); }} disabled={!f[k]} title={f[k] ? `Copiar ${l.toLowerCase()}` : "Vazio"}
                  className="absolute top-1.5 p-1 rounded" style={{ right: tipo === "date" ? 30 : 4, color: copiado === k ? C.green : C.sub, opacity: f[k] ? 1 : 0.35, background: C.panel }}>
                  {copiado === k ? <Check size={14} /> : <Copy size={14} />}</button>
              </div>
            </label>))}
        </div>
      </div>
      <Certificados user={user} />
      <Acervo user={user} area="EMPRESA" />
    </div>
  );
}

// v901 — certificados digitais (A1 .pfx/.p12) com a senha ao lado; vários certificados; só master e diretoria
function Certificados({ user }) {
  const [d, setD] = useState(null);
  const [ver, setVer] = useState({});
  const [senhas, setSenhas] = useState({});
  const [ocup, setOcup] = useState("");
  const ler = () => fetch(`/api/acervo?u=${user.id}&area=CERTIFICADO`, { cache: "no-store" }).then(async (r) => (r.ok ? r.json() : { negado: true })).then((j) => { setD(j); setSenhas(Object.fromEntries((j.docs || []).map((x) => [x.id, x.senha || ""]))); }).catch(() => setD({ negado: true }));
  useEffect(() => { ler(); }, []);
  if (!d || d.negado) return null;
  const salvar = async (x, extra = {}) => {
    setOcup(`s${x.id || "n"}`);
    try { const r = await api({ usuarioId: user.id, acao: "salvar", doc: { ...x, area: "CERTIFICADO", senha: senhas[x.id] ?? x.senha ?? "", ...extra } }); await ler(); return r; }
    catch (e) { alerta(e.message); } finally { setOcup(""); }
  };
  const novo = async (fs) => {
    for (const f of [...(fs || [])]) {
      setOcup("novo");
      try {
        const r = await api({ usuarioId: user.id, acao: "salvar", doc: { area: "CERTIFICADO", titulo: f.name.replace(/\.[^.]+$/, ""), categoria: "CERTIFICADO DIGITAL", senha: "" } });
        await api({ usuarioId: user.id, acao: "anexar", docId: r.id, nome: f.name, mime: f.type || "application/x-pkcs12", conteudo: await readB64(f) });
      } catch (e) { alerta(`${f.name}: ${e.message}`); }
    }
    setOcup(""); ler();
  };
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-3"><KeyRound size={16} style={{ color: C.accent }} /><div className="text-base font-bold flex-1" style={{ color: C.navy }}>Certificados</div>
        {d.podeEditar && <label className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer" style={{ background: C.accent, color: "#fff" }}>
          {ocup === "novo" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar certificado
          <input type="file" accept=".pfx,.p12,.cer,.crt,.pem" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; novo(fs); }} /></label>}</div>
      {!(d.docs || []).length && <div className="text-sm" style={{ color: C.sub }}>Nenhum certificado ainda. Adicione o arquivo .pfx e preencha a senha ao lado.</div>}
      <div className="space-y-2">
        {(d.docs || []).map((x) => {
          const a = x.anexos[0], venc = x.validade && x.validade < hoje;
          return (
            <div key={x.id} className="grid gap-2 items-end rounded-lg p-3" style={{ gridTemplateColumns: "2fr 1.3fr 1fr auto", border: `1px solid ${C.line}`, background: C.bg }}>
              <label className="text-xs" style={{ color: C.sub }}>Certificado
                <input defaultValue={x.titulo} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim().toUpperCase() !== x.titulo) salvar(x, { titulo: e.target.value }); }} className={inp} style={inpS} />
                <div className="mt-1 flex items-center gap-2">{a ? <a href={`/api/acervo?u=${user.id}&anexo=${a.id}&baixar=1`} download={a.nome} className="flex items-center gap-1" style={{ color: C.navy }}><FileText size={12} style={{ color: C.accent }} />{a.nome}</a> : <span>sem arquivo</span>}</div></label>
              <label className="text-xs" style={{ color: C.sub }}>Senha
                <div className="flex items-center gap-1">
                  <input type={ver[x.id] ? "text" : "password"} value={senhas[x.id] ?? ""} onChange={(e) => setSenhas((s) => ({ ...s, [x.id]: e.target.value }))} placeholder="senha do certificado" autoComplete="new-password" className={inp} style={inpS} />
                  <button type="button" onClick={() => setVer((v) => ({ ...v, [x.id]: !v[x.id] }))} style={{ color: C.sub }}>{ver[x.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  {(senhas[x.id] ?? "") !== (x.senha || "") && <button type="button" onClick={() => salvar(x)} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}>{ocup === `s${x.id}` ? "…" : "Salvar"}</button>}
                </div></label>
              <label className="text-xs" style={{ color: venc ? C.red : C.sub }}>Validade{venc ? " (vencido)" : ""}
                <input type="date" defaultValue={x.validade || ""} onBlur={(e) => { if ((e.target.value || null) !== (x.validade || null)) salvar(x, { validade: e.target.value }); }} className={inp} style={inpS} /></label>
              {d.podeEditar && <button onClick={async () => { if (await confirmar(`Excluir o certificado ${x.titulo}?`)) { try { await api({ usuarioId: user.id, acao: "excluir", id: x.id }); ler(); } catch (e) { alerta(e.message); } } }} className="pb-2" title="Excluir" style={{ color: C.sub }}><Trash2 size={15} /></button>}
            </div>);
        })}
      </div>
    </div>
  );
}
