import {
  cleanEdges,
  cleanNodes,
  cleanRoutes,
  countCrossings,
  LAYERS,
  mergeNotes,
  messyEdges,
  messyNodes,
  type CleanDef,
  type Kind,
  type NodeDef,
} from "./graph";

// ---------------------------------------------------------------------------
// Small math helpers

type V = { x: number; y: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number): V => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const smooth = (t: number) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const quad = (a: V, c: V, b: V, t: number): V => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
};
const cubic = (a: V, b: V, c: V, d: V, t: number): V => {
  const u = 1 - t;
  const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return { x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y };
};
const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Timeline, in scroll progress units (0..1 across the pinned section)

export const PHASES = [
  { at: 0.0, key: "tangle" },
  { at: 0.03, key: "swarm" },
  { at: 0.14, key: "rebuild" },
  { at: 0.76, key: "ship" },
] as const;

// Merges happen first, then survivors move into their layers.
const MERGE_AT = [0.06, 0.4] as const;
const MERGE_DUR = 0.1;
const KEEP_AT = [0.28, 0.6] as const;
const KEEP_DUR = 0.12;
const TRAVEL = 0.07; // first flight in, and the flight out
const GRAB = 0.012; // the press before a drag
const CLEAN_TRAFFIC_AT = 0.78;

// ---------------------------------------------------------------------------

type RNode = {
  def: NodeDef;
  clean: CleanDef;
  kept: boolean;
  u: number; // messy position, normalized
  v: number;
  start: number;
  dur: number;
  seed: number;
  // per-frame
  pos: V;
  k: number;
  alpha: number;
};

/** keep: the edge is a real dependency that survives, so it rides along and becomes a clean edge. */
type REdge = { a: number; b: number; cutAt: number; seed: number; alpha: number; hot: boolean; keep: boolean };

type CEdge = { a: string; b: string; start: number; samples: V[]; drawn: number };

type Task = { node: number; grab: number; start: number; end: number };

type Agent = {
  name: string;
  tasks: Task[];
  spawn: V; // normalized, resolved against the canvas at draw time
  bend: number;
  exitBend: number;
  prev: V | null;
};

export type LogLine = { at: number; agent: string; verb: string; text: string };

export type Stats = { services: number; edges: number; crossings: number; waste: number };

export type Hit = { label: string; text: string; x: number; y: number; state: "tangled" | "clean" };

type Palette = { ink: string; muted: string; line: string; accent: string; onAccent: string; warn: string; paper: string };

export class SwarmScene {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private vertical = false;
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private nodes: RNode[] = [];
  private byId = new Map<string, RNode>();
  private edges: REdge[] = [];
  private cEdges: CEdge[] = [];
  private agents: Agent[] = [];
  private colors: Palette;
  private cleanPos = new Map<string, V>();
  private routes: { pts: V[]; len: number[]; total: number }[] = [];
  readonly log: LogLine[] = [];
  readonly agentCount: number;
  reduced = false;
  agentStyle: "cursor" | "dot" = "cursor";

  constructor(private canvas: HTMLCanvasElement, agentCount: number) {
    this.ctx = canvas.getContext("2d")!;
    this.agentCount = agentCount;
    this.colors = this.readColors();
    this.build();
  }

  readColors(): Palette {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    this.colors = {
      ink: v("--ink"),
      muted: v("--muted"),
      line: v("--line-strong"),
      accent: v("--accent"),
      onAccent: v("--on-accent"),
      warn: v("--warn"),
      paper: v("--paper"),
    };
    return this.colors;
  }

  // -------------------------------------------------------------------------
  // Setup

