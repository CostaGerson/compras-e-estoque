"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Upload, FileText, Trash2, CheckCircle2, AlertTriangle, Clock, KeyRound, Eye, EyeOff, Plus, X, Lock, Save,
} from "lucide-react";

/* Paleta Meridian (igual ao restante do sistema) */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41",
};

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nomeComp = (c) => { const [a, m] = c.split("-"); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const dataHora = (v) => { const d = new Date(v); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });

function statusCard(n, esperado, justificativa) {
  if (n >= esperado) return { k: "ok", label: "Enviado", cor: C.green, bg: C.greenSoft, Ico: CheckCircle2 };
  if (justificativa) return { k: "just", label: n > 0 ? "Parcial · justificado" : "Justificado", cor: C.blue, bg: C.blueSoft, Ico: CheckCircle2 };
  if (n > 0) return { k: "parc", label: `Parcial ${n}/${esperado}`, cor: C.yellow, bg: C.yellowSoft, Ico: AlertTriangle };
  return { k: "pend", label: "Pendente", cor: C.red, bg: C.redSoft, Ico: Clock };
}

/* ============================================================ */
export default function Financeiro({ user }) {
  const [aba, setAba] = useState("importacao");
  const abas = [
    { k: "importacao", label: "Importação mensal" },
    { k: "senhas", label: "Senhas de PDF" },
  ];
  return (
    <div>
      <div className="flex gap-1 mb-5" style={{ borderBottom: `1px solid ${C.line}` }}>
        {abas.map((a) => (
          <button key={a.k} onClick={() => setAba(a.k)} className="px-4 py-2 text-sm font-medium"
            style={{ color: aba === a.k ? C.accent : C.sub, borderBottom: aba === a.k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            {a.label}
          </button>
        ))}
      </div>
      {aba === "importacao" && <Importacao user={user} />}
      {aba === "senhas" && <Senhas user={user} />}
    </div>
  );
}

/* ---------------- IMPORTAÇÃO MENSAL ---------------- */
function Importacao({ user }) {
  const [comp, setComp] = useState(mesAnterior());
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [pedirSenha, setPedirSenha] = useState(null); // { tipo, file, b64, errada }

  const carregar = async () => {
    setErro("");
    try {
      const r = await fetch(`/api/fin/importacao?u=${user.id}&competencia=${comp}`);
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Erro ao carregar."); setDados(null); return; }
      setDados(d);
    } catch { setErro("Falha de conexão."); }
  };
  useEffect(() => { setDados(null); carregar(); }, [comp]);

  const cards = useMemo(() => {
    if (!dados) return [];
    return dados.tipos.map((t) => {
      const arqs = dados.arquivos.filter((a) => a.tipoId === t.id);
      const just = dados.justificativas.find((j) => j.tipoId === t.id) || null;
      return { tipo: t, arqs, just, st: statusCard(arqs.length, t.qtdEsperada, just) };
    });
  }, [dados]);

  const bancos = useMemo(() => {
    const m = [];
    cards.forEach((c) => { let g = m.find((x) => x.banco === c.tipo.banco); if (!g) m.push(g = { banco: c.tipo.banco, cards: [] }); g.cards.push(c); });
    return m;
  }, [cards]);

  const tot = useMemo(() => ({
    total: cards.length,
    ok: cards.filter((c) => c.st.k === "ok").length,
    just: cards.filter((c) => c.st.k === "just").length,
    pend: cards.filter((c) => c.st.k === "pend" || c.st.k === "parc").length,
  }), [cards]);

  // envia 1 arquivo; se pedir senha, abre o modal
  const enviar = async (tipo, file, b64, senha, salvarSenha, rotuloSenha) => {
    const r = await fetch("/api/fin/arquivos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, competencia: comp, tipoId: tipo.id, nome: file.name, conteudo: b64, senha, salvarSenha, rotuloSenha }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 423 && d.precisaSenha) { setPedirSenha({ tipo, file, b64, errada: !!d.senhaErrada }); return "senha"; }
    if (!r.ok) { alert(`${file.name}: ${d.error || "erro ao enviar"}`); return "erro"; }
    return "ok";
  };

  const onArquivos = async (tipo, files) => {
    for (const f of Array.from(files || [])) {
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { alert(`${f.name}: envie um PDF.`); continue; }
      const b64 = await readB64(f);
      const res = await enviar(tipo, f, b64);
      if (res === "senha") break; // um PDF com senha por vez
    }
    carregar();
  };

  const excluir = async (a) => {
    if (!confirm(`Excluir o arquivo ${a.nome}?`)) return;
    await fetch(`/api/fin/arquivos/${a.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  return (
    <div>
      {/* topo: competência + resumo */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setComp(somaMes(comp, -1))} className="px-3 py-2 font-bold" style={{ color: C.sub }}>‹</button>
          <div className="px-3 py-2 font-semibold" style={{ minWidth: 150, textAlign: "center" }}>{nomeComp(comp)}</div>
          <button onClick={() => setComp(somaMes(comp, 1))} className="px-3 py-2 font-bold" style={{ color: C.sub }}>›</button>
        </div>
        {dados && (
          <div className="flex flex-wrap gap-2">
            <Pilula cor={C.green} bg={C.greenSoft} txt={`${tot.ok} de ${tot.total} enviados`} />
            {tot.just > 0 && <Pilula cor={C.blue} bg={C.blueSoft} txt={`${tot.just} justificado${tot.just > 1 ? "s" : ""}`} />}
            <Pilula cor={tot.pend ? C.red : C.green} bg={tot.pend ? C.redSoft : C.greenSoft}
              txt={tot.pend ? `${tot.pend} pendente${tot.pend > 1 ? "s" : ""}` : "Mês completo"} />
          </div>
        )}
      </div>
      {dados && (
        <div className="h-2 rounded-full mb-6 overflow-hidden flex" style={{ background: C.panel2 }}>
          <div style={{ width: `${(tot.ok / tot.total) * 100}%`, background: C.green }} />
          <div style={{ width: `${(tot.just / tot.total) * 100}%`, background: C.blue }} />
        </div>
      )}

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!dados && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

      {bancos.map((g) => (
        <div key={g.banco} className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-bold tracking-wider" style={{ color: C.navy }}>{g.banco}</div>
            <div className="flex-1 h-px" style={{ background: C.line }} />
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {g.cards.map((c) => (
              <CardDoc key={c.tipo.id} c={c} user={user} comp={comp}
                onArquivos={(fs) => onArquivos(c.tipo, fs)} onExcluir={excluir} onMudou={carregar} />
            ))}
          </div>
        </div>
      ))}

      {pedirSenha && (
        <SenhaModal info={pedirSenha} onClose={() => { setPedirSenha(null); carregar(); }}
          onEnviar={async (senha, salvar, rotulo) => {
            const p = pedirSenha; setPedirSenha(null);
            await enviar(p.tipo, p.file, p.b64, senha, salvar, rotulo);
            carregar();
          }} />
      )}
    </div>
  );
}

function Pilula({ cor, bg, txt }) {
  return <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ color: cor, background: bg }}>{txt}</span>;
}

function CardDoc({ c, user, comp, onArquivos, onExcluir, onMudou }) {
  const { tipo, arqs, just, st } = c;
  const inp = useRef(null);
  const [drag, setDrag] = useState(false);
  const [texto, setTexto] = useState(just?.texto || "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setTexto(just?.texto || ""); }, [just?.texto, comp]);

  const falta = arqs.length < tipo.qtdEsperada;
  const podeMais = tipo.multiplo || arqs.length === 0;
  const alterado = (texto || "").trim().toUpperCase() !== (just?.texto || "");

  const salvarJust = async () => {
    setSalvando(true);
    await fetch("/api/fin/justificativas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: user.id, competencia: comp, tipoId: tipo.id, texto }),
    });
    setSalvando(false);
    onMudou();
  };

  return (
    <div className="rounded-xl flex flex-col"
      style={{ background: C.panel, border: `1px solid ${drag ? C.accent : st.k === "pend" ? "#F5C2BD" : C.line}`, borderTop: `3px solid ${st.cor}` }}
      onDragOver={(e) => { if (!podeMais) return; e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (podeMais) onArquivos(e.dataTransfer.files); }}>
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold" style={{ color: C.text }}>{tipo.documento}</div>
            {tipo.descricao && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{tipo.descricao}</div>}
          </div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0" style={{ color: st.cor, background: st.bg }}>
            <st.Ico size={12} /> {st.label}
          </span>
        </div>
        {tipo.qtdEsperada > 1 && (
          <div className="text-xs mt-2" style={{ color: C.sub }}>{arqs.length} de {tipo.qtdEsperada} arquivos esperados</div>
        )}
      </div>

      {arqs.length > 0 && (
        <div className="px-4 pb-2 flex flex-col gap-1">
          {arqs.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: C.panel2 }}>
              <FileText size={15} style={{ color: C.accent }} className="shrink-0" />
              <a href={`/api/fin/arquivos/${a.id}?u=${user.id}`} target="_blank" rel="noopener" className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: C.text }} title={a.nome}>{a.nome}</div>
                <div className="text-[11px]" style={{ color: C.sub }}>{kb(a.tamanho)} · {dataHora(a.createdAt)}{a.enviadoPorNome ? ` · ${a.enviadoPorNome}` : ""}</div>
              </a>
              {a.protegido && <Lock size={13} style={{ color: C.sub }} title="PDF com senha" />}
              <button onClick={() => onExcluir(a)} title="Excluir" style={{ color: C.sub }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pb-4 mt-auto">
        {podeMais && (
          <>
            <input ref={inp} type="file" accept="application/pdf,.pdf" multiple={tipo.multiplo} className="hidden"
              onChange={(e) => { onArquivos(e.target.files); e.target.value = ""; }} />
            <button onClick={() => inp.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium"
              style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: drag ? C.accentSoft : "transparent" }}>
              <Upload size={15} /> {arqs.length ? "Enviar mais" : "Enviar PDF"}
            </button>
          </>
        )}

        {falta && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-1" style={{ color: just ? C.blue : C.red }}>
              Justificativa {arqs.length ? "do envio parcial" : "da falta de envio"} *
            </div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
              placeholder="EX.: CONTA SEM MOVIMENTO NO MÊS"
              className="w-full rounded-lg px-2 py-1.5 text-xs uppercase"
              style={{ border: `1px solid ${just ? C.line : "#F5C2BD"}`, background: C.panel, color: C.text, resize: "vertical" }} />
            <div className="flex items-center justify-between mt-1">
              <div className="text-[11px]" style={{ color: C.sub }}>
                {just && !alterado ? `${just.usuarioNome || ""} · ${dataHora(just.updatedAt)}` : ""}
              </div>
              {alterado && (
                <button onClick={salvarJust} disabled={salvando}
                  className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold"
                  style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
                  <Save size={12} /> {texto.trim() ? "Salvar" : "Remover"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SenhaModal({ info, onClose, onEnviar }) {
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [salvar, setSalvar] = useState(true);
  const [rotulo, setRotulo] = useState(`${info.tipo.banco} · ${info.tipo.documento}`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="rounded-xl w-full max-w-md p-5" style={{ background: C.panel }}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold flex items-center gap-2"><KeyRound size={18} style={{ color: C.accent }} /> PDF protegido por senha</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>{info.file.name}</div>
        {info.errada && <div className="text-xs mb-2 p-2 rounded" style={{ background: C.redSoft, color: C.red }}>Senha incorreta. Tente de novo.</div>}
        <div className="flex items-center rounded-lg mb-3" style={{ border: `1px solid ${C.line}` }}>
          <input autoFocus type={ver ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && senha) onEnviar(senha, salvar, rotulo); }}
            placeholder="Senha do PDF" className="flex-1 px-3 py-2 text-sm rounded-lg" style={{ outline: "none" }} />
          <button onClick={() => setVer((v) => !v)} className="px-3" style={{ color: C.sub }}>{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
          <input type="checkbox" checked={salvar} onChange={(e) => setSalvar(e.target.checked)} /> Salvar senha para os próximos envios
        </label>
        {salvar && (
          <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg mb-3 uppercase"
            style={{ border: `1px solid ${C.line}` }} placeholder="Descrição (ex.: C6 · FATURA)" />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2, color: C.text }}>Cancelar</button>
          <button disabled={!senha} onClick={() => onEnviar(senha, salvar, rotulo)} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.accent, color: "#fff", opacity: senha ? 1 : 0.5 }}>Abrir e enviar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SENHAS DE PDF ---------------- */
function Senhas({ user }) {
  const [lista, setLista] = useState([]);
  const [ver, setVer] = useState({});
  const [rotulo, setRotulo] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const carregar = async () => {
    const r = await fetch(`/api/fin/senhas?u=${user.id}`);
    const d = await r.json().catch(() => []);
    setLista(Array.isArray(d) ? d : []);
  };
  useEffect(() => { carregar(); }, []);

  const add = async () => {
    setErro("");
    const r = await fetch("/api/fin/senhas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, rotulo, senha }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErro(d.error || "Erro ao salvar.");
    setRotulo(""); setSenha(""); carregar();
  };
  const del = async (s) => {
    if (!confirm(`Excluir a senha "${s.rotulo}"?`)) return;
    await fetch(`/api/fin/senhas/${s.id}?u=${user.id}`, { method: "DELETE" });
    carregar();
  };

  return (
    <div className="max-w-2xl">
      <div className="text-sm mb-4" style={{ color: C.sub }}>
        Ao enviar um PDF protegido, o sistema testa estas senhas automaticamente. Se nenhuma servir, ele pede a senha na hora.
      </div>
      <div className="rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex-1" style={{ minWidth: 200 }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Descrição</div>
          <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="EX.: C6 · FATURA" className="w-full px-3 py-2 rounded-lg text-sm uppercase" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <div style={{ width: 200 }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Senha</div>
          <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <button onClick={add} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={15} /> Adicionar
        </button>
        {erro && <div className="w-full text-xs" style={{ color: C.red }}>{erro}</div>}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {lista.length === 0 && <div className="p-4 text-sm" style={{ color: C.sub }}>Nenhuma senha cadastrada.</div>}
        {lista.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <KeyRound size={16} style={{ color: C.accent }} />
            <div className="flex-1 font-medium text-sm">{s.rotulo}</div>
            <div className="text-sm font-mono" style={{ color: C.sub }}>{ver[s.id] ? s.senha : "••••••"}</div>
            <button onClick={() => setVer((v) => ({ ...v, [s.id]: !v[s.id] }))} style={{ color: C.sub }}>{ver[s.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            <button onClick={() => del(s)} style={{ color: C.sub }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
