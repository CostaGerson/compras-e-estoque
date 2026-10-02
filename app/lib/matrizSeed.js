// Dados iniciais da Matriz de custos, importados da planilha "1_Matriz (3).xlsx" (aba Negócio = oficial, aba Simulação = cenário).
export const MATRIZ_SEED = {
 "oficial": {
  "parametros": {
   "inssPatronal": 0.2,
   "inssFunc": 0.075,
   "fgts": 0.08,
   "vtDesconto": 0.06,
   "multaFgts": 0.4,
   "diasUteis": 22
  },
  "vidaVegetativa": [
   {
    "id": "i1",
    "natureza": "ALUGUEL",
    "valor": 25000.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i2",
    "natureza": "IPTU",
    "valor": 2420.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i3",
    "natureza": "ÁGUA",
    "valor": 130.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i4",
    "natureza": "SEGURO IMÓVEL (FIANÇA + NORMAL)",
    "valor": 2700.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i5",
    "natureza": "ENERGIA",
    "valor": 3500.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i6",
    "natureza": "TELEFONIA",
    "valor": 450.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i7",
    "natureza": "FAXINA",
    "valor": 1840.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i8",
    "natureza": "PADARIA",
    "valor": 820.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i9",
    "natureza": "INSUMOS",
    "valor": 900.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "pessoal": [
   {
    "id": "p10",
    "nome": "MAYCON",
    "cargo": "DIRETOR OPERACIONAL",
    "depto": "DIR",
    "regime": "DIRETOR",
    "salario": 1621.0,
    "bonus": 4500.0,
    "vt": 350.0,
    "descontaVt": false,
    "vr": 0.0,
    "ps": 0.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p11",
    "nome": "IGOR",
    "cargo": "DIRETOR FINANCEIRO",
    "depto": "DIR",
    "regime": "DIRETOR",
    "salario": 1621.0,
    "bonus": 4500.0,
    "vt": 350.0,
    "descontaVt": false,
    "vr": 0.0,
    "ps": 0.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p12",
    "nome": "PEDRO",
    "cargo": "DIRETOR COMERCIAL",
    "depto": "DIR",
    "regime": "DIRETOR",
    "salario": 1621.0,
    "bonus": 4500.0,
    "vt": 350.0,
    "descontaVt": false,
    "vr": 0.0,
    "ps": 0.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p13",
    "nome": "LEANDRO",
    "cargo": "ENCARREGADO PCP",
    "depto": "ADM",
    "regime": "CLT",
    "salario": 4000.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p14",
    "nome": "BRENDA",
    "cargo": "AUX ADM",
    "depto": "ADM",
    "regime": "CLT",
    "salario": 2100.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.035,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p15",
    "nome": "RAUL",
    "cargo": "ESTAGIÁRIO",
    "depto": "ADM",
    "regime": "ESTAGIO",
    "salario": 811.0,
    "bonus": 0,
    "vt": 281.25,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0,
    "saldoLivre": 0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p16",
    "nome": "",
    "cargo": "AUX SERVIÇOS GERAIS",
    "depto": "ADM",
    "regime": "CLT",
    "salario": 1800.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p17",
    "nome": "DAVID",
    "cargo": "PLOTISTA",
    "depto": "COR",
    "regime": "CLT",
    "salario": 1621.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p18",
    "nome": "HIGLEY",
    "cargo": "CORTADOR",
    "depto": "COR",
    "regime": "CLT",
    "salario": 3000.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p19",
    "nome": "FRANKLIN",
    "cargo": "SEPARADOR CORTE",
    "depto": "COR",
    "regime": "CLT",
    "salario": 1621.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 701.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p20",
    "nome": "JHONNY",
    "cargo": "ENCARREGADO SILK",
    "depto": "SIL",
    "regime": "CLT",
    "salario": 3500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p21",
    "nome": "SILVIA",
    "cargo": "ENCARREGADA BORDADO",
    "depto": "BOR",
    "regime": "CLT",
    "salario": 3500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p22",
    "nome": "ROSE",
    "cargo": "ENCARREGADA DE COSTURA - MALHA",
    "depto": "COS",
    "regime": "CLT",
    "salario": 2600.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p23",
    "nome": "RAQUEL",
    "cargo": "COSTUREIRA II",
    "depto": "COS",
    "regime": "CLT",
    "salario": 2000.0,
    "bonus": 200.0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p24",
    "nome": "CINTIA",
    "cargo": "COSTUREIRA II",
    "depto": "COS",
    "regime": "CLT",
    "salario": 2500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p25",
    "nome": "DORALICE",
    "cargo": "PILOTISTA",
    "depto": "COS",
    "regime": "CLT",
    "salario": 1720.0,
    "bonus": 0,
    "vt": 340.1,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 240.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p26",
    "nome": "CLENICE",
    "cargo": "CONFERENTE",
    "depto": "EXP",
    "regime": "CLT",
    "salario": 1800.0,
    "bonus": 300.0,
    "vt": 577.6,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 184.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p27",
    "nome": "VALÉRIA",
    "cargo": "ARREMATADEIRA",
    "depto": "EXP",
    "regime": "CLT",
    "salario": 1800.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 184.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p28",
    "nome": "ANTONIO",
    "cargo": "MOTORISTA AB",
    "depto": "LOG",
    "regime": "CLT",
    "salario": 2500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 208.0,
    "ativo": true,
    "obs": ""
   }
  ],
  "logistica": [
   {
    "id": "i29",
    "natureza": "PARCELA SAVEIRO",
    "valor": 609.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i30",
    "natureza": "SEGURO SAVEIRO",
    "valor": 223.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i31",
    "natureza": "IPVA SAVEIRO",
    "valor": 190.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i32",
    "natureza": "HIGIENIZAÇÃO SAVEIRO",
    "valor": 90.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i33",
    "natureza": "PARCELA MOTO",
    "valor": 815.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i34",
    "natureza": "SEGURO MOTO",
    "valor": 184.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i35",
    "natureza": "IPVA MOTO",
    "valor": 67.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i36",
    "natureza": "HIGIENIZAÇÃO MOTO",
    "valor": 40.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i37",
    "natureza": "PROVISÃO MNT",
    "valor": 690.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i38",
    "natureza": "MNT ELEVADORES",
    "valor": 300.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "administracao": [
   {
    "id": "i39",
    "natureza": "CONTRIBUIÇÃO SINDICAL",
    "valor": 430.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i40",
    "natureza": "TX MANUTENÇÃO RET",
    "valor": 293.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i41",
    "natureza": "FIEMG JOVEM",
    "valor": 230.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i42",
    "natureza": "SEGURO VIDA",
    "valor": 360.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i43",
    "natureza": "PCMSO/ASO",
    "valor": 108.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i44",
    "natureza": "CERTIFICADO DIGITAL",
    "valor": 42.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i45",
    "natureza": "CLAUDE",
    "valor": 550.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i46",
    "natureza": "ERP (BLING)",
    "valor": 180.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i47",
    "natureza": "ASANA",
    "valor": 385.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i48",
    "natureza": "WORKSPACE",
    "valor": 28.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i49",
    "natureza": "CANVA PRO",
    "valor": 34.9,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i50",
    "natureza": "VPS",
    "valor": 72.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i51",
    "natureza": "TFLF/TFLS",
    "valor": 149.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i52",
    "natureza": "CONTABILIDADE",
    "valor": 2450.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i53",
    "natureza": "CONS. RH E MELHORIA CONTÍNUA",
    "valor": 2431.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i54",
    "natureza": "CONFRATERNIZAÇÃO",
    "valor": 800.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i55",
    "natureza": "TAR. MNT CONTAS",
    "valor": 400.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i56",
    "natureza": "KIT NATALINO",
    "valor": 150.0,
    "cdb": true,
    "obs": ""
   }
  ],
  "sistemas": [
   {
    "id": "i57",
    "natureza": "AUDACES",
    "valor": 1400.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i58",
    "natureza": "WAVECODE",
    "valor": 420.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i59",
    "natureza": "PCP",
    "valor": 180.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i60",
    "natureza": "LICITAÇÕES-E",
    "valor": 50.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i61",
    "natureza": "KM SISTEMAS",
    "valor": 1200.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "dividas": [
   {
    "id": "i62",
    "natureza": "DÍVIDA 02 (MAYCON)",
    "valor": 1409.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i63",
    "natureza": "DÍVIDA 04 (GIROCAIXA)",
    "valor": 3614.03,
    "cdb": false,
    "obs": "considerando pgto até o final do ano"
   },
   {
    "id": "i64",
    "natureza": "DIVIDA 05 (PRONAMPE)",
    "valor": 5800.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i65",
    "natureza": "DÍVIDA 06  (TRIBUTÁRIO)",
    "valor": 10000.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i66",
    "natureza": "WELLTEC (MAQ COST)",
    "valor": 5869.0,
    "cdb": false,
    "obs": "considerando negociação das guias em aberto"
   },
   {
    "id": "i67",
    "natureza": "MUTUOS",
    "valor": 21680.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "producao": {
   "custoPeca": 4.77,
   "custoPecaObs": "MERIDIAN: 1,95 FREELANCER: 1,28",
   "razaoInternaAuto": true,
   "razaoInternaManual": 0.82,
   "custoLogPeca": 1.62,
   "razaoLog": 0.56,
   "razaoLogObs": "Logística interna representa 42% do custo logístico total de uma peça",
   "ticketMedio": 54.0,
   "metaPecas": 14500.0,
   "margemContribuicao": 0.18
  },
  "freelancer": {
   "expedicao": [
    {
     "id": "m68",
     "mes": "FEV",
     "pessoal": 12315.27,
     "freelancer": 11629.7,
     "pecas": 6869.0
    },
    {
     "id": "m69",
     "mes": "MAR",
     "pessoal": 16055.52,
     "freelancer": 10129.0,
     "pecas": 13608.0
    },
    {
     "id": "m70",
     "mes": "ABR",
     "pessoal": 12758.54,
     "freelancer": 939.37,
     "pecas": 8784.0
    },
    {
     "id": "m71",
     "mes": "MAIO",
     "pessoal": 12758.54,
     "freelancer": 2585.0,
     "pecas": 4269.0
    },
    {
     "id": "m72",
     "mes": "JUN",
     "pessoal": 12758.54,
     "freelancer": 285.0,
     "pecas": 8377.0
    },
    {
     "id": "m73",
     "mes": "JUL",
     "pessoal": 12758.54,
     "freelancer": 1557.8,
     "pecas": 5916.0
    }
   ],
   "corte": [
    {
     "id": "m74",
     "mes": "FEV",
     "pessoal": 7178.0,
     "freelancer": 3950.0,
     "pecas": 9959.0
    },
    {
     "id": "m75",
     "mes": "MAR",
     "pessoal": 13170.17,
     "freelancer": 1200.0,
     "pecas": 4720.0
    },
    {
     "id": "m76",
     "mes": "ABR",
     "pessoal": 13170.17,
     "freelancer": 0.0,
     "pecas": 6627.0
    },
    {
     "id": "m77",
     "mes": "MAIO",
     "pessoal": 13170.17,
     "freelancer": 0.0,
     "pecas": 5189.0
    },
    {
     "id": "m78",
     "mes": "JUN",
     "pessoal": 13170.17,
     "freelancer": 467.87,
     "pecas": 6702.0
    },
    {
     "id": "m79",
     "mes": "JUL",
     "pessoal": 13170.17,
     "freelancer": 1500.0,
     "pecas": 5064.0
    }
   ]
  },
  "notas": {
   "dividas": "Total das dívidas considerando que a Nort pague metade do custo."
  }
 },
 "simulacao": {
  "parametros": {
   "inssPatronal": 0.2,
   "inssFunc": 0.075,
   "fgts": 0.08,
   "vtDesconto": 0.06,
   "multaFgts": 0.4,
   "diasUteis": 22
  },
  "vidaVegetativa": [
   {
    "id": "i1",
    "natureza": "ALUGUEL",
    "valor": 25000.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i2",
    "natureza": "IPTU",
    "valor": 2420.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i3",
    "natureza": "ÁGUA",
    "valor": 130.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i4",
    "natureza": "SEGURO IMÓVEL (FIANÇA + NORMAL)",
    "valor": 2700.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i5",
    "natureza": "ENERGIA",
    "valor": 3500.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i6",
    "natureza": "TELEFONIA",
    "valor": 450.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i7",
    "natureza": "FAXINA",
    "valor": 1840.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i8",
    "natureza": "PADARIA",
    "valor": 820.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i9",
    "natureza": "INSUMOS",
    "valor": 900.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "pessoal": [
   {
    "id": "p80",
    "nome": "MAYCON",
    "cargo": "DIRETOR OPERACIONAL",
    "depto": "DIR",
    "regime": "DIRETOR",
    "salario": 1621.0,
    "bonus": 4500.0,
    "vt": 350.0,
    "descontaVt": false,
    "vr": 0.0,
    "ps": 0.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p81",
    "nome": "IGOR",
    "cargo": "DIRETOR FINANCEIRO",
    "depto": "DIR",
    "regime": "DIRETOR",
    "salario": 1621.0,
    "bonus": 4500.0,
    "vt": 350.0,
    "descontaVt": false,
    "vr": 0.0,
    "ps": 0.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p82",
    "nome": "PEDRO",
    "cargo": "DIRETOR COMERCIAL",
    "depto": "DIR",
    "regime": "DIRETOR",
    "salario": 1621.0,
    "bonus": 4500.0,
    "vt": 350.0,
    "descontaVt": false,
    "vr": 0.0,
    "ps": 0.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p83",
    "nome": "LEANDRO",
    "cargo": "ENCARREGADO PCP",
    "depto": "ADM",
    "regime": "CLT",
    "salario": 4000.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p84",
    "nome": "BRENDA",
    "cargo": "AUX ADM",
    "depto": "ADM",
    "regime": "CLT",
    "salario": 2100.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.035,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p85",
    "nome": "RAUL",
    "cargo": "ESTAGIÁRIO",
    "depto": "ADM",
    "regime": "ESTAGIO",
    "salario": 811.0,
    "bonus": 0,
    "vt": 281.25,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0,
    "saldoLivre": 0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p86",
    "nome": "DAVID",
    "cargo": "PLOTISTA",
    "depto": "COR",
    "regime": "CLT",
    "salario": 1621.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p87",
    "nome": "HIGLEY",
    "cargo": "CORTADOR",
    "depto": "COR",
    "regime": "CLT",
    "salario": 3000.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p88",
    "nome": "FRANKLIN",
    "cargo": "SEPARADOR CORTE",
    "depto": "COR",
    "regime": "CLT",
    "salario": 1621.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 701.0,
    "rFerias": 367.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p89",
    "nome": "JHONNY",
    "cargo": "ENCARREGADO SILK",
    "depto": "SIL",
    "regime": "CLT",
    "salario": 3500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p90",
    "nome": "SILVIA",
    "cargo": "ENCARREGADA BORDADO",
    "depto": "BOR",
    "regime": "CLT",
    "salario": 3500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p91",
    "nome": "ROSE",
    "cargo": "ENCARREGADA DE COSTURA - MALHA",
    "depto": "COS",
    "regime": "CLT",
    "salario": 2600.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p92",
    "nome": "RAQUEL",
    "cargo": "COSTUREIRA II",
    "depto": "COS",
    "regime": "CLT",
    "salario": 2000.0,
    "bonus": 200.0,
    "vt": 287.5,
    "descontaVt": false,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p93",
    "nome": "CINTIA",
    "cargo": "COSTUREIRA II",
    "depto": "COS",
    "regime": "CLT",
    "salario": 15000.0,
    "bonus": 0,
    "vt": 1500.0,
    "descontaVt": false,
    "vr": 600.0,
    "ps": 400.0,
    "assPct": 0,
    "saldoLivre": 0.0,
    "rFerias": 0.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p94",
    "nome": "DORALICE",
    "cargo": "PILOTISTA",
    "depto": "COS",
    "regime": "CLT",
    "salario": 1720.0,
    "bonus": 0,
    "vt": 340.1,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 240.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p95",
    "nome": "CLENICE",
    "cargo": "CONFERENTE",
    "depto": "EXP",
    "regime": "CLT",
    "salario": 1800.0,
    "bonus": 300.0,
    "vt": 577.6,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 184.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p96",
    "nome": "VALÉRIA",
    "cargo": "ARREMATADEIRA",
    "depto": "EXP",
    "regime": "CLT",
    "salario": 1800.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 184.0,
    "ativo": true,
    "obs": ""
   },
   {
    "id": "p97",
    "nome": "JOÃO",
    "cargo": "MOTORISTA AB",
    "depto": "LOG",
    "regime": "CLT",
    "salario": 2500.0,
    "bonus": 0,
    "vt": 287.5,
    "descontaVt": true,
    "vr": 100.0,
    "ps": 54.9,
    "assPct": 0.05,
    "saldoLivre": 0.0,
    "rFerias": 208.0,
    "ativo": true,
    "obs": ""
   }
  ],
  "logistica": [
   {
    "id": "i29",
    "natureza": "PARCELA SAVEIRO",
    "valor": 609.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i30",
    "natureza": "SEGURO SAVEIRO",
    "valor": 223.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i31",
    "natureza": "IPVA SAVEIRO",
    "valor": 190.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i32",
    "natureza": "HIGIENIZAÇÃO SAVEIRO",
    "valor": 90.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i33",
    "natureza": "PARCELA MOTO",
    "valor": 815.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i34",
    "natureza": "SEGURO MOTO",
    "valor": 184.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i35",
    "natureza": "IPVA MOTO",
    "valor": 67.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i36",
    "natureza": "HIGIENIZAÇÃO MOTO",
    "valor": 40.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i37",
    "natureza": "PROVISÃO MNT",
    "valor": 690.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i38",
    "natureza": "MNT ELEVADORES",
    "valor": 300.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "administracao": [
   {
    "id": "i39",
    "natureza": "CONTRIBUIÇÃO SINDICAL",
    "valor": 430.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i40",
    "natureza": "TX MANUTENÇÃO RET",
    "valor": 293.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i41",
    "natureza": "FIEMG JOVEM",
    "valor": 230.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i42",
    "natureza": "SEGURO VIDA",
    "valor": 360.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i43",
    "natureza": "PCMSO/ASO",
    "valor": 108.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i44",
    "natureza": "CERTIFICADO DIGITAL",
    "valor": 42.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i45",
    "natureza": "CLAUDE",
    "valor": 550.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i46",
    "natureza": "ERP (BLING)",
    "valor": 180.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i47",
    "natureza": "ASANA",
    "valor": 385.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i48",
    "natureza": "WORKSPACE",
    "valor": 28.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i49",
    "natureza": "CANVA PRO",
    "valor": 34.9,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i50",
    "natureza": "VPS",
    "valor": 72.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i51",
    "natureza": "TFLF/TFLS",
    "valor": 149.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i52",
    "natureza": "CONTABILIDADE",
    "valor": 2450.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i53",
    "natureza": "CONS. RH E MELHORIA CONTÍNUA",
    "valor": 2221.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i54",
    "natureza": "CONFRATERNIZAÇÃO",
    "valor": 800.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i55",
    "natureza": "TAR. MNT CONTAS",
    "valor": 400.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i56",
    "natureza": "KIT NATALINO",
    "valor": 150.0,
    "cdb": true,
    "obs": ""
   }
  ],
  "sistemas": [
   {
    "id": "i57",
    "natureza": "AUDACES",
    "valor": 1400.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i58",
    "natureza": "WAVECODE",
    "valor": 420.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i59",
    "natureza": "PCP",
    "valor": 180.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i60",
    "natureza": "LICITAÇÕES-E",
    "valor": 50.0,
    "cdb": true,
    "obs": ""
   },
   {
    "id": "i61",
    "natureza": "KM SISTEMAS",
    "valor": 1200.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "dividas": [
   {
    "id": "i62",
    "natureza": "DÍVIDA 02 (MAYCON)",
    "valor": 1409.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i63",
    "natureza": "DÍVIDA 04 (GIROCAIXA)",
    "valor": 3614.03,
    "cdb": false,
    "obs": "considerando pgto até o final do ano"
   },
   {
    "id": "i64",
    "natureza": "DIVIDA 05 (PRONAMPE)",
    "valor": 5800.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i65",
    "natureza": "DÍVIDA 06  (TRIBUTÁRIO)",
    "valor": 10000.0,
    "cdb": false,
    "obs": ""
   },
   {
    "id": "i66",
    "natureza": "WELLTEC (MAQ COST)",
    "valor": 5869.0,
    "cdb": false,
    "obs": "considerando negociação das guias em aberto"
   },
   {
    "id": "i67",
    "natureza": "MUTUOS",
    "valor": 21680.0,
    "cdb": false,
    "obs": ""
   }
  ],
  "producao": {
   "custoPeca": 4.77,
   "custoPecaObs": "MERIDIAN: 1,95 FREELANCER: 1,28",
   "razaoInternaAuto": true,
   "razaoInternaManual": 0.82,
   "custoLogPeca": 1.62,
   "razaoLog": 0.56,
   "razaoLogObs": "Logística interna representa 42% do custo logístico total de uma peça",
   "ticketMedio": 42.0,
   "metaPecas": 20000.0,
   "margemContribuicao": 0.18
  },
  "freelancer": {
   "expedicao": [
    {
     "id": "m68",
     "mes": "FEV",
     "pessoal": 12315.27,
     "freelancer": 11629.7,
     "pecas": 6869.0
    },
    {
     "id": "m69",
     "mes": "MAR",
     "pessoal": 16055.52,
     "freelancer": 10129.0,
     "pecas": 13608.0
    },
    {
     "id": "m70",
     "mes": "ABR",
     "pessoal": 12758.54,
     "freelancer": 939.37,
     "pecas": 8784.0
    },
    {
     "id": "m71",
     "mes": "MAIO",
     "pessoal": 12758.54,
     "freelancer": 2585.0,
     "pecas": 4269.0
    },
    {
     "id": "m72",
     "mes": "JUN",
     "pessoal": 12758.54,
     "freelancer": 285.0,
     "pecas": 8377.0
    },
    {
     "id": "m73",
     "mes": "JUL",
     "pessoal": 12758.54,
     "freelancer": 1557.8,
     "pecas": 5916.0
    }
   ],
   "corte": [
    {
     "id": "m74",
     "mes": "FEV",
     "pessoal": 7178.0,
     "freelancer": 3950.0,
     "pecas": 9959.0
    },
    {
     "id": "m75",
     "mes": "MAR",
     "pessoal": 13170.17,
     "freelancer": 1200.0,
     "pecas": 4720.0
    },
    {
     "id": "m76",
     "mes": "ABR",
     "pessoal": 13170.17,
     "freelancer": 0.0,
     "pecas": 6627.0
    },
    {
     "id": "m77",
     "mes": "MAIO",
     "pessoal": 13170.17,
     "freelancer": 0.0,
     "pecas": 5189.0
    },
    {
     "id": "m78",
     "mes": "JUN",
     "pessoal": 13170.17,
     "freelancer": 467.87,
     "pecas": 6702.0
    },
    {
     "id": "m79",
     "mes": "JUL",
     "pessoal": 13170.17,
     "freelancer": 1500.0,
     "pecas": 5064.0
    }
   ]
  },
  "notas": {
   "dividas": "Total das dívidas considerando que a Nort pague metade do custo."
  }
 }
};
