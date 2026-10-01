const test = require("node:test");
const assert = require("node:assert");
const {
  buildPrompt,
  buildIterationMessage,
  parseOutputs,
  buildVersions,
} = require("../lib/outputs");

const RESPONSE = `Aqui tienes los entregables.

## DIAGRAMA: Alta de cliente
\`\`\`mermaid
flowchart TD
  A[Inicio] --> B[Alta]
\`\`\`

## DIAGRAMA: Facturación mensual
\`\`\`mermaid
flowchart LR
  X --> Y
\`\`\`

## HISTORIAS DE USUARIO
- **[HU-01]** Como gestor, quiero dar de alta, para facturar.
  - Criterios de aceptacion: ...
### Epica 2
- **[HU-02]** Como cliente, quiero ver facturas.

## Reingeniería y valor de negocio
| # | Situacion actual | Propuesta |
|---|---|---|
| 1 | Manual | Automatizar |

## OTRO: Matriz RACI
| Tarea | R | A |
`;

test("parseOutputs separa varios diagramas y documentos", () => {
  const out = parseOutputs(RESPONSE);
  assert.deepStrictEqual(
    out.diagrams.map((d) => d.title),
    ["Alta de cliente", "Facturación mensual"]
  );
  assert.match(out.diagrams[1].code, /^flowchart LR/);
  assert.deepStrictEqual(
    out.docs.map((d) => d.key),
    ["stories", "reengineering", "custom:Matriz RACI"]
  );
  assert.match(out.docs[0].md, /Epica 2/);
  assert.match(out.docs[0].md, /HU-02/);
  assert.match(out.docs[1].md, /Automatizar/);
  assert.strictEqual(out.docs[2].title, "Matriz RACI");
});

test("parseOutputs acepta bloques mermaid sin encabezado", () => {
  const out = parseOutputs("Texto\n```mermaid\nflowchart TD\nA-->B\n```\n```mermaid\nflowchart TD\nC-->D\n```");
  assert.deepStrictEqual(out.diagrams.map((d) => d.title), ["Diagrama 1", "Diagrama 2"]);
  assert.strictEqual(out.docs.length, 0);
});

test("parseOutputs tolera respuestas vacias o incompletas", () => {
  assert.deepStrictEqual(parseOutputs(""), { diagrams: [], docs: [] });
  const out = parseOutputs("## DIAGRAMA: A\n```mermaid\nflowchart TD\n");
  assert.strictEqual(out.diagrams.length, 0);
});

test("buildPrompt incluye solo los outputs pedidos", () => {
  const p = buildPrompt("Hazlo", "transcripcion", {
    flow: true,
    stories: false,
    reengineering: true,
    custom: "Matriz RACI\nRiesgos",
    diagramsHint: "AS-IS y TO-BE",
  });
  assert.match(p, /## DIAGRAMA:/);
  assert.match(p, /AS-IS y TO-BE/);
  assert.doesNotMatch(p, /## HISTORIAS DE USUARIO/);
  assert.match(p, /## REINGENIERIA Y VALOR DE NEGOCIO/);
  assert.match(p, /## OTRO: Matriz RACI/);
  assert.match(p, /## OTRO: Riesgos/);
  assert.match(p, /### TRANSCRIPCION\ntranscripcion/);
});

test("buildVersions crea una version por iteracion y fusiona la seccion corregida", () => {
  const iter = buildIterationMessage(
    "Anade un paso de validacion",
    "diagram:Alta de cliente",
    "flowchart TD\nA-->B"
  );
  assert.match(iter, /## DIAGRAMA: Alta de cliente/);
  const items = [
    { source: "user", message: "prompt inicial", created_at: 1 },
    { source: "devin", message: "Trabajando en ello...", created_at: 2 },
    { source: "devin", message: RESPONSE, created_at: 3 },
    { source: "user", message: iter, created_at: 4 },
    {
      source: "devin",
      message: "## DIAGRAMA: Alta de cliente\n```mermaid\nflowchart TD\nA-->V[Validar]-->B\n```",
      created_at: 5,
    },
  ];
  const r = buildVersions(items);
  assert.strictEqual(r.versions.length, 2);
  assert.strictEqual(r.lastTurnHasContent, true);
  const [v1, v2] = r.versions;
  assert.strictEqual(v1.label, "Generacion inicial");
  assert.match(v2.label, /Correccion 1: Anade un paso de validacion/);
  assert.strictEqual(v2.diagrams.length, 2);
  assert.match(v2.diagrams[0].code, /Validar/);
  assert.doesNotMatch(v1.diagrams[0].code, /Validar/);
  assert.strictEqual(v2.docs.length, 3);
});

test("buildVersions marca iteracion pendiente sin contenido", () => {
  const r = buildVersions([
    { source: "devin", message: RESPONSE },
    { source: "user", message: buildIterationMessage("Mas historias", "stories") },
    { source: "devin", message: "Voy a revisar las historias." },
  ]);
  assert.strictEqual(r.versions.length, 1);
  assert.strictEqual(r.lastTurnHasContent, false);
  assert.strictEqual(r.lastDevinMessage, "Voy a revisar las historias.");
});
