"use client";
// v699 — Dados unitários do item: locais (frente/costas) + lista peça a peça (tamanho e dado de cada local).
// Colar a lista (WhatsApp, planilha) → o sistema lê, mostra a prévia e só lança depois da confirmação.
// Link público: cada pessoa preenche o tamanho e os dados; ao fechar, o sistema informa as peças previstas e traz para a lista.
import React, { useState } from "react";
import { Plus, X, Trash2, Maximize2, ArrowUp, ArrowDown, ClipboardPaste, Link2, Copy, Users, Lock, Unlock, ArrowDownToLine, CopyPlus, Tag } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { LOCAIS_DADO, novoCampo, vazioDU, temDU, lerLista, contarPorTam, gradeDaLista, conferirComGrade, normTam } from "@/lib/dadosUnitarios";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", roxo: "#3D6799", roxoSoft: "#EEF3FB",
};
const inp = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
// v702 — "AAAA-MM-DDTHH:MM" (datetime-local) ↔ data
const paraLocal = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const padraoLimite = () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(18, 0, 0, 0); return paraLocal(d); };
export const limiteTxt = (d) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const resumoTam = (l) => l.map((x) => `${x.tam} ${x.qtd}`).join(" · ");

function Janela({ titulo, onFechar, children, largura = 760, rodape }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" style={{ background: "rgba(0,30,65,.45)" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full flex flex-col shadow-2xl" style={{ background: C.panel, maxWidth: largura, maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: "#001E41" }}>{titulo}</div>
          <button type="button" onClick={onFechar} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-4 overflow-auto flex-1">{children}</div>
        {rodape && <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${C.line}` }}>{rodape}</div>}
      </div>
    </div>
  );
}

export function SelectLocal({ value, onChange, style }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded px-2 py-1 text-xs outline-none" style={{ ...inp, ...style }}>
      {LOCAIS_DADO.map(([lado, l]) => (
        <optgroup key={lado} label={lado}>{l.map((x) => <option key={x} value={`${lado} ${x}`}>{`${lado === "FRENTE" ? "Frente" : "Costas"} · ${x.toLowerCase()}`}</option>)}</optgroup>
      ))}
    </select>
  );
}

// prévia da lista lida: confirmação obrigatória antes de lançar
function PreviaLista({ campos, linhas: linhas0, erros, ordem, onConfirmar, onFechar, titulo = "Confira a lista antes de lançar", jaTem = 0 }) {
  const [modo, setModo] = useState(jaTem ? "SUBSTITUIR" : "SUBSTITUIR");
  // v704 — toda lista colada pergunta se os dados vão em letras maiúsculas
  const [caixa, setCaixa] = useState(null);   // null = ainda não escolheu · "MAIUSCULAS" · "MANTER"
  const linhas = caixa === "MAIUSCULAS" ? linhas0.map((l) => ({ ...l, valores: Object.fromEntries(Object.entries(l.valores || {}).map(([k, v]) => [k, String(v ?? "").toLocaleUpperCase("pt-BR")])) })) : linhas0;
  const cont = contarPorTam(linhas, ordem);
  return (
    <Janela titulo={titulo} onFechar={onFechar} largura={820}
      rodape={<>
        <button type="button" onClick={onFechar} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Voltar</button>
        <button type="button" disabled={!linhas.length || !caixa} onClick={() => onConfirmar(linhas, modo)} title={!caixa ? "Escolha antes se os dados vão em letras maiúsculas" : ""} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: linhas.length && caixa ? C.green : C.line, color: "#fff" }}>Confirmar e lançar {linhas.length} peça(s)</button>
      </>}>
      <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: C.greenSoft, color: C.text }}>
        <b>{linhas.length} peça(s)</b> reconhecida(s){cont.length ? <> — {resumoTam(cont)}</> : null}. A grade do item passa a seguir esta contagem.
      </div>
      {campos.length === 1 && linhas.filter((l) => /\s(AB|A|B|O)[+-]$/i.test(String(l.valores[campos[0].id] || ""))).length > linhas.length / 2 && (
        <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: C.yellowSoft, color: C.text }}>
          <b style={{ color: C.yellow }}>A lista parece ter tipo sanguíneo junto do nome.</b> Volte, clique em "outro local", crie o dado <b>TIPO SANGUÍNEO</b> (no local em que ele sai na peça) e cole a lista de novo — o sistema separa os dois.
        </div>
      )}
      {erros.length > 0 && (
        <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: C.redSoft, color: C.text }}>
          <b style={{ color: C.red }}>{erros.length} linha(s) não entraram</b> (sem tamanho reconhecido) — corrija o texto e leia de novo, ou lance à mão depois:
          {erros.map((e) => <div key={e.linha} className="font-mono mt-0.5">linha {e.linha}: {e.texto}</div>)}
        </div>
      )}
      <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: caixa ? C.panel2 : C.accentSoft, border: `1px solid ${caixa ? C.line : C.accent}` }}>
        <div className="font-semibold mb-1.5" style={{ color: caixa ? C.text : C.accent }}>Deseja os dados em letras maiúsculas?</div>
        <div className="flex flex-wrap gap-2">
          {[["MAIUSCULAS", "Sim, tudo em MAIÚSCULAS"], ["MANTER", "Não, manter como foi escrito"]].map(([k, t]) => (
            <button key={k} type="button" onClick={() => setCaixa(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={caixa === k ? { background: C.accent, color: "#fff" } : { background: C.panel, color: C.text, border: `1px solid ${C.line}` }}>{t}</button>
          ))}
        </div>
      </div>
      {jaTem > 0 && (
        <div className="mb-3 flex gap-4 text-xs">
          <label className="flex items-center gap-1"><input type="radio" checked={modo === "SUBSTITUIR"} onChange={() => setModo("SUBSTITUIR")} /> substituir as {jaTem} peça(s) da lista atual</label>
          <label className="flex items-center gap-1"><input type="radio" checked={modo === "ACRESCENTAR"} onChange={() => setModo("ACRESCENTAR")} /> acrescentar à lista atual</label>
        </div>
      )}
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead><tr style={{ background: C.panel2, color: C.sub }}>
          <th className="px-2 py-1.5 text-left text-xs" style={{ width: 36 }}>#</th><th className="px-2 py-1.5 text-left text-xs" style={{ width: 56 }}>Tam.</th>
          {campos.map((c) => <th key={c.id} className="px-2 py-1.5 text-left text-xs">{c.rotulo}<div className="font-normal text-[10px]">{c.local.toLowerCase()}</div></th>)}
        </tr></thead>
        <tbody>{linhas.map((l, i) => (
          <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
            <td className="px-2 py-1 text-xs" style={{ color: C.sub }}>{i + 1}</td>
            <td className="px-2 py-1 font-bold">{l.tam}</td>
            {campos.map((c) => <td key={c.id} className="px-2 py-1 font-semibold" style={{ color: l.valores[c.id] ? C.text : C.sub }}>{l.valores[c.id] || "—"}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </Janela>
  );
}

// v715 — lista ampliada: tela quase cheia, peças em colunas lado a lado (listas longas), edição direta,
// nova linha, remover e ordenar clicando no título de qualquer coluna (crescente / A→Z; clique de novo inverte)
function ListaAmpliada({ campos, linhas, tamsSel, ordem, onChange, onFechar, conf, onAjustarGrade, onReplicar }) {
  const [ordenado, setOrdenado] = useState(null);   // { k, dir }
  // v716 — o máximo de nomes um abaixo do outro (até a altura da tela); só depois abre nova coluna; a janela cresce com a lista
  const [alt, setAlt] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  React.useEffect(() => { const f = () => setAlt(window.innerHeight); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const LIN = 33;                                        // altura de uma linha
  const largCol = 130 + campos.length * 210;             // largura de uma coluna
  const porCol = Math.max(5, Math.floor((alt - 32 - 150) / LIN) - 1);
  const blocos = Array.from({ length: Math.max(1, Math.ceil(linhas.length / porCol)) }, (_, b) => [b * porCol, Math.min(linhas.length, (b + 1) * porCol)]);
  const upV = (i, cid, v) => onChange(linhas.map((l, j) => (j === i ? { ...l, valores: { ...(l.valores || {}), [cid]: v } } : l)));
  const upT = (i, t) => onChange(linhas.map((l, j) => (j === i ? { ...l, tam: t } : l)));
  const ordenar = (k) => {
    const dir = ordenado?.k === k && ordenado.dir === 1 ? -1 : 1;
    const pos = (t) => { const x = ordem.indexOf(t); return x < 0 ? 999 : x; };
    const cmp = k === "TAM" ? (a, b) => pos(a.tam) - pos(b.tam) || String(a.tam).localeCompare(String(b.tam))
      : (a, b) => String(a.valores?.[k] || "").localeCompare(String(b.valores?.[k] || ""), "pt-BR", { sensitivity: "base", numeric: true });
    onChange([...linhas].sort((a, b) => dir * cmp(a, b)));
    setOrdenado({ k, dir });
  };
  const seta = (k) => (ordenado?.k === k ? (ordenado.dir === 1 ? <ArrowUp size={11} className="inline" /> : <ArrowDown size={11} className="inline" />) : null);
  const novaLinha = () => { onChange([...linhas, { tam: linhas[linhas.length - 1]?.tam || ordem[0] || "M", valores: {} }]); setTimeout(() => document.getElementById("du-ampla-fim")?.scrollIntoView({ behavior: "smooth" }), 50); };
  const cont = contarPorTam(linhas, ordem);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl flex flex-col shadow-2xl" style={{ background: C.panel, maxWidth: "98vw", maxHeight: "96vh", minWidth: Math.min(560, typeof window !== "undefined" ? window.innerWidth - 16 : 560) }}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: "#001E41" }}>Lista de personalização exclusiva</div>
          <div className="text-xs" style={{ color: C.sub }}><b style={{ color: C.text }}>{linhas.length} peça(s)</b>{cont.length ? ` — ${resumoTam(cont)}` : ""}</div>
          {!conf.ok && <div className="text-xs" style={{ color: C.red }}>Lista × grade: {Object.entries(conf.dif).map(([t, d]) => `${t} ${d > 0 ? "+" : ""}${d}`).join(", ")}
            {onAjustarGrade && <button type="button" onClick={onAjustarGrade} className="ml-1 underline font-semibold">ajustar a grade</button>}</div>}
          <div className="text-[11px]" style={{ color: C.sub }}>Clique no título de uma coluna para ordenar.</div>
          <button type="button" onClick={onFechar} className="ml-auto" style={{ color: C.sub }}><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <div className="flex gap-3 items-start">
            {blocos.map(([a, z], b) => (
              <table key={b} className="text-sm shrink-0" style={{ borderCollapse: "collapse", border: `1px solid ${C.line}`, width: largCol }}>
                <thead className="sticky top-0" style={{ background: C.panel2 }}><tr style={{ color: C.sub }}>
                  <th className="px-1.5 py-1.5 text-left text-xs" style={{ width: 34 }}>#</th>
                  <th onClick={() => ordenar("TAM")} className="px-1.5 py-1.5 text-left text-xs cursor-pointer select-none hover:underline" style={{ width: 70 }}>Tam. {seta("TAM")}</th>
                  {campos.map((c) => <th key={c.id} onClick={() => ordenar(c.id)} className="px-1.5 py-1.5 text-left text-xs cursor-pointer select-none hover:underline whitespace-nowrap">{c.rotulo} {seta(c.id)}</th>)}
                  <th style={{ width: 24 }} />
                </tr></thead>
                <tbody>{linhas.slice(a, z).map((l, k) => { const i = a + k; return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-1.5 py-0.5 text-xs" style={{ color: C.sub }}>{i + 1}</td>
                    <td className="px-1 py-0.5"><select value={l.tam} onChange={(e) => upT(i, e.target.value)} className="rounded px-1 py-1 text-xs font-bold outline-none" style={inp}>
                      {[...new Set([...tamsSel, l.tam])].map((t) => <option key={t} value={t}>{t}</option>)}</select></td>
                    {campos.map((c) => <td key={c.id} className="px-1 py-0.5"><input value={l.valores?.[c.id] || ""} onChange={(e) => upV(i, c.id, e.target.value)} className="w-full rounded px-2 py-1 text-sm font-semibold outline-none" style={{ ...inp, minWidth: 90 }} /></td>)}
                    <td className="px-1"><button type="button" onClick={() => onChange(linhas.filter((_, j) => j !== i))} title="Remover esta linha" style={{ color: C.sub }}><X size={13} /></button></td>
                  </tr>
                ); })}</tbody>
              </table>
            ))}
          </div>
          <div id="du-ampla-fim" />
        </div>
        <div className="px-4 py-3 flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <button type="button" onClick={novaLinha} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ color: C.roxo, border: `1px dashed ${C.roxo}` }}><Plus size={14} /> nova linha</button>
          <button type="button" onClick={onFechar} className="ml-auto px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

/**
 * du: { campos, linhas, linkId?, linkToken? } | null
 * grade: grade do item ([{tam, qtd}]) · onGrade(novaGrade) · tamanhos: grade padrão · uid: usuário (para o link)
 * onReplicarItens: copia os locais para os outros itens do pedido (opcional)
 */
export default function DadosUnitarios({ du, onChange, grade, onGrade, tamanhos = [], uid, titulo, clienteNome, onReplicarItens, travado = false,
  ppId = null, itemIdx = null, semLinkTxt = "Salve o pedido (rascunho) para gerar o link: ele fica na fase \"recebendo detalhes\" até você fechar o preenchimento.", onLinkCriado }) {
  const [colar, setColar] = useState(null);       // texto
  const [previa, setPrevia] = useState(null);     // { linhas, erros, titulo }
  const [link, setLink] = useState(null);         // dados do link aberto (respostas)
  const [st, setSt] = useState("");
  const [ampla, setAmpla] = useState(false);     // v715 — lista ampliada
  const [selResp, setSelResp] = useState(null);  // v715 — respostas do link selecionadas (índices)
  const on = temDU(du);
  const campos = on ? du.campos : [];
  const linhas = on ? du.linhas || [] : [];
  const ordem = (grade || []).map((g) => g.tam).concat(tamanhos.filter((t) => !(grade || []).some((g) => g.tam === t)));
  const tamsSel = [...new Set([...ordem, ...linhas.map((l) => l.tam)])];
  const api = (url, o = {}) => fetch(url, { cache: "no-store", ...o, headers: { "Content-Type": "application/json", "x-usuario-id": String(uid || "") } }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Erro."); return j; });
  const set = (patch) => onChange({ ...du, ...patch });
  const upCampo = (k, patch) => set({ campos: campos.map((c, j) => (j === k ? { ...c, ...patch } : c)) });
  const tirarCampo = async (k) => {
    if (linhas.some((l) => l.valores?.[campos[k].id]) && !(await confirmar(`Tirar o dado "${campos[k].rotulo}"? O que foi preenchido nele sai da lista.`))) return;
    set({ campos: campos.filter((_, j) => j !== k) });
  };
  const upLinha = (i, patch) => set({ linhas: linhas.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const upValor = (i, cid, v) => set({ linhas: linhas.map((l, j) => (j === i ? { ...l, valores: { ...(l.valores || {}), [cid]: v } } : l)) });
  const novaLinha = (clonar) => set({ linhas: [...linhas, clonar && linhas.length ? { tam: linhas[linhas.length - 1].tam, valores: { ...linhas[linhas.length - 1].valores } } : { tam: linhas[linhas.length - 1]?.tam || ordem[0] || "M", valores: {} }] });
  const replicar = async (c) => {
    const v = (linhas.find((l) => String(l.valores?.[c.id] || "").trim()) || {}).valores?.[c.id];
    if (!v) return alerta(`Preencha "${c.rotulo}" na primeira peça para replicar para as outras.`);
    if (!(await confirmar(`Replicar "${v}" em ${c.rotulo} para todas as ${linhas.length} peças?`))) return;
    set({ linhas: linhas.map((l) => ({ ...l, valores: { ...(l.valores || {}), [c.id]: v } })) });
  };
  const ligar = async (v) => {
    if (v) return onChange(vazioDU());
    if (linhas.length && !(await confirmar(`Desligar a personalização exclusiva? A lista com ${linhas.length} peça(s) sai do item.`))) return;
    onChange(null);
  };
  const lancarLista = (novas, modo) => {
    const l = modo === "ACRESCENTAR" ? [...linhas, ...novas] : novas;
    set({ linhas: l });
    if (onGrade) onGrade(gradeDaLista(grade, l));
    setPrevia(null); setColar(null);
  };
  const ler = () => {
    const r = lerLista(colar, campos);
    if (!r.linhas.length && !r.erros.length) return alerta("Cole a lista no campo.");
    setPrevia({ ...r, titulo: "Confira a lista antes de lançar" });
  };
  // v705 — remover a lista inteira (os locais ficam); a grade pode ser zerada junto
  const removerLista = async () => {
    if (!(await confirmar(`Remover a lista com ${linhas.length} peça(s)? Os locais do dado continuam.`))) return;
    const zerar = onGrade && (await confirmar("Zerar também a grade do item?\n\nOK zera a grade · Cancelar mantém a grade como está."));
    set({ linhas: [] });
    if (zerar) onGrade((grade || []).map((g) => ({ ...g, qtd: "" })));
  };
  const conf = conferirComGrade(du, grade);
  // ---------- link ----------
  const urlLink = du?.linkToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/dados/${du.linkToken}` : "";
  const [novoLink, setNovoLink] = useState(null);   // v702 — dia/hora limite antes de gerar
  const gerarLink = () => {
    if (!campos.length) return alerta("Defina ao menos um dado (local) antes de gerar o link.");
    setNovoLink({ limite: padraoLimite() });
  };
  const confirmarLink = async () => {
    if (!novoLink?.limite) return alerta("Escolha o dia e o horário limite.");
    setSt("Gerando…");
    try {
      const j = await api("/api/dados-link", { method: "POST", body: JSON.stringify({ acao: "criar", titulo: titulo || "PEDIDO", clienteNome, campos, tamanhos: tamsSel, limite: new Date(novoLink.limite).toISOString(), ppId, itemIdx }) });
      const novo = { ...du, linkId: j.id, linkToken: j.token };
      onChange(novo); setNovoLink(null);
      if (onLinkCriado) onLinkCriado(novo);   // v707 — grava o link no pedido
    } catch (e) { alerta(e.message); }
    setSt("");
  };
  const mudarPrazo = async (v) => {
    if (!v) return;
    try { setLink(await api("/api/dados-link", { method: "POST", body: JSON.stringify({ acao: "prazo", id: du.linkId, limite: new Date(v).toISOString() }) })); } catch (e) { alerta(e.message); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(urlLink); alerta("Link copiado. Mande para o cliente."); } catch { window.prompt("Copie o link:", urlLink); } };
  const abrirRespostas = async () => { setSt("Lendo…"); try { const l = await api(`/api/dados-link?id=${du.linkId}`); setLink(l); setSelResp(new Set(l.linhas.map((_, i) => i))); } catch (e) { alerta(e.message); } setSt(""); };
  const fecharLink = async (reabrir) => {
    if (!reabrir && !(await confirmar("Encerrar o preenchimento? Depois disso o link não aceita mais respostas (dá para reabrir)."))) return;
    try { setLink(await api("/api/dados-link", { method: "POST", body: JSON.stringify({ acao: reabrir ? "reabrir" : "fechar", id: du.linkId }) })); } catch (e) { alerta(e.message); }
  };
  // v715 — as respostas selecionadas entram direto na lista do item e abre a lista ampliada (para conferir e editar)
  const trazerDoLink = async () => {
    const cs = new Set(campos.map((c) => c.id));
    const idx = selResp ? [...selResp].sort((a, b) => a - b) : link.linhas.map((_, i) => i);
    if (!idx.length) return alerta("Selecione as respostas que vão para a lista.");
    const novas = idx.map((i) => link.linhas[i]).map((l) => ({ tam: normTam(l.tam), valores: Object.fromEntries(Object.entries(l.valores || {}).filter(([k]) => cs.has(k))) }));
    let modo = "SUBSTITUIR";
    if (linhas.length) modo = (await confirmar(`A lista do item já tem ${linhas.length} peça(s).\n\nOK acrescenta as ${novas.length} resposta(s) selecionada(s) · Cancelar substitui a lista por elas.`)) ? "ACRESCENTAR" : "SUBSTITUIR";
    lancarLista(novas, modo);
    setLink(null); setSelResp(null); setAmpla(true);
  };

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: on ? C.roxoSoft : C.panel2, border: `1px solid ${on ? C.roxo + "44" : C.line}` }}>
      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold" style={{ color: on ? C.roxo : C.sub }}>
        <input type="checkbox" checked={on} disabled={travado} onChange={(e) => ligar(e.target.checked)} />
        <Tag size={14} /> Personalização exclusiva <span className="font-normal text-xs" style={{ color: C.sub }}>(nome, número, tipo sanguíneo… diferente em cada peça)</span>
      </label>
      {on && (
        <div className="mt-2">
          {/* locais */}
          <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: C.sub }}>Locais do dado</div>
          {campos.map((c, k) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 mb-1.5">
              <SelectLocal value={c.local} onChange={(v) => upCampo(k, { local: v })} />
              <input value={c.rotulo} onChange={(e) => upCampo(k, { rotulo: e.target.value.toUpperCase() })} placeholder="o que vai (ex.: NOME)" className="rounded px-2 py-1 text-xs outline-none uppercase" style={{ ...inp, width: 170 }} />
              {campos.length > 1 && <button type="button" onClick={() => tirarCampo(k)} style={{ color: C.red }} title="Tirar este dado"><X size={14} /></button>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" onClick={() => set({ campos: [...campos, novoCampo(campos.length)] })} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.roxo, border: `1px dashed ${C.roxo}` }}><Plus size={12} /> outro local</button>
            {onReplicarItens && <button type="button" onClick={onReplicarItens} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.roxo, border: `1px solid ${C.roxo}44` }} title="Os outros itens do pedido passam a ter os mesmos locais"><CopyPlus size={12} /> replicar locais para os outros itens</button>}
          </div>

          {/* lista */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.sub }}>Lista por peça · {linhas.length} peça(s){linhas.length ? ` — ${resumoTam(contarPorTam(linhas, ordem))}` : ""}</div>
            <div className="flex-1" />
            {linhas.length > 0 && <button type="button" onClick={removerLista} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}><Trash2 size={12} /> Remover lista</button>}
            <button type="button" onClick={() => setColar("")} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ background: C.roxo, color: "#fff" }}><ClipboardPaste size={12} /> Colar lista</button>
          </div>
          {linhas.length > 0 && (
            // v715 — clique em qualquer lugar da lista abre a visualização ampliada (edição, colunas lado a lado, ordenação)
            <div onClick={() => setAmpla(true)} title="Clique para abrir a lista ampliada" className="rounded-lg overflow-auto mb-2 cursor-zoom-in" style={{ maxHeight: 320, border: `1px solid ${C.line}`, background: C.panel }}>
              <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                <thead className="sticky top-0" style={{ background: C.panel2 }}><tr style={{ color: C.sub }}>
                  <th className="px-2 py-1 text-left" style={{ width: 32 }}>#</th><th className="px-2 py-1 text-left" style={{ width: 56 }}>Tam.</th>
                  {campos.map((c) => <th key={c.id} className="px-2 py-1 text-left whitespace-nowrap">{c.rotulo}</th>)}
                  <th className="px-2 py-1 text-right font-normal" style={{ color: C.roxo }}><Maximize2 size={12} className="inline" /> ampliar</th>
                </tr></thead>
                <tbody>{linhas.map((l, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2 py-1" style={{ color: C.sub }}>{i + 1}</td>
                    <td className="px-2 py-1 font-bold">{l.tam}</td>
                    {campos.map((c) => <td key={c.id} className="px-2 py-1 text-sm font-semibold" style={{ color: l.valores?.[c.id] ? C.text : C.sub }}>{l.valores?.[c.id] || "—"}</td>)}
                    <td />
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => { novaLinha(false); setAmpla(true); }} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.roxo, border: `1px dashed ${C.roxo}` }}><Plus size={12} /> nova linha</button>
            {linhas.length > 0 && <button type="button" onClick={() => setAmpla(true)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.roxo, border: `1px solid ${C.roxo}44` }}><Maximize2 size={12} /> abrir lista ampliada</button>}
            {!conf.ok && (
              <span className="text-xs flex items-center gap-2" style={{ color: C.red }}>
                Lista × grade: {Object.entries(conf.dif).map(([t, d]) => `${t} ${d > 0 ? "+" : ""}${d}`).join(", ")}
                {onGrade && <button type="button" onClick={() => onGrade(gradeDaLista(grade, linhas))} className="underline font-semibold">ajustar a grade pela lista</button>}
              </span>
            )}
          </div>

          {/* link público */}
          <div className="mt-3 pt-3 flex flex-wrap items-center gap-2 text-xs" style={{ borderTop: `1px dashed ${C.roxo}44` }}>
            <Link2 size={14} style={{ color: C.roxo }} />
            {!du.linkId && !ppId ? (
              <span style={{ color: C.sub }}>{semLinkTxt}</span>
            ) : !du.linkId ? (
              <>
                <span style={{ color: C.sub }}>Cada pessoa preenche o próprio tamanho e dado:</span>
                <button type="button" onClick={gerarLink} disabled={!!st} className="px-2 py-1 rounded-md font-semibold" style={{ background: C.panel, color: C.roxo, border: `1px solid ${C.roxo}` }}>{st || "Gerar link para o cliente"}</button>
              </>
            ) : (
              <>
                <span className="font-mono px-2 py-1 rounded truncate" style={{ background: C.panel, maxWidth: 360 }}>{urlLink}</span>
                <button type="button" onClick={copiar} className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ color: C.roxo, border: `1px solid ${C.roxo}44` }}><Copy size={12} /> copiar</button>
                <button type="button" onClick={abrirRespostas} disabled={!!st} className="flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ background: C.roxo, color: "#fff" }}><Users size={12} /> {st || "respostas / fechar preenchimento"}</button>
              </>
            )}
          </div>
        </div>
      )}

      {ampla && on && <ListaAmpliada campos={campos} linhas={linhas} tamsSel={tamsSel} ordem={ordem} onChange={(l) => set({ linhas: l })}
        onFechar={() => setAmpla(false)} conf={conf} onReplicar={replicar} onAjustarGrade={onGrade ? () => onGrade(gradeDaLista(grade, linhas)) : null} />}
      {novoLink && (
        <Janela titulo="Link para o cliente preencher" onFechar={() => setNovoLink(null)} largura={520}
          rodape={<><button type="button" onClick={() => setNovoLink(null)} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
            <button type="button" onClick={confirmarLink} disabled={!!st} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>{st || "Gerar link"}</button></>}>
          <div className="text-sm mb-3 p-2.5 rounded-lg" style={{ background: C.yellowSoft, color: C.text }}>Enquanto o link estiver aberto, o pedido fica na fase <b>recebendo detalhes</b> e não vai para a produção. Feche o preenchimento e traga as respostas para a lista para liberar.</div>
          <div className="text-sm mb-3" style={{ color: C.text }}>Cada pessoa escolhe o tamanho e escreve o que vai na peça: <b>{campos.map((c) => c.rotulo.toLowerCase()).join(", ")}</b>. Pode pedir mais de uma peça.</div>
          <label className="text-xs block" style={{ color: C.sub }}>Aceitar preenchimento até (dia e horário)
            <input type="datetime-local" value={novoLink.limite} onChange={(e) => setNovoLink({ limite: e.target.value })} className="block mt-1 rounded-lg px-3 py-2 text-sm outline-none" style={inp} />
          </label>
          <div className="text-[11px] mt-2" style={{ color: C.sub }}>Depois desse horário o link para de aceitar respostas. Dá para mudar o prazo em "respostas / fechar preenchimento".</div>
        </Janela>
      )}
      {colar !== null && (
        <Janela titulo="Colar lista de personalização exclusiva" onFechar={() => setColar(null)}
          rodape={<><button type="button" onClick={() => setColar(null)} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
            <button type="button" onClick={ler} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.roxo, color: "#fff" }}>Ler a lista</button></>}>
          <div className="text-xs mb-2" style={{ color: C.sub }}>
            Uma peça por linha, com o tamanho (entre parênteses ou solto) e {campos.map((c) => c.rotulo.toLowerCase()).join(" e ")}. Ex.: <span className="font-mono">5- (M) Eduardo Gomes A+</span>.
            {campos.length > 1 && " O tipo sanguíneo é reconhecido no fim da linha; outros dados, separados por \" - \", \"/\" ou \";\"."} Antes de lançar o sistema mostra a prévia para você confirmar.
          </div>
          <textarea autoFocus value={colar} onChange={(e) => setColar(e.target.value)} rows={14} className="w-full rounded-lg p-2 text-xs font-mono outline-none" style={inp} placeholder={"1- (P) Mirela O+\n2- (M) Eduardo Gomes A+\n3- (G) - Moreira O+"} />
        </Janela>
      )}
      {previa && <PreviaLista campos={campos} linhas={previa.linhas} erros={previa.erros} ordem={ordem} titulo={previa.titulo} jaTem={linhas.length}
        onFechar={() => setPrevia(null)} onConfirmar={lancarLista} />}
      {link && (
        <Janela titulo={`Link de preenchimento · ${link.titulo}`} onFechar={() => setLink(null)} largura={820}
          rodape={<>
            {link.aberto || !link.fechado ? <button type="button" onClick={() => fecharLink(false)} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1" style={{ background: C.red, color: "#fff" }}><Lock size={14} /> Fechar preenchimento</button>
              : <button type="button" onClick={() => fecharLink(true)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1" style={{ color: C.sub, border: `1px solid ${C.line}` }}><Unlock size={14} /> Reabrir</button>}
            <button type="button" disabled={!selResp?.size} onClick={trazerDoLink} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: selResp?.size ? C.green : C.line, color: "#fff" }}>Trazer {selResp?.size || 0} selecionada(s) para a lista</button>
          </>}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.sub }}>
            Aceita preenchimento até <b style={{ color: C.text }}>{limiteTxt(link.limite) || "sem limite"}</b> · mudar para
            <input type="datetime-local" defaultValue={link.limite ? paraLocal(link.limite) : ""} onBlur={(e) => e.target.value && e.target.value !== (link.limite ? paraLocal(link.limite) : "") && mudarPrazo(e.target.value)} className="rounded px-2 py-1 text-xs outline-none" style={inp} />
          </div>
          <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: link.aberto ? C.blueSoft : C.greenSoft }}>
            {link.aberto ? "Preenchimento aberto" : link.fechado ? `Preenchimento encerrado${link.fechadoPorNome ? ` por ${link.fechadoPorNome}` : ""}` : "Prazo do link vencido"} ·{" "}
            <b>{link.total} peça(s) previstas</b>{link.porTam.length ? ` — ${resumoTam(link.porTam)}` : ""} · {link.pessoas} envio(s)
          </div>
          {link.linhas.length ? (
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead><tr style={{ background: C.panel2, color: C.sub }}>
                <th className="px-2 py-1 text-left" style={{ width: 28 }}><input type="checkbox" checked={!!selResp && selResp.size === link.linhas.length} onChange={(e) => setSelResp(new Set(e.target.checked ? link.linhas.map((_, i) => i) : []))} title="Selecionar todas" /></th>
                <th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Tam.</th>
                {(link.campos || []).map((c) => <th key={c.id} className="px-2 py-1 text-left">{c.rotulo}</th>)}<th className="px-2 py-1 text-left">Quem preencheu</th></tr></thead>
              <tbody>{link.linhas.map((l, i) => (
                <tr key={i} onClick={() => setSelResp((x) => { const n = new Set(x || []); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, background: selResp?.has(i) ? C.greenSoft : "transparent" }}>
                  <td className="px-2 py-1"><input type="checkbox" readOnly checked={!!selResp?.has(i)} /></td>
                  <td className="px-2 py-1" style={{ color: C.sub }}>{i + 1}</td><td className="px-2 py-1 font-bold">{l.tam}</td>
                  {(link.campos || []).map((c) => <td key={c.id} className="px-2 py-1">{l.valores?.[c.id] || "—"}</td>)}<td className="px-2 py-1" style={{ color: C.sub }}>{l.responsavel || "—"}</td></tr>
              ))}</tbody>
            </table>
          ) : <div className="text-sm text-center py-6" style={{ color: C.sub }}>Ninguém preencheu ainda.</div>}
        </Janela>
      )}
    </div>
  );
}

// resumo curto (lista de pedidos, impressão)
export const resumoDU = (du, ordem = []) => (temDU(du) && du.linhas?.length ? `${du.linhas.length} peça(s) com personalização exclusiva — ${resumoTam(contarPorTam(du.linhas, ordem))}` : "");
