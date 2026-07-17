# 🖥️ DocFlow AI — Frontend

Interfície web (Angular 21 + PrimeNG) de **DocFlow AI**, el sistema d'ingesta intel·ligent de factures.
Permet **pujar factures** (PDF/JPEG/PNG) i veure-les processades, i **fer consultes en llenguatge natural**
sobre les dades. Es comunica amb l'API del backend.

- **Backend**: https://github.com/eric270992/Backend_ClasificadorExtractorDocumentos

---

## 🚀 Fer servir l'aplicació (recomanat: Docker, tot junt)

La manera més senzilla de veure l'aplicació funcionant és aixecar **tot el sistema** (base de dades +
API + aquest frontend) amb Docker, des del repositori del **backend**:

1. Instal·la **[Docker](https://www.docker.com/products/docker-desktop/)**.
2. Descarrega **`docker-compose.deploy.yml`** del repositori del backend.
3. Crea un `.env` al costat amb la teva clau de Groq (gratuïta a
   [console.groq.com](https://console.groq.com)):
   ```env
   GROQ_API_KEY=gsk_la_teva_clau
   MSSQL_SA_PASSWORD=UnaClauForta123!
   ```
4. Aixeca-ho:
   ```bash
   docker compose -f docker-compose.deploy.yml up -d
   ```
5. Obre **http://localhost:8080** → aquí veus **aquest frontend** ja connectat a l'API.

Docker es baixa les imatges ja publicades (no cal compilar res). Aquesta app es publica com a imatge
`ghcr.io/eric270992/docflow-ai-web` automàticament amb GitHub Actions a cada canvi.

## 🧑‍💻 Desenvolupar el frontend sol

Si vols treballar només en el frontend (necessites el backend en marxa a `http://localhost:5255`):

```bash
npm install
npm start          # ng serve
```

Obre **http://localhost:4200**. El servidor de desenvolupament usa un **proxy** (`proxy.conf.json`)
que redirigeix les crides `/api` cap al backend, evitant problemes de CORS. Si el backend és en una
altra adreça, ajusta aquest fitxer.

> Sense el backend en marxa, l'app carrega però la llista i les consultes no tindran dades.

## 🐳 Docker (aquest repositori)

Aquest repo inclou el seu propi `Dockerfile` (build de producció servit per **nginx**, que a més fa de
proxy `/api` cap al backend) i un workflow de GitHub Actions que publica la imatge a GHCR. La imatge la
consumeix el `docker-compose.deploy.yml` del backend.

## 🧰 Stack

Angular 21 (standalone) · PrimeNG 21 · TypeScript · nginx (en producció/Docker).

## ✨ Què hi ha a la interfície

- **Pujada** de factures per arrossegar i deixar anar (PDF/JPEG/PNG).
- **Llista** de factures amb el seu estat (Validada / Revisió humana / Rebutjada) i incidències.
- **Xat** de consultes en llenguatge natural sobre les factures.
