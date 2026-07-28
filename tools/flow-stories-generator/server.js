const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { readEntry } = require("./lib/unzip");
const config = require("./config");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig(req) {
  const baseUrl = (
    req.headers["x-devin-base-url"] ||
    config.DEVIN_API_BASE_URL
  ).replace(/\/+$/, "");
  const apiKey = req.headers["x-devin-api-key"] || config.DEVIN_API_KEY;
  return { baseUrl, apiKey };
}

function hasValidKey(apiKey) {
  return apiKey && apiKey !== "PON_AQUI_TU_API_KEY";
}

// Raiz de la API (sin el sufijo de version): .../api/v1 -> .../api
function apiRootFrom(baseUrl) {
  return baseUrl.replace(/\/v\d+[a-z0-9]*$/i, "").replace(/\/+$/, "");
}

// Peticion generica a una URL absoluta de la Devin API
async function apiFetch(url, apiKey, options = {}) {
  const headers = Object.assign(
    { Authorization: `Bearer ${apiKey}` },
    options.headers || {}
  );
  const resp = await fetch(url, { ...options, headers });
  const text = await resp.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: resp.status, ok: resp.ok, body };
}

// El org_id de un service user se descubre una vez y se cachea
const orgIdCache = new Map();
async function resolveOrgId(apiRoot, apiKey) {
  if (config.DEVIN_ORG_ID) return config.DEVIN_ORG_ID;
  const cacheKey = apiRoot + "|" + apiKey;
  if (orgIdCache.has(cacheKey)) return orgIdCache.get(cacheKey);
  const self = await apiFetch(`${apiRoot}/v3/enterprise/self`, apiKey, {
    method: "GET",
  });
  const orgId = self.ok && self.body ? self.body.org_id : null;
  if (!orgId) {
    const err = new Error(
      "No se pudo obtener el org_id del service user (¿API key válida con permiso ManageOrgSessions?)."
    );
    err.status = self.status || 403;
    throw err;
  }
  orgIdCache.set(cacheKey, orgId);
  return orgId;
}

// Prepara el contexto v3 org-scoped a partir de la request
async function orgContext(req) {
  const { baseUrl, apiKey } = getConfig(req);
  if (!hasValidKey(apiKey)) {
    const err = new Error(
      "Falta la API key de Devin. Ponla en config.js o en la cabecera de la app."
    );
    err.status = 400;
    throw err;
  }
  const apiRoot = apiRootFrom(baseUrl);
  const orgId = await resolveOrgId(apiRoot, apiKey);
  const base = `${apiRoot}/v3/organizations/${encodeURIComponent(orgId)}`;
  return { base, apiKey };
}

// Extrae texto plano a partir de un buffer + nombre (.docx / .txt / .md ...)
function extractTextFromBuffer(buffer, filename) {
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".docx")) {
    const entry = readEntry(buffer, "word/document.xml");
    if (!entry) return "";
    const xml = entry.toString("utf-8");
    const paras = xml.split(/<\/w:p>/);
    const lines = [];
    for (const p of paras) {
      const texts = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(
        (m) => m[1]
      );
      const line = texts.join("").trim();
      if (line) lines.push(line);
    }
    return lines.join("\n");
  }
  // txt, md, csv, etc.
  return buffer.toString("utf-8");
}

function extractText(file) {
  return extractTextFromBuffer(file.buffer, file.originalname);
}

