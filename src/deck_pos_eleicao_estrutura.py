"""
Séries novas do deck "Pós-eleição 2027 v4": risco geopolítico, juro real ex-ante, demografia,
investimento, indústria de transformação, custo do crédito às empresas e comparações
internacionais (Banco Mundial). Grava data/deck_pos_eleicao/estrutura.json.

    python src/deck_pos_eleicao_estrutura.py
"""
import gzip
import io
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd
import sidrapy
from bcb import sgs

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "deck_pos_eleicao" / "estrutura.json"
GPR_URL = "https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls"
PROJ_URL = ("https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/"
            "projecoes_2024_tab4_indicadores.xlsx")
PAISES_BM = ["BRA", "CHN", "KOR", "USA", "DEU", "JPN", "IND", "MEX", "CHL", "COL", "TUR", "POL", "IDN", "ZAF",
             "WLD", "OED", "UMC"]
INDICADORES_BM = {
    "pd_pib": "GB.XPD.RSDV.GD.ZS",      # gasto em P&D, % do PIB
    "fbcf_pib": "NE.GDI.FTOT.ZS",       # formação bruta de capital fixo, % do PIB
    "poupanca_pib": "NY.GNS.ICTR.ZS",   # poupança bruta, % do PIB
    "transformacao_pib": "NV.IND.MANF.ZS",  # indústria de transformação, % do PIB
    "spread_bancario": "FR.INR.LNDP",   # juro do empréstimo menos juro do depósito, p.p.
}


def get(url, timeout=300):
    b = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}),
                               timeout=timeout).read()
    return gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b


def get_sgs(code, start):
    """Séries diárias do SGS aceitam no máximo 10 anos por consulta: busca em janelas de 9 anos."""
    ini, partes = pd.Timestamp(start), []
    while ini <= pd.Timestamp.today():
        fim = ini + pd.DateOffset(years=9) - pd.Timedelta(days=1)
        for tentativa in range(5):  # API do BCB oscila; tenta de novo
            try:
                partes.append(sgs.get({"v": code}, start=ini.strftime("%Y-%m-%d"), end=fim.strftime("%Y-%m-%d"))["v"])
                break
            except Exception as exc:
                print(f"  SGS {code}: tentativa {tentativa + 1} falhou ({exc})")
                time.sleep(5)
        else:
            raise RuntimeError(f"SGS {code} indisponível")
        ini = fim + pd.Timedelta(days=1)
    s = pd.concat(partes).dropna()
    return s[~s.index.duplicated()]


def gpr():
    d = pd.read_excel(io.BytesIO(get(GPR_URL)))
    d = d[d["month"] >= "2000-01-01"]
    return {"_fonte": "Caldara e Iacoviello (2022), Geopolitical Risk Index, índice mensal (média 1985-2019 = 100). "
                      + GPR_URL,
            "mensal": {m.strftime("%Y-%m"): round(float(v), 1) for m, v in zip(d["month"], d["GPR"])}}


def juro_real():
    """Selic meta (fim do mês) deflacionada pela mediana do Focus para o IPCA 12 meses à frente (suavizada)."""
    selic = get_sgs(432, "2015-01-01").resample("ME").last()
    base = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoInflacao12Meses"
    q = {"$filter": "Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0 and Data ge '2015-01-01'",
         "$format": "json", "$select": "Data,Mediana", "$top": "20000"}
    rows = json.loads(get(base + "?" + urllib.parse.urlencode(q, quote_via=urllib.parse.quote)))["value"]
    exp = pd.Series({pd.Timestamp(r["Data"]): r["Mediana"] for r in rows}).sort_index().resample("ME").last()
    df = pd.DataFrame({"selic": selic, "ipca_esperado_12m": exp}).dropna()
    df["juro_real"] = ((1 + df.selic / 100) / (1 + df.ipca_esperado_12m / 100) - 1) * 100
    return {"_fonte": "BCB: SGS 432 (meta Selic) e Focus, IPCA esperado para 12 meses à frente (mediana suavizada).",
            "mensal": {d.strftime("%Y-%m"): {k: round(float(v), 2) for k, v in r.items()} for d, r in df.iterrows()}}


