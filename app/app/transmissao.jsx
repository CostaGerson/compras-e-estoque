"use client";
// v171 — Transmissão de arquivos: um só lugar para enviar todos os documentos.
// O sistema identifica cada arquivo, agrupa pelo destino e abre a tela certa já com os arquivos
// (lançamentos, baixas, NFs, retorno, antecipação, posição, histórico, cartão de ponto, contabilidade).
import React, { useState, useEffect, useRef } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Send, FileText, X, Play, Lock, Inbox } from "lucide-react";
import { unzipSync } from "fflate";
import { gerencial, temAlguma } from "@/lib/acesso";
import { DESTINOS } from "@/lib/finTransmissaoDestinos";
import { DocumentoModal, PosicaoModal, AntecipacaoModal, RetornoModal, CoresContas as C } from "./contas";
import { ImportarNfs } from "./adm";
import { ImportarPonto } from "./rhPainel";

const ORDEM = ["DOCUMENTO", "NF", "RETORNO", "ANTECIPACAO", "POSICAO", "HISTORICO", "PONTO", "OFX", "SPED", "DESCONHECIDO"];
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const readU8 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(new Uint8Array(fr.result)); fr.readAsArrayBuffer(f); });
const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}
export const podeDestino = (user, destino) => gerencial(user) || (DESTINOS[destino]?.perms || []).some((p) => temAlguma(user, p));

// expande ZIPs (inclusive vários níveis) em File[]
async function expandir(files) {
  const out = [];
  for (const f of [...(files || [])]) {
    if (/\.zip$/i.test(f.name)) {
      try {
        const ent = unzipSync(await readU8(f));
        const dentro = Object.entries(ent)
          .filter(([cam, u8]) => { const n = cam.split("/").pop(); return n && !cam.includes("__MACOSX") && !n.startsWith(".") && u8.length; })
          .map(([cam, u8]) => new File([u8], cam.split("/").pop()));
        out.push(...(await expandir(dentro)));
      } catch { out.push(f); }
    } else out.push(f);
  }
  return out;
}

// monta os grupos (um por destino; alguns destinos abrem um arquivo por vez)
export function agrupar(itens) {
  const g = [];
  for (const d of ORDEM) {
    const doD = itens.filter((i) => i.destino === d);
    if (!doD.length) continue;
    if (DESTINOS[d].porArquivo) doD.forEach((i, k) => g.push({ chave: `${d}#${k}`, destino: d, itens: [i] }));
    else g.push({ chave: d, destino: d, itens: doD });
  }
  return g;
}

