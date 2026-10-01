// Contrato de salida entre la app y Devin: prompts y parser de secciones.

const ITER_MARKER = "[[FSG-ITERACION";
const MAX_TRANSCRIPT = 45000;

const DOC_TITLES = {
  stories: "Historias de usuario",
  reengineering: "Reingenieria y valor de negocio",
  gaps: "Gaps",
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
    "Para cada diagrama usa EXACTAMENTE esta estructura (un bloque ```swimlane``` con JSON valido por diagrama):",
    "## DIAGRAMA: <titulo descriptivo y unico>",
    "```swimlane",
    "{",
    '  "phases": [{"id": "f1", "label": "1. Simulacion y listado"}, {"id": "f2", "label": "2. Envio de propuestas (FC-141)"}],',
    '  "lanes": [{"id": "cli", "label": "Cliente", "sub": "responde fuera del sistema"}, {"id": "ges", "label": "Gestor comercial", "sub": "Retail y Flotas"}, {"id": "cms", "label": "CMS / HOST", "sub": "estados automaticos"}],',
    '  "nodes": [',
    '    {"id": "ini", "lane": "cms", "phase": "f1", "type": "start", "text": "Simulaciones generadas en el CMS"},',
    '    {"id": "sel", "lane": "ges", "phase": "f1", "type": "task", "text": "El gestor selecciona las propuestas y lanza **Enviar propuestas**"},',
    '    {"id": "d1", "lane": "ges", "phase": "f2", "type": "decision", "text": "Todas en SIMULACION o ENVIADO?"},',
    '    {"id": "ko", "lane": "ges", "phase": "f2", "type": "error", "text": "Accion rechazada y aviso al usuario"},',
    '    {"id": "env", "lane": "cms", "phase": "f2", "type": "state", "text": "Propuestas enviadas al cliente", "status": "ENVIADO CLIENTE"}',
    "  ],",
    '  "edges": [',
    '    {"from": "ini", "to": "sel"}, {"from": "sel", "to": "d1", "label": "FC-141 Enviar"},',
    '    {"from": "d1", "to": "ko", "label": "No"}, {"from": "d1", "to": "env", "label": "Si"}',
    "  ]",
    "}",
    "```",
    "REGLAS DE ESTRUCTURA Y FORMATO DEL DIAGRAMA (diagrama de carriles tipo swimlane, como referencia corporativa):",
    "- \"lanes\" = filas horizontales, una por actor, rol, area o sistema que participa (cliente, gestor, aplicaciones, sistemas core, terceros...). Ordenalas de arriba a abajo agrupando los que interactuan mas entre si, para que las flechas recorran la menor distancia posible. \"sub\" es una descripcion breve del carril.",
    "- \"phases\" = columnas de izquierda a derecha con las etapas del proceso, numeradas (\"1. ...\", \"2. ...\") e incluyendo entre parentesis los codigos de funcionalidad/pantalla si existen. Usa entre 3 y 7 fases.",
    "- Cada nodo va en exactamente un carril (lane) y una fase (phase). El flujo avanza de izquierda a derecha por fases y entre carriles de arriba a abajo; evita flechas hacia atras salvo retrocesos reales.",
    "- Tipos de nodo (type): \"task\" (actividad o accion, caja azul), \"state\" (resultado o estado alcanzado, caja verde; pon el estado en MAYUSCULAS en \"status\"), \"error\" (rechazo, error, caducidad o anulacion, caja roja; estado en \"status\"), \"decision\" (rombo amarillo con una pregunta corta terminada en ?), \"parallel\" (rombo con + para bifurcar en ramas paralelas y para volver a unirlas), \"start\" y \"end\" (inicio y fin, caja azul oscuro).",
    "- Textos breves y legibles: maximo unas 15 palabras por caja y 8 por pregunta de decision. Puedes resaltar terminos clave con **negrita**. Usa acentos y signos normales del espanol; escapa las comillas dobles dentro del JSON.",
    "- Toda decision tiene al menos dos flechas de salida con \"label\" (Si/No o la condicion concreta). Etiqueta tambien las flechas que representan una accion, funcionalidad o codigo (p. ej. \"FC-144 Sin respuesta\"). Etiquetas de flecha de maximo 5 palabras.",
    "- Cuando varias actividades ocurran a la vez o en cualquier orden, usa un nodo \"parallel\" para abrir las ramas y otro para unirlas, siempre que haga el flujo mas claro.",
    "- No marques gaps en los diagramas: no uses \"badge\" ni etiquetas GAP en ningun nodo.",
    "- Usa \"style\": \"dashed\" solo para retrocesos, excepciones o flujos alternativos.",
    "- Las flechas se dibujan automaticamente solo en horizontal o vertical (sin diagonales ni curvas). Para que no se crucen ni se pisen: coloca los nodos conectados en la misma fase o en fases contiguas y en el mismo carril o en carriles contiguos, evita flechas que salten muchos carriles o fases, y no repitas conexiones redundantes.",
    "- Responde con JSON estricto: sin comentarios, sin comas finales y con ids cortos sin espacios.",
  ].join("\n");
}

