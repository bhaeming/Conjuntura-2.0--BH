"""
Deck "Pós-eleição: temas econômicos para 2027" (v4) no padrão Observatório FIESC.

Lê data/deck_pos_eleicao/series.json (src/deck_pos_eleicao_dados.py) e
data/deck_pos_eleicao/mcp_snapshot.json (consultas ao MCP do Observatório), educacao.json
(src/deck_pos_eleicao_educacao.py), estrutura.json (src/deck_pos_eleicao_estrutura.py) e
relatorios.json (números transcritos do RPM e do Ipea) e gera
docs_provisorio/Pós-eleição 2027 - Temas econômicos v4.pptx com gráficos nativos.

    python src/deck_pos_eleicao_v4.py
"""
import json
import sys
from pathlib import Path

from lxml import etree
from pptx.chart.data import XyChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION, XL_MARKER_STYLE
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

sys.path.insert(0, str(Path.home() / ".claude" / "skills" / "observatorio-fiesc-deck" / "scripts"))
from obs_deck import BLUE, BLUE_L, GRAY, GRID, INK, MUTED, ObsDeck, _tick_low, num_br, var_br  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DADOS = ROOT / "data" / "deck_pos_eleicao"
SAIDA = ROOT / "docs_provisorio" / "Pós-eleição 2027 - Temas econômicos v4.pptx"

S = json.load(open(DADOS / "series.json", encoding="utf-8"))
M = json.load(open(DADOS / "mcp_snapshot.json", encoding="utf-8"))
E = json.load(open(DADOS / "educacao.json", encoding="utf-8"))  # src/deck_pos_eleicao_educacao.py
X = json.load(open(DADOS / "estrutura.json", encoding="utf-8"))  # src/deck_pos_eleicao_estrutura.py
R = json.load(open(DADOS / "relatorios.json", encoding="utf-8"))
RPM, IPEA = R["rpm_set26"], R["ipea_cc72_3t26"]
BM = {k: v["valores"] for k, v in X["banco_mundial"].items() if not k.startswith("_")}
NOMES_BM = {"KOR": "Coreia do Sul", "USA": "EUA", "JPN": "Japão", "DEU": "Alemanha", "OED": "OCDE", "WLD": "Mundo",
            "CHN": "China", "POL": "Polônia", "TUR": "Turquia", "BRA": "Brasil", "CHL": "Chile", "MEX": "México",
            "IND": "Índia", "IDN": "Indonésia", "COL": "Colômbia", "ZAF": "África do Sul", "UMC": "Renda média-alta"}
SGS, FOCUS, SIDRA, PIPE = S["sgs"], S["focus"], S["sidra"], S["pipeline"]

MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
C_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


# ── utilidades ────────────────────────────────────────────────────────────────
def mes(d):
    """'2026-08-01' ou '202608' -> 'ago/26'."""
    d = d.replace("-", "")
    return f"{MESES[int(d[4:6]) - 1]}/{d[2:4]}"


def tri(d):
    """'2026-06-30' -> '2T26'; '202602' (AAAATT) -> '2T26'."""
    if "-" in d:
        return f"{(int(d[5:7]) - 1) // 3 + 1}T{d[2:4]}"
    return f"{int(d[4:6])}T{d[2:4]}"


def fonte(*inst, ano=2026):
    """Rodapé no formato (INSTITUIÇÃO, ANO), com a instituição em maiúsculas."""
    itens = [f"({i.upper()}, {ano})" for i in inst] + [f"(OBSERVATÓRIO FIESC, {ano})"]
    return ", ".join(itens[:-1]) + " e " + itens[-1]


def posicionar(slide, nome, x=None, y=None, w=None, h=None):
    """Ajuste fino de posição/tamanho (EMU) de um shape, como editado à mão no deck."""
    sh = next(s for s in slide.shapes if s.name == nome)
    for attr, v in (("left", x), ("top", y), ("width", w), ("height", h)):
        if v is not None:
            setattr(sh, attr, Emu(v))


def br(x, nd=1):
    return num_br(x, nd)


def mensal(serie, ini=None, fim=None):
    """dict data->valor (diário ou mensal) -> último valor de cada mês."""
    out = {}
    for d in sorted(serie):
        if (ini and d < ini) or (fim and d > fim):
            continue
        out[d[:7]] = serie[d]
    return out


def focus(ind, ano):
    return FOCUS[ind][str(ano)]


def T(texto):
    """Título inteiro em azul."""
    return ("", texto)


# ── ajustes de gráfico ────────────────────────────────────────────────────────
def grafico_de(slide):
    return next(s for s in slide.shapes if s.name == "grafico").chart


def ajustar(slide, *, sem_marcador=True, pular=None, eixo_fmt=None, cores=None, tracejadas=(),
            rotulo_ultimo=None, legenda=True, sobrepor=False, eixo_min=None, eixo_max=None, passo=None):
    ch = grafico_de(slide)
    ch.has_title = False
    plot = ch.plots[0]
    tipo_linha = ch.chart_type in (XL_CHART_TYPE.LINE_MARKERS, XL_CHART_TYPE.LINE)
    if not legenda:
        ch.has_legend = False
    for i, ser in enumerate(plot.series):
        if cores:
            cor = RGBColor.from_string(cores[i])
            if tipo_linha:
                ser.format.line.color.rgb = cor
            else:
                ser.format.fill.solid()
                ser.format.fill.fore_color.rgb = cor
        if tipo_linha and sem_marcador:
            ser.marker.style = XL_MARKER_STYLE.NONE
        if i in tracejadas:
            ser.format.line.dash_style = MSO_LINE_DASH_STYLE.DASH
            ser.format.line.width = Pt(1.5)
    if rotulo_ultimo is not None:
        _rotular_ultimo(ch, rotulo_ultimo, cores)
    if pular:
        _pular_rotulos(ch, pular)
    if eixo_fmt:
        ch.value_axis.tick_labels.number_format = eixo_fmt
        ch.value_axis.tick_labels.number_format_is_linked = False
    if eixo_min is not None:
        ch.value_axis.minimum_scale = eixo_min
    if eixo_max is not None:
        ch.value_axis.maximum_scale = eixo_max
    if passo is not None:
        ch.value_axis.major_unit = passo
    if sobrepor:
        plot.overlap = 100
        plot.gap_width = 40
    return ch


def _rotular_ultimo(ch, series_idx, cores):
    """Rótulo só no último valor não nulo das séries indicadas (lista de índices)."""
    for i, ser in enumerate(ch.plots[0].series):
        for dls in ser._element.findall(qn("c:dLbls")):
            ser._element.remove(dls)
        if i not in series_idx:
            continue
        vals = list(ser.values)
        k = max(j for j, v in enumerate(vals) if v is not None)
        dl = ser.points[k].data_label
        dl.has_text_frame = False
        dl.position = XL_LABEL_POSITION.RIGHT if k == len(vals) - 1 else XL_LABEL_POSITION.ABOVE
        dl.font.size, dl.font.bold = Pt(8), True
        cor = cores[i] if cores else (BLUE if i == len(ch.plots[0].series) - 1 else BLUE_L)
        dl.font.color.rgb = RGBColor.from_string(cor)
        d = dl._get_or_add_dLbl()
        for tag in ("c:showLegendKey", "c:showVal", "c:showCatName", "c:showSerName", "c:showPercent",
                    "c:showBubbleSize"):
            e = d.find(qn(tag))
            if e is None:
                e = etree.SubElement(d, qn(tag))
            e.set("val", "1" if tag == "c:showVal" else "0")


def rotular_pontos(ch, pontos, posicao=XL_LABEL_POSITION.OUTSIDE_END):
    """Rótulos de dados só nos pontos indicados: lista de (índice da série, índice do ponto, cor)."""
    for ser in ch.plots[0].series:
        for dls in ser._element.findall(qn("c:dLbls")):
            ser._element.remove(dls)
    series = list(ch.plots[0].series)
    for i, k, cor in pontos:
        dl = series[i].points[k].data_label
        dl.has_text_frame = False
        dl.position = posicao
        dl.font.size, dl.font.bold = Pt(8), True
        dl.font.color.rgb = RGBColor.from_string(cor)
        d = dl._get_or_add_dLbl()
        for tag in ("c:showLegendKey", "c:showVal", "c:showCatName", "c:showSerName", "c:showPercent",
                    "c:showBubbleSize"):
            e = d.find(qn(tag))
            if e is None:
                e = etree.SubElement(d, qn(tag))
            e.set("val", "1" if tag == "c:showVal" else "0")


def _sppr(ser, fill=None, linha=None, largura=1.5, traco=None):
    """Substitui o spPr da série: fill (hex ou None = sem preenchimento) e linha (hex ou None = sem linha)."""
    old = ser.find(qn("c:spPr"))
    novo = etree.Element(qn("c:spPr"))
    if fill:
        etree.SubElement(etree.SubElement(novo, qn("a:solidFill")), qn("a:srgbClr"), val=fill)
    else:
        etree.SubElement(novo, qn("a:noFill"))
    ln = etree.SubElement(novo, qn("a:ln"), w=str(int(largura * 12700)))
    if linha:
        etree.SubElement(etree.SubElement(ln, qn("a:solidFill")), qn("a:srgbClr"), val=linha)
        if traco:
            etree.SubElement(ln, qn("a:prstDash"), val=traco)
    else:
        etree.SubElement(ln, qn("a:noFill"))
    if old is not None:
        old.addprevious(novo)
        old.getparent().remove(old)
    else:
        ser.find(qn("c:tx")).addnext(novo)


def mover_series(ch, idxs, tipo):
    """Move séries do grupo principal para um novo grupo 'linha' (à frente) ou 'area' empilhada (ao fundo),
    nos mesmos eixos — gráfico combinado nativo. Devolve as séries movidas, na ordem de idxs."""
    grupo = ch.plots[0]._element
    eixos = [e.get("val") for e in grupo.findall(qn("c:axId"))]
    novo = etree.Element(qn("c:lineChart" if tipo == "linha" else "c:areaChart"))
    etree.SubElement(novo, qn("c:grouping"), val="standard" if tipo == "linha" else "stacked")
    etree.SubElement(novo, qn("c:varyColors"), val="0")
    series = grupo.findall(qn("c:ser"))
    movidas = []
    for i in idxs:
        ser = series[i]
        grupo.remove(ser)
        tirar = ("c:invertIfNegative", "c:shape", "c:pictureOptions", "c:dLbls", "c:marker", "c:smooth")
        for tag in tirar:
            for e in ser.findall(qn(tag)):
                ser.remove(e)
        if tipo == "linha":
            mk = etree.Element(qn("c:marker"))
            etree.SubElement(mk, qn("c:symbol"), val="none")
            ancora = ser.find(qn("c:spPr"))
            (ancora if ancora is not None else ser.find(qn("c:tx"))).addnext(mk)
            etree.SubElement(ser, qn("c:smooth"), val="0")
        novo.append(ser)
        movidas.append(ser)
    if tipo == "linha":
        etree.SubElement(novo, qn("c:marker"), val="1")
    for a in eixos:
        etree.SubElement(novo, qn("c:axId"), val=a)
    if tipo == "area":
        grupo.addprevious(novo)
    else:
        grupo.addnext(novo)
    return movidas


