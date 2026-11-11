"use client";
// v452 — app do motorista (celular): só a rota designada a ele, em botões grandes.
// Uma perna por vez: INICIAR → abre Waze ou Google Maps só até a próxima parada → CHEGUEI E CONCLUÍ → próxima…
// No fim, a volta à fábrica e "CHEGUEI NA FÁBRICA".
import React, { useEffect, useState } from "react";
import { Loader2, Phone, LogOut, RefreshCw, Undo2, Clock, MapPin } from "lucide-react";
import AvisosPush from "./avisosPush";   // v466

const C = { navy: "#001E41", accent: "#FF6B1A", green: "#12A150", greenSoft: "#E7F6EE", bg: "#F2F4F7", panel: "#FFFFFF", line: "#E4E7EC", text: "#1F2733", sub: "#667085", red: "#D92D20", waze: "#33CCFF", yellow: "#C08401", yellowSoft: "#FFF6DD" };
const OBJ = { COLETA: ["📦", "Coleta"], ENTREGA: ["🚚", "Entrega"], COLETA_ENTREGA: ["🔄", "Coleta e entrega"], COMPRA: ["🛒", "Compra"], RETORNO: ["🏭", "Retorno à fábrica"] };   // v521
const sc = (t) => { const s0 = String(t || "").toLocaleLowerCase("pt-BR"); return s0.charAt(0).toLocaleUpperCase("pt-BR") + s0.slice(1); };
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const curto = (n) => { const p = String(n || "").toUpperCase().trim().split(/\s+/).filter(Boolean); return p.length > 1 && p[0].length <= 3 ? `${p[0]} ${p[1]}` : p[0] || ""; };
const semCep = (e) => String(e || "").replace(/,?\s*(CEP\s*)?\d{5}-?\d{3}\b/gi, "").replace(/,?\s*Brasil$/i, "").trim();
const waze = (p) => (p?.lat != null ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(semCep(p?.endereco))}&navigate=yes`);
const gmaps = (p) => `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(p?.lat != null ? `${p.lat},${p.lng}` : semCep(p?.endereco))}`;
const tel = (t) => String(t || "").replace(/\D/g, "");

async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
}

function Botao({ cor, fundo, children, onClick, href, disabled, grande }) {
  const st = { background: fundo, color: cor, minHeight: grande ? 76 : 60, fontSize: grande ? 22 : 18, opacity: disabled ? 0.5 : 1 };
  const cls = "w-full rounded-2xl font-extrabold flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-transform select-none";
  return href ? <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={cls} style={st}>{children}</a>
    : <button type="button" onClick={onClick} disabled={disabled} className={cls} style={st}>{children}</button>;
}

// trilha da rota: 🏭 → 1 → 2 → … → 🏭, com o caminhão na perna atual
function Trilha({ paradas, atual, volta, fim }) {
  const pontos = [{ k: "f0", t: "🏭", feito: true }, ...paradas.map((p, i) => ({ k: p.id, t: String(i + 1), feito: p.status === "CONCLUIDA", atual: i === atual })), { k: "f1", t: "🏭", feito: fim, atual: volta && !fim }];
  return (
    <div className="flex items-center px-2 py-3">
      {pontos.map((p, i) => (
        <React.Fragment key={p.k}>
          {i > 0 && <div className="flex-1 h-1.5 rounded-full relative" style={{ background: p.feito || p.atual ? C.green : C.line }}>
            {p.atual && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">🚚</span>}
          </div>}
          <div className="rounded-full flex items-center justify-center font-extrabold shrink-0" style={{ width: 34, height: 34, fontSize: p.t.length > 1 ? 18 : 15,
            background: p.feito ? C.green : p.atual ? C.accent : C.panel, color: p.feito || p.atual ? "#fff" : C.sub, border: `3px solid ${p.feito ? C.green : p.atual ? C.accent : C.line}` }}>{p.feito && p.t !== "🏭" ? "✓" : p.t}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

// v778 — #67: pede o km do odômetro (lembra o último registrado)
function KmModal({ user, titulo, veiculo, onOk, onCancelar }) {
  const [km, setKm] = useState("");
  const [ult, setUlt] = useState(null);
  useEffect(() => { api(`/api/rotas?u=${user.id}&ultimoKm=${veiculo || "CARRO"}`).then((x) => setUlt(x.km)).catch(() => {}); }, []);
  const n = Number(String(km).replace(/\./g, "").replace(",", "."));
  const baixo = ult != null && n > 0 && n < ult;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3" style={{ background: "rgba(0,30,65,.5)" }}>
      <div className="w-full max-w-md rounded-3xl p-5 space-y-3" style={{ background: C.panel }}>
        <div className="text-xl font-extrabold" style={{ color: C.navy }}>🚗 {titulo}</div>
        <input value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" autoFocus placeholder="km do painel"
          className="w-full rounded-2xl px-4 py-4 text-3xl font-extrabold text-center" style={{ border: `3px solid ${C.accent}`, color: C.navy }} />
        {ult != null && <div className="text-sm text-center" style={{ color: baixo ? C.red : C.sub }}>Último registrado: {ult.toLocaleString("pt-BR")} km{baixo ? " — o km digitado é menor, confira" : ""}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Botao fundo="#fff" cor={C.text} onClick={onCancelar}>Cancelar</Botao>
          <Botao fundo={C.green} cor="#fff" disabled={!(n > 0)} onClick={() => onOk(km)}>Confirmar</Botao>
        </div>
      </div>
    </div>
  );
}

// v778 — #68: abastecimento — km, combustível, litros, valor e itens extras (aditivo, óleo…)
function AbastecimentoModal({ user, veiculo, onClose, onOk }) {
  const [f, setF] = useState({ km: "", combustivel: "GASOLINA", litros: "", valor: "", extras: [] });
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const so = (v) => String(v).replace(/[^\d,.]/g, "");
  const num = (v) => Number(String(v || "").replace(/\./g, "").replace(",", ".")) || 0;
  const total = num(f.valor) + f.extras.reduce((t, x) => t + num(x.valor), 0);
  const enviar = async () => {
    setSt(true); setErro("");
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "abastecer", veiculo, ...f }); onOk(); } catch (e) { setErro(e.message); }
    setSt(false);
  };
  const inpG = "w-full rounded-xl px-3 py-3 text-lg font-semibold";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3" style={{ background: "rgba(0,30,65,.5)" }}>
      <div className="w-full max-w-md rounded-3xl p-5 space-y-3 overflow-y-auto" style={{ background: C.panel, maxHeight: "92vh" }}>
        <div className="text-xl font-extrabold" style={{ color: C.navy }}>⛽ Abastecimento</div>
        <label className="block text-sm font-bold" style={{ color: C.sub }}>Km atual<input value={f.km} onChange={(e) => s("km", so(e.target.value))} inputMode="decimal" className={inpG} style={{ border: `2px solid ${C.line}` }} /></label>
        <div className="grid grid-cols-4 gap-1">{["GASOLINA", "ETANOL", "DIESEL", "GNV"].map((c) => (
          <button key={c} onClick={() => s("combustivel", c)} className="py-2 rounded-xl text-xs font-bold" style={{ background: f.combustivel === c ? C.accent : C.bg, color: f.combustivel === c ? "#fff" : C.text }}>{c}</button>))}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold" style={{ color: C.sub }}>Litros<input value={f.litros} onChange={(e) => s("litros", so(e.target.value))} inputMode="decimal" className={inpG} style={{ border: `2px solid ${C.line}` }} /></label>
          <label className="block text-sm font-bold" style={{ color: C.sub }}>Valor R$<input value={f.valor} onChange={(e) => s("valor", so(e.target.value))} inputMode="decimal" className={inpG} style={{ border: `2px solid ${C.line}` }} /></label>
        </div>
        <div className="text-sm font-bold" style={{ color: C.sub }}>Itens extras (aditivo, óleo…)</div>
        {f.extras.map((x, k) => (
          <div key={k} className="flex gap-2">
            <input value={x.descricao} onChange={(e) => s("extras", f.extras.map((y, j) => (j === k ? { ...y, descricao: e.target.value } : y)))} placeholder="descrição" className="flex-1 rounded-xl px-3 py-2 text-base" style={{ border: `2px solid ${C.line}` }} />
            <input value={x.valor} onChange={(e) => s("extras", f.extras.map((y, j) => (j === k ? { ...y, valor: so(e.target.value) } : y)))} inputMode="decimal" placeholder="R$" className="w-24 rounded-xl px-3 py-2 text-base" style={{ border: `2px solid ${C.line}` }} />
            <button onClick={() => s("extras", f.extras.filter((_, j) => j !== k))} className="px-2 text-lg" style={{ color: C.red }}>✕</button>
          </div>))}
        <button onClick={() => s("extras", [...f.extras, { descricao: "", valor: "" }])} className="text-base font-bold" style={{ color: C.accent }}>+ adicionar item extra</button>
        <div className="text-lg font-extrabold text-right" style={{ color: C.navy }}>Total {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        {erro && <div className="text-sm font-semibold" style={{ color: C.red }}>{erro}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Botao fundo="#fff" cor={C.text} onClick={onClose}>Cancelar</Botao>
          <Botao fundo={C.green} cor="#fff" disabled={st || !num(f.km)} onClick={enviar}>Salvar</Botao>
        </div>
      </div>
    </div>
  );
}

export default function MotoristaApp({ user, onSair }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [oc, setOc] = useState(false);
  const [ret, setRet] = useState(null);   // v521 — justificativa do retorno à fábrica no meio da rota (null = fechado)
  const [pedeKm, setPedeKm] = useState(null);   // v778 — #67: { titulo, body } — km atual antes de partir / ao chegar
  const [abast, setAbast] = useState(false);    // v778 — #68: abastecimento
  const comKm = (titulo, body) => setPedeKm({ titulo, body });
  const carregar = () => api(`/api/rotas?u=${user.id}&minhas=1`).then((x) => { setD(x); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, []);
  const acao = async (body) => {
    setOc(true);
    try { await api("/api/rotas", "POST", { usuarioId: user.id, ...body }); await carregar(); } catch (e) { setErro(e.message); }
    setOc(false);
  };

  const rota = d?.rotas?.find((r) => r.status === "EM_EXECUCAO");
  const proximas = (d?.rotas || []).filter((r) => r.status === "MONTAGEM");
  const feitasHoje = (d?.rotas || []).filter((r) => r.status === "CONCLUIDO");
  const paradas = rota?.paradas || [];
  const idx = paradas.findIndex((p) => p.status !== "CONCLUIDA");
  const atual = idx >= 0 ? paradas[idx] : null;
  const volta = !!rota && idx < 0;
  const fab = d?.fabrica;
  const nFeitas = paradas.filter((p) => p.status === "CONCLUIDA").length;
  // v463 — com rota em execução, o celular manda a posição para o escritório acompanhar ao vivo (no máx. 1 por minuto)
  const [gps, setGps] = useState(null);   // null | "ok" | "negado"
  const ult = React.useRef(0);
  useEffect(() => {
    if (!rota || typeof navigator === "undefined" || !navigator.geolocation) return;
    const enviar = (p) => {
      setGps("ok");
      if (Date.now() - ult.current < 30000) return;   // v485 — a cada 30 s
      ult.current = Date.now();
      fetch("/api/rotas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "posicao", lat: p.coords.latitude, lng: p.coords.longitude, rumo: Number.isFinite(p.coords.heading) && p.coords.speed > 0.5 ? p.coords.heading : null }) }).catch(() => {});
    };
    const w = navigator.geolocation.watchPosition(enviar, (e) => { if (e.code === 1) setGps("negado"); }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 });
    return () => navigator.geolocation.clearWatch(w);
  }, [rota?.id]);

  return (
    <div className="min-h-screen pb-10" style={{ background: C.bg, fontFamily: "Montserrat, system-ui, sans-serif" }}>
      <div className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10" style={{ background: C.navy }}>
        <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 20, width: "auto" }} />
        <div className="flex-1 text-right text-sm font-semibold" style={{ color: "#fff" }}>Olá, {sc(user.nome)} 👋</div>
        <button onClick={carregar} className="p-2" style={{ color: "#fff" }} title="Atualizar"><RefreshCw size={18} /></button>
        <button onClick={onSair} className="p-2" style={{ color: "#fff" }} title="Sair"><LogOut size={18} /></button>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <AvisosPush user={user} C={C} />
        {erro && <div className="rounded-xl px-4 py-3 text-base font-semibold" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>}
        {!d && !erro && <div className="flex items-center justify-center gap-2 py-16 text-lg" style={{ color: C.sub }}><Loader2 className="animate-spin" /> Carregando sua rota…</div>}
        {d && !d.pessoaId && <div className="rounded-2xl p-6 text-center text-lg" style={{ background: C.panel }}>Seu usuário ainda não está ligado ao seu cadastro de motorista. Peça ao escritório para ligar em Usuários › Funcionário da folha.</div>}

        {d && d.pessoaId && !rota && (
          <div className="rounded-3xl p-8 text-center shadow-sm" style={{ background: C.panel }}>
            <div className="text-6xl mb-3">{feitasHoje.length ? "🎉" : "☕"}</div>
            <div className="text-2xl font-extrabold mb-1" style={{ color: C.navy }}>{feitasHoje.length ? "Rota concluída!" : "Nenhuma rota agora"}</div>
            <div className="text-base" style={{ color: C.sub }}>{feitasHoje.length ? "Bom trabalho! Quando sair outra rota ela aparece aqui." : "Quando o escritório despachar sua rota, ela aparece aqui."}</div>
          </div>
        )}

        {rota && (
          <>
            <div className="rounded-3xl p-4 shadow-sm" style={{ background: C.panel }}>
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-extrabold" style={{ color: C.navy }}>Rota R{rota.numDia ?? rota.id} · {dBR(rota.data)}</div>
                <div className="text-sm font-bold" style={{ color: C.green }}>{nFeitas}/{paradas.length} feitas</div>
              </div>
              <Trilha paradas={paradas} atual={idx} volta={volta} fim={false} />
              {gps === "negado" && <div className="mt-2 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: C.yellowSoft, color: C.yellow }}>📍 Libere a localização para o escritório acompanhar sua rota (configurações do celular › navegador › localização).</div>}
              {gps === "ok" && <div className="mt-1 text-xs text-center" style={{ color: C.sub }}>📍 Localização ligada · deixe o app aberto durante a rota</div>}
            </div>

            {atual && (() => {
              const [em, obj] = OBJ[atual.objetivo] || ["📍", "Parada"];
              const indo = !!atual.iniciadaEm;
              return (
                <div className="rounded-3xl overflow-hidden shadow-md" style={{ background: C.panel, border: `3px solid ${indo ? C.accent : C.line}` }}>
                  <div className="px-5 pt-4 pb-3">
                    <div className="text-sm font-bold mb-1" style={{ color: C.accent }}>{indo ? "🚚 A CAMINHO DA" : "PRÓXIMA"} PARADA {idx + 1} DE {paradas.length}</div>
                    <div className="flex items-start gap-3">
                      <div className="text-5xl leading-none">{em}</div>
                      <div className="min-w-0">
                        <div className="text-2xl font-extrabold leading-tight" style={{ color: C.navy }}>{curto(atual.destinoNome)}</div>
                        <div className="text-lg font-semibold" style={{ color: C.text }}>{obj}{atual.tarefa ? ` · ${sc(atual.tarefa)}` : ""}</div>
                      </div>
                    </div>
                    {atual.urgente && <div className="mt-2 inline-block px-3 py-1 rounded-full text-sm font-extrabold" style={{ background: C.red, color: "#fff" }}>⚠ URGENTE</div>}
                    <div className="mt-3 flex items-start gap-2 text-base" style={{ color: C.text }}><MapPin size={20} className="shrink-0 mt-0.5" style={{ color: C.accent }} />{semCep(atual.endereco)}</div>
                    <div className="mt-2 flex items-center gap-2 text-base" style={{ color: C.sub }}><Clock size={18} /> {atual.horario}{atual.tempoLocal != null ? ` · ~${atual.tempoLocal} min no local` : ""}</div>
                    {atual.telefone && <a href={`tel:${tel(atual.telefone)}`} className="mt-2 flex items-center gap-2 text-base font-bold" style={{ color: C.green }}><Phone size={18} /> {atual.contato ? `${sc(atual.contato)} · ` : ""}{atual.telefone}</a>}
                    {atual.obs && <div className="mt-2 rounded-xl px-3 py-2 text-base" style={{ background: C.yellowSoft, color: C.yellow }}>📝 {atual.obs}</div>}
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    {!indo ? (
                      <Botao grande fundo={C.accent} cor="#fff" disabled={oc} onClick={() => comKm("Km atual do veículo antes de sair", { acao: "perna", id: atual.id })}>▶ INICIAR PERCURSO</Botao>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <Botao fundo={C.waze} cor="#0B2540" href={waze(atual)}>Waze</Botao>
                          <Botao fundo="#fff" cor={C.text} href={gmaps(atual)}><span style={{ color: "#4285F4" }}>G</span> Maps</Botao>
                        </div>
                        <Botao grande fundo={C.green} cor="#fff" disabled={oc} onClick={() => acao({ acao: "parada", id: atual.id })}>✅ CHEGUEI E CONCLUÍ</Botao>
                      </>
                    )}
                    {/* v521 — voltar à fábrica no meio da rota: pede justificativa e vira a próxima parada */}
                    {atual.objetivo !== "RETORNO" && (ret == null ? (
                      <button onClick={() => setRet("")} className="w-full py-3 rounded-2xl text-base font-bold" style={{ background: C.bg, color: C.navy, border: `2px solid ${C.line}` }}>🏭 Preciso voltar à fábrica agora</button>
                    ) : (
                      <div className="rounded-2xl p-3 space-y-2" style={{ background: C.bg }}>
                        <div className="text-base font-bold" style={{ color: C.navy }}>Por que precisa voltar à fábrica?</div>
                        <textarea value={ret} onChange={(e) => setRet(e.target.value)} rows={3} autoFocus className="w-full rounded-xl px-3 py-2 text-base" style={{ border: `2px solid ${C.line}` }} placeholder="Ex.: carro cheio, esqueci material, problema no veículo…" />
                        <div className="grid grid-cols-2 gap-3">
                          <Botao fundo="#fff" cor={C.text} onClick={() => setRet(null)}>Cancelar</Botao>
                          <Botao fundo={C.accent} cor="#fff" disabled={oc || ret.trim().length < 5} onClick={async () => { await acao({ acao: "retornoNaRota", blocoId: rota.id, justificativa: ret }); setRet(null); }}>Confirmar</Botao>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {volta && (
              <div className="rounded-3xl overflow-hidden shadow-md" style={{ background: C.panel, border: `3px solid ${rota.voltaIniciadaEm ? C.accent : C.green}` }}>
                <div className="px-5 pt-5 pb-3 text-center">
                  <div className="text-5xl mb-2">🏭</div>
                  <div className="text-2xl font-extrabold" style={{ color: C.navy }}>{rota.voltaIniciadaEm ? "Voltando para a fábrica" : "Todas as paradas feitas! 👏"}</div>
                  {!rota.voltaIniciadaEm && <div className="text-base" style={{ color: C.sub }}>Agora é voltar para a fábrica.</div>}
                  {fab?.endereco && <div className="mt-2 text-sm" style={{ color: C.sub }}>{semCep(fab.endereco)}</div>}
                </div>
                <div className="px-4 pb-4 space-y-3">
                  {!rota.voltaIniciadaEm ? (
                    <Botao grande fundo={C.accent} cor="#fff" disabled={oc} onClick={() => comKm("Km atual do veículo antes de voltar", { acao: "perna", volta: true, blocoId: rota.id })}>▶ INICIAR VOLTA</Botao>
                  ) : (
                    <>
                      {fab && <div className="grid grid-cols-2 gap-3">
                        <Botao fundo={C.waze} cor="#0B2540" href={waze(fab)}>Waze</Botao>
                        <Botao fundo="#fff" cor={C.text} href={gmaps(fab)}><span style={{ color: "#4285F4" }}>G</span> Maps</Botao>
                      </div>}
                      <Botao grande fundo={C.navy} cor="#fff" disabled={oc} onClick={() => comKm("Km do veículo na chegada à fábrica", { acao: "retorno", id: rota.id })}>🏁 CHEGUEI NA FÁBRICA</Botao>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-3xl p-4 shadow-sm" style={{ background: C.panel }}>
              <div className="text-sm font-bold mb-2" style={{ color: C.sub }}>PARADAS DA ROTA</div>
              {paradas.map((p, i) => {
                const feita = p.status === "CONCLUIDA";
                const ultimaFeita = feita && (i === paradas.length - 1 || paradas[i + 1].status !== "CONCLUIDA");
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : "none", opacity: feita ? 0.6 : 1 }}>
                    <div className="rounded-full flex items-center justify-center font-extrabold shrink-0" style={{ width: 30, height: 30, background: feita ? C.green : i === idx ? C.accent : C.bg, color: feita || i === idx ? "#fff" : C.sub }}>{feita ? "✓" : i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold truncate" style={{ color: C.text, textDecoration: feita ? "line-through" : "none" }}>{(OBJ[p.objetivo] || ["📍"])[0]} {curto(p.destinoNome)}</div>
                      <div className="text-sm truncate" style={{ color: C.sub }}>{p.tarefa ? sc(p.tarefa) : p.horario}</div>
                    </div>
                    {ultimaFeita && !rota.voltaIniciadaEm && <button onClick={() => acao({ acao: "parada", id: p.id, desfazer: true })} className="flex items-center gap-1 text-sm font-semibold px-2 py-1" style={{ color: C.sub }}><Undo2 size={15} /> desfazer</button>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* v778 — #68: abastecimento a qualquer momento */}
        {d && d.pessoaId && <button onClick={() => setAbast(true)} className="w-full py-3 rounded-2xl text-base font-bold" style={{ background: C.panel, color: C.navy, border: `2px solid ${C.line}` }}>⛽ Registrar abastecimento</button>}

        {proximas.length > 0 && (
          <div className="rounded-3xl p-4 shadow-sm" style={{ background: C.panel }}>
            <div className="text-sm font-bold mb-2" style={{ color: C.sub }}>PRÓXIMAS ROTAS (AINDA NÃO LIBERADAS)</div>
            {proximas.map((r) => (
              <div key={r.id} className="py-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="text-base font-bold" style={{ color: C.navy }}>Rota R{r.numDia ?? r.id} · {r.data === hojeISO() ? "hoje" : dBR(r.data)}{r.saida ? ` · saída ${r.saida}` : ""}</div>
                <div className="text-sm" style={{ color: C.sub }}>{r.paradas.map((p) => curto(p.destinoNome)).join(" → ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {pedeKm && <KmModal user={user} titulo={pedeKm.titulo} veiculo={rota?.veiculo} onCancelar={() => setPedeKm(null)} onOk={async (km) => { const b = pedeKm.body; setPedeKm(null); await acao({ ...b, km }); }} />}
      {abast && <AbastecimentoModal user={user} veiculo={rota?.veiculo || "CARRO"} onClose={() => setAbast(false)} onOk={() => { setAbast(false); alert("Abastecimento registrado."); }} />}
    </div>
  );
}