  private build() {
    const r = rng(7);
    const cleanById = new Map(cleanNodes.map((c) => [c.id, c]));

    // Scatter messy nodes with a minimum spacing so labels stay mostly legible.
    const placed: V[] = [];
    for (const def of messyNodes) {
      let best: V = { x: r(), y: r() };
      let bestD = -1;
      for (let tries = 0; tries < 40; tries++) {
        const cand = { x: 0.02 + r() * 0.96, y: 0.03 + r() * 0.94 };
        const d = placed.reduce((m, p) => Math.min(m, Math.hypot((p.x - cand.x) * 1.4, p.y - cand.y)), 9);
        if (d > bestD) { bestD = d; best = cand; }
        if (d > 0.16) break;
      }
      placed.push(best);
      const kept = def.into === def.id;
      const n: RNode = {
        def,
        clean: cleanById.get(def.into)!,
        kept,
        u: best.x,
        v: best.y,
        start: kept ? lerp(KEEP_AT[0], KEEP_AT[1], r()) : lerp(MERGE_AT[0], MERGE_AT[1], r()),
        dur: kept ? KEEP_DUR : MERGE_DUR,
        seed: r() * 1000,
        pos: { x: 0, y: 0 },
        k: 0,
        alpha: 1,
      };
      this.nodes.push(n);
      this.byId.set(def.id, n);
    }

    // Messy edges that map onto a clean edge survive: they stretch while their ends
    // are dragged, then hand over to the clean curve. Everything else is cut the
    // moment one of its ends is picked up.
    const index = new Map(messyNodes.map((d, i) => [d.id, i]));
    const cleanPairs = new Set(cleanEdges.flatMap(([a, b]) => [`${a}>${b}`, `${b}>${a}`]));
    this.edges = messyEdges.map(([a, b]) => {
      const ia = index.get(a)!, ib = index.get(b)!;
      const na = this.nodes[ia], nb = this.nodes[ib];
      const keep = na.def.into !== nb.def.into && cleanPairs.has(`${na.def.into}>${nb.def.into}`);
      r(); // keeps the random sequence, and so the tangle layout, stable
      return {
        a: ia,
        b: ib,
        cutAt: keep
          ? Math.max(na.start + na.dur, nb.start + nb.dur) + 0.004
          : Math.min(na.start, nb.start) - GRAB,
        seed: r(),
        alpha: 1,
        hot: !!(na.def.hot || nb.def.hot),
        keep,
      };
    });

    // A clean edge draws in once both of its ends have been dragged into place.
    const placedAt = (id: string) => {
      const n = this.byId.get(id)!;
      return n.start + n.dur;
    };
    this.cEdges = cleanEdges.map(([a, b]) => ({
      a,
      b,
      start: Math.max(placedAt(a), placedAt(b)) + 0.004,
      samples: [],
      drawn: 0,
    }));

    // One drag task per node. Each task goes to the agent that freed up most
    // recently (so nobody waits around), or to a fresh agent if none is free.
    const order = this.nodes.map((_, i) => i).sort((x, y) => this.nodes[x].start - this.nodes[y].start);
    for (let i = 0; i < this.agentCount; i++) {
      this.agents.push({
        name: "agent-" + String(i).padStart(3, "0"),
        tasks: [],
        spawn: { x: r(), y: r() },
        bend: (r() - 0.5) * 2,
        exitBend: (r() - 0.5) * 2,
        prev: null,
      });
    }
    const freeAt = (a: Agent) => (a.tasks.length ? a.tasks[a.tasks.length - 1].end : -1);
    for (const ni of order) {
      const n = this.nodes[ni];
      const ready = this.agents.filter((a) => a.tasks.length && freeAt(a) <= n.start - GRAB - 0.05);
      let pick: Agent | undefined = ready.sort((x, y) => freeAt(y) - freeAt(x))[0];
      pick ??= this.agents.find((a) => !a.tasks.length);
      pick ??= [...this.agents].sort((x, y) => freeAt(x) - freeAt(y))[0]!;
      pick.tasks.push({ node: ni, grab: n.start - GRAB, start: n.start, end: n.start + n.dur });
    }
    this.agents = this.agents.filter((a) => a.tasks.length);

    // Swarm log, sorted by when each event happens.
    const owner = new Map<number, string>();
    for (const a of this.agents) for (const t of a.tasks) owner.set(t.node, a.name);
    const merged = this.nodes.filter((n) => !n.kept);
    this.log.push({ at: 0.02, agent: "swarm", verb: "spawn", text: `${this.agents.length} agents, one goal: fewer moving parts` });
    this.log.push({ at: 0.06, agent: "swarm", verb: "scan", text: `${merged.length} of ${this.nodes.length} services are duplicates or dead weight` });
    this.nodes.forEach((n, i) => {
      if (n.kept) return;
      this.log.push({
        at: n.start + n.dur,
        agent: owner.get(i) ?? "swarm",
        verb: "merge",
        text: `${n.def.label} → ${n.clean.label}: ${mergeNotes[n.def.id] ?? ""}`,
      });
    });
    this.log.push({ at: 0.74, agent: "swarm", verb: "verify", text: "every client still reaches every store" });
    this.log.push({ at: 0.8, agent: "swarm", verb: "ship", text: `${cleanNodes.length} services, traffic flowing` });
    this.log.sort((a, b) => a.at - b.at);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.vertical = this.w < 640 || this.w / this.h < 0.9;

    // Leave room for labels: to the right on wide screens, below on narrow ones.
    const padX = this.vertical ? 30 : 28;
    const padR = this.vertical ? 30 : 150;
    const padY = this.vertical ? 24 : 30;
    const padB = this.vertical ? 34 : 30;
    this.box = { x: padX, y: padY, w: this.w - padX - padR, h: this.h - padY - padB };

    this.cleanPos.clear();
    for (const c of cleanNodes) {
      const t = c.layer / (LAYERS - 1);
      this.cleanPos.set(
        c.id,
        this.vertical
          ? { x: this.box.x + c.slot * this.box.w, y: this.box.y + t * this.box.h }
          : { x: this.box.x + t * this.box.w, y: this.box.y + c.slot * this.box.h },
      );
    }
    for (const e of this.cEdges) e.samples = this.curve(this.cleanPos.get(e.a)!, this.cleanPos.get(e.b)!);

    this.routes = cleanRoutes.map((ids) => {
      const pts: V[] = [];
      for (let i = 0; i < ids.length - 1; i++) {
        const seg = this.curve(this.cleanPos.get(ids[i])!, this.cleanPos.get(ids[i + 1])!);
        pts.push(...(i === 0 ? seg : seg.slice(1)));
      }
      const len = [0];
      for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i - 1], pts[i]));
      return { pts, len, total: len[len.length - 1] };
    });
    for (const a of this.agents) a.prev = null;
  }

  private curve(a: V, b: V, n = 28): V[] {
    const out: V[] = [];
    let c1: V, c2: V;
    if (this.vertical) {
      const dy = (b.y - a.y) * 0.55;
      c1 = { x: a.x, y: a.y + dy };
      c2 = { x: b.x, y: b.y - dy };
    } else {
      const dx = (b.x - a.x) * 0.55;
      c1 = { x: a.x + dx, y: a.y };
      c2 = { x: b.x - dx, y: b.y };
    }
    for (let i = 0; i <= n; i++) out.push(cubic(a, c1, c2, b, i / n));
    return out;
  }

  private messyPx(n: RNode): V {
    // Messy nodes use the full box, including the label gutter, to look scattered.
    const extra = this.vertical ? 0 : 90;
    return { x: this.box.x + n.u * (this.box.w + extra), y: this.box.y + n.v * this.box.h };
  }

  // -------------------------------------------------------------------------
  // Per-frame state

  private update(p: number, t: number) {
    const wob = this.reduced ? 0 : 1;
    // Kept nodes first, so merged nodes can chase where their target is right now.
    for (const pass of [true, false]) {
      for (const n of this.nodes) {
        if (n.kept !== pass) continue;
        n.k = clamp01((p - n.start) / n.dur);
        const e = easeInOut(n.k);
        const from = this.messyPx(n);
        const jitter = (1 - e) * wob * 2.5;
        from.x += Math.sin(t * 1.3 + n.seed) * jitter;
        from.y += Math.cos(t * 1.1 + n.seed * 1.7) * jitter;
        const to = n.kept ? this.cleanPos.get(n.def.id)! : this.byId.get(n.def.into)!.pos;
        n.pos = lerpV(from, to, e);
        n.alpha = n.kept ? 1 : 1 - smooth((n.k - 0.7) / 0.3);
      }
    }
    for (const e of this.edges) {
      const end = e.keep ? 1 : Math.min(this.nodes[e.a].alpha, this.nodes[e.b].alpha);
      e.alpha = (1 - smooth((p - e.cutAt) / (e.keep ? 0.06 : 0.035))) * end;
    }
    for (const c of this.cEdges) c.drawn = easeOut(clamp01((p - c.start) / 0.07));
  }

  stats(): Stats {
    const services = this.nodes.filter((n) => n.alpha > 0.5).length;
    const live: [string, string][] = [];
    for (const e of this.edges) if (e.alpha > 0.5) live.push([this.nodes[e.a].def.id, this.nodes[e.b].def.id]);
    const cleanLive: [string, string][] = [];
    for (const c of this.cEdges) if (c.drawn > 0.5) cleanLive.push([c.a, c.b]);
    const pos = (id: string) => this.byId.get(id)?.pos;
    // Clean edges are drawn as curves; for counting, straight segments between the same points are close enough.
    const crossings = countCrossings([...live, ...cleanLive], pos);
    // Services still on screen that the clean design doesn't have.
    const waste = this.nodes.filter((n) => !n.kept && n.alpha > 0.5).length;
    return { services, edges: live.length + cleanLive.length, crossings, waste };
  }

  hit(x: number, y: number, p: number): Hit | null {
    let best: RNode | null = null;
    let bestD = 18;
    for (const n of this.nodes) {
      if (n.alpha < 0.5) continue;
      const d = dist(n.pos, { x, y });
      if (d < bestD) { bestD = d; best = n; }
    }
    if (!best) return null;
    const clean = best.kept && best.k > 0.5;
    if (clean || p > 0.8) {
      return { label: best.clean.label, text: best.clean.does, x: best.pos.x, y: best.pos.y, state: "clean" };
    }
    return {
      label: best.def.label,
      text: best.def.smell ?? "Keeps its job. Moves to a cleaner spot.",
      x: best.pos.x,
      y: best.pos.y,
      state: "tangled",
    };
  }

  // -------------------------------------------------------------------------
  // Drawing

  draw(p: number, t: number, hoverId?: string | null) {
    this.update(p, t);
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    this.drawMessyEdges(p);
    this.drawCleanEdges();
    if (!this.reduced) {
      this.drawMessyPackets(t);
      this.drawCleanPackets(p, t);
    }
    for (const n of this.nodes) this.drawNode(n, t, hoverId === n.def.id);
    this.drawAgents(p);
    ctx.globalAlpha = 1;
  }

  private drawMessyEdges(p: number) {
    const { ctx, colors } = this;
    ctx.lineWidth = 1;
    for (const e of this.edges) {
      if (e.alpha <= 0.01) continue;
      const a = this.nodes[e.a].pos, b = this.nodes[e.b].pos;
      // Just before an edge is cut, it lights up: an agent is on it.
      const snip = e.keep ? 0 : smooth((p - (e.cutAt - 0.03)) / 0.02) * (1 - smooth((p - e.cutAt) / 0.03));
      ctx.globalAlpha = e.alpha * (e.hot ? 0.55 : 0.32) + snip * 0.6;
      ctx.strokeStyle = snip > 0.2 ? colors.accent : e.hot ? colors.warn : colors.line;
      ctx.lineWidth = 1 + snip * 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  private drawCleanEdges() {
    const { ctx, colors } = this;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.25;
    for (const e of this.cEdges) {
      if (e.drawn <= 0) continue;
      const s = e.samples;
      const upto = e.drawn * (s.length - 1);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      const whole = Math.floor(upto);
      for (let i = 1; i <= whole; i++) ctx.lineTo(s[i].x, s[i].y);
      if (whole < s.length - 1) {
        const tail = lerpV(s[whole], s[whole + 1], upto - whole);
        ctx.lineTo(tail.x, tail.y);
      }
      ctx.stroke();
    }
  }

  private drawMessyPackets(t: number) {
    const { ctx, colors } = this;
    const count = Math.min(48, this.edges.length);
    for (let i = 0; i < count; i++) {
      const e = this.edges[(i * 13) % this.edges.length];
      if (e.alpha < 0.05) continue;
      const a = this.nodes[e.a].pos, b = this.nodes[e.b].pos;
      // Slow, uneven, and packets on hot edges die partway.
      const speed = 0.12 + e.seed * 0.18;
      let k = (t * speed + e.seed * 7 + i * 0.37) % 1;
      let fade = 1;
      if (e.hot && k > 0.55) {
        fade = 1 - smooth((k - 0.55) / 0.15);
        k = 0.55 + (k - 0.55) * 0.15;
      }
      const pt = lerpV(a, b, k);
      ctx.globalAlpha = e.alpha * fade * 0.85;
      ctx.fillStyle = e.hot ? colors.warn : colors.muted;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }
  }

  private drawCleanPackets(p: number, t: number) {
    const on = smooth((p - CLEAN_TRAFFIC_AT) / 0.05);
    if (on <= 0) return;
    const { ctx, colors } = this;
    ctx.fillStyle = colors.accent;
    this.routes.forEach((r, ri) => {
      for (let j = 0; j < 3; j++) {
        const d = ((t * 150 + ri * 97 + (j * r.total) / 3) % r.total + r.total) % r.total;
        for (let tail = 0; tail < 4; tail++) {
          const dd = d - tail * 5;
          if (dd < 0) break;
          const pt = this.along(r, dd);
          ctx.globalAlpha = on * (1 - tail * 0.24);
          const s = tail === 0 ? 3.2 : 2.2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, s / 2 + 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  private along(r: { pts: V[]; len: number[] }, d: number): V {
    let lo = 0, hi = r.len.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (r.len[mid] < d) lo = mid;
      else hi = mid;
    }
    const seg = r.len[hi] - r.len[lo] || 1;
    return lerpV(r.pts[lo], r.pts[hi], (d - r.len[lo]) / seg);
  }

  /** Just outside the canvas edge closest to a point. */
  private offEdge(pt: V, jitter: number): V {
    const m = 24;
    const d = [pt.x, this.w - pt.x, pt.y, this.h - pt.y];
    const k = d.indexOf(Math.min(...d));
    const j = (jitter - 0.5) * 80;
    if (k === 0) return { x: -m, y: pt.y + j };
    if (k === 1) return { x: this.w + m, y: pt.y + j };
    if (k === 2) return { x: pt.x + j, y: -m };
    return { x: pt.x + j, y: this.h + m };
  }

  private glide(from: V, to: V, k: number, bend: number): V {
    const dx = to.x - from.x, dy = to.y - from.y;
    const ctrl = { x: (from.x + to.x) / 2 - dy * 0.22 * bend, y: (from.y + to.y) / 2 + dx * 0.22 * bend };
    return quad(from, ctrl, to, easeInOut(clamp01(k)));
  }

  /** Where an agent is at progress p, and whether it is holding a node. */
  private agentPos(a: Agent, p: number): { pos: V; pressed: boolean; alpha: number } | null {
    let from: V | null = null;
    let freeSince = 0;
    for (let i = 0; i < a.tasks.length; i++) {
      const task = a.tasks[i];
      const node = this.nodes[task.node];
      const leaveAt = from ? freeSince : Math.max(0, task.grab - TRAVEL);
      if (!from) from = this.offEdge(this.messyPx(node), a.spawn.y);
      if (p < leaveAt) return i === 0 ? null : { pos: from, pressed: false, alpha: 1 };
      if (p < task.grab) {
        const k = (p - leaveAt) / (task.grab - leaveAt);
        return { pos: this.glide(from, node.pos, k, a.bend), pressed: false, alpha: i === 0 ? smooth(k / 0.3) : 1 };
      }
      if (p <= task.end) return { pos: node.pos, pressed: true, alpha: 1 };
      from = { ...node.pos };
      freeSince = task.end;
    }
    // Done: fly out through the nearest edge.
    const k = (p - freeSince) / TRAVEL;
    if (k >= 1 || !from) return null;
    const exit = this.offEdge(from, a.spawn.x);
    return { pos: this.glide(from, exit, k, a.exitBend), pressed: false, alpha: 1 - smooth((k - 0.6) / 0.4) };
  }

  private drawAgents(p: number) {
    const { ctx, colors } = this;
    if (this.agentStyle === "dot") {
      ctx.strokeStyle = colors.accent;
      ctx.fillStyle = colors.accent;
      ctx.lineCap = "round";
      for (const a of this.agents) {
        const st = this.agentPos(a, p);
        if (!st) { a.prev = null; continue; }
        if (a.prev && dist(a.prev, st.pos) < 70) {
          ctx.globalAlpha = 0.45 * st.alpha;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(a.prev.x, a.prev.y);
          ctx.lineTo(st.pos.x, st.pos.y);
          ctx.stroke();
        }
        ctx.globalAlpha = st.alpha;
        ctx.beginPath();
        ctx.arc(st.pos.x, st.pos.y, st.pressed ? 2.6 : 2, 0, Math.PI * 2);
        ctx.fill();
        a.prev = st.pos;
      }
      ctx.lineCap = "butt";
      return;
    }

    // Cursors: an arrow with its tip on the agent; every sixth wears a name tag.
    const base = this.vertical ? 0.78 : 0.92;
    const tagFont = `500 ${this.vertical ? 8.5 : 9.5}px "Geist Mono", ui-monospace, monospace`;
    ctx.lineJoin = "round";
    this.agents.forEach((a, i) => {
      const st = this.agentPos(a, p);
      if (!st) return;
      // A held cursor sits a hair down and to the right, as if pressed.
      const s = base * (st.pressed ? 0.9 : 1);
      const x = st.pos.x + (st.pressed ? 1 : 0);
      const y = st.pos.y + (st.pressed ? 1 : 0);
      ctx.globalAlpha = st.alpha;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 13 * s);
      ctx.lineTo(x + 3.4 * s, y + 9.9 * s);
      ctx.lineTo(x + 5.8 * s, y + 15.2 * s);
      ctx.lineTo(x + 8 * s, y + 14.2 * s);
      ctx.lineTo(x + 5.7 * s, y + 9.1 * s);
      ctx.lineTo(x + 10 * s, y + 9.1 * s);
      ctx.closePath();
      ctx.fillStyle = colors.accent;
      ctx.strokeStyle = colors.paper;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fill();

      if (i % 6 !== 0) return;
      ctx.font = tagFont;
      const w = ctx.measureText(a.name).width + 10;
      const h = this.vertical ? 14 : 16;
      // Tags flip to the left of the cursor near the right edge, so they never clip.
      const tx = x + 9 * s + w > this.w - 2 ? x - w - 2 : x + 9 * s;
      const ty = y + 13 * s;
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.roundRect(tx, ty, w, h, 3);
      ctx.fill();
      ctx.fillStyle = colors.onAccent;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(a.name, tx + 5, ty + h / 2 + 0.5);
    });
    ctx.lineJoin = "miter";
  }

  private drawNode(n: RNode, t: number, hover: boolean) {
    if (n.alpha <= 0.01) return;
    const { ctx, colors } = this;
    const { x, y } = n.pos;
    const settled = n.kept ? smooth((n.k - 0.5) / 0.5) : 0;
    const kind: Kind = settled > 0.5 ? n.clean.kind : n.def.kind;
    const size = lerp(4.5, 6, settled) * (n.kept ? 1 : lerp(1, 0.6, smooth(n.k)));

    // Selection box while a cursor holds this node, like dragging in a design tool.
    const held = n.k > 0 && n.k < 1 ? smooth(n.k / 0.08) * (1 - smooth((n.k - 0.88) / 0.12)) : 0;
    if (held > 0.01 && n.alpha > 0.05) {
      const b = size + 5;
      ctx.globalAlpha = held * n.alpha;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - b, y - b, b * 2, b * 2);
      ctx.fillStyle = colors.paper;
      for (const [cx, cy] of [[-b, -b], [b, -b], [-b, b], [b, b]]) {
        ctx.fillRect(x + cx - 1.75, y + cy - 1.75, 3.5, 3.5);
        ctx.strokeRect(x + cx - 1.75, y + cy - 1.75, 3.5, 3.5);
      }
    }

    // Hot nodes pulse while the system is still tangled.
    if (n.def.hot && n.k < 1) {
      const pulse = this.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 4 + n.seed);
      ctx.globalAlpha = (1 - n.k) * n.alpha * (0.25 + pulse * 0.35);
      ctx.strokeStyle = colors.warn;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, size + 4 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = n.alpha;
    const stroke = n.def.hot && n.k < 0.5 ? colors.warn : colors.ink;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = colors.paper;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    switch (kind) {
      case "client":
        ctx.roundRect(x - size * 1.3, y - size, size * 2.6, size * 2, 2);
        break;
      case "edge":
        ctx.moveTo(x, y - size * 1.25);
        ctx.lineTo(x + size * 1.25, y);
        ctx.lineTo(x, y + size * 1.25);
        ctx.lineTo(x - size * 1.25, y);
        ctx.closePath();
        break;
      case "data":
        ctx.arc(x, y, size, 0, Math.PI * 2);
        break;
      case "ext":
        ctx.setLineDash([2, 2]);
        ctx.arc(x, y, size, 0, Math.PI * 2);
        break;
      default:
        ctx.rect(x - size, y - size, size * 2, size * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    if (kind === "data") {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (kind === "worker") {
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.stroke();
    }
    if (settled > 0.5 && (kind === "svc" || kind === "edge")) {
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label: cross-fades from the messy name to the clean name as the node settles.
    const fontSize = this.vertical ? 9.5 : 11;
    ctx.font = `${hover ? 500 : 450} ${fontSize}px "Geist Mono", ui-monospace, monospace`;
    const drawLabel = (text: string, alpha: number, color: string) => {
      if (alpha <= 0.02) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      if (this.vertical) {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(text, x, y + size + 5);
      } else {
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + size + 7, y);
      }
    };
    const tangledLabelAlpha = this.vertical ? 0 : 0.85;
    // A merging node's label goes quiet once it's picked up, so converging labels don't pile up.
    const quiet = n.kept ? 1 : 1 - smooth(n.k / 0.25);
    const showMessy = (1 - settled) * n.alpha * quiet * (hover ? 1 : tangledLabelAlpha);
    drawLabel(n.def.label, showMessy, n.def.hot ? colors.warn : colors.muted);
    if (n.kept) drawLabel(n.clean.label, settled, hover ? colors.accent : colors.ink);
  }

  nodeAt(x: number, y: number): string | null {
    for (const n of this.nodes) if (n.alpha > 0.5 && dist(n.pos, { x, y }) < 18) return n.def.id;
    return null;
  }
}