function gapsSection(n) {
  return [
    `\n${n}) GAPS, en Markdown, con esta estructura:`,
    "## GAPS",
    "Una tabla Markdown con las columnas: | # | Flujo | Fase | Actividad o paso | Gap identificado | Impacto | Recomendación |. En Flujo indica AS-IS, TO-BE u otro flujo pedido; en Impacto, Alto, Medio o Bajo.",
    "Identifica huecos funcionales, ambiguedades, reglas no definidas y puntos de dolor de cada fase de los flujos pedidos, numerados GAP 1, GAP 2...",
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
  const wantGaps = !!options.gaps;
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
  if (wantGaps) parts.push(gapsSection(n++));
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
      (wantFlow ? "" : " Si pide diagramas, usa el formato `## DIAGRAMA: <titulo>` con un bloque swimlane.")
  );
  if (!wantGaps) {
    parts.push(
      "Identifica gaps SOLO si la INSTRUCCION DEL USUARIO lo pide expresamente; en ese caso entregalos en una seccion propia, nunca dentro de los diagramas:\n" +
        gapsSection(n)
    );
  }
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
  if (target === "gaps") return "## GAPS";
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
      "- Aplica la correccion y devuelve TODAS las secciones que ya existen, completas y actualizadas, con los mismos encabezados (## DIAGRAMA: <titulo>, ## HISTORIAS DE USUARIO, ## REINGENIERIA Y VALOR DE NEGOCIO, ## GAPS, ## OTRO: <nombre>)."
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
  if (/^gaps?\b/.test(n)) return { type: "doc", key: "gaps" };
  m = n.match(/^otros?(?:\s+outputs?|\s+entregables?)?\s*[:\-–]\s*(.+)$/);
  if (m) {
    const title = raw.slice(raw.length - m[1].length).trim();
    return { type: "doc", key: "custom:" + title, title };
  }
  return null;
}

const DIAGRAM_FENCE = /```[ \t]*(mermaid|swimlane|json)[ \t]*\n([\s\S]*?)```/gi;

// lenient=true acepta tambien bloques ```json``` (solo dentro de secciones DIAGRAMA).
function diagramBlocks(text, lenient) {
  const out = [];
  for (const m of String(text).matchAll(DIAGRAM_FENCE)) {
    const lang = m[1].toLowerCase();
    if (lang === "json" && !(lenient && /"(lanes|nodes)"/.test(m[2]))) continue;
    out.push(m[2].trim());
  }
  return out;
}

function stripDiagramBlocks(text) {
  return String(text).replace(/```[ \t]*(mermaid|swimlane)[ \t]*\n[\s\S]*?```/gi, "");
}

function isSwimlane(code) {
  return /^\s*\{/.test(String(code || ""));
}

function fencedDiagram(code) {
  return "```" + (isSwimlane(code) ? "swimlane" : "mermaid") + "\n" + code + "\n```";
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

  for (const orphanCode of diagramBlocks(orphan.join("\n"), false)) addDiagram(null, orphanCode);

  for (const s of sections) {
    const body = s.body.join("\n").trim();
    if (s.type === "diagram") {
      const blocks = diagramBlocks(body, true);
      blocks.forEach((code, i) =>
        addDiagram(blocks.length > 1 ? `${s.title} (${i + 1})` : s.title, code)
      );
      continue;
    }
    const embedded = diagramBlocks(body, false);
    embedded.forEach((code) => addDiagram(null, code));
    const md = stripDiagramBlocks(body)
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
  isSwimlane,
  fencedDiagram,
};
