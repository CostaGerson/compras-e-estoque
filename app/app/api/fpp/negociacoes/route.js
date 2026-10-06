import { NextResponse } from "next/server";
import { listarNegociacoes, registrarNegociacao } from "../../../../lib/fppNumero";

export const dynamic = "force-dynamic";

// GET → nomes de negociação já usados (ordem alfabética)
export async function GET() {
  return NextResponse.json(await listarNegociacoes());
}
// POST { nome } → grava um nome novo
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!String(b.nome || "").trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  await registrarNegociacao(b.nome);
  return NextResponse.json(await listarNegociacoes());
}
