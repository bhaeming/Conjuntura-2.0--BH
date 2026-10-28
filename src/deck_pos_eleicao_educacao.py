"""
Formação técnica e PIB per capita (deck "Pós-eleição 2027 v3"): graduados STEM por país (OCDE)
e concluintes de engenharia por UF (INEP), com PIB per capita (Banco Mundial e IBGE). Grava
data/deck_pos_eleicao/educacao.json.

    python src/deck_pos_eleicao_educacao.py

Os microdados do Censo da Educação Superior (~460 MB) ficam em cache fora do repositório
(~/.cache/inep); se faltarem, são baixados do INEP.
"""
import io
import json
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd
import sidrapy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "deck_pos_eleicao" / "educacao.json"
ANO_INEP = 2024
INEP_URL = f"https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_{ANO_INEP}.zip"
INEP_ZIP = Path.home() / ".cache" / "inep" / f"microdados_censo_da_educacao_superior_{ANO_INEP}.zip"
PROJ_URL = ("https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/"
            "projecoes_2024_tab4_indicadores.xlsx")
# Graduados do ensino superior (CINE 5-8) em F05 ciências naturais, matemática e estatística,
# F06 TIC e F07 engenharia, produção e construção; total de sexos e de mobilidade
OCDE_URL = ("https://sdmx.oecd.org/public/rest/data/OECD.EDU.IMEP,DSD_EAG_UOE_NON_FIN_STUD@DF_UOE_NF_RAW_FIELD,/"
            ".ISCED11_5T8.GRAD...F05+F06+F07......_T.._T.?startPeriod=2019&dimensionAtObservation=AllDimensions"
            "&format=csvfile")
PAISES = {
    "AUS": "Austrália", "AUT": "Áustria", "BEL": "Bélgica", "BGR": "Bulgária", "BRA": "Brasil", "CAN": "Canadá",
    "CHE": "Suíça", "CHL": "Chile", "COL": "Colômbia", "CRI": "Costa Rica", "CZE": "Tchéquia", "DEU": "Alemanha",
    "DNK": "Dinamarca", "ESP": "Espanha", "EST": "Estônia", "FIN": "Finlândia", "FRA": "França",
    "GBR": "Reino Unido", "GRC": "Grécia", "HRV": "Croácia", "HUN": "Hungria", "IRL": "Irlanda", "ISL": "Islândia",
    "ISR": "Israel", "ITA": "Itália", "KOR": "Coreia do Sul", "LTU": "Lituânia", "LUX": "Luxemburgo",
    "LVA": "Letônia", "MEX": "México", "NLD": "Países Baixos", "NOR": "Noruega", "NZL": "Nova Zelândia",
    "PER": "Peru", "POL": "Polônia", "PRT": "Portugal", "ROU": "Romênia", "SVK": "Eslováquia", "SVN": "Eslovênia",
    "SWE": "Suécia", "TUR": "Turquia", "USA": "EUA",
}


def get(url, timeout=300):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}),
                                  timeout=timeout).read()


def banco_mundial(indicador, ano):
    j = json.loads(get(f"https://api.worldbank.org/v2/country/all/indicator/{indicador}"
                       f"?date={ano}&format=json&per_page=400"))
    return {r["countryiso3code"]: r["value"] for r in j[1] if r["value"] is not None}


def paises():
    d = pd.read_csv(io.BytesIO(get(OCDE_URL)))
    stem = d.groupby(["REF_AREA", "TIME_PERIOD"]).agg(v=("OBS_VALUE", "sum"), n=("OBS_VALUE", "count"))
    stem = stem[stem.n == 3].v.unstack()
    ano = int(stem.columns.max())
    pop, pib = banco_mundial("SP.POP.TOTL", ano), banco_mundial("NY.GDP.PCAP.KD", ano)
    linhas = []
    for iso, v in stem[ano].dropna().items():
        if iso in pop and iso in pib:
            linhas.append({"iso3": iso, "pais": PAISES.get(iso, iso), "graduados_stem": int(v),
                           "stem_100mil": round(v / pop[iso] * 1e5, 1), "pib_pc_usd2015": round(pib[iso])})
    return {"_fonte": f"OCDE, Education at a Glance (UOE, graduados por área, CINE 5-8, F05+F06+F07), {ano}; "
                      f"Banco Mundial, WDI: SP.POP.TOTL e NY.GDP.PCAP.KD (US$ constantes de 2015), {ano}.",
            "ano": ano, "paises": sorted(linhas, key=lambda r: -r["stem_100mil"])}


