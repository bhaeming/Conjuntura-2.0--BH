"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { axes, type AxisKey } from "@/lib/axes";

function AuthorButton() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="author-menu" ref={wrapper}>
      <button className="author-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
        <span className="author-avatar" aria-hidden="true" />
        <span className="author-trigger-label">Autor</span>
      </button>
      {open && (
        <div className="author-popover" role="dialog" aria-label="Sobre o autor">
          <button className="author-close" aria-label="Fechar" onClick={() => setOpen(false)}><X size={14} /></button>
          <div className="author-popover-head">
            <span className="author-avatar large" aria-hidden="true" />
            <div>
              <small>Curadoria e análise</small>
              <strong>Bruno Haeming</strong>
              <span>Economista e Doutor em Relações Internacionais</span>
            </div>
          </div>
          <p>Conjuntura macroeconômica, análise setorial e modelagem aplicada reunidas em uma ferramenta clara, auditável e orientada à decisão.</p>
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ active }: { active: AxisKey }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <span className="site-brand-mark"><BarChart3 size={17} /></span>
          <span><strong>Painel Conjuntura</strong><small>Brasil em dados</small></span>
        </Link>
        <nav className="axis-switch" aria-label="Eixos do painel">
          {Object.values(axes).map((axis, index) => (
            <Link key={axis.key} href={axis.href} className={axis.key === active ? "active" : ""} aria-current={axis.key === active ? "page" : undefined}>
              <span className="axis-number">{index + 1}</span>
              <span className="axis-title">{axis.title}</span>
              <span className="axis-short">{axis.shortTitle}</span>
            </Link>
          ))}
        </nav>
        <AuthorButton />
      </div>
    </header>
  );
}
