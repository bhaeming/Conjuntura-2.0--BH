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
  const first = projections.at(0);
  const last = projections.at(-1);

  return (
    <AppShell active="/projecoes">
      <DashboardHeader
        eyebrow="Cenários e projeções"
        title="Cenários e Projeções"
        description="Trajetórias prospectivas construídas a partir dos indicadores observados do painel."
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
            label="Primeiro trimestre projetado"
            value={`${number(Number(first?.consumo_projecao ?? 0), 2)}%`}
            reference={first ? month(String(first.date)) : ""}
            source={source}
          />
          <KpiCard
            label="Último trimestre projetado"
            value={`${number(Number(last?.consumo_projecao ?? 0), 2)}%`}
            reference={last ? month(String(last.date)) : ""}
            source={source}
          />
          <KpiCard
            label="Método"
            value={String(first?.metodo ?? "n/d")}
            reference="Consumo das famílias"
            source={source}
          />
        </div>
        <ProjectionChart rows={rows} source={source} />
        <section className="insight-card projection-roadmap">
          <span className="eyebrow">Próximos módulos</span>
          <h2>Metodologia expansível para o PIB</h2>
          <p>
            O consumo das famílias entra como primeiro módulo. A mesma estrutura pode ser replicada para PIB total,
            agropecuária, indústria, serviços, despesa do governo e formação bruta de capital fixo conforme as variáveis
            explicativas forem consolidadas no pipeline.
          </p>
          <div className="projection-status-grid">
            <div><span>Disponível</span><strong>Consumo das famílias</strong></div>
            <div><span>Base pronta</span><strong>PIB e componentes</strong></div>
            <div><span>Próxima etapa</span><strong>Modelos por componente</strong></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
