"use client";
// v699 — Portal do cliente (ex.: Loja Way): lançamento reduzido — escolhe o item padrão, informa a grade, anexa as artes
// e, se precisar, os dados unitários (lista colada, digitada ou preenchida pelo link). Vê só os pedidos do próprio cliente.
import React, { useEffect, useState } from "react";
import { LogOut, Plus, X, Paperclip, Send, Package, ClipboardList, Image as Img, FileText, RotateCcw } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { useMobile } from "./useMobile";
import { GradeEditor } from "./pedidoEditor";
import DadosUnitarios, { resumoDU } from "./dadosUnitarios";
import ClienteFinalForm, { ClienteFinalResumo } from "./clienteFinal";   // v709
import { vazioClienteFinal, validarClienteFinal } from "@/lib/clienteFinal";
import { qtdGrade, num } from "@/lib/pedidoLanc";
import { temDU, conferirComGrade } from "@/lib/dadosUnitarios";

// v708 — paleta padrão do sistema Meridian (identidade visual)
const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", navyLine: "#0C2C52", navySub: "#9FB0C7",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", blue: "#2E7CD6", blueSoft: "#EAF2FC", steel: "#3D6799", steelSoft: "#EEF3FB" };
const inp = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR") : "");
const entregaEm = (dias) => (dias > 0 ? new Date(Date.now() + dias * 86400000).toLocaleDateString("pt-BR") : "");   // v702 — lead time em dias corridos
const ST_COR = { EM_LANCAMENTO: [C.blue, C.blueSoft], LANCADO: [C.green, C.greenSoft], FATURADO: [C.navy, C.panel2] };

