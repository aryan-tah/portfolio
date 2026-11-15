import "./styles.css";
import { education, experience, projects, stack } from "./content";
import { mountSearch } from "./search";
import { mountTrace } from "./trace";
import { cleanNodes, messyNodes } from "./swarm/graph";
import { PHASES, SwarmScene, type LogLine } from "./swarm/scene";

const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const reduced = reducedQuery.matches;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// ---------------------------------------------------------------------------
// Clock in the nav: local time where I am, so people know when I'll reply.

function mountClock() {
  const el = $("[data-clock]");
  const f = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Los_Angeles",
  });
  const tick = () => (el.textContent = f.format(new Date()));
  tick();
  setInterval(tick, 15_000);
}

// ---------------------------------------------------------------------------
// Static sections rendered from content.ts

function renderWork() {
  $("[data-roles]").innerHTML = experience
    .map(
      (r) => `
      <article class="role">
        <div class="role-meta">
          <span class="mono">${esc(r.dates)}</span>
          <span>${esc(r.place)}</span>
        </div>
        <div>
          <h3>${esc(r.org)} <span>· ${esc(r.title)}</span></h3>
          <ul>${r.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          <div class="chips">${r.stack.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
        </div>
      </article>`,
    )
    .join("");
}

function renderProjects() {
  const list = $("[data-projects]");
  list.innerHTML = projects
    .map(
      (p, i) => `
      <li class="proj">
        <button class="proj-row" type="button" aria-expanded="false" aria-controls="proj-${i}">
          <span class="proj-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="proj-name">${esc(p.name)}</span>
          <span class="proj-line">${esc(p.line)}</span>
          <span class="proj-stack">${p.stack.map(esc).join(" · ")}</span>
          <span class="proj-year">${esc(p.year)}</span>
          <span class="proj-toggle" aria-hidden="true"></span>
        </button>
        <div class="proj-body" id="proj-${i}">
          <div>
            <div class="proj-detail">
              <p>${esc(p.detail)}</p>
              ${p.href ? `<a href="${esc(p.href)}" rel="noopener" tabindex="-1">${esc(p.href.replace(/^https?:\/\/(www\.)?/, ""))} ↗</a>` : ""}
            </div>
          </div>
        </div>
      </li>`,
    )
    .join("");

  list.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".proj-row");
    if (!btn) return;
    const item = btn.parentElement!;
    const open = !item.hasAttribute("data-open");
    item.toggleAttribute("data-open", open);
    btn.setAttribute("aria-expanded", String(open));
    // The link inside a collapsed row shouldn't be reachable by Tab.
    item.querySelector("a")?.setAttribute("tabindex", open ? "0" : "-1");
  });
}

function renderBackground() {
  $("[data-background]").innerHTML = `
    <div class="bg-cell">
      <h3>Education</h3>
      <p class="big">${esc(education.school)}</p>
      <p>${esc(education.degree)}, ${esc(education.dates)}. ${esc(education.focus)}.</p>
      <p style="margin-top:10px" class="mono fine">${esc(education.honors)}</p>
    </div>
    <div class="bg-cell">
      <h3>Languages</h3>
      <ul class="bg-list">${stack.languages.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <h3 style="margin-top:22px">Systems I reach for</h3>
      <ul class="bg-list">${stack.systems.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </div>`;
}

// ---------------------------------------------------------------------------
// Swarm rebuild

