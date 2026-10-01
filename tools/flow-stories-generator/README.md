# Flow & Stories Generator (look & feel Deloitte)

Aplicación web que, a partir de un **prompt** y una **transcripción** (fichero `.docx`/`.txt`/`.md`, texto pegado o **audio transcrito en el navegador**), genera los entregables que se pidan:

- uno o **varios diagramas de flujo** (Mermaid, con la paleta Deloitte), cada uno con su título;
- **historias de usuario**;
- **reingeniería y valor para el negocio** (tabla situación actual → propuesta → valor, impacto, esfuerzo y KPI + quick wins);
- **otros entregables** libres (p. ej. riesgos, RACI, glosario…).

Los resultados se pueden **iterar**: se envía una corrección a la misma sesión de Devin y la app guarda cada respuesta como una **versión** nueva.

## Arquitectura

- **Backend** (`server.js`, Node/Express + `lib/outputs.js`):
  - `GET /api/health`: estado de la configuración.
  - `GET /api/samples`, `GET /api/samples/:name`: transcripciones de ejemplo (`SAMPLES_DIR`).
  - `POST /api/generate`: crea la sesión (multipart: `file`, `transcript`, `prompt`, `flow`, `stories`, `reengineering`, `custom`, `diagramsHint`).
  - `POST /api/generate/:id/message`: envía una corrección (`{ feedback, target, current }`) a la sesión (`POST /v3/organizations/{org}/sessions/{id}/messages`).
  - `GET /api/generate/:id`: devuelve `{ status, versions[], turns }`. Cada versión tiene `diagrams[{title, code}]` y `docs[{key, title, md}]`.
- **Frontend** (`public/`): HTML/CSS/JS sin build. Mermaid, Transformers.js (Whisper) y `modern-gif` se cargan desde CDN.

### Formato de respuesta pedido a Devin

````text
## DIAGRAMA: <título>
```mermaid
flowchart TD
  ...
```
## HISTORIAS DE USUARIO
## REINGENIERIA Y VALOR DE NEGOCIO
## OTRO: <nombre>
````

El parser es tolerante: acepta mayúsculas y minúsculas, acentos y bloques `mermaid` sin encabezado. Cuando la corrección afecta a un solo entregable, Devin devuelve solo esa sección y la app la combina con el resto de la versión anterior.

## API key

La API key se lee de `DEVIN_API_KEY` (o de `config.js` en local). El repositorio solo incluye un placeholder. **No subas una key real al repositorio.**
Otras variables: `DEVIN_API_BASE_URL`, `DEVIN_ORG_ID` (si no se indica, se obtiene con `/v3/enterprise/self`), `PORT` y `SAMPLES_DIR`.

## Uso

```bash
cd tools/flow-stories-generator
npm install
DEVIN_API_KEY=... npm start     # http://localhost:3100
npm test                        # tests del parser y del versionado
```

1. **Transcripción**: sube un documento, elige un ejemplo o **adjunta un audio** (mp3, wav, m4a, ogg, webm, flac) y pulsa **Transcribir**. Whisper se ejecuta en el navegador, con WebGPU si está disponible y WASM si no. El audio no sale del equipo y solo se envía el texto. La primera vez se descarga el modelo (tiny unos 40 MB, base unos 80 MB, small unos 250 MB), que después queda en la caché del navegador. El texto se puede editar antes de generar.
2. **Entregables**: marca diagramas, historias, reingeniería u otros, y describe qué diagramas quieres (p. ej. «AS-IS y TO-BE por fase»).
3. **Generar** (entre 1 y 3 minutos). Los resultados se muestran en pestañas. En *Diagramas* hay un selector por diagrama y una **vista general**, además de zoom, pantalla completa, edición del Mermaid y re-render, descarga en PNG/JPEG/SVG/GIF/.mmd y copia de la imagen. Los documentos se pueden descargar en MD/TXT/HTML, copiar y editar.
4. **Iterar**: elige el entregable afectado (o todos, o añade uno nuevo), escribe la corrección y pulsa **Enviar corrección**. Puedes volver a cualquier versión anterior desde el selector de versiones.

### Descargas y portapapeles en la vista previa integrada

Si la app se abre dentro de un `iframe` (p. ej. la vista previa integrada de Devin), el navegador puede bloquear las descargas y el portapapeles. La app lo detecta, muestra un aviso con el enlace para abrirla en una pestaña normal y, al pulsar Descargar o Copiar, abre una ventana con el contenido (imagen o texto seleccionado), un enlace **Descargar fichero** y otro **Abrir en pestaña nueva** (servidos por `POST /api/export` y `GET /api/export/:id`, que guardan los ficheros en memoria durante 30 minutos).
