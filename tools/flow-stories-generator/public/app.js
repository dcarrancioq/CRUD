const $ = (id) => document.getElementById(id);

// Tema Mermaid con colores Deloitte
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
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

const POLL_MS = 5000;
const MAX_POLL_TICKS = 360;
const IDLE_DETAILS = ["waiting_for_user", "finished"];
const STOPPED_STATUSES = ["exit", "error", "suspended"];

const state = {
  sessionId: null,
  versions: [],
  vIdx: -1,
  tab: null,
  dIdx: 0,
  zoom: 1,
  pollTimer: null,
  pollTicks: 0,
  idleTicks: 0,
  expectedTurns: 1,
  turns: 1,
  pendingFeedback: null,
};

function setStatus(el, msg, cls) {
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(s) {
  return (
    String(s || "salida")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "salida"
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (EMBEDDED) showExportModal(blob, filename, "download");
}

// ---------------------------------------------------------------------------
// Vista previa integrada (iframe): el navegador puede bloquear descargas y
// portapapeles, asi que se ofrece una ventana con el contenido y un enlace
// de descarga servido por el backend.
// ---------------------------------------------------------------------------
const EMBEDDED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

if (EMBEDDED) {
  $("embedBanner").hidden = false;
  $("appUrl").value = location.href;
  $("openTabLink").href = location.href;
}

$("appUrl").addEventListener("focus", (e) => e.target.select());
$("copyUrlBtn").addEventListener("click", async () => {
  $("appUrl").focus();
  $("appUrl").select();
  try {
    await copyText(location.href);
    $("copyUrlBtn").textContent = "Enlace copiado ✓";
  } catch {
    $("copyUrlBtn").textContent = "Selecciona y pulsa Ctrl+C";
  }
});

let exportObjectUrl = null;

function closeExportModal() {
  $("exportModal").hidden = true;
  $("exportBody").innerHTML = "";
  if (exportObjectUrl) URL.revokeObjectURL(exportObjectUrl);
  exportObjectUrl = null;
}

async function uploadExport(blob, filename) {
  const r = await fetch("api/export?name=" + encodeURIComponent(filename), {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return (await r.json()).url;
}

async function showExportModal(blob, filename, mode) {
  const isImage = /^image\//.test(blob.type);
  const body = $("exportBody");
  closeExportModal();
  $("exportTitle").textContent =
    (mode === "copy" ? "Copiar: " : "Descargar: ") + filename;
  if (isImage) {
    exportObjectUrl = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = exportObjectUrl;
    img.alt = filename;
    body.appendChild(img);
    $("exportHint").textContent =
      mode === "copy"
        ? "Haz clic derecho sobre la imagen → «Copiar imagen» y pégala donde quieras."
        : "Si no se ha descargado, pulsa «Descargar fichero», ábrela en una pestaña nueva y guárdala con Ctrl+S, o haz clic derecho sobre la imagen → «Guardar imagen como…».";
  } else {
    const ta = document.createElement("textarea");
    ta.readOnly = true;
    ta.spellcheck = false;
    ta.value = (await blob.text()).replace(/^\ufeff/, "");
    body.appendChild(ta);
    $("exportHint").textContent =
      mode === "copy"
        ? "El texto está seleccionado: si no se ha copiado automáticamente, pulsa Ctrl+C (Cmd+C en Mac)."
        : "Si no se ha descargado, pulsa «Descargar fichero», ábrelo en una pestaña nueva y guárdalo con Ctrl+S, o copia el contenido (Ctrl+A, Ctrl+C).";
  }
  $("exportModal").hidden = false;
  const ta = body.querySelector("textarea");
  if (ta) {
    ta.focus();
    ta.select();
  }
  const link = $("exportLink");
  const openLink = $("exportOpenLink");
  link.hidden = true;
  openLink.hidden = true;
  setStatus($("exportStatus"), "Preparando enlace de descarga…", "busy");
  try {
    link.href = await uploadExport(blob, filename);
    openLink.href = link.href + "?inline=1";
    link.hidden = false;
    openLink.hidden = false;
    setStatus($("exportStatus"), "", "");
  } catch (e) {
    setStatus($("exportStatus"), "No se pudo preparar el enlace: " + e.message, "err");
  }
}

$("exportClose").addEventListener("click", closeExportModal);
$("exportModal").addEventListener("click", (e) => {
  if (e.target === $("exportModal")) closeExportModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("exportModal").hidden) closeExportModal();
});

// ---------------------------------------------------------------------------
// Configuracion / health
// ---------------------------------------------------------------------------
async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    $("cfgHint").textContent = j.hasKey
      ? "Conexión configurada · base: " + j.baseUrl
      : "Aviso: falta la API key en config.js (o variable DEVIN_API_KEY). Base: " + j.baseUrl;
  } catch {
    $("cfgHint").textContent = "";
  }
}
checkHealth();

// ---------------------------------------------------------------------------
// Entradas: ejemplos, documento, audio
// ---------------------------------------------------------------------------
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

function clearDocFile() {
  $("fileInput").value = "";
  $("clearFileBtn").hidden = true;
}

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
    clearDocFile();
    $("loadedHint").textContent =
      "Transcripción cargada: " + name + " (" + (j.text || "").length + " caracteres).";
  } catch (e) {
    $("loadedHint").textContent = "Error: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Cargar";
  }
});

