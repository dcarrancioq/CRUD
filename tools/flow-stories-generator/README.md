# Flow & Stories Generator (look & feel Deloitte)

Aplicación web que, a partir de un **prompt** y una **transcripción** (fichero `.docx`/`.txt`/`.md` o texto pegado), genera automáticamente:

- un **diagrama de flujo** del proceso (Mermaid, renderizado en el navegador con la paleta Deloitte), y
- las **historias de usuario** correspondientes.

El diagrama se puede **descargar** en **PNG, JPEG, SVG o GIF**; las historias en **Markdown/TXT**.

La generación se hace "a través de una conversación": el backend crea una sesión de la **Devin API** con el prompt + la transcripción y va recogiendo el resultado.

## Arquitectura

- **Backend** (`server.js`, Node/Express): extrae el texto del `.docx`, construye el prompt con el formato de salida requerido (bloque ```mermaid``` + sección `### HISTORIAS DE USUARIO`), crea la sesión en la Devin API y expone el estado ya parseado.
  - `GET /api/health` — estado de configuración.
  - `POST /api/generate` — crea la sesión (multipart: `file`, `prompt`, `flow`, `stories`, `transcript`).
  - `GET /api/generate/:id` — devuelve `{ status, mermaid, stories }` parseados de la sesión.
- **Frontend** (`public/`): interfaz con branding Deloitte, render de Mermaid, editor del diagrama y descargas.

## API key en el código

La API key va en **`config.js`** (tal y como se pidió). Por seguridad, el repositorio incluye solo un **placeholder**; pega tu key en local:

```js
// config.js
DEVIN_API_KEY: process.env.DEVIN_API_KEY || "PON_AQUI_TU_API_KEY",
```

Genera tu key en `https://deloitte-es.devinenterprise.com/settings` → API Keys.
También puedes usar variables de entorno (`DEVIN_API_KEY`, `DEVIN_API_BASE_URL`, `PORT`).

> No subas una API key real al repositorio.

## Uso

```bash
cd tools/flow-stories-generator
npm install
npm start           # http://localhost:3100
```

1. Escribe la instrucción y sube la transcripción (o pega el texto).
2. Pulsa **Generar**. La app crea la sesión y va mostrando el diagrama y las historias.
3. Descarga el diagrama (PNG/JPEG/SVG/GIF) y las historias (MD/TXT).
