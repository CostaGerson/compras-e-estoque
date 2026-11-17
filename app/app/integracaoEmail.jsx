"use client";
// v895 — Integrações › E-mail: configuração do Resend (chave, remetente, domínio/DNS, verificação e teste) — só master
import React, { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { alerta, perguntar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", red: "#D92D20" };

// v511 — situação do envio de e-mails (Resend) e teste
// v893 — configurar pela tela: chave da API, remetente, domínio (registros DNS) e verificação
export default function IntegracaoEmail({ user: master }) {
  const [st, setSt] = useState(null);
  const [env, setEnv] = useState(false);
  const [f, setF] = useState({ chave: "", from: "" });
  const [ocup, setOcup] = useState("");
  const carregar = () => fetch(`/api/email/teste?u=${master.id}`).then((r) => r.json()).then((x) => { setSt(x); setF((o) => ({ chave: "", from: o.from || x.remetente || "ERP Meridian <nao-responda@meridianpro.com.br>" })); }).catch(() => {});
  useEffect(() => { if (master?.id) carregar(); }, [master?.id]);
  if (st?.error) return <div className="text-sm" style={{ color: C.red }}>{st.error}</div>;
  const post = async (acao, extra = {}) => {
    setOcup(acao);
    const r = await fetch("/api/email/teste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: master.id, acao, ...extra }) });
    const x = await r.json().catch(() => ({}));
    setOcup("");
    if (x.chave !== undefined) setSt(x);
    if (!r.ok) alerta(`Falhou: ${x.error || "erro"}`);
    return r.ok ? x : null;
  };
  const testar = async () => {
    const para = await perguntar("Enviar o e-mail de teste para:", st.emailUsuario || "");
    if (!para) return;
    setEnv(true);
    const x = await post("teste", { para });
    setEnv(false);
    if (x) alerta(`E-mail de teste enviado para ${x.para}. Confira a caixa de entrada (e o spam).`);
  };
  if (!st) return <div className="text-sm" style={{ color: C.sub }}>Carregando…</div>;
  const D = st.dominio;
  const corSt = (v) => (v === "verified" ? "#12A150" : v === "failed" ? "#D92D20" : "#C08401");
  const txtSt = (v) => ({ verified: "verificado", pending: "aguardando DNS", not_started: "não verificado", failed: "falhou", temporary_failure: "falha temporária", nao_cadastrado: "não cadastrado no Resend" }[v] || v);
  const copiar = (t) => { try { navigator.clipboard.writeText(t); } catch {} };
  return (
    <div className="max-w-4xl">
      <div className="rounded-xl p-4 text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text }}>
          <div className="flex items-center gap-2 mb-2"><Mail size={16} style={{ color: C.accent }} /><span className="font-semibold flex-1" style={{ color: C.navy }}>E-mail (Resend)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: st.ok ? "#E7F6EE" : "#FDECEA", color: st.ok ? "#12A150" : "#D92D20" }}>{st.ok ? `ativo · ${st.remetente}` : "não configurado"}</span></div>
          <div className="text-xs mb-3" style={{ color: C.sub }}>1) Crie a conta em resend.com · 2) em API Keys, crie uma chave com <b>Full access</b> e cole aqui · 3) salve, cadastre o domínio e copie os registros para o DNS · 4) clique em Verificar.</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label><div className="text-xs mb-1" style={{ color: C.sub }}>Chave da API {st.chave ? <span>(atual: {st.chaveMascara}{st.origem === "env" ? " · do .env" : ""} — deixe em branco para manter)</span> : null}</div>
              <input value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value.trim() })} placeholder="re_…" className="w-full px-2 py-1.5 rounded outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
            <label><div className="text-xs mb-1" style={{ color: C.sub }}>Remetente (nome e e-mail do domínio)</div>
              <input value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} placeholder="ERP Meridian <nao-responda@meridianpro.com.br>" className="w-full px-2 py-1.5 rounded outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button disabled={!!ocup} onClick={async () => { if (await post("salvar", f)) setF((o) => ({ ...o, chave: "" })); }} className="px-3 py-1.5 rounded-md font-semibold" style={{ background: C.accent, color: "#fff" }}>{ocup === "salvar" ? "Salvando…" : "Salvar"}</button>
          </div>
          {st.chave && D && <div className="mt-4 rounded-lg p-3" style={{ border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-2"><b>Domínio {D.nome}</b>{D.status && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "#F1F3F5", color: corSt(D.status) }}>{txtSt(D.status)}</span>}
              <span className="ml-auto flex gap-2">
                {D.status === "nao_cadastrado" && <button disabled={!!ocup} onClick={() => post("dominio")} className="px-2 py-1 rounded-md font-semibold" style={{ background: "#001E41", color: "#fff" }}>{ocup === "dominio" ? "Cadastrando…" : "Cadastrar no Resend"}</button>}
                {D.id && D.status !== "verified" && <button disabled={!!ocup} onClick={() => post("verificar")} className="px-2 py-1 rounded-md font-semibold" style={{ background: "#001E41", color: "#fff" }}>{ocup === "verificar" ? "Verificando…" : "Verificar"}</button>}
                <button disabled={!!ocup} onClick={carregar} className="px-2 py-1 rounded-md" style={{ border: `1px solid ${C.line}` }}>Atualizar</button>
              </span></div>
            {D.erro && <div className="text-xs" style={{ color: "#D92D20" }}>{D.erro}</div>}
            {(D.registros || []).length > 0 && <>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Crie estes registros no DNS do domínio (onde o domínio está hospedado). Clique no valor para copiar.</div>
              <table className="w-full text-[11px]"><thead><tr style={{ color: C.sub }}><th className="text-left p-1">Tipo</th><th className="text-left p-1">Nome</th><th className="text-left p-1">Valor</th><th className="text-left p-1">Prior.</th><th className="text-left p-1">Status</th></tr></thead>
                <tbody>{D.registros.map((r, i) => <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="p-1 font-semibold">{r.tipo}</td>
                  <td className="p-1 cursor-pointer" title="Copiar" onClick={() => copiar(r.nome)}>{r.nome}</td>
                  <td className="p-1 cursor-pointer" title="Copiar" onClick={() => copiar(r.valor)} style={{ wordBreak: "break-all", maxWidth: 320 }}>{r.valor}</td>
                  <td className="p-1">{r.prioridade ?? ""}</td>
                  <td className="p-1 font-semibold" style={{ color: corSt(r.status) }}>{txtSt(r.status)}</td></tr>)}</tbody></table></>}
          </div>}
          {st.ok && <div className="flex justify-end mt-3"><button onClick={testar} disabled={env} className="px-3 py-1.5 rounded-md" style={{ border: `1px solid ${C.line}` }}>{env ? "Enviando…" : "Enviar e-mail de teste"}</button></div>}
      </div>
    </div>
  );
}
