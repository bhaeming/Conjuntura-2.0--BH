"use client";

import { useMemo, useState } from "react";
import type { EChartsOption, SeriesOption } from "echarts";
import type { Row } from "@/lib/data";
import { ChartCard } from "./ChartCard";

const palette = ["#087f5b", "#1677a8", "#2f9e44", "#339af0", "#0b7285", "#74b816", "#1864ab"];

function numeric(value: Row[string] | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatValue(value: number | null, suffix: string) {
  if (value == null || Number.isNaN(value)) return "n/d";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

function formatPp(value: number | null) {
  if (value == null || Number.isNaN(value)) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
}

function formatAbsPp(value: number | null) {
  if (value == null || Number.isNaN(value)) return "n/d";
  return `${Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
}

export function SeriesChart({
  rows,
  series,
  title,
  subtitle,
  type = "line",
  stacked = false,
  suffix = "",
  source,
  defaultSelected,
  insightPosition = "right",
}: {
  rows: Row[];
  series: Record<string, string>;
  title: string;
  subtitle: string;
  type?: "line" | "bar";
  stacked?: boolean;
  suffix?: string;
  source?: string;
  defaultSelected?: string[];
  insightPosition?: "left" | "right";
}) {
  const keys = Object.keys(series);
  const [selected, setSelected] = useState(defaultSelected?.length ? defaultSelected : keys);
  const [years, setYears] = useState("10");

  const visible = useMemo(() => {
    if (years === "all") return rows;
    const last = new Date(String(rows.at(-1)?.date ?? rows.at(-1)?.Date));
    const cutoff = new Date(last);
    cutoff.setFullYear(last.getFullYear() - Number(years));
    return rows.filter((row) => new Date(String(row.date ?? row.Date)) >= cutoff);
  }, [rows, years]);

  const option: EChartsOption = {
    color: palette,
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`,
    },
    legend: { bottom: 0, icon: "roundRect", textStyle: { color: "#52606d" } },
    grid: { left: 20, right: 22, top: 24, bottom: 58, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: type === "bar",
      data: visible.map((row) => String(row.date ?? row.Date ?? "")),
      axisLabel: { color: "#718096", hideOverlap: true, formatter: (value: string) => value.slice(0, 7) },
      axisLine: { lineStyle: { color: "#dbe4ea" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#718096" },
      splitLine: { lineStyle: { color: "#edf2f5" } },
    },
    dataZoom: [{ type: "inside" }],
    series: selected.map((key, index) => ({
      name: series[key],
      type,
      data: visible.map((row) => row[key]),
      smooth: type === "line",
      showSymbol: false,
      stack: stacked ? "total" : undefined,
      areaStyle: stacked ? { opacity: 0.18 } : undefined,
      lineStyle: { width: index === 0 ? 3 : 2 },
      emphasis: { focus: "series" },
    })) as SeriesOption[],
  };

  const highlights = useMemo(() => {
    const items = selected.map((key) => {
      const validRows = visible.filter((row) => numeric(row[key]) != null);
      const current = numeric(validRows.at(-1)?.[key]);
      const previous = numeric(validRows.at(-2)?.[key]);
      return {
        key,
        label: series[key],
        value: current,
        change: current != null && previous != null ? current - previous : null,
      };
    }).filter((item) => item.value != null);

    const highest = [...items].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))[0];
    const fastest = [...items].filter((item) => item.change != null).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
    const weakest = [...items].filter((item) => item.change != null).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
    return { highest, fastest, weakest };
  }, [selected, visible, series]);

  const context = `${title} ${subtitle}`.toLowerCase();
  const isActivity = context.includes("atividade economica") || context.includes("atividade econômica");
  const isPib = context.includes("pib e componentes");
  const isSector = context.includes("atividade por setor");
  const isSelic = context.includes("taxa basica") || context.includes("taxa básica");
  const isCreditStock = context.includes("estoque de credito") || context.includes("estoque de crédito");
  const isLabor = context.includes("mercado de trabalho");
  const isIncome = context.includes("rendimento");

  const selicComparison = useMemo(() => {
    if (!isSelic) return null;
    const key = selected[0];
    const validRows = visible.filter((row) => numeric(row[key]) != null);
    const latestRow = validRows.at(-1);
    const current = numeric(latestRow?.[key]);
    const previousDifferentRow = [...validRows].reverse().find((row) => numeric(row[key]) !== current);
    const previousDifferent = numeric(previousDifferentRow?.[key]);
    return {
      current,
      currentDate: String(latestRow?.date ?? latestRow?.Date ?? ""),
      previousDifferent,
      previousDate: String(previousDifferentRow?.date ?? previousDifferentRow?.Date ?? ""),
      change: current != null && previousDifferent != null ? current - previousDifferent : null,
    };
  }, [isSelic, selected, visible]);

  const insightTitle = isPib
    ? "Composição do crescimento"
    : isActivity || isSector
      ? "Ritmo da atividade"
      : isSelic || isCreditStock
        ? "Condições financeiras"
        : isLabor || isIncome
          ? "Emprego, renda e demanda"
          : "Leitura econômica";

  const firstInsight = isPib
    ? `A leitura dos componentes mostra onde a demanda agregada ganha ou perde tração. Entre as séries selecionadas, ${highlights.highest?.label ?? "n/d"} apresenta a maior leitura recente (${formatValue(highlights.highest?.value ?? null, suffix)}), sinalizando o vetor que mais sustenta o crescimento no recorte atual. Quando consumo, governo e investimento caminham em direções diferentes, o PIB pode crescer com composição menos robusta, dependente de poucos motores.`
    : isActivity
      ? `O indicador de atividade deve ser lido como termômetro de curto prazo do ciclo. A maior leitura recente entre as séries selecionadas é ${highlights.highest?.label ?? "n/d"} (${formatValue(highlights.highest?.value ?? null, suffix)}), o que ajuda a distinguir nível de atividade e momentum. Em ambiente de juros altos, avanços persistentes no IBC-Br tendem a depender de renda, serviços e setores menos sensíveis ao crédito.`
      : isSector
        ? `A comparação setorial mostra se a economia cresce de forma disseminada ou concentrada. A maior leitura recente está em ${highlights.highest?.label ?? "n/d"} (${formatValue(highlights.highest?.value ?? null, suffix)}). Indústria, comércio e serviços reagem de modo diferente a juros, renda e crédito: serviços costumam ter maior inércia, enquanto comércio e indústria sentem mais rapidamente a restrição financeira.`
        : isSelic
          ? `A Selic organiza o custo de oportunidade da economia e afeta crédito, câmbio, inflação e decisões de investimento. A leitura recente está em ${formatValue(selicComparison?.current ?? null, suffix)}, ainda em patamar restritivo, mas ${selicComparison?.change != null && selicComparison.change < 0 ? `com redução de ${formatAbsPp(selicComparison.change)} em relação à reunião anterior` : "sem novo alívio em relação à última mudança da taxa"}.`
          : isCreditStock
            ? `O estoque de crédito mostra a capacidade do sistema financeiro de sustentar consumo e investimento. A maior leitura recente está em ${highlights.highest?.label ?? "n/d"} (${formatValue(highlights.highest?.value ?? null, suffix)}). Expansão do crédito ajuda a suavizar a desaceleração da demanda, mas, com juros elevados, aumenta a importância de monitorar inadimplência e seletividade dos bancos.`
            : isLabor
              ? `O mercado de trabalho é o principal canal de sustentação do consumo. A maior leitura recente entre as séries selecionadas é ${highlights.highest?.label ?? "n/d"} (${formatValue(highlights.highest?.value ?? null, suffix)}). A leitura econômica depende da combinação: queda do desemprego com avanço da ocupação e da renda reforça demanda; alta da informalidade torna a melhora mais frágil.`
              : isIncome
                ? `A renda real é decisiva para avaliar a capacidade de consumo sem aumento excessivo de endividamento. A leitura recente de ${formatValue(highlights.highest?.value ?? null, suffix)} indica o poder de compra médio do trabalho; quando cresce junto com ocupação, tende a sustentar serviços e consumo corrente mesmo sob juros altos.`
                : `A leitura recente coloca ${highlights.highest?.label ?? "n/d"} como a série de maior nível entre as opções selecionadas, com ${formatValue(highlights.highest?.value ?? null, suffix)}. Esse dado deve ser lido como indicação do ponto de maior pressão, ritmo ou volume dentro do recorte escolhido.`;

  const secondInsight = isPib
    ? `A maior alta recente aparece em ${highlights.fastest?.label ?? "n/d"} (${formatValue(highlights.fastest?.change ?? null, suffix)}), enquanto ${highlights.weakest?.label ?? "n/d"} mostra a menor mudança (${formatValue(highlights.weakest?.change ?? null, suffix)}). Essa abertura é importante porque um PIB apoiado em consumo público ou agropecuária tem implicações diferentes de um PIB puxado por investimento, serviços privados e consumo das famílias.`
    : isActivity || isSector
      ? `A variação mais forte no período aparece em ${highlights.fastest?.label ?? "n/d"} (${formatValue(highlights.fastest?.change ?? null, suffix)}), enquanto ${highlights.weakest?.label ?? "n/d"} mostra a menor mudança (${formatValue(highlights.weakest?.change ?? null, suffix)}). A dispersão entre setores ajuda a avaliar se a retomada é ampla ou se depende de segmentos específicos, como commodities, serviços ou estímulos temporários de demanda.`
      : isSelic
        ? `Essa queda ajuda a aliviar gradualmente as condições financeiras, mas não muda de imediato o diagnóstico: juros reais elevados continuam pesando sobre consumo financiado, capital de giro, investimento e renegociação de dívidas. A transmissão ao crédito é defasada, por isso o efeito sobre atividade depende da continuidade do ciclo de cortes e da reação da inflação.`
        : isCreditStock
        ? `A mudança mais forte no período aparece em ${highlights.fastest?.label ?? "n/d"} (${formatValue(highlights.fastest?.change ?? null, suffix)}). Em conjuntura, nível e direção importam conjuntamente: juros altos em queda ainda restringem atividade, enquanto crédito em expansão pode conviver com maior risco se inadimplência e comprometimento de renda estiverem elevados.`
        : isLabor || isIncome
          ? `A maior mudança recente está em ${highlights.fastest?.label ?? "n/d"} (${formatValue(highlights.fastest?.change ?? null, suffix)}), enquanto ${highlights.weakest?.label ?? "n/d"} mostra a menor variação (${formatValue(highlights.weakest?.change ?? null, suffix)}). O diagnóstico melhora quando ocupação, renda e formalização avançam ao mesmo tempo; piora quando a geração de postos depende de vínculos mais precários.`
          : `A variação mais forte no período recente aparece em ${highlights.fastest?.label ?? "n/d"} (${formatValue(highlights.fastest?.change ?? null, suffix)}), enquanto ${highlights.weakest?.label ?? "n/d"} mostra a menor mudança (${formatValue(highlights.weakest?.change ?? null, suffix)}). Essa comparação separa nível e direção, dois elementos centrais para leitura de conjuntura.`;

  const insight = (
    <article className="insight-card chart-side-insight">
      <h2>{insightTitle}</h2>
      <p>{firstInsight}</p>
      <p>{secondInsight}</p>
      {isSelic ? (
        <div className="highlight-boxes">
          <div><span>Selic atual</span><strong>{formatValue(selicComparison?.current ?? null, suffix)}</strong><small>{selicComparison?.currentDate.slice(0, 7) || "n/d"}</small></div>
          <div><span>Reunião anterior</span><strong>{formatValue(selicComparison?.previousDifferent ?? null, suffix)}</strong><small>{selicComparison?.previousDate.slice(0, 7) || "n/d"}</small></div>
          <div><span>Variação da decisão</span><strong>{formatPp(selicComparison?.change ?? null)}</strong><small>desde a última mudança</small></div>
        </div>
      ) : (
        <div className="highlight-boxes">
          <div><span>Maior leitura</span><strong>{highlights.highest?.label ?? "n/d"}</strong><small>{formatValue(highlights.highest?.value ?? null, suffix)}</small></div>
          <div><span>Maior alta recente</span><strong>{highlights.fastest?.label ?? "n/d"}</strong><small>{formatValue(highlights.fastest?.change ?? null, suffix)}</small></div>
          <div><span>Menor variação recente</span><strong>{highlights.weakest?.label ?? "n/d"}</strong><small>{formatValue(highlights.weakest?.change ?? null, suffix)}</small></div>
        </div>
      )}
    </article>
  );

  return (
    <div>
      <div className="chart-controls">
        <div className="chips">
          {keys.map((key) => (
            <button key={key} className={selected.includes(key) ? "chip active" : "chip"} onClick={() => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}>
              {series[key]}
            </button>
          ))}
        </div>
        <select value={years} onChange={(event) => setYears(event.target.value)} aria-label="Período">
          <option value="5">5 anos</option><option value="10">10 anos</option><option value="15">15 anos</option><option value="all">Todo período</option>
        </select>
      </div>
      <ChartCard title={title} subtitle={subtitle} option={option} tall source={source} insight={insight} insightPosition={insightPosition} />
    </div>
  );
}
