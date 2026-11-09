// v406 — token da leitura externa do PCP (mostrado ao gestor para passar ao Maycon)
// v732 — só para quem lança pedido (gerência/Leandro) e com a lista de endereços que usam o token
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";
import { usuarioPP, negadoPP } from "@/lib/pp";

const ENDPOINTS = [
  { metodo: "GET", caminho: "/api/ext/compras", desc: "Itens de pedido liberados por Compras para programar (e os ainda em compras). ?desde=ISO · ?pedido=NÚMERO" },
  { metodo: "GET", caminho: "/api/ext/faccoes", desc: "Cadastro de facções (formato antigo, v501)" },
  { metodo: "GET", caminho: "/api/ext/terceirizados", desc: "Cadastro de terceirizados (costura e personalização). ?desde=ISO" },
  { metodo: "GET", caminho: "/api/ext/rota/campos", desc: "Campos do formulário de demanda de rota" },
  { metodo: "GET", caminho: "/api/ext/rota?osPcp=N", desc: "Situação da demanda de rota de uma OS" },
  { metodo: "POST", caminho: "/api/ext/rota", desc: "Cria a demanda de rota a partir da OS do PCP (não duplica)" },
  { metodo: "POST", caminho: "/api/ext/rota/cancelar", desc: "Cancela a demanda de rota aberta pelo PCP" },
];
const resp = (token) => ({ token, caminho: "/api/ext/compras", cabecalho: "X-Api-Key", endpoints: ENDPOINTS, fixoNoServidor: !!(process.env.COMPRAS_EXT_TOKEN && process.env.COMPRAS_EXT_TOKEN.length >= 16) });

export async function GET(req) {
  if (!(await usuarioPP(req))) return negadoPP();
  return Response.json(resp(await tokenExterno()));
}
export async function POST(req) {
  if (!(await usuarioPP(req))) return negadoPP();
  return Response.json(resp(await tokenExterno(undefined, true)));
}