def demografia():
    p = pd.read_excel(io.BytesIO(get(PROJ_URL)), header=6)
    p = p[p["CÓD."] == 0]
    return {"_fonte": "IBGE, Projeções da População, revisão 2024 (tabela 4, indicadores implícitos).",
            "anual": {int(r.ANO): {"pop": int(r.POP_T), "rdt65": round(float(r.RDT65), 2),
                                   "rdj65": round(float(r.RDJ65), 2), "rdi65": round(float(r.RDI65), 2)}
                      for r in p.itertuples()}}


def contas_nacionais():
    """FBCF/PIB e transformação/VAB a preços correntes, somas de 4 trimestres (CNT, SIDRA 1846)."""
    cls = {"90707": "pib", "93406": "fbcf", "90693": "transformacao", "90705": "vab"}
    df = sidrapy.get_table(table_code="1846", territorial_level="1", ibge_territorial_code="all", variable="585",
                           classifications={"11255": ",".join(cls)}, period="all")
    df.columns = df.iloc[0]
    df = df.iloc[1:]
    col = [c for c in df.columns if c.endswith("(Código)") and c.startswith("Setores")][0]
    t = df.assign(v=pd.to_numeric(df["Valor"]), k=df[col].map(cls)).pivot_table(
        index="Trimestre (Código)", columns="k", values="v").sort_index()
    s4 = t.rolling(4).sum().dropna()
    return {"_fonte": "IBGE, Contas Nacionais Trimestrais, valores correntes (SIDRA 1846), somas de 4 trimestres.",
            "trimestral": {k: {"fbcf_pib": round(r.fbcf / r.pib * 100, 2),
                               "transformacao_vab": round(r.transformacao / r.vab * 100, 2)}
                           for k, r in s4.iterrows()}}


def juros_empresas():
    s = {"juros_pj_livres": get_sgs(20718, "2011-03-01"), "spread_pj_livres": get_sgs(20787, "2011-03-01"),
         "selic": get_sgs(432, "2011-03-01").resample("MS").mean()}
    df = pd.DataFrame(s).dropna()
    return {"_fonte": "BCB: SGS 20718 (taxa média de juros, recursos livres, PJ, % a.a.), 20787 (spread, recursos "
                      "livres, PJ, p.p.) e 432 (meta Selic, média do mês).",
            "mensal": {d.strftime("%Y-%m"): {k: round(float(v), 2) for k, v in r.items()} for d, r in df.iterrows()}}


def banco_mundial():
    out = {"_fonte": "Banco Mundial, World Development Indicators (último ano disponível de cada país, até 2025)."}
    for nome, ind in INDICADORES_BM.items():
        u = (f"https://api.worldbank.org/v2/country/{';'.join(PAISES_BM)}/indicator/{ind}"
             f"?date=2015:2025&format=json&per_page=2000")
        j = json.loads(get(u))
        ult = {}
        for r in j[1]:
            iso = r["countryiso3code"] or {"XT": "UMC"}.get(r["country"]["id"], r["country"]["id"])  # agregados
            ano, v = int(r["date"]), r["value"]
            if v is not None and ano > ult.get(iso, (0, None))[0]:
                ult[iso] = (ano, round(v, 2))
        out[nome] = {"indicador": ind, "valores": {k: {"ano": a, "valor": v} for k, (a, v) in ult.items()}}
    return out


def main():
    dados = {"_coleta": pd.Timestamp.today().strftime("%Y-%m-%d")}
    for nome, f in (("gpr", gpr), ("juro_real", juro_real), ("demografia", demografia),
                    ("contas_nacionais", contas_nacionais), ("juros_empresas", juros_empresas),
                    ("banco_mundial", banco_mundial)):
        print(nome)
        dados[nome] = f()
    OUT.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Gravado:", OUT)


if __name__ == "__main__":
    main()
