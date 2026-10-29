import type { ReactNode } from "react";
import type { AxisKey } from "@/lib/axes";
import { DataDownloadButton } from "@/components/DataDownloadButton";
import { SectionNav } from "./SectionNav";
import { SiteHeader } from "./SiteHeader";

export function StoryPage({
  axis,
  eyebrow,
  title,
  lead,
  meta,
  children,
}: {
  axis: AxisKey;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  meta?: { label: string; value: string }[];
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader active={axis} />
      <section className={`story-hero ${axis}`}>
        <div className="story-hero-inner">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{lead}</p>
          {meta && (
            <dl className="story-hero-meta">
              {meta.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
            </dl>
          )}
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
