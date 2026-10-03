// Contratos de alavancagem, limites de crédito e tributos das planilhas que a Meridian já usava
// (Controle Alavancagem_Dívidas.xlsx e Limites de Crédito.xlsx, data de referência 03/10/2026).
// Os campos "...Informado" são o que estava na planilha: a tela compara com o cálculo e avisa a diferença.
// Carregado uma única vez, quando a tabela está vazia (lib/alavancagem.js → garantirContratos).

export const CONTRATOS_SEED = [
  {
    "nome": "CONSIGNADO MAYCON",
    "capital": 50000.0,
    "dataContrato": "2021-09-01",
    "tipo": "PARCELADO",
    "grupo": "GIRO_LP",
    "credor": "MAYCON",
    "taxaMensal": 1.25,
    "inicioPagamento": "2022-01-01",
    "parcela": 950.0,
    "prazoMeses": 96,
    "debitoTotalInformado": 91200.0,
    "parcelasPagasInformadas": 57,
    "aVencerInformado": 37050.0,
    "pagarAteInformado": "2030-01-01"
  },
  {
    "nome": "CONSIGNADO GLÓRIA",
    "capital": 15000.0,
    "dataContrato": "2021-05-01",
    "tipo": "PARCELADO",
    "grupo": "GIRO_LP",
    "credor": "GLÓRIA",
    "taxaMensal": 1.25,
    "inicioPagamento": "2021-05-01",
    "parcela": 385.0,
    "prazoMeses": 84,
    "debitoTotalInformado": 32340.0,
    "parcelasPagasInformadas": 65,
    "aVencerInformado": 7315.0,
    "pagarAteInformado": "2027-04-01"
  },
  {
    "nome": "CDC KÁTIA",
    "capital": 35000.0,
    "dataContrato": "2024-05-02",
    "tipo": "PARCELADO",
    "grupo": "GIRO_LP",
    "credor": "KÁTIA",
    "taxaMensal": 3.83,
    "inicioPagamento": "2024-06-30",
    "parcela": 2150.0,
    "prazoMeses": 36,
    "debitoTotalInformado": 77400.0,
    "parcelasPagasInformadas": 35,
    "aVencerInformado": 2150.0,
    "pagarAteInformado": "2026-09-30"
  },
  {
    "nome": "GIROCAIXA",
    "capital": 70000.0,
    "dataContrato": "2025-06-05",
    "tipo": "PARCELADO",
    "grupo": "GIRO_LP",
    "credor": "CAIXA",
    "taxaMensal": 2.95,
    "inicioPagamento": "2025-07-05",
    "parcela": 3614.03,
    "prazoMeses": 30,
    "debitoTotalInformado": 108420.9,
    "parcelasPagasInformadas": 14,
    "aVencerInformado": 57824.48,
    "pagarAteInformado": "2027-12-05"
  },
  {
    "nome": "PRONAMPE MERIDIAN",
    "capital": 150000.0,
    "dataContrato": "2025-01-01",
    "tipo": "PARCELADO",
    "grupo": "GIRO_LP",
    "credor": "CAIXA",
    "taxaMensal": 1.75,
    "inicioPagamento": "2026-01-01",
    "parcela": 6500.0,
    "prazoMeses": 36,
    "debitoTotalInformado": 150000.0,
    "parcelasPagasInformadas": 9,
    "aVencerInformado": 175500.0,
    "pagarAteInformado": "2028-12-01"
  },
  {
    "nome": "OP 03 - EMANUEL - GIRO",
    "capital": 75000.0,
    "dataContrato": "2025-09-29",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "EMANUEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 441,
    "valorAPagarInformado": 108075.0,
    "jurosTotaisInformado": 33075.0,
    "jurosMesInformado": 2250.0
  },
  {
    "nome": "OP 04 - EMANUEL - GIRO",
    "capital": 75000.0,
    "dataContrato": "2025-09-29",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "EMANUEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 441,
    "valorAPagarInformado": 108075.0,
    "jurosTotaisInformado": 33075.0,
    "jurosMesInformado": 2250.0
  },
  {
    "nome": "OP 06 - EMANUEL - GIRO",
    "capital": 120000.0,
    "dataContrato": "2025-10-31",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "EMANUEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 409,
    "valorAPagarInformado": 169080.0,
    "jurosTotaisInformado": 49080.0,
    "jurosMesInformado": 3600.0
  },
  {
    "nome": "OP 05 - LAEL - GIRO",
    "capital": 50000.0,
    "dataContrato": "2025-10-08",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "LAEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 432,
    "valorAPagarInformado": 71600.0,
    "jurosTotaisInformado": 21600.0,
    "jurosMesInformado": 1500.0
  },
  {
    "nome": "OP 08 - ISABEL - GIRO",
    "capital": 100000.0,
    "dataContrato": "2026-01-13",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "ISABEL",
    "taxaMensal": 2.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 335,
    "valorAPagarInformado": 122333.33,
    "jurosTotaisInformado": 22333.33,
    "jurosMesInformado": 2000.0
  },
  {
    "nome": "OP 09 - GABRIEL - GIRO",
    "capital": 45000.0,
    "dataContrato": "2026-02-26",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "GABRIEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-27",
    "prazoDias": 304,
    "valorAPagarInformado": 58680.0,
    "jurosTotaisInformado": 13680.0,
    "jurosMesInformado": 1350.0
  },
  {
    "nome": "OP 10 - GABRIEL - GIRO",
    "capital": 55000.0,
    "dataContrato": "2026-02-26",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "GABRIEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-27",
    "prazoDias": 304,
    "valorAPagarInformado": 71720.0,
    "jurosTotaisInformado": 16720.0,
    "jurosMesInformado": 1650.0
  },
  {
    "nome": "OP 11 - LAEL - GIRO",
    "capital": 50000.0,
    "dataContrato": "2026-04-10",
    "tipo": "MUTUO",
    "grupo": "MUTUO_GIRO",
    "credor": "LAEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 248,
    "valorAPagarInformado": 62400.0,
    "jurosTotaisInformado": 12400.0,
    "jurosMesInformado": 1500.0
  },
  {
    "nome": "OP 12 - ISABEL - ARREMATE W3",
    "capital": 50000.0,
    "dataContrato": "2026-05-04",
    "tipo": "MUTUO",
    "grupo": "ARREMATE_W3",
    "credor": "ISABEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 224,
    "valorAPagarInformado": 61200.0,
    "jurosTotaisInformado": 11200.0,
    "jurosMesInformado": 1500.0
  },
  {
    "nome": "OP 13 - PEDRO - ARREMATE W3",
    "capital": 56000.0,
    "dataContrato": "2026-05-04",
    "tipo": "MUTUO",
    "grupo": "ARREMATE_W3",
    "credor": "PEDRO",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-08-02",
    "prazoDias": 90,
    "valorAPagarInformado": 61040.0,
    "jurosTotaisInformado": 5040.0,
    "jurosMesInformado": 1680.0
  },
  {
    "nome": "OP 14 - MATEUS - ARREMATE W3",
    "capital": 50000.0,
    "dataContrato": "2026-05-04",
    "tipo": "MUTUO",
    "grupo": "ARREMATE_W3",
    "credor": "MATEUS",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-08-02",
    "prazoDias": 90,
    "valorAPagarInformado": 54500.0,
    "jurosTotaisInformado": 4500.0,
    "jurosMesInformado": 1500.0
  },
  {
    "nome": "OP 15 - EMANUEL- ARREMATE W3",
    "capital": 30000.0,
    "dataContrato": "2026-05-06",
    "tipo": "MUTUO",
    "grupo": "ARREMATE_W3",
    "credor": "EMANUEL",
    "taxaMensal": 3.0,
    "vencimentoUnico": "2026-12-14",
    "prazoDias": 222,
    "valorAPagarInformado": 36660.0,
    "jurosTotaisInformado": 6660.0,
    "jurosMesInformado": 900.0
  },
  {
    "nome": "WIPRIME",
    "capital": 245000.0,
    "dataContrato": "2025-09-01",
    "tipo": "INVESTIMENTO",
    "grupo": "INVESTIMENTO",
    "credor": "WIPRIME",
    "entrada": 50000.0,
    "inicioPagamento": "2025-10-01",
    "parcela": 9750.0,
    "prazoMeses": 20,
    "debitoTotalInformado": 195000.0,
    "parcelasPagasInformadas": 12,
    "aVencerInformado": 78000.0,
    "pagarAteInformado": "2027-05-01"
  },
  {
    "nome": "WELTTEC",
    "capital": 70450.0,
    "dataContrato": "2025-10-01",
    "tipo": "INVESTIMENTO",
    "grupo": "INVESTIMENTO",
    "credor": "WELLTEC",
    "entrada": 0.0,
    "inicioPagamento": "2025-10-13",
    "parcela": 5868.49,
    "prazoMeses": 12,
    "debitoTotalInformado": 70421.88,
    "parcelasPagasInformadas": 11,
    "aVencerInformado": 5868.49,
    "pagarAteInformado": "2026-10-13"
  }
];

