const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// --- Helpers -------------------------------------------------------------

function getConfig(req) {
  // Config is provided per-request via headers so the key never gets persisted
  // on the server. Falls back to env vars for convenience.
  const baseUrl = (req.headers["x-devin-base-url"] || process.env.DEVIN_API_BASE_URL || "https://api.devin.ai/v1").replace(/\/+$/, "");
  const apiKey = req.headers["x-devin-api-key"] || process.env.DEVIN_API_KEY || "";
  return { baseUrl, apiKey };
}

async function devinFetch(req, endpoint, options = {}) {
  const { baseUrl, apiKey } = getConfig(req);
  if (!apiKey) {
    const err = new Error("Missing API key. Configure it in the UI first.");
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

function send(res, result) {
  res.status(result.status).json(result.body);
}

// --- Routes --------------------------------------------------------------

// Health/config check
app.get("/api/health", (req, res) => {
  const { baseUrl, apiKey } = getConfig(req);
  res.json({ baseUrl, hasKey: Boolean(apiKey) });
});

// Upload an attachment (e.g. the process recording .docx) to Devin
app.post("/api/attachments", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const form = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream",
    });
    form.append("file", blob, req.file.originalname);
    const result = await devinFetch(req, "/attachments", { method: "POST", body: form });
    // The API returns the attachment URL (as a JSON string or object).
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Create a session with a prompt
app.post("/api/sessions", async (req, res) => {
  try {
    const result = await devinFetch(req, "/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Send a follow-up message to a session
app.post("/api/sessions/:id/message", async (req, res) => {
  try {
    const result = await devinFetch(req, `/session/${encodeURIComponent(req.params.id)}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Get session details (status, messages, outputs)
app.get("/api/sessions/:id", async (req, res) => {
  try {
    const result = await devinFetch(req, `/session/${encodeURIComponent(req.params.id)}`, {
      method: "GET",
    });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// List recent sessions
app.get("/api/sessions", async (req, res) => {
  try {
    const q = req.query.limit ? `?limit=${encodeURIComponent(req.query.limit)}` : "";
    const result = await devinFetch(req, `/sessions${q}`, { method: "GET" });
    send(res, result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Devin Session Replicator running on http://localhost:${PORT}`);
});
