"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { Row } from "@/lib/data";
import { ChartCard } from "./ChartCard";

const ufSeries: Record<string, string> = {
  ibc_am: "AM",
  ibc_pa: "PA",
  ibc_ce: "CE",
  ibc_pe: "PE",
  ibc_ba: "BA",
  ibc_es: "ES",
  ibc_mg: "MG",
  ibc_rj: "RJ",
  ibc_sp: "SP",
  ibc_pr: "PR",
  ibc_sc: "SC",
  ibc_rs: "RS",
  ibc_go: "GO",
};

function numeric(value: Row[string] | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pctChange(current: number | null, base: number | null) {
  if (current == null || base == null || base === 0) return null;
  return (current / base - 1) * 100;
}

function average(items: Array<number | null>) {
  const valid = items.filter((item): item is number => item != null);
  if (!valid.length) return null;
  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
}

function formatPct(value: number | null) {
  if (value == null || Number.isNaN(value)) return "n/d";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatMonth(date: string | null) {
  if (!date) return "n/d";
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}

export function UfRadarChart({ rows }: { rows: Row[] }) {
  const tableData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    return Object.entries(ufSeries)
      .map(([key, label]) => {
        const saKey = `${key}_dessaz`;
        const validRows = sorted.filter((row) => numeric(row[key]) != null);
        const validSaRows = sorted.filter((row) => numeric(row[saKey]) != null);
        const lastIndex = validRows.length - 1;
        const lastSaIndex = validSaRows.length - 1;
        const current = lastIndex >= 0 ? numeric(validRows[lastIndex][key]) : null;
        const currentSa = lastSaIndex >= 0 ? numeric(validSaRows[lastSaIndex][saKey]) : null;
        const monthBase = lastSaIndex >= 1 ? numeric(validSaRows[lastSaIndex - 1][saKey]) : null;
        const threeBase = lastIndex >= 3 ? numeric(validRows[lastIndex - 3][key]) : null;
        const currentWindow = validRows.slice(lastIndex - 11, lastIndex + 1).map((row) => numeric(row[key]));
        const previousWindow = validRows.slice(lastIndex - 23, lastIndex - 11).map((row) => numeric(row[key]));

        return {
          label,
          date: String(validRows[lastIndex]?.date ?? ""),
          mes: pctChange(currentSa, monthBase),
          tresMeses: pctChange(current, threeBase),
          dozeMeses: pctChange(average(currentWindow), average(previousWindow)),
        };
      })
      .filter((item) => item.dozeMeses != null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const radarData = tableData
    .filter((item): item is { label: string; date: string; mes: number | null; tresMeses: number | null; dozeMeses: number } => item.dozeMeses != null)
    .map((item) => ({ label: item.label, growth: item.dozeMeses }));

  const maxAbs = Math.max(5, ...radarData.map((item) => Math.abs(item.growth)));
  const axisLimit = Math.ceil(maxAbs + 1);
  const highestUf = [...tableData].filter((row) => row.dozeMeses != null).sort((a, b) => (b.dozeMeses ?? -Infinity) - (a.dozeMeses ?? -Infinity))[0];
  const lowestUf = [...tableData].filter((row) => row.dozeMeses != null).sort((a, b) => (a.dozeMeses ?? Infinity) - (b.dozeMeses ?? Infinity))[0];
  const averageGrowth = radarData.length ? radarData.reduce((sum, row) => sum + row.growth, 0) / radarData.length : null;
  const latestDate = tableData[0]?.date ?? null;

  const radarInsight = (
    <article className="insight-card chart-side-insight">
      <h2>Difusao regional da atividade</h2>
      <p>
        O radar compara o crescimento regional do IBC nas UFs acompanhadas pela serie original acumulada em 12 meses, na ultima observacao disponivel ({formatMonth(latestDate)}). O maior avanco aparece em
        <strong> {highestUf?.label ?? "n/d"}</strong> ({formatPct(highestUf?.dozeMeses ?? null)}), enquanto a menor leitura esta em
        <strong> {lowestUf?.label ?? "n/d"}</strong> ({formatPct(lowestUf?.dozeMeses ?? null)}). A media do grupo esta em {formatPct(averageGrowth)}.
      </p>
      <p>
        Em uma analise de conjuntura, a dispersao regional mostra onde a atividade tem tracao e onde ainda ha fragilidade relativa. A variacao mensal dessazonalizada fica restrita a tabela como sinal de margem; o radar privilegia a tendencia regional em 12 meses.
      </p>
    </article>
  );

  const option: EChartsOption = {
    color: ["#087f5b"],
    tooltip: {
      trigger: "item",
      valueFormatter: (value) => `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
    },
    radar: {
      radius: "68%",
      indicator: radarData.map((item) => ({ name: item.label, min: -axisLimit, max: axisLimit })),
      splitNumber: 4,
      axisName: { color: "#52606d", fontWeight: 700 },
      splitLine: { lineStyle: { color: "#dfe8ec" } },
      splitArea: { areaStyle: { color: ["#f8fbfa", "#eef7f4"] } },
      axisLine: { lineStyle: { color: "#dfe8ec" } },
    },
    series: [{
      name: "Crescimento em 12 meses",
      type: "radar",
      data: [{
        value: radarData.map((item) => Number(item.growth.toFixed(2))),
        name: "UFs",
        areaStyle: { color: "rgba(8, 127, 91, 0.18)" },
        lineStyle: { width: 3 },
        symbolSize: 5,
      }],
    }],
  };

  return (
    <section className="chart-table-grid">
      <ChartCard
        title="Crescimento regional do IBC"
        subtitle={`Variacao acumulada em 12 meses da serie original, ultima observacao: ${formatMonth(latestDate)}`}
        option={option}
        source="BCB (2026)"
        insight={radarInsight}
        tall
      />
      <article className="table-card">
        <div className="table-card-header">
          <div>
            <h2>IBC por UF</h2>
            <p>12 meses e 3 meses usam a serie original; mes usa a serie dessazonalizada.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>UF</th><th>Mes dessaz.</th><th>3 meses</th><th>12 meses</th></tr></thead>
            <tbody>
              {[...tableData].sort((a, b) => (b.dozeMeses ?? -999) - (a.dozeMeses ?? -999)).map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatPct(row.mes)}</td>
                  <td>{formatPct(row.tresMeses)}</td>
                  <td>{formatPct(row.dozeMeses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="source-label">Fonte: BCB (2026)</small>
      </article>
    </section>
  );
}
