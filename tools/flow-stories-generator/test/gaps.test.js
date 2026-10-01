const test = require("node:test");
const assert = require("node:assert");
const { buildPrompt, parseOutputs, buildIterationMessage } = require("../lib/outputs");

test("los diagramas no piden badges GAP y los gaps solo se piden de forma expresa", () => {
  const p = buildPrompt("Diagrama AS-IS", "texto", { flow: true });
  assert.doesNotMatch(p, /"badge"\s*:/);
  assert.match(p, /No marques gaps en los diagramas/);
  assert.match(p, /SOLO si la INSTRUCCION DEL USUARIO lo pide expresamente/);
  const g = buildPrompt("Diagrama AS-IS", "texto", { flow: true, gaps: true });
  assert.match(g, /## GAPS/);
  assert.doesNotMatch(g, /SOLO si la INSTRUCCION DEL USUARIO lo pide expresamente/);
});

test("la seccion GAPS se parsea como pestaña propia e iterable", () => {
  const out = parseOutputs("## GAPS\n| # | Flujo | Fase |\n|---|---|---|\n| GAP 1 | AS-IS | 1 |\n");
  assert.strictEqual(out.diagrams.length, 0);
  assert.deepStrictEqual(out.docs.map((d) => [d.key, d.title]), [["gaps", "Gaps"]]);
  assert.match(buildIterationMessage("Añade otro", "gaps", ""), /encabezado exacto: ## GAPS/);
});
