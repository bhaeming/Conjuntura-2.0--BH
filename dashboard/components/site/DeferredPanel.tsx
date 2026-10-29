"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { Row } from "@/lib/data";
import { InView } from "./InView";

// Cada painel traz o próprio código só quando é montado.
const BrazilUnemploymentMap = dynamic(() => import("@/components/BrazilUnemploymentMap").then((m) => m.BrazilUnemploymentMap));
const CreditConditionsPanel = dynamic(() => import("@/components/CreditConditionsPanel").then((m) => m.CreditConditionsPanel));
const IbcActivityPanel = dynamic(() => import("@/components/IbcActivityPanel").then((m) => m.IbcActivityPanel));
const InflationDashboard = dynamic(() => import("@/components/InflationDashboard").then((m) => m.InflationDashboard));
const IppDashboard = dynamic(() => import("@/components/IppDashboard").then((m) => m.IppDashboard));
const ProjectionChart = dynamic(() => import("@/components/ProjectionChart").then((m) => m.ProjectionChart));
const SeriesChart = dynamic(() => import("@/components/SeriesChart").then((m) => m.SeriesChart));
const UfRadarChart = dynamic(() => import("@/components/UfRadarChart").then((m) => m.UfRadarChart));

type Panel = {
  datasets: string[];
  height: number;
  render: (data: Row[][]) => ReactNode;
};

const panels = {
  "atividade-ibc": {
    datasets: ["sgs_dados", "ibc_uf"],
    height: 760,
    render: ([sgs, ibcUf]) => <IbcActivityPanel nationalRows={sgs} regionalRows={ibcUf} />,
  },
  "atividade-pib": {
    datasets: ["pib_componentes_quarterly"],
    height: 560,
    render: ([rows]) => (
      <SeriesChart
        rows={rows}
        series={{
          pib_precos_mercado: "PIB",
          consumo_familias: "Consumo das famílias",
          despesa_governo: "Despesa do governo",
          fbcf: "FBCF",
          agropecuaria: "Agropecuária",
          industria: "Indústria",
          servicos: "Serviços",
        }}
        defaultSelected={["pib_precos_mercado", "consumo_familias", "despesa_governo"]}
        title="PIB e componentes"
        subtitle="Acumulado em quatro trimestres por componente selecionado"
        suffix="%"
        source="IBGE (2026)"
        insightPosition="left"
      />
    ),
  },
  "atividade-uf": {
    datasets: ["ibc_uf"],
    height: 520,
    render: ([rows]) => <UfRadarChart rows={rows} />,
  },
  "atividade-setores": {
    datasets: ["indust_comer_serv"],
    height: 560,
    render: ([rows]) => (
      <SeriesChart rows={rows} series={{ pim_12m: "Indústria", pmc_12m: "Comércio", pms_12m: "Serviços" }} title="Atividade por setor" subtitle="Variação acumulada em 12 meses para avaliar a difusão do crescimento" suffix="%" source="IBGE (2026)" insightPosition="left" />
    ),
  },
  "precos-consumidor": {
    datasets: ["ipca_all", "ipca_grupos"],
    height: 1180,
    render: ([ipca, groups]) => <InflationDashboard ipcaRows={ipca.map((row) => ({ ...row, date: row.Date }))} groupRows={groups} />,
  },
  "precos-produtor": {
    datasets: ["ipp_m", "ipp_cnae"],
    height: 880,
    render: ([ipp, cnae]) => <IppDashboard rows={ipp} cnaeRows={cnae} />,
  },
  "juros-selic": {
    datasets: ["selic_mensal"],
    height: 560,
    render: ([rows]) => <SeriesChart rows={rows} series={{ selic: "Selic" }} title="Taxa básica de juros" subtitle="Meta Selic em % ao ano e referência para as condições financeiras" suffix="%" source="BCB (2026)" />,
  },
  "juros-estoque": {
    datasets: ["sgs_dados"],
    height: 560,
    render: ([rows]) => <SeriesChart rows={rows} series={{ credito_pf: "Pessoa física", credito_pj: "Pessoa jurídica", credito_total: "Total" }} title="Estoque de crédito" subtitle="Saldo em milhões de reais, com impacto sobre demanda corrente e investimento" source="BCB (2026)" insightPosition="left" />,
  },
  "juros-condicoes": {
    datasets: ["credito_condicoes"],
    height: 580,
    render: ([rows]) => <CreditConditionsPanel rows={rows} source="BCB (2026)" />,
  },
  "trabalho-mapa": {
    datasets: ["socioeconomico_uf", "desemp_uf"],
    height: 640,
    render: ([socioUf, desempUf]) => <BrazilUnemploymentMap rows={socioUf.length ? socioUf : desempUf} />,
  },
  "trabalho-indicadores": {
    datasets: ["socioeconomico_quarterly"],
    height: 560,
    render: ([rows]) => <SeriesChart rows={rows} series={{ taxa_desemprego: "Desemprego", taxa_ocupacao: "Ocupação", informalidade: "Informalidade", desalentadas: "Desalentadas" }} title="Indicadores do mercado de trabalho" subtitle="Taxas trimestrais para avaliar ociosidade, ocupação e qualidade dos vínculos" suffix="%" source="IBGE (2026)" />,
  },
  "trabalho-renda": {
    datasets: ["socioeconomico_quarterly"],
    height: 560,
    render: ([rows]) => <SeriesChart rows={rows} series={{ renda_media: "Renda média" }} title="Rendimento médio real" subtitle="Valor em reais e principal canal de sustentação do consumo" source="IBGE (2026)" insightPosition="left" />,
  },
  "projecoes-consumo": {
    datasets: ["projecao_consumo_familias"],
    height: 540,
    render: ([rows]) => <ProjectionChart rows={rows} source="IBGE/BCB, elaboração própria (2026)" />,
  },
} satisfies Record<string, Panel>;

export type PanelKey = keyof typeof panels;

// Um dataset usado por vários painéis é baixado uma única vez.
const cache = new Map<string, Promise<Row[]>>();
function fetchDataset(name: string) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`/data/${name}.json`).then((response) => {
      if (!response.ok) throw new Error(`Falha ao carregar ${name}`);
      return response.json() as Promise<Row[]>;
    }));
  }
  return cache.get(name)!;
}

function LoadedPanel({ panel }: { panel: Panel }) {
  const [data, setData] = useState<Row[][] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all(panel.datasets.map(fetchDataset))
      .then((result) => alive && setData(result))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [panel]);

  if (error) return <div className="panel-placeholder" style={{ minHeight: panel.height }}><span>Não foi possível carregar os dados desta visualização.</span></div>;
  if (!data) return <div className="panel-placeholder" style={{ minHeight: panel.height }}><span>Carregando dados...</span></div>;
  return <>{panel.render(data)}</>;
}

export function DeferredPanel({ panel }: { panel: PanelKey }) {
  const config: Panel = panels[panel];
  return <InView minHeight={config.height}><LoadedPanel panel={config} /></InView>;
}
