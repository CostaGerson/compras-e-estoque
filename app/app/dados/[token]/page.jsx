"use client";
// v699 — link público de dados unitários: cada pessoa escolhe o tamanho e preenche os dados da(s) sua(s) peça(s).
// Sem login (vale o link). Pensado para o celular.
import React, { useEffect, useState } from "react";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", red: "#D92D20", roxo: "#3D6799" };
const inp = { background: "#F1F3F5", color: C.text, border: `1px solid ${C.line}` };
const localTxt = (l) => String(l || "").toLowerCase().replace(/^frente /, "frente · ").replace(/^costas /, "costas · ");

function Tela({ children }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Montserrat, system-ui, sans-serif", color: C.text }}>
      <div style={{ background: C.navy }} className="px-4 py-3.5 flex items-center"><img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 22, width: "auto" }} /></div>
      <div className="max-w-xl mx-auto p-3">{children}</div>
    </div>
  );
}

export default function PreencherDados({ params }) {
  const token = params.token;
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [pecas, setPecas] = useState([{ tam: "", valores: {} }]);
  const [st, setSt] = useState("");
  const [ok, setOk] = useState(null);
  const ler = () => fetch(`/api/dados-link/${token}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.error) setErro(j.error); else setD(j); }).catch(() => setErro("Sem conexão. Tente de novo."));
  useEffect(() => { ler(); }, []);

  if (erro && !d) return <Tela><div className="p-6 text-center text-sm" style={{ color: C.red }}>{erro}</div></Tela>;
  if (!d) return <Tela><div className="p-6 text-center text-sm" style={{ color: C.sub }}>Carregando…</div></Tela>;
  const campos = d.campos || [];
  const up = (i, patch) => setPecas((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const upV = (i, k, v) => setPecas((l) => l.map((p, j) => (j === i ? { ...p, valores: { ...p.valores, [k]: v } } : p)));
  const nova = (clonar) => setPecas((l) => [...l, clonar ? { tam: l[l.length - 1].tam, valores: { ...l[l.length - 1].valores } } : { tam: "", valores: {} }]);
  const enviar = async () => {
    const i = pecas.findIndex((p) => !p.tam);
    if (i >= 0) { setErro(`Peça ${i + 1}: escolha o tamanho.`); return; }
    const resumo = pecas.map((p, k) => `${k + 1}. Tamanho ${p.tam} — na peça: ${campos.map((c) => `"${p.valores[c.id] || ""}"${campos.length > 1 ? ` (${localTxt(c.local)})` : ""}`).join(", ")}`).join("\n");
    if (!window.confirm(`Confira o que vai sair na(s) peça(s):\n\n${resumo}`)) return;
    setSt("Enviando…"); setErro("");
    try {
      const r = await fetch(`/api/dados-link/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsavel: nome, pecas }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível enviar.");
      setOk(j.n); setPecas([{ tam: "", valores: {} }]); ler();
    } catch (e) { setErro(e.message); }
    setSt("");
  };

  return (
    <Tela>
      <div className="rounded-xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="text-xs font-semibold" style={{ color: C.sub }}>{d.clienteNome || "Pedido"}</div>
        <div className="text-lg font-bold" style={{ color: C.navy }}>{d.titulo}</div>
        <div className="text-base font-semibold mt-2" style={{ color: C.text }}>Escolha os detalhes da sua camisa</div>
        <div className="text-sm mt-1" style={{ color: C.sub }}>Escolha o tamanho e escreva a inscrição que vai na sua peça. Quer mais de uma? Adicione outra peça antes de enviar.</div>
        {d.limite && <div className="text-xs mt-2 font-semibold" style={{ color: d.aberto ? C.accent : C.red }}>{d.aberto ? "Preencha até" : "Encerrado em"} {new Date(d.limite).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>}
      </div>
      {!d.aberto ? (
        <div className="rounded-xl p-5 text-center text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>O preenchimento foi encerrado. Fale com quem enviou o link.</div>
      ) : ok != null ? (
        <div className="rounded-xl p-5 text-center" style={{ background: C.panel, border: `1px solid ${C.green}55` }}>
          <div className="text-lg font-bold" style={{ color: C.green }}>Recebido! ✓</div>
          <div className="text-sm mt-1" style={{ color: C.sub }}>{ok} peça(s) registrada(s).</div>
          <button onClick={() => setOk(null)} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Preencher para outra pessoa</button>
        </div>
      ) : (
        <>
          <div className="rounded-xl p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <label className="text-sm font-semibold" style={{ color: C.navy }}>Quem está pedindo?</label>
            <div className="text-xs" style={{ color: C.sub }}>Só para identificarmos o seu pedido. <b>Este nome NÃO vai na camisa</b> — o que vai na peça você escreve abaixo.</div>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome (opcional)" className="w-full rounded-lg px-3 py-2 mt-1.5 text-sm outline-none" style={inp} />
          </div>
          {pecas.map((p, i) => (
            <div key={i} className="rounded-xl p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-center mb-2">
                <div className="font-bold text-sm" style={{ color: C.navy }}>Peça {i + 1}</div>
                {pecas.length > 1 && <button onClick={() => setPecas((l) => l.filter((_, j) => j !== i))} className="ml-auto text-xs" style={{ color: C.red }}>remover</button>}
              </div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Tamanho</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(d.tamanhos || []).map((t) => (
                  <button key={t} onClick={() => up(i, { tam: t })} className="px-3 py-2 rounded-lg text-sm font-bold" style={{ minWidth: 48, background: p.tam === t ? C.accent : "#F1F3F5", color: p.tam === t ? "#fff" : C.text, border: `1px solid ${p.tam === t ? C.accent : C.line}` }}>{t}</button>
                ))}
              </div>
              <div className="rounded-lg p-2.5" style={{ background: "#FFF0E6", border: `1px solid ${C.accent}44` }}>
                <div className="text-xs font-bold mb-1.5" style={{ color: C.accent }}>O QUE VAI ESCRITO NA PEÇA</div>
                {campos.map((c) => (
                  <div key={c.id} className="mb-2 last:mb-0">
                    <div className="text-xs" style={{ color: C.text }}><b>Inscrição</b> <span style={{ color: C.sub }}>— {localTxt(c.local)}</span></div>
                    <input value={p.valores[c.id] || ""} onChange={(e) => upV(i, c.id, e.target.value)} placeholder={`como deve sair na camisa`} className="w-full rounded-lg px-3 py-2 mt-0.5 text-base font-semibold outline-none" style={{ ...inp, background: "#fff" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2 mb-3">
            <button onClick={() => nova(true)} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px dashed ${C.roxo}`, color: C.roxo, background: C.panel }}>+ outra peça (copiar a anterior)</button>
            <button onClick={() => nova(false)} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px dashed ${C.roxo}`, color: C.roxo, background: C.panel }}>+ outra peça (em branco)</button>
          </div>
          {erro && <div className="mb-3 p-2 rounded text-sm" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>}
          <button onClick={enviar} disabled={!!st} className="w-full px-4 py-3 rounded-xl text-base font-bold" style={{ background: C.accent, color: "#fff" }}>{st || `Enviar ${pecas.length} peça(s)`}</button>
        </>
      )}
    </Tela>
  );
}
