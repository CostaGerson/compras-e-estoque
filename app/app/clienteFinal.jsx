"use client";
// v709 — formulário "Dados do cliente e envio": pessoa física ou jurídica + endereço de entrega (CEP preenche rua, bairro e cidade)
import React, { useState } from "react";
import { User, Building2, Loader2 } from "lucide-react";
import { linhasClienteFinal } from "@/lib/clienteFinal";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", accentSoft: "#FFF0E6", red: "#D92D20" };
const inp = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const so = (s) => String(s || "").replace(/\D/g, "");
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

function Campo({ l, obrig, span = 1, children }) {
  return (
    <label className="block text-xs" style={{ color: C.sub, gridColumn: `span ${span} / span ${span}` }}>
      <span className="block mb-1">{l}{obrig && <span style={{ color: C.red }}> *</span>}</span>{children}
    </label>
  );
}

export default function ClienteFinalForm({ valor, onChange, mobile }) {
  const v = valor || {};
  const [buscandoCep, setBuscandoCep] = useState(false);
  const set = (k, x) => onChange({ ...v, [k]: x });
  const I = (k, props = {}) => <input value={v[k] || ""} onChange={(e) => set(k, e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inp} {...props} />;
  const lerCep = async (cep) => {
    const c = so(cep);
    if (c.length !== 8) return;
    setBuscandoCep(true);
    try {
      const j = await fetch(`https://viacep.com.br/ws/${c}/json/`).then((r) => r.json());
      if (j && !j.erro) onChange({ ...v, cep: `${c.slice(0, 5)}-${c.slice(5)}`, rua: v.rua || j.logradouro || "", bairro: v.bairro || j.bairro || "", cidade: j.localidade || v.cidade || "", uf: j.uf || v.uf || "" });
    } catch {}
    setBuscandoCep(false);
  };
  const cols = mobile ? 2 : 6;
  const PF = v.tipo !== "PJ";
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {[["PF", "Pessoa física", User], ["PJ", "Pessoa jurídica", Building2]].map(([k, t, Ic]) => {
          const on = (v.tipo || "PF") === k;
          return (
            <button key={k} type="button" onClick={() => set("tipo", k)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
              style={on ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}><Ic size={15} /> {t}</button>
          );
        })}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {PF ? (
          <>
            <Campo l="Nome completo" obrig span={mobile ? 2 : 4}>{I("nome", { autoComplete: "name" })}</Campo>
            <Campo l="CPF" obrig span={2}>{I("cpf", { inputMode: "numeric", placeholder: "000.000.000-00" })}</Campo>
          </>
        ) : (
          <>
            <Campo l="Razão social" obrig span={mobile ? 2 : 3}>{I("razaoSocial")}</Campo>
            <Campo l="CNPJ" obrig span={mobile ? 2 : 2}>{I("cnpj", { inputMode: "numeric", placeholder: "00.000.000/0000-00" })}</Campo>
            <Campo l="Inscrição estadual" obrig span={mobile ? 2 : 1}>{I("ie", { placeholder: "ou ISENTO" })}</Campo>
            <Campo l="Contato (quem está tratando)" obrig span={mobile ? 2 : 3}>{I("contato")}</Campo>
            <Campo l="Cargo na empresa" obrig span={mobile ? 2 : 3}>{I("cargo")}</Campo>
          </>
        )}
        <div className="text-[11px] font-bold uppercase tracking-wide pt-1" style={{ color: C.sub, gridColumn: `span ${cols} / span ${cols}` }}>Endereço de entrega</div>
        <Campo l="CEP" obrig span={mobile ? 2 : 1}>
          <div className="relative">{I("cep", { inputMode: "numeric", placeholder: "00000-000", onBlur: (e) => lerCep(e.target.value) })}
            {buscandoCep && <Loader2 size={14} className="animate-spin absolute right-2 top-2.5" style={{ color: C.sub }} />}</div>
        </Campo>
        <Campo l="Rua" obrig span={mobile ? 2 : 3}>{I("rua")}</Campo>
        <Campo l="Número" obrig span={1}>{I("numero", { placeholder: "ou S/N" })}</Campo>
        <Campo l="Complemento" span={1}>{I("complemento")}</Campo>
        <Campo l="Bairro" obrig span={2}>{I("bairro")}</Campo>
        <Campo l="Cidade" obrig span={mobile ? 1 : 3}>{I("cidade")}</Campo>
        <Campo l="UF" obrig span={1}>
          <select value={v.uf || ""} onChange={(e) => set("uf", e.target.value)} className="w-full rounded-lg px-2 py-2 text-sm outline-none" style={inp}>
            <option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Campo>
        <div className="text-[11px] font-bold uppercase tracking-wide pt-1" style={{ color: C.sub, gridColumn: `span ${cols} / span ${cols}` }}>Contato</div>
        <Campo l="WhatsApp com DDD" obrig span={mobile ? 2 : 2}>{I("whatsapp", { inputMode: "tel", placeholder: "(31) 99999-9999" })}</Campo>
        <Campo l="E-mail" obrig span={mobile ? 2 : 4}>{I("email", { type: "email", autoComplete: "email" })}</Campo>
      </div>
    </div>
  );
}

// bloco só de leitura (Meus pedidos, lançamento interno)
export function ClienteFinalResumo({ c, titulo = "Cliente final e envio" }) {
  const l = linhasClienteFinal(c);
  if (!l.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs" style={{ background: C.accentSoft, border: `1px solid ${C.accent}44` }}>
      <div className="font-bold mb-1" style={{ color: C.accent }}>{titulo}</div>
      {l.map(([k, x]) => <div key={k}><span style={{ color: C.sub }}>{k}:</span> <b style={{ color: C.text }}>{x}</b></div>)}
    </div>
  );
}