function onDocFileSelected() {
  const f = $("fileInput").files[0];
  $("clearFileBtn").hidden = !f;
  if (f) {
    $("transcript").value = "";
    $("loadedHint").textContent =
      "Fichero seleccionado: " + f.name + " (se usará en lugar del texto).";
  }
}
$("fileInput").addEventListener("change", onDocFileSelected);
$("clearFileBtn").addEventListener("click", () => {
  clearDocFile();
  $("loadedHint").textContent = "Fichero quitado.";
});

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|flac|mp4)$/i;
function isAudioFile(f) {
  return /^(audio|video)\//.test(f.type || "") || AUDIO_EXT.test(f.name || "");
}

function onAudioSelected() {
  const f = $("audioInput").files[0];
  $("transcribeBtn").disabled = !f;
  if (f) {
    const mb = (f.size / 1048576).toFixed(1);
    setStatus($("asrStatus"), `Audio: ${f.name} (${mb} MB). Pulsa Transcribir.`, "busy");
  }
}
$("audioInput").addEventListener("change", onAudioSelected);

function assignFile(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
}

function enableDrop(zone) {
  ["dragover", "dragenter"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("dragging");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("dragging");
    })
  );
  zone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (isAudioFile(f)) {
      assignFile($("audioInput"), f);
      onAudioSelected();
    } else {
      assignFile($("fileInput"), f);
      onDocFileSelected();
    }
  });
}
enableDrop($("fileDrop"));
enableDrop($("audioDrop"));

// ---- Transcripcion de audio (Whisper en un Web Worker) ----
let asrWorker = null;

async function decodeAudio(file) {
  const buf = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("El navegador no soporta Web Audio.");
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(buf);
    const n = audio.numberOfChannels;
    const out = new Float32Array(audio.length);
    for (let c = 0; c < n; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < ch.length; i++) out[i] += ch[i] / n;
    }
    return { samples: out, seconds: audio.duration };
  } catch {
    throw new Error("No se pudo decodificar el audio (formato no soportado por el navegador).");
  } finally {
    ctx.close();
  }
}

function asrProgress(frac) {
  $("asrProgress").hidden = frac == null;
  $("asrBar").style.width = Math.round((frac || 0) * 100) + "%";
}

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m + " min " + String(r).padStart(2, "0") + " s";
}

function resetAsrUi() {
  $("transcribeBtn").disabled = !$("audioInput").files[0];
  $("cancelAsrBtn").hidden = true;
}

$("transcribeBtn").addEventListener("click", async () => {
  const file = $("audioInput").files[0];
  if (!file) return;
  $("transcribeBtn").disabled = true;
  $("cancelAsrBtn").hidden = false;
  asrProgress(0);
  try {
    setStatus($("asrStatus"), "Decodificando audio…", "busy");
    const { samples, seconds } = await decodeAudio(file);
    if (!samples.length) throw new Error("El audio está vacío.");
    const durTxt = fmtDuration(seconds);
    setStatus($("asrStatus"), `Audio de ${durTxt}. Cargando modelo…`, "busy");
    if (!asrWorker) asrWorker = new Worker("asr-worker.js", { type: "module" });
    const worker = asrWorker;
    worker.onerror = (e) => {
      setStatus($("asrStatus"), "Error en la transcripción: " + (e.message || "worker"), "err");
      asrProgress(null);
      resetAsrUi();
      asrWorker = null;
    };
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "model-progress") {
        const frac = m.total ? m.loaded / m.total : 0;
        asrProgress(frac);
        setStatus(
          $("asrStatus"),
          `Descargando modelo (solo la primera vez): ${(m.loaded / 1048576).toFixed(0)} / ${(m.total / 1048576).toFixed(0)} MB`,
          "busy"
        );
      } else if (m.type === "model-ready") {
        asrProgress(0);
        setStatus($("asrStatus"), `Transcribiendo ${durTxt} (${m.device})…`, "busy");
      } else if (m.type === "partial") {
        asrProgress(m.done / m.total);
        $("transcript").value = m.text;
        setStatus(
          $("asrStatus"),
          `Transcribiendo ${durTxt}… ${Math.round((m.done / m.total) * 100)}%`,
          "busy"
        );
      } else if (m.type === "done") {
        $("transcript").value = m.text;
        clearDocFile();
        asrProgress(null);
        resetAsrUi();
        setStatus(
          $("asrStatus"),
          `Transcripción completada (${m.text.length} caracteres). Revísala abajo antes de generar.`,
          "ok"
        );
        $("loadedHint").textContent = "Transcripción obtenida del audio: " + file.name;
      } else if (m.type === "error") {
        asrProgress(null);
        resetAsrUi();
        setStatus($("asrStatus"), "Error en la transcripción: " + m.message, "err");
      }
    };
    worker.postMessage(
      { audio: samples, model: $("asrModel").value, language: $("asrLang").value },
      [samples.buffer]
    );
  } catch (e) {
    asrProgress(null);
    resetAsrUi();
    setStatus($("asrStatus"), "Error: " + e.message, "err");
  }
});

