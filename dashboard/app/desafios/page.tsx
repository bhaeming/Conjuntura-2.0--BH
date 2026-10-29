import type { Metadata } from "next";
import { ArrowDown, FileText, Film, Map as MapIcon, SlidersHorizontal, TableProperties, Users } from "lucide-react";
import { StoryBlock, StoryPage, StorySection } from "@/components/site/Story";
import { StructuralChart } from "@/components/site/StructuralChart";

export const metadata: Metadata = {
  title: "Desafios estruturantes · Painel de Conjuntura",
  description: "Produtividade, investimento, educação e dívida pública: a agenda de longo prazo da economia brasileira.",
};

// Diagnóstico de partida (valores ilustrativos): Brasil frente a uma referência por desafio.
const pillars = [
  { id: "produtividade", title: "Produtividade", text: "Por que cada trabalhador brasileiro produz pouco e cresce devagar.", metric: "PIB por trabalhador, % dos EUA", brasil: 25, referencia: 60, refLabel: "OCDE", unit: "", higherIsBetter: true },
  { id: "investimento", title: "Investimento", text: "Quanto o país investe, quem investe e o que falta para crescer mais.", metric: "FBCF, % do PIB", brasil: 17.2, referencia: 25, refLabel: "Emergentes", unit: "%", higherIsBetter: true },
  { id: "educacao", title: "Educação", text: "Da quantidade de anos de estudo à qualidade da aprendizagem.", metric: "Jovens no nível básico de matemática, em 100", brasil: 27, referencia: 69, refLabel: "OCDE", unit: "", higherIsBetter: true },
  { id: "divida", title: "Dívida pública", text: "Trajetória, sustentabilidade e o peso dos juros nas contas públicas.", metric: "Dívida bruta, % do PIB", brasil: 78.5, referencia: 60, refLabel: "Emergentes", unit: "%", higherIsBetter: false },
];

const statuses = [
  { key: "manter", label: "Manter", text: "Próximo da referência (≥ 90%)" },
  { key: "reforcar", label: "Reforçar", text: "Distância moderada (65% a 90%)" },
  { key: "desenvolver", label: "Desenvolver", text: "Distância grande (< 65%)" },
] as const;

function statusOf(pillar: (typeof pillars)[number]) {
  const ratio = pillar.higherIsBetter ? pillar.brasil / pillar.referencia : pillar.referencia / pillar.brasil;
  return statuses[ratio >= 0.9 ? 0 : ratio >= 0.65 ? 1 : 2];
}

