// v990 — memória e disco do servidor (o container enxerga a memória da VPS em /proc/meminfo) + memória do processo do ERP
export const dynamic = "force-dynamic";
import os from "os";
import { readFile, statfs } from "fs/promises";
const gb = (b) => Math.round((b / 1024 ** 3) * 100) / 100;
export async function GET() {
  const mi = {};
  try { for (const l of (await readFile("/proc/meminfo", "utf8")).split("\n")) { const m = l.match(/^(\w+):\s+(\d+)/); if (m) mi[m[1]] = Number(m[2]) * 1024; } } catch {}
  const total = mi.MemTotal || os.totalmem(), disp = mi.MemAvailable ?? os.freemem();
  let disco = null;
  try { const s = await statfs("/"); disco = { totalGB: gb(s.blocks * s.bsize), livreGB: gb(s.bavail * s.bsize), usoPct: Math.round((1 - s.bavail / s.blocks) * 1000) / 10 }; } catch {}
  const p = process.memoryUsage();
  return Response.json({
    memoria: { totalGB: gb(total), disponivelGB: gb(disp), usadaGB: gb(total - disp), usoPct: Math.round((1 - disp / total) * 1000) / 10,
      swapTotalGB: gb(mi.SwapTotal || 0), swapUsadaGB: gb((mi.SwapTotal || 0) - (mi.SwapFree || 0)) },
    disco, cargaCPU: os.loadavg().map((x) => Math.round(x * 100) / 100), cpus: os.cpus().length, uptimeHoras: Math.round(os.uptime() / 360) / 10,
    processoERP: { rssMB: Math.round(p.rss / 1048576), heapMB: Math.round(p.heapUsed / 1048576) }, em: new Date().toISOString(),
  });
}