$("cancelAsrBtn").addEventListener("click", () => {
  if (asrWorker) asrWorker.terminate();
  asrWorker = null;
  asrProgress(null);
  resetAsrUi();
  setStatus($("asrStatus"), "Transcripción cancelada.", "err");
});

// ---------------------------------------------------------------------------
// Markdown (renderer minimo con tablas y listas)
// ---------------------------------------------------------------------------
function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => inlineMd(c.trim()));
}

function mdToHtml(md) {
  const lines = escapeHtml(md).split("\n");
  let html = "";
  let listStack = [];
  const closeLists = (toDepth = 0) => {
    while (listStack.length > toDepth) html += `</${listStack.pop().tag}>`;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      closeLists();
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|?\s*$/.test(lines[i]) && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      html +=
        '<div class="table-wrap"><table><thead><tr>' +
        head.map((c) => `<th>${c}</th>`).join("") +
        "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>").join("") +
        "</tbody></table></div>";
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)/);
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)/);
    if (h) {
      closeLists();
      const lvl = Math.min(h[1].length + 1, 6);
      html += `<h${lvl}>${inlineMd(h[2])}</h${lvl}>`;
    } else if (li) {
      const depth = Math.floor(li[1].replace(/\t/g, "  ").length / 2) + 1;
      const tag = /\d/.test(li[2]) ? "ol" : "ul";
      if (listStack.length > depth) closeLists(depth);
      while (listStack.length < depth) {
        listStack.push({ tag });
        html += `<${tag}>`;
      }
      html += `<li>${inlineMd(li[3])}</li>`;
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closeLists();
      html += "<hr />";
    } else if (line.trim() === "") {
      closeLists();
    } else {
      closeLists();
      html += `<p>${inlineMd(line.trim())}</p>`;
    }
  }
  closeLists();
  return html;
}

function mdToPlain(md) {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\|?\s*:?-{2,}[-|:\s]*$/gm, "")
    .replace(/^\s*\|(.*)\|\s*$/gm, (m, row) => row.split("|").map((c) => c.trim()).join("\t"));
}

// ---------------------------------------------------------------------------
// Versiones y pestañas de resultados
// ---------------------------------------------------------------------------
function currentVersion() {
  return state.versions[state.vIdx] || null;
}

function currentDoc() {
  const v = currentVersion();
  return v ? v.docs.find((d) => d.key === state.tab) || null : null;
}

function currentDiagram() {
  const v = currentVersion();
  return v && state.tab === "diagrams" && state.dIdx >= 0 ? v.diagrams[state.dIdx] || null : null;
}

function versionLabel(v, i) {
  const t = v.created_at ? new Date(v.created_at * 1000).toLocaleTimeString() : "";
  const base = v.feedback
    ? `v${i + 1} · ${v.feedback.slice(0, 60)}${v.feedback.length > 60 ? "…" : ""}`
    : `v${i + 1} · Generación inicial`;
  return base + (t ? ` (${t})` : "") + (v.edited ? " · editada" : "");
}

function renderVersions() {
  const sel = $("versionSelect");
  sel.innerHTML = "";
  state.versions.forEach((v, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = versionLabel(v, i);
    sel.appendChild(o);
  });
  sel.value = String(state.vIdx);
  $("versionsBar").hidden = state.versions.length === 0;
}

$("versionSelect").addEventListener("change", () => {
  state.vIdx = Number($("versionSelect").value);
  renderResults();
});

function tabsFor(v) {
  const tabs = [];
  if (v.diagrams.length) tabs.push({ key: "diagrams", title: `Diagramas (${v.diagrams.length})` });
  for (const d of v.docs) tabs.push({ key: d.key, title: d.title });
  return tabs;
}

