// Work section: "I build the ___ behind Vennbee." The word cycles through the
// four subsystems I own, and the diagram beside it lights that subsystem's
// request path. It's the same clean architecture the swarm section ends on.

type Kind = "client" | "edge" | "svc" | "data" | "worker" | "ext";
type N = { id: string; label: string; kind: Kind; x: number; y: number };

const nodes: N[] = [
  { id: "ios", label: "ios app", kind: "client", x: 34, y: 150 },
  { id: "web", label: "web", kind: "client", x: 34, y: 270 },
  { id: "gateway", label: "gateway", kind: "edge", x: 140, y: 210 },
  { id: "feed", label: "feed", kind: "svc", x: 262, y: 70 },
  { id: "search", label: "search", kind: "svc", x: 262, y: 163 },
  { id: "moderation", label: "moderation", kind: "svc", x: 262, y: 256 },
  { id: "chat", label: "chat", kind: "svc", x: 262, y: 349 },
  { id: "redis", label: "redis", kind: "data", x: 392, y: 92 },
  { id: "postgres", label: "postgres + pgvector", kind: "data", x: 392, y: 200 },
  { id: "bullmq", label: "bullmq", kind: "worker", x: 392, y: 312 },
  { id: "llm", label: "llm api", kind: "ext", x: 510, y: 256 },
];

const edges: [string, string][] = [
  ["ios", "gateway"], ["web", "gateway"],
  ["gateway", "feed"], ["gateway", "search"], ["gateway", "moderation"], ["gateway", "chat"],
  ["feed", "redis"], ["feed", "postgres"], ["feed", "bullmq"],
  ["search", "redis"], ["search", "postgres"], ["search", "llm"],
  ["moderation", "bullmq"], ["bullmq", "llm"], ["moderation", "postgres"],
  ["chat", "redis"], ["chat", "postgres"],
];

type Mode = { key: string; word: string; path: string[][]; note: string };

const modes: Mode[] = [
  {
    key: "search",
    word: "search",
    path: [["ios", "gateway", "search", "postgres"], ["search", "redis"], ["search", "llm"]],
    note: "Forager: Google-style queries over nested communities. Parsed into a validated plan, then keyword, semantic and facts lanes, fused and reranked by graph distance.",
  },
  {
    key: "feed",
    word: "feed",
    path: [["ios", "gateway", "feed", "redis"], ["feed", "postgres"], ["feed", "bullmq"]],
    note: "Posts ranked by how relevant they are to your groups, not how viral. It learns from likes, replies and reposts.",
  },
  {
    key: "moderation",
    word: "moderation",
    path: [["ios", "gateway", "moderation", "bullmq", "llm"], ["moderation", "postgres"]],
    note: "Built to pass Apple's UGC rules: word filter, a 41.9K-domain link blocklist, AI scoring for every media type, strikes and appeals.",
  },
  {
    key: "chat",
    word: "real-time chat",
    path: [["ios", "gateway", "chat", "redis"], ["chat", "postgres"]],
    note: "Socket.IO with Redis pub/sub, so any instance can deliver any message. Messages persist before they fan out.",
  },
];

const byId = new Map(nodes.map((n) => [n.id, n]));
const SVG = "http://www.w3.org/2000/svg";
const key = (a: string, b: string) => `${a}>${b}`;

function curve(a: N, b: N) {
  const dx = (b.x - a.x) * 0.55;
  return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
}

function shape(n: N): string {
  const { x, y } = n;
  switch (n.kind) {
    case "client": return `<rect x="${x - 9}" y="${y - 7}" width="18" height="14" rx="2.5"/>`;
    case "edge": return `<path d="M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z"/>`;
    case "data": return `<circle cx="${x}" cy="${y}" r="7.5"/><circle cx="${x}" cy="${y}" r="3.2"/>`;
    case "worker": return `<rect x="${x - 7}" y="${y - 7}" width="14" height="14"/><path d="M${x - 7} ${y}H${x + 7}"/>`;
    case "ext": return `<circle cx="${x}" cy="${y}" r="7.5" stroke-dasharray="2.5 2.5"/>`;
    default: return `<rect x="${x - 7}" y="${y - 7}" width="14" height="14"/>`;
  }
}

