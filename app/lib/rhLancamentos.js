// Lançamentos do RH direto no contas a pagar: recargas do iFood (relatório + boleto/PIX) e contas avulsas
import { prisma } from "@/lib/prisma";
import { dataUTC, mesDe, r2, mesAtual } from "@/lib/finTitulos";
import { hashB64, jaImportados } from "@/lib/finHash";
import { notificarFinanceiro, nomeUsuario } from "@/lib/rh";

const dBR = (s) => String(s || "").slice(0, 10).split("-").reverse().join("/");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function anexar(tituloId, arqs, quem) {
  let n = 0;
  for (const a of arqs) {
    if (!a?.conteudo) continue;
    const hash = hashB64(a.conteudo);
    if (await prisma.finTituloAnexo.findFirst({ where: { tituloId, hash }, select: { id: true } })) continue;
    await prisma.finTituloAnexo.create({ data: { tituloId, nome: String(a.nome).slice(0, 200), mime: a.mime || "application/pdf",
      tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, hash, criadoPorNome: quem } });
    n++;
  }
  return n;
}

// iFood: { empresa, valor, vencimento, pix?, relatorio:{nome,conteudo}, boleto?:{nome,conteudo} }
export async function lancarIfood(b, u) {
  const quem = nomeUsuario(u);
  const nort = b.empresa === "NORT";
  const valor = r2(b.valor);
  if (!b.relatorio?.conteudo) return { error: "Anexe o relatório de recargas do iFood." };
  if (!b.boleto?.conteudo && !String(b.pix || "").trim()) return { error: "Anexe o boleto em PDF ou cole o código PIX copia e cola." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.vencimento || "")) return { error: "Informe a data de vencimento." };
  if (!(valor > 0)) return { error: "Informe o valor." };
  const hashes = [b.relatorio, b.boleto].filter((a) => a?.conteudo).map((a) => hashB64(a.conteudo));
  const ja = await jaImportados(hashes);
  if (ja[hashes[0]]) return { error: `Este relatório já foi enviado (conta "${ja[hashes[0]].titulo}").` };
  const comp = mesDe(b.vencimento);
  // a conta do iFood do mês: recorrência da Matriz (Meridian) ou NORT - VT / VA / BENEFÍCIOS
  const rec = await prisma.finRecorrencia.findUnique({ where: { chaveOrigem: nort ? "NORT|BENEFICIOS" : "MATRIZ|pessoal|IFOOD" } });
  let t = rec ? await prisma.finTitulo.findFirst({ where: { recorrenciaId: rec.id, competencia: comp, status: "ABERTO" } }) : null;
  if (!t) {
    const l = await prisma.finTitulo.findMany({ where: { tipo: "PAGAR", competencia: comp, status: "ABERTO" } });
    t = l.find((x) => /IFOOD|BENEF/.test(x.titulo) && nort === /NORT/.test(x.titulo)) || null;
  }
  const pix = String(b.pix || "").trim();
  const obs = `IFOOD RECARGAS · R$ ${brl(valor)} · VENCE ${dBR(b.vencimento)}${pix ? ` · PIX: ${pix}` : " · BOLETO EM PDF"} · ENVIADO PELO RH (${quem})`;
  if (t) {
    t = await prisma.finTitulo.update({ where: { id: t.id }, data: {
      valor, vencimento: dataUTC(b.vencimento), previsao: false, valorConfirmado: true, atualizadoPorNome: quem,
      observacao: [t.observacao, obs].filter(Boolean).join(" · ").slice(0, 1000),
    } });
  } else {
    t = await prisma.finTitulo.create({ data: {
      tipo: "PAGAR", titulo: nort ? "NORT - IFOOD RECARGAS" : "IFOOD — RECARGAS", parceiro: "IFOOD BENEFÍCIOS", valor,
      vencimento: dataUTC(b.vencimento), competencia: comp, previsao: false, valorConfirmado: true,
      rateio: rec?.rateio || [], observacao: obs.slice(0, 1000), forma: "RH", criadoPorId: u.id, criadoPorNome: quem,
    } });
  }
  const arqs = [{ ...b.relatorio, nome: b.relatorio.nome || "relatorio-ifood.pdf" }];
  if (b.boleto?.conteudo) arqs.push({ ...b.boleto, nome: b.boleto.nome || "boleto-ifood.pdf" });
  if (pix) arqs.push({ nome: "PIX_COPIA_E_COLA.txt", mime: "text/plain", conteudo: Buffer.from(pix, "utf8").toString("base64") });
  const anexos = await anexar(t.id, arqs, quem);
  await prisma.rhEnvio.create({ data: { competencia: mesAtual(), empresa: nort ? "NORT" : "MERIDIAN", categoria: "IFOOD", arquivo: b.relatorio.nome || "relatorio-ifood.pdf",
    tituloId: t.id, valor, hash: hashes[0], criadoPorNome: quem } });
  await notificarFinanceiro(`RH · iFood ${nort ? "NORT" : "MERIDIAN"}: recargas de R$ ${brl(valor)}, vencimento ${dBR(b.vencimento)}. `
    + `${pix ? `PIX copia e cola: ${pix}` : "Boleto em PDF anexado"} · conta "${t.titulo}". Por ${quem}.`, u.id);
  return { ok: true, tituloId: t.id, titulo: t.titulo, anexos };
}

// Conta avulsa lançada pelo RH: sem rateio (o financeiro preenche) e com aviso ao financeiro
export async function lancarContaRH(b, u) {
  const quem = nomeUsuario(u);
  const valor = r2(b.valor);
  const titulo = String(b.titulo || "").toUpperCase().trim();
  if (!titulo) return { error: "Informe o título da conta." };
  if (!(valor > 0)) return { error: "Informe o valor." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.vencimento || "")) return { error: "Informe o vencimento." };
  const arqs = (b.arquivos || []).filter((a) => a?.conteudo);
  const ja = await jaImportados(arqs.map((a) => hashB64(a.conteudo)));
  const dup = Object.values(ja)[0];
  if (dup) return { error: `O arquivo já está anexado na conta "${dup.titulo}" — essa conta parece já ter sido lançada.` };
  const nort = b.empresa === "NORT";
  const t = await prisma.finTitulo.create({ data: {
    tipo: "PAGAR", titulo: nort && !/^NORT - /.test(titulo) ? `NORT - ${titulo}` : titulo, parceiro: String(b.parceiro || "").toUpperCase().trim() || "SEM PARCEIRO",
    documento: String(b.documento || "").replace(/\D/g, "") || null, valor, vencimento: dataUTC(b.vencimento), competencia: mesDe(b.vencimento),
    previsao: false, valorConfirmado: true, rateio: [], observacao: [String(b.observacao || "").toUpperCase(), `LANÇADA PELO RH (${quem})`].filter(Boolean).join(" · ").slice(0, 1000),
    forma: "RH", criadoPorId: u.id, criadoPorNome: quem,
  } });
  const anexos = await anexar(t.id, arqs, quem);
  await notificarFinanceiro(`RH · conta a pagar lançada: "${t.titulo}" · ${t.parceiro} · R$ ${brl(valor)} · vence ${dBR(b.vencimento)}${anexos ? ` · ${anexos} anexo(s)` : ""}. `
    + `Falta a conta-caixa (rateio). Por ${quem}.`, u.id);
  return { ok: true, tituloId: t.id, titulo: t.titulo };
}