export const LIMITES_SEED = [
  {
    "banco": "ITAÚ",
    "produto": "CHEQUE ESPECIAL",
    "limite": 20000.0,
    "taxaMensal": 15.49
  },
  {
    "banco": "ITAÚ",
    "produto": "CONTA GARANTIDA",
    "limite": 7000.0,
    "taxaMensal": 7.49
  },
  {
    "banco": "ITAÚ",
    "produto": "DESCONTO DE DUPLICATAS",
    "limite": 0.0,
    "taxaMensal": 3.46
  },
  {
    "banco": "ITAÚ",
    "produto": "CARTÃO DE CRÉDITO",
    "limite": 5000.0
  },
  {
    "banco": "BANCO DO BRASIL",
    "produto": "CHEQUE ESPECIAL",
    "limite": 1000.0,
    "taxaMensal": 15.49
  },
  {
    "banco": "BANCO DO BRASIL",
    "produto": "DESCONTO DE DUPLICATAS",
    "limite": 0.0,
    "taxaMensal": 3.49
  },
  {
    "banco": "BANCO DO BRASIL",
    "produto": "CARTÃO DE CRÉDITO",
    "limite": 11000.0
  },
  {
    "banco": "BRADESCO",
    "produto": "CHEQUE ESPECIAL",
    "limite": 0.0,
    "taxaMensal": 15.49
  },
  {
    "banco": "BRADESCO",
    "produto": "DESCONTO DE DUPLICATAS",
    "limite": 200000.0,
    "taxaMensal": 6.12
  },
  {
    "banco": "BRADESCO",
    "produto": "CONTA GARANTIDA",
    "limite": 50000.0,
    "taxaMensal": 8.5
  },
  {
    "banco": "BRADESCO",
    "produto": "CARTÃO DE CRÉDITO",
    "limite": 50000.0
  },
  {
    "banco": "INTER",
    "produto": "CARTÃO DE CRÉDITO",
    "limite": 2000.0
  },
  {
    "banco": "AZUL CAPITAL",
    "produto": "ANTECIPAÇÃO DE RECEBÍVEIS",
    "limite": 100000.0,
    "taxaMensal": 3.5
  },
  {
    "banco": "CAIXA",
    "produto": "CHEQUE ESPECIAL",
    "limite": 10000.0,
    "taxaMensal": 15.0
  },
  {
    "banco": "C6",
    "produto": "CHEQUE ESPECIAL",
    "limite": 15000.0,
    "taxaMensal": 15.0
  },
  {
    "banco": "C6",
    "produto": "CARTÃO DE CRÉDITO",
    "limite": 6000.0
  },
  {
    "banco": "EMANUEL",
    "produto": "MUTUO",
    "limite": 300000.0,
    "taxaMensal": 3.0
  },
  {
    "banco": "LAEL",
    "produto": "MUTUO",
    "limite": 100000.0,
    "taxaMensal": 3.0
  },
  {
    "banco": "GABRIEL",
    "produto": "MUTUO",
    "limite": 110000.0,
    "taxaMensal": 3.0
  },
  {
    "banco": "MATEUS",
    "produto": "MUTUO",
    "limite": 50000.0,
    "taxaMensal": 3.0
  },
  {
    "banco": "ISABEL",
    "produto": "MUTUO",
    "limite": 150000.0,
    "taxaMensal": 3.0
  }
];

export const TRIBUTOS_SEED = [
  {
    "grupo": "RFB",
    "descricao": "RFB EM ABERTO (GUIAS AT)",
    "valor": 30125.78,
    "exigivel": true
  },
  {
    "grupo": "RFB",
    "descricao": "RFB PARCELADO (PARC SIMPLES)",
    "valor": 164238.69,
    "exigivel": true,
    "parcelado": true,
    "parcelaMensal": 3000.0
  },
  {
    "grupo": "PGFN",
    "descricao": "PGFN PARCELADO",
    "valor": 592105.06,
    "exigivel": true,
    "parcelado": true,
    "parcelaMensal": 8000.0
  },
  {
    "grupo": "ESTADUAL",
    "descricao": "VALOR EM ABERTO NÃO EXIGÍVEL",
    "valor": 80551.26,
    "exigivel": false
  },
  {
    "grupo": "ESTADUAL",
    "descricao": "VALOR EM ABERTO EXIGÍVEL",
    "valor": 19191.04,
    "exigivel": true
  }
];
