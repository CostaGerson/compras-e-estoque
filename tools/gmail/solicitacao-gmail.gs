/**
 * ERP Meridian — e-mails do Gmail viram tarefas no ERP (v873)
 *
 *  · etiqueta "Pedidos a Lançar"      → tarefa "LANÇAR PEDIDO" do Leandro
 *  · etiqueta "Fatura/nota a lançar"  → tarefa "LANÇAR FATURA/NOTA" da Brenda
 *
 * A cada 5 minutos o script olha cada etiqueta, manda para o ERP o que ainda não foi enviado
 * (assunto, remetente, texto e TODOS os anexos) e põe a etiqueta "feito" na conversa.
 * As suas etiquetas continuam como estão. O que já estava na etiqueta quando ela foi ligada fica de fora.
 */
const ERP_URL = "https://erp.meridianpro.com.br/api/ext/solicitacao";
const TOKEN = "COLE_AQUI_O_TOKEN";                       // Dados › Integrações no ERP (X-Api-Key)
const PARTE = 8 * 1024 * 1024;

// origem: nome exato da etiqueta OU um padrão (/.../i) para achar pelo nome · feito: o script cria se não existir
const FLUXOS = [
  { tipo: "PEDIDO", origem: "1. Pedidos/Pedidos a Lançar", feito: "1. Pedidos/Enviado ao ERP" },
  { tipo: "FATURA", origem: /fatura\/nota a lan[çc]ar/i, feito: "Enviado ao ERP/Faturas e notas" },
];

function acharEtiqueta(origem) {
  if (typeof origem === "string") return GmailApp.getUserLabelByName(origem);
  return GmailApp.getUserLabels().find((l) => origem.test(l.getName())) || null;
}

function enviarSolicitacoes() {
  const props = PropertiesService.getScriptProperties();
  for (const f of FLUXOS) {
    const origem = acharEtiqueta(f.origem);
    if (!origem) { console.log("Etiqueta não encontrada: " + f.origem); continue; }
    if (!props.getProperty("instalado:" + f.tipo)) { ignorarExistentes(f, origem); continue; }   // etiqueta nova: só guarda o que já tem
    const feito = GmailApp.getUserLabelByName(f.feito) || GmailApp.createLabel(f.feito);
    for (const th of origem.getThreads(0, 50)) {
      if (th.getLabels().some((l) => l.getName() === f.feito)) continue;
      if (props.getProperty("ign:" + th.getId())) continue;   // já estava na etiqueta quando ela foi ligada
      try { enviarConversa(th, f.tipo); th.addLabel(feito); }
      catch (e) { console.log("Falhou (" + f.tipo + "): " + th.getFirstMessageSubject() + " — " + e.message); }
    }
  }
}

function enviarConversa(th, tipo) {
  const msgs = th.getMessages();
  const ult = msgs[msgs.length - 1];
  const r = chamar({ acao: "criar", tipo, idEmail: th.getId(), de: ult.getFrom(), assunto: ult.getSubject(),
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

// guarda as conversas que já estão na etiqueta (já lançadas) para nunca enviar
function ignorarExistentes(f, origem) {
  const props = PropertiesService.getScriptProperties();
  let n = 0, inicio = 0, lote;
  do { lote = origem.getThreads(inicio, 100); lote.forEach((th) => { props.setProperty("ign:" + th.getId(), "1"); n++; }); inicio += 100; } while (lote.length === 100);
  props.setProperty("instalado:" + f.tipo, new Date().toISOString());
  console.log(origem.getName() + ": " + n + " conversa(s) que já estavam na etiqueta ficaram de fora. Daqui em diante, só as novas vão para o ERP.");
}

/** Rode UMA vez (ou de novo depois de colar uma versão nova): liga a verificação a cada 5 minutos.
 *  Etiqueta que já estava ligada não muda; etiqueta nova guarda o que já tem e só envia o que entrar depois. */
function instalar() {
  const props = PropertiesService.getScriptProperties();
  if (props.getKeys().some((k) => k.startsWith("ign:")) && !props.getProperty("instalado:PEDIDO"))
    props.setProperty("instalado:PEDIDO", new Date().toISOString());   // instalação da versão anterior (só pedidos): mantém
  for (const f of FLUXOS) {
    if (props.getProperty("instalado:" + f.tipo)) { console.log(f.tipo + ": já estava ligada."); continue; }
    const origem = acharEtiqueta(f.origem);
    if (!origem) { console.log("Etiqueta não encontrada: " + f.origem + " — confira o nome em FLUXOS."); continue; }
    ignorarExistentes(f, origem);
  }
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("enviarSolicitacoes").timeBased().everyMinutes(5).create();
}
