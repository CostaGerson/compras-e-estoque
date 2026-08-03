export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const b = await req.json();
  const out = {};
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const readPdf = async (b64) => {
    const raw = b64.includes(",") ? b64.split(",")[1] : b64;
    const buf = Buffer.from(raw, "base64");
    const d = await pdfParse(buf);
    return d.text || "";
  };

  // Número do PP = número do pedido do cliente (arquivo base / pedido)
  if (b.pedidoBase64) {
    try {
      const t = await readPdf(b.pedidoBase64);
      const m = t.match(/PEDIDO\s+N?º?\s*(\d{5,})/i) || t.match(/PEDIDO\s+(\d{5,})/i);
      if (m) out.numero = m[1];
    } catch {}
  }

  // Dados do cliente = solicitação de lançamento (nosso template)
  if (b.lancBase64) {
    try {
      const t = await readPdf(b.lancBase64);
      const clean = t.replace(/\s+/g, " ").trim();
      const pick = (re) => { const m = clean.match(re); return m ? m[1].trim() : null; };
      out.clienteNome = pick(/CLIENTE\s+(.+?)\s+CONDI[ÇC][ÃA]O DE PAGAMENTO/i);
      out.condicaoPagamento = pick(/CONDI[ÇC][ÃA]O DE PAGAMENTO\s+(.+?)\s+OC\b/i);
      out.oc = pick(/\bOC\s+(\S+?)\s+PRAZO DE ENTREGA/i);
      out.prazoEntrega = pick(/PRAZO DE ENTREGA\s+(\S+)/i);
      const razao = pick(/RAZ[ÃA]O SOCIAL\s+(.+?)\s+CNPJ/i);
      out.clienteCnpj = pick(/CNPJ\s+([\d.\/-]{14,20})/i);
      out.clienteIe = pick(/INSCR\.?\s*ESTADUAL\s+([\dA-Z.\/-]+)/i);
      out.clienteEndereco = pick(/ENDERE[ÇC]O\s+(.+?)\s+(?:1\.\s|1 \.|POLO|CAMISA|CAMISETA|JAQUETA|CAL[ÇC]A|JALECO|AVENTAL)/i)
        || pick(/ENDERE[ÇC]O\s+(.+?CEP\s*[\d-]+)/i);
      if (razao && !out.clienteNome) out.clienteNome = razao;
      if (razao) out.clienteRazao = razao;
    } catch {}
  }

  // remove nulos
  Object.keys(out).forEach((k) => { if (out[k] == null || out[k] === "") delete out[k]; });
  return Response.json(out);
}
