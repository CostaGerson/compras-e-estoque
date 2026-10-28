// v551 — lembrete no celular (Web Push) 30 min antes do horário de início de cada tarefa da agenda.
// Roda a cada minuto no servidor. Cada tarefa recebe um aviso por data+horário (lembreteChave): mudou a hora, avisa de novo.
import { prisma } from "@/lib/prisma";
import { notificar } from "@/lib/push";

export const MIN_ANTES = 30;
const agoraSP = () => {   // data e minuto do dia em São Paulo
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
};
const minDe = (h) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(h || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export async function enviarLembretes() {
  const { dia, min } = agoraSP();
  const l = await prisma.tarefa.findMany({ where: { prazo: new Date(`${dia}T00:00:00Z`), hora: { not: null }, modelo: false, status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
    select: { id: true, titulo: true, hora: true, horaFim: true, responsavelId: true, lembreteChave: true } });
  let n = 0;
  for (const t of l) {
    const ini = minDe(t.hora); if (ini == null) continue;
    const falta = ini - min;
    const chave = `${dia}|${t.hora}`;
    if (falta > MIN_ANTES || falta < 0 || t.lembreteChave === chave) continue;   // só na janela dos 30 min antes
    // marca antes de enviar: dois servidores/minutos não mandam em dobro
    const ok = await prisma.tarefa.updateMany({ where: { id: t.id, OR: [{ lembreteChave: null }, { lembreteChave: { not: chave } }] }, data: { lembreteChave: chave } });
    if (!ok.count) continue;
    await notificar(t.responsavelId, { titulo: `⏰ Em ${falta} min · ${t.hora}${t.horaFim ? `–${t.horaFim}` : ""}`, texto: t.titulo, url: "/?v=agenda", tag: `tarefa-${t.id}` }).catch((e) => console.log("lembrete:", e.message));
    n++;
  }
  return n;
}

export function agendarLembretes() {
  if (globalThis.__lembretesTarefas) return;
  globalThis.__lembretesTarefas = true;
  let ultGerar = 0;
  const tick = async () => {
    // rotinas: garante as ocorrências do dia geradas (de hora em hora), mesmo sem ninguém abrir a agenda
    if (Date.now() - ultGerar > 3600e3) { ultGerar = Date.now(); try { const { gerarOcorrencias } = await import("@/lib/tarefas"); await gerarOcorrencias(); } catch (e) { console.error("[lembretes/rotinas]", e.message); } }
    await enviarLembretes().catch((e) => console.error("[lembretes]", e.message));
  };
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 60 * 1000);
}
