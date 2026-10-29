"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axes, type AxisKey } from "@/lib/axes";

// Linha de leitura: a seção ativa é a última cujo topo passou deste ponto da janela.
const READING_LINE = 0.3;

function lastPassed(ids: string[]) {
  const line = window.innerHeight * READING_LINE;
  let current: string | null = null;
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element && element.getBoundingClientRect().top <= line) current = id;
  }
  return current;
}

export function SectionNav({ axis }: { axis: AxisKey }) {
  const { sections, title } = axes[axis];
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [activeChild, setActiveChild] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const chipBar = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; until: number } | null>(null);

  const update = useCallback(() => {
    const section = lastPassed(sections.map((item) => item.id)) ?? sections[0].id;
    const children = sections.find((item) => item.id === section)?.children ?? [];
    setActiveSection(section);
    setActiveChild(lastPassed(children.map((child) => child.id)));
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
  }, [sections]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [update]);

  // Os painéis carregam ao se aproximar da tela e mudam a altura da página;
  // após um salto pelo índice, mantém o alvo alinhado até o usuário rolar por conta própria.
  useEffect(() => {
    const cancel = () => { pending.current = null; };
    const observer = new ResizeObserver(() => {
      const target = pending.current;
      if (!target) return;
      if (performance.now() > target.until) { pending.current = null; return; }
      document.getElementById(target.id)?.scrollIntoView({ behavior: "auto", block: "start" });
    });
    observer.observe(document.body);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash && document.getElementById(hash)) pending.current = { id: hash, until: performance.now() + 4000 };
    return () => {
      observer.disconnect();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);

  useEffect(() => {
    const bar = chipBar.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
    if (bar && chip) bar.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" });
  }, [activeSection]);

  function go(event: React.MouseEvent, id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    event.preventDefault();
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    pending.current = { id, until: performance.now() + 3000 };
  }

  const activeIndex = sections.findIndex((item) => item.id === activeSection);

  return (
    <>
      <aside className="section-nav" aria-label={`Seções de ${title}`}>
        <div className="section-nav-card">
          <div className="section-nav-head">
            <small>Nesta página</small>
            <strong>{title}</strong>
            <div className="section-nav-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
          </div>
          <ol>
            {sections.map(({ id, title: label, icon: Icon, children }, index) => {
              const isActive = id === activeSection;
              return (
                <li key={id} className={`${isActive ? "active" : ""} ${index < activeIndex ? "done" : ""}`}>
                  <a href={`#${id}`} onClick={(event) => go(event, id)} aria-current={isActive ? "location" : undefined}>
                    <span className="section-nav-index">{String(index + 1).padStart(2, "0")}</span>
                    <Icon size={15} />
                    <span>{label}</span>
                  </a>
                  {children && (
                    <ul className={isActive ? "open" : ""}>
                      {children.map((child) => (
                        <li key={child.id}>
                          <a href={`#${child.id}`} onClick={(event) => go(event, child.id)} className={isActive && child.id === activeChild ? "active" : ""} tabIndex={isActive ? 0 : -1}>
                            {child.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
      <nav className="section-chips" aria-label={`Seções de ${title}`}>
        <div ref={chipBar}>
          {sections.map(({ id, title: label, icon: Icon }) => (
            <a key={id} href={`#${id}`} data-section={id} className={id === activeSection ? "active" : ""} onClick={(event) => go(event, id)}>
              <Icon size={14} /> {label}
            </a>
          ))}
        </div>
        <span className="section-chips-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      </nav>
    </>
  );
}
