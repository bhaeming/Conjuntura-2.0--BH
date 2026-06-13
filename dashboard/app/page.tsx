import { AppShell } from "@/components/AppShell";
import { DataDownloadButton } from "@/components/DataDownloadButton";
import { KpiCard } from "@/components/KpiCard";
import { ThemeCard } from "@/components/ThemeCard";
import { loadData } from "@/lib/data";
import { lastValue, month, number } from "@/lib/format";
import { themes } from "@/lib/themes";

export default function Home() {
  const ipcaRows = loadData("ipca_all");
  const selicRows = loadData("selic_mensal");
  const ipca = lastValue(ipcaRows, "ipca_12m");
  const selic = lastValue(selicRows, "selic");
  const socio = loadData("socioeconomico_quarterly");
  const desemprego = lastValue(socio, "taxa_desemprego");
  const sgs = loadData("sgs_dados");
  const ibc = lastValue(sgs, "ibc_br_dessaz");

  return (
    <AppShell>
      <div className="home-hero">
        <div>
          <span className="eyebrow">PAINEL DE CONJUNTURA 2.0</span>
          <h1>Economia brasileira,<br /><em>em perspectiva.</em></h1>
          <p>Indicadores essenciais organizados para uma leitura clara, r&aacute;pida e compar&aacute;vel do cen&aacute;rio econ&ocirc;mico.</p>
        </div>
        <div className="author-hover-card" tabIndex={0} aria-label="Sobre o autor">
          <div className="author-card-default">
            <span>Feature</span>
            <strong>Sobre o autor</strong>
            <small>Conhe&ccedil;a a curadoria por tr&aacute;s do painel</small>
          </div>
          <div className="author-card-reveal">
            <div className="author-photo" aria-hidden="true" />
            <div className="author-card-copy">
              <span>Autor</span>
              <strong>Bruno Haeming</strong>
              <small>Economista | Doutor em Rela&ccedil;&otilde;es Internacionais</small>
            </div>
            <div className="author-panel">
              <p>Doutor em Rela&ccedil;&otilde;es Internacionais, com &ecirc;nfase em Economia Pol&iacute;tica Internacional.</p>
              <p>Atua com conjuntura macroecon&ocirc;mica, an&aacute;lise setorial, modelagem econom&eacute;trica aplicada, pol&iacute;tica e risco pol&iacute;tico internacional.</p>
              <span>Sobre a ferramenta</span>
              <p>O painel organiza indicadores oficiais e leituras de conjuntura para acelerar o trabalho de economistas, analistas e tomadores de decis&atilde;o.</p>
            </div>
          </div>
        </div>
      </div>
      <section className="snapshot">
        <div><span className="eyebrow">RESUMO EXECUTIVO</span><h2>&Uacute;ltimos indicadores</h2></div>
        <DataDownloadButton
          title="Resumo executivo"
          datasets={[
            { name: "ipca_all", source: "IBGE/BCB (2026)" },
            { name: "selic_mensal", source: "BCB (2026)" },
            { name: "socioeconomico_quarterly", source: "IBGE (2026)" },
            { name: "sgs_dados", source: "BCB (2026)" },
          ]}
        />
        <div className="kpi-grid">
          <KpiCard label="IPCA 12 meses" value={`${number(ipca?.value ?? 0, 2)}%`} reference={ipca ? month(ipca.date) : ""} source="IBGE/BCB (2026)" />
          <KpiCard label="Selic" value={`${number(selic?.value ?? 0, 2)}%`} reference={selic ? month(selic.date) : ""} source="BCB (2026)" />
          <KpiCard label="Desemprego" value={`${number(desemprego?.value ?? 0, 1)}%`} reference={desemprego ? month(desemprego.date) : ""} source="IBGE (2026)" />
          <KpiCard label="IBC-Br dessaz." value={number(ibc?.value ?? 0, 2)} reference={ibc ? month(ibc.date) : ""} source="BCB (2026)" />
        </div>
      </section>
      <section className="themes-section">
        <div className="section-heading"><span className="eyebrow">NAVEGUE POR TEMA</span><h2>Escolha uma dimens&atilde;o para analisar</h2></div>
        <div className="theme-grid">{themes.map((theme) => <ThemeCard key={theme.href} theme={theme} />)}</div>
      </section>
    </AppShell>
  );
}
