/**
 * ERP Meridian — e-mail do Gmail vira SOLICITAÇÃO DE LANÇAMENTO DE PEDIDO (v872)
 *
 * Como funciona: a cada 5 minutos o script olha as conversas com a etiqueta ETIQUETA_ORIGEM
 * que ainda não têm a ETIQUETA_FEITO, manda para o ERP (assunto, remetente, texto e TODOS os anexos)
 * e põe a ETIQUETA_FEITO na conversa. No ERP vira a tarefa "LANÇAR PEDIDO · solicitado por …" do Leandro.
 * A sua etiqueta "Pedidos a Lançar" fica como está.
 */
const ERP_URL = "https://erp.meridianpro.com.br/api/ext/solicitacao";
const TOKEN = "COLE_AQUI_O_TOKEN";                       // Dados › Integrações no ERP (X-Api-Key)
const ETIQUETA_ORIGEM = "1. Pedidos/Pedidos a Lançar";    // nome exato da etiqueta no Gmail
const ETIQUETA_FEITO = "1. Pedidos/Enviado ao ERP";       // o script cria se não existir
const PARTE = 8 * 1024 * 1024;

function enviarSolicitacoes() {
  const origem = GmailApp.getUserLabelByName(ETIQUETA_ORIGEM);
  if (!origem) throw new Error("Etiqueta não encontrada: " + ETIQUETA_ORIGEM);
  const feito = GmailApp.getUserLabelByName(ETIQUETA_FEITO) || GmailApp.createLabel(ETIQUETA_FEITO);
  const threads = origem.getThreads(0, 50);
  for (const th of threads) {
    if (th.getLabels().some((l) => l.getName() === ETIQUETA_FEITO)) continue;
    try { enviarConversa(th); th.addLabel(feito); }
    catch (e) { console.log("Falhou: " + th.getFirstMessageSubject() + " — " + e.message); }
  }
}

function enviarConversa(th) {
  const msgs = th.getMessages();
  const ult = msgs[msgs.length - 1];
  const r = chamar({ acao: "criar", idEmail: th.getId(), de: ult.getFrom(), assunto: ult.getSubject(),
    data: Utilities.formatDate(ult.getDate(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"),
    corpo: ult.getPlainBody(), solicitante: Session.getActiveUser().getEmail() });
  const vistos = {};
  for (const m of msgs) {
    for (const a of m.getAttachments({ includeInlineImages: false })) {
      const nome = a.getName(), bytes = a.getBytes();
      const chave = nome + "|" + bytes.length;
      if (vistos[chave]) continue; vistos[chave] = true;
      const mime = a.getContentType();
      if (bytes.length <= PARTE) { chamar({ acao: "anexar", tarefaId: r.tarefaId, nome, mime, conteudo: Utilities.base64Encode(bytes) }); continue; }
      const ini = chamar({ acao: "iniciar", nome, mime, tamanho: bytes.length });
      let off = 0;
      while (off < bytes.length) {
        const p = chamar({ acao: "parte", token: ini.token, off, conteudo: Utilities.base64Encode(bytes.slice(off, off + PARTE)) });
        off = p.recebido;
      }
      chamar({ acao: "anexar", tarefaId: r.tarefaId, nome, mime, token: ini.token });
    }
  }
}

function chamar(corpo) {
  const resp = UrlFetchApp.fetch(ERP_URL, { method: "post", contentType: "application/json", headers: { "X-Api-Key": TOKEN },
    payload: JSON.stringify(corpo), muteHttpExceptions: true });
  const j = JSON.parse(resp.getContentText() || "{}");
  if (resp.getResponseCode() >= 300) throw new Error(j.error || ("HTTP " + resp.getResponseCode()));
  return j;
}

/** Rode UMA vez: liga a verificação automática a cada 5 minutos. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("enviarSolicitacoes").timeBased().everyMinutes(5).create();
  enviarSolicitacoes();
}
