// Contrato de salida entre la app y Devin: prompts y parser de secciones.

const ITER_MARKER = "[[FSG-ITERACION";
const MAX_TRANSCRIPT = 45000;

const DOC_TITLES = {
  stories: "Historias de usuario",
  reengineering: "Reingenieria y valor de negocio",
};

function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatRules() {
  return [
    "REGLAS GENERALES:",
    "- Responde directamente en el chat, en un UNICO mensaje, con las secciones pedidas y nada mas.",
    "- No crees ficheros, repositorios ni pull requests y no ejecutes codigo.",
    "- No hagas preguntas: si falta informacion, asume lo razonable y deja los supuestos por escrito dentro de la seccion correspondiente.",
    "- Cada seccion empieza con un encabezado de nivel 2 EXACTAMENTE como se indica (## ...).",
  ].join("\n");
}

function diagramRules() {
  return [
    "Para cada diagrama usa EXACTAMENTE esta estructura:",
    "## DIAGRAMA: <titulo descriptivo y unico>",
    "```mermaid",
    "flowchart TD",
    "  ... (nodos y decisiones) ...",
    "```",
    "Un bloque ```mermaid``` por diagrama. Usa etiquetas claras en espanol, sin acentos ni comillas dentro de las etiquetas de los nodos, para que Mermaid renderice sin errores.",
  ].join("\n");
}

function customList(custom) {
  return String(custom || "")
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildPrompt(userPrompt, transcript, options = {}) {
  const wantFlow = options.flow !== false;
  const wantStories = options.stories !== false;
  const wantReeng = !!options.reengineering;
  const customs = customList(options.custom);
  const diagramsHint = String(options.diagramsHint || "").trim();

  const parts = [];
  parts.push(
    "Eres un analista funcional senior. A partir de la TRANSCRIPCION de una reunion/proceso de negocio y de la INSTRUCCION del usuario, genera los entregables pedidos ESTRICTAMENTE en el formato indicado."
  );
  if (userPrompt && userPrompt.trim()) {
    parts.push(`\n### INSTRUCCION DEL USUARIO\n${userPrompt.trim()}`);
  }
  parts.push("\n### FORMATO DE SALIDA OBLIGATORIO");
  parts.push(formatRules());

  let n = 1;
  if (wantFlow) {
    parts.push(
      [
        `\n${n++}) DIAGRAMAS DE FLUJO.`,
        diagramsHint
          ? `Diagramas solicitados: ${diagramsHint}. Genera un diagrama por cada uno.`
          : "Genera el diagrama de flujo del proceso. Si la instruccion pide varios diagramas (por subproceso, por rol, AS-IS/TO-BE, etc.), genera uno por cada uno.",
        diagramRules(),
      ].join("\n")
    );
  }
  if (wantStories) {
    parts.push(
      [
        `\n${n++}) HISTORIAS DE USUARIO, en Markdown, con esta estructura:`,
        "## HISTORIAS DE USUARIO",
        "- **[HU-01]** Como <rol>, quiero <objetivo>, para <beneficio>.",
        "  - Criterios de aceptacion: ...",
        "(genera todas las historias relevantes)",
      ].join("\n")
    );
  }
  if (wantReeng) {
    parts.push(
      [
        `\n${n++}) REINGENIERIA ORIENTADA A VALOR DE NEGOCIO, en Markdown, con esta estructura:`,
        "## REINGENIERIA Y VALOR DE NEGOCIO",
        "Una tabla Markdown con las columnas: | # | Situacion actual | Propuesta de reingenieria | Valor para el negocio | Impacto (Alto/Medio/Bajo) | Esfuerzo (Alto/Medio/Bajo) | KPI |",
        "Ordena las propuestas por valor para el negocio y termina con una lista breve de quick wins.",
      ].join("\n")
    );
  }
  for (const c of customs) {
    parts.push(
      [
        `\n${n++}) ${c}, en Markdown, con esta estructura:`,
        `## OTRO: ${c}`,
        "(contenido del entregable)",
      ].join("\n")
    );
  }
  parts.push(
    "\nSi la INSTRUCCION DEL USUARIO pide otros entregables no listados arriba, incluyelos tambien, cada uno como una seccion `## OTRO: <nombre del entregable>`." +
      (wantFlow ? "" : " Si pide diagramas, usa el formato `## DIAGRAMA: <titulo>` con un bloque mermaid.")
  );
  if (!wantFlow) parts.push(diagramRules());

  const t = String(transcript || "");
  parts.push(
    `\n### TRANSCRIPCION\n${t.slice(0, MAX_TRANSCRIPT)}${
      t.length > MAX_TRANSCRIPT ? "\n...(truncada)" : ""
    }`
  );
  return parts.join("\n");
}

// target: "all" | "diagram:<titulo>" | "stories" | "reengineering" | "custom:<titulo>"
function describeTarget(target) {
  if (!target || target === "all") return "todos los entregables";
  if (target.startsWith("diagram:")) return `el diagrama "${target.slice(8)}"`;
  if (target === "new-diagram") return "un diagrama nuevo";
  if (target === "new-doc") return "un entregable nuevo";
  if (target.startsWith("custom:")) return `el entregable "${target.slice(7)}"`;
  return DOC_TITLES[target] ? `la seccion "${DOC_TITLES[target]}"` : target;
}

function headingForTarget(target) {
  if (target.startsWith("diagram:")) return `## DIAGRAMA: ${target.slice(8)}`;
  if (target === "new-diagram") return "## DIAGRAMA: <titulo del nuevo diagrama>";
  if (target === "new-doc") return "## OTRO: <nombre del entregable>";
  if (target === "stories") return "## HISTORIAS DE USUARIO";
  if (target === "reengineering") return "## REINGENIERIA Y VALOR DE NEGOCIO";
  if (target.startsWith("custom:")) return `## OTRO: ${target.slice(7)}`;
  return null;
}

function buildIterationMessage(feedback, target, current) {
  const t = String(target || "all").replace(/[\]\r\n]/g, " ").trim() || "all";
  const lines = [];
  lines.push(`${ITER_MARKER} target=${t}]]`);
  lines.push(`CORRECCION SOLICITADA sobre ${describeTarget(t)}:`);
  lines.push(String(feedback || "").trim());
  lines.push("");
  lines.push(formatRules());
  if (t === "all") {
    lines.push(
      "- Aplica la correccion y devuelve TODAS las secciones completas y actualizadas, con los mismos encabezados (## DIAGRAMA: <titulo>, ## HISTORIAS DE USUARIO, ## REINGENIERIA Y VALOR DE NEGOCIO, ## OTRO: <nombre>)."
    );
  } else {
    lines.push(
      `- Devuelve UNICAMENTE la seccion afectada, completa y actualizada, con el encabezado exacto: ${headingForTarget(t)}`
    );
    lines.push("- Manten el mismo titulo para que la app sustituya la version anterior.");
  }
  if (t.startsWith("diagram:") || t === "new-diagram" || t === "all") {
    lines.push(diagramRules());
  }
  if (current && String(current).trim()) {
    lines.push("");
    lines.push("CONTENIDO ACTUAL (puede incluir ediciones manuales del usuario; partir de el):");
    lines.push(String(current).slice(0, 30000));
  }
  return lines.join("\n");
}

