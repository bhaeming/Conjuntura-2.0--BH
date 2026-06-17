"use client";

import { useMemo, useState } from "react";
import type { EChartsOption, SeriesOption } from "echarts";
import type { Row } from "@/lib/data";
import { ChartCard } from "./ChartCard";
import { KpiCard } from "./KpiCard";

const palette = ["#087f5b", "#1677a8"];

const regions = [
  { key: "ibc_se", label: "Sudeste" },
  { key: "ibc_mg", label: "Minas Gerais" },
  { key: "ibc_rj", label: "Rio de Janeiro" },
  { key: "ibc_es", label: "Espirito Santo" },
  { key: "ibc_sp", label: "Sao Paulo" },
  { key: "ibc_co", label: "Centro-Oeste" },
  { key: "ibc_go", label: "Goias" },
  { key: "ibc_sul", label: "Sul" },
  { key: "ibc_sc", label: "Santa Catarina" },
  { key: "ibc_pr", label: "Parana" },
  { key: "ibc_rs", label: "Rio Grande do Sul" },
  { key: "ibc_norte", label: "Norte" },
  { key: "ibc_pa", label: "Para" },
  { key: "ibc_am", label: "Amazonas" },
  { key: "ibc_ne", label: "Nordeste" },
  { key: "ibc_ce", label: "Ceara" },
  { key: "ibc_ba", label: "Bahia" },
  { key: "ibc_pe", label: "Pernambuco" },
];

function value(row: Row | undefined, key: string) {
  const item = row?.[key];
  return typeof item === "number" && Number.isFinite(item) ? item : null;
}

function dateKey(row: Row) {
  return String(row.date ?? row.Date ?? "");
}

