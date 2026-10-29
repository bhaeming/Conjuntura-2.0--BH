import { ArrowDown } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { DeferredPanel } from "@/components/site/DeferredPanel";
import { StoryBlock, StoryPage, StorySection } from "@/components/site/Story";
import { loadData } from "@/lib/data";
import { compact, lastValue, month, number } from "@/lib/format";

const percent = (item: { value: number } | null, digits = 2) => `${number(item?.value ?? 0, digits)}%`;
const ref = (item: { date: string } | null) => (item ? month(item.date) : "");

export default function Conjuntura() {
  const ipcaRows = loadData("ipca_all").map((row) => ({ ...row, date: row.Date }));
  const selicRows = loadData("selic_mensal");
  const sgs = loadData("sgs_dados");
  const socio = loadData("socioeconomico_quarterly");
  const credito = loadData("credito_condicoes");
  const projecao = loadData("projecao_consumo_familias").filter((row) => row.tipo === "projecao");

  const ipca = lastValue(ipcaRows, "ipca_12m");
  const selic = lastValue(selicRows, "selic");
  const desemprego = lastValue(socio, "taxa_desemprego");
  const ibc = lastValue(sgs, "ibc_br_dessaz");
  const creditoTotal = lastValue(sgs, "credito_total");
  const jurosTotal = lastValue(credito, "taxa_juros_total");
  const inadimplencia = lastValue(credito, "inadimplencia_total");
  const projecao2026 = projecao.find((row) => String(row.date) === "2026-12-31") ?? projecao.at(-1);
  const projecaoRef = projecao2026 ? month(String(projecao2026.date)) : "";

  const precos = [
    { key: "ipca", label: "IPCA mensal" },
    { key: "ipca_12m", label: "IPCA 12 meses" },
    { key: "ipca_livres_12m_calc", label: "Preços livres 12m" },
    { key: "ipca_administrados_12m_calc", label: "Administrados 12m" },
  ];
  const trabalho = [
    { key: "taxa_desemprego", label: "Desemprego" },
    { key: "taxa_ocupacao", label: "Ocupação" },
    { key: "renda_media", label: "Renda média" },
    { key: "informalidade", label: "Informalidade" },
  ];

  return (
    <StoryPage
      axis="conjuntura"
      eyebrow="Eixo 1 · Conjuntura"
      title={<>Economia brasileira,<br /><em>em perspectiva.</em></>}
      lead="Uma leitura contínua do ciclo econômico: atividade, preços, condições financeiras, mercado de trabalho e cenários, com indicadores oficiais e interpretação econômica em cada etapa."
      meta={[
        { label: "IPCA 12m", value: percent(ipca) },
        { label: "Selic", value: percent(selic) },
        { label: "Desemprego", value: percent(desemprego, 1) },
        { label: "Referência", value: ref(ipca) },
      ]}
    >
      <StorySection
        id="visao-geral"
        index={1}
        eyebrow="Resumo executivo"
        title="O Brasil em quatro sinais"
        lead="Atividade, inflação, juros e emprego definem a fotografia do ciclo. Leia nível e direção em conjunto para distinguir melhora estrutural de oscilações pontuais."
      >
        <div className="overview-grid">
          <div className="kpi-grid two">
            <KpiCard label="IPCA 12 meses" value={percent(ipca)} reference={ref(ipca)} source="IBGE/BCB (2026)" />
            <KpiCard label="Selic" value={percent(selic)} reference={ref(selic)} source="BCB (2026)" />
            <KpiCard label="Desemprego" value={percent(desemprego, 1)} reference={ref(desemprego)} source="IBGE (2026)" />
            <KpiCard label="IBC-Br dessaz." value={number(ibc?.value ?? 0, 2)} reference={ref(ibc)} source="BCB (2026)" />
          </div>
          <article className="reading-card">
            <span className="eyebrow">Leitura integrada</span>
            <h3>Atividade em desaceleração gradual, com alívio monetário em curso</h3>
            <p>A Selic recuou para {percent(selic)} e o IPCA em 12 meses está em {percent(ipca)}, mas crédito caro e inadimplência em {percent(inadimplencia)} ainda limitam a transmissão. O mercado de trabalho, com desemprego de {percent(desemprego, 1)}, segue sustentando a renda, enquanto o investimento perde fôlego. As seções a seguir detalham cada vetor.</p>
            <a href="#atividade">Começar pela atividade <ArrowDown size={14} /></a>
          </article>
        </div>
      </StorySection>

      <StorySection
        id="atividade"
        index={2}
        eyebrow="Produção e crescimento"
        title="Atividade econômica"
        lead="A atividade combina sustentação de renda e serviços com freios vindos de juros altos, crédito caro e desempenho heterogêneo entre setores e regiões."
        reference={ref(ibc)}
        datasets={[
          { name: "sgs_dados", source: "BCB (2026)" },
          { name: "indust_comer_serv", source: "IBGE (2026)" },
          { name: "pib_componentes_quarterly", source: "IBGE (2026)" },
          { name: "ibc_uf", source: "BCB (2026)" },
        ]}
      >
        <StoryBlock id="atividade-ibc"><DeferredPanel panel="atividade-ibc" /></StoryBlock>
        <StoryBlock id="atividade-pib"><DeferredPanel panel="atividade-pib" /></StoryBlock>
        <StoryBlock id="atividade-uf"><DeferredPanel panel="atividade-uf" /></StoryBlock>
        <StoryBlock id="atividade-setores"><DeferredPanel panel="atividade-setores" /></StoryBlock>
      </StorySection>

      <StorySection
        id="precos"
        index={3}
        eyebrow="Inflação"
        title="Preços"
        lead="A inflação segue como restrição central para renda real, juros e consumo, com pressão distribuída entre livres, administrados e custos ao produtor."
        reference={ref(ipca)}
        datasets={[
          { name: "ipca_all", source: "IBGE/BCB (2026)" },
          { name: "ipca_grupos", source: "IBGE (2026)" },
          { name: "ipp_m", source: "IBGE (2026)" },
          { name: "ipp_cnae", source: "IBGE (2026)" },
        ]}
      >
        <div className="kpi-grid">
          {precos.map(({ key, label }) => {
            const item = lastValue(ipcaRows, key);
            return <KpiCard key={key} label={label} value={percent(item)} reference={ref(item)} source="IBGE/BCB (2026)" />;
          })}
        </div>
        <StoryBlock id="precos-consumidor"><DeferredPanel panel="precos-consumidor" /></StoryBlock>
        <StoryBlock id="precos-produtor"><DeferredPanel panel="precos-produtor" /></StoryBlock>
      </StorySection>

      <StorySection
        id="juros-credito"
        index={4}
        eyebrow="Condições financeiras"
        title="Juros e crédito"
        lead="O mercado de crédito é o principal canal de transmissão da política monetária: juros elevados, inadimplência e seletividade financeira condicionam consumo e investimento."
        reference={ref(selic)}
        datasets={[
          { name: "selic_mensal", source: "BCB (2026)" },
          { name: "sgs_dados", source: "BCB (2026)" },
          { name: "credito_condicoes", source: "BCB (2026)" },
        ]}
      >
        <div className="kpi-grid">
          <KpiCard label="Taxa Selic" value={percent(selic)} reference={ref(selic)} source="BCB (2026)" />
          <KpiCard label="Crédito total" value={`R$ ${compact((creditoTotal?.value ?? 0) * 1_000_000)}`} reference={ref(creditoTotal)} source="BCB (2026)" />
          <KpiCard label="Juros total" value={percent(jurosTotal)} reference={ref(jurosTotal)} source="BCB (2026)" />
          <KpiCard label="Inadimplência total" value={percent(inadimplencia)} reference={ref(inadimplencia)} source="BCB (2026)" />
        </div>
        <StoryBlock id="juros-selic"><DeferredPanel panel="juros-selic" /></StoryBlock>
        <StoryBlock id="juros-estoque"><DeferredPanel panel="juros-estoque" /></StoryBlock>
        <StoryBlock id="juros-condicoes"><DeferredPanel panel="juros-condicoes" /></StoryBlock>
      </StorySection>

      <StorySection
        id="trabalho"
        index={5}
        eyebrow="Emprego e renda"
        title="Mercado de trabalho"
        lead="Emprego, renda e formalização definem a sustentação do consumo: o quadro melhora quando ocupação e rendimento avançam sem deterioração da qualidade dos postos."
        reference={ref(desemprego)}
        datasets={[
          { name: "socioeconomico_quarterly", source: "IBGE (2026)" },
          { name: "desemp_uf", source: "IBGE (2026)" },
          { name: "socioeconomico_uf", source: "IBGE (2026)" },
        ]}
      >
        <div className="kpi-grid">
          {trabalho.map(({ key, label }) => {
            const item = lastValue(socio, key);
            const value = key === "renda_media" ? `R$ ${number(item?.value ?? 0, 0)}` : percent(item, 1);
            return <KpiCard key={key} label={label} value={value} reference={ref(item)} source="IBGE (2026)" />;
          })}
        </div>
        <StoryBlock id="trabalho-mapa"><DeferredPanel panel="trabalho-mapa" /></StoryBlock>
        <StoryBlock id="trabalho-indicadores"><DeferredPanel panel="trabalho-indicadores" /></StoryBlock>
        <StoryBlock id="trabalho-renda"><DeferredPanel panel="trabalho-renda" /></StoryBlock>
      </StorySection>

      <StorySection
        id="projecoes"
        index={6}
        eyebrow="Trajetórias prospectivas"
        title="Cenários e projeções"
        lead="Leitura prospectiva do consumo das famílias em um ambiente de renda ainda resiliente, juros altos, inflação persistente e riscos externos relevantes."
        reference={projecaoRef}
        datasets={[
          { name: "projecao_consumo_familias", source: "IBGE/BCB, elaboração própria (2026)" },
          { name: "pib_componentes_quarterly", source: "IBGE (2026)" },
        ]}
      >
        <div className="kpi-grid three">
          <KpiCard label="Projeção central 2026" value={`${number(Number(projecao2026?.consumo_projecao ?? 0), 2)}%`} reference={projecaoRef} source="Elaboração própria (2026)" />
          <KpiCard label="Cenário otimista 2026" value={`${number(Number(projecao2026?.consumo_cenario_otimista ?? 0), 2)}%`} reference={projecaoRef} source="Elaboração própria (2026)" />
          <KpiCard label="Cenário pessimista 2026" value={`${number(Number(projecao2026?.consumo_cenario_pessimista ?? 0), 2)}%`} reference={projecaoRef} source="Elaboração própria (2026)" />
        </div>
        <DeferredPanel panel="projecoes-consumo" />
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
      </StorySection>
    </StoryPage>
  );
}