const br = (value: number, unit: string) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unit}`;

const materials = [
  { icon: FileText, title: "Notas técnicas", text: "Textos curtos por tema, com metodologia e leitura dos resultados." },
  { icon: SlidersHorizontal, title: "Simuladores", text: "Ex.: estabilização da dívida a partir de primário, juros e crescimento." },
  { icon: MapIcon, title: "Recortes territoriais", text: "Produtividade, escolaridade e investimento por UF e região." },
  { icon: TableProperties, title: "Séries longas", text: "Bases históricas harmonizadas, com download no padrão do painel." },
  { icon: Film, title: "Conteúdo multimídia", text: "Vídeos, apresentações e entrevistas associadas a cada desafio." },
  { icon: Users, title: "Comparações internacionais", text: "Seleção interativa de países pares e períodos de referência." },
];

export default function Desafios() {
  return (
    <StoryPage
      axis="desafios"
      eyebrow="Eixo 2 · Desafios estruturantes"
      title={<>O que limita o crescimento<br /><em>no longo prazo.</em></>}
      lead="Produtividade, investimento, educação e dívida pública formam a base do potencial de crescimento. Este eixo reúne diagnósticos de longo prazo que complementam a leitura de conjuntura."
      meta={[
        { label: "Temas", value: "4 desafios" },
        { label: "Horizonte", value: "Décadas" },
        { label: "Status", value: "Em construção" },
      ]}
    >
      <StorySection
        id="introducao"
        index={1}
        eyebrow="Ponto de partida"
        title="Por que olhar para o longo prazo"
        lead="A conjuntura explica o ciclo; os desafios estruturantes explicam o teto. Sem ganhos de produtividade, investimento consistente, capital humano e contas públicas sustentáveis, cada retomada esbarra rapidamente nos mesmos limites."
      >
        <div className="draft-notice">
          <strong>Visualizações provisórias.</strong> Os gráficos deste eixo usam valores ilustrativos para testar formatos e narrativa. Eles serão substituídos por séries oficiais e materiais próprios.
        </div>
        <div className="status-legend" aria-label="Legenda do diagnóstico">
          {statuses.map((status) => (
            <div key={status.key}><i className={`status-icon ${status.key}`} /><span><strong>{status.label}</strong>{status.text}</span></div>
          ))}
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar, index) => {
            const status = statusOf(pillar);
            const max = Math.max(pillar.brasil, pillar.referencia) * 1.15;
            return (
              <a key={pillar.id} href={`#${pillar.id}`} className="pillar-card">
                <div className="pillar-top">
                  <span className="pillar-index">{String(index + 2).padStart(2, "0")}</span>
                  <span className={`pillar-status ${status.key}`}><i className={`status-icon ${status.key}`} />{status.label}</span>
                </div>
                <h3>{pillar.title}</h3>
                <p>{pillar.text}</p>
                <div className="pillar-gap">
                  <small>{pillar.metric}</small>
                  <div className="gap-row"><span>Brasil</span><div className="gap-track"><b className="brasil" style={{ width: `${(pillar.brasil / max) * 100}%` }} /></div><strong>{br(pillar.brasil, pillar.unit)}</strong></div>
                  <div className="gap-row"><span>{pillar.refLabel}</span><div className="gap-track"><b className="referencia" style={{ width: `${(pillar.referencia / max) * 100}%` }} /></div><strong>{br(pillar.referencia, pillar.unit)}</strong></div>
                </div>
                <span className="pillar-link">Ir para a seção <ArrowDown size={13} /></span>
              </a>
            );
          })}
        </div>
      </StorySection>

      <StorySection
        id="produtividade"
        index={2}
        eyebrow="Eficiência da economia"
        title="Produtividade"
        lead="A produtividade do trabalho brasileira avança pouco há décadas e se distanciou de economias que partiram de níveis semelhantes. Com o fim do bônus demográfico, ela passa a ser o principal determinante do crescimento."
      >
        <StoryBlock id="produtividade-relativa"><StructuralChart chart="produtividade-relativa" /></StoryBlock>
        <StoryBlock id="produtividade-decomposicao"><StructuralChart chart="produtividade-decomposicao" /></StoryBlock>
      </StorySection>

      <StorySection
        id="investimento"
        index={3}
        eyebrow="Acumulação de capital"
        title="Investimento"
        lead="A taxa de investimento permanece abaixo do patamar observado em emergentes de crescimento acelerado, com queda do investimento público e forte sensibilidade do privado ao custo do capital."
      >
        <StoryBlock id="investimento-taxa"><StructuralChart chart="investimento-taxa" /></StoryBlock>
        <StoryBlock id="investimento-comparacao"><StructuralChart chart="investimento-comparacao" /></StoryBlock>
      </StorySection>

      <StorySection
        id="educacao"
        index={4}
        eyebrow="Capital humano"
        title="Educação"
        lead="A escolaridade média cresceu, mas a aprendizagem segue distante dos países de referência. A qualidade da formação condiciona a produtividade e a capacidade de adoção de tecnologia."
      >
        <StoryBlock id="educacao-escolaridade"><StructuralChart chart="educacao-escolaridade" /></StoryBlock>
        <StoryBlock id="educacao-aprendizagem"><StructuralChart chart="educacao-aprendizagem" /></StoryBlock>
        <StoryBlock id="educacao-basico"><StructuralChart chart="educacao-basico" /></StoryBlock>
      </StorySection>

      <StorySection
        id="divida"
        index={5}
        eyebrow="Sustentabilidade fiscal"
        title="Dívida pública"
        lead="A dívida bruta em patamar elevado e juros reais altos reduzem o espaço fiscal e encarecem o crédito para toda a economia. Estabilizá-la depende da combinação entre resultado primário, juros e crescimento."
      >
        <StoryBlock id="divida-trajetoria"><StructuralChart chart="divida-trajetoria" /></StoryBlock>
        <StoryBlock id="divida-fatores"><StructuralChart chart="divida-fatores" /></StoryBlock>
      </StorySection>

      <StorySection
        id="agenda"
        index={6}
        eyebrow="Próximos passos"
        title="Materiais em construção"
        lead="Espaços reservados para conteúdos que podem dialogar com cada desafio. A ordem e o formato serão definidos conforme os materiais ficarem prontos."
      >
        <div className="material-grid">
          {materials.map(({ icon: Icon, title, text }) => (
            <article key={title} className="material-card">
              <span className="material-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
              <small>Espaço reservado</small>
            </article>
          ))}
        </div>
      </StorySection>
    </StoryPage>
  );
}
