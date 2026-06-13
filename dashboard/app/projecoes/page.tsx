import { AppShell } from "@/components/AppShell";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DataDownloadButton } from "@/components/DataDownloadButton";
import { KpiCard } from "@/components/KpiCard";
import { ProjectionChart } from "@/components/ProjectionChart";
import { loadData } from "@/lib/data";
import { month, number } from "@/lib/format";

const source = "IBGE/BCB, elaboração própria (2026)";

export default function Projecoes() {
  const rows = loadData("projecao_consumo_familias");
  const projections = rows.filter((row) => row.tipo === "projecao");
  const yearEnd2026 = projections.find((row) => String(row.date) === "2026-12-31") ?? projections.at(-1);
  const last = projections.at(-1);
  const central = Number(yearEnd2026?.consumo_projecao ?? 0);
  const optimistic = Number(yearEnd2026?.consumo_cenario_otimista ?? 0);
  const pessimistic = Number(yearEnd2026?.consumo_cenario_pessimista ?? 0);

  return (
    <AppShell active="/projecoes">
      <DashboardHeader
        eyebrow="Cenários e projeções"
        title="Cenários e Projeções"
        description="Leitura prospectiva do consumo das famílias em um ambiente de renda ainda resiliente, juros altos, inflação persistente e riscos externos relevantes."
        reference={last ? month(String(last.date)) : "n/d"}
      />
      <div className="content">
        <DataDownloadButton
          title="Cenários e projeções"
          datasets={[
            { name: "projecao_consumo_familias", source },
            { name: "pib_componentes_quarterly", source: "IBGE (2026)" },
            { name: "ipca_all", source: "IBGE/BCB (2026)" },
            { name: "sgs_dados", source: "BCB (2026)" },
          ]}
        />
        <div className="kpi-grid three">
          <KpiCard
            label="Projeção central 2026"
            value={`${number(central, 2)}%`}
            reference={yearEnd2026 ? month(String(yearEnd2026.date)) : ""}
            source={source}
          />
          <KpiCard
            label="Cenário otimista 2026"
            value={`${number(optimistic, 2)}%`}
            reference={yearEnd2026 ? month(String(yearEnd2026.date)) : ""}
            source={source}
          />
          <KpiCard
            label="Cenário pessimista 2026"
            value={`${number(pessimistic, 2)}%`}
            reference={yearEnd2026 ? month(String(yearEnd2026.date)) : ""}
            source={source}
          />
        </div>
        <ProjectionChart rows={rows} source={source} />
        <section className="insight-card projection-roadmap">
          <span className="eyebrow">Síntese econômica</span>
          <h2>Demanda doméstica avança, mas sem folga financeira</h2>
          <p>
            A projeção aponta um consumo das famílias em desaceleração controlada, não em ruptura. A atividade segue
            apoiada por massa de renda, mercado de trabalho e algum impulso de crédito, mas a combinação de juros
            elevados, inadimplência alta e inflação ainda pressionada reduz o espaço para uma expansão mais intensa dos
            bens duráveis e dos segmentos mais dependentes de financiamento.
          </p>
          <p>
            O ano eleitoral tende a aumentar a importância dos vetores fiscais e de renda disponível, o que pode sustentar
            serviços e consumo corrente. O risco é que esse suporte encontre uma economia com condições financeiras ainda
            restritivas e com choques externos capazes de pressionar preços de energia, alimentos, fretes e commodities. O
            resultado central, portanto, é de crescimento positivo, mas moderado e vulnerável a deterioração inflacionária,
            aperto financeiro global ou perda de dinamismo do mercado de trabalho.
          </p>
          <div className="projection-status-grid">
            <div><span>Suporte</span><strong>Renda e crédito</strong></div>
            <div><span>Freio</span><strong>Juros e inflação</strong></div>
            <div><span>Risco</span><strong>Ambiente externo</strong></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
