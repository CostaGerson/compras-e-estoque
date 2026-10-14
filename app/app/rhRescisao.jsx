"use client";
// v204 — Rescisão pelo TRCT: lê o termo, mostra o que vai acontecer e aplica
// (conta a pagar do líquido na data limite · término do contrato na Matriz · TRCT nos documentos do funcionário)
import React, { useState, useEffect } from "react";
import { Loader2, UserX, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ModalContas as Modal, CoresContas as C } from "./contas";

const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const inp = "w-full rounded px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };

export default function RescisaoModal({ user, arquivo, onClose, onSalvo }) {
  const [st, setSt] = useState("Lendo o TRCT…");
  const [erro, setErro] = useState("");
  const [d, setD] = useState(null);          // { item, pessoas }
  const [b64, setB64] = useState("");
  const [f, setF] = useState({ pessoaId: "", vencimento: "", valor: "" });

  useEffect(() => {
    (async () => {
      try {
        const conteudo = await readB64(arquivo);
        setB64(conteudo);
        const j = await api("/api/rh/rescisao", "POST", { usuarioId: user.id, acao: "analisar", arquivos: [{ nome: arquivo.name, conteudo }] });
        const it = j.itens[0];
        if (it.erro) throw new Error(it.erro);
        setD({ item: it, pessoas: j.pessoas || [] });
        setF({ pessoaId: it.pessoaId || "", vencimento: it.vencimento, valor: it.trct.liquido });
      } catch (e) { setErro(e.message); }
      setSt("");
    })();
  }, []);

  const aplicar = async () => {
    setErro(""); setSt("Lançando…");
    try {
      const r = await api("/api/rh/rescisao", "POST", { usuarioId: user.id, acao: "aplicar", arquivo: { nome: arquivo.name, conteudo: b64 },
        pessoaId: f.pessoaId || null, vencimento: f.vencimento, valor: Number(String(f.valor).replace(",", ".")) });
      onSalvo(`Rescisão de ${d.item.trct.nome}: conta a pagar R$ ${brl(r.valor)} vencendo ${dBR(r.vencimento)}`
        + (r.desligado ? ` · ${r.desligado} desligado(a) em ${dBR(d.item.trct.afastamento)}` : " · ninguém desligado (funcionário não escolhido)")
        + (r.documento ? " · TRCT nos documentos do funcionário" : ""));
    } catch (e) { setErro(e.message); setSt(""); }
  };

  const t = d?.item?.trct;
  const p = d?.pessoas.find((x) => x.id === f.pessoaId);
  const ja = d?.item?.ja;
  const L = ({ k, v }) => <div><span style={{ color: C.sub }}>{k}:</span> <b>{v}</b></div>;

  return (
    <Modal titulo="Rescisão (TRCT)" icone={UserX} onClose={onClose} largura={640}
      rodape={<>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={aplicar} disabled={!t || !!st || !!ja} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: !t || ja ? C.sub : C.accent }}>
          {st && t && <Loader2 size={14} className="animate-spin" />} Lançar rescisão
        </button>
      </>}>
      {st && !t && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> {st}</div>}
      {erro && <div className="p-2.5 rounded-lg mb-3 text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {t && (
        <>
          <div className="p-3 rounded-lg text-xs grid gap-x-4 gap-y-1 mb-3" style={{ background: C.panel2, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <L k="Trabalhador" v={t.nome} />
            <L k="CPF" v={t.cpf || "—"} />
            <L k="Empresa" v={t.empresa || t.razao || "—"} />
            <L k="Admissão" v={dBR(t.admissao)} />
            <L k="Afastamento" v={dBR(t.afastamento)} />
            <L k="Código" v={t.codigo || "—"} />
            <div style={{ gridColumn: "1 / -1" }}><span style={{ color: C.sub }}>Causa:</span> {t.causa || "—"}</div>
            <L k="Total bruto" v={brl(t.bruto)} />
            <L k="Deduções" v={brl(t.deducoes)} />
            <L k="Líquido" v={`R$ ${brl(t.liquido)}`} />
          </div>
          {ja && <div className="p-2.5 rounded-lg mb-3 text-xs flex items-center gap-1.5" style={{ background: C.yellowSoft, color: C.yellow }}><AlertTriangle size={13} /> Já lançada: "{ja.titulo}".</div>}
          {(d.item.avisos || []).map((a, i) => <div key={i} className="p-2 rounded-lg mb-2 text-xs flex items-center gap-1.5" style={{ background: C.yellowSoft, color: C.text }}><AlertTriangle size={13} style={{ color: C.yellow }} /> {a}</div>)}
          <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
            <label className="text-xs" style={{ color: C.sub }}>Funcionário (Matriz){d.item.por ? ` · casado por ${d.item.por.toLowerCase()}` : ""}
              <select value={f.pessoaId} onChange={(e) => setF((x) => ({ ...x, pessoaId: e.target.value }))} className={inp} style={inpS}>
                <option value="">— não está na Matriz —</option>
                {d.pessoas.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.nomeCompleto ? ` (${x.nomeCompleto})` : ""} · {x.depto} · {x.empresa}{x.ativo ? "" : " · DESLIGADO"}</option>)}
              </select>
            </label>
            <label className="text-xs" style={{ color: C.sub }}>Data limite (pagamento)
              <input type="date" value={f.vencimento} onChange={(e) => setF((x) => ({ ...x, vencimento: e.target.value }))} className={inp} style={inpS} />
            </label>
            <label className="text-xs" style={{ color: C.sub }}>Valor (R$)
              <input value={f.valor} onChange={(e) => setF((x) => ({ ...x, valor: e.target.value }))} className={inp} style={inpS} />
            </label>
          </div>
          <div className="mt-3 text-xs" style={{ color: C.sub }}>
            <div className="font-semibold mb-1" style={{ color: C.navy }}>Ao lançar:</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: C.green }} /> Conta a pagar "{t.empresa === "NORT" ? "NORT - " : ""}RESCISÃO {t.nome}" de R$ {brl(f.valor)} vencendo {dBR(f.vencimento)} (10 dias do término, art. 477 CLT), com o TRCT anexado</div>
            {p ? <>
              <div className="flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: C.green }} /> Término do contrato de {p.nome} em {dBR(t.afastamento)}: sai da Matriz e o card vai para os desligados</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: C.green }} /> TRCT nos documentos do funcionário (tipo RESCISÃO)</div>
            </> : <div className="flex items-center gap-1.5"><AlertTriangle size={12} style={{ color: C.yellow }} /> Sem funcionário escolhido: ninguém é desligado e o TRCT fica só na conta a pagar</div>}
            <div className="flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: C.green }} /> Aviso ao financeiro</div>
          </div>
        </>
      )}
    </Modal>
  );
}
