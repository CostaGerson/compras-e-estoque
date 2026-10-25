"use client";
// v452 — app do motorista (celular): só a rota designada a ele, em botões grandes.
// Uma perna por vez: INICIAR → abre Waze ou Google Maps só até a próxima parada → CHEGUEI E CONCLUÍ → próxima…
// No fim, a volta à fábrica e "CHEGUEI NA FÁBRICA".
import React, { useEffect, useState } from "react";
import { Loader2, Phone, LogOut, RefreshCw, Undo2, Clock, MapPin } from "lucide-react";

const C = { navy: "#001E41", accent: "#FF6B1A", green: "#12A150", greenSoft: "#E7F6EE", bg: "#F2F4F7", panel: "#FFFFFF", line: "#E4E7EC", text: "#1F2733", sub: "#667085", red: "#D92D20", waze: "#33CCFF", yellow: "#C08401", yellowSoft: "#FFF6DD" };
const OBJ = { COLETA: ["📦", "Coleta"], ENTREGA: ["🚚", "Entrega"], COMPRA: ["🛒", "Compra"] };
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

export default function MotoristaApp({ user, onSair }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [oc, setOc] = useState(false);
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

  return (
    <div className="min-h-screen pb-10" style={{ background: C.bg, fontFamily: "Montserrat, system-ui, sans-serif" }}>
      <div className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10" style={{ background: C.navy }}>
        <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 20, width: "auto" }} />
        <div className="flex-1 text-right text-sm font-semibold" style={{ color: "#fff" }}>Olá, {sc(user.nome)} 👋</div>
        <button onClick={carregar} className="p-2" style={{ color: "#fff" }} title="Atualizar"><RefreshCw size={18} /></button>
        <button onClick={onSair} className="p-2" style={{ color: "#fff" }} title="Sair"><LogOut size={18} /></button>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
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
                <div className="text-lg font-extrabold" style={{ color: C.navy }}>Rota {rota.id} · {dBR(rota.data)}</div>
                <div className="text-sm font-bold" style={{ color: C.green }}>{nFeitas}/{paradas.length} feitas</div>
              </div>
              <Trilha paradas={paradas} atual={idx} volta={volta} fim={false} />
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
                      <Botao grande fundo={C.accent} cor="#fff" disabled={oc} onClick={() => acao({ acao: "perna", id: atual.id })}>▶ INICIAR PERCURSO</Botao>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <Botao fundo={C.waze} cor="#0B2540" href={waze(atual)}>Waze</Botao>
                          <Botao fundo="#fff" cor={C.text} href={gmaps(atual)}><span style={{ color: "#4285F4" }}>G</span> Maps</Botao>
                        </div>
                        <Botao grande fundo={C.green} cor="#fff" disabled={oc} onClick={() => acao({ acao: "parada", id: atual.id })}>✅ CHEGUEI E CONCLUÍ</Botao>
                      </>
                    )}
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
                    <Botao grande fundo={C.accent} cor="#fff" disabled={oc} onClick={() => acao({ acao: "perna", volta: true, blocoId: rota.id })}>▶ INICIAR VOLTA</Botao>
                  ) : (
                    <>
                      {fab && <div className="grid grid-cols-2 gap-3">
                        <Botao fundo={C.waze} cor="#0B2540" href={waze(fab)}>Waze</Botao>
                        <Botao fundo="#fff" cor={C.text} href={gmaps(fab)}><span style={{ color: "#4285F4" }}>G</span> Maps</Botao>
                      </div>}
                      <Botao grande fundo={C.navy} cor="#fff" disabled={oc} onClick={() => acao({ acao: "retorno", id: rota.id })}>🏁 CHEGUEI NA FÁBRICA</Botao>
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

        {proximas.length > 0 && (
          <div className="rounded-3xl p-4 shadow-sm" style={{ background: C.panel }}>
            <div className="text-sm font-bold mb-2" style={{ color: C.sub }}>PRÓXIMAS ROTAS (AINDA NÃO LIBERADAS)</div>
            {proximas.map((r) => (
              <div key={r.id} className="py-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="text-base font-bold" style={{ color: C.navy }}>Rota {r.id} · {r.data === hojeISO() ? "hoje" : dBR(r.data)}{r.saida ? ` · saída ${r.saida}` : ""}</div>
                <div className="text-sm" style={{ color: C.sub }}>{r.paradas.map((p) => curto(p.destinoNome)).join(" → ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
