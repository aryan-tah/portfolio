// Home-page case studies: one row per write-up, each with a small visual that
// plays when it scrolls into view. Visuals are illustrations of what each
// project does, not live data.

type Case = {
  slug: string;
  kicker: string;
  title: string;
  line: string;
  stats: [string, string][];
  visual: (el: HTMLElement, reduced: boolean) => () => void; // returns a "play" function
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// ----------------------------------------------------------------------------
// Visuals

function chipsVisual(el: HTMLElement) {
  el.innerHTML = `
    <div class="v-forager">
      <div class="v-bar"><span>friends of friends in SWE Internship 2027 and ACM at UCR who know Python</span></div>
      <div class="v-chips">
        <span data-k="scope"><b>in space</b>SWE Internship 2027</span>
        <span data-k="scope"><b>also in</b>ACM at UCR</span>
        <span data-k="graph"><b>vouches</b>friends of friends</span>
        <span><b>skill</b>python</span>
      </div>
      <div class="v-res">
        <i style="--w:82%"></i><i style="--w:70%"></i><i style="--w:56%"></i>
      </div>
    </div>`;
  return () => el.classList.add("play");
}

function moderationVisual(el: HTMLElement) {
  const items: [string, string, "ok" | "review" | "block"][] = [
    ["display name", "Harshit", "ok"],
    ["bio", "CS at UCR, climbs on weekends", "ok"],
    ["link", "a domain on the blocklist", "block"],
    ["space name", "Design at UCR", "ok"],
    ["post", "a borderline caption", "review"],
    ["image", "sunset at the pier", "ok"],
  ];
  el.innerHTML = `<ol class="v-mod">${items
    .map(
      ([k, v, s], i) =>
        `<li style="--i:${i}" data-s="${s}"><span class="mono">${k}</span><span class="v-mod-v">${esc(v)}</span><em class="mono">${s === "ok" ? "live" : s}</em></li>`,
    )
    .join("")}</ol>`;
  return () => el.classList.add("play");
}

function brainVisual(el: HTMLElement, reduced: boolean) {
  el.innerHTML = `<div class="v-brain"><canvas></canvas><p class="mono"><span data-pct>0%</span> deleted · escape <span data-esc>1.00</span></p></div>`;
  const canvas = el.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const pct = el.querySelector<HTMLElement>("[data-pct]")!;
  const escEl = el.querySelector<HTMLElement>("[data-esc]")!;
  // Two lobes of points; a small cluster in the middle is the escape circuit.
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts: { x: number; y: number; t: number; core: boolean }[] = [];
  for (let i = 0; i < 1400; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    pts.push({ x: 0.5 + side * 0.2 + Math.cos(a) * d * 0.2, y: 0.5 + Math.sin(a) * d * 0.3, t: r(), core: false });
  }
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    pts.push({ x: 0.5 + Math.cos(a) * d * 0.05, y: 0.62 + Math.sin(a) * d * 0.07, t: 2, core: true });
  }
  const css = getComputedStyle(document.documentElement);
  let k = 0;
  const draw = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ink = css.getPropertyValue("--ink").trim(), accent = css.getPropertyValue("--accent").trim();
    for (const p of pts) {
      if (!p.core && p.t < k) continue;
      ctx.fillStyle = p.core ? accent : ink;
      ctx.globalAlpha = p.core ? 1 : 0.55;
      ctx.fillRect(p.x * w - 1, p.y * h - 1, p.core ? 2.6 : 1.8, p.core ? 2.6 : 1.8);
    }
    ctx.globalAlpha = 1;
    pct.textContent = `${Math.round(k * 100)}%`;
    escEl.textContent = (1 + k * 0.08).toFixed(2);
  };
  draw();
  new ResizeObserver(draw).observe(canvas);
  return () => {
    if (reduced) { k = 0.9; draw(); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      // 0 → 90% over 3.2 s, hold, then loop back.
      const t = ((now - t0) / 1000) % 6;
      k = t < 3.2 ? (t / 3.2) * 0.9 : t < 5.2 ? 0.9 : 0.9 * (1 - (t - 5.2) / 0.8);
      draw();
      if (el.isConnected && el.closest(".case")?.classList.contains("in")) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
}

function forecastVisual(el: HTMLElement) {
  // An illustrative seasonal series: history, a hidden backtest window, then a forecast with a band.
  const W = 400, H = 200;
  const y = (i: number) => 140 - 30 * Math.sin(i / 8) - (i % 52 > 44 && i % 52 < 50 ? 60 * Math.sin(((i % 52) - 44) / 6 * Math.PI) : 0);
  const hist = Array.from({ length: 110 }, (_, i) => [i * 2.4, y(i)]);
  const fc = Array.from({ length: 50 }, (_, j) => [(110 + j) * 2.4, y(110 + j)]);
  const path = (a: number[][]) => a.map(([x, v], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${v.toFixed(1)}`).join("");
  const band = path(fc.map(([x, v], j) => [x, v - 6 - j * 0.35])) + fc.slice().reverse().map(([x, v], j) => `L${x.toFixed(1)} ${(v + 6 + (49 - j) * 0.35).toFixed(1)}`).join("") + "Z";
  const split = 86 * 2.4, now = 110 * 2.4;
  el.innerHTML = `
    <svg class="v-fc" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <rect class="v-fc-bt" x="${split}" y="10" width="${now - split}" height="${H - 30}" />
      <text class="v-fc-t" x="${now - 5}" y="22" text-anchor="end">backtest</text>
      <text class="v-fc-t" x="${now + 6}" y="22">forecast</text>
      <path class="v-fc-h" d="${path(hist)}" pathLength="1" />
      <path class="v-fc-band" d="${band}" />
      <path class="v-fc-f" d="${path(fc)}" pathLength="1" />
      <line class="v-fc-now" x1="${now}" x2="${now}" y1="10" y2="${H - 20}" />
    </svg>
    <p class="mono v-fc-n">Halloween backtest: 6.2% error vs 39.5% for the baseline · shape illustrative</p>`;
  return () => el.classList.add("play");
}

function metricsVisual(el: HTMLElement, reduced: boolean) {
  const rows: [string, number][] = [
    ["camus_object_store_puts_total", 0.9],
    ["camus_object_store_gets_total", 3.1],
    ["camus_object_store_lists_total", 0.2],
    ["camus_object_store_bytes_put_total", 410],
    ["camus_wal_unsealed_bytes{shard=\"3\"}", 0],
  ];
  el.innerHTML = `<p class="mono v-metrics-h">GET /metrics</p><pre class="v-metrics mono">${rows.map(([k]) => `<span>${k} <b>0</b></span>`).join("")}</pre><p class="mono v-metrics-n">Series from my two merged PRs · values illustrative</p>`;
  const vals = el.querySelectorAll("b");
  const n = rows.map(() => 0);
  return () => {
    if (reduced) { vals.forEach((b, i) => (b.textContent = String(Math.round(rows[i][1] * 1000)))); return; }
    const tick = () => {
      rows.forEach(([, rate], i) => {
        if (i === 4) n[i] = Math.round(4096 + Math.sin(performance.now() / 700) * 3500);
        else n[i] += Math.round(rate * (3 + Math.random() * 4));
        vals[i].textContent = n[i].toLocaleString("en-US");
      });
      if (el.closest(".case")?.classList.contains("in")) setTimeout(tick, 180);
    };
    tick();
  };
}

// ----------------------------------------------------------------------------

const cases: Case[] = [
  {
    slug: "forager",
    kicker: "Vennbee · search",
    title: "Forager: Google-style search inside a nested social network",
    line: "One sentence becomes a checked plan across communities, skills and vouches. Measured by 84 labelled queries in CI.",
    stats: [["92.9%", "parsed exactly right"], ["97.4%", "retrieval recall"], ["0", "private results leaked"]],
    visual: chipsVisual,
  },
  {
    slug: "moderation",
    kicker: "Vennbee · trust and safety",
    title: "Moderation that keeps a new social network clean without banning Harshit",
    line: "Every kind of user content covered, to meet Apple's rules for user content, without punishing people for their real names.",
    stats: [["41,861", "blocked link hosts"], ["Every", "surface reportable"], ["Live", "in Vennbee today"]],
    visual: moderationVisual,
  },
  {
    slug: "twobrains",
    kicker: "Open source · neuroscience",
    title: "How much of a real brain can you delete before it stops working?",
    line: "A complete fly brain, 139,248 neurons, running in a browser tab while you delete it.",
    stats: [["90%", "deleted, escape still works"], ["316", "neurons to escape"], ["~0.3–1s", "per whole-brain test"]],
    visual: brainVisual,
  },
  {
    slug: "foresight",
    kicker: "Side project · forecasting",
    title: "Forecasts that have to prove themselves before they're shown",
    line: "Claude picks the data, TimesFM forecasts it, and every answer is backtested against a baseline first.",
    stats: [["6.2%", "backtest error, Halloween"], ["Oct 31", "peak found from numbers alone"], ["2–4¢", "per question"]],
    visual: forecastVisual,
  },
  {
    slug: "camus",
    kicker: "Open-source contribution · Rust",
    title: "Making a Kafka broker's cloud bill something you can measure",
    line: "Metrics that turn Camus's R2 cost model into real numbers, plus RFCs on scaling and quotas.",
    stats: [["2", "merged pull requests"], ["8", "object-store counters"], ["30/30", "failover runs passing"]],
    visual: metricsVisual,
  },
];

export function mountCases(root: HTMLElement, reduced: boolean) {
  root.innerHTML = cases
    .map(
      (c, i) => `
      <article class="case" data-slug="${c.slug}">
        <div class="case-copy">
          <p class="eyebrow mono">${String(i + 1).padStart(2, "0")} · ${esc(c.kicker)}</p>
          <h3 class="display">${esc(c.title)}</h3>
          <p class="case-line">${esc(c.line)}</p>
          <dl class="case-stats">${c.stats.map(([v, k]) => `<div><dd>${esc(v)}</dd><dt class="mono">${esc(k)}</dt></div>`).join("")}</dl>
          <a class="btn case-link" href="./${c.slug}/">Read the case study
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" /></svg>
          </a>
        </div>
        <div class="case-visual" aria-hidden="true"></div>
      </article>`,
    )
    .join("");

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement & { _play?: () => void; _played?: boolean };
        if (e.isIntersecting) {
          const wasIn = el.classList.contains("in");
          el.classList.add("in");
          if (!wasIn && el._play) el._play();
        } else {
          el.classList.remove("in");
        }
      }
    },
    { threshold: 0.35 },
  );

  root.querySelectorAll<HTMLElement & { _play?: () => void }>(".case").forEach((el, i) => {
    el._play = cases[i].visual(el.querySelector(".case-visual")!, reduced);
    io.observe(el);
  });
}
