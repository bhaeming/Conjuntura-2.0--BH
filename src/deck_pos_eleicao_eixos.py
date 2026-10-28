"""
Títulos dos eixos (o que cada eixo mede) em todos os gráficos do deck "Pós-eleição 2027 v4".

Altera só os gráficos do deck já editado à mão, com backup. Os gráficos são identificados pelo
título do gráfico (shape "grafico_titulo"), não pelo número do slide.

    python src/deck_pos_eleicao_eixos.py
"""
import shutil
import sys
from datetime import datetime
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_TICK_LABEL_POSITION, XL_TICK_MARK
from pptx.oxml.ns import qn
from pptx.util import Pt

ROOT = Path(__file__).resolve().parents[1]
DECK = ROOT / "docs_provisorio" / "Pós-eleição 2027 - Temas econômicos (versão final).pptx"
MUTED = RGBColor(0x6B, 0x72, 0x80)

# início do título do gráfico -> (eixo das categorias / X, eixo dos valores / Y)
EIXOS = {
    "Crescimento do PIB real": ("Economia", "Crescimento do PIB real (%)"),
    "Índice de risco geopolítico": ("Mês", "Índice (média 1985-2019 = 100)"),
    "Preço do petróleo Brent": ("Mês", "US$ por barril"),
    "Taxa de câmbio": ("Mês", "R$ por US$"),
    "Exportações e importações de Santa Catarina": ("Ano", "US$ bilhões FOB"),
    "Valor observado e projeção do PIB": ("Trimestre", "PIB, var. em 4 trimestres (%)"),
    "Produção industrial do Brasil": ("Mês", "Produção, var. em 12 meses (%)"),
    "Produção da indústria de transformação": ("Mês", "Produção, var. em 12 meses (%)"),
    "IBC-Br e IBCR-SC": ("Mês", "Atividade (jan/23 = 100)"),
    "Taxa de desocupação": ("Trimestre", "% da força de trabalho"),
    "IPCA e taxa Selic": ("Mês", "IPCA em 12 meses e Selic (%)"),
    "Selic real ex-ante": ("Mês", "Juro real (% a.a.)"),
    "Consumo das famílias": ("Trimestre", "Consumo, var. em 4 trimestres (%)"),
    "Endividamento e comprometimento": ("Mês", "% da renda das famílias"),
    "Inadimplência de pessoas físicas": ("Mês", "% da carteira com atraso > 90 dias"),
    "Resultado primário do Governo Central": ("Critério de apuração", "R$ bilhões"),
    "Dívida bruta (DBGG)": ("Ano", "% do PIB"),
    "Razão de dependência": ("Ano", "Dependentes por 100 em idade ativa"),
    "PIB por pessoa ocupada": ("Ano", "Produtividade, % da dos EUA"),
    "Formação bruta de capital fixo": ("País ou grupo", "Investimento (FBCF), % do PIB"),
    "Juros do crédito livre às empresas": ("Mês", "Taxa de juros (% a.a.)"),
    "Transformação no valor adicionado": ("Trimestre", "% do valor adicionado"),
    "Graduados STEM e PIB per capita": ("Graduados STEM por 100 mil habitantes", "PIB per capita (US$ mil de 2015)"),
    "Concluintes em engenharia e PIB per capita": ("Concluintes em engenharia por 100 mil habitantes", "PIB per capita (R$ mil)"),
    "Gasto em pesquisa e desenvolvimento": ("País ou grupo", "Gasto em P&D, % do PIB"),
}


def _titulo(eixo, texto):
    """Título do eixo em Montserrat 8 pt cinza, sem sobrepor o gráfico; girado se o eixo for vertical."""
    eixo.has_title = True
    tf = eixo.axis_title.text_frame
    tf.text = texto
    f = tf.paragraphs[0].runs[0].font
    f.name, f.size, f.bold = "Montserrat", Pt(8), False
    f.color.rgb = MUTED
    ax = eixo._element
    titulo = ax.find(qn("c:title"))
    overlay = titulo.find(qn("c:overlay"))
    if overlay is None:
        overlay = titulo.makeelement(qn("c:overlay"), {})
        titulo.append(overlay)
    overlay.set("val", "0")
    vertical = ax.find(qn("c:axPos")).get("val") in ("l", "r")
    titulo.find(qn("c:tx")).find(qn("c:rich")).find(qn("a:bodyPr")).set("rot", "-5400000" if vertical else "0")


def _so_titulo(eixo):
    """Eixo de valores oculto (barras/colunas): reaparece só com o título, sem números, linha ou marcas."""
    if eixo.visible:
        return
    eixo.visible = True
    eixo.tick_label_position = XL_TICK_LABEL_POSITION.NONE
    eixo.major_tick_mark = eixo.minor_tick_mark = XL_TICK_MARK.NONE
    eixo.has_major_gridlines = False
    eixo.format.line.fill.background()


def _abrir_espaco(chart, dx=0.035, dh=0.06):
    """Área de plotagem com posição fixa: recua à direita e encolhe na altura para caber os títulos dos eixos."""
    pa = chart._chartSpace.find(qn("c:chart")).find(qn("c:plotArea"))
    ml = pa.find(qn("c:layout")).find(qn("c:manualLayout")) if pa.find(qn("c:layout")) is not None else None
    if ml is None:
        return
    val = {e.tag.split("}")[1]: e for e in ml}
    val["x"].set("val", f"{float(val['x'].get('val')) + dx:.4f}")
    val["w"].set("val", f"{float(val['w'].get('val')) - dx:.4f}")
    val["h"].set("val", f"{float(val['h'].get('val')) - dh:.4f}")


def rotular(prs):
    feitos = []
    for i, s in enumerate(prs.slides, 1):
        graf = [sh for sh in s.shapes if sh.has_chart]
        if not graf:
            continue
        tit = next((sh.text_frame.text for sh in s.shapes if sh.name == "grafico_titulo"), "")
        chave = next((k for k in EIXOS if tit.startswith(k)), None)
        if chave is None:
            raise KeyError(f"slide {i}: sem rótulos definidos para o gráfico '{tit}'")
        x, y = EIXOS[chave]
        ch = graf[0].chart
        eixo_x, eixo_y = ch.category_axis, ch.value_axis  # no XY, category_axis é o eixo X de valores
        _so_titulo(eixo_y)
        _abrir_espaco(ch)
        _titulo(eixo_x, x)
        _titulo(eixo_y, y)
        feitos.append((i, chave))
    return feitos


def main(deck=DECK):
    bkp = deck.parent / "backup" / f"{deck.stem} (antes dos eixos {datetime.now():%d-%m %Hh%M}).pptx"
    bkp.parent.mkdir(exist_ok=True)
    shutil.copy2(deck, bkp)
    prs = Presentation(deck)
    for i, k in rotular(prs):
        print(f"slide {i}: {k}")
    prs.save(deck)
    print("Backup:", bkp, "\nAtualizado:", deck)


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else DECK))
