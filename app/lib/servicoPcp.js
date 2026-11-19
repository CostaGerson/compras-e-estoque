// v1006 — lançamento de SERVIÇO pelas ferramentas de Silk e Bordado do PCP (sem login).
// A tela /servico/<TOKEN>?setor=silk|bordado manda x-usuario-id = "svc:<TOKEN>:<setor>".
// Esse usuário virtual só lança e edita pedidos do tipo SERVIÇO: não lista, não fatura, não vê outros pedidos.
import { prisma } from "@/lib/prisma";

export const TOKEN_SERVICO_PCP = "ace7106d6f110cfe89dabb7b7bf49c1c";
export const SETORES_SERVICO = { silk: "SILK", bordado: "BORDADO" };

export function usuarioServicoPcp(id) {
  const m = /^svc:([a-f0-9]+):([a-z]+)$/.exec(String(id || ""));
  if (!m || m[1] !== TOKEN_SERVICO_PCP || !SETORES_SERVICO[m[2]]) return null;
  return { id: 0, nome: "PCP", sobrenome: SETORES_SERVICO[m[2]], ativo: true, setor: "PCP", isMaster: false, diretoria: false, permissoes: [], servicoPcp: m[2] };
}
export const tokenServicoOk = (t) => String(t || "") === TOKEN_SERVICO_PCP;
export const ehServico = (tipo) => String(tipo || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "SERVICO";
// pedido existente: o usuário do PCP só mexe em pedido de serviço
export async function ppDeServico(id) {
  const pp = await prisma.pp.findUnique({ where: { id: Number(id) || 0 }, select: { tipoPedido: true } });
  return !!pp && ehServico(pp.tipoPedido);
}
export const negadoServico = () => Response.json({ error: "Pela ferramenta do PCP só dá para lançar pedido de serviço." }, { status: 403 });
