// Diagramas de carriles (swimlanes): carriles por actor/sistema, columnas por
// fase, flechas ortogonales enrutadas evitando cajas y minimizando cruces.
// Funciona en el navegador (window.Swimlane) y en Node (module.exports).
(function (root) {
  "use strict";

  const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const S = {
    font: 17,
    lineH: 23,
    labelFont: 14,
    labelLineH: 18,
    labelMaxW: 170,
    headFont: 16,
    headLineH: 21,
    laneFont: 18,
    laneSubFont: 14,
    laneHeadW: 220,
    colW: 360,
    nodeW: 266,
    diamondW: 290,
    parallelW: 64,
    padX: 14,
    padY: 12,
    lanePadY: 42,
    slotGap: 74,
    margin: 18,
    minLaneH: 120,
  };

  const STYLE = {
    task: { fill: "#eef4fb", stroke: "#3d6497", text: "#1b2a3a" },
    state: { fill: "#eef7ec", stroke: "#3c9a3c", text: "#1b2a3a" },
    error: { fill: "#fdeeee", stroke: "#c84a4a", text: "#1b2a3a" },
    decision: { fill: "#fffaea", stroke: "#d9a521", text: "#1b2a3a" },
    parallel: { fill: "#fffaea", stroke: "#d9a521", text: "#1b2a3a" },
    terminal: { fill: "#12355b", stroke: "#12355b", text: "#ffffff" },
  };
  const EDGE = "#2f3b4c";
  const EDGE_ALT = "#d9822b";
  const BADGE = "#e8590c";

  const TYPE_ALIASES = {
    task: "task", tarea: "task", actividad: "task", activity: "task", action: "task", accion: "task", paso: "task", step: "task",
    state: "state", estado: "state", status: "state",
    error: "error", exception: "error", excepcion: "error", rechazo: "error", reject: "error",
    decision: "decision", gateway: "decision", rombo: "decision", condicion: "decision", exclusive: "decision", xor: "decision",
    parallel: "parallel", paralelo: "parallel", and: "parallel", fork: "parallel", join: "parallel",
    start: "terminal", inicio: "terminal", end: "terminal", fin: "terminal", terminal: "terminal",
  };

  function norm(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function isSwimlane(code) {
    return /^\s*(```\s*\w*\s*)?\{/.test(String(code || ""));
  }

  // ---------------------------------------------------------------------------
  // Especificacion
  // ---------------------------------------------------------------------------
  function parseSpec(code) {
    let src = String(code || "")
      .trim()
      .replace(/^```\s*\w*\s*\n?/, "")
      .replace(/```\s*$/, "");
    src = src.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
    let raw;
    try {
      raw = JSON.parse(src);
    } catch (e) {
      throw new Error("El JSON del diagrama no es válido: " + e.message);
    }
    if (!raw || typeof raw !== "object") throw new Error("El diagrama está vacío.");

    const mkList = (arr, kind) =>
      (Array.isArray(arr) ? arr : []).map((x, i) => {
        if (typeof x === "string") return { id: x, label: x, sub: "" };
        const label = String(x.label || x.name || x.title || x.id || `${kind} ${i + 1}`);
        return {
          id: String(x.id != null ? x.id : label),
          label,
          sub: String(x.sub || x.subtitle || x.description || x.desc || ""),
        };
      });
    const phases = mkList(raw.phases || raw.fases || raw.columns, "Fase");
    const lanes = mkList(raw.lanes || raw.carriles || raw.actors || raw.actores, "Carril");

    const resolve = (list, ref, kind) => {
      if (ref == null || ref === "") {
        if (!list.length) list.push({ id: kind, label: kind, sub: "" });
        return 0;
      }
      if (typeof ref === "number" && list[ref - 1]) return ref - 1;
      const r = norm(ref);
      let i = list.findIndex((x) => norm(x.id) === r);
      if (i < 0) i = list.findIndex((x) => norm(x.label) === r);
      if (i < 0) {
        list.push({ id: String(ref), label: String(ref), sub: "" });
        i = list.length - 1;
      }
      return i;
    };

    const nodes = [];
    const byId = new Map();
    for (const n of Array.isArray(raw.nodes || raw.nodos) ? raw.nodes || raw.nodos : []) {
      if (!n) continue;
      const id = String(n.id != null ? n.id : `n${nodes.length + 1}`);
      if (byId.has(id)) continue;
      const type = TYPE_ALIASES[norm(n.type || n.tipo || "task")] || "task";
      const node = {
        id,
        type,
        lane: resolve(lanes, n.lane != null ? n.lane : n.carril, "Proceso"),
        phase: resolve(phases, n.phase != null ? n.phase : n.fase, "Proceso"),
        text: String(n.text || n.label || n.texto || n.name || (type === "parallel" ? "" : id)),
        status: String(n.status || n.estado || ""),
        badge: String(n.badge || n.gap || ""),
      };
      nodes.push(node);
      byId.set(id, node);
    }
    if (!nodes.length) throw new Error("El diagrama no tiene nodos.");

    const edges = [];
    for (const e of Array.isArray(raw.edges || raw.flechas || raw.links) ? raw.edges || raw.flechas || raw.links : []) {
      if (!e) continue;
      const from = byId.get(String(e.from != null ? e.from : e.source));
      const to = byId.get(String(e.to != null ? e.to : e.target));
      if (!from || !to || from === to) continue;
      const st = norm(e.style || e.estilo || "");
      edges.push({
        from,
        to,
        label: String(e.label || e.texto || e.text || ""),
        dashed: !!e.dashed || /dash|discont|punte|back|retro|altern/.test(st),
      });
    }
    return { title: String(raw.title || raw.titulo || ""), phases, lanes, nodes, edges };
  }

  // ---------------------------------------------------------------------------
  // Texto
  // ---------------------------------------------------------------------------
  let ctx2d = null;
  function measure(text, size, bold) {
    if (typeof document !== "undefined" && document.createElement) {
      if (!ctx2d) ctx2d = document.createElement("canvas").getContext("2d");
      ctx2d.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
      return ctx2d.measureText(text).width;
    }
    return String(text).length * size * (bold ? 0.6 : 0.54);
  }

  // "texto **negrita** texto" -> [{w, b}]
  function tokens(text, forceBold) {
    const out = [];
    String(text || "")
      .replace(/\r/g, "")
      .split(/(\*\*[^*]+\*\*)/)
      .forEach((part) => {
        const bold = forceBold || /^\*\*[^*]+\*\*$/.test(part);
        const clean = bold && !forceBold ? part.slice(2, -2) : part;
        clean
          .replace(/\*/g, "")
          .split(/(\n)|\s+/)
          .forEach((w) => {
            if (w === "\n") out.push({ br: true });
            else if (w) out.push({ w, b: bold });
          });
      });
    return out;
  }

  function wrap(text, maxW, size, forceBold) {
    const lines = [];
    let line = [];
    let width = 0;
    const space = measure(" ", size, false);
    for (const t of tokens(text, forceBold)) {
      if (t.br) {
        lines.push(line);
        line = [];
        width = 0;
        continue;
      }
      const w = measure(t.w, size, t.b);
      if (line.length && width + space + w > maxW) {
        lines.push(line);
        line = [];
        width = 0;
      }
      width += (line.length ? space : 0) + w;
      line.push(t);
    }
    if (line.length) lines.push(line);
    return lines;
  }

  function lineWidth(line, size) {
    const space = measure(" ", size, false);
    return line.reduce((a, t, i) => a + measure(t.w, size, t.b) + (i ? space : 0), 0);
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  function sizeNode(n) {
    if (n.type === "parallel") {
      n.w = S.parallelW;
      n.h = S.parallelW;
      n.lines = [];
      return;
    }
    if (n.type === "decision") {
      n.w = S.diamondW;
      n.lines = wrap(n.text, n.w * 0.56, S.font - 1, false);
      const th = n.lines.length * (S.lineH - 2);
      n.h = Math.max(96, Math.round(th * 2.25 + 12));
      return;
    }
    n.w = S.nodeW;
    const bold = n.type === "terminal";
    n.lines = wrap(n.text, n.w - 2 * S.padX, S.font, bold);
    n.statusLines = n.status ? wrap(n.status.toUpperCase(), n.w - 2 * S.padX, S.font, true) : [];
    const count = n.lines.length + n.statusLines.length;
    n.h = Math.max(n.type === "terminal" ? 64 : 52, count * S.lineH + 2 * S.padY);
  }

  function computeLayout(spec) {
    const { phases, lanes, nodes, edges } = spec;
    nodes.forEach(sizeNode);

    const adj = new Map(nodes.map((n) => [n, []]));
    for (const e of edges) {
      adj.get(e.from).push(e.to);
      adj.get(e.to).push(e.from);
    }
    const cells = new Map();
    for (const n of nodes) {
      const k = n.lane + "|" + n.phase;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(n);
    }
    const laneSlots = lanes.map(() => 1);
    for (const list of cells.values()) {
      laneSlots[list[0].lane] = Math.max(laneSlots[list[0].lane], list.length);
    }

    // Orden dentro de cada celda (baricentro) y asignacion de filas (slots)
    nodes.forEach((n) => {
      const list = cells.get(n.lane + "|" + n.phase);
      n.slot = list.indexOf(n);
    });
    const gpos = (n) => n.lane + (n.slot + 0.5) / (laneSlots[n.lane] + 0.5);
    for (let iter = 0; iter < 6; iter++) {
      for (const list of cells.values()) {
        if (list.length < 2) continue;
        const key = new Map();
        list.forEach((n, i) => {
          const nb = adj.get(n).filter((m) => !(m.lane === n.lane && m.phase === n.phase));
          key.set(n, nb.length ? nb.reduce((a, m) => a + gpos(m), 0) / nb.length + i * 1e-3 : gpos(n));
        });
        for (let k = 0; k < list.length; k++) {
          for (const e of edges) {
            if (e.from.lane === e.to.lane && e.from.phase === e.to.phase && key.has(e.from) && key.has(e.to)) {
              if (key.get(e.to) <= key.get(e.from)) key.set(e.to, key.get(e.from) + 1e-3);
            }
          }
        }
        list.sort((a, b) => key.get(a) - key.get(b));
      }
      for (const list of cells.values()) {
        const L = laneSlots[list[0].lane];
        let prev = -1;
        list.forEach((n, i) => {
          const same = adj.get(n).filter((m) => m.lane === n.lane && m.phase !== n.phase);
          const desired = same.length
            ? Math.round(same.reduce((a, m) => a + m.slot, 0) / same.length)
            : iter === 0
            ? i
            : n.slot;
          n.slot = Math.max(prev + 1, Math.min(desired, L - (list.length - i)));
          prev = n.slot;
        });
      }
    }

    // Altura de cabeceras
    const headLines = phases.map((p) => wrap(p.label.toUpperCase(), S.colW - 24, S.headFont, true));
    const headH = Math.max(1, ...headLines.map((l) => l.length)) * S.headLineH + 30;

    // Altura de carriles por slot
    let y = headH;
    const laneBox = lanes.map((ln, li) => {
      const slotH = new Array(laneSlots[li]).fill(0);
      for (const n of nodes) if (n.lane === li) slotH[n.slot] = Math.max(slotH[n.slot], n.h);
      const used = slotH.filter((h) => h > 0);
      const titleLines = wrap(ln.label, S.laneHeadW - 36, S.laneFont, true);
      const subLines = ln.sub ? wrap(ln.sub, S.laneHeadW - 36, S.laneSubFont, false) : [];
      const headTextH = titleLines.length * 23 + subLines.length * 18 + 40;
      const content = used.reduce((a, h) => a + h, 0) + Math.max(0, used.length - 1) * S.slotGap;
      const h = Math.max(S.minLaneH, headTextH, content + 2 * S.lanePadY);
      const box = { y, h, slotH, titleLines, subLines };
      y += h;
      return box;
    });
    const height = y + 2;
    const width = S.laneHeadW + phases.length * S.colW + 4;

    for (const n of nodes) {
      const lb = laneBox[n.lane];
      const used = lb.slotH.map((h, i) => [h, i]).filter(([h]) => h > 0);
      const content = used.reduce((a, [h]) => a + h, 0) + Math.max(0, used.length - 1) * S.slotGap;
      let yy = lb.y + (lb.h - content) / 2;
      for (const [h, i] of used) {
        if (i === n.slot) {
          n.y = Math.round(yy + (h - n.h) / 2);
          break;
        }
        yy += h + S.slotGap;
      }
      n.x = Math.round(S.laneHeadW + n.phase * S.colW + (S.colW - n.w) / 2);
      n.cx = n.x + n.w / 2;
      n.cy = n.y + n.h / 2;
    }

    const routes = routeEdges(spec, { width, height, headH, laneBox });
    return { width, height, headH, headLines, laneBox, routes };
  }

  // ---------------------------------------------------------------------------
  // Enrutado ortogonal (A* sobre rejilla de canales)
  // ---------------------------------------------------------------------------
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];

  function ports(n) {
    const out = [];
    const r2 = (v) => Math.round(v * 2) / 2;
    const add = (x, y, dir, pen) => out.push({ x: r2(x), y: r2(y), dir, pen });
    if (n.type === "decision" || n.type === "parallel") {
      add(n.x + n.w, n.cy, 0, 0);
      add(n.cx, n.y + n.h, 1, 0);
      add(n.x, n.cy, 2, 0);
      add(n.cx, n.y, 3, 0);
      return out;
    }
    for (const f of [0, -0.3, 0.3]) {
      const pen = f ? 18 : 0;
      add(n.cx + f * n.w, n.y + n.h, 1, pen);
      add(n.cx + f * n.w, n.y, 3, pen);
    }
    add(n.x + n.w, n.cy, 0, 0);
    add(n.x, n.cy, 2, 0);
    if (n.h > 90) {
      for (const f of [-0.25, 0.25]) {
        add(n.x + n.w, n.cy + f * n.h, 0, 18);
        add(n.x, n.cy + f * n.h, 2, 18);
      }
    }
    return out;
  }

  class Heap {
    constructor() {
      this.k = [];
      this.v = [];
    }
    push(key, val) {
      const k = this.k;
      const v = this.v;
      let i = k.length;
      k.push(key);
      v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p];
        v[i] = v[p];
        i = p;
      }
      k[i] = key;
      v[i] = val;
    }
    pop() {
      const k = this.k;
      const v = this.v;
      const top = v[0];
      const lk = k.pop();
      const lv = v.pop();
      if (k.length) {
        let i = 0;
        const n = k.length;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= n) break;
          if (c + 1 < n && k[c + 1] < k[c]) c++;
          if (k[c] >= lk) break;
          k[i] = k[c];
          v[i] = v[c];
          i = c;
        }
        k[i] = lk;
        v[i] = lv;
      }
      return top;
    }
    minKey() {
      return this.k[0];
    }
    get size() {
      return this.k.length;
    }
  }

  function routeEdges(spec, frame) {
    const { nodes, edges, phases } = spec;
    const m = S.margin;
    const xsSet = new Set();
    const ysSet = new Set();
    const ax = (v) => xsSet.add(Math.round(v * 2) / 2);
    const ay = (v) => ysSet.add(Math.round(v * 2) / 2);
    const allPorts = new Map();
    for (const n of nodes) {
      ax(n.x - m);
      ax(n.x + n.w + m);
      ay(n.y - m);
      ay(n.y + n.h + m);
      const ps = ports(n);
      allPorts.set(n, ps);
      for (const p of ps) {
        ax(p.x);
        ay(p.y);
        ax(p.x + DX[p.dir] * m);
        ay(p.y + DY[p.dir] * m);
      }
    }
    for (let i = 0; i <= phases.length; i++) {
      const bx = S.laneHeadW + i * S.colW;
      for (const o of [-36, -24, -12, 0, 12, 24, 36]) ax(bx + o);
    }
    for (const lb of frame.laneBox) {
      for (const o of [-24, -12, 0, 12, 24]) ay(lb.y + o);
      ay(lb.y + lb.h - 14);
    }
    // Pasillos entre filas dentro de cada carril
    for (const n of nodes) for (const o of [-26, -36]) ay(n.y + o);

    const minX = S.laneHeadW + 6;
    const maxX = frame.width - 6;
    const minY = frame.headH + 6;
    const maxY = frame.height - 6;
    const xs = [...xsSet].filter((x) => x >= minX && x <= maxX).sort((a, b) => a - b);
    const ys = [...ysSet].filter((y) => y >= minY && y <= maxY).sort((a, b) => a - b);
    const nx = xs.length;
    const ny = ys.length;
    const xi = new Map(xs.map((x, i) => [x, i]));
    const yi = new Map(ys.map((y, i) => [y, i]));

    const blocks = nodes.map((n) => ({ x1: n.x - m + 1, y1: n.y - m + 1, x2: n.x + n.w + m - 1, y2: n.y + n.h + m - 1 }));
    const inBlock = (x, y) => blocks.some((b) => x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2);

    const valid = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) valid[j * nx + i] = inBlock(xs[i], ys[j]) ? 0 : 1;
    // canEdge[dir][idx]: se puede avanzar al vecino en esa direccion
    const canE = new Uint8Array(nx * ny);
    const canS = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (!valid[id]) continue;
        if (i + 1 < nx && valid[id + 1] && !inBlock((xs[i] + xs[i + 1]) / 2, ys[j])) canE[id] = 1;
        if (j + 1 < ny && valid[id + nx] && !inBlock(xs[i], (ys[j] + ys[j + 1]) / 2)) canS[id] = 1;
      }
    }
    const step = (id, d) => {
      const i = id % nx;
      if (d === 0) return canE[id] ? id + 1 : -1;
      if (d === 2) return i > 0 && canE[id - 1] ? id - 1 : -1;
      if (d === 1) return canS[id] ? id + nx : -1;
      return id >= nx && canS[id - nx] ? id - nx : -1;
    };

    // Ocupacion por otras flechas
    const segH = new Map(); // id -> count (tramo id -> id+1)
    const segV = new Map(); // id -> count (tramo id -> id+nx)
    const ptH = new Uint8Array(nx * ny);
    const ptV = new Uint8Array(nx * ny);
    const portUse = new Map();

    const BEND = 70;
    const CROSS = 260;
    const OVERLAP = 9;
    const OVERLAP_FIX = 220;

    const order = edges
      .map((e, i) => ({ e, i, d: Math.abs(e.from.cx - e.to.cx) + Math.abs(e.from.cy - e.to.cy) }))
      .sort((a, b) => a.d - b.d);

    const routes = new Array(edges.length);
    const N4 = nx * ny * 4;
    const g = new Float64Array(N4);
    const prev = new Int32Array(N4);
    const closed = new Uint8Array(N4);

    for (const { e, i: ei } of order) {
      g.fill(Infinity);
      prev.fill(-1);
      closed.fill(0);
      const heap = new Heap();
      const starts = [];
      const targets = new Map();
      for (const p of allPorts.get(e.from)) {
        const sx = xi.get(Math.round((p.x + DX[p.dir] * m) * 2) / 2);
        const sy = yi.get(Math.round((p.y + DY[p.dir] * m) * 2) / 2);
        if (sx == null || sy == null) continue;
        const sid = sy * nx + sx;
        if (!valid[sid]) continue;
        const pk = e.from.id + "@" + p.x + "," + p.y;
        const cost = p.pen + (portUse.get(pk) || 0);
        starts.push({ sid, p });
        const st = sid * 4 + p.dir;
        if (cost < g[st]) {
          g[st] = cost;
          prev[st] = -2 - starts.length + 1;
        }
      }
      for (const p of allPorts.get(e.to)) {
        const tx = xi.get(Math.round((p.x + DX[p.dir] * m) * 2) / 2);
        const ty = yi.get(Math.round((p.y + DY[p.dir] * m) * 2) / 2);
        if (tx == null || ty == null) continue;
        const tid = ty * nx + tx;
        if (!valid[tid]) continue;
        const pk = e.to.id + "@" + p.x + "," + p.y;
        const pen = p.pen + (portUse.get(pk) || 0) * 0.6;
        const cur = targets.get(tid);
        if (!cur || cur.pen > pen) targets.set(tid, { p, pen, inDir: (p.dir + 2) % 4 });
      }
      const tlist = [...targets.keys()].map((id) => [xs[id % nx], ys[(id / nx) | 0]]);
      const h = (id) => {
        const x = xs[id % nx];
        const y = ys[(id / nx) | 0];
        let best = Infinity;
        for (const [tx, ty] of tlist) best = Math.min(best, Math.abs(tx - x) + Math.abs(ty - y));
        return best;
      };
      for (let st = 0; st < N4; st++) if (g[st] < Infinity) heap.push(g[st] + h(st >> 2), st);

      let best = Infinity;
      let bestSt = -1;
      while (heap.size) {
        if (heap.minKey() >= best) break;
        const st = heap.pop();
        if (closed[st]) continue;
        closed[st] = 1;
        const id = st >> 2;
        const d = st & 3;
        const tg = targets.get(id);
        if (tg) {
          const fin = g[st] + tg.pen + (d === tg.inDir ? 0 : BEND);
          if (fin < best) {
            best = fin;
            bestSt = st;
          }
        }
        for (let nd = 0; nd < 4; nd++) {
          if (nd === (d + 2) % 4) continue;
          const nid = step(id, nd);
          if (nid < 0) continue;
          const len = nd % 2 === 0 ? Math.abs(xs[nid % nx] - xs[id % nx]) : Math.abs(ys[(nid / nx) | 0] - ys[(id / nx) | 0]);
          let c = len + (nd !== d ? BEND : 0);
          const sk = nd === 0 ? id : nd === 2 ? nid : nd === 1 ? id : nid;
          const occ = nd % 2 === 0 ? segH.get(sk) : segV.get(sk);
          if (occ) c += len * OVERLAP + OVERLAP_FIX;
          if (nd % 2 === 0 ? ptV[nid] : ptH[nid]) c += CROSS;
          if (nd !== d && (ptH[id] || ptV[id])) c += CROSS * 0.5;
          const ns = nid * 4 + nd;
          const ng = g[st] + c;
          if (ng < g[ns]) {
            g[ns] = ng;
            prev[ns] = st;
            heap.push(ng + h(nid), ns);
          }
        }
      }

      if (bestSt < 0) {
        routes[ei] = fallbackRoute(e);
        continue;
      }
      // Reconstruccion
      const cells = [];
      let st = bestSt;
      while (st >= 0) {
        cells.push(st >> 2);
        st = prev[st];
      }
      cells.reverse();
      const sid = cells[0];
      const s0 = starts.find((s) => s.sid === sid) || starts[0];
      const tg = targets.get(cells[cells.length - 1]);
      const pts = [[s0.p.x, s0.p.y]];
      for (const id of cells) pts.push([xs[id % nx], ys[(id / nx) | 0]]);
      pts.push([tg.p.x, tg.p.y]);
      // Marcar ocupacion
      for (let k = 0; k + 1 < cells.length; k++) {
        const a = cells[k];
        const b = cells[k + 1];
        if (b === a + 1 || b === a - 1) {
          const sk = Math.min(a, b);
          segH.set(sk, (segH.get(sk) || 0) + 1);
          ptH[a] = 1;
          ptH[b] = 1;
        } else {
          const sk = Math.min(a, b);
          segV.set(sk, (segV.get(sk) || 0) + 1);
          ptV[a] = 1;
          ptV[b] = 1;
        }
      }
      const fk = e.from.id + "@" + s0.p.x + "," + s0.p.y;
      const tk = e.to.id + "@" + tg.p.x + "," + tg.p.y;
      portUse.set(fk, (portUse.get(fk) || 0) + 160);
      portUse.set(tk, (portUse.get(tk) || 0) + 90);
      routes[ei] = simplify(pts);
    }
    return routes;
  }

  function fallbackRoute(e) {
    const a = e.from;
    const b = e.to;
    if (Math.abs(a.cy - b.cy) < 1) {
      const right = b.cx > a.cx;
      return [[right ? a.x + a.w : a.x, a.cy], [right ? b.x : b.x + b.w, b.cy]];
    }
    const down = b.cy > a.cy;
    const y1 = down ? a.y + a.h : a.y;
    const y2 = down ? b.y : b.y + b.h;
    const mid = (y1 + y2) / 2;
    return simplify([[a.cx, y1], [a.cx, mid], [b.cx, mid], [b.cx, y2]]);
  }

  function simplify(pts) {
    const out = [];
    for (const p of pts) {
      const l = out[out.length - 1];
      if (l && l[0] === p[0] && l[1] === p[1]) continue;
      out.push(p);
      while (out.length >= 3) {
        const [a, b, c] = out.slice(-3);
        if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(out.length - 2, 1);
        else break;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // SVG
  // ---------------------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function textLines(lines, x, y, size, lineH, opts = {}) {
    const anchor = opts.center ? "middle" : "start";
    return lines
      .map((line, i) => {
        const spans = line
          .map((t, k) => `<tspan${t.b ? ' font-weight="700"' : ""}>${k ? " " : ""}${esc(t.w)}</tspan>`)
          .join("");
        return `<text x="${x}" y="${y + i * lineH}" font-size="${size}" text-anchor="${anchor}" fill="${opts.fill || "#1b2a3a"}"${opts.bold ? ' font-weight="700"' : ""}>${spans}</text>`;
      })
      .join("");
  }

  let renderSeq = 0;

  function render(code) {
    const spec = parseSpec(code);
    const L = computeLayout(spec);
    const uid = "sl" + ++renderSeq;
    const { width: W, height: H } = L;
    const o = [];
    o.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" class="swimlane">`
    );
    o.push(
      `<defs><marker id="${uid}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="${EDGE}"/></marker>` +
        `<marker id="${uid}-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="${EDGE_ALT}"/></marker></defs>`
    );
    o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

    // Cabeceras de fase
    spec.phases.forEach((p, i) => {
      const cx = S.laneHeadW + i * S.colW + S.colW / 2;
      const lines = L.headLines[i];
      const y0 = (L.headH - lines.length * S.headLineH) / 2 + S.headFont;
      o.push(textLines(lines, cx, y0, S.headFont, S.headLineH, { center: true, bold: true, fill: "#1f2d3d" }));
    });
    // Carriles
    L.laneBox.forEach((lb, i) => {
      o.push(`<rect x="0" y="${lb.y}" width="${W}" height="${lb.h}" fill="${i % 2 ? "#ffffff" : "#f5f7fa"}"/>`);
      o.push(`<line x1="0" y1="${lb.y}" x2="${W}" y2="${lb.y}" stroke="#d5dde7" stroke-width="1.2"/>`);
      const th = lb.titleLines.length * 23 + lb.subLines.length * 18;
      const ty = lb.y + (lb.h - th) / 2 + 17;
      o.push(textLines(lb.titleLines, 24, ty, S.laneFont, 23, { bold: true, fill: "#12355b" }));
      o.push(textLines(lb.subLines, 24, ty + lb.titleLines.length * 23 + 2, S.laneSubFont, 18, { fill: "#5b6b7d" }));
    });
    o.push(`<line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" stroke="#d5dde7" stroke-width="1.2"/>`);
    o.push(`<line x1="${S.laneHeadW}" y1="${L.headH}" x2="${S.laneHeadW}" y2="${H}" stroke="#b9c6d6" stroke-width="1.5"/>`);

    // Flechas
    spec.edges.forEach((e, i) => {
      const pts = L.routes[i];
      if (!pts || pts.length < 2) return;
      const d = "M" + pts.map((p) => p[0] + "," + p[1]).join(" L");
      o.push(
        `<path d="${d}" fill="none" stroke="${e.dashed ? EDGE_ALT : EDGE}" stroke-width="2"${e.dashed ? ' stroke-dasharray="7 5"' : ""} stroke-linejoin="miter" marker-end="url(#${uid}-${e.dashed ? "b" : "a"})"/>`
      );
    });

    // Nodos
    for (const n of spec.nodes) {
      const st = STYLE[n.type] || STYLE.task;
      o.push(`<g class="sl-node" data-id="${esc(n.id)}"><title>${esc(n.text)}</title>`);
      if (n.type === "decision" || n.type === "parallel") {
        o.push(
          `<polygon points="${n.cx},${n.y} ${n.x + n.w},${n.cy} ${n.cx},${n.y + n.h} ${n.x},${n.cy}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2"/>`
        );
        if (n.type === "parallel") {
          const r = n.w * 0.24;
          o.push(
            `<path d="M${n.cx - r},${n.cy} L${n.cx + r},${n.cy} M${n.cx},${n.cy - r} L${n.cx},${n.cy + r}" stroke="${st.stroke}" stroke-width="5" stroke-linecap="round"/>`
          );
        } else {
          const lh = S.lineH - 2;
          const y0 = n.cy - (n.lines.length * lh) / 2 + (S.font - 1) * 0.8;
          o.push(textLines(n.lines, n.cx, y0, S.font - 1, lh, { center: true }));
        }
      } else {
        const rx = n.type === "terminal" ? 22 : 6;
        o.push(
          `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2"/>`
        );
        const all = n.lines.length + n.statusLines.length;
        const center = n.type === "terminal";
        const y0 = n.y + (n.h - all * S.lineH) / 2 + S.font * 0.85;
        const tx = center ? n.cx : n.x + S.padX;
        o.push(textLines(n.lines, tx, y0, S.font, S.lineH, { center, fill: st.text, bold: center }));
        o.push(textLines(n.statusLines, tx, y0 + n.lines.length * S.lineH, S.font, S.lineH, { center, fill: st.text }));
      }
      if (n.badge) {
        const bw = measure(n.badge, 13, true) + 18;
        const bx = n.type === "decision" || n.type === "parallel" ? n.cx + n.w * 0.22 : n.x + n.w - bw + 10;
        const by = n.type === "decision" || n.type === "parallel" ? n.y + n.h * 0.12 - 12 : n.y - 12;
        o.push(
          `<rect x="${bx}" y="${by}" width="${bw}" height="24" rx="12" fill="${BADGE}"/><text x="${bx + bw / 2}" y="${by + 16.5}" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(n.badge)}</text>`
        );
      }
      o.push("</g>");
    }

    // Etiquetas de flechas
    const placed = [];
    const inter = (r, q) =>
      Math.max(0, Math.min(r.x + r.w, q.x + q.w) - Math.max(r.x, q.x)) *
      Math.max(0, Math.min(r.y + r.h, q.y + q.h) - Math.max(r.y, q.y));
    const overlapArea = (r) =>
      Math.max(0, S.laneHeadW + 4 - r.x) * r.h * 4 +
      Math.max(0, r.x + r.w - L.width + 2) * r.h * 4 +
      spec.nodes.reduce((a, n) => a + inter(r, n) * 3, 0) +
      placed.reduce((a, q) => a + inter(r, q), 0);
    spec.edges.forEach((e, i) => {
      const pts = L.routes[i];
      if (!e.label || !pts || pts.length < 2) return;
      const segs = [];
      for (let k = 0; k + 1 < pts.length; k++) {
        const [x1, y1] = pts[k];
        const [x2, y2] = pts[k + 1];
        segs.push({ x1, y1, x2, y2, len: Math.abs(x2 - x1) + Math.abs(y2 - y1) });
      }
      segs.sort((a, b) => b.len - a.len);
      const ts = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
      let rect = null;
      let lines = null;
      let best = null;
      outer: for (const maxW of [S.labelMaxW, 96, 72]) {
        const ls = wrap(e.label, maxW, S.labelFont, false);
        const lw = Math.max(...ls.map((l) => lineWidth(l, S.labelFont))) + 14;
        const lh = ls.length * S.labelLineH + 8;
        for (const s of segs) {
          const vertical = s.x1 === s.x2;
          for (const t of ts) {
            const cx = s.x1 + (s.x2 - s.x1) * t;
            const cy = s.y1 + (s.y2 - s.y1) * t;
            const cands = vertical
              ? [[cx - lw / 2, cy - lh / 2], [cx + 6, cy - lh / 2], [cx - lw - 6, cy - lh / 2]]
              : [[cx - lw / 2, cy - lh / 2], [cx - lw / 2, cy - lh - 6], [cx - lw / 2, cy + 6]];
            for (const [x, y] of cands) {
              const r = { x, y, w: lw, h: lh };
              const score = overlapArea(r);
              if (!score) {
                rect = r;
                lines = ls;
                break outer;
              }
              if (!best || score < best.score) best = { score, r, ls };
            }
          }
        }
      }
      if (!rect) {
        rect = best.r;
        lines = best.ls;
      }
      placed.push(rect);
      o.push(
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="4" fill="#ffffff" stroke="${e.dashed ? EDGE_ALT : "#cfd8e3"}"/>`
      );
      o.push(
        textLines(lines, rect.x + rect.w / 2, rect.y + 4 + S.labelFont * 0.95, S.labelFont, S.labelLineH, {
          center: true,
          fill: e.dashed ? "#b0601a" : "#3c4a5c",
        })
      );
    });

    o.push("</svg>");
    return o.join("");
  }

  const api = { isSwimlane, parseSpec, computeLayout, render, STYLE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Swimlane = api;
})(typeof window !== "undefined" ? window : this);
