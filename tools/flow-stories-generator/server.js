const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { readEntry } = require("./lib/unzip");
const {
  buildPrompt,
  buildIterationMessage,
  buildVersions,
} = require("./lib/outputs");
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

function send(res, result) {
  res.status(result.status).json(result.body);
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

// Ficheros exportados desde el navegador, servidos como descarga normal
// (alternativa cuando el navegador bloquea las descargas generadas en la pagina).
const exportsStore = new Map();
const EXPORT_TTL_MS = 30 * 60 * 1000;

app.post(
  "/api/export",
  express.raw({ type: () => true, limit: "60mb" }),
  (req, res) => {
    const now = Date.now();
    for (const [k, v] of exportsStore) {
      if (now - v.at > EXPORT_TTL_MS) exportsStore.delete(k);
    }
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: "Fichero vacio." });
    }
    const name =
      String(req.query.name || "salida")
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 120) || "salida";
    const id = crypto.randomUUID();
    exportsStore.set(id, {
      name,
      type: req.headers["content-type"] || "application/octet-stream",
      data: req.body,
      at: now,
    });
    res.json({ url: `api/export/${id}/${encodeURIComponent(name)}` });
  }
);

app.get("/api/export/:id/:name?", (req, res) => {
  const item = exportsStore.get(req.params.id);
  if (!item) return res.status(404).send("El fichero ha caducado; vuelve a descargarlo.");
  if (req.query.inline) {
    res.setHeader("Content-Disposition", `inline; filename="${item.name}"`);
    res.setHeader("Content-Security-Policy", "sandbox");
  } else {
    res.attachment(item.name);
  }
  res.type(item.type);
  res.send(item.data);
});

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
        .json({ error: "Aporta una transcripcion (fichero, audio o texto) o un prompt." });
    }

    const options = {
      flow: req.body.flow !== "false",
      stories: req.body.stories !== "false",
      reengineering: req.body.reengineering === "true",
      gaps: req.body.gaps === "true",
      custom: req.body.custom || "",
      diagramsHint: req.body.diagramsHint || "",
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

// Envia una correccion a la sesion existente (iteracion sobre los outputs)
app.post("/api/generate/:id/message", async (req, res) => {
  try {
    const feedback = String((req.body && req.body.feedback) || "").trim();
    if (!feedback) {
      return res.status(400).json({ error: "Escribe la correccion que quieres aplicar." });
    }
    const target = String((req.body && req.body.target) || "all");
    const message = buildIterationMessage(feedback, target, req.body && req.body.current);
    const { base, apiKey } = await orgContext(req);
    const id = encodeURIComponent(req.params.id);
    const result = await apiFetch(`${base}/sessions/${id}/messages`, apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

async function fetchAllMessages(base, id, apiKey) {
  const items = [];
  let after = null;
  for (let page = 0; page < 10; page++) {
    const qs = "first=100" + (after ? "&after=" + encodeURIComponent(after) : "");
    const r = await apiFetch(`${base}/sessions/${id}/messages?${qs}`, apiKey, {
      method: "GET",
    });
    if (!r.ok || !r.body) break;
    items.push(...(r.body.items || []));
    if (!r.body.has_next_page || !r.body.end_cursor) break;
    after = r.body.end_cursor;
  }
  return items;
}

// Estado de la sesion + versiones parseadas (diagramas y documentos)
app.get("/api/generate/:id", async (req, res) => {
  try {
    const { base, apiKey } = await orgContext(req);
    const id = encodeURIComponent(req.params.id);

    const detail = await apiFetch(`${base}/sessions/${id}`, apiKey, {
      method: "GET",
    });
    if (!detail.ok) return send(res, detail);

    const items = await fetchAllMessages(base, id, apiKey);
    const parsed = buildVersions(items);

    const j = detail.body || {};
    res.json({
      status: j.status || "unknown",
      status_detail: j.status_detail || null,
      session_id: j.session_id || req.params.id,
      url: j.url || null,
      versions: parsed.versions,
      turns: parsed.turns,
      last_turn_has_content: parsed.lastTurnHasContent,
      last_devin_message: parsed.lastDevinMessage,
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
