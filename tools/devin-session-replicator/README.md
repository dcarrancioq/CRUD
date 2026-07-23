# Devin Session Replicator

Aplicación web para **replicar los pasos de una sesión de Devin vía la Devin API** desde una interfaz guiada.

Reproduce el flujo completo de una sesión:

1. **Configurar conexión** — API Base URL + API Key (se guardan solo en el navegador; el backend actúa de proxy para no exponer la key en el cliente ni persistirla en servidor).
2. **Subir documento** (opcional) — p. ej. la grabación del proceso en `.docx`; se adjunta al prompt.
3. **Crear sesión** — con el prompt inicial (y la URL del adjunto).
4. **Enviar mensajes de seguimiento** — botones rápidos para "Crea un plan…" y "Con Appian", o texto libre.
5. **Ver estado y resultados** — estado, mensajes y salida cruda de la sesión, con auto-refresco opcional.

## Arquitectura

- **Backend** (`server.js`): Express. Hace de proxy a la Devin API y añade la cabecera `Authorization: Bearer <API_KEY>`. La key llega por cabecera desde el navegador (o desde variables de entorno) y **no se persiste** en disco.
- **Frontend** (`public/`): HTML/CSS/JS sin dependencias.

Endpoints del proxy:

| Método | Ruta | Devin API |
|--------|------|-----------|
| GET  | `/api/health` | (comprobación de config) |
| POST | `/api/attachments` | `POST /attachments` |
| POST | `/api/sessions` | `POST /sessions` |
| POST | `/api/sessions/:id/message` | `POST /session/{id}/message` |
| GET  | `/api/sessions/:id` | `GET /session/{id}` |
| GET  | `/api/sessions` | `GET /sessions` |

## Uso

```bash
npm install
npm start
# http://localhost:3000
```

Opcionalmente puedes fijar la configuración por entorno:

```bash
DEVIN_API_BASE_URL="https://tu-org.devinenterprise.com/api/v1" \
DEVIN_API_KEY="<token>" \
PORT=3000 npm start
```

### API Base URL

- Devin Cloud: `https://api.devin.ai/v1`
- Enterprise: la base de tu organización (por ejemplo `https://tu-org.devinenterprise.com/api/v1`).

## Notas

- La API key nunca se escribe en disco en el servidor; el frontend la guarda en `localStorage` del navegador.
- Consulta la referencia oficial: https://docs.devin.ai/api-reference/overview