function formatPercent(item: number | null) {
  if (item == null || Number.isNaN(item)) return "n/d";
  return `${item.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatMonth(date: string) {
  if (!date) return "n/d";
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}

function average(items: Array<number | null>) {
  const valid = items.filter((item): item is number => item != null);
  if (!valid.length) return null;
  return valid.reduce((total, item) => total + item, 0) / valid.length;
}

function variation(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return (current / previous - 1) * 100;
}

function enrich(rows: Row[], rawKey: string, saKey: string) {
  return rows.map((row, index) => {
    const currentWindow = rows.slice(index - 11, index + 1).map((item) => value(item, rawKey));
    const previousWindow = rows.slice(index - 23, index - 11).map((item) => value(item, rawKey));
    const currentDate = new Date(dateKey(row));
    const month = currentDate.getUTCMonth();
    const year = currentDate.getUTCFullYear();
    const yearRows = rows.filter((item) => {
      const itemDate = new Date(dateKey(item));
      return itemDate.getUTCFullYear() === year && itemDate.getUTCMonth() <= month;
    });
    const previousYearRows = rows.filter((item) => {
      const itemDate = new Date(dateKey(item));
      return itemDate.getUTCFullYear() === year - 1 && itemDate.getUTCMonth() <= month;
    });
    const sa = value(row, saKey);
    const prevSa = value(rows[index - 1], saKey);

    return {
      date: dateKey(row),
      raw: value(row, rawKey),
      sa,
      twelveMonth: variation(average(currentWindow), average(previousWindow)),
      ytd: variation(average(yearRows.map((item) => value(item, rawKey))), average(previousYearRows.map((item) => value(item, rawKey)))),
      saMonth: variation(sa, prevSa),
    };
  });
}

export function IbcActivityPanel({ nationalRows, regionalRows }: { nationalRows: Row[]; regionalRows: Row[] }) {
  const [mode, setMode] = useState<"national" | "regional">("national");
  const [region, setRegion] = useState("ibc_mg");
  const [metric, setMetric] = useState<"twelveMonth" | "saMonth">("twelveMonth");
  const [years, setYears] = useState("10");

  const selectedRegion = regions.find((item) => item.key === region) ?? regions[1];
  const rawKey = mode === "national" ? "ibc_br" : selectedRegion.key;
  const saKey = mode === "national" ? "ibc_br_dessaz" : `${selectedRegion.key}_dessaz`;
  const label = mode === "national" ? "IBC-Br" : `IBCR ${selectedRegion.label}`;
  const dataRows = useMemo(() => enrich(mode === "national" ? nationalRows : regionalRows, rawKey, saKey), [mode, nationalRows, rawKey, regionalRows, saKey]);

  const visible = useMemo(() => {
    if (years === "all") return dataRows;
    const last = new Date(dataRows.at(-1)?.date ?? "");
    const cutoff = new Date(last);
    cutoff.setFullYear(last.getFullYear() - Number(years));
    return dataRows.filter((row) => new Date(row.date) >= cutoff);
  }, [dataRows, years]);

  const latest = [...dataRows].reverse().find((row) => row.twelveMonth != null || row.ytd != null || row.saMonth != null);
  const option: EChartsOption = {
    color: palette,
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      valueFormatter: (item) => formatPercent(Number(item)),
    },
    legend: { bottom: 0, icon: "roundRect", textStyle: { color: "#52606d" } },
    grid: { left: 20, right: 22, top: 24, bottom: 58, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: visible.map((row) => row.date),
      axisLabel: { color: "#718096", hideOverlap: true, formatter: (item: string) => item.slice(0, 7) },
      axisLine: { lineStyle: { color: "#dbe4ea" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#718096", formatter: (item: number) => `${item.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` },
      splitLine: { lineStyle: { color: "#edf2f5" } },
    },
    dataZoom: [{ type: "inside" }],
    series: [
      {
        name: metric === "twelveMonth" ? `${label} em 12 meses` : `${label} mensal dessazonalizado`,
        type: "line",
        data: visible.map((row) => row[metric]),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3 },
        emphasis: { focus: "series" },
      },
    ] as SeriesOption[],
  };

  const title = mode === "national" ? "IBC-Br: atividade economica nacional" : "IBCR: atividade economica regional";
  const subtitle = mode === "national"
    ? "Variacao em 12 meses e leitura mensal dessazonalizada do indicador nacional do Banco Central"
    : `Variacao em 12 meses e leitura mensal dessazonalizada para ${selectedRegion.label}`;
  const currentDate = latest?.date ?? "";

  const insight = (
    <article className="insight-card chart-side-insight">
      <h2>{mode === "national" ? "Leitura do IBC-Br" : "Leitura do IBCR"}</h2>
      <p>
        {mode === "national"
          ? "O IBC-Br em 12 meses resume melhor a tendencia da atividade porque reduz o ruido mensal e aproxima o diagnostico do ciclo. Quando essa medida avanca, a economia tende a mostrar sustentacao mais ampla; quando perde tracao, a leitura sugere menor impulso de demanda, credito e producao."
          : `O IBCR em 12 meses permite separar o ciclo nacional da dinamica regional. Em ${selectedRegion.label}, a leitura ajuda a identificar se a atividade local acompanha o IBC-Br ou depende de motores especificos, como agropecuaria, industria, servicos, comercio ou investimento publico.`}
      </p>
      <p>
        A variacao mensal dessazonalizada deve ser tratada como sinal de curto prazo: ela antecipa viradas, mas pode oscilar com calendario, choques setoriais e revisoes. O acumulado no ano complementa a analise ao mostrar se o resultado recente esta se convertendo em crescimento efetivo no periodo corrente.
      </p>
      <div className="highlight-boxes">
        <div><span>Foco principal</span><strong>{formatPercent(latest?.twelveMonth ?? null)}</strong><small>acumulado em 12 meses</small></div>
        <div><span>Acumulado no ano</span><strong>{formatPercent(latest?.ytd ?? null)}</strong><small>{formatMonth(currentDate)}</small></div>
        <div><span>Mensal dessazonalizado</span><strong>{formatPercent(latest?.saMonth ?? null)}</strong><small>sinal de margem</small></div>
      </div>
    </article>
  );

  return (
    <section className="ibc-panel">
      <div className="kpi-grid three">
        <KpiCard label={`${label} 12 meses`} value={formatPercent(latest?.twelveMonth ?? null)} reference={formatMonth(currentDate)} source="BCB (2026)" />
        <KpiCard label={`${label} no ano`} value={formatPercent(latest?.ytd ?? null)} reference={formatMonth(currentDate)} source="BCB (2026)" />
        <KpiCard label={`${label} mensal dessaz.`} value={formatPercent(latest?.saMonth ?? null)} reference={formatMonth(currentDate)} source="BCB (2026)" />
      </div>
      <div className="chart-controls ibc-controls">
        <div className="mode-switch" aria-label="Indicador">
          <button className={mode === "national" ? "active" : ""} onClick={() => setMode("national")}>IBC-Br</button>
          <button className={mode === "regional" ? "active" : ""} onClick={() => setMode("regional")}>IBCR</button>
        </div>
        <div className="chips">
          <button className={metric === "twelveMonth" ? "chip active" : "chip"} onClick={() => setMetric("twelveMonth")}>12 meses</button>
          <button className={metric === "saMonth" ? "chip active" : "chip"} onClick={() => setMetric("saMonth")}>Mensal dessazonalizado</button>
        </div>
        {mode === "regional" && (
          <select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Estado ou regiao do IBCR">
            {regions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        )}
        <select value={years} onChange={(event) => setYears(event.target.value)} aria-label="Periodo">
          <option value="5">5 anos</option>
          <option value="10">10 anos</option>
          <option value="15">15 anos</option>
          <option value="all">Todo periodo</option>
        </select>
      </div>
      <ChartCard title={title} subtitle={subtitle} option={option} tall source="BCB (2026)" insight={insight} />
    </section>
  );
}