function mountSwarm() {
  const section = $("#swarm");
  const canvas = $<HTMLCanvasElement>("[data-swarm-canvas]");
  const tip = $("[data-swarm-tip]");
  const bar = $("[data-swarm-bar]");
  const hint = $("[data-swarm-hint]");
  const logEl = $("[data-log]");
  const phaseEls = [...document.querySelectorAll<HTMLElement>("[data-phase]")];
  const statEls = {
    services: $("[data-stat=services]"),
    edges: $("[data-stat=edges]"),
    crossings: $("[data-stat=crossings]"),
    waste: $("[data-stat=waste]"),
  };

  // Phase copy collapses with a grid-rows transition, which needs one inner element.
  phaseEls.forEach((li) => {
    const p = li.querySelector("p")!;
    p.innerHTML = `<span>${p.innerHTML}</span>`;
  });

  // Keep the heading honest if the graph changes.
  $("#swarm-title").textContent = `A backend with ${messyNodes.length} services. It needs ${cleanNodes.length}.`;

  const small = window.innerWidth < 720;
  // ?agents=dots draws the swarm as dots instead of cursors.
  const dots = new URLSearchParams(location.search).get("agents") === "dots";
  const scene = new SwarmScene(canvas, dots ? (small ? 130 : 240) : small ? 60 : 130);
  scene.agentStyle = dots ? "dot" : "cursor";
  scene.reduced = reduced;

  // The rebuild plays on its own once the diagram is fully in view, pauses if it
  // leaves, and the clean system keeps running traffic after it finishes.
  const DURATION = 10; // seconds, start to finish
  const playBtn = $<HTMLButtonElement>("[data-swarm-play]");
  let p = 0;
  let running = false; // render loop (any part of the section on screen)
  let inFull = false; // diagram entirely in frame
  let state: "idle" | "playing" | "paused" | "done" = "idle";
  let last = performance.now();
  let time = 0;
  let hover: { x: number; y: number } | null = null;
  let hoverId: string | null = null;
  let lastLogCount = -1;
  let lastPhase = "";
  const lastStats: Record<string, string> = {};

  const setState = (s: typeof state) => {
    state = s;
    playBtn.textContent = s === "playing" ? "Pause" : s === "done" ? "Replay" : s === "paused" ? "Resume" : "Play";
    playBtn.setAttribute("aria-label", `${playBtn.textContent} the swarm rebuild`);
    hint.toggleAttribute("data-hidden", s !== "idle");
  };

  playBtn.addEventListener("click", () => {
    if (state === "playing") setState("paused");
    else if (state === "done") {
      p = 0;
      setState("playing");
    } else setState("playing");
  });

  const renderLog = (lines: LogLine[]) => {
    const shown = lines.slice(-9);
    logEl.innerHTML = shown
      .map(
        (l) =>
          `<li><span>${esc(l.agent)}</span><span><b>${esc(l.verb)}</b> ${esc(l.text)}</span></li>`,
      )
      .join("");
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) time += dt;
    if (state === "playing" && inFull) {
      p = Math.min(1, p + dt / DURATION);
      if (p >= 1) setState("done");
    }

    scene.draw(p, time, hoverId);
    bar.style.transform = `scaleX(${p})`;

    // Phase
    let phase: string = PHASES[0].key;
    for (const ph of PHASES) if (p >= ph.at) phase = ph.key;
    if (phase !== lastPhase) {
      lastPhase = phase;
      phaseEls.forEach((el) => el.toggleAttribute("data-active", el.dataset.phase === phase));
    }

    // Stats, counted from the drawing
    const s = scene.stats();
    const next: Record<string, string> = {
      services: String(s.services),
      edges: String(s.edges),
      crossings: String(s.crossings),
      waste: String(s.waste),
    };
    for (const k of Object.keys(next) as (keyof typeof statEls)[]) {
      if (lastStats[k] !== next[k]) {
        statEls[k].textContent = next[k];
        lastStats[k] = next[k];
      }
    }

    // Log
    const count = scene.log.filter((l) => l.at <= p).length;
    if (count !== lastLogCount) {
      lastLogCount = count;
      renderLog(scene.log.slice(0, count));
    }

    // Tooltip follows the node, not the cursor, so it doesn't jitter.
    if (hover) {
      const h = scene.hit(hover.x, hover.y, p);
      hoverId = h ? scene.nodeAt(hover.x, hover.y) : null;
      if (h) {
        tip.hidden = false;
        tip.dataset.state = h.state;
        const html = `<strong>${esc(h.label)}</strong>${esc(h.text)}`;
        if (tip.innerHTML !== html) tip.innerHTML = html;
        const wrap = canvas.getBoundingClientRect();
        const left = Math.min(h.x + 14, wrap.width - tip.offsetWidth - 4);
        const top = h.y + 14 + tip.offsetHeight > wrap.height ? h.y - tip.offsetHeight - 14 : h.y + 14;
        tip.style.left = `${Math.max(4, left)}px`;
        tip.style.top = `${top}px`;
      } else {
        tip.hidden = true;
      }
    }

    if (running) requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };

  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) start();
      else running = false;
    },
    { rootMargin: "100px" },
  ).observe(section);

  // "Entirely in frame" means the diagram, below the sticky nav.
  new IntersectionObserver(
    ([e]) => {
      inFull = e.intersectionRatio >= 0.97;
      // Autoplay once, unless reduced motion is on; then it waits for the button.
      if (inFull && state === "idle" && !reduced) setState("playing");
    },
    { rootMargin: "-56px 0px 0px 0px", threshold: [0, 0.5, 0.97, 1] },
  ).observe($(".swarm-canvas-wrap"));

  new ResizeObserver(() => {
    scene.resize();
    if (!running) scene.draw(p, time);
  }).observe(canvas);

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    hover = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onMove);
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    hover = null;
    hoverId = null;
    tip.hidden = true;
  });

  // Theme changes swap the canvas palette.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => scene.readColors());

  scene.resize();
  setState("idle");
}

// ---------------------------------------------------------------------------

renderWork();
renderProjects();
renderBackground();
mountClock();
mountTrace($(".trace"), reduced);
mountSearch($(".hybrid"));
mountSwarm();
