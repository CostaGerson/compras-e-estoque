export const dynamic = "force-dynamic";
import fs from "fs";

// v770 — versão que está rodando (gravada no build pelo deploy automático) + situação do deploy em andamento
const ler = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
export async function GET() {
  const rodando = ler(`${process.cwd()}/versao.json`);
  const deploy = ler(`${process.cwd()}/backup/deploy-status.json`);
  return Response.json({ rodando, deploy }, { headers: { "Cache-Control": "no-store" } });
}
