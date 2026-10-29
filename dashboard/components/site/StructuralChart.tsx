"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { ArrowDown, ArrowUp, CircleHelp, Maximize2 } from "lucide-react";
import { ChartCard, toggleFullscreen } from "@/components/ChartCard";
import { chartInk, chartPalette } from "@/lib/palette";
import { InView } from "./InView";

// Passos narrativos do eixo "Desafios estruturantes": pergunta à esquerda, visualização à direita.
// Os valores abaixo são ILUSTRATIVOS (ordem de grandeza plausível), servem apenas para testar
// formato e narrativa e devem ser substituídos por séries oficiais antes de qualquer publicação.

const [green, blue, lightGreen, petrol, , , slate] = chartPalette;

const axisLabel = { color: chartInk.axis };
const axisLine = { lineStyle: { color: chartInk.axisLine } };
const splitLine = { lineStyle: { color: chartInk.grid } };
const legend = { bottom: 0, icon: "roundRect", textStyle: { color: chartInk.legend } };
const grid = { left: 16, right: 28, top: 28, bottom: 56, containLabel: true };
const fmt = (value: unknown, digits = 1) => Number(value).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const years = (start: number, end: number, step = 1) => Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => String(start + i * step));
const pad = (length: number) => Array<number | null>(length).fill(null);
const faded = 0.22;

const productivity: Record<string, number[]> = {
  Brasil: [38, 33, 30, 28, 27, 29, 28, 26, 25, 25],
  "Coreia do Sul": [22, 28, 36, 44, 50, 55, 60, 63, 65, 66],
  Chile: [33, 30, 36, 42, 44, 45, 46, 45, 44, 44],
  México: [52, 47, 43, 41, 38, 36, 34, 32, 31, 30],
};

const investmentRate = [18.3, 18.4, 17.4, 16.6, 17.3, 17.1, 17.2, 18.0, 19.4, 19.1, 20.5, 20.6, 20.7, 20.9, 19.9, 17.8, 15.5, 14.6, 15.1, 15.3, 16.6, 19.0, 17.8, 16.5, 17.0, 17.2];

const countriesInvestment: [string, number][] = (
  [["China", 41], ["Índia", 31], ["Indonésia", 29], ["Coreia do Sul", 30], ["México", 24], ["Chile", 23], ["Colômbia", 18], ["Brasil", 17]] as [string, number][]
).sort((a, b) => a[1] - b[1]);

const schooling: [string, number, number][] = [
  ["Brasil", 8.1, 38], ["México", 9.2, 45], ["Chile", 10.9, 58], ["Argentina", 11.1, 47], ["Colômbia", 8.9, 32], ["Turquia", 8.6, 72],
  ["Portugal", 9.6, 70], ["Espanha", 10.6, 95], ["Polônia", 12.6, 78], ["Coreia do Sul", 12.5, 85], ["Alemanha", 14.1, 115], ["EUA", 13.6, 140],
];

const basicLevel: Record<string, { brasil: number; ocde: number }> = {
  matematica: { brasil: 27, ocde: 69 },
  leitura: { brasil: 50, ocde: 74 },
  ciencias: { brasil: 45, ocde: 76 },
};

const debtYears = years(2006, 2035);
const debtObserved = [55.5, 56.7, 56.0, 59.2, 51.8, 51.3, 53.7, 51.5, 56.3, 65.5, 69.8, 73.7, 75.3, 74.4, 86.9, 77.3, 71.7, 73.8, 76.5, 78.5];
const debtGrowth = 0.02;

// Dinâmica da dívida: d(t+1) = d(t)·(1+r)/(1+g) − primário.
function simulateDebt(primary: number, realRate: number) {
  const path = [debtObserved.at(-1)!];
  for (let year = 0; year < 10; year += 1) path.push(path.at(-1)! * (1 + realRate) / (1 + debtGrowth) - primary);
  return path.map((value) => Number(value.toFixed(1)));
}

