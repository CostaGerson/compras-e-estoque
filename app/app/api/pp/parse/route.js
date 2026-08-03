export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPONENTES = {
  CAMISETA: ["MODELAGEM","TECIDO","GOLA DA CAMISETA","MANGA DA CAMISETA","BARRA DA CAMISETA","RECORTE DA CAMISETA","BOLSO DA CAMISETA","EXTRA DA CAMISETA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  CAMISA: ["MODELAGEM","TECIDO","GOLA DA CAMISA","PE DE GOLA","MANGA DA CAMISA","FECHAMENTO DA CAMISA","FRENTE DA CAMISA","COSTAS DA CAMISA","BARRA DA CAMISA","PUNHO DA CAMISA","RECORTE DA CAMISA","BOLSO DA CAMISA","EXTRA DA CAMISA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  POLO: ["MODELAGEM","TECIDO","GOLA DA POLO","FECHAMENTO DA POLO","MANGA DA POLO","FRENTE DA POLO","COSTAS DA POLO","BARRA DA POLO","RECORTE DA POLO","BOLSO DA POLO","EXTRA DA POLO","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  JAQUETA: ["MODELAGEM","TECIDO","GOLA","MANGA","FECHAMENTO","COSTAS","BARRA","PUNHO","RECORTE","BOLSO","FORRO","EXTRA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  CALÇA: ["MODELAGEM","TECIDO","FECHAMENTO DA CALÇA","COS DA CALÇA","BOLSO DIANTEIRO","BOLSO TRASEIRO","REFORÇO","EXTRA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  JALECO: ["MOLDE","TECIDO","GOLA DO JALECO","FECHAMENTO DO JALECO","MANGA DO JALECO","BOLSO DO JALECO","EXTRA DO JALECO","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  AVENTAL: ["MODELAGEM","TECIDO","BOLSO DO AVENTAL","ALÇA DO AVENTAL","EXTRA DO AVENTAL","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
};
const ORDEM_TAM = ["PP","P","M","G","GG","XG","XGG","XXGG","XXXGG"];
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

function parseLancamento(t) {
  const out = { itens: [] };
  const clean = t.replace(/[ \t]+/g, " ");
  const pick = (re) => { const m = clean.match(re); return m ? m[1].trim() : null; };
  out.clienteNome = pick(/CLIENTE\s*\n?\s*(.+?)\s*\n?\s*CONDI[ÇC][ÃA]O DE PAGAMENTO/i);
  out.condicaoPagamento = pick(/CONDI[ÇC][ÃA]O DE PAGAMENTO\s*\n?\s*(.+?)\s*\n?\s*OC\b/i);
  out.oc = pick(/\bOC\s*\n?\s*(\S+)\s*\n?\s*PRAZO DE ENTREGA/i);
  out.prazoEntrega = pick(/PRAZO DE ENTREGA\s*\n?\s*(\S+)/i);
  out.clienteCnpj = pick(/CNPJ\s*\n?\s*([\d.\/-]{14,20})/i);
  out.clienteIe = pick(/INSCR\.?\s*ESTADUAL\s*\n?\s*([\dA-Z.\/-]+)/i);
  out.clienteEndereco = pick(/ENDERE[ÇC]O\s*\n?\s*(.+?CEP\s*[\d-]+)/i);

  const re = /(\d+)\.\s+([A-ZÇÃÉÍÁÔÕÂÊ]+)\s+·\s+([^\n]+)/g;
  const heads = []; let m;
  while ((m = re.exec(t))) heads.push({ idx: m.index, tipo: norm(m[2]), desc: m[3].trim() });
  for (let i = 0; i < heads.length; i++) {
    const bloco = t.slice(heads[i].idx, i + 1 < heads.length ? heads[i + 1].idx : undefined);
    const tipo = COMPONENTES[heads[i].tipo] ? heads[i].tipo : "POLO";
    const item = { tipoPecaNome: tipo, codigo: "", descricao: heads[i].desc, valorUnitario: null, grade: [], parametros: {}, fotoBase64: "" };
    const vu = bloco.match(/VALOR UNIT[ÁA]RIO\s*R?\$?\s*([\d.]+,\d{2})/i);
    if (vu) item.valorUnitario = vu[1];
    const g = bloco.match(/GRADE:\s*([\s\S]*?)(?:\n\d+\.\s|\nTOTAL GERAL|\nCampos|$)/i);
    if (g) {
      const gre = /(XXXGG|XXGG|XGG|GG|XG|PP|P|M|G)\s*:\s*(\d+)/g; let gm; const map = {};
      while ((gm = gre.exec(g[1]))) map[gm[1]] = gm[2];
      item.grade = ORDEM_TAM.map((tm) => ({ tam: tm, qtd: map[tm] != null ? String(map[tm]) : "" }));
    }
    const tecido = (bloco.match(/\nTECIDO\s*(.+)/i) || [])[1];
    const cor = (bloco.match(/COR DO TECIDO\s*(.+)/i) || [])[1];
    if (tecido) {
      const malha = /MALHA|PV|RIBANA|DRY|POLIVISCOSE|HELANCA|SUPLEX/i.test(tecido);
      item.parametros["TECIDO"] = { tipo: malha ? "MALHA" : "PLANO", artigo: tecido.trim() + (cor ? " · " + cor.trim() : ""), medida: "" };
    }
    const comps = COMPONENTES[item.tipoPecaNome] || [];
    for (const comp of comps) {
      if (comp === "TECIDO") continue;
      const cre = new RegExp("\\n" + comp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*([^\\n]+)", "i");
      const cm = bloco.match(cre);
      if (cm) item.parametros[comp] = cm[1].trim();
    }
    const patte = (bloco.match(/PATTE DA [A-ZÇÃÉ]+\s*([^\n]+)/i) || [])[1];
    if (patte) { const fech = comps.find((c) => /FECHAMENTO/.test(c)); if (fech && !item.parametros[fech]) item.parametros[fech] = patte.trim(); }
    if (!item.parametros["PERSONALIZAÇÃO"]) { const p = (bloco.match(/PERSONALIZA[ÇC][ÃA]O\s*([^\n]+)/i) || [])[1]; if (p) item.parametros["PERSONALIZAÇÃO"] = p.trim(); }
    out.itens.push(item);
  }
  return out;
}

function parsePedido(t) {
  const out = {};
  let m = t.match(/PEDIDO\s*(\d+?)(\d{2}\/\d{2}\/\d{4})/i);
  if (m) out.numero = m[1];
  else { m = t.match(/PEDIDO\s*N?º?\s*(\d{5,})/i); if (m) out.numero = m[1]; }
  const dt = t.match(/DT Despacho\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i); if (dt) out.dtDespacho = dt[1];
  const tp = t.match(/Tipo de Pedido\s*\n?\s*([^\n]+)/i); if (tp) out.tipoPedido = tp[1].trim();
  const vd = t.match(/Vendedor\s*\n?\s*([A-ZÀ-Ú ]{2,40})/i); if (vd) out.vendedor = vd[1].trim();
  return out;
}

export async function POST(req) {
  const b = await req.json();
  let out = {};
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const readPdf = async (b64) => { const raw = b64.includes(",") ? b64.split(",")[1] : b64; return (await pdfParse(Buffer.from(raw, "base64"))).text || ""; };

  if (b.lancBase64) { try { out = { ...out, ...parseLancamento(await readPdf(b.lancBase64)) }; } catch (e) { out.erroLanc = e.message; } }
  if (b.pedidoBase64) { try { out = { ...out, ...parsePedido(await readPdf(b.pedidoBase64)) }; } catch (e) { out.erroPed = e.message; } }

  Object.keys(out).forEach((k) => { if (out[k] == null || out[k] === "") delete out[k]; });
  return Response.json(out);
}
