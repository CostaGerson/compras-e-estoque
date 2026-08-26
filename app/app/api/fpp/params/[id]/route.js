import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

// GET: histórico de alterações do parâmetro
export async function GET(_req, { params }) {
  const id = Number(params.id);
  const hist = await prisma.fppParamHist.findMany({
    where: { paramId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(hist);
}

// PATCH: REDEFINE O PADRÃO (modo OS). Body: { valor?, extra?, usuarioId?, usuarioNome? }
// Grava uma linha de histórico por campo alterado (valor + cada chave do extra).
export async function PATCH(req, { params }) {
  const id = Number(params.id);
  const b = await req.json();
  const atual = await prisma.fppParam.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ error: "Parâmetro não encontrado." }, { status: 404 });

  const hist = [];
  const data = {};

  if (b.valor != null && Number(b.valor) !== Number(atual.valor)) {
    data.valor = Number(b.valor);
    hist.push({ campo: "valor", deNum: atual.valor, paraNum: Number(b.valor) });
  }

  if (b.extra && typeof b.extra === "object") {
    const ex = { ...(atual.extra || {}) };
    for (const k of Object.keys(b.extra)) {
      const antigo = atual.extra ? atual.extra[k] : null;
      const novo = b.extra[k];
      if (Number(novo) !== Number(antigo)) {
        ex[k] = Number(novo);
        hist.push({ campo: k, deNum: antigo == null ? null : Number(antigo), paraNum: Number(novo) });
      }
    }
    data.extra = ex;
  }

  if (hist.length === 0) return NextResponse.json({ ok: true, semMudanca: true });

  const uid = b.usuarioId != null ? Number(b.usuarioId) : null;
  const uname = b.usuarioNome || null;

  const salvo = await prisma.fppParam.update({
    where: { id },
    data: {
      ...data,
      historico: { create: hist.map((h) => ({ ...h, usuarioId: uid, usuarioNome: uname })) },
    },
  });
  return NextResponse.json(salvo);
}
