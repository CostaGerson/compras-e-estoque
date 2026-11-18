// v960 — coleção Nanete (site nanete.com.br/colecoes, lido em 18/11/2026): um artigo de MALHA por artigo × cor, com composição,
// gramatura, largura e rendimento do site. Cores das cartelas Verão 2027/2028 e Inverno 2027 (a coleção vai na especificação).
// O site mostra a gramatura em kg/m² com o rótulo "g/m²" (0,245) — convertido para g/m² (245), confere com largura × rendimento.
// Roda uma vez (flag em FinConfig): cria o fornecedor NANETE se não existir e não duplica artigo × cor já cadastrado.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FLAG = "SEED|CARTELA|NANETE|2026-11-18";

const CORES = {"101":"Branco","106":"Única","301":"Preto","2598":"Primavera","2611":"Black","2613":"Baltico","2615":"Verde Musgo","3296":"Ouro","3297":"Prata","4057":"Marinho","4228":"Nutella","7658":"Vermelho","7906":"Bordô","8864":"Índico","8869":"Nature","9300":"Preto","10331":"Marrom","11628":"Tranquilus","14824":"Savana","15432":"Mescla Mel","18909":"Cocada","19122":"Militar","19239":"Origem","19245":"Gypsy","19247":"Kyra","19248":"Amare","19253":"Campo","19254":"Templo","53129":"Preto","53130":"Marinho","53679":"Calcário","53717":"Off White","55244":"Preto","55800":"Preto Reat","56189":"Cereja","56847":"Amendoim","56848":"Vinho","56850":"Creta","57800":"Preto","57801":"Bege","58164":"Rosa","58165":"Areia","58166":"Verde","58167":"Blue","58582":"Rosa","59414":"Marrom","59425":"Beijo","59427":"Lingerie","59442":"Militar","70013":"Caule","70014":"Renascer","70015":"Rústico","70016":"Próspero","70017":"Despertar","70018":"Liana","70019":"Memória","70020":"Surpresa","70021":"Roseira","70022":"Filosofia","70023":"Sereno","70024":"Essência","70025":"Riacho","70026":"Hera","70027":"Folhagem","70028":"Olímpia","71661":"Legado","71662":"Flor","71663":"Alegria","71664":"Borboleta","71665":"Clareza","71666":"Manifesto","71667":"Expressão","71668":"Vital","71669":"Sentido","71670":"Alquimia","71671":"Margem","71672":"Silêncio","71673":"Repouso","71674":"Sagrado","71675":"Porto Seguro","71676":"Maré","71677":"Ciclo","71678":"Pomar","71679":"Resiliente","74203":"Netuno","74204":"Denim","74206":"Jade","74207":"Carvalho","74209":"Palha","74210":"Cacau","74211":"Cafe","74213":"Morganita","74214":"Bronze","74215":"Ameixa"};

// cartelas que se repetem
const V36 = "53717 14824 71661 19247 59427 19239 71662 71663 71664 7658 59425 7906 71665 71666 71667 71668 71669 71670 71671 71672 71673 8864 71674 70024 71675 71676 8869 71677 71678 59442 101 71679 59414 4057 53679 301";
const I36 = "301 101 53717 14824 70013 4228 59414 70014 70015 70016 70017 19245 70018 59427 70019 7658 59425 7906 19239 19248 70020 70021 70022 70023 70024 70025 19254 19253 70026 70027 59442 11628 70028 8864 4057 53679";
const R2X1 = "49% ALGODAO + 49% POLIESTER + 2% ELASTANO";

