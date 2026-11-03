"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import { Maximize2, X } from "lucide-react";
import { toggleFullscreen } from "@/components/ChartCard";
import type { Row } from "@/lib/data";
import { sequentialGreenBlue } from "@/lib/palette";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

// better: direção em que o indicador melhora, usada no ranking entre UFs.
const variables = {
  taxa_desemprego: { label: "Desemprego", unit: "%", better: "low", description: "taxa de desemprego" },
  taxa_ocupacao: { label: "Ocupação", unit: "%", better: "high", description: "taxa de ocupação" },
  informalidade: { label: "Informalidade", unit: "%", better: "low", description: "taxa de informalidade" },
  renda_media: { label: "Renda real média", unit: "R$", better: "high", description: "rendimento real médio" },
  pib_per_capita: { label: "PIB per capita", unit: "R$", better: "high", description: "PIB per capita" },
} as const;

type VariableKey = keyof typeof variables;
type Unit = (typeof variables)[VariableKey]["unit"];

const pnadKeys = ["taxa_desemprego", "taxa_ocupacao", "informalidade", "renda_media"] as const;
const quickPicks = ["Santa Catarina", "São Paulo", "Minas Gerais", "Rio Grande do Sul", "Bahia", "Distrito Federal"];
// IBC regional existe só para 13 UFs; nas demais, o perfil mostra o da região.
const regionIbc: Record<string, string> = { Norte: "ibc_norte", Nordeste: "ibc_ne", Sudeste: "ibc_se", Sul: "ibc_sul", "Centro-Oeste": "ibc_co" };
// Abaixo desta largura o painel sai de cima do mapa e passa para baixo dele (igual ao CSS).
const WIDE_QUERY = "(min-width: 1101px)";
// Espaço sob o mapa para a legenda de cores e a descrição dela.
const LEGEND_SPACE = 76;
// Longitude do ponto mais a leste do continente (Ponta do Seixas, PB).
const EAST_OF_MAINLAND = -34.79;

type GeoFeature = { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } };

const decimal = (value: number, digits = 1) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function formatValue(value: number | null | undefined, unit: Unit) {
  if (value == null || Number.isNaN(value)) return "n/d";
  if (unit === "R$") return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  return `${decimal(value)}%`;
}

