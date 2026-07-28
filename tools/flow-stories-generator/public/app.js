const $ = (id) => document.getElementById(id);

// Tema Mermaid con colores Deloitte
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "base",
  themeVariables: {
    primaryColor: "#e8f4d4",
    primaryBorderColor: "#86bc25",
    primaryTextColor: "#1a1a1a",
    lineColor: "#53565a",
    secondaryColor: "#26890d",
    tertiaryColor: "#f4f4f2",
    fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
});

let currentSessionId = null;
let pollTimer = null;

function setStatus(el, msg, cls) {
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}

// ---- Configuración / health ----
async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    if (!j.hasKey) {
      $("cfgHint").textContent =
        "Aviso: falta la API key en config.js (o variable DEVIN_API_KEY). Base: " +
        j.baseUrl;
    } else {
      $("cfgHint").textContent = "Conexión configurada · base: " + j.baseUrl;
    }
  } catch {
    $("cfgHint").textContent = "";
  }
}
checkHealth();

// ---- Transcripciones de ejemplo (sin diálogo del sistema) ----
async function loadSamplesList() {
  try {
    const r = await fetch("/api/samples");
    const j = await r.json();
    const samples = j.samples || [];
    if (!samples.length) return;
    const sel = $("sampleSelect");
    sel.innerHTML = "";
    for (const name of samples) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }
    $("sampleRow").hidden = false;
  } catch {
    /* sin ejemplos disponibles */
  }
}
loadSamplesList();

$("loadSampleBtn").addEventListener("click", async () => {
  const name = $("sampleSelect").value;
  if (!name) return;
  const btn = $("loadSampleBtn");
  btn.disabled = true;
  btn.textContent = "Cargando…";
  try {
    const r = await fetch("/api/samples/" + encodeURIComponent(name));
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "No se pudo cargar el ejemplo.");
    $("transcript").value = j.text || "";
    $("fileInput").value = "";
    $("transcriptAdv").open = true;
    $("loadedHint").textContent =
      "Transcripción cargada: " + name + " (" + (j.text || "").length + " caracteres).";
  } catch (e) {
    $("loadedHint").textContent = "Error: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Cargar";
  }
});

// Feedback al elegir un fichero + soporte de arrastrar y soltar
$("fileInput").addEventListener("change", () => {
  const f = $("fileInput").files[0];
  if (f) {
    $("transcript").value = "";
    $("loadedHint").textContent = "Fichero seleccionado: " + f.name;
  }
});

(function enableDrop() {
  const drop = $("fileDrop");
  if (!drop) return;
  ["dragover", "dragenter"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("dragging");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("dragging");
    })
  );
  drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      const dt = new DataTransfer();
      dt.items.add(f);
      $("fileInput").files = dt.files;
      $("transcript").value = "";
      $("loadedHint").textContent = "Fichero seleccionado: " + f.name;
    }
  });
})();

// ---- Render Mermaid ----
async function renderMermaid(src) {
  const container = $("diagram");
  if (!src || !src.trim()) {
    container.innerHTML = '<p class="placeholder">El diagrama aparecerá aquí.</p>';
    return;
  }
  try {
    const { svg } = await mermaid.render("mmd-" + Date.now(), src);
    container.innerHTML = svg;
  } catch (e) {
    container.innerHTML =
      '<p class="status err">Error al renderizar el Mermaid: ' +
      (e.message || e) +
      "</p>";
  }
}

$("reRenderBtn").addEventListener("click", () =>
  renderMermaid($("mermaidSrc").value)
);

