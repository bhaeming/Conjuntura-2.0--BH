"use client";

import { useMemo } from "react";
import type { EChartsOption, SeriesOption } from "echarts";
import type { Row } from "@/lib/data";
import { ChartCard } from "./ChartCard";

type TooltipItem = {
  axisValue?: string | number;
  marker?: string;
  seriesName?: string;
  value?: unknown;
};

function numeric(value: Row[string] | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fmt(value: number | null) {
  if (value == null) return "n/d";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function ProjectionChart({ rows, source }: { rows: Row[]; source: string }) {
  const visible = useMemo(() => rows.slice(-48), [rows]);
  const firstProjectionIndex = visible.findIndex((row) => row.tipo === "projecao");
  const projectionStartIndex = firstProjectionIndex > 0 ? firstProjectionIndex - 1 : firstProjectionIndex;
  const targetProjection =
    rows.find((row) => row.tipo === "projecao" && String(row.date) === "2026-12-31") ??
    [...rows].reverse().find((row) => row.tipo === "projecao");
  const projected = numeric(targetProjection?.consumo_projecao);
  const pessimistic = numeric(targetProjection?.consumo_cenario_pessimista);
  const optimistic = numeric(targetProjection?.consumo_cenario_otimista);
  const latestObserved = [...rows].reverse().find((row) => row.tipo === "observado");
  const latestIpca = numeric(latestObserved?.ipca_12m);
  const latestCredit = numeric(latestObserved?.credito_pf_12m);

  const projectionValue = (row: Row, index: number) => {
    if (index === projectionStartIndex) return numeric(row.consumo_observado);
    return row.tipo === "projecao" ? numeric(row.consumo_projecao) : null;
  };

  const scenarioValue = (row: Row, index: number, key: "consumo_cenario_pessimista" | "consumo_cenario_otimista") => {
    if (index === projectionStartIndex) return numeric(row.consumo_observado);
    return row.tipo === "projecao" ? numeric(row[key]) : null;
  };

  const bandBase = (row: Row, index: number, key: "consumo_cenario_pessimista" | "consumo_projecao") => {
    if (index === projectionStartIndex) return numeric(row.consumo_observado);
    return row.tipo === "projecao" ? numeric(row[key]) : null;
  };

  const bandDistance = (
    row: Row,
    index: number,
    lowerKey: "consumo_cenario_pessimista" | "consumo_projecao",
    upperKey: "consumo_projecao" | "consumo_cenario_otimista",
  ) => {
    if (index === projectionStartIndex) return 0;
    const lower = numeric(row[lowerKey]);
    const upper = numeric(row[upperKey]);
    return lower == null || upper == null ? null : upper - lower;
  };

  const option: EChartsOption = {
    color: ["#087f5b", "#1677a8", "#83c5be", "#83c5be"],
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const items = (Array.isArray(params) ? params : [params]) as TooltipItem[];
        const validItems = items.filter((item) => typeof item.value === "number" && Number.isFinite(item.value));
        const date = String(items[0]?.axisValue ?? "");
        if (!validItems.length) return date;
        return [
          date,
          ...validItems.map((item) => `${item.marker ?? ""} ${item.seriesName}: <strong>${fmt(item.value as number)}</strong>`),
        ].join("<br/>");
      },
    },
    legend: {
      bottom: 0,
      icon: "roundRect",
      data: ["Observado", "Projeção central", "Cenário pessimista", "Cenário otimista"],
      textStyle: { color: "#52606d" },
    },
    grid: { left: 20, right: 22, top: 24, bottom: 58, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: visible.map((row) => String(row.date ?? "")),
      axisLabel: { color: "#718096", hideOverlap: true, formatter: (value: string) => value.slice(0, 7) },
      axisLine: { lineStyle: { color: "#dbe4ea" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#718096", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#edf2f5" } },
    },
    dataZoom: [{ type: "inside" }],
    series: [
      {
        name: "Observado",
        type: "line",
        data: visible.map((row) => numeric(row.consumo_observado)),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3 },
      },
      {
        name: "Projeção central",
        type: "line",
        data: visible.map((row, index) => projectionValue(row, index)),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, type: "dashed" },
      },
      {
        name: "Base pessimismo",
        type: "line",
        stack: "pessimistic-band",
        data: visible.map((row, index) => bandBase(row, index, "consumo_cenario_pessimista")),
        smooth: true,
        showSymbol: false,
        silent: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        name: "Faixa pessimista",
        type: "line",
        stack: "pessimistic-band",
        data: visible.map((row, index) => bandDistance(row, index, "consumo_cenario_pessimista", "consumo_projecao")),
        smooth: true,
        showSymbol: false,
        silent: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        areaStyle: { color: "rgba(22, 119, 168, 0.12)" },
        tooltip: { show: false },
      },
      {
        name: "Base otimismo",
        type: "line",
        stack: "optimistic-band",
        data: visible.map((row, index) => bandBase(row, index, "consumo_projecao")),
        smooth: true,
        showSymbol: false,
        silent: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        name: "Faixa otimista",
        type: "line",
        stack: "optimistic-band",
        data: visible.map((row, index) => bandDistance(row, index, "consumo_projecao", "consumo_cenario_otimista")),
        smooth: true,
        showSymbol: false,
        silent: true,
        lineStyle: { opacity: 0 },
        itemStyle: { opacity: 0 },
        areaStyle: { color: "rgba(22, 119, 168, 0.12)" },
        tooltip: { show: false },
      },
      {
        name: "Cenário pessimista",
        type: "line",
        data: visible.map((row, index) => scenarioValue(row, index, "consumo_cenario_pessimista")),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, type: "dotted" },
      },
      {
        name: "Cenário otimista",
        type: "line",
        data: visible.map((row, index) => scenarioValue(row, index, "consumo_cenario_otimista")),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, type: "dotted" },
      },
    ] as SeriesOption[],
  };

  const insight = (
    <article className="insight-card chart-side-insight">
      <span className="eyebrow">Cenário prospectivo</span>
      <h2>Consumo das famílias</h2>
      <p>
        O consumo das famílias perdeu fôlego de forma clara desde o fim de 2024. No acumulado em quatro trimestres,
        a taxa saiu de 5,1% em 2024T4 para 1,2% em 2026T1, movimento coerente com uma economia ainda sustentada por
        renda e mercado de trabalho, mas limitada pelo encarecimento do crédito e pela recomposição mais lenta do poder
        de compra.
      </p>
      <p>
        A trajetória central sugere encerramento de 2026 perto de {fmt(projected)}, com assimetria relevante entre
        sustentação de renda e freios financeiros. O ano eleitoral pode reforçar transferências, reajustes e impulso
        fiscal sobre a demanda, mas juros ao consumidor ainda acima de 60%, inflação em 12 meses próxima de {fmt(latestIpca)}
        e um ambiente externo incerto limitam uma recuperação mais vigorosa. A expansão do crédito PF, em torno de
        {fmt(latestCredit)}, ajuda a sustentar o gasto corrente, mas também amplia a sensibilidade das famílias ao serviço
        da dívida e à inadimplência.
      </p>
      <div className="highlight-boxes">
        <div><span>Encerramento de 2026</span><strong>{fmt(projected)}</strong><small>Projeção central</small></div>
        <div><span>Cenário otimista</span><strong>{fmt(optimistic)}</strong><small>Faixa superior</small></div>
        <div><span>Cenário pessimista</span><strong>{fmt(pessimistic)}</strong><small>Faixa inferior</small></div>
      </div>
    </article>
  );

  return (
    <ChartCard
      title="Projeção do consumo das famílias"
      subtitle="Acumulado em quatro trimestres, com faixa de incerteza para o período projetado"
      option={option}
      tall
      source={source}
      insight={insight}
      insightPosition="right"
    />
  );
}
