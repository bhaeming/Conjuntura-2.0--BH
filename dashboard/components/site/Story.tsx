import type { ReactNode } from "react";
import { axes, type AxisKey } from "@/lib/axes";
import { DataDownloadButton } from "@/components/DataDownloadButton";
import { SectionNav } from "./SectionNav";
import { SiteHeader } from "./SiteHeader";

// A primeira seção do índice vive dentro do cabeçalho: o hero leva o id dela.
export function StoryPage({
  axis,
  eyebrow,
  title,
  lead,
  intro,
  children,
}: {
  axis: AxisKey;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader active={axis} />
      <section id={axes[axis].sections[0].id} className={`story-hero ${axis}`}>
        <div className="story-hero-inner">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{lead}</p>
          {intro && <div className="story-hero-intro">{intro}</div>}
        </div>
      </section>
      <div className="story-layout">
        <SectionNav axis={axis} />
        <main className="story-content">{children}</main>
      </div>
      <footer className="story-footer">
        <span>Painel Conjuntura · Brasil em dados</span>
        <span>Fontes: IBGE, BCB e elaboração própria</span>
      </footer>
    </>
  );
}

export function StorySection({
  id,
  index,
  eyebrow,
  title,
  lead,
  reference,
  datasets,
  children,
}: {
  id: string;
  index: number;
  eyebrow: string;
  title: string;
  lead: string;
  reference?: string;
  datasets?: { name: string; source: string }[];
  children: ReactNode;
}) {
  return (
    <section id={id} className="story-section" aria-labelledby={`${id}-title`}>
      <header className="story-section-header">
        <span className="story-section-index">{String(index).padStart(2, "0")}</span>
        <div className="story-section-copy">
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{lead}</p>
        </div>
        {(reference || datasets) && (
          <div className="story-section-aside">
            {reference && <span className="story-reference"><span className="status-dot" />Última referência <strong>{reference}</strong></span>}
            {datasets && <DataDownloadButton title={title} datasets={datasets} />}
          </div>
        )}
      </header>
      <div className="story-section-body">{children}</div>
    </section>
  );
}

export function StoryBlock({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="story-block">{children}</div>;
}
