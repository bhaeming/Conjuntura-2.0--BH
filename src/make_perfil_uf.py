"""
Perfil estrutural das UFs para o mapa do painel: população, PIB, PIB per capita e participação no PIB.
Grava data/processed/perfil_uf.parquet (exportado para o painel por dashboard/scripts/export_data.py).

    python src/make_perfil_uf.py
"""
import io
import urllib.request
from pathlib import Path

import pandas as pd
import sidrapy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed" / "perfil_uf.parquet"
PROJ_URL = ("https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/"
            "projecoes_2024_tab4_indicadores.xlsx")
SIGLAS = {11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE",
          24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP",
          41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF"}
REGIOES = {1: "Norte", 2: "Nordeste", 3: "Sudeste", 4: "Sul", 5: "Centro-Oeste"}


def populacao():
    """Projeções da População (IBGE, revisão 2024): população total por UF e ano."""
    req = urllib.request.Request(PROJ_URL, headers={"User-Agent": "Mozilla/5.0"})
    p = pd.read_excel(io.BytesIO(urllib.request.urlopen(req, timeout=300).read()), header=6)
    p = p[p["CÓD."].isin(SIGLAS)]
    return p.pivot_table(index="CÓD.", columns="ANO", values="POP_T")


def pib():
    """PIB a preços correntes por UF, último ano das Contas Regionais (SIDRA 5938, variável 37, mil R$)."""
    df = sidrapy.get_table(table_code="5938", territorial_level="3", ibge_territorial_code="all",
                           variable="37", period="last 1")
    df.columns = df.iloc[0]
    df = df.iloc[1:]
    out = pd.DataFrame({"cod": df["Unidade da Federação (Código)"].astype(int),
                        "uf": df["Unidade da Federação"],
                        "pib": pd.to_numeric(df["Valor"]) * 1e3})
    return out, int(df["Ano"].iloc[0])


def main():
    pop = populacao()
    df, ano_pib = pib()
    ano_pop = pd.Timestamp.today().year
    df["sigla"] = df["cod"].map(SIGLAS)
    df["regiao"] = (df["cod"] // 10).map(REGIOES)
    df["populacao"] = df["cod"].map(pop[ano_pop]).round().astype("int64")
    df["pib_per_capita"] = (df["pib"] / df["cod"].map(pop[ano_pib])).round(0)
    df["participacao_pib"] = (df["pib"] / df["pib"].sum() * 100).round(2)
    df["ano_pib"], df["ano_populacao"] = ano_pib, ano_pop
    df = df[["cod", "sigla", "uf", "regiao", "populacao", "pib", "pib_per_capita", "participacao_pib",
             "ano_pib", "ano_populacao"]].sort_values("cod")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT, index=False)
    print(f"Gravado: {OUT} ({len(df)} UFs, PIB {ano_pib}, população {ano_pop})")


if __name__ == "__main__":
    main()