function renderResults() {
  const v = currentVersion();
  const tabsEl = $("tabs");
  tabsEl.innerHTML = "";
  $("resultsPlaceholder").hidden = !!v;
  if (!v) {
    $("diagramsPanel").hidden = true;
    $("docPanel").hidden = true;
    renderIterTargets();
    renderHistory();
    return;
  }
  const tabs = tabsFor(v);
  if (!tabs.some((t) => t.key === state.tab)) state.tab = tabs.length ? tabs[0].key : null;
  for (const t of tabs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab" + (t.key === state.tab ? " active" : "");
    b.setAttribute("role", "tab");
    b.textContent = t.title;
    b.addEventListener("click", () => {
      state.tab = t.key;
      renderResults();
    });
    tabsEl.appendChild(b);
  }
  $("diagramsPanel").hidden = state.tab !== "diagrams";
  $("docPanel").hidden = state.tab === "diagrams" || !state.tab;
  if (state.tab === "diagrams") renderDiagramsPanel(v);
  else if (state.tab) renderDocPanel();
  renderVersions();
  renderIterTargets();
  renderHistory();
}

// ---- Diagramas ----
let renderSeq = 0;
async function mermaidSvg(code) {
  const { svg } = await mermaid.render("mmd-" + ++renderSeq, code);
  return svg;
}

function renderDiagramsPanel(v) {
  if (state.dIdx >= v.diagrams.length) state.dIdx = 0;
  const list = $("diagramList");
  list.innerHTML = "";
  const mk = (label, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.dIdx === idx ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      state.dIdx = idx;
      renderDiagramsPanel(v);
    });
    list.appendChild(b);
  };
  v.diagrams.forEach((d, i) => mk(`${i + 1}. ${d.title}`, i));
  if (v.diagrams.length > 1) mk("Vista general", -1);

  const overview = state.dIdx === -1;
  $("overview").hidden = !overview;
  $("diagramWrap").hidden = overview;
  $("mermaidEditor").hidden = overview;
  document.querySelectorAll("#diagramsPanel .toolbar").forEach((t) => (t.hidden = overview));
  if (overview) renderOverview(v);
  else {
    const d = v.diagrams[state.dIdx];
    $("mermaidSrc").value = d.code;
    renderDiagram(d.code);
  }
  renderIterTargets();
}

async function renderDiagram(code) {
  const container = $("diagram");
  try {
    container.innerHTML = await mermaidSvg(code);
  } catch (e) {
    container.innerHTML =
      '<p class="status err">Error al renderizar el Mermaid: ' +
      escapeHtml(e.message || String(e)) +
      "</p><p class=\"hint\">Corrige el código en «Ver / editar Mermaid» o pide la corrección en el paso 3.</p>";
  }
  applyZoom();
}

async function renderOverview(v) {
  const grid = $("overview");
  grid.innerHTML = "";
  for (let i = 0; i < v.diagrams.length; i++) {
    const d = v.diagrams[i];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ov-card";
    card.innerHTML = `<span class="ov-title">${i + 1}. ${escapeHtml(d.title)}</span><div class="ov-svg"></div>`;
    card.addEventListener("click", () => {
      state.dIdx = i;
      renderDiagramsPanel(v);
    });
    grid.appendChild(card);
    try {
      card.querySelector(".ov-svg").innerHTML = await mermaidSvg(d.code);
    } catch {
      card.querySelector(".ov-svg").innerHTML = '<p class="status err">Error de sintaxis Mermaid</p>';
    }
  }
}

$("reRenderBtn").addEventListener("click", () => {
  const d = currentDiagram();
  const code = $("mermaidSrc").value;
  if (d && d.code !== code) {
    d.code = code;
    currentVersion().edited = true;
    renderVersions();
  }
  renderDiagram(code);
});

// ---- Documentos (historias, reingenieria, otros) ----
function renderDocPanel() {
  const doc = currentDoc();
  $("docEditor").hidden = true;
  $("docView").hidden = false;
  $("editDocBtn").disabled = !doc;
  $("docView").innerHTML = doc ? mdToHtml(doc.md) : "";
}

$("editDocBtn").addEventListener("click", () => {
  const doc = currentDoc();
  if (!doc) return;
  $("docSrc").value = doc.md;
  $("docView").hidden = true;
  $("docEditor").hidden = false;
});
$("cancelDocBtn").addEventListener("click", renderDocPanel);
$("saveDocBtn").addEventListener("click", () => {
  const doc = currentDoc();
  if (!doc) return;
  if (doc.md !== $("docSrc").value) {
    doc.md = $("docSrc").value;
    currentVersion().edited = true;
    renderVersions();
  }
  renderDocPanel();
  setStatus($("copyStatus"), "Cambios guardados en esta versión.", "ok");
});

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("el navegador bloqueó el portapapeles");
  }
}

