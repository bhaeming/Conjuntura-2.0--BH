import {
  Activity,
  BadgeDollarSign,
  Compass,
  Factory,
  GraduationCap,
  Landmark,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Scale,
  TrendingUp,
  Users,
} from "lucide-react";

export type AxisKey = "conjuntura" | "desafios";

export type NavSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  children?: { id: string; title: string }[];
};

export type Axis = {
  key: AxisKey;
  href: string;
  title: string;
  shortTitle: string;
  description: string;
  sections: NavSection[];
};

export const axes: Record<AxisKey, Axis> = {
  conjuntura: {
    key: "conjuntura",
    href: "/",
    title: "Conjuntura",
    shortTitle: "Conjuntura",
    description: "Ciclo econômico de curto prazo",
    sections: [
      { id: "visao-geral", title: "Visão geral", icon: LayoutDashboard },
      {
        id: "atividade",
        title: "Atividade econômica",
        icon: Activity,
        children: [
          { id: "atividade-ibc", title: "IBC-Br" },
          { id: "atividade-pib", title: "PIB e componentes" },
          { id: "atividade-uf", title: "Atividade regional" },
          { id: "atividade-setores", title: "Setores" },
        ],
      },
      {
        id: "precos",
        title: "Preços",
        icon: BadgeDollarSign,
        children: [
          { id: "precos-consumidor", title: "Inflação ao consumidor" },
          { id: "precos-produtor", title: "Preços ao produtor" },
        ],
      },
      {
        id: "juros-credito",
        title: "Juros e crédito",
        icon: Landmark,
        children: [
          { id: "juros-selic", title: "Taxa Selic" },
          { id: "juros-estoque", title: "Estoque de crédito" },
          { id: "juros-condicoes", title: "Custo e inadimplência" },
        ],
      },
      {
        id: "trabalho",
        title: "Mercado de trabalho",
        icon: Users,
        children: [
          { id: "trabalho-mapa", title: "Mapa por UF" },
          { id: "trabalho-indicadores", title: "Indicadores" },
          { id: "trabalho-renda", title: "Rendimento real" },
        ],
      },
      { id: "projecoes", title: "Cenários e projeções", icon: TrendingUp },
    ],
  },
  desafios: {
    key: "desafios",
    href: "/desafios",
    title: "Desafios estruturantes",
    shortTitle: "Desafios",
    description: "Agenda de longo prazo",
    sections: [
      { id: "introducao", title: "Por que o longo prazo", icon: Compass },
      {
        id: "produtividade",
        title: "Produtividade",
        icon: Factory,
        children: [
          { id: "produtividade-relativa", title: "Distância da fronteira" },
          { id: "produtividade-decomposicao", title: "Fontes do crescimento" },
        ],
      },
      {
        id: "investimento",
        title: "Investimento",
        icon: PiggyBank,
        children: [
          { id: "investimento-taxa", title: "Taxa de investimento" },
          { id: "investimento-comparacao", title: "Comparação internacional" },
        ],
      },
      {
        id: "educacao",
        title: "Educação",
        icon: GraduationCap,
        children: [
          { id: "educacao-escolaridade", title: "Escolaridade e produtividade" },
          { id: "educacao-aprendizagem", title: "Aprendizagem" },
          { id: "educacao-basico", title: "Nível básico" },
        ],
      },
      {
        id: "divida",
        title: "Dívida pública",
        icon: Scale,
        children: [
          { id: "divida-trajetoria", title: "Trajetória" },
          { id: "divida-fatores", title: "Fatores de variação" },
        ],
      },
      { id: "agenda", title: "Materiais em construção", icon: Layers },
    ],
  },
};
