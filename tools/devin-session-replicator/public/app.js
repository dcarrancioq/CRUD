// --- State & config ------------------------------------------------------

const LS_KEY = "devin-replicator-config";

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveConfigLocal(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

let config = loadConfig();
let currentSessionId = null;
let autoRefreshTimer = null;

// --- DOM helpers ---------------------------------------------------------

const $ = (id) => document.getElementById(id);

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

function headers(extra = {}) {
  return Object.assign(
    {
      "x-devin-base-url": config.baseUrl || "",
      "x-devin-api-key": config.apiKey || "",
    },
    extra
  );
}

// --- Step 1: config ------------------------------------------------------

function initConfig() {
  $("baseUrl").value = config.baseUrl || "https://api.devin.ai/v1";
  $("apiKey").value = config.apiKey || "";
}

$("saveConfig").addEventListener("click", async () => {
  config.baseUrl = $("baseUrl").value.trim();
  config.apiKey = $("apiKey").value.trim();
  saveConfigLocal(config);
  setStatus($("configStatus"), "Comprobando…", "");
  try {
    const r = await fetch("/api/health", { headers: headers() });
    const j = await r.json();
    if (j.hasKey) {
      setStatus($("configStatus"), `OK · base: ${j.baseUrl}`, "ok");
    } else {
      setStatus($("configStatus"), "Falta la API key", "err");
    }
  } catch (e) {
    setStatus($("configStatus"), "Error: " + e.message, "err");
  }
});

// --- Step 2: upload ------------------------------------------------------

$("uploadBtn").addEventListener("click", async () => {
  const file = $("fileInput").files[0];
  if (!file) {
    setStatus($("uploadStatus"), "Selecciona un archivo primero", "err");
    return;
  }
  setStatus($("uploadStatus"), "Subiendo…", "");
  try {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/attachments", { method: "POST", headers: headers(), body: form });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || JSON.stringify(j));
    // API may return a string URL or an object
    const url = typeof j === "string" ? j : j.url || j.attachment_url || JSON.stringify(j);
    $("attachmentUrl").value = url;
    $("attachmentUrlWrap").style.display = "block";
    setStatus($("uploadStatus"), "Subido", "ok");
  } catch (e) {
    setStatus($("uploadStatus"), "Error: " + e.message, "err");
  }
});

// --- Step 3: create session ---------------------------------------------

$("createBtn").addEventListener("click", async () => {
  let prompt = $("prompt").value.trim();
  if (!prompt) {
    setStatus($("createStatus"), "Escribe un prompt", "err");
    return;
  }
  const attachUrl = $("attachmentUrl").value.trim();
  if (attachUrl) {
    prompt += `\n\nDocumento adjunto: ${attachUrl}`;
  }
  const payload = { prompt };
  if ($("idempotent").checked) payload.idempotent = true;

  setStatus($("createStatus"), "Creando…", "");
  try {
    const r = await fetch("/api/sessions", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || JSON.stringify(j));
    currentSessionId = j.session_id || j.id;
    $("sessionId").value = currentSessionId;
    $("sessionInfo").style.display = "block";
    const link = j.url || j.session_url;
    if (link) {
      $("sessionLink").href = link;
      $("sessionLink").style.display = "inline";
    } else {
      $("sessionLink").style.display = "none";
    }
    setStatus($("createStatus"), "Sesión creada: " + currentSessionId, "ok");
    refreshSession();
  } catch (e) {
    setStatus($("createStatus"), "Error: " + e.message, "err");
  }
});

// --- Step 4: follow-up messages -----------------------------------------

document.querySelectorAll(".chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("messageText").value = btn.dataset.msg;
  });
});

$("sendMsgBtn").addEventListener("click", async () => {
  if (!currentSessionId) {
    setStatus($("messageStatus"), "Crea una sesión primero", "err");
    return;
  }
  const message = $("messageText").value.trim();
  if (!message) {
    setStatus($("messageStatus"), "Escribe un mensaje", "err");
    return;
  }
  setStatus($("messageStatus"), "Enviando…", "");
  try {
    const r = await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/message`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ message }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || JSON.stringify(j));
    setStatus($("messageStatus"), "Mensaje enviado", "ok");
    $("messageText").value = "";
    refreshSession();
  } catch (e) {
    setStatus($("messageStatus"), "Error: " + e.message, "err");
  }
});

// --- Step 5: results -----------------------------------------------------

async function refreshSession() {
  if (!currentSessionId) {
    setStatus($("resultsStatus"), "No hay sesión activa", "err");
    return;
  }
  setStatus($("resultsStatus"), "Cargando…", "");
  try {
    const r = await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}`, { headers: headers() });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || JSON.stringify(j));

    const status = j.status_enum || j.status || "—";
    const badge = $("statusBadge");
    badge.textContent = status;
    badge.className = "badge " + String(status).toLowerCase();

    const msgs = j.messages || [];
    const box = $("messages");
    box.innerHTML = "";
    msgs.forEach((m) => {
      const div = document.createElement("div");
      const who = (m.type || m.role || "").toLowerCase();
      const isUser = who.includes("user") || who.includes("human");
      div.className = "msg " + (isUser ? "user" : "devin");
      div.innerHTML = `<div class="who">${m.type || m.role || "message"}</div>`;
      const body = document.createElement("div");
      body.textContent = m.message || m.content || m.text || JSON.stringify(m);
      div.appendChild(body);
      box.appendChild(div);
    });

    $("rawOutput").textContent = JSON.stringify(j, null, 2);
    setStatus($("resultsStatus"), "Actualizado " + new Date().toLocaleTimeString(), "ok");
  } catch (e) {
    setStatus($("resultsStatus"), "Error: " + e.message, "err");
  }
}

$("refreshBtn").addEventListener("click", refreshSession);

$("autoRefresh").addEventListener("change", (e) => {
  if (e.target.checked) {
    autoRefreshTimer = setInterval(refreshSession, 5000);
  } else {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
});

// --- Init ----------------------------------------------------------------

initConfig();
