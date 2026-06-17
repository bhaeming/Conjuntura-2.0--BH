import { AppShell } from "@/components/AppShell";
import { DataDownloadButton } from "@/components/DataDownloadButton";
import { DashboardHeader } from "@/components/DashboardHeader";
import { IbcActivityPanel } from "@/components/IbcActivityPanel";
import { SeriesChart } from "@/components/SeriesChart";
import { UfRadarChart } from "@/components/UfRadarChart";
import { loadData } from "@/lib/data";
import { lastValue, month } from "@/lib/format";

export default function Atividade() {
  const sgs = loadData("sgs_dados");
  const sectors = loadData("indust_comer_serv");
  const pibComponents = loadData("pib_componentes_quarterly");
  const ibcUf = loadData("ibc_uf");
  const last = lastValue(sgs, "ibc_br_dessaz");

  return (
    <AppShell active="/atividade">
      <DashboardHeader
        eyebrow="Producao e crescimento"
        title="Atividade economica"
        description="A atividade combina sustentacao de renda e servicos com freios vindos de juros altos, credito caro e desempenho heterogeneo entre setores e regioes."
        reference={last ? month(last.date) : "n/d"}
      />
      <div className="content">
        <DataDownloadButton
          title="Atividade economica"
          datasets={[
            { name: "sgs_dados", source: "BCB (2026)" },
            { name: "indust_comer_serv", source: "IBGE (2026)" },
            { name: "pib_componentes_quarterly", source: "IBGE (2026)" },
            { name: "ibc_uf", source: "BCB (2026)" },
          ]}
        />
        <IbcActivityPanel nationalRows={sgs} regionalRows={ibcUf} />
        <SeriesChart
          rows={pibComponents}
          series={{
            pib_precos_mercado: "PIB",
            consumo_familias: "Consumo das familias",
            despesa_governo: "Despesa do governo",
            fbcf: "FBCF",
            agropecuaria: "Agropecuaria",
            industria: "Industria",
            servicos: "Servicos",
          }}
          defaultSelected={["pib_precos_mercado", "consumo_familias", "despesa_governo"]}
          title="PIB e componentes"
          subtitle="Acumulado em quatro trimestres por componente selecionado"
          suffix="%"
          source="IBGE (2026)"
          insightPosition="left"
        />
        <UfRadarChart rows={ibcUf} />
        <SeriesChart rows={sectors} series={{ pim_12m: "Industria", pmc_12m: "Comercio", pms_12m: "Servicos" }} title="Atividade por setor" subtitle="Variacao acumulada em 12 meses para avaliar a difusao do crescimento" suffix="%" source="IBGE (2026)" insightPosition="left" />
      </div>
    </AppShell>
  );
}