export default function PortalCliente({ user, onSair, tamanhos }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("NOVO");
  const [itens, setItens] = useState([]);   // [{ key, padrao, grade, artes, dadosUnitarios }]
  const [oc, setOc] = useState("");
  const [obs, setObs] = useState("");
  const [cf, setCf] = useState(vazioClienteFinal());   // v709 — cliente final e envio
  const [st, setSt] = useState("");
  const [busca, setBusca] = useState("");
  const mobile = useMobile();
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
    const vcf = validarClienteFinal(cf);
    if (vcf.erros) { document.getElementById("portal-cliente-final")?.scrollIntoView({ behavior: "smooth" }); return alerta(`Dados do cliente e envio — preencha:\n\n• ${vcf.erros.join("\n• ")}`); }
    for (const [i, it] of itens.entries()) {
      if (!(qtdGrade(it.grade) > 0)) return alerta(`Item ${i + 1} (${it.padrao.nome}): informe a grade.`);
      if (temDU(it.dadosUnitarios) && it.dadosUnitarios.linhas?.length) {   // v707 — sem lista: vai pelo link depois de enviar
        const cf = conferirComGrade(it.dadosUnitarios, it.grade);
        if (!cf.ok) return alerta(`Item ${i + 1}: a lista de personalização exclusiva não bate com a grade (${Object.entries(cf.dif).map(([t, x]) => `${t} ${x > 0 ? "+" : ""}${x}`).join(", ")}). Use "ajustar a grade pela lista".`);
      }
    }
    const semArte = itens.filter((it) => !it.artes.length).map((it) => it.padrao.nome);
    const resumo = itens.map((it, i) => `${i + 1}. ${it.padrao.nome} — ${qtdGrade(it.grade)} pç (${it.grade.filter((g) => num(g.qtd) > 0).map((g) => `${g.tam} ${g.qtd}`).join(" · ")})${it.artes.length ? ` · ${it.artes.length} arte(s)` : ""}${resumoDU(it.dadosUnitarios) ? " · personalização exclusiva" : ""}`).join("\n");
    if (!(await confirmar(`Enviar o pedido?\n\n${resumo}\n\nTotal: ${itens.reduce((s, it) => s + qtdGrade(it.grade), 0)} peça(s)${semArte.length ? `\n\nSem arte anexada: ${semArte.join(", ")}` : ""}`))) return;
    setSt("Enviando…");
    try {
      const j = await api("/api/portal", { method: "POST", body: JSON.stringify({ oc, obs, clienteFinal: cf, itens: itens.map((it) => ({ itemPadraoId: it.padrao.id, grade: it.grade, artes: it.artes, dadosUnitarios: it.dadosUnitarios })) }) });
      setD((x) => ({ ...x, pedidos: j.pedidos })); setItens([]); setOc(""); setObs(""); setCf(vazioClienteFinal()); setAba("PEDIDOS");
      const semLista = itens.some((it) => temDU(it.dadosUnitarios) && !it.dadosUnitarios.linhas?.length);
      alerta(`Pedido enviado: ${j.pecas} peça(s). Nossa equipe confere e confirma — acompanhe em "Meus pedidos".${semLista ? '\n\nPara as pessoas preencherem tamanho e dados, abra o pedido em "Meus pedidos" › "personalização exclusiva / link" e gere o link.' : ""}`);
    } catch (e) { alerta(e.message); }
    setSt("");
  };

  const n = busca.trim().toLowerCase();
  const catalogo = (d?.itens || []).filter((p) => !n || [p.nome, p.nomeNf, p.codigo].join(" ").toLowerCase().includes(n));
  const totalPecas = itens.reduce((s, it) => s + qtdGrade(it.grade), 0);
  const leadPedido = Math.max(0, ...itens.map((it) => it.padrao.leadTime || 0));

  // v708 — mesma moldura do sistema Meridian: menu lateral marinho com o logo (desktop) e barra marinha com abas (celular); conteúdo em tela inteira
  const ABAS = [["NOVO", "Novo pedido", Package], ["PEDIDOS", `Meus pedidos${d ? ` (${d.pedidos.length})` : ""}`, ClipboardList]];
  const nomeUser = [user.nome, user.sobrenome].filter(Boolean).join(" ");
  const tituloAba = aba === "NOVO" ? "Novo pedido" : "Meus pedidos";
  return (
    <div className="flex text-sm" style={{ background: C.bg, color: C.text, height: "100vh", overflow: "hidden", fontFamily: "Montserrat, system-ui, sans-serif" }}>
      {!mobile && (
        <aside className="h-full flex flex-col shrink-0" style={{ background: C.navy, width: 240 }}>
          <div className="px-4 py-4 shrink-0" style={{ borderBottom: `1px solid ${C.navyLine}` }}>
            <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 24, width: "auto" }} />
          </div>
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${C.navyLine}` }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: C.navySub }}>Portal do cliente</div>
            <div className="font-bold text-sm mt-0.5" style={{ color: "#fff" }}>{d?.cliente?.nome || "…"}</div>
          </div>
          <nav className="flex-1 py-2 overflow-y-auto scroll-escuro">
            {ABAS.map(([k, t, I]) => {
              const on = aba === k;
              return (
                <button key={k} onClick={() => setAba(k)} className="w-full flex items-center gap-2.5 py-2.5 pr-3 text-left"
                  style={{ paddingLeft: 13, background: on ? C.navyLine : "transparent", borderLeft: on ? `3px solid ${C.accent}` : "3px solid transparent", color: on ? C.accent : C.navySub, fontWeight: on ? 600 : 400, fontSize: 14 }}>
                  <I size={17} /> {t}
                </button>
              );
            })}
          </nav>
          <div className="px-3 py-2.5 shrink-0 flex items-center gap-2" style={{ borderTop: `1px solid ${C.navyLine}` }}>
            <span className="text-xs flex-1 truncate" style={{ color: C.navySub }}>{nomeUser}</span>
            <button onClick={onSair} title="Sair" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
              style={{ color: "#fff", border: `1px solid ${C.navyLine}`, background: "rgba(255,255,255,.06)" }}><LogOut size={14} /> Sair</button>
          </div>
        </aside>
      )}
      <main className="flex-1 flex flex-col min-w-0">
        {mobile ? (
          <header className="shrink-0" style={{ background: C.navy }}>
            <div className="flex items-center gap-3 px-3 py-3">
              <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 20, width: "auto" }} />
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: C.navySub }}>Portal do cliente</div>
                <div className="text-xs font-bold truncate" style={{ color: "#fff" }}>{d?.cliente?.nome || "…"}</div>
              </div>
              <button onClick={onSair} title="Sair" className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 38, height: 38, color: "#fff", border: `1px solid ${C.navyLine}` }}><LogOut size={18} /></button>
            </div>
            <div className="flex" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
              {ABAS.map(([k, t, I]) => (
                <button key={k} onClick={() => setAba(k)} className="flex-1 flex items-center justify-center gap-1.5 py-3 font-semibold"
                  style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `3px solid ${C.accent}` : "3px solid transparent" }}><I size={16} /> {t}</button>
              ))}
            </div>
          </header>
        ) : (
          <header className="shrink-0 flex items-center px-6 py-3" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
            <div className="font-semibold" style={{ color: C.text }}><span style={{ color: C.sub, fontWeight: 400 }}>{d?.cliente?.nome || "Portal"} › </span>{tituloAba}</div>
            {aba === "NOVO" && itens.length > 0 && <div className="ml-auto text-xs" style={{ color: C.sub }}>{itens.length} item(ns) · <b style={{ color: C.text }}>{totalPecas} peça(s)</b> no pedido</div>}
          </header>
        )}
        <div className="flex-1 overflow-auto">
        <div key={aba} className={`anim-entrar ${mobile ? "p-3" : "px-6 py-5"}`}>
        {erro && <div className="p-3 rounded mb-3" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>}
        {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

        {d && aba === "NOVO" && (
          <>
            <div id="portal-cliente-final" className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="font-bold mb-3" style={{ color: C.navy }}>1. Dados do cliente e envio</div>
              <ClienteFinalForm valor={cf} onChange={setCf} mobile={mobile} />
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="font-bold" style={{ color: C.navy }}>2. Escolha os itens</div>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item" className="ml-auto rounded-lg px-3 py-1.5 text-sm outline-none" style={{ ...inp, width: 220 }} />
              </div>
              {!d.itens.length ? <div className="text-sm py-4 text-center" style={{ color: C.sub }}>Nenhum item padrão cadastrado para o seu cadastro ainda. Fale com seu vendedor.</div> : (
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${mobile ? 150 : 200}px, 1fr))` }}>
                  {catalogo.map((p) => (
                    <button key={p.id} onClick={() => adicionar(p)} className="card-asana rounded-xl p-2.5 text-left" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                      <div className="rounded-lg mb-2 flex items-center justify-center overflow-hidden" style={{ height: mobile ? 120 : 150, background: C.panel2 }}>
                        {p.foto ? <img src={p.foto} alt="" style={{ maxHeight: mobile ? 120 : 150, maxWidth: "100%", objectFit: "contain" }} /> : <Img size={28} style={{ color: C.line }} />}
                      </div>
                      <div className="text-xs font-semibold leading-tight" style={{ color: C.text }}>{p.nome}</div>
                      {p.codigo && <div className="text-[10px]" style={{ color: C.sub }}>{p.codigo}</div>}
                      {p.leadTime > 0 && <div className="text-[10px]" style={{ color: C.sub }}>lead time {p.leadTime} dias</div>}
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
                    <div className="text-xs mt-0.5" style={{ color: it.padrao.leadTime ? C.accent : C.sub }}>{it.padrao.leadTime ? <>Entrega prevista: <b>{entregaEm(it.padrao.leadTime)}</b> (lead time {it.padrao.leadTime} dias)</> : "Entrega prevista: a confirmar pela nossa equipe"}</div>
                  </div>
                  <div className="text-right"><div className="text-xl font-bold" style={{ color: C.navy }}>{qtdGrade(it.grade)}</div><div className="text-[10px]" style={{ color: C.sub }}>peças</div></div>
                  <button onClick={() => tirar(it)} style={{ color: C.sub }} title="Tirar do pedido"><X size={18} /></button>
                </div>
                <div className={mobile ? "" : "grid gap-5"} style={mobile ? undefined : { gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}>
                <div>
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Grade</div>
                <GradeEditor grade={it.grade} tamanhos={tamanhos} onChange={(g) => up(it.key, { grade: g })} />
                </div>
                <div>
                <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Artes</div>
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
                </div>
                </div>
                <DadosUnitarios du={it.dadosUnitarios} onChange={(v) => up(it.key, { dadosUnitarios: v })} grade={it.grade} onGrade={(g) => up(it.key, { grade: g })}
                  tamanhos={tamanhos} uid={user.id} titulo={`${d.cliente.nome} · ${it.padrao.nome}`} clienteNome={d.cliente.nome}
                  onReplicarItens={itens.length > 1 ? () => replicarLocais(it) : null}
                  semLinkTxt={'Quer que cada pessoa preencha o próprio tamanho e dado? Envie o pedido e gere o link em "Meus pedidos" (o pedido fica em "recebendo detalhes").'} />
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
                  <div style={{ color: C.sub }}>{itens.length} item(ns) · <b style={{ color: C.text }}>{totalPecas} peça(s)</b>
                    {leadPedido > 0 && <> · entrega prevista <b style={{ color: C.accent }}>{entregaEm(leadPedido)}</b></>}</div>
                  <button onClick={async () => { if (await confirmar("Resetar o pedido? Dados do cliente, itens, grades, artes e personalização exclusiva saem da tela.")) { setItens([]); setOc(""); setObs(""); setCf(vazioClienteFinal()); } }}
                    className="ml-auto flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm" style={{ color: C.red, border: `1px solid ${C.line}` }}><RotateCcw size={15} /> Resetar pedido</button>
                  <button onClick={enviar} disabled={!!st} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold" style={{ background: C.accent, color: "#fff" }}><Send size={16} /> {st || "Enviar pedido"}</button>
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
                {p.clienteFinal && <div className="mb-2"><ClienteFinalResumo c={p.clienteFinal} /></div>}
                {p.recebendoDetalhes && <div className="text-xs mb-2 p-2 rounded-lg" style={{ background: C.accentSoft, color: C.text }}>Recebendo detalhes: o link de preenchimento está aberto. Quando fechar o preenchimento e trazer as respostas para a lista, o pedido segue para a nossa conferência e produção.</div>}
                {p.itens.map((it, k) => (
                  <ItemPedidoPortal key={`${p.id}-${k}`} p={p} it={it} idx={k} user={user} tamanhos={tamanhos} nomeCliente={d.cliente.nome}
                    salvar={async (body) => { const j = await api("/api/portal", { method: "PUT", body: JSON.stringify({ ppId: p.id, idx: k, ...body }) }); setD((x) => ({ ...x, pedidos: j.pedidos })); }} />
                ))}
              </div>
            );
          })
        )}
        </div>
        </div>
      </main>
    </div>
  );
}