const HEADING_RE = /^\s{0,3}#{1,4}\s*(.+?)\s*#*\s*$/;

function classifyHeading(text) {
  const raw = text.replace(/\*\*/g, "").trim();
  const n = normalize(raw);
  let m = n.match(/^diagrama(?:\s+de\s+flujo)?\s*(?:\d+\s*)?[:\-–]\s*(.*)$/);
  if (m) return { type: "diagram", title: raw.slice(raw.length - m[1].length).trim() };
  if (/^historias?\s+de\s+usuario\b/.test(n)) return { type: "doc", key: "stories" };
  if (/^reingenieria\b/.test(n)) return { type: "doc", key: "reengineering" };
  m = n.match(/^otros?(?:\s+outputs?|\s+entregables?)?\s*[:\-–]\s*(.+)$/);
  if (m) {
    const title = raw.slice(raw.length - m[1].length).trim();
    return { type: "doc", key: "custom:" + title, title };
  }
  return null;
}

function mermaidBlocks(text) {
  return [...String(text).matchAll(/```\s*mermaid\s*\n([\s\S]*?)```/gi)].map((m) =>
    m[1].trim()
  );
}

// Divide la respuesta en diagramas y documentos Markdown.
function parseOutputs(text) {
  const out = { diagrams: [], docs: [] };
  if (!text) return out;
  const lines = String(text).split(/\r?\n/);
  const sections = [];
  let cur = null;
  let inFence = false;
  const orphan = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence && line.match(HEADING_RE);
    const cls = h && classifyHeading(h[1]);
    if (cls) {
      cur = { ...cls, body: [] };
      sections.push(cur);
      continue;
    }
    if (cur) cur.body.push(line);
    else orphan.push(line);
  }

  const addDiagram = (title, code) => {
    const base = title || `Diagrama ${out.diagrams.length + 1}`;
    let t = base;
    let i = 2;
    while (out.diagrams.some((d) => normalize(d.title) === normalize(t))) t = `${base} (${i++})`;
    out.diagrams.push({ title: t, code });
  };

  for (const orphanCode of mermaidBlocks(orphan.join("\n"))) addDiagram(null, orphanCode);

  for (const s of sections) {
    const body = s.body.join("\n").trim();
    if (s.type === "diagram") {
      const blocks = mermaidBlocks(body);
      blocks.forEach((code, i) =>
        addDiagram(blocks.length > 1 ? `${s.title} (${i + 1})` : s.title, code)
      );
      continue;
    }
    const embedded = mermaidBlocks(body);
    embedded.forEach((code) => addDiagram(null, code));
    const md = body
      .replace(/```\s*mermaid\s*\n[\s\S]*?```/gi, "")
      .replace(/\n?```\s*$/, "")
      .trim();
    if (!md) continue;
    const existing = out.docs.find((d) => d.key === s.key);
    if (existing) existing.md += "\n\n" + md;
    else
      out.docs.push({
        key: s.key,
        title: s.title || DOC_TITLES[s.key] || s.key,
        md,
      });
  }
  return out;
}

function mergeOutputs(prev, next, target) {
  if (!prev) return next;
  if (target === "all" && next.diagrams.length && next.docs.length) return next;
  const diagrams = prev.diagrams.map((d) => ({ ...d }));
  const nextDiagrams =
    target && target.startsWith("diagram:") && next.diagrams.length === 1
      ? [{ ...next.diagrams[0], title: target.slice(8) }]
      : next.diagrams;
  for (const d of nextDiagrams) {
    const i = diagrams.findIndex((x) => normalize(x.title) === normalize(d.title));
    if (i >= 0) diagrams[i] = d;
    else diagrams.push(d);
  }
  const docs = prev.docs.map((d) => ({ ...d }));
  for (const d of next.docs) {
    const i = docs.findIndex((x) => normalize(x.key) === normalize(d.key));
    if (i >= 0) docs[i] = d;
    else docs.push(d);
  }
  return { diagrams, docs };
}

function parseIterationHeader(message) {
  const m = String(message || "").match(/\[\[FSG-ITERACION target=([^\]]*)\]\]\s*\n[^\n]*\n([\s\S]*?)(?:\n\n|$)/);
  if (!m) return null;
  return { target: m[1].trim() || "all", feedback: m[2].trim() };
}

// Agrupa los mensajes de la sesion en turnos (generacion inicial + una por
// cada correccion) y construye las versiones acumuladas.
function buildVersions(items) {
  const turns = [{ target: "all", feedback: null, created_at: null, texts: [] }];
  for (const m of items || []) {
    if (m.source === "user") {
      const it = parseIterationHeader(m.message);
      if (it) turns.push({ ...it, created_at: m.created_at || null, texts: [] });
      continue;
    }
    if (m.source === "devin" && m.message) {
      const t = turns[turns.length - 1];
      t.texts.push(m.message);
      if (!t.created_at) t.created_at = m.created_at || null;
    }
  }
  const versions = [];
  let acc = null;
  turns.forEach((t, idx) => {
    const parsed = parseOutputs(t.texts.join("\n\n"));
    if (!parsed.diagrams.length && !parsed.docs.length) return;
    acc = mergeOutputs(acc, parsed, t.target);
    versions.push({
      turn: idx,
      label: idx === 0 ? "Generacion inicial" : `Correccion ${idx}: ${t.feedback || ""}`.trim(),
      target: t.target,
      feedback: t.feedback,
      created_at: t.created_at,
      diagrams: acc.diagrams,
      docs: acc.docs,
    });
  });
  const last = turns[turns.length - 1];
  return {
    versions,
    turns: turns.length,
    lastTurnHasContent: versions.length > 0 && versions[versions.length - 1].turn === turns.length - 1,
    lastDevinMessage: last.texts.length ? last.texts[last.texts.length - 1] : null,
  };
}

module.exports = {
  ITER_MARKER,
  buildPrompt,
  buildIterationMessage,
  parseOutputs,
  mergeOutputs,
  buildVersions,
  parseIterationHeader,
  customList,
};