// ---- Historias de usuario (markdown mínimo) ----
function renderStories(md) {
  const box = $("stories");
  $("storiesSrc").value = md || "";
  if (!md || !md.trim()) {
    box.innerHTML =
      '<p class="placeholder">Las historias de usuario aparecerán aquí.</p>';
    return;
  }
  box.innerHTML = mdToHtml(md);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mdToHtml(md) {
  const lines = escapeHtml(md).split("\n");
  let html = "";
  let inList = false;
  for (let line of lines) {
    line = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (h) {
      if (inList) { html += "</ul>"; inList = false; }
      const lvl = h[1].length;
      html += `<h${lvl}>${h[2]}</h${lvl}>`;
    } else if (li) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${li[1]}</li>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${line}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

// ---- Generar (crea sesión Devin + polling) ----
$("generateBtn").addEventListener("click", async () => {
  if (pollTimer) clearInterval(pollTimer);
  const btn = $("generateBtn");
  btn.disabled = true;
  setStatus($("genStatus"), "Creando sesión…", "busy");

  try {
    const form = new FormData();
    form.append("prompt", $("prompt").value);
    form.append("flow", $("optFlow").checked ? "true" : "false");
    form.append("stories", $("optStories").checked ? "true" : "false");
    const file = $("fileInput").files[0];
    if (file) form.append("file", file);
    if ($("transcript").value.trim())
      form.append("transcript", $("transcript").value);

    const r = await fetch("/api/generate", { method: "POST", body: form });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || JSON.stringify(j));

    currentSessionId = j.session_id || j.id;
    setStatus(
      $("genStatus"),
      "Sesión creada (" + currentSessionId + "). Generando…",
      "busy"
    );
    startPolling();
  } catch (e) {
    setStatus($("genStatus"), "Error: " + e.message, "err");
    btn.disabled = false;
  }
});

function startPolling() {
  let ticks = 0;
  pollTimer = setInterval(async () => {
    ticks++;
    try {
      const r = await fetch("/api/generate/" + encodeURIComponent(currentSessionId));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || JSON.stringify(j));

      if (j.mermaid) {
        $("mermaidSrc").value = j.mermaid;
        renderMermaid(j.mermaid);
      }
      if (j.stories) renderStories(j.stories);

      const done =
        (j.mermaid || !$("optFlow").checked) &&
        (j.stories || !$("optStories").checked);
      // Estados terminales de la Devin API v3 (no "suspended", que solo
      // indica que Devin está a la espera; seguimos consultando la salida).
      const terminal = ["finished", "blocked", "expired", "completed", "exit", "error"].includes(
        String(j.status).toLowerCase()
      );
      const timedOut = ticks >= 240; // ~20 min de guardia

      setStatus(
        $("genStatus"),
        `Estado: ${j.status} · ${ticks * 5}s`,
        done ? "ok" : "busy"
      );

      if (done || terminal || timedOut) {
        clearInterval(pollTimer);
        pollTimer = null;
        $("generateBtn").disabled = false;
        if (done) setStatus($("genStatus"), "Listo.", "ok");
        else if (timedOut)
          setStatus($("genStatus"), "Tiempo de espera agotado. Estado: " + j.status, "err");
      }
    } catch (e) {
      clearInterval(pollTimer);
      pollTimer = null;
      $("generateBtn").disabled = false;
      setStatus($("genStatus"), "Error: " + e.message, "err");
    }
  }, 5000);
}

// ---- Descargas del diagrama ----
function getSvgEl() {
  return $("diagram").querySelector("svg");
}

function svgString() {
  const svg = getSvgEl();
  if (!svg) return null;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function triggerDownload(blobOrUrl, filename) {
  const url =
    typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function svgToCanvas(scale = 2) {
  const str = svgString();
  if (!str) throw new Error("No hay diagrama para exportar.");
  const svg = getSvgEl();
  const rect = svg.getBoundingClientRect();
  const w = Math.ceil((rect.width || 800) * scale);
  const h = Math.ceil((rect.height || 600) * scale);
  const img = new Image();
  const svgBlob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return canvas;
}

async function downloadDiagram(fmt) {
  try {
    if (!getSvgEl()) throw new Error("Genera primero el diagrama.");
    if (fmt === "svg") {
      triggerDownload(
        new Blob([svgString()], { type: "image/svg+xml" }),
        "diagrama.svg"
      );
      return;
    }
    const canvas = await svgToCanvas(2);
    if (fmt === "png") {
      canvas.toBlob((b) => triggerDownload(b, "diagrama.png"), "image/png");
    } else if (fmt === "jpeg") {
      canvas.toBlob((b) => triggerDownload(b, "diagrama.jpg"), "image/jpeg", 0.95);
    } else if (fmt === "gif") {
      await downloadGif(canvas);
    }
  } catch (e) {
    setStatus($("genStatus"), "Error al descargar: " + e.message, "err");
  }
}

// GIF: usa la librería modern-gif (CDN); si falla, cae a PNG.
async function downloadGif(canvas) {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/modern-gif@2/+esm");
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const output = await mod.encode({
      width: canvas.width,
      height: canvas.height,
      frames: [{ data: imageData.data, delay: 100 }],
    });
    triggerDownload(new Blob([output], { type: "image/gif" }), "diagrama.gif");
  } catch (e) {
    canvas.toBlob((b) => triggerDownload(b, "diagrama.png"), "image/png");
    setStatus(
      $("genStatus"),
      "GIF no disponible (sin conexión al CDN); descargado PNG.",
      "busy"
    );
  }
}

document.querySelectorAll("[data-dl]").forEach((btn) => {
  btn.addEventListener("click", () => downloadDiagram(btn.getAttribute("data-dl")));
});

// ---- Descargas de historias ----
document.querySelectorAll("[data-dls]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const md = $("storiesSrc").value;
    if (!md.trim()) {
      setStatus($("genStatus"), "No hay historias que descargar.", "err");
      return;
    }
    const fmt = btn.getAttribute("data-dls");
    const name = fmt === "md" ? "historias_usuario.md" : "historias_usuario.txt";
    triggerDownload(new Blob([md], { type: "text/plain;charset=utf-8" }), name);
  });
});