const factorYears = years(2019, 2025);
const factors: Record<string, number[]> = {
  "Juros nominais": [5.0, 4.2, 4.6, 6.0, 6.5, 7.2, 7.8],
  "Resultado primário": [0.8, 9.4, -0.7, -1.3, 2.3, 0.4, 0.3],
  "Crescimento do PIB nominal": [-4.5, -2.0, -12.0, -8.0, -5.0, -4.9, -5.6],
  "Outros fatores": [-1.4, 0.0, 0.0, -0.4, -1.7, 0.0, -0.5],
};
const factorTotal = factorYears.map((_, i) => Number(Object.values(factors).reduce((sum, list) => sum + list[i], 0).toFixed(1)));

type State = Record<string, string>;
type Control = { key: string; label: string; initial: string; options: { value: string; label: string }[] };
type Visual =
  | { kind: "chart"; option: (state: State) => EChartsOption }
  | { kind: "waffle"; data: (state: State) => { label: string; value: number; color: string }[] };

type StepSpec = {
  title: string;
  subtitle: string;
  height: number;
  question: [string, string, string];
  paragraphs: string[];
  howTo: string;
  sources: string[];
  controls?: Control[];
  stats?: (state: State) => { label: string; value: string }[];
  visual: Visual;
};

const countryOptions = (names: string[]) => names.map((name) => ({ value: name, label: name }));