// v707 — item de um pedido já enviado: resumo; enquanto em conferência, abre os dados unitários e o link de preenchimento
function ItemPedidoPortal({ p, it, idx, user, tamanhos, nomeCliente, salvar }) {
  const [aberto, setAberto] = useState(false);
  const gradeIni = () => { const g = it.gradeToda || it.grade || []; const tem = new Set(g.map((x) => x.tam)); return [...g, ...tamanhos.filter((t) => !tem.has(t)).map((t) => ({ tam: t, qtd: "" }))]; };
  const [du, setDu] = useState(it.dadosUnitarios || null);
  const [grade, setGrade] = useState(gradeIni);
  const [st, setSt] = useState("");
  const gravar = async (duNovo = du, gradeNova = grade) => {
    setSt("Salvando…");
    try { await salvar({ dadosUnitarios: duNovo, grade: gradeNova }); setSt("Salvo ✓"); setTimeout(() => setSt(""), 2500); } catch (e) { alerta(e.message); setSt(""); }
  };
  return (
    <div className="text-xs py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span><b>{it.descricao}</b> — {it.pecas} pç ({it.grade.map((g) => `${g.tam} ${g.qtd}`).join(" · ")})</span>
        {it.dadosUnitarios && <span style={{ color: "#3D6799" }}>· {resumoDU(it.dadosUnitarios, tamanhos)}</span>}
        {p.editavel && <button onClick={() => setAberto((x) => !x)} className="ml-auto px-2 py-1 rounded-md font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>{aberto ? "fechar" : "personalização exclusiva / link"}</button>}
      </div>
      {aberto && (
        <div className="mt-2">
          <GradeEditor grade={grade} tamanhos={tamanhos} onChange={setGrade} />
          <DadosUnitarios du={du} onChange={setDu} grade={grade} onGrade={setGrade} tamanhos={tamanhos} uid={user.id}
            titulo={`${nomeCliente} · ${it.descricao}`} clienteNome={nomeCliente} ppId={p.id} itemIdx={idx}
            onLinkCriado={(novo) => gravar(novo, grade)} />
          <div className="flex items-center gap-2 mt-2">
            <span style={{ color: C.sub }}>{st}</span>
            <button onClick={() => gravar()} disabled={st === "Salvando…"} className="ml-auto px-4 py-2 rounded-lg font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar detalhes do item</button>
          </div>
        </div>
      )}
    </div>
  );
}
