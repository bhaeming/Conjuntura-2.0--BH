import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { ThemeCard } from "@/components/ThemeCard";
import { loadData } from "@/lib/data";
import { lastValue, month, number } from "@/lib/format";
import { themes } from "@/lib/themes";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Database, Sparkles } from "lucide-react";

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
        <div className="home-hero-copy">
          <span className="eyebrow">Ciclo econ&ocirc;mico do Brasil</span>
          <h1>Economia brasileira,<br /><em>em perspectiva.</em></h1>
          <p>Indicadores oficiais, leituras econ&ocirc;micas e cen&aacute;rios em uma experi&ecirc;ncia &uacute;nica para transformar dados em decis&otilde;es mais seguras.</p>
          <div className="hero-actions">
            <Link href="/atividade" className="primary-action">Explorar os pain&eacute;is <ArrowRight size={16} /></Link>
            <a href="#resumo" className="secondary-action">Ver resumo executivo</a>
          </div>
          <div className="trust-row" aria-label="Diferenciais do painel">
            <span><Database size={14} /> Fontes oficiais</span>
            <span><BadgeCheck size={14} /> Curadoria econ&ocirc;mica</span>
            <span><Sparkles size={14} /> Leitura pronta para decis&atilde;o</span>
          </div>
        </div>
        <aside className="home-proof-card" aria-label="Curadoria do painel">
          <div className="author-photo" aria-hidden="true" />
          <div className="author-card-copy">
            <span>Curadoria e an&aacute;lise</span>
            <strong>Bruno Haeming</strong>
            <small>Economista e Doutor em Rela&ccedil;&otilde;es Internacionais</small>
          </div>
          <p>Conjuntura macroecon&ocirc;mica, an&aacute;lise setorial e modelagem aplicada reunidas em uma ferramenta clara, audit&aacute;vel e orientada &agrave; decis&atilde;o.</p>
        </aside>
      </div>
      <section className="snapshot" id="resumo">
        <div className="section-heading"><span className="eyebrow">RESUMO EXECUTIVO</span><h2>O Brasil em quatro sinais</h2></div>
        <div className="executive-grid">
          <div className="kpi-grid home-kpis">
            <KpiCard label="IPCA 12 meses" value={`${number(ipca?.value ?? 0, 2)}%`} reference={ipca ? month(ipca.date) : ""} source="IBGE/BCB (2026)" />
            <KpiCard label="Selic" value={`${number(selic?.value ?? 0, 2)}%`} reference={selic ? month(selic.date) : ""} source="BCB (2026)" />
            <KpiCard label="Desemprego" value={`${number(desemprego?.value ?? 0, 1)}%`} reference={desemprego ? month(desemprego.date) : ""} source="IBGE (2026)" />
            <KpiCard label="IBC-Br dessaz." value={number(ibc?.value ?? 0, 2)} reference={ibc ? month(ibc.date) : ""} source="BCB (2026)" />
          </div>
          <article className="executive-reading">
            <span className="eyebrow">LEITURA INTEGRADA</span>
            <h2>Atividade resiliente, com condi&ccedil;&otilde;es financeiras ainda restritivas</h2>
            <p>Trabalho e atividade ainda sustentam a demanda, enquanto infla&ccedil;&atilde;o, juros e cr&eacute;dito caro limitam a velocidade do ciclo. Leia n&iacute;vel e dire&ccedil;&atilde;o em conjunto para distinguir melhora estrutural de oscila&ccedil;&otilde;es pontuais.</p>
            <Link href="/projecoes">Abrir cen&aacute;rios e proje&ccedil;&otilde;es <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>
      <section className="themes-section">
        <div className="section-heading"><span className="eyebrow">NAVEGUE POR TEMA</span><h2>Escolha uma dimens&atilde;o para analisar</h2></div>
        <div className="theme-grid">{themes.map((theme) => <ThemeCard key={theme.href} theme={theme} />)}</div>
      </section>
    </AppShell>
  );
}