const steps = {
  "produtividade-relativa": {
    title: "Produtividade do trabalho relativa à fronteira",
    subtitle: "PIB por trabalhador em relação aos EUA (EUA = 100), anos selecionados",
    height: 420,
    question: ["O Brasil está se aproximando da ", "fronteira", "?"],
    paragraphs: [
      "Cada linha mostra quanto um trabalhador de cada país produz em comparação a um trabalhador norte-americano. Economias que partiram de patamares parecidos com o brasileiro seguiram caminhos muito diferentes.",
      "Escolha um país para destacar sua trajetória e compará-la com a do Brasil.",
    ],
    howTo: "Valores acima de 50 indicam que o trabalhador do país produz mais da metade do que produz um trabalhador nos EUA. Linhas ascendentes indicam convergência; descendentes, afastamento da fronteira.",
    sources: ["Penn World Table", "Conference Board TED", "IBGE – Contas Nacionais"],
    controls: [{ key: "pais", label: "País em destaque", initial: "Coreia do Sul", options: countryOptions(Object.keys(productivity).filter((name) => name !== "Brasil")) }],
    visual: {
      kind: "chart",
      option: ({ pais }) => ({
        color: [blue, green, lightGreen, petrol],
        tooltip: { trigger: "axis", valueFormatter: (v) => fmt(v, 0) },
        legend,
        grid: { ...grid, right: 92 },
        xAxis: { type: "category", boundaryGap: false, data: years(1980, 2025, 5), axisLabel, axisLine },
        yAxis: { type: "value", min: 0, axisLabel, splitLine },
        series: Object.entries(productivity).map(([name, data]) => {
          const active = name === "Brasil" || name === pais;
          return {
            name,
            data,
            type: "line" as const,
            smooth: true,
            showSymbol: false,
            lineStyle: { width: active ? 3 : 2, opacity: active ? 1 : faded },
            endLabel: { show: true, formatter: "{a}", color: chartInk.legend, fontSize: 11, opacity: active ? 1 : 0.45 },
            emphasis: { focus: "series" as const },
          };
        }),
      }),
    },
  },
  "produtividade-decomposicao": {
    title: "Fontes do crescimento por década",
    subtitle: "Crescimento médio do PIB (% a.a.) decomposto em emprego e produtividade",
    height: 400,
    question: ["O crescimento veio de mais gente trabalhando ou de cada um ", "produzir mais", "?"],
    paragraphs: [
      "Com o fim do bônus demográfico, o emprego deixa de ser motor e o crescimento passa a depender quase exclusivamente da produtividade.",
      "A decomposição por década mostra que, desde os anos 1980, a contribuição da produtividade foi pequena ou negativa.",
    ],
    howTo: "A altura total de cada coluna é o crescimento médio do PIB na década. A parte verde vem da expansão do emprego; a azul, do aumento da produção por trabalhador. Valores abaixo de zero indicam perda de produtividade.",
    sources: ["IBGE – Contas Nacionais e PNAD", "FGV IBRE – Observatório da Produtividade"],
    visual: {
      kind: "chart",
      option: () => ({
        color: [green, blue],
        tooltip: { trigger: "axis", valueFormatter: (v) => `${fmt(v)} p.p.` },
        legend,
        grid,
        xAxis: { type: "category", data: ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"], axisLabel, axisLine },
        yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
        series: [
          { name: "Emprego", data: [3.2, 2.9, 1.8, 2.1, 0.9, 1.0] },
          { name: "Produtividade", data: [5.3, -1.2, 0.9, 1.6, -0.6, 0.8] },
        ].map((serie) => ({ ...serie, type: "bar" as const, stack: "total", barWidth: "46%", itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 3 } })),
      }),
    },
  },
  "investimento-taxa": {
    title: "Taxa de investimento",
    subtitle: "Formação bruta de capital fixo em % do PIB",
    height: 400,
    question: ["Quanto o país precisa ", "investir", " para crescer de forma sustentada?"],
    paragraphs: [
      "A taxa de investimento brasileira oscila em torno de 17% a 18% do PIB, abaixo do patamar observado em emergentes que cresceram de forma acelerada.",
      "Troque a linha de referência para medir a distância até cada meta.",
    ],
    howTo: "A área mostra a parcela do PIB destinada a máquinas, equipamentos, construção e inovação. A linha tracejada é a meta de referência escolhida; a distância vertical é o esforço adicional necessário.",
    sources: ["IBGE – Contas Nacionais Trimestrais", "Ipea – Indicador de FBCF", "Tesouro – investimento público"],
    controls: [{
      key: "ref",
      label: "Referência",
      initial: "25",
      options: [
        { value: "25", label: "Emergentes de alto crescimento (25%)" },
        { value: "22", label: "Média mundial (22%)" },
        { value: "20.9", label: "Pico brasileiro recente (20,9%)" },
      ],
    }],
    stats: ({ ref }) => [
      { label: "Último dado", value: `${fmt(investmentRate.at(-1))}% do PIB` },
      { label: "Distância da referência", value: `${fmt(Number(ref) - investmentRate.at(-1)!)} p.p.` },
    ],
    visual: {
      kind: "chart",
      option: ({ ref }) => ({
        color: [green],
        tooltip: { trigger: "axis", valueFormatter: (v) => `${fmt(v)}% do PIB` },
        grid: { ...grid, bottom: 28 },
        xAxis: { type: "category", boundaryGap: false, data: years(2000, 2025), axisLabel: { ...axisLabel, hideOverlap: true }, axisLine },
        yAxis: { type: "value", min: 10, max: 28, axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
        series: [{
          name: "FBCF / PIB",
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#007a5533" }, { offset: 1, color: "#007a5505" }] } },
          data: investmentRate,
          markLine: {
            symbol: "none",
            lineStyle: { color: blue, type: "dashed", width: 1.5 },
            label: { formatter: `Referência: ${fmt(Number(ref))}%`, color: blue, position: "insideEndTop" },
            data: [{ yAxis: Number(ref) }],
          },
        }],
      }),
    },
  },
  "investimento-comparacao": {
    title: "Investimento em perspectiva internacional",
    subtitle: "FBCF em % do PIB, média recente",
    height: 400,
    question: ["Onde o Brasil se posiciona entre os ", "emergentes", "?"],
    paragraphs: [
      "Entre as principais economias emergentes, o Brasil aparece na parte de baixo do ranking de investimento.",
      "Selecione um país para destacá-lo e compará-lo com o Brasil.",
    ],
    howTo: "Cada barra é a taxa média de investimento do país nos últimos anos. O Brasil aparece sempre em azul; o país selecionado, em verde-escuro.",
    sources: ["Banco Mundial – WDI", "FMI – World Economic Outlook"],
    controls: [{ key: "pais", label: "Comparar com", initial: "México", options: countryOptions(countriesInvestment.map(([name]) => name).filter((name) => name !== "Brasil").reverse()) }],
    visual: {
      kind: "chart",
      option: ({ pais }) => ({
        tooltip: { trigger: "item", formatter: (p) => { const item = p as unknown as { name: string; value: number }; return `${item.name}: <strong>${fmt(item.value, 0)}% do PIB</strong>`; } },
        grid: { ...grid, bottom: 16, right: 48 },
        xAxis: { type: "value", axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
        yAxis: { type: "category", data: countriesInvestment.map(([name]) => name), axisLabel: { ...axisLabel, fontWeight: 600 }, axisLine },
        series: [{
          type: "bar",
          barWidth: "58%",
          data: countriesInvestment.map(([name, value]) => ({
            value,
            itemStyle: { color: name === "Brasil" ? blue : name === pais ? green : "#c9ddd5", borderRadius: [0, 4, 4, 0] },
          })),
          label: { show: true, position: "right", color: chartInk.legend, formatter: "{c}%" },
        }],
      }),
    },
  },
  "educacao-escolaridade": {
    title: "Escolaridade e produtividade",
    subtitle: "Anos médios de estudo da população adulta × PIB por trabalhador (US$ mil PPC)",
    height: 420,
    question: ["Mais anos de estudo se traduziram em mais ", "produtividade", "?"],
    paragraphs: [
      "Quantidade de escolaridade não basta: países com anos de estudo semelhantes têm produtividades muito distintas.",
      "Destaque um país para comparar sua posição com a do Brasil.",
    ],
    howTo: "Cada ponto é um país. Quanto mais à direita, mais anos médios de estudo; quanto mais alto, maior a produção por trabalhador. Pontos acima da nuvem extraem mais produtividade de cada ano de estudo.",
    sources: ["Barro-Lee / UNESCO", "Penn World Table", "PNAD Contínua – Educação"],
    controls: [{ key: "pais", label: "País em destaque", initial: "Turquia", options: countryOptions(schooling.map(([name]) => name).filter((name) => name !== "Brasil")) }],
    visual: {
      kind: "chart",
      option: ({ pais }) => ({
        tooltip: { trigger: "item", formatter: (p) => { const item = p as unknown as { value: [number, number, string] }; return `${item.value[2]}<br/>Anos de estudo: <strong>${fmt(item.value[0])}</strong><br/>PIB por trabalhador: <strong>US$ ${fmt(item.value[1], 0)} mil</strong>`; } },
        grid: { ...grid, bottom: 40 },
        xAxis: { type: "value", name: "Anos médios de estudo", nameLocation: "middle", nameGap: 28, nameTextStyle: { color: chartInk.axis }, min: 7, max: 15, axisLabel, splitLine },
        yAxis: { type: "value", axisLabel, splitLine },
        series: [{
          type: "scatter",
          data: schooling.map(([name, x, y]) => {
            const highlighted = name === "Brasil" || name === pais;
            return {
              value: [x, y, name],
              symbolSize: highlighted ? 16 : 11,
              itemStyle: { color: name === "Brasil" ? blue : name === pais ? green : "#9cc5b4", borderColor: "#fff", borderWidth: 2 },
              label: { fontWeight: highlighted ? ("bold" as const) : ("normal" as const), color: highlighted ? chartInk.strong : chartInk.axis },
            };
          }),
          label: { show: true, position: "right", formatter: (p) => String((p.value as [number, number, string])[2]), fontSize: 10 },
          labelLayout: { hideOverlap: true },
        }],
      }),
    },
  },
  "educacao-aprendizagem": {
    title: "Aprendizagem: Brasil e média da OCDE",
    subtitle: "Proficiência média no PISA por área (pontos)",
    height: 380,
    question: ["Qual é o tamanho da ", "lacuna de aprendizagem", "?"],
    paragraphs: [
      "Em todas as áreas avaliadas, o estudante brasileiro de 15 anos fica cerca de 70 a 90 pontos abaixo da média da OCDE.",
      "Na escala do PISA, cerca de 30 pontos equivalem a um ano de escolaridade: a lacuna é de dois a três anos de aprendizado.",
    ],
    howTo: "As barras comparam a nota média do Brasil com a média dos países da OCDE em cada área. O eixo começa em 300 pontos para tornar a diferença legível.",
    sources: ["OCDE – PISA", "INEP – SAEB e IDEB"],
    visual: {
      kind: "chart",
      option: () => ({
        color: [blue, green],
        tooltip: { trigger: "axis", valueFormatter: (v) => `${fmt(v, 0)} pontos` },
        legend,
        grid,
        xAxis: { type: "category", data: ["Matemática", "Leitura", "Ciências"], axisLabel, axisLine },
        yAxis: { type: "value", min: 300, axisLabel, splitLine },
        series: [
          { name: "Brasil", data: [379, 410, 403] },
          { name: "Média OCDE", data: [472, 476, 485] },
        ].map((serie) => ({ ...serie, type: "bar" as const, barGap: "12%", barWidth: "26%", itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, position: "top" as const, color: chartInk.legend, fontSize: 11 } })),
      }),
    },
  },
  "educacao-basico": {
    title: "Quem alcança o nível básico",
    subtitle: "Estudantes de 15 anos com proficiência ao menos no nível 2 do PISA, em cada 100",
    height: 360,
    question: ["De cada 100 jovens, quantos alcançam o ", "nível básico", "?"],
    paragraphs: [
      "O nível 2 do PISA é o mínimo para usar o conhecimento em situações simples do dia a dia.",
      "Cada quadrado representa um estudante. Troque a área para ver como a proporção muda.",
    ],
    howTo: "Quadrados preenchidos são estudantes que alcançam ao menos o nível básico; quadrados vazados, os que ficam abaixo dele.",
    sources: ["OCDE – PISA (níveis de proficiência)", "INEP – SAEB"],
    controls: [{
      key: "area",
      label: "Área",
      initial: "matematica",
      options: [{ value: "matematica", label: "Matemática" }, { value: "leitura", label: "Leitura" }, { value: "ciencias", label: "Ciências" }],
    }],
    visual: {
      kind: "waffle",
      data: ({ area }) => [
        { label: "Brasil", value: basicLevel[area].brasil, color: blue },
        { label: "Média OCDE", value: basicLevel[area].ocde, color: green },
      ],
    },
  },
  "divida-trajetoria": {
    title: "Trajetória da dívida pública",
    subtitle: "Dívida bruta do governo geral em % do PIB: observado e simulação",
    height: 420,
    question: ["Qual esforço fiscal ", "estabiliza a dívida", "?"],
    paragraphs: [
      "A trajetória da dívida depende de três alavancas: o resultado primário, os juros reais e o crescimento da economia.",
      "Escolha o nível de ambição fiscal e o patamar de juros para simular a dívida nos próximos dez anos (crescimento real fixo em 2% a.a.).",
    ],
    howTo: "A linha contínua é o histórico. A tracejada é a simulação pela regra d(t+1) = d(t)·(1+r)/(1+g) − primário. Se o primário escolhido supera o primário que estabiliza, a dívida cai.",
    sources: ["BCB – Estatísticas fiscais", "Tesouro Nacional – Projeções", "IFI/Senado – cenários"],
    controls: [
      {
        key: "primario",
        label: "Nível de ambição fiscal (primário, % do PIB)",
        initial: "1",
        options: [
          { value: "-0.5", label: "Déficit de 0,5%" },
          { value: "0", label: "Equilíbrio (0%)" },
          { value: "1", label: "Superávit de 1%" },
          { value: "2", label: "Superávit de 2%" },
          { value: "3", label: "Superávit de 3%" },
        ],
      },
      {
        key: "juros",
        label: "Juros reais implícitos",
        initial: "0.055",
        options: [{ value: "0.07", label: "7% a.a." }, { value: "0.055", label: "5,5% a.a." }, { value: "0.04", label: "4% a.a." }],
      },
    ],
    stats: ({ primario, juros }) => {
      const path = simulateDebt(Number(primario), Number(juros));
      const stabilizing = debtObserved.at(-1)! * (Number(juros) - debtGrowth) / (1 + debtGrowth);
      return [
        { label: "Dívida em 2035", value: `${fmt(path.at(-1))}% do PIB` },
        { label: "Primário que estabiliza", value: `${fmt(stabilizing)}% do PIB` },
      ];
    },
    visual: {
      kind: "chart",
      option: ({ primario, juros }) => ({
        color: [green, blue],
        tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : `${fmt(v)}% do PIB`) },
        legend,
        grid,
        xAxis: { type: "category", boundaryGap: false, data: debtYears, axisLabel: { ...axisLabel, hideOverlap: true }, axisLine },
        yAxis: { type: "value", min: 40, axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
        series: [
          { name: "Observado", type: "line", smooth: true, showSymbol: false, lineStyle: { width: 3 }, data: [...debtObserved, ...pad(10)] },
          { name: "Simulação", type: "line", smooth: true, showSymbol: false, lineStyle: { width: 2, type: "dashed" }, data: [...pad(19), ...simulateDebt(Number(primario), Number(juros))] },
        ],
      }),
    },
  },
  "divida-fatores": {
    title: "O que move a dívida",
    subtitle: "Contribuição para a variação anual da dívida bruta (p.p. do PIB)",
    height: 420,
    question: ["Juros, déficit ou crescimento: ", "o que pesa mais", "?"],
    paragraphs: [
      "Forças acima de zero aumentam a dívida; abaixo de zero, reduzem. A linha resume o efeito líquido de cada ano.",
      "Destaque um fator para isolar sua contribuição ao longo do tempo.",
    ],
    howTo: "Cada coluna empilha as contribuições do ano. Juros nominais costumam ser a maior força de alta; o crescimento do PIB nominal, a principal força de queda.",
    sources: ["BCB – Fatores condicionantes da DBGG", "Tesouro Nacional – RMD"],
    controls: [{
      key: "fator",
      label: "Fator em destaque",
      initial: "todos",
      options: [{ value: "todos", label: "Todos os fatores" }, ...Object.keys(factors).map((name) => ({ value: name, label: name }))],
    }],
    visual: {
      kind: "chart",
      option: ({ fator }) => ({
        color: [green, blue, lightGreen, slate, petrol],
        tooltip: { trigger: "axis", valueFormatter: (v) => `${fmt(v)} p.p.` },
        legend: { ...legend, data: [...Object.keys(factors), "Variação total"] },
        grid,
        xAxis: { type: "category", data: factorYears, axisLabel, axisLine },
        yAxis: { type: "value", axisLabel, splitLine },
        series: [
          ...Object.entries(factors).map(([name, data]) => ({
            name,
            data,
            type: "bar" as const,
            stack: "fatores",
            barWidth: "52%",
            itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 3, opacity: fator === "todos" || fator === name ? 1 : faded },
          })),
          { name: "Variação total", type: "line" as const, data: factorTotal, symbolSize: 8, lineStyle: { width: 2, color: chartInk.strong }, itemStyle: { color: chartInk.strong } },
        ],
      }),
    },
  },
} satisfies Record<string, StepSpec>;