export default function Transmissao({ user, Historico }) {
  const [itens, setItens] = useState(null);       // [{ nome, destino, detalhe, motivo, competencia, tipoId, file }]
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState({});        // chave do grupo → { k: "ok"|"visto"|"erro", msg }
  const [aberto, setAberto] = useState(null);      // grupo com a tela aberta
  const [auto, setAuto] = useState(false);         // processar tudo em sequência
  const [contas, setContas] = useState([]);
  const [sobre, setSobre] = useState(0);
  const inp = useRef(null);
  useEffect(() => { api(`/api/fin/contas?u=${user.id}`).then((c) => setContas(Array.isArray(c) ? c : c.contas || [])).catch(() => setContas([])); }, []);

  const receber = async (files) => {
    setErro(""); setSt("Abrindo os arquivos…");
    try {
      const lista = await expandir(files);
      if (!lista.length) { setSt(""); return; }
      const novos = [];
      // em lotes (até ~8 MB por envio) para identificar no servidor
      let lote = [], tam = 0;
      const enviar = async () => {
        if (!lote.length) return;
        setSt(`Identificando ${novos.length + lote.length}/${lista.length}…`);
        const arquivos = await Promise.all(lote.map(async (f) => ({ nome: f.name, conteudo: await readB64(f) })));
        const j = await api("/api/fin/transmissao", "POST", { usuarioId: user.id, acao: "identificar", arquivos });
        j.itens.forEach((it, k) => novos.push({ ...it, file: lote[k] }));
        lote = []; tam = 0;
      };
      for (const f of lista) {
        if (lote.length && (tam + f.size > 8 * 1048576 || lote.length >= 10)) await enviar();
        lote.push(f); tam += f.size;
      }
      await enviar();
      setItens((v) => {
        const ja = new Set((v || []).map((x) => `${x.nome}|${x.file?.size}`));
        return [...(v || []), ...novos.filter((x) => !ja.has(`${x.nome}|${x.file?.size}`))];
      });
    } catch (e) { setErro(e.message); }
    setSt("");
  };

  const grupos = itens ? agrupar(itens) : [];
  const pendentes = grupos.filter((g) => g.destino !== "DESCONHECIDO" && podeDestino(user, g.destino) && !["ok"].includes(estado[g.chave]?.k));
  const marcar = (g, k, msg) => setEstado((e) => ({ ...e, [g.chave]: { k, msg } }));
  const proximo = (feito) => {
    const resto = pendentes.filter((g) => g.chave !== feito.chave && !estado[g.chave]);
    setAberto(null);
    if (auto && resto.length) setTimeout(() => abrir(resto[0]), 50); else setAuto(false);
  };
  const fechar = (g) => { if (!estado[g.chave]) marcar(g, "visto", "Tela fechada sem concluir"); proximo(g); };
  const salvo = (g, msg) => { marcar(g, "ok", msg || "Concluído"); proximo(g); };

  // OFX e SPED vão direto para o pacote da contabilidade do mês
  const enviarDireto = async (g) => {
    marcar(g, "enviando", "");
    const msgs = []; let falhou = false;
    for (const it of g.itens) {
      try {
        if (!/^\d{4}-\d{2}$/.test(it.competencia || "")) throw new Error("mês não identificado");
        if (it.destino === "OFX" && !it.tipoId) throw new Error("banco não identificado — envie pela Contabilidade do mês");
        const conteudo = await readB64(it.file);
        const j = await api("/api/fin/contab", "POST", { usuarioId: user.id, competencia: it.competencia, categoria: it.destino === "OFX" ? "EXTRATO" : "SPED", tipoId: it.tipoId, nome: it.nome, conteudo });
        const e = (j.resultados || []).find((x) => !x.ok);
        if (e) throw new Error(e.erro || "erro ao enviar");
        msgs.push(`${it.nome} → contabilidade ${it.competencia}`);
      } catch (e) { falhou = true; msgs.push(`${it.nome}: ${e.message}`); }
    }
    marcar(g, falhou ? "erro" : "ok", msgs.join(" · "));
  };
  const abrir = (g) => {
    const def = DESTINOS[g.destino];
    if (def.direto) { enviarDireto(g).then(() => proximo(g)); return; }
    setAberto(g);
  };
  const processarTudo = () => {
    const fila = pendentes.filter((g) => !estado[g.chave]);
    if (!fila.length) return;
    setAuto(true); abrir(fila[0]);
  };
  const tirar = (it) => setItens((v) => v.filter((x) => x !== it));
  const ev = (f) => (e) => { e.preventDefault(); e.stopPropagation(); f(e); };
  const files = aberto ? aberto.itens.map((i) => i.file) : [];

  return (
    <div className="rounded-2xl mb-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="rounded-xl p-2.5" style={{ background: C.navy }}><Inbox size={22} style={{ color: C.accent }} /></div>
        <div className="flex-1">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Transmissão de arquivos</div>
          <div className="text-xs" style={{ color: C.sub }}>Envie qualquer documento: o sistema identifica o que é, leva para o lugar certo e já sugere lançamentos e baixas.</div>
        </div>
        {itens?.length > 0 && <>
          {pendentes.some((g) => !estado[g.chave]) && (
            <button onClick={processarTudo} disabled={!!st || !!aberto} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>
              <Play size={14} /> Processar tudo
            </button>
          )}
          <button onClick={() => { setItens(null); setEstado({}); }} className="px-3 py-2 rounded-lg text-sm" style={{ color: C.sub, border: `1px solid ${C.line}` }}>Limpar</button>
        </>}
      </div>

      <div className="px-5 pb-5">
        <div onDragEnter={ev(() => setSobre((n) => n + 1))} onDragOver={ev(() => {})} onDragLeave={ev(() => setSobre((n) => Math.max(0, n - 1)))}
          onDrop={ev((e) => { setSobre(0); if (!st) receber(e.dataTransfer?.files); })} onClick={() => !st && inp.current?.click()}
          className="rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
          style={{ minHeight: itens?.length ? 90 : 150, border: `2px dashed ${sobre ? C.accent : C.line}`, background: sobre ? C.accentSoft : C.panel2, padding: 18 }}>
          {st ? <Loader2 size={28} className="animate-spin" style={{ color: C.accent }} /> : <Upload size={28} style={{ color: C.accent }} />}
          <div className="font-semibold mt-1.5" style={{ color: C.navy }}>{st || "Arraste aqui os arquivos ou clique para escolher"}</div>
          {!st && <div className="text-[11px] mt-1" style={{ color: C.sub }}>
            PDF (boletos, guias, folha, recibos, comprovantes, extratos, faturas, DANFE, contrato de antecipação, cartão de ponto) · XML de NF · retorno CNAB (.RET) · OFX · SPED · planilha de posição (.xls) · histórico (.txt) · ZIP com tudo isso
          </div>}
          <input ref={inp} type="file" multiple className="hidden" onChange={(e) => { receber(e.target.files); e.target.value = ""; }} />
        </div>
        {erro && <div className="p-2.5 rounded-lg mt-3 text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

        {grupos.length > 0 && (
          <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {grupos.map((g) => {
              const def = DESTINOS[g.destino];
              const pode = podeDestino(user, g.destino);
              const e = estado[g.chave];
              const desconhecido = g.destino === "DESCONHECIDO";
              const cor = desconhecido ? C.red : e?.k === "ok" ? C.green : e?.k === "erro" ? C.red : !pode ? C.sub : C.accent;
              return (
                <div key={g.chave} className="rounded-xl p-3.5 flex flex-col" style={{ border: `1px solid ${C.line}`, borderTop: `3px solid ${cor}` }}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm" style={{ color: C.navy }}>{def.rotulo}</div>
                      <div className="text-[11px]" style={{ color: C.sub }}>{def.desc}</div>
                    </div>
                    {e?.k === "ok" && <CheckCircle2 size={18} style={{ color: C.green }} />}
                    {(e?.k === "erro" || desconhecido) && <AlertTriangle size={18} style={{ color: C.red }} />}
                    {!pode && !desconhecido && <Lock size={16} style={{ color: C.sub }} title="Sem permissão" />}
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    {g.itens.map((it, k) => (
                      <div key={k} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ background: C.panel2 }}>
                        <FileText size={13} style={{ color: C.accent }} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate" title={it.nome}>{it.nome}</div>
                          {(it.detalhe || it.motivo) && <div className="text-[10px] truncate" style={{ color: it.motivo ? C.red : C.sub }}>{it.motivo || it.detalhe}</div>}
                        </div>
                        <span className="text-[10px]" style={{ color: C.sub }}>{kb(it.file?.size || 0)}</span>
                        {!e && <button onClick={() => tirar(it)} title="Tirar" style={{ color: C.sub }}><X size={12} /></button>}
                      </div>
                    ))}
                  </div>
                  {e?.msg && <div className="text-[11px] mt-2" style={{ color: e.k === "ok" ? C.green : e.k === "erro" ? C.red : C.sub }}>{e.msg}</div>}
                  {!desconhecido && (
                    <div className="mt-auto pt-2.5 flex justify-end">
                      {!pode ? <span className="text-[11px]" style={{ color: C.sub }}>Seu usuário não tem permissão para este tipo</span>
                        : e?.k === "enviando" ? <span className="text-xs flex items-center gap-1" style={{ color: C.sub }}><Loader2 size={13} className="animate-spin" /> Enviando…</span>
                        : e?.k === "ok" ? null
                        : <button onClick={() => abrir(g)} disabled={!!aberto} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}>
                            <Send size={13} /> {def.direto ? "Enviar" : e ? "Abrir de novo" : "Processar"}
                          </button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {aberto?.destino === "DOCUMENTO" && <DocumentoModal user={user} contas={contas} iniciais={files} onClose={() => fechar(aberto)} onSalvo={(m) => salvo(aberto, m)} />}
      {aberto?.destino === "NF" && <ImportarNfs user={user} iniciais={files} onClose={() => fechar(aberto)} onFim={(m) => salvo(aberto, m)} />}
      {aberto?.destino === "RETORNO" && <RetornoModal user={user} iniciais={files} onClose={() => fechar(aberto)} onSalvo={(m) => salvo(aberto, m)} />}
      {aberto?.destino === "ANTECIPACAO" && <AntecipacaoModal user={user} iniciais={files} onClose={() => fechar(aberto)} onSalvo={(m) => salvo(aberto, m)} />}
      {aberto?.destino === "POSICAO" && <PosicaoModal user={user} contas={contas} iniciais={files} onClose={() => fechar(aberto)} onSalvo={(m) => salvo(aberto, m)} />}
      {aberto?.destino === "PONTO" && <ImportarPonto user={user} iniciais={files} onClose={() => fechar(aberto)} onFim={(m) => salvo(aberto, m)} />}
      {aberto?.destino === "HISTORICO" && Historico && <Historico user={user} iniciais={files} fechar={(ok) => (ok ? salvo(aberto, "Histórico gravado") : fechar(aberto))} />}
    </div>
  );
}