def esconder_na_legenda(ch, idxs):
    leg = ch._chartSpace.find(f".//{{{C_NS}}}legend")
    pos = leg.find(qn("c:legendPos"))
    for i in sorted(idxs, reverse=True):
        le = etree.Element(qn("c:legendEntry"))
        etree.SubElement(le, qn("c:idx"), val=str(i))
        etree.SubElement(le, qn("c:delete"), val="1")
        pos.addnext(le)


def tabela_componentes(slide, x, y, larguras, cabecalho, linhas, destaque_ultima=True, alt=0.27, alt_cab=None,
                       azuis=None, esquerda=1, destaque=None):
    """Tabela nativa limpa: sem preenchimento, cabeçalho azul com linha inferior, divisórias cinza e
    última linha (total) em negrito com linha superior. `azuis`: colunas em azul (padrão: as duas últimas);
    com azuis=() a linha de total fica em azul. `esquerda`: nº de colunas iniciais alinhadas à esquerda;
    `destaque`: rótulo de uma linha a realçar em azul."""
    from obs_deck import _borda
    n, m = len(linhas) + 1, len(cabecalho)
    alt_cab = alt_cab or alt
    azuis = {m - 2, m - 1} if azuis is None else set(azuis)
    gf = slide.shapes.add_table(n, m, Inches(x), Inches(y), Inches(sum(larguras)), Inches(alt_cab + alt * (n - 1)))
    gf.name = "tabela_componentes"
    tbl = gf.table
    tblPr = tbl._tbl.tblPr
    tblPr.set("firstRow", "0")
    tblPr.set("bandRow", "0")
    sid = tblPr.find(qn("a:tableStyleId"))
    if sid is not None:
        tblPr.remove(sid)
    for j, w in enumerate(larguras):
        tbl.columns[j].width = Inches(w)
    for i, lin in enumerate([cabecalho] + linhas):
        tbl.rows[i].height = Inches(alt_cab if i == 0 else alt)
        total = destaque_ultima and i == n - 1
        for j, txt in enumerate(lin):
            c = tbl.cell(i, j)
            c.fill.background()
            c.margin_left = c.margin_right = Inches(0.05 if j < esquerda else 0.02)
            c.margin_top = c.margin_bottom = 0
            c.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = c.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT if j < esquerda else PP_ALIGN.RIGHT
            r = p.add_run()
            r.text = txt
            realce = destaque is not None and destaque in lin
            negrito = i == 0 or total or realce
            r.font.size = Pt(8.5)
            r.font.name = "Montserrat SemiBold" if negrito else "Montserrat"
            azul = i == 0 or j in azuis or ((total or realce) and not azuis)
            r.font.color.rgb = RGBColor.from_string(BLUE if azul else INK)
            for lado in ("L", "R"):
                _borda(c, lado)
            _borda(c, "T", INK if total else None, 9525)
            _borda(c, "B", BLUE if i == 0 else (GRID if i < n - 1 else None), 9525 if i == 0 else 6350)
    return gf


def _pular_rotulos(ch, n):
    ax = ch.category_axis._element
    for tag in ("c:tickLblSkip", "c:tickMarkSkip"):
        old = ax.find(qn(tag))
        if old is not None:
            ax.remove(old)
    ancora = ax.find(qn("c:noMultiLvlLbl"))
    for tag in ("c:tickLblSkip", "c:tickMarkSkip"):
        e = etree.Element(qn(tag), val=str(n))
        if ancora is not None:
            ancora.addprevious(e)
        else:
            ax.append(e)


def dispersao(slide, pontos, destaque, tendencia, rotulo_destaque, *, nomes=("UFs", "Santa Catarina", "Tendência linear"),
              eixo_x=(0, 160), eixo_y=(-1.5, 3.0), fmt_y="#,##0.0", rotulos=()):
    """Troca o gráfico do slide por um XY nativo: pontos em cinza, destaque em azul, tendência tracejada.
    `rotulos`: [(índice do ponto cinza, texto, posição)] para nomear pontos de referência."""
    antigo = next(s for s in slide.shapes if s.name == "grafico")
    rid = antigo._element.find(f".//{{{C_NS}}}chart").get(qn("r:id"))
    x, y, w, h = antigo.left, antigo.top, antigo.width, antigo.height
    antigo._element.getparent().remove(antigo._element)
    slide.part.drop_rel(rid)

    cd = XyChartData()
    s1 = cd.add_series(nomes[0])
    for px, py in pontos:
        s1.add_data_point(px, py)
    s2 = cd.add_series(nomes[1])
    s2.add_data_point(*destaque)
    s3 = cd.add_series(nomes[2])
    for px, py in tendencia:
        s3.add_data_point(px, py)
    gf = slide.shapes.add_chart(XL_CHART_TYPE.XY_SCATTER, x, y, w, h, cd)
    gf.name = "grafico"
    ch = gf.chart
    ch.has_title = False
    ch.font.name, ch.font.size = "Montserrat", Pt(8)
    ch.font.color.rgb = RGBColor.from_string(INK)
    ch.has_legend = True
    ch.legend.position = XL_LEGEND_POSITION.BOTTOM
    ch.legend.include_in_layout = False
    for ser, cor, tam in zip(ch.plots[0].series, (GRAY, BLUE, BLUE_L), (6, 9, 0)):
        ser.format.line.fill.background()
        if tam:
            ser.marker.style = XL_MARKER_STYLE.CIRCLE
            ser.marker.size = tam
            ser.marker.format.fill.solid()
            ser.marker.format.fill.fore_color.rgb = RGBColor.from_string(cor)
            ser.marker.format.line.color.rgb = RGBColor.from_string(cor)
        else:
            ser.marker.style = XL_MARKER_STYLE.NONE
            ser.format.line.color.rgb = RGBColor.from_string(cor)
            ser.format.line.width = Pt(1.5)
            ser.format.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    dl = ch.plots[0].series[1].points[0].data_label
    dl.has_text_frame = True
    run = dl.text_frame.paragraphs[0].add_run()
    run.text = rotulo_destaque
    run.font.size, run.font.bold = Pt(9), True
    run.font.color.rgb = RGBColor.from_string(BLUE)
    dl.position = XL_LABEL_POSITION.RIGHT
    for i, txt, pos in rotulos:
        dl = ch.plots[0].series[0].points[i].data_label
        dl.has_text_frame = True
        run = dl.text_frame.paragraphs[0].add_run()
        run.text = txt
        run.font.size = Pt(7.5)
        run.font.color.rgb = RGBColor.from_string(MUTED)
        dl.position = pos
    for ax in (ch.category_axis, ch.value_axis):
        ax.has_major_gridlines = False
        ax.format.line.color.rgb = RGBColor.from_string(GRID)
        ax.tick_labels.font.size = Pt(8)
        ax.tick_labels.number_format, ax.tick_labels.number_format_is_linked = "#,##0", False
    ch.value_axis.tick_labels.number_format = fmt_y
    ch.value_axis.minimum_scale, ch.value_axis.maximum_scale = eixo_y
    _tick_low(ch.category_axis)
    ch.category_axis.minimum_scale, ch.category_axis.maximum_scale = eixo_x
    return ch


def tendencia_linear(xs, ys, x0, x1):
    """Extremos da reta de MQO e a correlação de Pearson."""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    sxx, syy = sum((a - mx) ** 2 for a in xs), sum((b - my) ** 2 for b in ys)
    beta = sxy / sxx
    return [(x0, my + beta * (x0 - mx)), (x1, my + beta * (x1 - mx))], sxy / (sxx * syy) ** 0.5


def titulo_negrito(slide, negrito, resto):
    """Título em azul com a abertura em negrito (padrão das edições manuais do deck)."""
    tf = next(sh for sh in slide.shapes if sh.name == "titulo").text_frame
    p = tf.paragraphs[0]
    for r in list(p.runs):
        p._p.remove(r._r)
    for txt, b in ((negrito, True), (resto, False)):
        r = p.add_run()
        r.text = txt
        r.font.size, r.font.bold, r.font.name = Pt(20), b, "Montserrat"
        r.font.color.rgb = RGBColor.from_string(BLUE)


def rotular_texto(ch, serie, pontos, cor=MUTED):
    """Rótulos de texto livre em pontos de uma série: [(índice do ponto, texto)]."""
    ser = ch.plots[0].series[serie]
    for k, txt in pontos:
        dl = ser.points[k].data_label
        dl.has_text_frame = True
        run = dl.text_frame.paragraphs[0].add_run()
        run.text = txt
        run.font.size = Pt(7.5)
        run.font.color.rgb = RGBColor.from_string(cor)
        dl.position = XL_LABEL_POSITION.ABOVE


def realcar_barras(slide, destaques, referencias=()):
    """Barras de uma série em cinza, referências (agregados) em azul-claro e destaques em azul."""
    ch = grafico_de(slide)
    ch.has_legend = ch.has_title = False
    ch.plots[0].vary_by_categories = False
    ser = ch.plots[0].series[0]
    for i in range(len(list(ser.values))):
        cor = BLUE if i in destaques else (BLUE_L if i in referencias else GRAY)
        pt = ser.points[i]
        pt.format.fill.solid()
        pt.format.fill.fore_color.rgb = RGBColor.from_string(cor)
        dl = pt.data_label
        dl.font.size, dl.font.bold = Pt(8), i in destaques
        dl.font.color.rgb = RGBColor.from_string(BLUE if i in destaques else INK)


def anos_bm(ranking):
    """Nota com o ano de referência de cada país num ranking do Banco Mundial."""
    from collections import Counter
    comum = Counter(r[2] for r in ranking).most_common(1)[0][0]
    outros = sorted({r[2] for r in ranking} - {comum})
    partes = [f"{', '.join(r[0] for r in ranking if r[2] == a)}, {a}" for a in outros]
    return f"Banco Mundial, {comum}" + (f" ({'; '.join(partes)})" if partes else "")


def ranking_bm(indicador, isos):
    """Último valor do Banco Mundial para os países indicados, do maior para o menor."""
    v = BM[indicador]
    return sorted(((NOMES_BM[i], v[i]["valor"], v[i]["ano"]) for i in isos if i in v), key=lambda r: -r[1])


def painel_ranking(slide, texto_y, tab_x, larguras, cabecalho, linhas, destaque=None, alt=0.2):
    """Lado direito dos slides de formação: texto curto no topo e tabela-ranking abaixo."""
    posicionar(slide, "texto", x=Inches(tab_x), y=Inches(1.30), w=Inches(sum(larguras)), h=Inches(texto_y - 1.35))
    tx = next(sh for sh in slide.shapes if sh.name == "texto")
    for p in tx.text_frame.paragraphs:  # texto curto: justificado abre espaços demais
        p.alignment = PP_ALIGN.LEFT
    tabela_componentes(slide, tab_x, texto_y, larguras, cabecalho, linhas, alt=alt, alt_cab=0.36, azuis=(),
                       destaque=destaque)