export type StructuralChartKey = keyof typeof steps;

const order = Object.keys(steps) as StructuralChartKey[];
const questionText = (key: StructuralChartKey) => (steps[key] as StepSpec).question.join("");

type WaffleVisual = Extract<Visual, { kind: "waffle" }>;

function Waffle({ spec, visual, state }: { spec: StepSpec; visual: WaffleVisual; state: State }) {
  const card = useRef<HTMLElement>(null);
  return (
    <section ref={card} className="chart-card waffle-card">
      <div className="chart-title">
        <div><span className="chart-badge">Provisório · dados ilustrativos</span><h2>{spec.title}</h2><p>{spec.subtitle}</p></div>
        <div className="chart-tools">
          <button type="button" onClick={() => toggleFullscreen(card.current)} title="Tela cheia" aria-label={`Tela cheia: ${spec.title}`}><Maximize2 size={15} /></button>
        </div>
      </div>
      <div className="waffle-grid">
        {visual.data(state).map((group) => (
          <figure key={group.label} className="waffle" aria-label={`${group.label}: ${group.value} de cada 100`}>
            <figcaption><strong>{group.value}</strong><span>de cada 100 · {group.label}</span></figcaption>
            <div className="waffle-cells" aria-hidden="true" style={{ "--cell": group.color } as React.CSSProperties}>
              {Array.from({ length: 100 }, (_, index) => <span key={index} className={index < group.value ? "on" : ""} />)}
            </div>
          </figure>
        ))}
      </div>
      <div className="waffle-legend">
        <span><i className="on" /> Alcança o nível básico</span>
        <span><i /> Abaixo do nível básico</span>
      </div>
    </section>
  );
}

