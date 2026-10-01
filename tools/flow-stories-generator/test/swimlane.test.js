const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Swimlane = require("../public/swimlane.js");
const { parseOutputs, buildPrompt } = require("../lib/outputs");

const SPEC = fs.readFileSync(path.join(__dirname, "fixtures", "recalculos.json"), "utf8");

function segments(routes) {
  const out = [];
  routes.forEach((r, i) => {
    for (let k = 0; k + 1 < r.length; k++) out.push({ a: r[k], b: r[k + 1], i });
  });
  return out;
}

test("parseSpec normaliza tipos, carriles y fases y tolera comas finales", () => {
  const s = Swimlane.parseSpec(
    '{"phases":["F1"],"lanes":[{"id":"a","label":"A"}],"nodes":[{"id":"x","lane":"a","phase":"F1","type":"rombo","text":"?"},{"id":"y","lane":"Nuevo","phase":"F2","type":"fin"},],"edges":[{"from":"x","to":"y"},{"from":"x","to":"zz"}]}'
  );
  assert.deepStrictEqual(s.nodes.map((n) => n.type), ["decision", "terminal"]);
  assert.deepStrictEqual(s.lanes.map((l) => l.label), ["A", "Nuevo"]);
  assert.deepStrictEqual(s.phases.map((p) => p.label), ["F1", "F2"]);
  assert.strictEqual(s.edges.length, 1);
  assert.throws(() => Swimlane.parseSpec("{no json"), /JSON del diagrama/);
});

test("las flechas son ortogonales y no atraviesan cajas", () => {
  const spec = Swimlane.parseSpec(SPEC);
  const L = Swimlane.computeLayout(spec);
  assert.strictEqual(L.routes.length, spec.edges.length);
  const segs = segments(L.routes);
  for (const s of segs) assert.ok(s.a[0] === s.b[0] || s.a[1] === s.b[1], "segmento diagonal");
  for (const s of segs) {
    const e = spec.edges[s.i];
    for (const n of spec.nodes) {
      if (n === e.from || n === e.to) continue;
      const x1 = Math.min(s.a[0], s.b[0]);
      const x2 = Math.max(s.a[0], s.b[0]);
      const y1 = Math.min(s.a[1], s.b[1]);
      const y2 = Math.max(s.a[1], s.b[1]);
      assert.ok(!(x2 > n.x && x1 < n.x + n.w && y2 > n.y && y1 < n.y + n.h), `atraviesa ${n.id}`);
    }
  }
  let cross = 0;
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const p = segs[i];
      const q = segs[j];
      if (p.i === q.i) continue;
      const ph = p.a[1] === p.b[1];
      if (ph === (q.a[1] === q.b[1])) continue;
      const h = ph ? p : q;
      const v = ph ? q : p;
      if (
        v.a[0] > Math.min(h.a[0], h.b[0]) && v.a[0] < Math.max(h.a[0], h.b[0]) &&
        h.a[1] > Math.min(v.a[1], v.b[1]) && h.a[1] < Math.max(v.a[1], v.b[1])
      )
        cross++;
    }
  assert.ok(cross <= 4, `demasiados cruces: ${cross}`);
});

test("render genera SVG sin foreignObject ni curvas", () => {
  const svg = Swimlane.render(SPEC);
  assert.match(svg, /^<svg[^>]+viewBox/);
  assert.doesNotMatch(svg, /foreignObject/);
  for (const m of svg.matchAll(/<path d="([^"]+)"/g)) assert.doesNotMatch(m[1], /[CQSAcqsa]/);
  assert.match(svg, /GAP 1/);
});

test("parseOutputs acepta bloques swimlane y json dentro de DIAGRAMA", () => {
  const out = parseOutputs(
    "## DIAGRAMA: A\n```swimlane\n" + SPEC + "\n```\n## DIAGRAMA: B\n```json\n{\"lanes\":[],\"nodes\":[{\"id\":\"a\"}]}\n```\n## OTRO: Config\n```json\n{\"x\":1}\n```"
  );
  assert.deepStrictEqual(out.diagrams.map((d) => d.title), ["A", "B"]);
  assert.ok(Swimlane.isSwimlane(out.diagrams[0].code));
  assert.match(out.docs[0].md, /"x":1/);
});

test("buildPrompt pide diagramas de carriles con flechas ortogonales", () => {
  const p = buildPrompt("Proceso", "t", {});
  assert.match(p, /```swimlane/);
  assert.match(p, /"lanes"/);
  assert.match(p, /parallel/);
  assert.match(p, /horizontal o vertical/);
});