def colunas_sintese(slide, esquerda, direita, fonte_txt=None):
    """Acrescenta cabeçalho às colunas da síntese e, opcionalmente, o rodapé de fonte."""
    for nome, cab in (("coluna_esq", esquerda), ("coluna_dir", direita)):
        sh = next(s for s in slide.shapes if s.name == nome)
        txb = sh.text_frame._txBody
        p0 = txb.findall(qn("a:p"))[0]
        novo = etree.Element(qn("a:p"))
        ppr = p0.find(qn("a:pPr"))
        if ppr is not None:
            novo.append(etree.fromstring(etree.tostring(ppr)))
        r = etree.SubElement(novo, qn("a:r"))
        rpr = etree.SubElement(r, qn("a:rPr"), lang="pt-BR", sz="1300", b="0", dirty="0")
        sf = etree.SubElement(rpr, qn("a:solidFill"))
        etree.SubElement(sf, qn("a:srgbClr"), val=BLUE)
        etree.SubElement(rpr, qn("a:latin"), typeface="Montserrat SemiBold")
        etree.SubElement(r, qn("a:t")).text = cab
        p0.addprevious(novo)
    if fonte_txt:
        tb = slide.shapes.add_textbox(Inches(1.95), Inches(5.17), Inches(6.10), Inches(0.25))
        tb.name = "fonte"
        p = tb.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        run = p.add_run()
        run.text = fonte_txt
        run.font.size, run.font.name = Pt(8), "Montserrat"
        run.font.color.rgb = RGBColor.from_string(MUTED)


def padronizar(prs, tamanho_titulo=20):
    """Títulos em tamanho único, rodapé de fonte em uma linha e número das seções em Montserrat 215 pt."""
    for slide in prs.slides:
        for sh in slide.shapes:
            if sh.name == "titulo":
                for r in sh._element.iter(qn("a:rPr")):
                    r.set("sz", str(tamanho_titulo * 100))
            elif sh.name == "fonte":
                sh.left, sh.width = Inches(0.75), Inches(8.5)
            elif sh.name == "secao_numero":
                sh.height = Emu(3377817)
                for r in sh._element.iter(qn("a:rPr")):
                    r.set("sz", "21500")
                    for tag in ("a:latin", "a:ea", "a:cs", "a:sym"):
                        el = r.find(qn(tag))
                        if el is not None:
                            el.set("typeface", "Montserrat")


def sem_efeitos(prs):
    """Remove sombras e efeitos de todos os slides e gráficos; gráficos sem borda e sem fundo."""
    for slide in prs.slides:
        for el in slide._element.iter(f"{{{A_NS}}}effectLst"):
            for filho in list(el):
                el.remove(filho)
        for sh in slide.shapes:
            if getattr(sh, "has_chart", False) and sh.has_chart:
                cs = sh.chart._chartSpace
                for el in cs.iter(f"{{{A_NS}}}effectLst"):
                    for filho in list(el):
                        el.remove(filho)
                for el in list(cs.iter(f"{{{A_NS}}}outerShdw")):
                    el.getparent().remove(el)
                sppr = cs.find(qn("c:spPr"))
                if sppr is None:
                    sppr = etree.SubElement(cs, qn("c:spPr"))
                    txpr = cs.find(qn("c:txPr"))
                    if txpr is not None:
                        txpr.addprevious(sppr)
                for filho in list(sppr):
                    sppr.remove(filho)
                etree.SubElement(sppr, qn("a:noFill"))
                ln = etree.SubElement(sppr, qn("a:ln"))
                etree.SubElement(ln, qn("a:noFill"))
                rc = cs.find(qn("c:roundedCorners"))
                if rc is None:  # ordem do schema: date1904, lang, roundedCorners, style, ..., chart
                    rc = etree.Element(qn("c:roundedCorners"))
                    antes = [e for e in (cs.find(qn("c:date1904")), cs.find(qn("c:lang"))) if e is not None]
                    if antes:
                        antes[-1].addnext(rc)
                    else:
                        cs.insert(0, rc)
                rc.set("val", "0")


# ── dados derivados ───────────────────────────────────────────────────────────
CNT = SIDRA["cnt_4t"]
pib_anual = {int(k[:4]): v for k, v in CNT["PIB"].items() if k.endswith("04")}
ult_tri = max(CNT["PIB"])

ipca = SGS["ipca_12m"]
selic_m = mensal(SGS["selic_meta"])
ptax_m = mensal(SGS["ptax_media_mensal"])
ptax_d = SGS["ptax_diaria"]
ult_ptax_dia = max(ptax_d)