export function StructuralChart({ chart }: { chart: StructuralChartKey }) {
  const spec: StepSpec = steps[chart];
  const [state, setState] = useState<State>(() => Object.fromEntries((spec.controls ?? []).map((control) => [control.key, control.initial])));
  // Sem animação: os gráficos já surgem ao entrar na tela e, com a animação ligada, vários passos
  // montados ao mesmo tempo ficavam presos no quadro inicial. Os controles atualizam o desenho na hora.
  const option = useMemo(() => (spec.visual.kind === "chart" ? { ...spec.visual.option(state), animation: false } : null), [spec, state]);

  const index = order.indexOf(chart);
  const previous = index > 0 ? { id: order[index - 1], label: questionText(order[index - 1]) } : { id: "introducao", label: "Por que olhar para o longo prazo?" };
  const next = index < order.length - 1 ? { id: order[index + 1], label: questionText(order[index + 1]) } : { id: "agenda", label: "Quais materiais vêm a seguir?" };
  const [before, highlight, after] = spec.question;

  let visual: ReactNode;
  if (spec.visual.kind === "waffle") {
    visual = <Waffle spec={spec} visual={spec.visual} state={state} />;
  } else {
    visual = (
      <ChartCard
        title={spec.title}
        subtitle={spec.subtitle}
        option={option!}
        badge="Provisório · dados ilustrativos"
        source="Valores ilustrativos para prototipação; não usar como dado oficial"
      />
    );
  }

  return (
    <div className="story-step">
      <article className="step-narrative">
        <a href={`#${previous.id}`} className="step-link up"><span>{previous.label}</span><ArrowUp size={13} /></a>
        <h3>{before}<em>{highlight}</em>{after}</h3>
        {spec.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {spec.controls?.map((control) => (
          <label key={control.key} className="step-control">
            <span>{control.label}</span>
            <select value={state[control.key]} onChange={(event) => setState((current) => ({ ...current, [control.key]: event.target.value }))}>
              {control.options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        ))}
        {spec.stats && (
          <dl className="step-stats">
            {spec.stats(state).map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
          </dl>
        )}
        <details className="step-howto">
          <summary><CircleHelp size={14} /> Como ler este gráfico?</summary>
          <p>{spec.howTo}</p>
        </details>
        <div className="draft-sources">
          <span>Fontes candidatas</span>
          <ul>{spec.sources.map((source) => <li key={source}>{source}</li>)}</ul>
        </div>
        <a href={`#${next.id}`} className="step-link down"><span>{next.label}</span><ArrowDown size={13} /></a>
      </article>
      <div className="step-visual">
        <InView minHeight={spec.height + 80}>{visual}</InView>
      </div>
    </div>
  );
}
