// v1043 — sugestão #101: endereço na tarefa (Google Maps), saída sugerida e endereços particulares (favoritos de cada usuário).
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const num = (v) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? null : Number(v));
const txt = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
const ponto = (p) => {
  if (!p || typeof p !== "object") return null;
  const lat = num(p.lat), lng = num(p.lng), endereco = txt(p.endereco, 300);
  if (lat == null || lng == null || !endereco) return null;
  return { endereco, lat, lng, ...(p.nome ? { nome: txt(p.nome, 80) } : {}), ...(p.favoritoId ? { favoritoId: Number(p.favoritoId) || null } : {}) };
};
const minDe = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmm = (m) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

// horário de saída = início − deslocamento − antecedência no local
export function saidaDe(hora, local) {
  const ini = minDe(hora);
  if (ini == null || !local || local.deslocMin == null) return null;
  return hhmm(ini - Math.ceil(local.deslocMin) - (local.antecedenciaMin ?? 5));
}

// normaliza o "local" que vem do formulário. Só vale endereço reconhecido pelo Google (com coordenadas).
// Saída aceita: o aviso no celular passa a ser na hora de sair (lembreteMin = deslocamento + antecedência).
export function limparLocal(b, hora) {
  const dest = ponto(b);
  if (!dest) return { local: Prisma.DbNull };
  const antecedenciaMin = Math.min(600, Math.max(0, Math.round(num(b.antecedenciaMin) ?? 5)));
  const origem = ponto(b.origem);
  const deslocMin = origem && num(b.deslocMin) != null ? Math.max(0, Math.round(num(b.deslocMin))) : null;
  const local = { endereco: dest.endereco, lat: dest.lat, lng: dest.lng, ...(dest.nome ? { nome: dest.nome } : {}), antecedenciaMin, origem, deslocMin,
    km: origem && num(b.km) != null ? Math.round(num(b.km) * 10) / 10 : null, aceito: !!(b.aceito && origem && deslocMin != null && hora) };
  const out = { local };
  if (local.aceito) { local.saida = saidaDe(hora, local); out.lembreteMin = Math.min(10080, deslocMin + antecedenciaMin); }
  return out;
}

export const linkWaze = (l) => `https://waze.com/ul?ll=${l.lat},${l.lng}&navigate=yes`;
export const linkMaps = (l) => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}&travelmode=driving`;

// tempo de deslocamento (com o trânsito previsto para o horário de saída, quando dá)
export async function deslocamento(de, para, quando) {
  const a = ponto(de), b = ponto(para);
  if (!a || !b) return { error: "Origem e destino precisam ser endereços do Google." };
  const { matrizRuas, chaveTrecho } = await import("@/lib/googleMaps");
  const m = await matrizRuas([a, b], quando || null);
  const x = m[chaveTrecho(a, b)];
  if (!x) return { error: "O Google não achou caminho entre os dois endereços." };
  return { min: Math.ceil(x.min), km: Math.round(x.km * 10) / 10 };
}

// ---------- endereços particulares (cada usuário vê só os seus) ----------
export const listarFavoritos = (u) => prisma.enderecoParticular.findMany({ where: { usuarioId: u.id }, orderBy: [{ nome: "asc" }] });
export async function salvarFavorito(u, b) {
  const p = ponto(b);
  if (!p) return { error: "Escolha o endereço na lista do Google." };
  const nome = txt(b.nome, 60).toUpperCase();
  if (!nome) return { error: "Dê um nome ao endereço (ex.: CASA, FÁBRICA)." };
  const data = { nome, endereco: p.endereco, lat: p.lat, lng: p.lng };
  if (b.id) {
    const x = await prisma.enderecoParticular.findUnique({ where: { id: Number(b.id) || 0 } });
    if (!x || x.usuarioId !== u.id) return { error: "Endereço não encontrado." };
    return { ok: true, endereco: await prisma.enderecoParticular.update({ where: { id: x.id }, data }) };
  }
  return { ok: true, endereco: await prisma.enderecoParticular.create({ data: { ...data, usuarioId: u.id } }) };
}
export async function excluirFavorito(u, id) {
  const r = await prisma.enderecoParticular.deleteMany({ where: { id: Number(id) || 0, usuarioId: u.id } });
  return r.count ? { ok: true } : { error: "Endereço não encontrado." };
}
