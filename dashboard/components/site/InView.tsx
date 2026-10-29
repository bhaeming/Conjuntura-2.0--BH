"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Monta o conteúdo só quando ele se aproxima da área visível (rolagem contínua sob demanda).
export function InView({ minHeight, children, label = "Carregando visualização..." }: { minHeight: number; children: ReactNode; label?: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "900px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={anchor}>
      {visible ? children : <div className="panel-placeholder" style={{ minHeight }}><span>{label}</span></div>}
    </div>
  );
}
