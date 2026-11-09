"use client";
// v699 — Portal do cliente (ex.: Loja Way): lançamento reduzido — escolhe o item padrão, informa a grade, anexa as artes
// e, se precisar, os dados unitários (lista colada, digitada ou preenchida pelo link). Vê só os pedidos do próprio cliente.
import React, { useEffect, useState } from "react";
import { LogOut, Plus, X, Paperclip, Send, Package, ClipboardList, Image as Img, FileText } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { GradeEditor } from "./pedidoEditor";
import DadosUnitarios, { resumoDU } from "./dadosUnitarios";
import { qtdGrade, num } from "@/lib/pedidoLanc";
import { temDU, conferirComGrade } from "@/lib/dadosUnitarios";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#C33", blue: "#2E7CD6", blueSoft: "#EAF2FC" };
const inp = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR") : "");
const ST_COR = { EM_LANCAMENTO: [C.blue, C.blueSoft], LANCADO: [C.green, C.greenSoft], FATURADO: [C.navy, C.panel2] };

export default function PortalCliente({ user, onSair, tamanhos }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("NOVO");
  const [itens, setItens] = useState([]);   // [{ key, padrao, grade, artes, dadosUnitarios }]
  const [oc, setOc] = useState("");
  const [obs, setObs] = useState("");
  const [st, setSt] = useState("");
  const [busca, setBusca] = useState("");
  const api = (url, o = {}) => fetch(url, { cache: "no-store", ...o, headers: { "Content-Type": "application/json", "x-usuario-id": String(user.id) } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Erro."); return j; });
  const carregar = () => api("/api/portal").then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const gradeVazia = () => tamanhos.map((t) => ({ tam: t, qtd: "" }));
  const adicionar = (p) => { setItens((l) => [...l, { key: Date.now() + Math.random(), padrao: p, grade: gradeVazia(), artes: [], dadosUnitarios: null }]); setTimeout(() => document.getElementById("portal-itens-fim")?.scrollIntoView({ behavior: "smooth" }), 50); };
  const up = (k, patch) => setItens((l) => l.map((it) => (it.key === k ? { ...it, ...patch } : it)));
  const tirar = async (it) => { if ((qtdGrade(it.grade) || it.artes.length) && !(await confirmar(`Tirar "${it.padrao.nome}" do pedido?`))) return; setItens((l) => l.filter((x) => x.key !== it.key)); };
  const anexar = async (it, files) => {
    const fs = Array.from(files || []).filter((f) => /^image\/|pdf$/i.test(f.type) || /\.(pdf|png|jpe?g|svg|ai|cdr|eps)$/i.test(f.name));
    const grandes = fs.filter((f) => f.size > 15 * 1024 * 1024);
    if (grandes.length) alerta(`Maior que 15 MB (não entrou): ${grandes.map((f) => f.name).join(", ")}`);
    const add = await Promise.all(fs.filter((f) => f.size <= 15 * 1024 * 1024).map(async (f) => ({ nome: f.name, mime: f.type || null, base64: await readB64(f) })));
    up(it.key, { artes: [...it.artes, ...add] });
  };
  const replicarLocais = (de) => setItens((l) => l.map((it) => (it.key === de.key ? it : { ...it, dadosUnitarios: { ...(it.dadosUnitarios || { linhas: [] }), campos: de.dadosUnitarios.campos.map((c) => ({ ...c })), linhas: it.dadosUnitarios?.linhas || [] } })));

  const enviar = async () => {
    if (!itens.length) return alerta("Escolha ao menos um item.");
    for (const [i, it] of itens.entries()) {
      if (!(qtdGrade(it.grade) > 0)) return alerta(`Item ${i + 1} (${it.padrao.nome}): informe a grade.`);
      if (temDU(it.dadosUnitarios)) {
        if (!it.dadosUnitarios.linhas?.length) return alerta(`Item ${i + 1}: o dado unitário está ligado sem a lista de peças. Preencha, cole a lista ou desligue a chave.`);
        const cf = conferirComGrade(it.dadosUnitarios, it.grade);
        if (!cf.ok) return alerta(`Item ${i + 1}: a lista de dados unitários não bate com a grade (${Object.entries(cf.dif).map(([t, x]) => `${t} ${x > 0 ? "+" : ""}${x}`).join(", ")}). Use "ajustar a grade pela lista".`);
      }
    }
    const semArte = itens.filter((it) => !it.artes.length).map((it) => it.padrao.nome);
    const resumo = itens.map((it, i) => `${i + 1}. ${it.padrao.nome} — ${qtdGrade(it.grade)} pç (${it.grade.filter((g) => num(g.qtd) > 0).map((g) => `${g.tam} ${g.qtd}`).join(" · ")})${it.artes.length ? ` · ${it.artes.length} arte(s)` : ""}${resumoDU(it.dadosUnitarios) ? " · dados unitários" : ""}`).join("\n");
    if (!(await confirmar(`Enviar o pedido?\n\n${resumo}\n\nTotal: ${itens.reduce((s, it) => s + qtdGrade(it.grade), 0)} peça(s)${semArte.length ? `\n\nSem arte anexada: ${semArte.join(", ")}` : ""}`))) return;
    setSt("Enviando…");
    try {
      const j = await api("/api/portal", { method: "POST", body: JSON.stringify({ oc, obs, itens: itens.map((it) => ({ itemPadraoId: it.padrao.id, grade: it.grade, artes: it.artes, dadosUnitarios: it.dadosUnitarios })) }) });
      setD((x) => ({ ...x, pedidos: j.pedidos })); setItens([]); setOc(""); setObs(""); setAba("PEDIDOS");
      alerta(`Pedido enviado: ${j.pecas} peça(s). Nossa equipe confere e confirma — acompanhe em "Meus pedidos".`);
    } catch (e) { alerta(e.message); }
    setSt("");
  };

  const n = busca.trim().toLowerCase();
  const catalogo = (d?.itens || []).filter((p) => !n || [p.nome, p.nomeNf, p.codigo].join(" ").toLowerCase().includes(n));
  const totalPecas = itens.reduce((s, it) => s + qtdGrade(it.grade), 0);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "Montserrat, system-ui, sans-serif" }} className="text-sm">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: C.navy, color: "#fff" }}>
        <div className="font-bold tracking-wide">MERIDIAN</div>
        <div className="text-xs opacity-80">Portal do cliente{d?.cliente ? ` · ${d.cliente.nome}` : ""}</div>
        <div className="ml-auto text-xs opacity-80 hidden sm:block">{[user.nome, user.sobrenome].filter(Boolean).join(" ")}</div>
        <button onClick={onSair} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: "1px solid #ffffff55" }}><LogOut size={13} /> Sair</button>
      </div>
      <div className="max-w-5xl mx-auto p-3 sm:p-5">
        <div className="flex gap-1 mb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          {[["NOVO", "Novo pedido", Package], ["PEDIDOS", `Meus pedidos${d ? ` (${d.pedidos.length})` : ""}`, ClipboardList]].map(([k, t, I]) => (
            <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-4 py-2 font-medium" style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}><I size={15} /> {t}</button>
          ))}
        </div>
        {erro && <div className="p-3 rounded mb-3" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>}
        {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

        {d && aba === "NOVO" && (
          <>
            <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="font-bold" style={{ color: C.navy }}>1. Escolha os itens</div>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item" className="ml-auto rounded-lg px-3 py-1.5 text-sm outline-none" style={{ ...inp, width: 220 }} />
              </div>
              {!d.itens.length ? <div className="text-sm py-4 text-center" style={{ color: C.sub }}>Nenhum item padrão cadastrado para o seu cadastro ainda. Fale com seu vendedor.</div> : (
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
                  {catalogo.map((p) => (
                    <button key={p.id} onClick={() => adicionar(p)} className="rounded-lg p-2 text-left hover:shadow" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                      <div className="rounded mb-1.5 flex items-center justify-center overflow-hidden" style={{ height: 110, background: "#fff" }}>
                        {p.foto ? <img src={p.foto} alt="" style={{ maxHeight: 110, maxWidth: "100%", objectFit: "contain" }} /> : <Img size={28} style={{ color: C.line }} />}
                      </div>
                      <div className="text-xs font-semibold leading-tight" style={{ color: C.text }}>{p.nome}</div>
                      {p.codigo && <div className="text-[10px]" style={{ color: C.sub }}>{p.codigo}</div>}
                      <div className="mt-1 text-[11px] font-semibold flex items-center gap-1" style={{ color: C.accent }}><Plus size={12} /> adicionar</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {itens.map((it, i) => (
              <div key={it.key} className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.accent}` }}>
                <div className="flex items-start gap-3 mb-3">
                  {it.padrao.foto && <img src={it.padrao.foto} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: C.panel2 }} />}
                  <div className="flex-1">
                    <div className="text-xs" style={{ color: C.sub }}>Item {i + 1}</div>
                    <div className="font-bold" style={{ color: C.navy }}>{it.padrao.nome}</div>
                  </div>
                  <div className="text-right"><div className="text-xl font-bold" style={{ color: C.navy }}>{qtdGrade(it.grade)}</div><div className="text-[10px]" style={{ color: C.sub }}>peças</div></div>
                  <button onClick={() => tirar(it)} style={{ color: C.sub }} title="Tirar do pedido"><X size={18} /></button>
                </div>
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>2. Grade</div>
                <GradeEditor grade={it.grade} tamanhos={tamanhos} onChange={(g) => up(it.key, { grade: g })} />
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>3. Artes</div>
                <label className="flex items-center justify-center gap-2 rounded-lg p-3 cursor-pointer text-xs" style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentSoft }}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); anexar(it, e.dataTransfer.files); }}>
                  <Paperclip size={14} /> Anexar artes (arraste aqui ou clique) — imagem ou PDF, até 15 MB
                  <input type="file" multiple accept="image/*,application/pdf,.ai,.cdr,.eps" className="hidden" onChange={(e) => { anexar(it, e.target.files); e.target.value = ""; }} />
                </label>
                {it.artes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {it.artes.map((a, k) => (
                      <div key={k} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                        {/^image\//.test(a.mime || "") ? <img src={a.base64} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} /> : <FileText size={14} style={{ color: C.sub }} />}
                        <span className="truncate" style={{ maxWidth: 160 }}>{a.nome}</span>
                        <button onClick={() => up(it.key, { artes: it.artes.filter((_, j) => j !== k) })} style={{ color: C.sub }}><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <DadosUnitarios du={it.dadosUnitarios} onChange={(v) => up(it.key, { dadosUnitarios: v })} grade={it.grade} onGrade={(g) => up(it.key, { grade: g })}
                  tamanhos={tamanhos} uid={user.id} titulo={`${d.cliente.nome} · ${it.padrao.nome}`} clienteNome={d.cliente.nome}
                  onReplicarItens={itens.length > 1 ? () => replicarLocais(it) : null} />
              </div>
            ))}
            <div id="portal-itens-fim" />

            {itens.length > 0 && (
              <div className="rounded-xl p-4 mb-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs" style={{ color: C.sub }}>Sua OC / referência (opcional)<input value={oc} onChange={(e) => setOc(e.target.value)} className="w-full rounded-lg px-3 py-2 mt-1 text-sm outline-none" style={inp} /></label>
                  <label className="text-xs sm:col-span-2" style={{ color: C.sub }}>Observações (opcional)<input value={obs} onChange={(e) => setObs(e.target.value)} className="w-full rounded-lg px-3 py-2 mt-1 text-sm outline-none" style={inp} /></label>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <div style={{ color: C.sub }}>{itens.length} item(ns) · <b style={{ color: C.text }}>{totalPecas} peça(s)</b></div>
                  <button onClick={enviar} disabled={!!st} className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold" style={{ background: C.accent, color: "#fff" }}><Send size={16} /> {st || "Enviar pedido"}</button>
                </div>
              </div>
            )}
          </>
        )}

        {d && aba === "PEDIDOS" && (
          !d.pedidos.length ? <div className="text-center py-10" style={{ color: C.sub }}>Nenhum pedido enviado ainda.</div> : d.pedidos.map((p) => {
            const [cor, fundo] = ST_COR[p.status] || [C.sub, C.panel2];
            return (
              <div key={p.id} className="rounded-xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${cor}` }}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="font-bold" style={{ color: C.navy }}>{p.numero ? `Pedido ${p.numero}` : "Pedido enviado"}</div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: fundo, color: cor }}>{p.situacao}</span>
                  <div className="ml-auto text-xs" style={{ color: C.sub }}>enviado em {dBR(p.enviadoEm)}{p.despacho ? ` · despacho ${p.despacho}` : ""}{p.oc ? ` · OC ${p.oc}` : ""}</div>
                </div>
                {p.itens.map((it, k) => (
                  <div key={k} className="text-xs py-1" style={{ borderTop: `1px solid ${C.line}` }}>
                    <b>{it.descricao}</b> — {it.pecas} pç ({it.grade.map((g) => `${g.tam} ${g.qtd}`).join(" · ")})
                    {it.dadosUnitarios && <span style={{ color: "#7C3AED" }}> · {resumoDU(it.dadosUnitarios, tamanhos)}</span>}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
