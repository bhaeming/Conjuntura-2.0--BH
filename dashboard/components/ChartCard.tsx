"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export function ChartCard({
  title,
  subtitle,
  option,
  tall = false,
  source,
  insight,
  insightPosition = "right",
}: {
  title: string;
  subtitle: string;
  option: EChartsOption;
  tall?: boolean;
  source?: string;
  insight?: ReactNode;
  insightPosition?: "left" | "right";
}) {
  const chart = (
    <section className="chart-card">
      <div className="chart-title">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        {source && <span className="source-info" title={`Fonte: ${source}`} aria-label={`Fonte: ${source}`}>i</span>}
      </div>
      <ReactECharts option={option} style={{ height: tall ? 440 : 350 }} notMerge lazyUpdate />
    </section>
  );

  if (insight) {
    return <section className={`chart-with-insight ${insightPosition === "left" ? "insight-left" : ""}`}>{chart}{insight}</section>;
  }

  return chart;
}
