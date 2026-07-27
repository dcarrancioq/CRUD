const express = require("express");
const multer = require("multer");
const path = require("path");
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

async function devinFetch(req, endpoint, options = {}) {
  const { baseUrl, apiKey } = getConfig(req);
  if (!hasValidKey(apiKey)) {
    const err = new Error(
      "Falta la API key de Devin. Ponla en config.js o en la cabecera de la app."
    );
    err.status = 400;
    throw err;
  }
  const headers = Object.assign(
    { Authorization: `Bearer ${apiKey}` },
    options.headers || {}
  );
  const resp = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  const text = await resp.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: resp.status, ok: resp.ok, body };
}

// Extrae texto plano de un .docx (word/document.xml) o de un .txt/.md
function extractText(file) {
  const name = (file.originalname || "").toLowerCase();
  if (name.endsWith(".docx")) {
    const entry = readEntry(file.buffer, "word/document.xml");
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
  return file.buffer.toString("utf-8");
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

    const result = await devinFetch(req, "/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Consulta el estado de la sesion y devuelve el mermaid + historias parseados
app.get("/api/generate/:id", async (req, res) => {
  try {
    const result = await devinFetch(
      req,
      `/session/${encodeURIComponent(req.params.id)}`,
      { method: "GET" }
    );
    if (!result.ok) return send(res, result);

    const j = result.body;
    const messages = j.messages || [];
    const textBlobs = messages
      .map((m) => m.message || m.content || m.text || "")
      .filter(Boolean);
    const combined = textBlobs.join("\n\n");

    const mermaidMatch = combined.match(/```mermaid\s*([\s\S]*?)```/i);
    const mermaid = mermaidMatch ? mermaidMatch[1].trim() : null;

    let stories = null;
    const storiesMatch = combined.match(
      /###\s*HISTORIAS DE USUARIO\s*([\s\S]*?)(?:\n```|$)/i
    );
    if (storiesMatch) stories = storiesMatch[1].trim();

    res.json({
      status: j.status_enum || j.status || "unknown",
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
