"use client";

import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";
import type { ECharts, EChartsOption } from "echarts";
import { Download, Maximize2 } from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const slug = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function toggleFullscreen(element: HTMLElement | null) {
  if (document.fullscreenElement) document.exitFullscreen();
  else element?.requestFullscreen?.();
}

export function ChartCard({
  title,
  subtitle,
  option,
  tall = false,
  source,
  insight,
  insightPosition = "right",
  badge,
}: {
  title: string;
  subtitle: string;
  option: EChartsOption;
  tall?: boolean;
  source?: string;
  insight?: ReactNode;
  insightPosition?: "left" | "right";
  badge?: string;
}) {
  const card = useRef<HTMLElement>(null);
  const instance = useRef<ECharts | null>(null);

  function download() {
    const url = instance.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(title)}.png`;
    link.click();
  }

  const chart = (
    <section ref={card} className={`chart-card chart-card-responsive ${tall ? "is-tall" : ""}`}>
      <div className="chart-title">
        <div>{badge && <span className="chart-badge">{badge}</span>}<h2>{title}</h2><p>{subtitle}</p></div>
        <div className="chart-tools">
          <button type="button" onClick={download} title="Baixar imagem (PNG)" aria-label={`Baixar imagem: ${title}`}><Download size={15} /></button>
          <button type="button" onClick={() => toggleFullscreen(card.current)} title="Tela cheia" aria-label={`Tela cheia: ${title}`}><Maximize2 size={15} /></button>
          {source && <span className="source-info" title={`Fonte: ${source}`} aria-label={`Fonte: ${source}`}>i</span>}
        </div>
      </div>
      <ReactECharts
        className="chart-canvas"
        option={option}
        style={{ height: "100%", minHeight: tall ? 420 : 340, flex: "1 1 auto" }}
        onChartReady={(chartInstance: ECharts) => { instance.current = chartInstance; }}
        notMerge
        lazyUpdate
      />
    </section>
  );

  if (insight) {
    return <section className={`chart-with-insight ${insightPosition === "left" ? "insight-left" : ""}`}>{chart}{insight}</section>;
  }

  return chart;
}
