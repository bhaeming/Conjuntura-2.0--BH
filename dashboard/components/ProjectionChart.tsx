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
  const latestProjection = [...rows].reverse().find((row) => row.tipo === "projecao");
  const firstProjection = rows.find((row) => row.tipo === "projecao");
  const method = String(firstProjection?.metodo ?? "VAR");
  const projected = numeric(latestProjection?.consumo_projecao);
  const low = numeric(latestProjection?.consumo_cenario_baixo);
  const high = numeric(latestProjection?.consumo_cenario_alto);

  const option: EChartsOption = {
    color: ["#087f5b", "#1677a8", "#b6ddd1", "#b6ddd1"],
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
    legend: { bottom: 0, icon: "roundRect", textStyle: { color: "#52606d" } },
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
        data: visible.map((row) => numeric(row.consumo_projecao)),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, type: "dashed" },
      },
      {
        name: "Cenário baixo",
        type: "line",
        data: visible.map((row) => numeric(row.consumo_cenario_baixo)),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, type: "dotted" },
      },
      {
        name: "Cenário alto",
        type: "line",
        data: visible.map((row) => numeric(row.consumo_cenario_alto)),
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
        A projeção é produzida no notebook econométrico dedicado, a partir dos dados já consolidados pelo pipeline:
        PIB trimestral, IPCA em 12 meses, despesa do governo, juros de crédito PF e expansão do crédito PF.
      </p>
      <p>
        O modelo estimado é um {method}. A leitura deve ser interpretada como trajetória condicional, não como previsão
        pontual fechada. O intervalo explicita a incerteza em torno da projeção central.
      </p>
      <div className="highlight-boxes">
        <div><span>Última projeção</span><strong>{fmt(projected)}</strong><small>Consumo das famílias</small></div>
        <div><span>Cenário baixo</span><strong>{fmt(low)}</strong><small>Faixa inferior</small></div>
        <div><span>Cenário alto</span><strong>{fmt(high)}</strong><small>Faixa superior</small></div>
      </div>
    </article>
  );

  return (
    <ChartCard
      title="Projeção do consumo das famílias"
      subtitle="Série observada e trajetória projetada para os próximos trimestres"
      option={option}
      tall
      source={source}
      insight={insight}
      insightPosition="right"
    />
  );
}