$("copyDocBtn").addEventListener("click", async () => {
  const doc = currentDoc();
  if (!doc) return;
  try {
    await copyText(doc.md);
    setStatus($("copyStatus"), "Texto copiado ✓", "ok");
    if (EMBEDDED) showExportModal(new Blob([doc.md], { type: "text/markdown" }), slug(doc.title) + ".md", "copy");
  } catch (e) {
    setStatus($("copyStatus"), "No se pudo copiar automáticamente; cópialo desde la ventana.", "err");
    showExportModal(new Blob([doc.md], { type: "text/markdown" }), slug(doc.title) + ".md", "copy");
  }
});

function docHtmlFile(doc) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>body{font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:960px;margin:32px auto;padding:0 16px;color:#1a1a1a;line-height:1.55}
header{border-bottom:3px solid #86bc25;padding-bottom:8px;margin-bottom:20px}header b{font-size:1.4rem}header b span{color:#86bc25}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #d0d0ce;padding:6px 8px;text-align:left;vertical-align:top}th{background:#e8f4d4}
code{background:#f4f4f2;padding:1px 5px;border-radius:4px}</style></head>
<body><header><b>Deloitte<span>.</span></b> &nbsp; ${escapeHtml(doc.title)}</header>${mdToHtml(doc.md)}</body></html>`;
}

document.querySelectorAll("[data-dls]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const doc = currentDoc();
    if (!doc || !doc.md.trim()) {
      setStatus($("copyStatus"), "No hay contenido que descargar.", "err");
      return;
    }
    const fmt = btn.getAttribute("data-dls");
    const base = `${slug(doc.title)}_v${state.vIdx + 1}`;
    if (fmt === "md") {
      triggerDownload(new Blob([doc.md], { type: "text/markdown;charset=utf-8" }), base + ".md");
    } else if (fmt === "txt") {
      triggerDownload(new Blob(["\ufeff" + mdToPlain(doc.md)], { type: "text/plain;charset=utf-8" }), base + ".txt");
    } else {
      triggerDownload(new Blob([docHtmlFile(doc)], { type: "text/html;charset=utf-8" }), base + ".html");
    }
    setStatus($("copyStatus"), "Descargado " + base + "." + fmt, "ok");
  });
});

// ---------------------------------------------------------------------------
// Exportacion del diagrama
// ---------------------------------------------------------------------------
function getSvgEl() {
  return $("diagram").querySelector("svg");
}

function naturalSize(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) return { w: vb.width, h: vb.height };
  try {
    const b = svg.getBBox();
    if (b.width && b.height) return { w: b.width, h: b.height };
  } catch {}
  const r = svg.getBoundingClientRect();
  return { w: r.width || 800, h: r.height || 600 };
}

function serializeSvg(svg) {
  const clone = svg.cloneNode(true);
  const nat = naturalSize(svg);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", Math.ceil(nat.w));
  clone.setAttribute("height", Math.ceil(nat.h));
  clone.style.maxWidth = "none";
  clone.style.width = "";
  clone.style.backgroundColor = "#ffffff";
  return { str: new XMLSerializer().serializeToString(clone), nat };
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("No se pudo rasterizar el SVG."));
    img.src = url;
  });
}

function canvasSize(nat, scale, maxW) {
  const MAX_SIDE = 16000;
  const MAX_AREA = 60e6;
  let s = scale;
  if (nat.w * s < 1600) s = 1600 / nat.w;
  if (maxW && nat.w * s > maxW) s = maxW / nat.w;
  s = Math.min(s, MAX_SIDE / nat.w, MAX_SIDE / nat.h, Math.sqrt(MAX_AREA / (nat.w * nat.h)));
  return { w: Math.max(1, Math.floor(nat.w * s)), h: Math.max(1, Math.floor(nat.h * s)) };
}

async function rasterize(str, nat, scale, maxW) {
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(str));
  const { w, h } = canvasSize(nat, scale, maxW);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.getImageData(0, 0, 1, 1);
  return canvas;
}

// Algunos navegadores "contaminan" el canvas con las etiquetas HTML de
// Mermaid (foreignObject); en ese caso se re-renderiza con etiquetas SVG.
async function diagramCanvas(scale = 3, maxW) {
  const svg = getSvgEl();
  if (!svg) throw new Error("No hay diagrama para exportar.");
  const { str, nat } = serializeSvg(svg);
  try {
    return await rasterize(str, nat, scale, maxW);
  } catch (e) {
    if (e.name !== "SecurityError") throw e;
    const d = currentDiagram();
    const svgText = await mermaidSvg('%%{init: {"flowchart": {"htmlLabels": false}} }%%\n' + d.code);
    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;left:-99999px;top:0;";
    holder.innerHTML = svgText;
    document.body.appendChild(holder);
    try {
      const s2 = serializeSvg(holder.querySelector("svg"));
      return await rasterize(s2.str, s2.nat, scale, maxW);
    } finally {
      holder.remove();
    }
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("El diagrama es demasiado grande para exportarlo."))),
      type,
      quality
    )
  );
}

async function encodeGif(canvas) {
  const mod = await import("https://cdn.jsdelivr.net/npm/modern-gif@2.0.4/+esm");
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const output = await mod.encode({
    width: canvas.width,
    height: canvas.height,
    maxColors: 255,
    frames: [{ data: imageData.data, delay: 100 }],
  });
  return new Blob([output], { type: "image/gif" });
}

async function downloadDiagram(fmt, btn) {
  const d = currentDiagram();
  const status = $("copyStatus");
  if (!d || !getSvgEl()) {
    setStatus(status, "Selecciona un diagrama renderizado.", "err");
    return;
  }
  const base = `${slug(d.title)}_v${state.vIdx + 1}`;
  btn.disabled = true;
  try {
    setStatus(status, "Preparando " + fmt.toUpperCase() + "…", "busy");
    let blob;
    let ext = fmt;
    if (fmt === "mmd") {
      blob = new Blob([d.code], { type: "text/plain;charset=utf-8" });
    } else if (fmt === "svg") {
      blob = new Blob([serializeSvg(getSvgEl()).str], { type: "image/svg+xml;charset=utf-8" });
    } else if (fmt === "png") {
      blob = await canvasBlob(await diagramCanvas(3), "image/png");
    } else if (fmt === "jpeg") {
      blob = await canvasBlob(await diagramCanvas(3), "image/jpeg", 0.95);
      ext = "jpg";
    } else if (fmt === "gif") {
      blob = await encodeGif(await diagramCanvas(2, 2400));
    }
    triggerDownload(blob, `${base}.${ext}`);
    setStatus(status, `Descargado ${base}.${ext}`, "ok");
  } catch (e) {
    setStatus(status, "Error al descargar: " + e.message, "err");
  } finally {
    btn.disabled = false;
  }
}

document.querySelectorAll("[data-dl]").forEach((btn) => {
  btn.addEventListener("click", () => downloadDiagram(btn.getAttribute("data-dl"), btn));
});

$("copyImgBtn").addEventListener("click", async () => {
  const status = $("copyStatus");
  let imgPromise = null;
  if (!getSvgEl()) {
    setStatus(status, "Selecciona un diagrama renderizado.", "err");
    return;
  }
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error("el navegador no permite copiar imágenes");
    }
    setStatus(status, "Copiando…", "busy");
    const blobPromise = diagramCanvas(3).then((c) => canvasBlob(c, "image/png"));
    imgPromise = blobPromise;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    setStatus(status, "Imagen copiada ✓ pégala donde quieras", "ok");
  } catch (e) {
    setStatus(status, "No se pudo copiar automáticamente (" + e.message + "). Cópiala desde la ventana.", "err");
    try {
      const d = currentDiagram();
      const blob = await (imgPromise || diagramCanvas(3).then((c) => canvasBlob(c, "image/png")));
      showExportModal(blob, `${slug(d ? d.title : "diagrama")}_v${state.vIdx + 1}.png`, "copy");
    } catch (e2) {
      setStatus(status, "No se pudo generar la imagen: " + e2.message, "err");
    }
  }
});

// ---- Zoom y pantalla completa ----
function applyZoom() {
  $("diagram").style.setProperty("--zoom", String(state.zoom));
  $("zoomFitBtn").textContent = state.zoom === 1 ? "Ajustar" : Math.round(state.zoom * 100) + "%";
}
$("zoomInBtn").addEventListener("click", () => {
  state.zoom = Math.min(state.zoom + 0.25, 6);
  applyZoom();
});
$("zoomOutBtn").addEventListener("click", () => {
  state.zoom = Math.max(state.zoom - 0.25, 0.25);
  applyZoom();
});
$("zoomFitBtn").addEventListener("click", () => {
  state.zoom = 1;
  applyZoom();
});

function setPseudoFullscreen(on) {
  $("diagramsPanel").classList.toggle("pseudo-fs", on);
  document.body.classList.toggle("no-scroll", on);
  $("fullscreenBtn").textContent = on ? "Salir de pantalla completa" : "Pantalla completa";
}

$("fullscreenBtn").addEventListener("click", async () => {
  const wrap = $("diagramsPanel");
  if (document.fullscreenElement) return document.exitFullscreen();
  if (wrap.classList.contains("pseudo-fs")) return setPseudoFullscreen(false);
  try {
    if (!wrap.requestFullscreen) throw new Error("sin API");
    await wrap.requestFullscreen();
  } catch {
    setPseudoFullscreen(true);
  }
});
document.addEventListener("fullscreenchange", () => {
  $("fullscreenBtn").textContent = document.fullscreenElement
    ? "Salir de pantalla completa"
    : "Pantalla completa";
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("diagramsPanel").classList.contains("pseudo-fs")) setPseudoFullscreen(false);
});

// ---------------------------------------------------------------------------
// Generacion + polling
// ---------------------------------------------------------------------------
function setBusy(busy) {
  $("generateBtn").disabled = busy;
  $("sendFeedbackBtn").disabled = busy || !state.sessionId || !state.versions.length;
}

function stopPolling() {
  if (state.pollTimer) clearTimeout(state.pollTimer);
  state.pollTimer = null;
  setBusy(false);
}

function applyServerVersions(serverVersions) {
  const before = state.versions.length;
  let changed = false;
  serverVersions.forEach((sv, i) => {
    const sig = JSON.stringify([sv.diagrams, sv.docs]);
    const local = state.versions[i];
    if (local && local.serverSig === sig) return;
    state.versions[i] = {
      label: sv.label,
      target: sv.target,
      feedback: sv.feedback,
      created_at: sv.created_at,
      diagrams: sv.diagrams.map((d) => ({ ...d })),
      docs: sv.docs.map((d) => ({ ...d })),
      serverSig: sig,
    };
    if (i === state.vIdx || i >= before) {
      state.vIdx = i;
      const t = sv.target || "";
      if (t.startsWith("diagram:")) {
        state.tab = "diagrams";
        const idx = sv.diagrams.findIndex((d) => d.title === t.slice(8));
        if (idx >= 0) state.dIdx = idx;
      } else if (t === "new-diagram") {
        state.tab = "diagrams";
        state.dIdx = sv.diagrams.length - 1;
      } else if (t && t !== "all" && sv.docs.some((d) => d.key === t)) {
        state.tab = t;
      }
    }
    changed = true;
  });
  return changed;
}

async function pollOnce() {
  state.pollTicks++;
  const status = state.pendingFeedback ? $("iterStatus") : $("genStatus");
  try {
    const r = await fetch("/api/generate/" + encodeURIComponent(state.sessionId));
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || j.detail || JSON.stringify(j));
    if (j.url) {
      $("sessionLink").href = j.url;
      $("sessionLink").hidden = false;
    }
    state.turns = j.turns || state.turns;
    if (applyServerVersions(j.versions || [])) renderResults();

    const st = String(j.status || "").toLowerCase();
    const idle = IDLE_DETAILS.includes(j.status_detail) || STOPPED_STATUSES.includes(st);
    const turnArrived = (j.turns || 0) >= state.expectedTurns;
    const secs = Math.round((state.pollTicks * POLL_MS) / 1000);
    setStatus(status, `Devin: ${j.status}${j.status_detail ? " / " + j.status_detail : ""} · ${secs}s`, "busy");

    if (turnArrived && idle) {
      if (j.last_turn_has_content) {
        state.pendingFeedback = null;
        stopPolling();
        setStatus(status, "Listo ✓ (versión " + state.versions.length + ")", "ok");
        renderHistory();
        return;
      }
      state.idleTicks++;
      if (state.idleTicks >= 3) {
        stopPolling();
        const msg = (j.last_devin_message || "").slice(0, 300);
        setStatus(
          status,
          "Devin respondió sin el formato esperado" + (msg ? ": «" + msg + "»" : ".") + " Revisa la sesión o reformula la corrección.",
          "err"
        );
        state.pendingFeedback = null;
        renderHistory();
        return;
      }
    } else {
      state.idleTicks = 0;
    }
    if (state.pollTicks >= MAX_POLL_TICKS) {
      stopPolling();
      setStatus(status, "Tiempo de espera agotado. Estado: " + j.status, "err");
      return;
    }
  } catch (e) {
    stopPolling();
    setStatus(status, "Error: " + e.message, "err");
    return;
  }
  state.pollTimer = setTimeout(pollOnce, POLL_MS);
}

function startPolling(expectedTurns) {
  if (state.pollTimer) clearTimeout(state.pollTimer);
  state.pollTicks = 0;
  state.idleTicks = 0;
  state.expectedTurns = expectedTurns;
  setBusy(true);
  state.pollTimer = setTimeout(pollOnce, POLL_MS);
}

$("generateBtn").addEventListener("click", async () => {
  const wantCustom = $("optCustom").checked && $("customOutputs").value.trim();
  if (!$("optFlow").checked && !$("optStories").checked && !$("optReeng").checked && !wantCustom && !$("prompt").value.trim()) {
    setStatus($("genStatus"), "Elige al menos un entregable o escribe una instrucción.", "err");
    return;
  }
  setBusy(true);
  setStatus($("genStatus"), "Creando sesión…", "busy");
  try {
    const form = new FormData();
    form.append("prompt", $("prompt").value);
    form.append("flow", $("optFlow").checked ? "true" : "false");
    form.append("diagramsHint", $("optFlow").checked ? $("diagramsHint").value : "");
    form.append("stories", $("optStories").checked ? "true" : "false");
    form.append("reengineering", $("optReeng").checked ? "true" : "false");
    form.append("custom", wantCustom ? $("customOutputs").value : "");
    const file = $("fileInput").files[0];
    if (file) form.append("file", file);
    if ($("transcript").value.trim()) form.append("transcript", $("transcript").value);

    const r = await fetch("/api/generate", { method: "POST", body: form });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || j.detail || JSON.stringify(j));

    state.sessionId = j.session_id || j.id;
    state.versions = [];
    state.vIdx = -1;
    state.tab = null;
    state.dIdx = 0;
    state.pendingFeedback = null;
    state.turns = 1;
    if (j.url) {
      $("sessionLink").href = j.url;
      $("sessionLink").hidden = false;
    }
    renderResults();
    setStatus($("genStatus"), "Sesión creada. Generando (1-3 min)…", "busy");
    startPolling(1);
  } catch (e) {
    setStatus($("genStatus"), "Error: " + e.message, "err");
    setBusy(false);
  }
});

// ---------------------------------------------------------------------------
// Iteracion
// ---------------------------------------------------------------------------
function renderIterTargets() {
  const sel = $("iterTarget");
  const prev = sel.value;
  sel.innerHTML = "";
  const v = currentVersion();
  const add = (value, text) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    sel.appendChild(o);
  };
  add("all", "Todos los entregables");
  if (v) {
    v.diagrams.forEach((d) => add("diagram:" + d.title, "Diagrama: " + d.title));
    v.docs.forEach((d) => add(d.key, d.title));
  }
  add("new-diagram", "➕ Añadir un diagrama nuevo");
  add("new-doc", "➕ Añadir otro entregable");
  let want = prev;
  const cd = currentDiagram();
  if (state.tab === "diagrams" && cd) want = "diagram:" + cd.title;
  else if (state.tab && state.tab !== "diagrams") want = state.tab;
  if ([...sel.options].some((o) => o.value === want)) sel.value = want;
  $("sendFeedbackBtn").disabled = !!state.pollTimer || !state.sessionId || !state.versions.length;
}

function currentContentFor(target) {
  const v = currentVersion();
  if (!v) return "";
  if (target.startsWith("diagram:")) {
    const d = v.diagrams.find((x) => x.title === target.slice(8));
    return d ? "```mermaid\n" + d.code + "\n```" : "";
  }
  const doc = v.docs.find((x) => x.key === target);
  return doc ? doc.md : "";
}

function renderHistory() {
  const ol = $("history");
  ol.innerHTML = "";
  state.versions.forEach((v, i) => {
    const li = document.createElement("li");
    li.className = i === state.vIdx ? "active" : "";
    const a = document.createElement("button");
    a.type = "button";
    a.className = "link";
    a.textContent = versionLabel(v, i);
    a.addEventListener("click", () => {
      state.vIdx = i;
      renderResults();
    });
    li.appendChild(a);
    ol.appendChild(li);
  });
  if (state.pendingFeedback) {
    const li = document.createElement("li");
    li.className = "pending";
    li.textContent = "En curso: " + state.pendingFeedback;
    ol.appendChild(li);
  }
}

$("sendFeedbackBtn").addEventListener("click", async () => {
  const feedback = $("feedback").value.trim();
  if (!feedback) {
    setStatus($("iterStatus"), "Escribe la corrección.", "err");
    return;
  }
  const target = $("iterTarget").value;
  setBusy(true);
  setStatus($("iterStatus"), "Enviando corrección…", "busy");
  try {
    const r = await fetch("/api/generate/" + encodeURIComponent(state.sessionId) + "/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback, target, current: currentContentFor(target) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || j.detail || "HTTP " + r.status);
    state.pendingFeedback = feedback;
    $("feedback").value = "";
    renderHistory();
    setStatus($("iterStatus"), "Corrección enviada. Esperando la nueva versión…", "busy");
    startPolling(state.turns + 1);
  } catch (e) {
    setStatus($("iterStatus"), "Error: " + e.message, "err");
    setBusy(false);
  }
});

renderResults();