def main():
    deck = ObsDeck()
    deck.capa("Pós-eleição: temas econômicos",
              "O que observar na economia e na indústria em 2027", "Outubro de 2026")

    s = deck.sintese(T("Roteiro da apresentação"),
                     esquerda=[("01 Cenário externo.", "Crescimento mundial, risco geopolítico, petróleo, câmbio e comércio exterior de SC."),
                               ("02 Atividade, indústria e emprego.", "PIB, produção industrial, Santa Catarina e mercado de trabalho."),
                               ("03 Inflação, juros e consumo.", "Política monetária, juro real, endividamento e consumo das famílias.")],
                     direita=[("04 Contas públicas.", "Resultado primário de 2027 e trajetória da dívida."),
                              ("05 Longo prazo.", "Demografia, produtividade, investimento, indústria, formação e inovação."),
                              ("06 Agenda 2027.", "O que acompanhar, balanço de riscos e mensagens finais.")])
    for nome in ("coluna_esq", "coluna_dir"):  # roteiro em 14 pt
        for r in next(sh for sh in s.shapes if sh.name == nome)._element.iter(qn("a:rPr")):
            r.set("sz", "1400")

    # ── 01 Cenário externo ────────────────────────────────────────────────────
    deck.secao("01", "Cenário", "externo")

    w = M["weo_pib"]
    regs = ["Mundo", "EUA", "Área do euro", "China", "América Latina", "Brasil"]
    ix = {a: i for i, a in enumerate(w["anos"])}
    s = deck.grafico(
        titulo=T("Economia mundial desacelera em 2026, sem recessão"),
        grafico_titulo="Crescimento do PIB real (2025-2027*)",
        unidade="Variação anual, em %",
        grafico=dict(tipo="colunas", categorias=regs, formato="0.0",
                     series={str(a) + ("*" if a > 2025 else ""): [w[r][ix[a]] for r in regs] for a in (2025, 2026, 2027)}),
        texto=[f"O FMI projeta crescimento mundial de **{br(w['Mundo'][ix[2026]])}% em 2026**, após "
               f"{br(w['Mundo'][ix[2025]])}% em 2025, e retomada para **{br(w['Mundo'][ix[2027]])}% em 2027**. "
               "Choque de energia e juros globais mais altos explicam a perda de ritmo.",
               f"A **China** desacelera ({br(w['China'][ix[2026]])}% e {br(w['China'][ix[2027]])}%) e a América Latina "
               f"cresce perto de {br(w['América Latina'][ix[2026]])}%. Para o Brasil, o Fundo projeta "
               f"{br(w['Brasil'][ix[2026]])}% e {br(w['Brasil'][ix[2027]])}%.",
               "O comércio mundial deve crescer **3,5% em 2026**, abaixo dos 5,0% de 2025."],
        nota="* Projeções do World Economic Outlook de outubro de 2026. Agregados ponderados por paridade do poder de compra.",
        fonte=fonte("FMI", "Ipea"))
    ajustar(s, cores=[GRAY, BLUE_L, BLUE])

    g = X["gpr"]["mensal"]
    meses_g = sorted(g)
    ano_g = meses_g[-1][:4]
    media_ano = sum(g[m] for m in meses_g if m[:4] == ano_g) / sum(1 for m in meses_g if m[:4] == ano_g)
    media_hist = sum(g[m] for m in meses_g if m < "2020") / sum(1 for m in meses_g if m < "2020")
    episodios = {"2001-10": "11 de Setembro", "2003-03": "Iraque", "2022-03": "Ucrânia", "2026-03": "Oriente Médio"}
    pico = max((m for m in meses_g if m[:4] == ano_g), key=lambda m: g[m])
    s = deck.grafico(
        titulo=T("Risco geopolítico no maior nível em mais de 20 anos"),
        grafico_titulo=f"Índice de risco geopolítico ({mes(meses_g[0])}-{mes(meses_g[-1])})",
        unidade="Média de 1985-2019 = 100",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_g], formato="#,##0",
                     series={"Média histórica": [100] * len(meses_g), "Risco geopolítico": [g[m] for m in meses_g]}),
        texto=[f"Com o conflito no Oriente Médio, o índice chegou a **{br(g[pico], 0)} pontos em {mes(pico)}**, o maior "
               f"nível desde a Guerra do Iraque e acima do pico da invasão da Ucrânia ({br(g['2022-03'], 0)}).",
               f"A média de {ano_g} é de **{br(media_ano, 0)} pontos**, quase o dobro da de 2000-2019 "
               f"({br(media_hist, 0)}).",
               "Mais risco geopolítico significa mais **incerteza**, prêmios de risco e preços de energia: é o pano de "
               "fundo do choque do petróleo."],
        nota="Índice calculado pela frequência de notícias sobre tensões, ameaças e atos de guerra em 10 jornais internacionais.",
        fonte=fonte("Caldara e Iacoviello"))
    ch = ajustar(s, pular=36, rotulo_ultimo=[1], cores=[GRAY, BLUE], tracejadas=(0,), eixo_fmt="#,##0")
    rotular_texto(ch, 1, [(meses_g.index(m), txt) for m, txt in episodios.items()])

    b = M["brent"]
    s = deck.grafico(
        titulo=T("Petróleo volta a superar US$ 100 com o conflito"),
        grafico_titulo=f"Preço do petróleo Brent ({mes(b['periodos'][0])}-{mes(b['periodos'][-1])})",
        unidade="US$ por barril, média mensal",
        grafico=dict(tipo="linhas", categorias=[mes(p) for p in b["periodos"]], formato="0.0",
                     series={"Brent": b["valores"]}, eixo_min=50, eixo_max=110),
        texto=[f"O conflito envolvendo EUA, Israel e Irã levou o **Brent de US$ {br(b['valores'][-8], 0)} em fevereiro "
               f"para US$ {br(b['valores'][-1], 0)} em setembro**. A EIA elevou o preço médio esperado para "
               "**US$ 96 em 2026** e US$ 84 em 2027.",
               "Com a inflação de energia, o **Fed subiu os juros para 3,75%-4,00%** em setembro, a primeira alta "
               "desde 2023, e o título de 10 anos dos EUA chegou a 5%.",
               "Para o Brasil, petróleo mais caro **melhora os termos de troca**, mas pressiona combustíveis, fretes e fertilizantes."],
        fonte=fonte("FMI", "Ipea"))
    ajustar(s, pular=3, legenda=False, rotulo_ultimo=[0], cores=[BLUE])

    meses_ptax = sorted(ptax_m)
    pico = max(meses_ptax, key=lambda k: ptax_m[k])
    dias = sorted(ptax_d)
    d_ant = dias[-2]
    s = deck.grafico(
        titulo=T("Câmbio resiste ao choque externo, mas oscila na eleição"),
        grafico_titulo=f"Taxa de câmbio ({mes(meses_ptax[0])}-{mes(meses_ptax[-1])})",
        unidade="R$/US$, média mensal da PTAX de venda",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_ptax], formato="0.00",
                     series={"R$/US$": [ptax_m[m] for m in meses_ptax]}, eixo_min=4, eixo_max=6.5),
        texto=[f"Após o pico de **R$ {br(ptax_m[pico], 2)} em {mes(pico)}**, o real se apreciou e ficou estável durante "
               f"o conflito, com média de R$ {br(ptax_m[meses_ptax[-1]], 2)} em {mes(meses_ptax[-1])}. Como **moeda de "
               "commodity**, ganha com a alta do petróleo e amortece o repasse do choque externo.",
               f"Em outubro, o câmbio oscilou com o calendário eleitoral: na primeira sessão após o 2º turno "
               f"({ult_ptax_dia[8:10]}/{ult_ptax_dia[5:7]}), a PTAX foi a **R$ {br(ptax_d[ult_ptax_dia], 2)}** "
               f"({var_br((ptax_d[ult_ptax_dia] / ptax_d[d_ant] - 1) * 100)}% no dia).",
               f"O Focus de 23/10, anterior ao 2º turno, projetava **R$ {br(focus('Câmbio', 2026), 2)} no fim de 2026**."],
        fonte=fonte("BCB", "Ipea"))
    ajustar(s, pular=6, legenda=False, rotulo_ultimo=[0], cores=[BLUE], eixo_fmt="#,##0.0")

    cx, cm = M["comex_sc_anual"], M["comex_sc_mensal"]
    anos_cx = [a for a in cx["anos"] if a >= 2005]
    sub = slice(cx["anos"].index(2005), None)
    exp_ys = sum(cm["exportacao_2026"]) / 1e9
    exp_ys0 = sum(cm["exportacao_2025"][:len(cm["exportacao_2026"])]) / 1e9
    imp_ys = sum(cm["importacao_2026"]) / 1e9
    imp_ys0 = sum(cm["importacao_2025"][:len(cm["importacao_2026"])]) / 1e9
    s = deck.grafico(
        titulo=T("SC amplia sua integração ao comércio exterior"),
        grafico_titulo=f"Exportações e importações de Santa Catarina ({anos_cx[0]}-{anos_cx[-1]})",
        unidade="US$ bilhões FOB",
        grafico=dict(tipo="linhas", categorias=[str(a) for a in anos_cx], formato="0.0",
                     series={"Importações": [v / 1e9 for v in cx["importacao"][sub]],
                             "Exportações": [v / 1e9 for v in cx["exportacao"][sub]]}),
        texto=[f"Em 2025, SC exportou **US$ {br(cx['exportacao'][-1] / 1e9)} bilhões** e importou "
               f"**US$ {br(cx['importacao'][-1] / 1e9)} bilhões**. As importações mais que triplicaram desde 2016, "
               "com insumos industriais e a estrutura portuária do estado.",
               f"De janeiro a setembro de 2026, as exportações somaram **US$ {br(exp_ys)} bilhões "
               f"({var_br((exp_ys / exp_ys0 - 1) * 100)}%)** e as importações, US$ {br(imp_ys)} bilhões "
               f"({var_br((imp_ys / imp_ys0 - 1) * 100)}%), frente a igual período de 2025."],
        nota="Exportação pela UF produtora; importação pela UF do importador. Valores nominais.",
        fonte=fonte("MDIC"))
    ajustar(s, pular=4, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE])

    # ── 02 Atividade, indústria e emprego ────────────────────────────────────
    deck.secao("02", "Atividade, indústria", "e emprego")

    comp = ["PIB", "Agropecuária", "Indústria", "Serviços", "Consumo das famílias", "Consumo do governo", "FBCF",
            "Exportação", "Importação"]
    fmap = {"PIB": "PIB Total", "Agropecuária": "PIB Agropecuária", "Indústria": "PIB Indústria",
            "Serviços": "PIB Serviços", "Consumo das famílias": "PIB Despesa de consumo das famílias",
            "Consumo do governo": "PIB Despesa de consumo da administração pública",
            "FBCF": "PIB Formação Bruta de Capital Fixo", "Exportação": "PIB Exportação de bens e serviços",
            "Importação": "PIB Importação de bens e serviços"}
    # PIB acumulado em 4 trimestres: observado (CNT) e expectativa, projetando o índice de volume
    # trimestral com as medianas do Focus trimestral (variação sobre o mesmo trimestre do ano anterior)
    idx = dict(SIDRA["pib_indice_volume"])
    ftri = FOCUS["PIB Total trimestral"]
    for k in sorted(ftri):
        if k <= "202704" and k not in idx:
            idx[k] = idx[f"{int(k[:4]) - 1}{k[4:]}"] * (1 + ftri[k] / 100)
    tri_seq = sorted(idx)

    def acum4(k):
        i = tri_seq.index(k)
        return (sum(idx[x] for x in tri_seq[i - 3:i + 1]) / sum(idx[x] for x in tri_seq[i - 7:i - 3]) - 1) * 100

    obs_k = [k for k in sorted(CNT["PIB"]) if k >= "202001"]
    exp_k = [k for k in tri_seq if k > obs_k[-1]]
    cats_q = [tri(k) for k in obs_k + exp_k]
    serie_obs = [CNT["PIB"][k] for k in obs_k] + [None] * len(exp_k)
    serie_exp = [None] * len(obs_k) + [acum4(k) for k in exp_k]
    s = deck.grafico(
        titulo=T("Pouso suave: consumo e investimento perdem fôlego"),
        grafico_titulo=f"Valor observado e projeção do PIB ({cats_q[0]}-{cats_q[-1]}*)",
        unidade="Crescimento acumulado em 4 trimestres, em %",
        grafico=dict(tipo="colunas", categorias=cats_q, formato="0.0",
                     series={"Expectativa": serie_exp, "Observado": serie_obs, "Potencial (2% a.a.)": [2.0] * len(cats_q)}),
        texto=[""],
        nota=f"* Expectativas: mediana do Focus de {FOCUS['data'][8:10]}/{FOCUS['data'][5:7]}/{FOCUS['data'][:4]} "
             "(trimestral e anual). Potencial: referência de 2% ao ano.",
        fonte=fonte("IBGE", "BCB", "Ipea"))
    ch = ajustar(s, cores=[BLUE_L, BLUE, INK], sobrepor=True, pular=4)
    ch.plots[0].gap_width = 30
    n_obs = len(obs_k)
    pontos = [(1, cats_q.index(c), BLUE) for c in ("4T21", "4T24") if c in cats_q]
    pontos += [(1, n_obs - 1, BLUE), (0, cats_q.index("4T26"), BLUE_L), (0, len(cats_q) - 1, BLUE_L)]
    rotular_pontos(ch, pontos)
    pot = mover_series(ch, [2], "linha")[0]
    _sppr(pot, linha=INK, largura=1.25, traco="sysDot")
    ch.value_axis.visible = True
    ch.value_axis.format.line.fill.background()
    ch.value_axis.tick_labels.font.size = Pt(8)
    ch.value_axis.tick_labels.number_format, ch.value_axis.tick_labels.number_format_is_linked = "#,##0", False
    ch.category_axis.tick_labels.font.size = Pt(8)
    titulo_negrito(s, "Pouso suave ? ", "consumo e investimento perdem fôlego")
    posicionar(s, "grafico", w=Emu(4979324))
    posicionar(s, "nota", x=Inches(0.45), y=Inches(4.80), w=Inches(5.6), h=Inches(0.3))
    tx = next(sh for sh in s.shapes if sh.name == "texto")
    tx._element.getparent().remove(tx._element)

    # tabela de componentes à direita, com título e unidade no mesmo padrão do gráfico
    gt = next(sh for sh in s.shapes if sh.name == "grafico_titulo")
    gu = next(sh for sh in s.shapes if sh.name == "grafico_unidade")
    for nome, ref, txt, tam, fonte_nome in (
            ("tabela_titulo", gt, "Crescimento por componente do PIB", 11.5, "Montserrat SemiBold"),
            ("tabela_unidade", gu, "Variação anual, em %", 9, "Montserrat")):
        tb = s.shapes.add_textbox(Inches(6.35), ref.top, Inches(3.3), ref.height)
        tb.name = nome
        tb.text_frame.margin_left = tb.text_frame.margin_right = 0
        run = tb.text_frame.paragraphs[0].add_run()
        run.text = txt
        run.font.size, run.font.name = Pt(tam), fonte_nome
        run.font.color.rgb = RGBColor.from_string(BLUE)
    ordem_tab = ["Agropecuária", "Indústria", "Serviços", "Consumo das famílias", "Consumo do governo", "FBCF",
                 "Exportação", "Importação", "PIB"]
    linhas_tab = [["", c if c != "PIB" else "PIB - Total", br(CNT[c]["202404"]), br(CNT[c]["202504"]),
                   br(focus(fmap[c], 2026)), br(focus(fmap[c], 2027))] for c in ordem_tab]
    # 1ª coluna vazia como recuo, como na edição manual (EMU da edição: 602672, 1427730, 4 x 353113)
    tabela_componentes(s, 5479473 / 914400, 1658389 / 914400, [602672 / 914400, 1427730 / 914400] + [353113 / 914400] * 4,
                       ["", "", "2024", "2025", "2026*", "2027*"], linhas_tab, esquerda=2)
    # projeções de outras instituições (antes no slide do PIB anual)
    tb = s.shapes.add_textbox(Emu(5479473 + 602672), Inches(4.62), Inches(3.1), Inches(0.4))
    tb.name = "projecoes_pib"
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.05)
    for txt, cor, fonte_nome in (("Outras projeções para o PIB (2026 e 2027)", BLUE, "Montserrat SemiBold"),
                                 (f"BC: {br(RPM['pib']['2026'])}% e {br(RPM['pib']['2027'])}%   |   "
                                  f"Ipea: {br(IPEA['pib']['2026'])}% e {br(IPEA['pib']['2027'])}%", INK, "Montserrat")):
        par = tf.paragraphs[0] if not tf.paragraphs[0].runs else tf.add_paragraph()
        run = par.add_run()
        run.text = txt
        run.font.size, run.font.name = Pt(8.5), fonte_nome
        run.font.color.rgb = RGBColor.from_string(cor)

    pim_br, pim_sc = SIDRA["pim_12m_BR"], SIDRA["pim_12m_SC"]
    meses_pim = [m for m in sorted(pim_br["Transformação"]) if m >= "202301"]
    ult_pim = meses_pim[-1]
    s = deck.grafico(
        titulo=T("Extrativa cresce e transformação recua"),
        grafico_titulo=f"Produção industrial do Brasil ({mes(meses_pim[0])}-{mes(ult_pim)})",
        unidade="Variação acumulada em 12 meses, em %",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_pim], formato="0.0",
                     series={"Extrativa": [pim_br["Extrativa"][m] for m in meses_pim],
                             "Transformação": [pim_br["Transformação"][m] for m in meses_pim]}),
        texto=[f"Em 12 meses até {mes(ult_pim)}, a **indústria extrativa cresceu {br(pim_br['Extrativa'][ult_pim])}%**, "
               f"com a produção de petróleo e gás, enquanto a **transformação variou {br(pim_br['Transformação'][ult_pim])}%**.",
               "A transformação é o segmento mais exposto ao **custo do crédito** e à moderação da demanda interna: "
               "bens de capital e semi e não duráveis recuam; veículos são a exceção.",
               "É a economia de **duas velocidades**: setores pouco cíclicos sustentam o PIB, e os mais sensíveis aos juros perdem ritmo."],
        fonte=fonte("IBGE", "Ipea"))
    ajustar(s, pular=4, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE], eixo_fmt="#,##0")

    pmc, pms = SIDRA, SIDRA
    um = max(SIDRA["pmc_ampliado_12m_SC"])
    trans_sc = {m: v for m, v in pim_sc["Transformação"].items() if m >= "202301"}
    pico_sc = max(trans_sc, key=trans_sc.get)
    s = deck.grafico(
        titulo=T("Indústria catarinense converge para o ritmo nacional"),
        grafico_titulo=f"Produção da indústria de transformação: Brasil e SC ({mes(meses_pim[0])}-{mes(ult_pim)})",
        unidade="Variação acumulada em 12 meses, em %",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_pim], formato="0.0",
                     series={"Brasil": [pim_br["Transformação"][m] for m in meses_pim],
                             "Santa Catarina": [pim_sc["Transformação"][m] for m in meses_pim]}),
        texto=[f"A transformação catarinense passou de alta de **{br(trans_sc[pico_sc])}% em {mes(pico_sc)}** para "
               f"**{br(trans_sc[ult_pim])}%** em 12 meses até {mes(ult_pim)}, alinhada ao Brasil "
               f"({br(pim_br['Transformação'][ult_pim])}%).",
               f"No comércio, SC segue à frente: varejo ampliado de **{br(pmc['pmc_ampliado_12m_SC'][um])}%** em 12 meses, "
               f"ante {br(pmc['pmc_ampliado_12m_BR'][um])}% no Brasil. Nos serviços, SC cresce "
               f"{br(pms['pms_12m_SC'][um])}%, abaixo do país ({br(pms['pms_12m_BR'][um])}%).",
               "A retomada da indústria depende da transmissão dos cortes da Selic ao crédito e ao investimento."],
        fonte=fonte("IBGE"))
    ajustar(s, pular=4, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE], eixo_fmt="#,##0")

    ibc = [r for r in PIPE["ibc"] if r["date"] >= "2023-01-01"]
    base_br, base_sc = ibc[0]["br_dessaz"], ibc[0]["sc_dessaz"]
    por_data = {r["date"]: r for r in PIPE["ibc"]}

    def ibc12(d, campo):
        ds = sorted(por_data)
        i = ds.index(d)
        atual = sum(por_data[x][campo] for x in ds[i - 11:i + 1])
        ant = sum(por_data[x][campo] for x in ds[i - 23:i - 11])
        return (atual / ant - 1) * 100

    d_ult = ibc[-1]["date"]
    d_ant = f"{int(d_ult[:4]) - 1}{d_ult[4:]}"
    s = deck.grafico(
        titulo=T("Atividade em SC cresce acima da média nacional"),
        grafico_titulo=f"IBC-Br e IBCR-SC ({mes(ibc[0]['date'])}-{mes(d_ult)})",
        unidade="Índice com ajuste sazonal, jan/23 = 100",
        grafico=dict(tipo="linhas", categorias=[mes(r["date"]) for r in ibc], formato="0.0", eixo_min=95, eixo_max=120,
                     series={"Brasil": [r["br_dessaz"] / base_br * 100 for r in ibc],
                             "Santa Catarina": [r["sc_dessaz"] / base_sc * 100 for r in ibc]}),
        texto=[f"Desde janeiro de 2023, a atividade catarinense acumula alta de **{br(ibc[-1]['sc_dessaz'] / base_sc * 100 - 100)}%**, "
               f"ante {br(ibc[-1]['br_dessaz'] / base_br * 100 - 100)}% no Brasil.",
               f"Em 12 meses até {mes(d_ult)}, o IBCR-SC cresceu **{br(ibc12(d_ult, 'sc'))}%** e o IBC-Br, "
               f"{br(ibc12(d_ult, 'br'))}%. Um ano antes, as taxas eram {br(ibc12(d_ant, 'sc'))}% e {br(ibc12(d_ant, 'br'))}%.",
               "SC mantém dinamismo relativo, mas acompanha a perda de ritmo do país desde o início do aperto monetário."],
        fonte=fonte("BCB"))
    ajustar(s, pular=4, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE], eixo_fmt="#,##0", passo=5)

    dbr, dsc = PIPE["desemprego_br"], PIPE["desemprego_sc"]
    tris = [d for d in sorted(dbr) if d in dsc and d >= "2012-03-31"]
    ut = tris[-1]
    rbr, rsc = PIPE["renda_br"][ut], PIPE["renda_sc"][ut]
    s = deck.grafico(
        titulo=T("Desemprego nas mínimas históricas em SC e no Brasil"),
        grafico_titulo=f"Taxa de desocupação: Brasil e SC ({tri(tris[0])}-{tri(ut)})",
        unidade="Em % da força de trabalho",
        grafico=dict(tipo="linhas", categorias=[tri(d) for d in tris], formato="0.0",
                     series={"Brasil": [dbr[d] for d in tris], "Santa Catarina": [dsc[d] for d in tris]}),
        texto=[f"A desocupação chegou a **{br(dbr[ut])}% no Brasil** e **{br(dsc[ut])}% em SC** no {tri(ut)[0]}º trimestre "
               f"de 2026. O rendimento médio habitual em SC, de **R$ {num_br(rsc)}**, supera em "
               f"{br((rsc / rbr - 1) * 100, 0)}% o nacional (R$ {num_br(rbr)}).",
               "O mercado está apertado: com a taxa de participação de antes da pandemia (63,2%), a desocupação "
               "nacional seria de **7,2%**.",
               "A massa de rendimentos cresce 4,1% em 12 meses, ante cerca de 7% na virada do ano: o trabalho "
               "**sustenta**, mas já não impulsiona, a demanda."],
        fonte=fonte("IBGE", "Ipea"))
    ajustar(s, pular=8, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE])

    # ── 03 Inflação, juros e consumo ─────────────────────────────────────────
    deck.secao("03", "Inflação, juros", "e consumo")

    meses_inf = [m for m in sorted(selic_m) if m >= "2022-01"]
    ipca_m = {d[:7]: v for d, v in ipca.items()}
    meta = {2022: 3.5, 2023: 3.25}  # meta central (CMN); intervalo de tolerância de ±1,5 p.p.
    centro = [meta.get(int(m[:4]), 3.0) for m in meses_inf]
    ult_ipca = max(ipca_m)
    s = deck.grafico(
        titulo=T("Inflação acima do teto limita o corte da Selic"),
        grafico_titulo=f"IPCA e taxa Selic ({mes(meses_inf[0])}-{mes(meses_inf[-1])})",
        unidade="Em %; IPCA acumulado em 12 meses e meta da Selic no fim do mês",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_inf], formato="0.00",
                     series={"Limite inferior": [c - 1.5 for c in centro],
                             "Intervalo de tolerância": [3.0] * len(centro),
                             "Meta": centro,
                             "IPCA 12 meses": [ipca_m.get(m) for m in meses_inf],
                             "Selic": [selic_m[m] for m in meses_inf]}),
        texto=[f"O IPCA voltou a **{br(ipca_m[ult_ipca], 2)}% em {mes(ult_ipca)}**, acima do teto de 4,5%. O Focus espera "
               f"**{br(focus('IPCA', 2026), 1)}% em 2026** e {br(focus('IPCA', 2027), 1)}% em 2027.",
               f"O Copom levou a Selic de 15,00% para **{br(selic_m[meses_inf[-1]], 2)}%**; o Focus espera "
               f"{br(focus('Selic', 2026), 2)}% no fim de 2026 e {br(focus('Selic', 2027), 2)}% em 2027. Pelo BC, a chance "
               f"de o IPCA superar o teto cai de **{RPM['prob_acima_teto']['2026']}% em 2026 para "
               f"{RPM['prob_acima_teto']['2027']}% em 2027**."],
        nota="Cenário de referência do RPM de set/26. O descumprimento da meta exige seis meses seguidos fora do intervalo.",
        fonte=fonte("IBGE", "BCB"))
    ch = ajustar(s, pular=6, rotulo_ultimo=[3, 4], cores=[GRID, GRID, GRAY, BLUE_L, BLUE], tracejadas=(2,),
                 eixo_fmt="#,##0")
    base, faixa = mover_series(ch, [0, 1], "area")
    _sppr(base)                    # invisível: só empilha a faixa a partir do limite inferior
    _sppr(faixa, fill="E4E7EC")    # intervalo de tolerância da meta
    esconder_na_legenda(ch, [0])
    posicionar(s, "grafico", w=5512724, h=2894215)
    anos_rpm = ["2026", "2027", "2028"]
    posicionar(s, "nota", x=Inches(6.55), y=Inches(4.5), w=Inches(3.1), h=Inches(0.3))
    tabela_componentes(s, 6.6, 3.65, [1.85, 0.4, 0.4, 0.4], ["Cenário do BC"] + anos_rpm,
                       [["IPCA no 4º trimestre (%)"] + [br(RPM["ipca_4t"][a]) for a in anos_rpm],
                        ["Chance de superar 4,5% (%)"] + [str(RPM["prob_acima_teto"][a]) for a in anos_rpm]],
                       destaque_ultima=False, alt=0.24, azuis=())

    jr = X["juro_real"]["mensal"]
    meses_jr = sorted(jr)
    uj_r = meses_jr[-1]
    pico_jr = max(meses_jr, key=lambda m: jr[m]["juro_real"])
    neutro = RPM["juro_neutro"]
    s = deck.grafico(
        titulo=T("Juro real segue acima do neutro em 2027"),
        grafico_titulo=f"Selic real ex-ante ({mes(meses_jr[0])}-{mes(uj_r)})",
        unidade="Em % a.a.; Selic meta deflacionada pela inflação esperada para 12 meses",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_jr], formato="0.0",
                     series={f"Juro neutro (BC): {br(neutro)}%": [neutro] * len(meses_jr),
                             "Selic real ex-ante": [jr[m]["juro_real"] for m in meses_jr]}),
        texto=[f"A Selic real está em **{br(jr[uj_r]['juro_real'])}% ao ano**, perto do pico de "
               f"{br(jr[pico_jr]['juro_real'])}% ({mes(pico_jr)}) e acima do **juro neutro de {br(neutro)}%** do BC.",
               f"No cenário do BC, o juro real cai aos poucos, até {br(RPM['selic_real_exante_fim_horizonte'])}% no fim do "
               "horizonte: a política monetária segue **contracionista em 2027**.",
               f"Motivo: a economia opera acima do potencial, com hiato de **+{br(RPM['hiato']['3T26'])}%** e uso da "
               f"capacidade da indústria de **{br(RPM['nuci_ago26'])}%** (média: {br(RPM['nuci_media_historica'], 0)}%). O "
               f"BC projeta hiato de {br(RPM['hiato']['1T28'])}% no início de 2028."],
        nota="Juro neutro: taxa real que não estimula nem contrai a atividade. Hiato: diferença entre o PIB e o seu potencial.",
        fonte=fonte("BCB", "FGV"))
    posicionar(s, "nota", y=Inches(4.78))
    ajustar(s, pular=12, rotulo_ultimo=[1], cores=[GRAY, BLUE], tracejadas=(0,), eixo_fmt="#,##0", eixo_min=-2,
            eixo_max=12)

    tris_c = [k for k in sorted(CNT["Consumo das famílias"]) if k >= "202201"]
    cons = CNT["Consumo das famílias"]
    s = deck.grafico(
        titulo=T("Renda cresce, mas o consumo das famílias desacelera"),
        grafico_titulo=f"Consumo das famílias ({tri(tris_c[0])}-{tri(tris_c[-1])})",
        unidade="Variação acumulada em 4 trimestres, em %",
        grafico=dict(tipo="colunas", categorias=[tri(k) for k in tris_c], formato="0.0",
                     series={"Consumo das famílias": [cons[k] for k in tris_c]}),
        texto=[f"O consumo das famílias desacelerou de **{br(cons['202404'])}% no fim de 2024 para {br(cons[tris_c[-1]])}%** "
               f"no {tri(tris_c[-1])[0]}º trimestre de 2026, enquanto a renda disponível cresceu **4,2% em termos reais**.",
               "A diferença virou poupança: a taxa subiu de 10,1% para **13,0% da renda**, a maior fora da pandemia.",
               "Para o Ipea, pesam juros altos, apostas on-line (R$ 37 bilhões em 2025) e a **poupança precaucional** "
               "diante da incerteza eleitoral e geopolítica. Com a eleição definida, parte desse freio pode se dissipar."],
        fonte=fonte("IBGE", "BCB", "Ipea"))
    ajustar(s, legenda=False, cores=[BLUE])

    comp_r, endv = SGS["comprometimento_total"], SGS["endividamento_total"]
    meses_d = [d for d in sorted(comp_r) if d in endv]
    ud = meses_d[-1]
    s = deck.grafico(
        titulo=T("Comprometimento de renda com dívidas atinge recorde"),
        grafico_titulo=f"Endividamento e comprometimento de renda das famílias ({mes(meses_d[0])}-{mes(ud)})",
        unidade="Em % da renda; comprometimento com ajuste sazonal",
        grafico=dict(tipo="linhas", categorias=[mes(d) for d in meses_d], formato="0.0",
                     series={"Endividamento": [endv[d] for d in meses_d],
                             "Comprometimento de renda": [comp_r[d] for d in meses_d]}),
        texto=[f"As famílias destinam **{br(comp_r[ud])}% da renda** ao serviço de dívidas, recorde da série. O "
               f"endividamento está estável em **{br(endv[ud])}%**, perto do recorde de janeiro.",
               "No Brasil, as dívidas são curtas e com muitas linhas rotativas: a Selic chega rápido às parcelas, o "
               "chamado **canal de fluxo de caixa**.",
               "Maior comprometimento reduz a renda livre para consumo e torna o gasto das famílias mais volátil."],
        fonte=fonte("BCB", "Ipea"))
    ajustar(s, pular=24, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE], eixo_fmt="#,##0", eixo_min=0)
    posicionar(s, "grafico", w=Emu(5468815), h=Emu(2973360))

    inad = SGS["inadimplencia_pf_livres"]
    meses_i = sorted(inad)
    ui = meses_i[-1]
    jpf = PIPE["juros_pf"]
    uj = max(jpf)
    s = deck.grafico(
        titulo=T("Inadimplência das famílias no maior nível da série"),
        grafico_titulo=f"Inadimplência de pessoas físicas no crédito livre ({mes(meses_i[0])}-{mes(ui)})",
        unidade="Em % da carteira com atraso acima de 90 dias",
        grafico=dict(tipo="linhas", categorias=[mes(d) for d in meses_i], formato="0.0",
                     series={"Inadimplência PF": [inad[d] for d in meses_i]}, eixo_min=3, eixo_max=9),
        texto=[f"A inadimplência das famílias no crédito livre chegou a **{br(inad[ui], 2)}% em {mes(ui)}**, o maior "
               f"nível da série. A taxa média de juros para pessoas físicas é de **{br(jpf[uj], 1)}% ao ano**.",
               "Cresce o uso de modalidades emergenciais, como cartão rotativo e cheque especial, que encarecem a dívida.",
               "Parte da alta é regulatória: a Resolução CMN 4.966 responde por cerca de **40% do aumento** da "
               "inadimplência da carteira total entre dez/24 e jun/26."],
        fonte=fonte("BCB"))
    ajustar(s, pular=24, legenda=False, rotulo_ultimo=[0], cores=[BLUE], eixo_fmt="#,##0")

    s = deck.sintese(T("Consumo em 2027: impulsos versus peso da dívida"),
                     esquerda=[("Selic em queda.", f"De 15,00% para 13,75%; o Focus espera {br(focus('Selic', 2027), 2)}% no fim de 2027."),
                               ("Transferências.", "Reajuste de cerca de 15% nos benefícios do Bolsa Família desde outubro."),
                               ("Apostas on-line.", "A proibição (MP 1.394) libera parte dos R$ 37 bilhões apostados em 2025."),
                               ("Renegociação.", "Nova fase do Desenrola, com renegociações a partir de fevereiro."),
                               ("Fim da incerteza eleitoral.", "Parte da poupança precaucional pode voltar ao consumo.")],
                     direita=[("Serviço da dívida.", f"Comprometimento de renda recorde, de {br(comp_r[ud])}%."),
                              ("Inadimplência.", f"{br(inad[ui])}% no crédito livre às famílias; bancos mais seletivos."),
                              ("Incerteza remanescente.", "Riscos fiscal e geopolítico mantêm a poupança precaucional."),
                              ("Mercado de trabalho.", "Pouca mão de obra ociosa; massa salarial desacelera."),
                              ("Alimentos e energia.", "Petróleo e El Niño ameaçam a renda real.")])
    colunas_sintese(s, "Impulsos", "Freios", fonte("Ipea", "BCB"))

    # ── 04 Contas públicas ───────────────────────────────────────────────────
    deck.secao("04", "Contas", "públicas")

    s = deck.grafico(
        titulo=T("Governo e mercado divergem sobre o primário de 2027"),
        grafico_titulo="Resultado primário do Governo Central em 2027",
        unidade="Em R$ bilhões correntes",
        grafico=dict(tipo="colunas", categorias=["Resultado primário", "Resultado para a meta*"], formato="#,##0",
                     series={"Mercado (mediana QPC)": [-54, 10], "PLOA 2027": [19, 83]}),
        texto=["O PLOA 2027 prevê **superávit de R$ 19 bilhões**, ou R$ 83 bilhões na métrica da meta. A mediana do "
               "mercado aponta **déficit de R$ 54 bilhões** e R$ 10 bilhões na meta, **abaixo do piso de R$ 37 bilhões**.",
               "A meta é superávit de 0,5% do PIB (R$ 73 bilhões). Despesas obrigatórias crescem acima do limite "
               "real de 2,5% do arcabouço; os gatilhos da **LC 235/2026** devem conter cerca de R$ 9 bilhões."],
        nota="* Descontadas as exclusões previstas na apuração da meta (R$ 65 bilhões no PLOA).",
        fonte=fonte("BCB", "STN", "Ipea"))
    ajustar(s, cores=[BLUE_L, BLUE])
    posicionar(s, "nota", x=5989320, y=3886536, w=2581102, h=276999)

    dbgg, dlsp = SGS["dbgg_pib"], SGS["dlsp_pib"]
    anos_d = list(range(2006, 2031))

    def fim_ano(serie, a):
        ds = [d for d in serie if d.startswith(str(a))]
        return serie[max(ds)] if ds else None

    ult_db = max(dbgg)
    obs_db = [fim_ano(dbgg, a) if a <= 2026 else None for a in anos_d]
    obs_dl = [fim_ano(dlsp, a) if a <= 2026 else None for a in anos_d]
    proj_db = [None] * len(anos_d)
    proj_db[anos_d.index(2026)] = obs_db[anos_d.index(2026)]
    for a in range(2027, 2031):
        proj_db[anos_d.index(a)] = focus("Dívida bruta do governo geral", a)
    s = deck.grafico(
        titulo=T("Dívida pública segue em trajetória de alta"),
        grafico_titulo="Dívida bruta (DBGG) e líquida (DLSP) do setor público (2006-2030*)",
        unidade=f"Em % do PIB, fim de ano; 2026: {mes(ult_db)}",
        grafico=dict(tipo="linhas", categorias=[str(a) for a in anos_d], formato="0.0", eixo_min=20, eixo_max=100,
                     series={"DLSP": obs_dl, "DBGG (projeção Focus)": proj_db, "DBGG": obs_db}),
        texto=[f"A dívida bruta chegou a **{br(dbgg[ult_db])}% do PIB em {mes(ult_db)}**. O Focus projeta "
               f"**{br(focus('Dívida bruta do governo geral', 2027))}% em 2027** e "
               f"{br(focus('Dívida bruta do governo geral', 2030))}% em 2030; mantida a tendência, 100% em 2033.",
               "Com taxa implícita próxima de **13% ao ano**, acima do crescimento nominal do PIB, só superávits "
               "primários estabilizam a dívida. O Tesouro projeta pico de 88% do PIB em 2029.",
               "A contenção das despesas obrigatórias tende a entrar na agenda de 2027, isso ocorreria "
               "**independentemente do resultado eleitoral**."],
        nota="* 2027-2030: mediana do Focus.",
        fonte=fonte("BCB", "STN", "Ipea"))
    ajustar(s, pular=4, rotulo_ultimo=[0, 1, 2], cores=[GRAY, BLUE_L, BLUE], tracejadas=(1,), eixo_fmt="#,##0")
    posicionar(s, "nota", x=5989320, y=4357657)
    posicionar(s, "texto", h=2571217)

    # ── 05 Produtividade e educação ──────────────────────────────────────────
    deck.secao("05", "Longo", "prazo")

    dm = {int(a): v for a, v in X["demografia"]["anual"].items()}
    anos_dm = [a for a in sorted(dm) if a <= 2070]
    a_min = min(anos_dm, key=lambda a: dm[a]["rdt65"])
    a_pop = max(anos_dm, key=lambda a: dm[a]["pop"])
    a_cruza = next(a for a in anos_dm if dm[a]["rdi65"] > dm[a]["rdj65"])
    s = deck.grafico(
        titulo=T("Bônus demográfico chega ao fim"),
        grafico_titulo=f"Razão de dependência no Brasil ({anos_dm[0]}-{anos_dm[-1]}*)",
        unidade="Pessoas de 0 a 14 e de 65 anos ou mais por 100 pessoas de 15 a 64 anos",
        grafico=dict(tipo="linhas", categorias=[str(a) + ("*" if a > 2025 else "") for a in anos_dm], formato="0.0",
                     series={"Jovens (0-14)": [dm[a]["rdj65"] for a in anos_dm],
                             "Idosos (65+)": [dm[a]["rdi65"] for a in anos_dm],
                             "Total": [dm[a]["rdt65"] for a in anos_dm]}),
        texto=[f"A razão de dependência atingiu o mínimo em **{a_min}** ({br(dm[a_min]['rdt65'])} dependentes por 100 "
               f"pessoas em idade ativa) e já voltou a subir: **{br(dm[2030]['rdt65'])} em 2030** e "
               f"{br(dm[2050]['rdt65'])} em 2050.",
               f"Os idosos passam a superar os jovens em **{a_cruza}**, e a população deve parar de crescer em **{a_pop}**, "
               f"com {br(dm[a_pop]['pop'] / 1e6)} milhões de habitantes.",
               "Com menos gente entrando no mercado de trabalho, o crescimento passa a depender da **produtividade**."],
        nota="* Projeção. Revisão 2024 das projeções populacionais do IBGE.",
        fonte=fonte("IBGE"))
    ch = ajustar(s, pular=10, rotulo_ultimo=[0, 1, 2], cores=[GRAY, BLUE_L, BLUE], eixo_fmt="#,##0", eixo_min=0)
    rotular_pontos(ch, [(2, anos_dm.index(a_min), BLUE), (0, len(anos_dm) - 1, GRAY), (1, len(anos_dm) - 1, BLUE_L),
                        (2, len(anos_dm) - 1, BLUE)], posicao=XL_LABEL_POSITION.ABOVE)

    p = M["produtividade"]
    rel = {k: [v / u * 100 for v, u in zip(p[k], p["USA"])] for k in ("CHN", "CHL", "KOR", "BRA")}
    n = len(p["anos"]) - 1
    cresc = {k: ((p[k][-1] / p[k][0]) ** (1 / n) - 1) * 100 for k in ("BRA", "USA", "KOR")}
    s = deck.grafico(
        titulo=T("Produtividade do trabalho estagnada há três décadas"),
        grafico_titulo=f"PIB por pessoa ocupada em relação aos EUA ({p['anos'][0]}-{p['anos'][-1]})",
        unidade="Em %, EUA = 100; US$ PPC constantes de 2021",
        grafico=dict(tipo="linhas", categorias=[str(a) for a in p["anos"]], formato="0.0",
                     series={"China": rel["CHN"], "Chile": rel["CHL"],
                             "Coreia do Sul": rel["KOR"], "Brasil": rel["BRA"]}),
        texto=[f"O trabalhador brasileiro produz **{br(rel['BRA'][-1])}% do que produz um americano**, ante "
               f"{br(rel['BRA'][0])}% em {p['anos'][0]}.",
               f"Desde {p['anos'][0]}, a produtividade cresceu **{br(cresc['BRA'])}% ao ano no Brasil**, contra "
               f"{br(cresc['USA'])}% nos EUA e {br(cresc['KOR'])}% na Coreia do Sul. China e Coreia convergiram; "
               "o Brasil se afastou.",
               "O crescimento recente veio de mais pessoas ocupadas, não de mais produção por trabalhador. Com o "
               "desemprego na mínima, esse motor se esgota."],
        fonte=fonte("Banco Mundial"))
    ajustar(s, pular=5, rotulo_ultimo=[0, 1, 2, 3], cores=["C3C8D1", "7A8394", BLUE_L, BLUE], eixo_fmt="#,##0")

    cn = X["contas_nacionais"]["trimestral"]
    tris_cn = sorted(cn)
    u_cn = tris_cn[-1]
    media_fbcf = sum(cn[k]["fbcf_pib"] for k in tris_cn) / len(tris_cn)
    pico_fbcf = max(tris_cn, key=lambda k: cn[k]["fbcf_pib"])
    rk_fbcf = ranking_bm("fbcf_pib", ["CHN", "IND", "KOR", "WLD", "CHL", "MEX", "OED", "USA", "DEU", "BRA", "COL"])
    pou = BM["poupanca_pib"]
    s = deck.grafico(
        titulo=T("Brasil investe pouco para crescer mais"),
        grafico_titulo="Formação bruta de capital fixo (último ano disponível)",
        unidade="Em % do PIB",
        grafico=dict(tipo="barras", categorias=[r[0] for r in rk_fbcf], formato="0.0",
                     series={"FBCF": [r[1] for r in rk_fbcf]}),
        texto=[f"O Brasil investe **{br(cn[u_cn]['fbcf_pib'])}% do PIB** (4 trimestres até o {tri(u_cn)}), abaixo da "
               f"média de {br(media_fbcf)}% desde 1996, do pico de {br(cn[pico_fbcf]['fbcf_pib'])}% em "
               f"{pico_fbcf[:4]} e da média mundial ({br(BM['fbcf_pib']['WLD']['valor'])}%).",
               f"A **poupança doméstica** é baixa: {br(pou['BRA']['valor'])}% do PIB, ante {br(pou['WLD']['valor'])}% no "
               "mundo. Sem poupança, o investimento depende de capital externo e de juros altos para atraí-lo.",
               "Menos máquinas, infraestrutura e tecnologia por trabalhador significam **menos produtividade**."],
        nota=f"Gráfico: {anos_bm(rk_fbcf)}. Série do Brasil no texto: IBGE, preços correntes.",
        fonte=fonte("Banco Mundial", "IBGE"))
    realcar_barras(s, [i for i, r in enumerate(rk_fbcf) if r[0] == "Brasil"],
                   [i for i, r in enumerate(rk_fbcf) if r[0] in ("Mundo", "OCDE")])

    je = X["juros_empresas"]["mensal"]
    meses_je = sorted(je)
    u_je = meses_je[-1]
    spr = BM["spread_bancario"]
    s = deck.grafico(
        titulo=T("Crédito às empresas custa mais de 24% ao ano"),
        grafico_titulo=f"Juros do crédito livre às empresas e Selic ({mes(meses_je[0])}-{mes(u_je)})",
        unidade="Em % a.a.; Selic: média mensal da meta",
        grafico=dict(tipo="linhas", categorias=[mes(m) for m in meses_je], formato="0.0",
                     series={"Selic": [je[m]["selic"] for m in meses_je],
                             "Crédito livre a empresas": [je[m]["juros_pj_livres"] for m in meses_je]}),
        texto=[f"A taxa média do crédito livre às empresas foi de **{br(je[u_je]['juros_pj_livres'])}% ao ano** em "
               f"{mes(u_je)}, com spread de **{br(je[u_je]['spread_pj_livres'])} p.p.** sobre o custo de captação dos bancos.",
               f"Na comparação internacional, o spread bancário do Brasil é de **{br(spr['BRA']['valor'])} p.p.**, ante "
               f"{br(spr['MEX']['valor'])} no México, {br(spr['COL']['valor'])} na Colômbia e "
               f"{br(spr['CHN']['valor'])} na China.",
               "Além da Selic, o spread reflete inadimplência, tributos e custos de intermediação: reduzir o **custo do "
               "capital** é agenda estrutural."],
        nota=f"Spread internacional: juro dos empréstimos menos juro dos depósitos (Banco Mundial, Brasil "
             f"{spr['BRA']['ano']}). Medida diferente do spread do BC.",
        fonte=fonte("BCB", "Banco Mundial"))
    ajustar(s, pular=24, rotulo_ultimo=[0, 1], cores=[BLUE_L, BLUE], eixo_fmt="#,##0", eixo_min=0)

    pico_tr = max(tris_cn, key=lambda k: cn[k]["transformacao_vab"])
    media_tr = sum(cn[k]["transformacao_vab"] for k in tris_cn) / len(tris_cn)
    mf = BM["transformacao_pib"]
    s = deck.grafico(
        titulo=T("Indústria de transformação perde espaço na economia"),
        grafico_titulo=f"Transformação no valor adicionado ({tri(tris_cn[0])}-{tri(u_cn)})",
        unidade="Em %; preços correntes, somas de 4 trimestres",
        grafico=dict(tipo="linhas", categorias=[tri(k) for k in tris_cn], formato="0.0",
                     series={"Transformação": [cn[k]["transformacao_vab"] for k in tris_cn]}, eixo_min=10, eixo_max=20),
        texto=[f"A transformação responde por **{br(cn[u_cn]['transformacao_vab'])}% do valor adicionado**, ante "
               f"{br(cn[pico_tr]['transformacao_vab'])}% no pico de {pico_tr[:4]} e média de {br(media_tr)}% desde 1996.",
               f"Em proporção do PIB, o Brasil (**{br(mf['BRA']['valor'])}%**) está abaixo da média mundial "
               f"({br(mf['WLD']['valor'])}%) e longe de Coreia do Sul ({br(mf['KOR']['valor'])}%), China "
               f"({br(mf['CHN']['valor'])}%), México ({br(mf['MEX']['valor'])}%) e Alemanha ({br(mf['DEU']['valor'])}%).",
               "A indústria concentra investimento, inovação e exportações de maior valor: sua perda de espaço ajuda a "
               "explicar a **produtividade estagnada**."],
        nota="Comparação internacional: " + anos_bm(ranking_bm("transformacao_pib", ["BRA", "WLD", "KOR", "CHN", "MEX", "DEU"])) + ".",
        fonte=fonte("IBGE", "Banco Mundial"))
    ajustar(s, pular=16, legenda=False, rotulo_ultimo=[0], cores=[BLUE], eixo_fmt="#,##0")

    # Formação técnica e renda: países (OCDE) e UFs (INEP), com tabela-ranking à direita
    ep = E["paises"]
    rk = ep["paises"]
    pos_br = next(i for i, r in enumerate(rk, 1) if r["iso3"] == "BRA")
    fora = [r for r in rk if r["iso3"] == "LUX"]  # PIB per capita inflado por trabalhadores transfronteiriços
    plot = [r for r in rk if r["iso3"] not in ("BRA", "LUX")]
    bra = rk[pos_br - 1]
    xs = [r["stem_100mil"] for r in plot] + [bra["stem_100mil"]]
    ys = [r["pib_pc_usd2015"] / 1e3 for r in plot] + [bra["pib_pc_usd2015"] / 1e3]
    tend, corr = tendencia_linear(xs, ys, 100, 500)
    s = deck.grafico(
        titulo=T("Países que formam mais em STEM têm renda maior"),
        grafico_titulo=f"Graduados STEM e PIB per capita ({ep['ano']})",
        unidade="X: graduados por 100 mil hab.; Y: PIB per capita, US$ mil de 2015",
        grafico=dict(tipo="linhas", categorias=["-"], series={"-": [0]}),
        texto=[f"Há **relação positiva** entre graduados em STEM e renda per capita nos países da base da OCDE "
               f"(correlação de {br(corr, 2)}, sem Luxemburgo). O Brasil é o **{pos_br}º de {len(rk)}**."],
        nota=f"STEM: ciências naturais, matemática e estatística; TIC; engenharia, produção e construção (CINE 05-07), "
             f"graduados do ensino superior. Luxemburgo fora do gráfico ({br(fora[0]['stem_100mil'], 0)}; "
             f"US$ {br(fora[0]['pib_pc_usd2015'] / 1e3)} mil).",
        fonte=fonte("OCDE", "Banco Mundial"))
    nomes_ref = {"IRL": "Irlanda", "CHE": "Suíça", "NOR": "Noruega", "USA": "EUA", "AUS": "Austrália",
                 "KOR": "Coreia do Sul", "CHL": "Chile", "MEX": "México", "COL": "Colômbia"}
    rot = [(i, nomes_ref[r["iso3"]], XL_LABEL_POSITION.BELOW if r["iso3"] == "MEX" else XL_LABEL_POSITION.RIGHT)
           for i, r in enumerate(plot) if r["iso3"] in nomes_ref]
    dispersao(s, [(r["stem_100mil"], r["pib_pc_usd2015"] / 1e3) for r in plot],
              (bra["stem_100mil"], bra["pib_pc_usd2015"] / 1e3), tend, "Brasil",
              nomes=("Países da OCDE e parceiros", "Brasil", "Tendência linear"), eixo_x=(0, 500), eixo_y=(0, 100),
              fmt_y="#,##0", rotulos=rot)
    posicionar(s, "grafico", w=Emu(4979324))
    posicionar(s, "nota", x=Inches(0.45), y=Inches(4.80), w=Inches(5.6), h=Inches(0.3))
    linhas_r = [[r["pais"], br(r["stem_100mil"], 0), br(r["pib_pc_usd2015"] / 1e3)] for r in rk[:10]]
    linhas_r += [["...", "...", "..."], [f"Brasil ({pos_br}º)", br(bra["stem_100mil"], 0), br(bra["pib_pc_usd2015"] / 1e3)]]
    painel_ranking(s, 2.2, 6.0, [1.3, 1.2, 1.1],
                   ["País", "Graduados STEM por 100 mil hab.", "PIB per capita (US$ mil)"], linhas_r)

    eu = E["ufs"]
    ufs = sorted(eu["ufs"], key=lambda r: -r["eng_100mil"])
    sc = next(r for r in ufs if r["sigla"] == "SC")
    pos_sc = ufs.index(sc) + 1
    df_ = next(r for r in ufs if r["sigla"] == "DF")  # PIB per capita elevado pela administração pública federal
    plot = [r for r in ufs if r["sigla"] not in ("SC", "DF")]
    xs = [r["eng_100mil"] for r in plot] + [sc["eng_100mil"]]
    ys = [r["pib_pc"] / 1e3 for r in plot] + [sc["pib_pc"] / 1e3]
    tend, corr = tendencia_linear(xs, ys, 10, 65)
    s = deck.grafico(
        titulo=T("UFs que formam mais engenheiros têm renda maior"),
        grafico_titulo="Concluintes em engenharia e PIB per capita, por UF",
        unidade=f"X: concluintes por 100 mil hab. ({eu['ano_inep']}); Y: PIB per capita, R$ mil ({eu['ano_pib']})",
        grafico=dict(tipo="linhas", categorias=["-"], series={"-": [0]}),
        texto=[f"A relação se repete entre as UFs (correlação de {br(corr, 2)}, sem o DF); **SC é a {pos_sc}ª**. "
               "Na base, o Brasil está **92 pontos atrás da OCDE em matemática no PISA 2025**, cerca de 4,6 anos de "
               "escolaridade."],
        nota=f"Graduação em cursos de engenharia (rótulo CINE), presencial e EAD, pela UF do curso. PIB a preços "
             f"correntes. DF fora do gráfico ({br(df_['eng_100mil'])}; R$ {br(df_['pib_pc'] / 1e3)} mil).",
        fonte=fonte("INEP", "IBGE", "OCDE"))
    siglas_ref = {"SP", "PR", "MG", "RJ", "RS", "ES", "MT", "MS", "BA", "MA", "RR", "TO"}
    rot = [(i, r["sigla"], XL_LABEL_POSITION.LEFT if r["sigla"] == "RJ" else XL_LABEL_POSITION.RIGHT)
           for i, r in enumerate(plot) if r["sigla"] in siglas_ref]
    dispersao(s, [(r["eng_100mil"], r["pib_pc"] / 1e3) for r in plot], (sc["eng_100mil"], sc["pib_pc"] / 1e3),
              tend, "SC", nomes=("Demais UFs", "Santa Catarina", "Tendência linear"), eixo_x=(0, 70), eixo_y=(0, 80),
              fmt_y="#,##0", rotulos=rot)
    posicionar(s, "grafico", w=Emu(4979324))
    posicionar(s, "nota", x=Inches(0.45), y=Inches(4.80), w=Inches(5.6), h=Inches(0.3))
    linhas_r = [[r["uf"], br(r["eng_100mil"]), br(r["pib_pc"] / 1e3)] for r in ufs[:10]]
    linhas_r += [["...", "...", "..."], ["Brasil", br(eu["brasil"]["eng_100mil"]), br(eu["brasil"]["pib_pc"] / 1e3)]]
    painel_ranking(s, 2.45, 6.0, [1.5, 1.05, 1.05],
                   ["UF", "Concluintes por 100 mil hab.", "PIB per capita (R$ mil)"], linhas_r, destaque="Santa Catarina",
                   alt=0.185)

    t = M["tic_produtividade_uf"]
    s = deck.grafico(
        titulo=T("Formação em TIC não basta para elevar a produtividade"),
        grafico_titulo="Formação em Computação e TIC e produtividade, por UF",
        unidade="X: concluintes por 100 mil hab. (2024); Y: PIB por ocupado, % a.a. (2012-2023)",
        grafico=dict(tipo="linhas", categorias=["-"], series={"-": [0]}),
        texto=["Entre 2012 e 2023, a produtividade do trabalho no Brasil ficou praticamente parada. As UFs que mais "
               "avançaram foram as da **fronteira agrícola**.",
               "A correlação entre formação em TIC e ganho de produtividade é **negativa (-0,27)**. SC forma 47 "
               "concluintes por 100 mil habitantes, mas sua produtividade variou **-0,35% ao ano**.",
               "Capital humano é necessário, mas precisa vir com **investimento e inovação nas empresas**."],
        nota="PIB real das Contas Regionais por pessoa ocupada (PNAD Contínua). Concluintes na área CINE "
             "Computação e TIC, presencial e EAD, pela UF do curso.",
        fonte=fonte("IBGE", "INEP"))
    xs = t["x"] + [t["sc"][0]]
    ys = t["y"] + [t["sc"][1]]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    beta = sum((a - mx) * (c - my) for a, c in zip(xs, ys)) / sum((a - mx) ** 2 for a in xs)
    dispersao(s, list(zip(t["x"], t["y"])), tuple(t["sc"]),
              [(0, my - beta * mx), (160, my + beta * (160 - mx))], "SC")

    rk_pd = ranking_bm("pd_pib", ["KOR", "USA", "JPN", "DEU", "OED", "WLD", "CHN", "POL", "TUR", "BRA", "CHL", "MEX"])
    pdv = BM["pd_pib"]
    s = deck.grafico(
        titulo=T("Brasil investe pouco em pesquisa e desenvolvimento"),
        grafico_titulo="Gasto em pesquisa e desenvolvimento (último ano disponível)",
        unidade="Em % do PIB",
        grafico=dict(tipo="barras", categorias=[r[0] for r in rk_pd], formato="0.00",
                     series={"P&D": [r[1] for r in rk_pd]}),
        texto=[f"O Brasil investe **{br(pdv['BRA']['valor'], 2)}% do PIB em P&D**, menos da metade das médias mundial "
               f"({br(pdv['WLD']['valor'], 2)}%) e da OCDE ({br(pdv['OED']['valor'], 2)}%). A Coreia do Sul investe "
               f"{br(pdv['KOR']['valor'], 2)}%.",
               f"China ({br(pdv['CHN']['valor'], 2)}%), Polônia ({br(pdv['POL']['valor'], 2)}%) e Turquia "
               f"({br(pdv['TUR']['valor'], 2)}%) já investem mais que o Brasil.",
               "Formar pessoas não basta: elevar a produtividade exige **investimento e inovação dentro das empresas**."],
        nota=anos_bm(rk_pd) + ", com dados da Unesco.",
        fonte=fonte("Banco Mundial"))
    realcar_barras(s, [i for i, r in enumerate(rk_pd) if r[0] == "Brasil"],
                   [i for i, r in enumerate(rk_pd) if r[0] in ("Mundo", "OCDE")])

    # ── 06 Agenda 2027 ───────────────────────────────────────────────────────
    deck.secao("06", "Agenda", "2027")

    s = deck.sintese(T("O que acompanhar em 2027"),
                     esquerda=[("Regra fiscal.", "Meta de superávit de 0,5% do PIB, gatilhos da LC 235 e revisão de "
                                                 "despesas obrigatórias. Indicadores: resultado primário e dívida bruta."),
                               ("Juros e inflação.", "O ritmo de corte da Selic depende de expectativas ancoradas e de "
                                                     "credibilidade fiscal. Indicadores: Focus e comunicação do Copom."),
                               ("Famílias e crédito.", "Desenrola, proibição das apostas e juros menores aliviam o serviço "
                                                       "da dívida. Indicador: comprometimento de renda.")],
                     direita=[("Reforma tributária.", "Em 2027, a CBS substitui o PIS/Cofins, o IPI é zerado (exceto ZFM) "
                                                      "e começa o Imposto Seletivo. Indicadores: preços e arrecadação."),
                              ("Produtividade.", "Investimento, P&D e educação definem o crescimento potencial com "
                                                 "o fim do bônus demográfico. Indicadores: FBCF e PIB por trabalhador."),
                              ("Cenário externo.", "Petróleo, juros americanos e tarifas; o real amortece choques de "
                                                   "commodities. Indicadores: Brent e câmbio.")])
    colunas_sintese(s, "Macroeconomia", "Estrutura e ambiente externo", fonte("Ipea", "BCB", "Brasil"))

    s = deck.sintese(T("Balanço de riscos para 2027"),
                     esquerda=[("Fiscal.", "Revisão da meta ou adiamento do ajuste elevam o prêmio de risco."),
                               ("Petróleo e geopolítica.", "Pressão sobre combustíveis, fretes, fertilizantes e alimentos."),
                               ("Juros globais.", "Novas altas do Fed e juro de 10 anos dos EUA em 5%."),
                               ("Clima.", "El Niño intenso afeta safra e energia."),
                               ("Crédito.", "Inadimplência recorde restringe a oferta às famílias.")],
                     direita=[("Credibilidade fiscal.", "Ajuste crível nas despesas obrigatórias acelera a queda da Selic."),
                              ("Commodities.", "Petróleo e agro sustentam câmbio e receitas."),
                              ("Famílias.", "Renegociação de dívidas e fim das apostas liberam renda."),
                              ("Desinflação.", "Atividade mais fraca alivia os preços de serviços."),
                              ("Investimento.", "Juros menores destravam FBCF, construção e bens de capital.")])
    colunas_sintese(s, "Para pior", "Para melhor", fonte("Ipea", "BCB"))

    s = deck.sintese(T("Mensagens finais"),
                     esquerda=[("Desaceleração.", "2027 começa com PIB projetado entre 1,3% e 1,7%, desemprego mínimo "
                                                  "e inflação acima da meta."),
                               ("Consumo.", "Perdeu fôlego pelo peso da dívida, não por falta de renda."),
                               ("Fiscal.", "O ajuste é necessário qualquer que seja o resultado eleitoral: a dívida "
                                           f"bruta caminha para {br(focus('Dívida bruta do governo geral', 2028), 0)}% do PIB em 2028."),
                               ("Juros.", "Só caem de forma sustentada com credibilidade fiscal, o elo entre contas "
                                          "públicas e crédito.")],
                     direita=[("Indústria.", "A transformação está estagnada; a retomada depende da transmissão dos "
                                             "cortes de juros ao crédito e ao investimento."),
                              ("Santa Catarina.", "Atividade e emprego acima da média nacional, com forte integração "
                                                  "ao comércio exterior."),
                              ("Reforma tributária.", "2027 marca o início da CBS e o fim do IPI: a transição exige "
                                                      "preparação das empresas."),
                              ("Longo prazo.", "Com o fim do bônus demográfico, só a produtividade sustenta o "
                                               "crescimento: investimento, inovação e capital humano nas empresas.")])
    colunas_sintese(s, "Brasil", "Indústria e Santa Catarina")

    deck.encerramento()
    padronizar(deck.prs)
    sem_efeitos(deck.prs)
    deck.salvar(SAIDA)
    print("Gerado:", SAIDA)


if __name__ == "__main__":
    main()