const people = (value: number) => (value >= 1e6 ? `${decimal(value / 1e6, 2)} milhões` : `${decimal(value / 1e3, 0)} mil`);
const money = (value: number) => (value >= 1e12 ? `R$ ${decimal(value / 1e12, 2)} tri` : `R$ ${decimal(value / 1e9, 1)} bi`);
const signed = (value: number, digits = 1) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value), digits)}`;
const quarterLabel = (date: string) => `${Math.ceil(Number(date.slice(5, 7)) / 3)}º tri/${date.slice(0, 4)}`;
const monthLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));

function numeric(value: Row[string] | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Acumulado em 12 meses: soma dos últimos 12 meses contra os 12 anteriores.
function ibc12m(rows: Row[], column: string) {
  const points = rows.filter((row) => numeric(row[column]) != null);
  if (points.length < 24) return null;
  const sum = (slice: Row[]) => slice.reduce((acc, row) => acc + (numeric(row[column]) ?? 0), 0);
  return { value: (sum(points.slice(-12)) / sum(points.slice(-24, -12)) - 1) * 100, date: String(points.at(-1)?.date) };
}

function rankText(rank: { position: number; total: number } | null) {
  return rank ? `${rank.position}º de ${rank.total}` : null;
}

const movement = (count: number, singular: string, plural: string) =>
  count === 1 ? `1 UF ${singular}` : `${count} UFs ${plural}`;

export function BrazilUfMap({ rows, profiles, ibcRows }: { rows: Row[]; profiles: Row[]; ibcRows: Row[] }) {
  const [variable, setVariable] = useState<VariableKey>("taxa_desemprego");
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [wide, setWide] = useState(true);
  const [mapBox, setMapBox] = useState({ left: 320, right: 460, top: 72, bottom: 132, width: 1440, height: 720 });
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [glReady, setGlReady] = useState(false);
  const band = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const variableConfig = variables[variable];

  // No celular o 3D captura o arrasto do dedo e trava a rolagem da página: lá o mapa abre em 2D.
  useEffect(() => {
    if (!window.matchMedia(WIDE_QUERY).matches) setMode("2d");
  }, []);

  // A extensão 3D (WebGL) só é baixada quando o modo 3D é usado.
  useEffect(() => {
    if (mode !== "3d" || glReady) return;
    let isMounted = true;
    import("echarts-gl").then(() => isMounted && setGlReady(true)).catch(() => isMounted && setMode("2d"));
    return () => {
      isMounted = false;
    };
  }, [mode, glReady]);

  useEffect(() => {
    let isMounted = true;
    fetch("/geo/BR_UF_2023_simplified.geojson")
      .then((response) => response.json())
      .then((data) => {
        // O mapa 3D lê o nome da propriedade "name"; o 2D aceita qualquer uma.
        // As ilhas oceânicas (Noronha, Trindade...) ficam a leste do continente e viram riscos soltos: saem do desenho.
        data.features.forEach((feature: GeoFeature) => {
          feature.properties.name = feature.properties.NM_UF;
          if (feature.geometry.type === "MultiPolygon") {
            const polygons = feature.geometry.coordinates as number[][][][];
            feature.geometry.coordinates = polygons.filter((polygon) => polygon[0].some(([lon]) => lon < EAST_OF_MAINLAND));
          }
        });
        echarts.registerMap("BR_UF", data);
        if (isMounted) setMapReady(true);
      })
      .catch(() => {
        if (isMounted) setMapReady(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // O fundo ocupa a faixa toda, mas o mapa fica entre a coluna de conteúdo e o painel, com respiro.
  // A altura do mapa vem da janela, não da faixa: abrir o perfil alonga o painel sem inflar o mapa.
  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const measure = () => {
      setWide(media.matches);
      const bandBox = band.current?.getBoundingClientRect();
      const panelBox = panel.current?.getBoundingClientRect();
      const columnBox = band.current?.parentElement?.getBoundingClientRect();
      const canvasBox = canvas.current?.getBoundingClientRect();
      if (bandBox && panelBox && columnBox && canvasBox) {
        const mapHeight = Math.max(380, Math.min(window.innerHeight * 0.8, 780) - 204);
        const top = Math.max(56, (bandBox.height - mapHeight - LEGEND_SPACE) / 2);
        setMapBox({
          left: Math.round(columnBox.left - bandBox.left),
          right: Math.round(bandBox.right - panelBox.left + 56),
          top: Math.round(top),
          bottom: Math.round(bandBox.height - top - mapHeight),
          width: Math.round(canvasBox.width),
          height: Math.round(canvasBox.height),
        });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (band.current) observer.observe(band.current);
    media.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
    };
  }, []);

  const data = useMemo(() => {
    const dates = Array.from(new Set(rows.map((row) => String(row.date)))).sort();
    const latestDate = dates.at(-1) ?? "";
    const previousDate = dates.at(-2) ?? "";
    const yearAgoDate = dates.at(-5) ?? "";
    const byDate = (date: string) => new Map(rows.filter((row) => row.date === date).map((row) => [String(row.uf), row]));
    const latest = byDate(latestDate);
    const previous = byDate(previousDate);
    const yearAgo = byDate(yearAgoDate);
    const profileByUf = new Map(profiles.map((row) => [String(row.uf), row]));
    const ibcSorted = [...ibcRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const ufs = Array.from(new Set([...latest.keys(), ...profileByUf.keys()])).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const valueOf = (uf: string, key: VariableKey) =>
      key === "pib_per_capita" ? numeric(profileByUf.get(uf)?.[key]) : numeric(latest.get(uf)?.[key]);
    // Posição 1 = melhor leitura entre as UFs com dado.
    const rank = (uf: string, key: VariableKey) => {
      const own = valueOf(uf, key);
      if (own == null) return null;
      const all = ufs.map((item) => valueOf(item, key)).filter((value): value is number => value != null);
      const better = variables[key].better === "low" ? all.filter((value) => value < own) : all.filter((value) => value > own);
      return { position: better.length + 1, total: all.length };
    };
    return { latestDate, latest, previous, yearAgo, profileByUf, ibcSorted, ufs, valueOf, rank };
  }, [rows, profiles, ibcRows]);

  const analysis = useMemo(() => {
    const values = data.ufs
      .map((uf) => ({
        name: uf,
        value: data.valueOf(uf, variable),
        previous: variable === "pib_per_capita" ? null : numeric(data.previous.get(uf)?.[variable]),
      }))
      .filter((row): row is { name: string; value: number; previous: number | null } => row.value != null)
      .sort((a, b) => b.value - a.value);
    const average = values.length ? values.reduce((acc, row) => acc + row.value, 0) / values.length : null;
    const rising = values.filter((row) => row.previous != null && row.value > row.previous).length;
    const falling = values.filter((row) => row.previous != null && row.value < row.previous).length;
    const reference = variable === "pib_per_capita"
      ? String(profiles[0]?.ano_pib ?? "")
      : data.latestDate ? quarterLabel(data.latestDate) : "n/d";
    return { values, average, highest: values.at(0) ?? null, lowest: values.at(-1) ?? null, rising, falling, reference };
  }, [data, variable, profiles]);

  const profile = useMemo(() => {
    if (!selected) return null;
    const base = data.profileByUf.get(selected);
    const now = data.latest.get(selected);
    const before = data.yearAgo.get(selected);
    const sigla = String(base?.sigla ?? "");
    const region = String(base?.regiao ?? "");
    const ownColumn = `ibc_${sigla.toLowerCase()}`;
    const hasOwnIbc = data.ibcSorted.some((row) => numeric(row[ownColumn]) != null);
    const ibc = ibc12m(data.ibcSorted, hasOwnIbc ? ownColumn : regionIbc[region] ?? "");
    const labor = pnadKeys.map((key) => {
      const value = numeric(now?.[key]);
      const old = numeric(before?.[key]);
      const unit = variables[key].unit;
      const change = value != null && old != null
        ? unit === "%" ? `${signed(value - old)} p.p. em 12 meses` : `${signed((value / old - 1) * 100)}% em 12 meses`
        : null;
      return { key, label: variables[key].label, value: formatValue(value, unit), change, rank: data.rank(selected, key) };
    });
    return { name: selected, sigla, region, base, labor, ibc, hasOwnIbc };
  }, [selected, data]);

  const min = Math.min(...analysis.values.map((row) => row.value));
  const max = Math.max(...analysis.values.map((row) => row.value));
  // Realce no próprio tom do estado, puxado para o verde da marca, em vez de uma cor externa.
  const ramp = [...sequentialGreenBlue];
  const share = (value: number) => (max > min ? (value - min) / (max - min) : 0);
  const colorOf = (value: number) => echarts.color.lerp(share(value), ramp) as string;
  const deepened = (value: number) => echarts.color.lerp(0.38, [colorOf(value), "#0d6b52"]) as string;
  const mapLeft = wide ? mapBox.left : 16;
  const legendBottom = wide ? mapBox.bottom - LEGEND_SPACE : 18;
  const show3d = mode === "3d" && glReady;

  const tooltip: EChartsOption["tooltip"] = {
    trigger: "item",
    formatter: (params) => {
      const item = Array.isArray(params) ? params[0] : params;
      const value = typeof item.value === "number" ? formatValue(item.value, variableConfig.unit) : "n/d";
      return `<strong>${item.name}</strong><br/>${variableConfig.label}: ${value}<br/><span style="color:#5b6f79">Clique para ver o perfil</span>`;
    },
  };

  // Relevo: a altura de cada estado acompanha o valor, e a cor repete a escala da legenda.
  // Sem zoom pela roda do mouse, para não prender a rolagem da página; arrastar gira o mapa.
  // A luz clareia as faces: o 3D começa a escala um pouco acima do tom mais claro para não estourar em branco.
  const color3d = (value: number) => echarts.color.lerp(0.15 + 0.85 * share(value), ramp) as string;
  const viewportTop = wide ? mapBox.top - 56 : 0;
  const option3d = {
    tooltip,
    visualMap: {
      show: true,
      min,
      max,
      text: [formatValue(max, variableConfig.unit), formatValue(min, variableConfig.unit)],
      left: mapLeft,
      bottom: legendBottom,
      orient: "horizontal",
      itemHeight: 200,
      itemWidth: 12,
      seriesIndex: [],
      inRange: { color: [0, 0.25, 0.5, 0.75, 1].map((step) => echarts.color.lerp(0.15 + 0.85 * step, ramp) as string) },
      textStyle: { color: "#3e535d", fontSize: 11 },
      formatter: (value: number) => formatValue(Number(value), variableConfig.unit),
    },
    series: [{
      name: variableConfig.label,
      type: "map3D",
      map: "BR_UF",
      left: wide ? mapLeft - 40 : 0,
      top: viewportTop,
      width: wide ? mapBox.width - mapLeft - mapBox.right + 80 : mapBox.width,
      // Vai até a descrição da legenda: a inclinação alonga o mapa para baixo.
      height: wide ? mapBox.height - viewportTop - (legendBottom + 62) : mapBox.height - 70,
      boxWidth: 100,
      regionHeight: 1.2,
      shading: "lambert",
      light: {
        // Sem sombra projetada: ela desenhava faixas escuras sobre os vizinhos dos estados mais altos.
        main: { intensity: 0.8, alpha: 40, beta: 30 },
        ambient: { intensity: 0.52 },
      },
      viewControl: {
        projection: "perspective",
        distance: 132,
        alpha: 52,
        // A perspectiva alonga o sul (mais perto da câmera); mirar um pouco ao sul recentra o mapa na tela.
        center: [0, 0, 12],
        beta: 0,
        minAlpha: 20,
        maxAlpha: 85,
        zoomSensitivity: 0,
        panSensitivity: 0,
        rotateSensitivity: 1,
        animationDurationUpdate: 600,
      },
      groundPlane: { show: false },
      label: { show: false },
      itemStyle: { borderWidth: 0.6, borderColor: "#f2f5f5" },
      emphasis: { label: { show: false } },
      data: analysis.values.map((row) => ({
        name: row.name,
        value: row.value,
        height: 1.2 + 7 * share(row.value),
        itemStyle: { color: row.name === selected ? deepened(row.value) : color3d(row.value) },
        emphasis: { itemStyle: { color: deepened(row.value) } },
        label: row.name === selected
          ? { show: true, distance: 3, textStyle: { color: "#0f2530", fontSize: 13, fontWeight: "bold", backgroundColor: "#ffffffd9", padding: [4, 8], borderRadius: 4 } }
          : undefined,
      })),
    }],
  } as unknown as EChartsOption;

  const option2d: EChartsOption = {
    tooltip,
    visualMap: {
      min,
      max,
      left: mapLeft,
      bottom: legendBottom,
      calculable: true,
      orient: "horizontal",
      itemHeight: 200,
      itemWidth: 12,
      inRange: { color: [...sequentialGreenBlue] },
      textStyle: { color: "#3e535d", fontSize: 11 },
      formatter: (value) => formatValue(Number(value), variableConfig.unit),
    },
    series: [{
      name: variableConfig.label,
      type: "map",
      map: "BR_UF",
      nameProperty: "NM_UF",
      left: mapLeft,
      right: wide ? mapBox.right : 16,
      top: wide ? mapBox.top : 16,
      bottom: wide ? mapBox.bottom : 84,
      selectedMode: "single",
      data: analysis.values.map((row) => ({
        name: row.name,
        value: row.value,
        selected: row.name === selected,
        emphasis: { itemStyle: { areaColor: deepened(row.value) } },
        select: { itemStyle: { areaColor: deepened(row.value) } },
      })),
      emphasis: {
        label: { show: false },
        itemStyle: { borderColor: "#0f2530", borderWidth: 1 },
      },
      select: {
        label: { show: true, color: "#ffffff", fontWeight: "bold", textBorderColor: "#0f2530", textBorderWidth: 2 },
        itemStyle: { borderColor: "#0f2530", borderWidth: 1.6 },
      },
      // Bordas na cor do fundo: os estados se separam sem contorno, como num mapa impresso.
      itemStyle: { borderColor: "#f2f5f5", borderWidth: 1.2 },
    }],
  };

  const onEvents = { click: (params: { name?: string }) => params.name && setSelected(params.name) };
  const ibcLabel = profile?.hasOwnIbc ? "Atividade (IBCR)" : `Atividade da região ${profile?.region} (IBCR)`;

  return (
    <>
      <section ref={band} className="uf-band" aria-label="Mapa interativo das unidades da Federação">
        <div ref={canvas} className="uf-band-canvas">
          {mapReady ? (
            <ReactECharts
              key={show3d ? "3d" : "2d"}
              option={show3d ? option3d : option2d}
              onEvents={onEvents}
              style={{ position: "absolute", inset: 0, height: "auto" }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="map-loading">Carregando mapa...</div>
          )}
          <p className="uf-band-legend" style={wide ? { left: mapLeft, bottom: legendBottom + 44 } : undefined}>{variableConfig.label} por UF, {analysis.reference}</p>
        </div>

        <div ref={panel} className="uf-band-panel">
          <span className="eyebrow">Brasil por UF</span>
          <h2><em>{variableConfig.label}</em> pelo Brasil</h2>
          <p className="uf-band-lead">
            A média entre as UFs é de <strong>{formatValue(analysis.average, variableConfig.unit)}</strong>.
            A maior leitura está em <strong>{analysis.highest?.name ?? "n/d"}</strong> ({formatValue(analysis.highest?.value, variableConfig.unit)})
            e a menor em <strong>{analysis.lowest?.name ?? "n/d"}</strong> ({formatValue(analysis.lowest?.value, variableConfig.unit)}).
            {variable !== "pib_per_capita" && ` Frente ao trimestre anterior, ${movement(analysis.rising, "subiu", "subiram")} e ${movement(analysis.falling, "caiu", "caíram")}.`}
          </p>
          <div className="uf-band-controls">
            <label>
              <span>Indicador</span>
              <select value={variable} onChange={(event) => setVariable(event.target.value as VariableKey)}>
                {Object.entries(variables).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Unidade da Federação</span>
              <select value={selected ?? ""} onChange={(event) => setSelected(event.target.value || null)}>
                <option value="">Selecionar UF</option>
                {data.ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>
          </div>
          <div className="uf-band-mode" role="group" aria-label="Visualização do mapa">
            {(["3d", "2d"] as const).map((item) => (
              <button key={item} type="button" className={mode === item ? "active" : ""} aria-pressed={mode === item} onClick={() => setMode(item)}>
                Mapa {item.toUpperCase()}
              </button>
            ))}
            {mode === "3d" && <small>Arraste para girar</small>}
          </div>
          <div className="uf-band-picks">
            {quickPicks.map((uf) => (
              <button key={uf} type="button" className={uf === selected ? "active" : ""} onClick={() => setSelected(uf)}>
                {uf}
              </button>
            ))}
          </div>

          {profile ? (
            <div className="uf-profile">
              <div className="uf-profile-head">
                <span className="uf-profile-badge">{profile.sigla}</span>
                <div>
                  <h3>{profile.name}</h3>
                  <small>Região {profile.region}</small>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Fechar perfil"><X size={15} /></button>
              </div>
              <dl className="uf-profile-grid">
                {profile.base && (
                  <>
                    <div>
                      <dt>População</dt>
                      <dd>{people(Number(profile.base.populacao))}</dd>
                      <small>projeção {String(profile.base.ano_populacao)}</small>
                    </div>
                    <div>
                      <dt>PIB</dt>
                      <dd>{money(Number(profile.base.pib))}</dd>
                      <small>{decimal(Number(profile.base.participacao_pib), 1)}% do Brasil · {String(profile.base.ano_pib)}</small>
                    </div>
                    <div>
                      <dt>PIB per capita</dt>
                      <dd>{formatValue(numeric(profile.base.pib_per_capita), "R$")}</dd>
                      <small>{String(profile.base.ano_pib)} · {rankText(data.rank(profile.name, "pib_per_capita"))}</small>
                    </div>
                  </>
                )}
                {profile.ibc && (
                  <div>
                    <dt>{ibcLabel}</dt>
                    <dd>{signed(profile.ibc.value)}%</dd>
                    <small>12 meses até {monthLabel(profile.ibc.date)}</small>
                  </div>
                )}
                {profile.labor.map((item) => (
                  <div key={item.key}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                    <small>{[item.change, rankText(item.rank)].filter(Boolean).join(" · ")}</small>
                  </div>
                ))}
              </dl>
              <p className="uf-profile-note">
                Trabalho: PNAD Contínua, {data.latestDate ? quarterLabel(data.latestDate) : "n/d"}. Ranking: 1º = melhor leitura entre as UFs.
              </p>
            </div>
          ) : (
            <p className="uf-band-hint">Clique em um estado para ver população, PIB, atividade e mercado de trabalho.</p>
          )}

          <div className="uf-band-footer">
            <small className="source-label">Fonte: IBGE e BCB (2026)</small>
            <button type="button" onClick={() => toggleFullscreen(band.current)} title="Tela cheia" aria-label="Tela cheia: mapa por UF">
              <Maximize2 size={13} /> Tela cheia
            </button>
          </div>
        </div>
      </section>
      <div className="uf-map-notes">
        <p>
          A leitura regional é útil porque o mercado de trabalho brasileiro não se ajusta de forma uniforme. Estados com desemprego
          ou informalidade acima da média tendem a sinalizar maior ociosidade, menor proteção trabalhista e renda mais vulnerável.
          Já ocupação e rendimento real mais elevados costumam indicar maior dinamismo local, embora devam ser avaliados junto com
          inflação, composição setorial e qualidade dos postos criados.
        </p>
        <p>
          Em termos conjunturais, altas de renda e ocupação são sinais positivos quando ocorrem sem avanço simultâneo da informalidade.
          Quando o desemprego cai, mas a informalidade sobe, a melhora pode ser mais frágil, pois depende de vínculos de menor
          estabilidade e menor capacidade de sustentação do consumo.
        </p>
      </div>
    </>
  );
}
