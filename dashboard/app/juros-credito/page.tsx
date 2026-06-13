import { AppShell } from "@/components/AppShell";
import { CreditConditionsPanel } from "@/components/CreditConditionsPanel";
import { DataDownloadButton } from "@/components/DataDownloadButton";
import { DashboardHeader } from "@/components/DashboardHeader";
import { KpiCard } from "@/components/KpiCard";
import { SeriesChart } from "@/components/SeriesChart";
import { loadData } from "@/lib/data";
import { compact, lastValue, month, number } from "@/lib/format";

const source = "BCB (2026)";

export default function JurosCredito() {
  const sgs = loadData("sgs_dados");
  const creditoCondicoes = loadData("credito_condicoes");
  const selicRows = loadData("selic_mensal");
  const selic = lastValue(selicRows, "selic");
  const credito = lastValue(sgs, "credito_total");
  const juros = lastValue(creditoCondicoes, "taxa_juros_total");
  const inad = lastValue(creditoCondicoes, "inadimplencia_total");

  return (
    <AppShell active="/juros-credito">
      <DashboardHeader
        eyebrow="Condicoes financeiras"
        title="Juros e credito"
        description="O mercado de credito mostra o principal canal de transmissao da politica monetaria: juros elevados, inadimplencia e seletividade financeira condicionam consumo e investimento."
        reference={selic ? month(selic.date) : "n/d"}
      />
      <div className="content">
        <DataDownloadButton
          title="Juros e credito"
          datasets={[
            { name: "selic_mensal", source },
            { name: "sgs_dados", source },
            { name: "credito_condicoes", source },
          ]}
        />
        <div className="kpi-grid">
          <KpiCard label="Taxa Selic" value={`${number(selic?.value ?? 0, 2)}%`} reference={selic ? month(selic.date) : ""} source={source} />
          <KpiCard label="Credito total" value={`R$ ${compact((credito?.value ?? 0) * 1_000_000)}`} reference={credito ? month(credito.date) : ""} source={source} />
          <KpiCard label="Juros total" value={`${number(juros?.value ?? 0, 2)}%`} reference={juros ? month(juros.date) : ""} source={source} />
          <KpiCard label="Inadimplencia total" value={`${number(inad?.value ?? 0, 2)}%`} reference={inad ? month(inad.date) : ""} source={source} />
        </div>
        <SeriesChart rows={selicRows} series={{ selic: "Selic" }} title="Taxa basica de juros" subtitle="Meta Selic em % ao ano e referencia para as condicoes financeiras" suffix="%" source={source} />
        <SeriesChart rows={sgs} series={{ credito_pf: "Pessoa fisica", credito_pj: "Pessoa juridica", credito_total: "Total" }} title="Estoque de credito" subtitle="Saldo em milhoes de reais, com impacto sobre demanda corrente e investimento" source={source} insightPosition="left" />
        <CreditConditionsPanel rows={creditoCondicoes} source={source} />
      </div>
    </AppShell>
  );
}