export function mountSystem(root: HTMLElement, reduced: boolean) {
  const words = root.querySelector<HTMLElement>("[data-words]")!;
  const svg = root.querySelector<SVGSVGElement>("[data-system]")!;
  const note = root.querySelector<HTMLElement>("[data-note]")!;
  const tabs = root.querySelector<HTMLElement>("[data-tabs]")!;

  // Rolling word: every option is stacked; the list slides to the current one.
  words.innerHTML = modes.map((m) => `<span>${m.word}</span>`).join("");
  words.setAttribute("aria-hidden", "true");
  const live = root.querySelector<HTMLElement>("[data-word-live]")!;

  // Diagram
  const edgeEls = new Map<string, { base: SVGPathElement; flow: SVGPathElement }>();
  const gEdges = document.createElementNS(SVG, "g");
  gEdges.setAttribute("class", "sys-edges");
  edges.forEach(([a, b], i) => {
    const d = curve(byId.get(a)!, byId.get(b)!);
    const base = document.createElementNS(SVG, "path");
    base.setAttribute("d", d);
    base.setAttribute("pathLength", "1");
    base.setAttribute("class", "sys-edge");
    base.style.setProperty("--i", String(i));
    const flow = document.createElementNS(SVG, "path");
    flow.setAttribute("d", d);
    flow.setAttribute("class", "sys-flow");
    gEdges.append(base, flow);
    edgeEls.set(key(a, b), { base, flow });
  });
  const gNodes = document.createElementNS(SVG, "g");
  gNodes.setAttribute("class", "sys-nodes");
  gNodes.innerHTML = nodes
    .map(
      (n, i) => `<g class="sys-node" data-id="${n.id}" data-kind="${n.kind}" style="--i:${i};transform-origin:${n.x}px ${n.y}px">
        ${shape(n)}<text x="${n.x}" y="${n.y + 24}" text-anchor="middle">${n.label}</text></g>`,
    )
    .join("");
  svg.append(gEdges, gNodes);

  // Tabs
  tabs.innerHTML = modes
    .map((m, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="false">${m.key}</button>`)
    .join("");
  const tabEls = [...tabs.querySelectorAll<HTMLButtonElement>("button")];

  let current = -1;
  const show = (i: number) => {
    if (i === current) return;
    current = i;
    const m = modes[i];
    words.style.transform = `translateY(${-i}em)`;
    live.textContent = m.word;
    note.textContent = m.note;
    note.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], {
      duration: reduced ? 0 : 260,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
    tabEls.forEach((t, k) => {
      t.setAttribute("aria-selected", String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });

    const onEdges = new Set<string>();
    const onNodes = new Set<string>();
    for (const route of m.path) {
      route.forEach((id, k) => {
        onNodes.add(id);
        if (k) onEdges.add(key(route[k - 1], id));
      });
    }
    for (const [k, el] of edgeEls) {
      el.base.classList.toggle("on", onEdges.has(k));
      el.flow.classList.toggle("on", onEdges.has(k));
    }
    gNodes.querySelectorAll<SVGGElement>(".sys-node").forEach((g) => g.classList.toggle("on", onNodes.has(g.dataset.id!)));
  };

  // Autoplay, paused while someone is choosing a tab or the hero is off screen.
  let timer = 0;
  let visible = true;
  let held = false;
  const schedule = () => {
    clearInterval(timer);
    if (reduced) return;
    timer = window.setInterval(() => {
      if (visible && !held && !document.hidden) show((current + 1) % modes.length);
    }, 2200);
  };

  tabs.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    show(Number(b.dataset.i));
    schedule();
  });
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const next = (current + (e.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length;
    show(next);
    tabEls[next].focus();
    schedule();
  });
  const panel = root.querySelector<HTMLElement>(".system")!;
  panel.addEventListener("pointerenter", () => (held = true));
  panel.addEventListener("pointerleave", () => (held = false));
  // Draw in and start cycling the first time it scrolls into view.
  let started = false;
  new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (!visible || started) return;
      started = true;
      root.classList.add("is-ready");
      window.setTimeout(() => { show(0); schedule(); }, reduced ? 0 : 700);
    },
    { threshold: 0.35 },
  ).observe(root);
}