// [código, nome, composição, g/m², largura m, rendimento m/kg, cores verão, cores inverno]
const ARTIGOS = [
  ["1017", "Hotoman", "96% POLIESTER + 4% ELASTANO", 305, 1.9, 1.73, "301 19239 59442 59414 53679 71661 101 4057", "301 4057 53679 59414 59442 19239 101"],
  ["1432", "Micro Soft – UV 50+", "89% POLIESTER + 11% ELASTANO", 320, 1.65, 1.89, "101 301 19239 4057", ""],
  ["2237", "Micro Touch Light NAECOCEL®", "92% VISCOSE + 8% ELASTANO", 235, 1.8, 2.36, V36, I36],
  ["2278", "Micro Touch NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 210, 1.8, 2.65, V36, I36],
  ["2421", "Micro Crepe NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 190, 1.8, 2.92, V36, I36],
  ["2423", "Visco Convencional NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 190, 1.8, 2.92, "101 301 4057 53717", ""],
  ["3255", "Classic NAECOCEL®", "66% VISCOSE + 28% POLIESTER + 6% ELASTANO", 280, 1.6, 2.23, "301 53717 59442 4057 71678 71670 71673 71661 71679 71663", "301 53717 70028 19254 59442 59414 53679 7906 4057 14824"],
  ["3673", "Cotton Suavity NAECOCOTTON® Pima Finish", "95% ALGODAO + 5% ELASTANO", 160, 1.85, 3.38, "301 101 4057 53679 53717 59442 71661", "7906 101 301 4057 53717 53679 59442"],
  ["3687", "Suedine Suavity NAECOCOTTON® Pima Finish", "100% ALGODAO", 235, 1.75, 2.43, "59427 101 301 4057 53717 71661 71672", "59442 101 4057 7906 53717 53679 301"],
  ["3781", "Visco Linen Thirty NAECOCEL", "89% VISCOSE + 7% LINHO + 4% ELASTANO", 180, 1.8, 3.09, "106", ""],
  ["4407", "Atoalhado Charm NAECOCEL®", "84% VISCOSE + 16% POLIESTER", 210, 1.8, 2.65, "71662 301 53717 71661 71669 71672 71676 71679", ""],
  ["4492", "Malha Divine NAECOCOTTON®", "58% ALGODAO + 42% POLIESTER", 325, 1.4, 2.2, "71661 301 71679 71678 53717 71663 71670 71673", "70013 301 70018 70028 59442 53717"],
  ["4632", "New Softness NAECOCEL®", "94% VISCOSE + 6% ELASTANO", 330, 1.6, 1.89, "301 53717 71679 71670 71673 71666 71661 71675", ""],
  ["4815", "Micro Touch Strong NAECOCEL®", "92% VISCOSE + 8% ELASTANO", 250, 1.65, 2.42, "4057 301 101 59442 53679 53717 7906 7658 71670 71679 71671 71673 71677 71663 71661", "4057 101 301 4228 7658 7906 8864 14824 19239 19245 19254 53679 53717 59414 59425 59442 70013 70018 70026 70028"],
  ["5080", "Roma MVS NAECOCEL®", "65% VISCOSE + 27% POLIESTER + 8% ELASTANO", 330, 1.6, 1.89, "301 53717 59442 4057 71678 71670 71673 71661 71679 71663", "301 53717 70028 19254 59442 4057 59414 53679 7906 14824"],
  ["5143", "Moletinho Forever NAECOCEL®", "97% VISCOSE + 3% ELASTANO", 270, 1.75, 2.12, "301 53717 71679 71670 71673 71663 71666 71661 71675", ""],
  ["5355", "Canelado Classic NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 245, 1.3, 3.14, "9300 53717 71679 71670 71673 71663 71666 8869 71661", "301 53717 4057 101 59442 59425 4228 70020 70018 70025 70028 70017 70026"],
  ["5437", "New Atoalhado NAECOCOTTON®", "85% ALGODAO + 15% POLIESTER", 240, 1.8, 2.31, "71669 101 301 4057 53717 71663 71673 71675 71679", ""],
  ["5803", "Canelado Bianca MVS NAECOCEL®", "97% VISCOSE + 3% ELASTANO", 235, 1.7, 2.5, "71673 7658 9300 53717 71661 71663 71666 71670 71675", "14824 301 53717 70018 70022 70026 70028"],
  ["5832", "Canelado Dallas NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 230, 1.4, 3.11, "9300 53717 71679 71670 71673 71663 71666 8869 71661", "301 53717 4057 101 59442 70020 70018 70025 70028 70017 70026 59425 4228"],
  ["6036", "Visco Tricot MVS NAECOCEL®", "98% VISCOSE + 2% ELASTANO", 210, 1.5, 3.17, "301 53717 71678 7658 71673 71666 71670 71663 71679 71661", "53717 7906 301 4057 70019 70025 70021 70028 70013 19239 59442 70018"],
  ["6375", "Visco Tricot Linen MVS NAECOCEL®", "90% VISCOSE + 8% LINHO + 2% ELASTANO", 220, 1.5, 3.03, "106", "106"],
  ["6605", "New Visco Kerala NAECOCEL®", "97% VISCOSE + 3% ELASTANO", 210, 1.6, 2.98, "71664 301 8869 53717 71661 71666 71670 71673 71675", ""],
  ["6891", "Canelado Georgia NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 390, 1.5, 1.71, "301 53717 71679 71670 59425 8864 71661 71678 71663 4057 101", "301 53717 70028 70025 70026 70017 59442 70018 14824 101 59425 4057 4228 70020"],
  ["6902", "Tweed Linen NAECOCOTTON®", "52% ALGODAO + 42% POLIESTER + 6% LINHO", 230, 1.6, 2.72, "106", ""],
  ["7009", "Visco Soft NAECOCEL® Plus", "96% VISCOSE + 4% ELASTANO", 210, 1.8, 2.65, V36, I36],
  ["7014", "Canelado Georgia Linen NAECOCEL®", "89% VISCOSE + 7% LINHO + 4% ELASTANO", 400, 1.5, 1.67, "106", "106"],
  ["7071", "Visco Soft NAECOCEL® Heavy", "92% VISCOSE + 8% ELASTANO", 235, 1.8, 2.36, V36, I36],
  ["7151", "New Tweed Colors NAECOCOTTON®", "50% POLIESTER + 50% ALGODAO", 265, 1.6, 2.36, "71669 301 53717 71661 71662 71673 71676 71679", ""],
  ["7528", "Canelado Madison NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 240, 1.5, 2.78, "71676 101 9300 53717 71661 71662 71665 71669 71672 71674", "9300 101 4228 8864 14824 19239 70018 70026"],
  ["7540", "Canelado Madison Linen NAECOCEL®", "91% VISCOSE + 5% LINHO + 4% ELASTANO", 220, 1.5, 3.03, "106", ""],
  ["7545", "Malha Princeton", "50% ALGODAO + 50% POLIESTER", 180, 1.65, 3.37, "71661 301 53717 71663 71666 71670 71673 71678 71679", ""],
  ["7639", "Malha Tricot Listrada NAECOCOTTON®", "78% ALGODAO + 21% POLIESTER + 1% ELASTANO", 250, 1.8, 2.22, "57800 2615 58167 57801 15432 58164", "4057 301 58582 57801"],
  ["7746", "Malha Trabalhada Padua", "50% ALGODAO + 50% POLIESTER", 185, 1.75, 3.09, "71670 301 53717 71661 71662 71673 71677 71679", ""],
  ["7783", "RIB 2X1 NAECOCOTTON® Pima Finish P/3673", "96% ALGODAO + 4% ELASTANO", 230, 0.56, 3.88, "301 101 4057 53679 53717 59442 71661", ""],
  ["7822", "Ribana Newport Listrada MVS NAECOCEL®", "67% VISCOSE + 30% POLIESTER + 3% ELASTANO", 360, 1.65, 1.68, "2611 2598 58167 57801 2613", ""],
  ["7832", "RIB 2X1 NAECO® Pima Finish P/3687", "96% ALGODAO + 4% ELASTANO", 205, 0.56, 4.36, "59427 101 301 4057 53717 71661 71672", ""],
  ["7879", "Malha Trabalhada Byron NAECOCOTTON®", "95% ALGODAO + 5% ELASTANO", 215, 1.8, 2.58, "71663 301 8864 53717 71661 71670 71677 71679", ""],
  ["7883", "Jacquard Provence Linen NAECOCEL®", "76% VISCOSE + 15% POLIESTER + 6% LINHO + 3% ELASTANO", 250, 1.4, 2.86, "15432 10331 58167 58164 58166", ""],
  ["7884", "Malha Rugby Listrada NAECOCOTTON® FT", "100% ALGODAO", 215, 1.6, 2.91, "56847 53130 56189 56850 53129", ""],
  ["7885", "Malha Trabalhada Adini", "50% ALGODAO + 50% POLIESTER", 200, 1.3, 3.85, "71662 301 53717 71661 71676 71672 71665", ""],
  ["7889", "Malha Trabalhada Le Portier", R2X1, 200, 1.7, 2.94, "71672 301 53717 71661 71662 71665 71679 71677", ""],
  ["7906", "Punho P/7884", "98% ALGODAO + 2% ELASTANO", 205, 1.1, 4.43, "106", ""],
  ["7908", "Malha Myrtos Linen NAECOCOTTON®", "62% ALGODAO + 34% POLIESTER + 2% LINHO + 2% ELASTANO", 250, 1.8, 2.22, "106", ""],
  ["7947", "Malha Myrtos Linen Colors NAECOCOTTON®", "62% ALGODAO + 34% POLIESTER + 2% LINHO + 2% ELASTANO", 260, 1.8, 2.14, "71661 71672 71665 71662 71676", ""],
  ["7952", "New Cotton BIO 30/1P NAECOCOTTON®", "92% ALGODAO + 8% ELASTANO", 200, 1.7, 2.94, "55244 101 4057 7658 59442 71661", ""],
  ["7965", "Jacquard Sierra", "93% POLIESTER + 7% ELASTANO", 350, 1.3, 2.2, "71661 301 53717 71663 71670 71673 71678 71679", ""],
  ["8053", "Modal NNTEC 200 NAECOCEL®", "91% MODAL + 9% ELASTANO", 200, 1.8, 2.78, "301 101 4057 53717 59427 71661 71672 71677", "4057 101 301 7906 53679 59414"],
  ["8059", "New Visco Tricot MVS NAECOCEL®", "98% VISCOSE + 2% ELASTANO", 250, 1.7, 2.35, "71670 301 7658 53717 71661 71663 71666 71673 71678 71679", ""],
  ["8132", "Malha Brindisi Listrada", "56% POLIESTER + 43% ALGODAO + 1% ELASTANO", 365, 1.85, 1.48, "58167 57800 10331 58164", ""],
  ["8201", "RIB 2X1 P/COD. 8337", "94% MODAL + 6% ELASTANO", 300, 1.15, 2.9, "55800 101 4057 19239 53679 53717 59414 59442 71661", ""],
  ["8213", "Jacquard Buzios NAECOCOTTON®", "70% POLIESTER + 30% ALGODAO", 200, 1.5, 3.33, "71670 301 53717 71661 71663 71673 71677 71679", ""],
  ["8291", "Visco Tricot Linen Azuri NAECOCEL®", "55% VISCOSE + 37% POLIESTER + 5% LINHO + 2% ELASTANO + 1% POLIAMIDA", 235, 1.45, 2.93, "18909 15432", ""],
  ["8307", "Canelado Lumar NAECOCOTTON®", "55% ALGODAO + 40% POLIESTER + 5% ELASTANO", 300, 1.9, 1.75, "53129 56189 56847 53130", ""],
  ["8309", "Malha Trabalhada Coralis NAECOCOTTON®", "46% POLIESTER + 46% ALGODAO + 8% ELASTANO", 185, 1.6, 3.38, "71673 301 53717 71662 71670 71675 71679", ""],
  ["8310", "Concept NAECOCOTTON®", "60% ALGODAO + 36% POLIAMIDA + 4% ELASTANO", 235, 1.55, 2.75, "71661 53717 55800 71663 71669 71673 71678 71679", ""],
  ["8311", "Visco Trabalhada Munique MVS NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 265, 1.7, 2.22, "71675 301 53717 71661 71663 71670 71673", ""],
  ["8317", "Jacquard Linen Oasis", "58% POLIESTER + 36% VISCOSE + 4% LINHO + 2% ELASTANO", 190, 1.6, 3.29, "58166 58167 58164 58165", ""],
  ["8321", "RIB 2X1 P/ 8218 e 8370", R2X1, 330, 1.35, 1.12, "106", ""],
  ["8324", "Atoalhado Verano NAECOCOTTON®", "82% ALGODAO + 18% POLIESTER", 290, 1.65, 2.09, "71669 301 53717 71663 71673 71675 71679", ""],
  ["8337", "Modal NNTEC 215 MVS NAECOCEL®", "95% MODAL + 5% ELASTANO", 215, 1.8, 2.58, "55800 101 4057 19239 53679 53717 59414 59442 71661", ""],
  ["8340", "Canelado Listrado Costeira NAECOCEL®", "47% VISCOSE + 46% POLIESTER + 7% ELASTANO", 310, 1.2, 2.69, "71661 71672 71676 71662", ""],
  ["8353", "Malha Trabalhada Lucca", "48% POLIESTER + 47% ALGODAO + 4% ELASTANO + 1% POLIAMIDA", 225, 1.6, 2.78, "74209 55800 74207 74203 53717", ""],
  ["8356", "Malha Trabalhada Mexico", "50% ALGODAO + 50% POLIESTER", 255, 1.55, 2.53, "71679 7658 19247 71673 71677 71661 301 53717 74204 74213 74210", ""],
  ["8360", "Jacquard Estelle", "95% POLIESTER + 5% ELASTANO", 260, 1.4, 2.75, "71678 301 7658 53717 71663 71673 71679", ""],
  ["8364", "Malha Trabalhada Toquio", "50% ALGODAO + 50% POLIESTER", 215, 1.6, 2.91, "74206 301 74215 74210 53717", ""],
  ["8365", "Visco Trabalhada Celina NAECOCEL®", "97% VISCOSE + 3% ELASTANO", 180, 1.8, 3.09, "71674 301 7658 53717 71661 71662 71665 71673 71675 71679", ""],
  ["8367", "Malha Trabalhada Kyoto", R2X1, 245, 1.45, 2.81, "74214 53717 74204 74210 301", ""],
  ["8369", "Malha Trabalhada Milano", R2X1, 210, 1.85, 2.57, "71676 301 19247 53717 71661 71672 71674 71679", ""],
  ["8370", "Malha Trabalhada Listrada Logan NAECOCOTTON®", "57% ALGODAO + 43% POLIESTER", 240, 1.7, 2.45, "53129 56847 19122 56850 53130 56848", ""],
  ["8374", "Malha Trabalhada Jasmine NAECOCEL®", "59% VISCOSE + 38% POLIESTER + 3% ELASTANO", 160, 1.8, 3.47, "53717 301 71662 71669 71672 71677 71679", ""],
  ["8378", "Tweed Florence NAECOCOTTON®", "59% ALGODAO + 41% POLIESTER", 200, 1.6, 3.13, "106", ""],
  ["8383", "Malha Trabalhada Leone", "50% ALGODAO + 50% POLIESTER", 155, 1.5, 4.3, "74211 301 74207 74209 53717", ""],
  ["8387", "Jacquard Amelia", "93% POLIESTER + 7% ELASTANO", 245, 1.4, 2.92, "71670 301 8864 53717 71663 71678 71679", ""],
  ["8391", "Jacquard Sena NAECOCEL®", "57% VISCOSE + 30% POLIESTER + 7% ELASTANO + 5% LINHO + 1% POLIAMIDA", 245, 1.5, 2.72, "3297 3296", ""],
  ["8399", "Malha Trabalhada Harlem", "48% ALGODAO + 48% POLIESTER + 4% ELASTANO", 225, 1.7, 2.61, "74211 53717 74206 74203 301", ""],
  ["8406", "Ribana 2X1 P/7746", R2X1, 330, 1.5, 2.02, "71670 301 53717 71679 71677 71662 71661 71673", ""],
  ["8407", "RIB 2X1 P/ COD. 7889", R2X1, 330, 1.5, 2.02, "71672 301 53717 71661 71662 71665 71679 71677", ""],
  ["8408", "RIB 2X1 P/ COD. 7879", "97% ALGODAO + 3% ELASTANO", 300, 1.4, 2.38, "71663 301 8864 53717 71661 71670 71677 71679", ""],
  ["8409", "Atoalhado Poa NAECOCOTTON®", "79% ALGODAO + 21% POLIESTER", 245, 1.65, 2.47, "71673 301 53717 71663 71669 71675 71679", ""],
  ["8413", "RIB 2X1 P/ COD. 7947", "49% ALGODAO + 43% POLIESTER + 5% LINHO + 3% ELASTANO", 285, 1.2, 2.92, "71661 71672 71665 71662 71676", ""],
  ["8414", "RIB 2X1 P/ 7908", "49% ALGODAO + 43% POLIESTER + 5% LINHO + 3% ELASTANO", 280, 1.2, 2.98, "106", ""],
  ["8428", "RIB 2X1 P/ COD. 8383", R2X1, 330, 1.5, 2.02, "74211 301 74207 74209 53717", ""],
  ["8429", "RIB 2X1 P/ COD. 8364", R2X1, 330, 1.5, 2.02, "74206 301 74215 74210 53717", ""],
  ["8430", "RIB 2X1 P/ COD. 8356", R2X1, 330, 1.5, 2.02, "71679 7658 19247 71673 71677 71661 301 53717 74204 74213 74210", ""],
  ["8431", "RIB 2X1 P/ COD. 8353", R2X1, 330, 1.5, 2.02, "74209 55800 74207 74203 53717", ""],
  ["8443", "Moletinho Infinite NAECOCEL®", "97% VISCOSE + 3% ELASTANO", 270, 1.8, 2.06, "71675 301 53717 71661 71663 71666 71670 71673 71679", ""],
  ["8444", "RIB 2X1 P/ COD. 8367", R2X1, 330, 1.5, 2.02, "74214 53717 74204 74210 301", ""],
  ["8445", "RIB 2X1 P/ COD. 8399", R2X1, 330, 1.5, 2.02, "74211 53717 74206 74203 301", ""],
  ["8455", "New Visco Crepe Gaze MVS NAECOCEL®", "96% VISCOSE + 4% ELASTANO", 150, 1.5, 4.44, "53717 301 71661 71663 71666 71670 71673 71679", ""],
];

const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
// artigo interno só onde o tipo é claro pela composição (viscose ou modal predominante); o resto fica em branco para o compras definir
const interno = (comp) => { const m = sa(comp).match(/^(\d+)% (\w+)/); if (!m || +m[1] < 55) return null; return m[2] === "VISCOSE" ? "VISCOSE" : m[2] === "MODAL" ? "MODAL" : null; };
const up = (s) => s.replace(/®/g, "").replace(/\s+/g, " ").trim().toUpperCase();

// lista final: [{ nome, codigo, composicao, gramatura, largura, rendimento, interno, cores: [[cor, colecoes]] }]
function montar() {
  return ARTIGOS.map(([cod, nome, comp, gram, larg, rend, v, i]) => {
    const map = new Map();
    for (const [lista, col] of [[v, "VERÃO 2027/2028"], [i, "INVERNO 2027"]])
      for (const c of lista.split(/\s+/).filter(Boolean)) { if (!CORES[c]) throw new Error(`cor sem nome: ${c}`); if (!map.has(c)) map.set(c, []); map.get(c).push(col); }
    return { codigo: cod, nome: `${cod} ${up(nome)}`, composicao: comp, gramatura: gram, largura: larg, rendimento: rend, interno: interno(comp),
      cores: [...map].map(([c, cols]) => [c === "106" ? "ÚNICA" : `${CORES[c].toUpperCase()} (${c})`, cols]) };
  });
}
export { ARTIGOS, montar };

async function main() {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return;
  let forn = (await prisma.fornecedor.findMany()).find((f) => [f.nome, f.nomeFantasia, f.razaoSocial].some((n) => /NANETE/.test(sa(n))));
  if (!forn) forn = await prisma.fornecedor.create({ data: { nome: "NANETE", nomeFantasia: "NANETE MALHAS", obs: "CADASTRADO PELA COLEÇÃO DO SITE NANETE.COM.BR (18/11/2026)" } });

  const existentes = await prisma.artigo.findMany({ where: { fornecedorId: forn.id, ativo: true }, select: { nome: true, cor: true, composicao: true } });
  const chave = (n, cor, comp) => [sa(n), sa(cor), sa(comp)].join("|");
  const ja = new Set(existentes.map((a) => chave(a.nome, a.cor, a.composicao)));
  let novos = 0, pulados = 0;
  for (const a of montar()) for (const [cor, cols] of a.cores) {
    if (ja.has(chave(a.nome, cor, a.composicao))) { pulados++; continue; }
    await prisma.artigo.create({ data: {
      categoria: "MALHA", fornecedorId: forn.id, codigoFornecedor: a.codigo, nome: a.nome, artigoInterno: a.interno, cor, composicao: a.composicao,
      gramatura: a.gramatura, largura: a.largura, rendimento: a.rendimento, unidade: "KG", especificacao: `COLEÇÃO ${cols.join(" E ")}`, origem: "CARTELA",
    } });
    ja.add(chave(a.nome, cor, a.composicao)); novos++;
  }
  await prisma.finConfig.create({ data: { chave: FLAG, valor: new Date().toISOString() } });
  console.log(`Seed coleção Nanete: ${novos} artigo(s) criado(s), ${pulados} já existia(m).`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((e) => console.log("Seed coleção Nanete: ignorado (" + (e?.message || e) + ")")).finally(() => prisma.$disconnect());
}