def baixar_inep():
    INEP_ZIP.parent.mkdir(parents=True, exist_ok=True)
    try:
        INEP_ZIP.write_bytes(get(INEP_URL, timeout=1800))
    except urllib.error.URLError:  # a cadeia TLS do INEP só valida no repositório do Windows
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        f"$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '{INEP_URL}' "
                        f"-OutFile '{INEP_ZIP}' -UseBasicParsing"], check=True)


def ufs():
    if not INEP_ZIP.exists():
        baixar_inep()
    nome = f"microdados_censo_da_educacao_superior_{ANO_INEP}/dados/MICRODADOS_CADASTRO_CURSOS_{ANO_INEP}.CSV"
    with zipfile.ZipFile(INEP_ZIP).open(nome) as f:
        c = pd.read_csv(f, sep=";", encoding="latin-1", low_memory=False,
                        usecols=["CO_UF", "SG_UF", "NO_UF", "NO_CINE_ROTULO", "TP_NIVEL_ACADEMICO",
                                 "TP_MODALIDADE_ENSINO", "QT_CONC"])
    # Engenharias: cursos de graduação cujo rótulo CINE Brasil começa por "Engenharia"
    eng = c[(c.TP_NIVEL_ACADEMICO == 1) & c.NO_CINE_ROTULO.str.startswith("Engenharia")]
    total = eng.groupby("CO_UF").QT_CONC.sum()
    presencial = eng[eng.TP_MODALIDADE_ENSINO == 1].groupby("CO_UF").QT_CONC.sum()
    nomes = eng.drop_duplicates("CO_UF").set_index("CO_UF")[["SG_UF", "NO_UF"]]

    proj = pd.read_excel(io.BytesIO(get(PROJ_URL)), header=6)
    proj = proj[proj["CÓD."] < 100].pivot_table(index="CÓD.", columns="ANO", values="POP_T")
    df = sidrapy.get_table(table_code="5938", territorial_level="3", ibge_territorial_code="all",
                           variable="37", period="last 1")
    df.columns = df.iloc[0]
    df = df.iloc[1:]
    ano_pib = int(df["Ano"].iloc[0])
    pib = dict(zip(df["Unidade da Federação (Código)"].astype(int), pd.to_numeric(df["Valor"]) * 1e3))

    linhas = []
    for uf in sorted(total.index):
        p = proj.loc[uf, ANO_INEP]
        linhas.append({"cod": int(uf), "sigla": nomes.loc[uf, "SG_UF"], "uf": nomes.loc[uf, "NO_UF"],
                       "concluintes": int(total[uf]), "concluintes_presencial": int(presencial.get(uf, 0)),
                       "eng_100mil": round(total[uf] / p * 1e5, 2),
                       "eng_presencial_100mil": round(presencial.get(uf, 0) / p * 1e5, 2),
                       "pib_pc": round(pib[uf] / proj.loc[uf, ano_pib])})
    br_pop = proj.loc[0, ANO_INEP]
    brasil = {"sigla": "BR", "uf": "Brasil", "concluintes": int(total.sum()),
              "concluintes_presencial": int(presencial.sum()),
              "eng_100mil": round(total.sum() / br_pop * 1e5, 2),
              "eng_presencial_100mil": round(presencial.sum() / br_pop * 1e5, 2),
              "pib_pc": round(sum(pib.values()) / proj.loc[0, ano_pib])}
    return {"_fonte": f"INEP, Censo da Educação Superior {ANO_INEP} (microdados de cursos: concluintes de graduação "
                      f"com rótulo CINE 'Engenharia...', por UF do curso); IBGE, Contas Regionais {ano_pib} (SIDRA "
                      f"5938) e Projeções da População, revisão 2024 (denominadores de {ANO_INEP} e {ano_pib}).",
            "ano_inep": ANO_INEP, "ano_pib": ano_pib, "ufs": linhas, "brasil": brasil}


def main():
    dados = {"_coleta": pd.Timestamp.today().strftime("%Y-%m-%d"), "paises": paises(), "ufs": ufs()}
    OUT.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Gravado:", OUT)


if __name__ == "__main__":
    main()
