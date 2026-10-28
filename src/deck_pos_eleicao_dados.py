"""
Coleta as séries do deck "Pós-eleição 2027 v3" (BCB/SGS, Focus e IBGE/SIDRA) e grava
data/deck_pos_eleicao/series.json. Os dados vindos do MCP do Observatório ficam em
data/deck_pos_eleicao/mcp_snapshot.json; séries já atualizadas pelo pipeline
(src/makedataset.py) são lidas de dashboard/public/data.

    python src/deck_pos_eleicao_dados.py
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd
import sidrapy
from bcb import sgs

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "deck_pos_eleicao"
PIPE = ROOT / "dashboard" / "public" / "data"

SGS = {
    "selic_meta": (432, "2021-01-01"),
    "ipca_12m": (13522, "2021-01-01"),
    "ptax_media_mensal": (3698, "2020-01-01"),
    "ptax_diaria": (1, "2026-08-01"),
    "comprometimento_total": (29034, "2005-03-01"),
    "endividamento_total": (29037, "2005-01-01"),
    "inadimplencia_pf_livres": (21112, "2011-03-01"),
    "dbgg_pib": (13762, "2006-12-01"),
    "dlsp_pib": (4513, "2006-12-01"),
}


def get_sgs(code, start, tentativas=4):
    for i in range(tentativas):
        try:
            s = sgs.get({"v": code}, start=start)["v"]
            return {d.strftime("%Y-%m-%d"): float(v) for d, v in s.dropna().items()}
        except Exception as exc:  # API do BCB oscila; tenta de novo
            print(f"  SGS {code}: tentativa {i + 1} falhou ({exc})")
            time.sleep(5)
    raise RuntimeError(f"SGS {code} indisponível")


def get_focus():
    base = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
    q = {"$filter": "Data ge '2026-10-01' and baseCalculo eq 0", "$format": "json",
         "$select": "Indicador,IndicadorDetalhe,Data,DataReferencia,Mediana", "$top": "5000"}
    url = base + "?" + urllib.parse.urlencode(q, quote_via=urllib.parse.quote)
    with urllib.request.urlopen(url, timeout=150) as r:
        rows = json.loads(r.read().decode())["value"]
    data = max(x["Data"] for x in rows)
    out = {"data": data}
    for x in rows:
        if x["Data"] == data:
            nome = x["Indicador"] + (f" | {x['IndicadorDetalhe']}" if x["IndicadorDetalhe"] else "")
            out.setdefault(nome, {})[x["DataReferencia"]] = x["Mediana"]
    # PIB trimestral: variação % sobre o mesmo trimestre do ano anterior ('3/2026' -> '202603')
    base = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoTrimestrais"
    q = {"$filter": f"Indicador eq 'PIB Total' and Data eq '{data}' and baseCalculo eq 0", "$format": "json",
         "$select": "DataReferencia,Mediana", "$top": "100"}
    url = base + "?" + urllib.parse.urlencode(q, quote_via=urllib.parse.quote)
    with urllib.request.urlopen(url, timeout=150) as r:
        trim = json.loads(r.read().decode())["value"]
    out["PIB Total trimestral"] = {f"{x['DataReferencia'][-4:]}0{x['DataReferencia'][0]}": x["Mediana"] for x in trim}
    return out


def sidra(**kw):
    df = sidrapy.get_table(**kw)
    df.columns = df.iloc[0]
    return df.iloc[1:]


def get_sidra():
    out = {}
    # PIB e componentes: taxa acumulada em 4 trimestres (CNT, tabela 5932, var. 6562)
    comp = {"90687": "Agropecuária", "90691": "Indústria", "90696": "Serviços", "90707": "PIB",
            "93404": "Consumo das famílias", "93405": "Consumo do governo", "93406": "FBCF",
            "93407": "Exportação", "93408": "Importação"}
    df = sidra(table_code="5932", territorial_level="1", ibge_territorial_code="all", variable="6562",
               classifications={"11255": ",".join(comp)}, period="last 48")
    cls = [c for c in df.columns if c.endswith("(Código)") and c.startswith("Setores")][0]
    out["cnt_4t"] = {comp[k]: dict(zip(g["Trimestre (Código)"], pd.to_numeric(g["Valor"], errors="coerce")))
                     for k, g in df.groupby(cls)}
    # PIB: índice encadeado de volume trimestral (1995 = 100), para projetar o acumulado em 4 trimestres
    df = sidra(table_code="1620", territorial_level="1", ibge_territorial_code="all", variable="583",
               classifications={"11255": "90707"}, period="last 16")
    out["pib_indice_volume"] = dict(zip(df["Trimestre (Código)"], pd.to_numeric(df["Valor"], errors="coerce")))
    # PIM-PF: acumulado em 12 meses, Brasil e SC
    secoes = {"129314": "Indústria geral", "129315": "Extrativa", "129316": "Transformação"}
    for terr, cod, nome in (("1", "all", "BR"), ("3", "42", "SC")):
        df = sidra(table_code="8888", territorial_level=terr, ibge_territorial_code=cod, variable="11604",
                   classifications={"544": ",".join(secoes)}, period="last 48")
        col = "Seções e atividades industriais (CNAE 2.0) (Código)"
        out[f"pim_12m_{nome}"] = {secoes[k]: dict(zip(g["Mês (Código)"], pd.to_numeric(g["Valor"], errors="coerce")))
                                  for k, g in df.groupby(col)}
    # PMC ampliado e PMS (volume, acumulado em 12 meses), Brasil e SC
    for nome, tab, var, c in (("pmc_ampliado", "8881", "11711", {"11046": "56736"}),
                              ("pms", "5906", "11626", {"11046": "56726"})):
        for terr, cod, uf in (("1", "all", "BR"), ("3", "42", "SC")):
            df = sidra(table_code=tab, territorial_level=terr, ibge_territorial_code=cod, variable=var,
                       classifications=c, period="last 16")
            out[f"{nome}_12m_{uf}"] = dict(zip(df["Mês (Código)"], pd.to_numeric(df["Valor"], errors="coerce")))
    return out


def get_pipeline():
    """Séries atualizadas pelo pipeline do painel (src/makedataset.py)."""
    def load(nome):
        return json.load(open(PIPE / f"{nome}.json", encoding="utf-8"))
    sgs_dados = load("sgs_dados")
    ibc_uf = {r["date"]: r for r in load("ibc_uf")}
    socio = load("socioeconomico_quarterly")
    socio_sc = [r for r in load("socioeconomico_uf") if r["uf"] == "Santa Catarina"]
    return {
        "ibc": [{"date": r["date"], "br": r["ibc_br"], "br_dessaz": r["ibc_br_dessaz"],
                 "sc": ibc_uf[r["date"]]["ibc_sc"], "sc_dessaz": ibc_uf[r["date"]]["ibc_sc_dessaz"]}
                for r in sgs_dados if r["date"] in ibc_uf],
        "juros_pf": {r["date"]: r["taxa_juros_pf"] for r in sgs_dados},
        "desemprego_br": {r["date"]: r["taxa_desemprego"] for r in socio},
        "desemprego_sc": {r["date"]: r["taxa_desemprego"] for r in socio_sc},
        "renda_br": {r["date"]: r["renda_media"] for r in socio},
        "renda_sc": {r["date"]: r["renda_media"] for r in socio_sc},
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    dados = {"_coleta": pd.Timestamp.today().strftime("%Y-%m-%d"), "sgs": {}}
    for nome, (code, start) in SGS.items():
        print(f"SGS {code} ({nome})")
        dados["sgs"][nome] = get_sgs(code, start)
    print("Focus")
    dados["focus"] = get_focus()
    print("SIDRA")
    dados["sidra"] = get_sidra()
    dados["pipeline"] = get_pipeline()
    (OUT / "series.json").write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Gravado:", OUT / "series.json")


if __name__ == "__main__":
    main()
