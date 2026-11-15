// Hero trace waterfall. Cycles through a few illustrative Vennbee requests,
// drawn the way a tracing UI (Jaeger, Honeycomb) would show them.

type SpanKind = "svc" | "data" | "ext" | "queue" | "async";
type Span = [svc: string, op: string, start: number, dur: number, kind: SpanKind];
type Trace = { req: string; status: string; total: number; spans: Span[] };

const traces: Trace[] = [
  {
    req: "GET /v1/feed?group=climbing",
    status: "200",
    total: 16,
    spans: [
      ["gateway", "auth, rate limit", 0, 1.8, "svc"],
      ["redis", "GET feed:u_4821", 1.9, 0.5, "data"],
      ["feed", "load group graph", 2.5, 2.4, "svc"],
      ["postgres", "candidates, 200 rows", 3.1, 5.2, "data"],
      ["feed", "rank by group relevance", 8.4, 5.6, "svc"],
      ["redis", "SET feed:u_4821", 14.1, 0.4, "data"],
      ["gateway", "serialize", 14.6, 1.4, "svc"],
    ],
  },
  {
    req: 'GET /v1/search?q="people who boulder on weekends"',
    status: "200",
    total: 42,
    spans: [
      ["gateway", "auth, rate limit", 0, 1.9, "svc"],
      ["redis", "GET emb:q_9f2c", 2, 0.5, "data"],
      ["llm", "embed query", 2.6, 29.4, "ext"],
      ["postgres", "keyword ts_rank", 32.2, 3.6, "data"],
      ["postgres", "pgvector knn, k=50", 32.2, 6.1, "data"],
      ["search", "blend, α=0.6", 38.5, 1.2, "svc"],
      ["gateway", "serialize", 39.9, 2.1, "svc"],
    ],
  },
  {
    req: "POST /v1/posts (video)",
    status: "202",
    total: 40,
    spans: [
      ["gateway", "auth, rate limit", 0, 1.7, "svc"],
      ["moderation", "word filter", 1.8, 0.4, "svc"],
      ["moderation", "link blocklist, 41.9K", 2.3, 0.3, "svc"],
      ["s3", "presign upload", 2.7, 2.6, "data"],
      ["bullmq", "enqueue score:video", 5.5, 0.9, "queue"],
      ["gateway", "202 accepted", 6.5, 0.8, "svc"],
      ["worker", "score sampled frames", 8, 31, "async"],
    ],
  },
  {
    req: "WS chat.send room:91",
    status: "ack",
    total: 5,
    spans: [
      ["chat", "validate", 0, 0.4, "svc"],
      ["moderation", "word filter", 0.45, 0.2, "svc"],
      ["postgres", "INSERT message", 0.7, 2.4, "data"],
      ["redis", "PUBLISH room:91", 0.75, 0.35, "data"],
      ["chat", "fan out, 3 sockets", 1.2, 1.1, "svc"],
      ["bullmq", "notify offline members", 3.2, 0.5, "queue"],
      ["chat", "ack", 3.8, 0.3, "svc"],
    ],
  },
];

const fmt = (ms: number) => (ms < 10 ? ms.toFixed(1) : Math.round(ms).toString());

export function mountTrace(root: HTMLElement, reduced: boolean) {
  const rows = root.querySelector<HTMLOListElement>("[data-trace-rows]")!;
  const req = root.querySelector<HTMLElement>("[data-trace-req]")!;
  const status = root.querySelector<HTMLElement>("[data-trace-status]")!;
  const total = root.querySelector<HTMLElement>("[data-trace-total]")!;
  const mid = root.querySelector<HTMLElement>("[data-trace-mid]")!;
  const end = root.querySelector<HTMLElement>("[data-trace-end]")!;
  const dots = root.querySelector<HTMLElement>("[data-trace-dots]")!;
  dots.innerHTML = traces.map(() => "<i></i>").join("");

  let i = 0;
  let timers: number[] = [];
  let cycle = 0;
  let visible = true;

  const show = (t: Trace) => {
    timers.forEach(clearTimeout);
    timers = [];
    req.textContent = t.req;
    req.title = t.req;
    status.textContent = t.status;
    total.textContent = fmt(t.total);
    mid.textContent = fmt(t.total / 2);
    end.textContent = fmt(t.total) + "ms";
    [...dots.children].forEach((d, k) => d.toggleAttribute("data-on", k === i));

    rows.innerHTML = "";
    t.spans.forEach(([svc, op, start, dur, kind], k) => {
      const li = document.createElement("li");
      li.className = "trace-row";
      const left = (start / t.total) * 100;
      const width = Math.max((dur / t.total) * 100, 0.6);
      // Label sits after the bar, or before it when the bar ends near the right edge.
      const after = left + width < 78;
      const msStyle = after ? `left:${left + width}%` : `right:${100 - left}%;padding:0 6px 0 0`;
      li.innerHTML = `
        <span class="trace-name"><span class="trace-svc">${svc}</span><span class="trace-op">${op}</span></span>
        <span class="trace-track">
          <span class="trace-bar" data-kind="${kind}" style="left:${left}%;width:${width}%"></span>
          <span class="trace-ms" style="${msStyle}">${fmt(dur)}ms</span>
        </span>`;
      rows.appendChild(li);
      // Spans appear in start order, like a trace streaming in.
      const delay = reduced ? 0 : 120 + (start / t.total) * 900 + k * 40;
      timers.push(window.setTimeout(() => li.setAttribute("data-in", ""), delay));
    });
  };

  const next = () => {
    i = (i + 1) % traces.length;
    show(traces[i]);
  };

  show(traces[0]);
  if (reduced) return;

  const start = () => {
    clearInterval(cycle);
    cycle = window.setInterval(() => visible && !document.hidden && next(), 4600);
  };
  start();

  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);

  // Click a dot's worth of the panel to skip ahead.
  root.addEventListener("click", () => {
    next();
    start();
  });
}
