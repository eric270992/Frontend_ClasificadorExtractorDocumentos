# 🖥️ DocFlow AI — Frontend

Interfaz web (Angular 21 + PrimeNG) de **DocFlow AI**, el sistema de ingesta inteligente de facturas.
Permite **subir facturas** (PDF/JPEG/PNG) y verlas procesadas, y **hacer consultas en lenguaje natural**
sobre los datos. Se comunica con la API del backend.

- **Backend**: https://github.com/eric270992/Backend_ClasificadorExtractorDocumentos

---

## 🚀 Usar la aplicación (recomendado: Docker, todo junto)

La manera más sencilla de ver la aplicación funcionando es levantar **todo el sistema** (base de datos +
API + este frontend) con Docker, desde el repositorio del **backend**:

1. Instala **[Docker](https://www.docker.com/products/docker-desktop/)**.
2. Descarga **`docker-compose.deploy.yml`** del repositorio del backend.
3. Crea un `.env` al lado. Un **único bloque** con todos los campos; según el proveedor LLM que elijas,
   rellenas unos u otros:
   ```env
   # Contraseña de SQL Server (obligatoria).
   MSSQL_SA_PASSWORD=UnaClaveFuerte123!

   # Proveedor del LLM: "Groq" (nube, por defecto) o "Local" (LM Studio / Ollama).
   LLM_PROVIDER=Groq

   # Solo si LLM_PROVIDER=Groq: tu clave (gratis en https://console.groq.com).
   # Si usas el LLM local, deja esta línea vacía o bórrala.
   GROQ_API_KEY=gsk_tu_clave

   # Solo si LLM_PROVIDER=Local: dónde escucha tu servidor LLM y qué modelo cargar.
   LLM_LOCAL_BASEURL=http://host.docker.internal:1234/v1
   LLM_LOCAL_MODEL=qwen/qwen2.5-vl-7b
   ```
4. Levántalo:
   ```bash
   docker compose -f docker-compose.deploy.yml up -d
   ```
5. Abre **http://localhost:8080** → aquí ves **este frontend** ya conectado a la API.

Docker se descarga las imágenes ya publicadas (no hay que compilar nada). Esta app se publica como imagen
`ghcr.io/eric270992/docflow-ai-web` automáticamente con GitHub Actions en cada cambio.

## 🧑‍💻 Desarrollar el frontend solo

Si quieres trabajar solo en el frontend (necesitas el backend en marcha en `http://localhost:5255`):

```bash
npm install
npm start          # ng serve
```

Abre **http://localhost:4200**. El servidor de desarrollo usa un **proxy** (`proxy.conf.json`)
que redirige las llamadas `/api` hacia el backend, evitando problemas de CORS. Si el backend está en otra
dirección, ajusta este fichero.

> Sin el backend en marcha, la app carga pero la lista y las consultas no tendrán datos.

## 🐳 Docker (este repositorio)

Este repo incluye su propio `Dockerfile` (build de producción servido por **nginx**, que además hace de
proxy `/api` hacia el backend) y un workflow de GitHub Actions que publica la imagen en GHCR. La imagen la
consume el `docker-compose.deploy.yml` del backend.

## 🧰 Stack

Angular 21 (standalone) · PrimeNG 21 · TypeScript · nginx (en producción/Docker).

## ✨ Qué hay en la interfaz

- **Subida** de facturas por arrastrar y soltar (PDF/JPEG/PNG).
- **Lista** de facturas con su estado (Validada / Revisión humana / Rechazada) e incidencias.
- **Chat** de consultas en lenguaje natural sobre las facturas.
