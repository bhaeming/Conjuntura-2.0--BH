# Pacote do Painel Next.js

Conteudo incluido:
- dashboard/: aplicacao Next.js sem node_modules e sem .next
- dashboard/public/data/: dados JSON usados pelo frontend
- data/processed/: dados processados em parquet
- src/makedataset.py: coleta e geracao dos dados
- src/building_features.py: tratamento/features
- assets/geo/: geometria usada no mapa
- requirements.txt: dependencias Python do pipeline atual

Como rodar o painel:
1. cd dashboard
2. npm install
3. npm run dev -- --hostname 127.0.0.1 --port 3000

Como regenerar dados:
1. pip install -r requirements.txt
2. python src/makedataset.py
3. cd dashboard
4. python scripts/export_data.py
