"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Pencil, Trash2, Search, Loader2, Phone, KeyRound, MapPin, Gauge, CheckCircle2 } from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const inp = "w-full rounded-lg px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };
const semAc = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
};

function Campo({ t, dica, children }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}{dica && <span className="font-normal"> · {dica}</span>}</div>
      {children}
    </label>
  );
}

/* ---------------- card de cadastro (serve na aba Dados e no meio de um lançamento) ---------------- */
export function PrestadorModal({ user, tipo, prestador, catalogo, nomeSugerido, onClose, onSalvo }) {
  const free = tipo === "FREELANCER";
  const [f, setF] = useState(() => ({
    nome: prestador?.nome || nomeSugerido || "",
    telefone: prestador?.telefone || "",
    chavePix: prestador?.chavePix || "",
    servicos: prestador?.servicos || [],
    capacidade: prestador?.capacidade ?? "",
    endereco: prestador?.endereco || "",
    documento: prestador?.documento || "",
    observacao: prestador?.observacao || "",
    ativo: prestador?.ativo ?? true,
  }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const s = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const marcar = (k) => setF((x) => ({
    ...x,
    servicos: free ? [k] : x.servicos.includes(k) ? x.servicos.filter((y) => y !== k) : [...x.servicos, k],
  }));

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const j = await api("/api/prestadores", prestador ? "PUT" : "POST",
        { usuarioId: user.id, tipo, id: prestador?.id, campos: { ...f, capacidade: f.capacidade === "" ? null : Number(f.capacidade) } });
      onSalvo(j);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(16,24,40,.45)" }}>
      <div className="rounded-2xl w-full overflow-auto" style={{ background: C.panel, maxWidth: 640, maxHeight: "90vh", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.navy }}>
            {prestador ? "Editar" : "Novo"} {free ? "freelancer" : "terceirizado"}
          </div>
          <div className="flex-1" />
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>

        <div className="p-5">
          {nomeSugerido && !prestador && (
            <div className="rounded-lg px-3 py-2 mb-3 text-xs" style={{ background: C.blueSoft, color: C.blue }}>
              Esse prestador ainda não está cadastrado. Preencha aqui e o lançamento continua de onde parou.
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Campo t="Nome"><input value={f.nome} onChange={(e) => s("nome")(e.target.value.toUpperCase())} className={inp} style={inpS} autoFocus /></Campo>
            <Campo t="Telefone"><input value={f.telefone} onChange={(e) => s("telefone")(e.target.value)} className={inp} style={inpS} placeholder="(31) 9…" /></Campo>
            <Campo t="Chave PIX" dica="obrigatória"><input value={f.chavePix} onChange={(e) => s("chavePix")(e.target.value)} className={inp} style={{ ...inpS, borderColor: f.chavePix ? C.line : C.yellow }} /></Campo>
            <Campo t="Capacidade por semana" dica="peças"><input value={f.capacidade} onChange={(e) => s("capacidade")(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inp} style={inpS} /></Campo>
            <Campo t="CPF / CNPJ"><input value={f.documento} onChange={(e) => s("documento")(e.target.value)} className={inp} style={inpS} /></Campo>
          </div>

          {!free && (
            <div className="mt-3"><Campo t="Endereço" dica="obrigatório para terceirizado">
              <input value={f.endereco} onChange={(e) => s("endereco")(e.target.value.toUpperCase())} className={inp} style={{ ...inpS, borderColor: f.endereco ? C.line : C.yellow }} />
            </Campo></div>
          )}

          <div className="mt-4">
            <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>
              {free ? "Setor em que trabalha" : "Serviços prestados"} · {free ? "escolha um" : "pode marcar vários"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(catalogo || []).map((c) => {
                const k = free ? c.k : `${c.grupo}:${c.k}`;
                const on = f.servicos.includes(k);
                return (
                  <button key={k} type="button" onClick={() => marcar(k)} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: on ? C.accent : C.panel, color: on ? "#fff" : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>
                    {c.n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3"><Campo t="Observação"><input value={f.observacao} onChange={(e) => s("observacao")(e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo></div>

          {prestador && (
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input type="checkbox" checked={f.ativo} onChange={(e) => s("ativo")(e.target.checked)} /> cadastro ativo
            </label>
          )}

          {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: C.accent, opacity: salvando ? 0.6 : 1 }}>
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- aba de Dados ---------------- */
export default function Prestadores({ user, tipo = "FREELANCER" }) {
  const free = tipo === "FREELANCER";
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);   // { prestador? }
  const [aviso, setAviso] = useState("");

  const carregar = () => api(`/api/prestadores?u=${user.id}&tipo=${tipo}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { setD(null); carregar(); }, [tipo]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 5000); return () => clearTimeout(t); }, [aviso]);

  const catalogo = d?.catalogos?.[tipo] || [];
  const rotulo = useMemo(() => Object.fromEntries((catalogo || []).map((c) => [free ? c.k : `${c.grupo}:${c.k}`, c.n])), [catalogo, free]);

  const lista = useMemo(() => {
    const b = semAc(busca).trim();
    return (d?.prestadores || []).filter((p) => !b || semAc(`${p.nome} ${p.telefone || ""} ${p.chavePix} ${(p.servicos || []).map((s) => rotulo[s] || s).join(" ")}`).includes(b));
  }, [d, busca, rotulo]);

  const excluir = async (p) => {
    if (!confirm(`Excluir ${p.nome}?\n\nSe já houver lançamento no nome dele, o cadastro é só desativado para não perder o histórico.`)) return;
    try {
      const j = await api("/api/prestadores", "DELETE", { usuarioId: user.id, tipo, id: p.id });
      setD((x) => ({ ...x, prestadores: j.prestadores }));
      setAviso(j.desativado ? `${p.nome} tem ${j.lancamentos} lançamento(s) — foi desativado em vez de apagado.` : `${p.nome} excluído.`);
    } catch (e) { setErro(e.message); }
  };

  if (erro) return <div className="p-3 rounded" style={{ background: C.redSoft, color: C.red }}>{erro}</div>;
  if (!d) return <div style={{ color: C.sub }}>Carregando…</div>;

  return (
    <div>
      {aviso && <div className="p-3 rounded mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 rounded-lg px-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={free ? "Buscar freelancer" : "Buscar terceirizado"}
            className="px-1 py-1.5 text-sm" style={{ background: "transparent", color: C.text, width: 230, outline: "none" }} />
        </div>
        <div className="text-xs" style={{ color: C.sub }}>{lista.length} de {d.prestadores.length}</div>
        <div className="flex-1" />
        <button onClick={() => setModal({})} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>
          <Plus size={15} /> {free ? "Novo freelancer" : "Novo terceirizado"}
        </button>
      </div>

      <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: free ? 820 : 1000 }}>
          <thead><tr style={{ background: C.panel2, color: C.sub }}>
            <th className="px-2 py-2 text-left font-semibold">Nome</th>
            <th className="px-2 py-2 text-left font-semibold">Telefone</th>
            <th className="px-2 py-2 text-left font-semibold">{free ? "Setor" : "Serviços prestados"}</th>
            <th className="px-2 py-2 text-right font-semibold">Capacidade/semana</th>
            <th className="px-2 py-2 text-left font-semibold">Chave PIX</th>
            {!free && <th className="px-2 py-2 text-left font-semibold">Endereço</th>}
            <th className="px-2 py-2"></th>
          </tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.line}`, opacity: p.ativo ? 1 : 0.5 }}>
                <td className="px-2 py-1.5">
                  <button onClick={() => setModal({ prestador: p })} className="font-semibold text-left hover:underline" style={{ color: C.text }}>{p.nome}</button>
                  {!p.ativo && <span className="ml-1 px-1.5 rounded text-[10px] font-semibold" style={{ background: C.panel2, color: C.sub }}>INATIVO</span>}
                  {p.observacao && <div style={{ color: C.sub }}>{p.observacao}</div>}
                </td>
                <td className="px-2 py-1.5" style={{ color: p.telefone ? C.text : C.sub }}>{p.telefone || "—"}</td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(p.servicos || []).map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: C.accentSoft, color: C.accent }}>{rotulo[s] || s}</span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: p.capacidade ? C.text : C.sub }}>{p.capacidade ? `${p.capacidade} peças` : "—"}</td>
                <td className="px-2 py-1.5" style={{ color: C.sub }}>{p.chavePix}</td>
                {!free && <td className="px-2 py-1.5" style={{ color: p.endereco ? C.sub : C.yellow, maxWidth: 260 }}>{p.endereco || "sem endereço"}</td>}
                <td className="px-2 whitespace-nowrap">
                  <button onClick={() => setModal({ prestador: p })} title="Editar" className="mr-2" style={{ color: C.sub }}><Pencil size={13} /></button>
                  <button onClick={() => excluir(p)} title="Excluir" style={{ color: C.sub }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!lista.length && <div className="text-sm text-center py-8" style={{ color: C.sub }}>
        {d.prestadores.length ? "Ninguém com esse filtro." : `Nenhum ${free ? "freelancer" : "terceirizado"} cadastrado ainda.`}
      </div>}

      {modal && (
        <PrestadorModal user={user} tipo={tipo} prestador={modal.prestador} catalogo={catalogo}
          onClose={() => setModal(null)}
          onSalvo={(j) => { setModal(null); setD((x) => ({ ...x, prestadores: j.prestadores })); setAviso(`${j.prestador.nome} ${j.novo ? "cadastrado" : "atualizado"}.`); }} />
      )}
    </div>
  );
}