// Lista los ficheros de la carpeta de ejemplos (docx/txt/md).
function listSamples() {
  try {
    return fs
      .readdirSync(config.SAMPLES_DIR)
      .filter((f) => /\.(docx|txt|md|csv)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

function buildPrompt(userPrompt, transcript, options) {
  const wantFlow = options.flow !== false;
  const wantStories = options.stories !== false;
  const parts = [];
  parts.push(
    "Eres un analista funcional. A partir de la siguiente TRANSCRIPCION de una reunion/proceso de negocio y de la INSTRUCCION del usuario, produce una respuesta ESTRICTAMENTE en el formato indicado."
  );
  if (userPrompt && userPrompt.trim()) {
    parts.push(`\n### INSTRUCCION DEL USUARIO\n${userPrompt.trim()}`);
  }
  parts.push("\n### FORMATO DE SALIDA OBLIGATORIO");
  if (wantFlow) {
    parts.push(
      [
        "1) Un unico bloque de codigo Mermaid con el diagrama de flujo del proceso, delimitado exactamente asi:",
        "```mermaid",
        "flowchart TD",
        "  ... (nodos y decisiones del proceso) ...",
        "```",
        "Usa etiquetas claras en espanol. Evita acentos y comillas dentro de las etiquetas de los nodos para que Mermaid renderice sin errores.",
      ].join("\n")
    );
  }
  if (wantStories) {
    parts.push(
      [
        "2) A continuacion, una seccion de historias de usuario en Markdown, delimitada exactamente asi:",
        "### HISTORIAS DE USUARIO",
        "- **[HU-01]** Como <rol>, quiero <objetivo>, para <beneficio>.",
        "  - Criterios de aceptacion: ...",
        "(genera todas las historias relevantes)",
      ].join("\n")
    );
  }
  parts.push(
    `\n### TRANSCRIPCION\n${transcript.slice(0, 45000)}${
      transcript.length > 45000 ? "\n...(truncada)" : ""
    }`
  );
  return parts.join("\n");
}

function send(res, result) {
  res.status(result.status).json(result.body);
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

app.get("/api/health", (req, res) => {
  const { baseUrl, apiKey } = getConfig(req);
  res.json({ ok: true, baseUrl, hasKey: hasValidKey(apiKey) });
});

// Lista las transcripciones de ejemplo disponibles en el servidor
app.get("/api/samples", (req, res) => {
  res.json({ samples: listSamples() });
});

// Devuelve el texto extraido de una transcripcion de ejemplo
app.get("/api/samples/:name", (req, res) => {
  const name = path.basename(req.params.name);
  if (!listSamples().includes(name)) {
    return res.status(404).json({ error: "Ejemplo no encontrado." });
  }
  try {
    const buffer = fs.readFileSync(path.join(config.SAMPLES_DIR, name));
    const text = extractTextFromBuffer(buffer, name);
    res.json({ name, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crea la sesion de Devin con el prompt + transcripcion
app.post("/api/generate", upload.single("file"), async (req, res) => {
  try {
    let transcript = "";
    if (req.file) {
      transcript = extractText(req.file);
    } else if (req.body.transcript) {
      transcript = String(req.body.transcript);
    }
    if (!transcript.trim() && !(req.body.prompt || "").trim()) {
      return res
        .status(400)
        .json({ error: "Aporta una transcripcion (fichero/texto) o un prompt." });
    }

    const options = {
      flow: req.body.flow !== "false",
      stories: req.body.stories !== "false",
    };
    const prompt = buildPrompt(req.body.prompt || "", transcript, options);

    const { base, apiKey } = await orgContext(req);
    const result = await apiFetch(`${base}/sessions`, apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, title: "Flow & Stories Generator" }),
    });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Consulta el estado de la sesion y devuelve el mermaid + historias parseados
app.get("/api/generate/:id", async (req, res) => {
  try {
    const { base, apiKey } = await orgContext(req);
    const id = encodeURIComponent(req.params.id);

    const detail = await apiFetch(`${base}/sessions/${id}`, apiKey, {
      method: "GET",
    });
    if (!detail.ok) return send(res, detail);

    const msgs = await apiFetch(
      `${base}/sessions/${id}/messages?first=100`,
      apiKey,
      { method: "GET" }
    );
    const items = (msgs.ok && msgs.body && msgs.body.items) || [];
    const combined = items
      .filter((m) => m.source === "devin")
      .map((m) => m.message || "")
      .filter(Boolean)
      .join("\n\n");

    const mermaidMatch = combined.match(/```mermaid\s*([\s\S]*?)```/i);
    const mermaid = mermaidMatch ? mermaidMatch[1].trim() : null;

    let stories = null;
    const storiesMatch = combined.match(
      /###\s*HISTORIAS DE USUARIO\s*([\s\S]*?)(?:\n```|$)/i
    );
    if (storiesMatch) stories = storiesMatch[1].trim();

    const j = detail.body || {};
    res.json({
      status: j.status || "unknown",
      session_id: j.session_id || req.params.id,
      mermaid,
      stories,
      raw_url: j.url || null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.listen(config.PORT, () => {
  console.log(
    `Flow & Stories Generator escuchando en http://localhost:${config.PORT}`
  );
});
