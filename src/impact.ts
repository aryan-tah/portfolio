// Hero ledger: what I built, measured. Each entry strikes out the old number
// and rolls the new one in on odometer wheels. The active row's progress bar is
// a CSS animation; when it ends, the next entry plays. Hovering pauses it.

type Impact = {
  project: string;
  old?: string; // struck through
  value: string; // rolls in
  line: string;
};

const impacts: Impact[] = [
  {
    project: "School voting system",
    old: "4 days",
    value: "5 min",
    line: "to count a school election. 1,000+ students voted in one day on 30 lab computers, replacing 15 years of paper ballots.",
  },
  {
    project: "Vennbee",
    value: "160+",
    line: "sign-ups in a single day for the social app I co-founded. I own its backend, including Google-style search across nested communities.",
  },
  {
    project: "TwoBrains",
    old: "139,248",
    value: "316",
    line: "neurons a real fly brain needs to escape a threat. I ran the whole connectome in a browser tab, then deleted the rest.",
  },
  {
    project: "Discord MusicBot",
    value: "3.2K",
    line: "GitHub stars on the open-source bot I contributed to in 10th grade, used by 300K+ people.",
  },
  {
    project: "UC Wide",
    value: "150,000",
    line: "incoming and transfer students on UC Wide, the University of California system tool I tested before launch.",
  },
  {
    project: "Camus",
    old: "JVM + ZooKeeper",
    value: "1 binary",
    line: "for a Kafka-compatible broker in Rust, its log in Cloudflare R2. I made its R2 cost measurable (2 merged PRs) and wrote RFCs on scaling and quotas.",
  },
];

/** Digits become wheels that roll from 0; everything else is set as plain text. */
function setValue(el: HTMLElement, text: string, reduced: boolean) {
  el.innerHTML = [...text]
    .map((ch) =>
      /\d/.test(ch)
        ? `<span class="dg"><span class="dg-reel">${"0123456789"
            .split("")
            .map((d) => `<span>${d}</span>`)
            .join("")}</span></span>`
        : `<span class="ch">${ch === " " ? "&nbsp;" : ch}</span>`,
    )
    .join("");
  const reels = [...el.querySelectorAll<HTMLElement>(".dg-reel")];
  const digits = [...text].filter((c) => /\d/.test(c)).map(Number);
  const roll = () =>
    reels.forEach((r, i) => {
      // Each wheel takes a little longer than the one before, like a real odometer.
      r.style.transitionDuration = reduced ? "0ms" : `${720 + i * 110}ms`;
      r.style.transform = `translateY(${-digits[i] * 10}%)`;
      // Narrow the window to the digit it lands on, so a "1" doesn't sit in a "0"-wide slot.
      const target = r.children[digits[i]] as HTMLElement;
      (r.parentElement as HTMLElement).style.width = `${target.getBoundingClientRect().width}px`;
    });
  if (reduced) roll();
  else requestAnimationFrame(() => requestAnimationFrame(roll));
}

export function mountImpact(root: HTMLElement, reduced: boolean) {
  const stage = root.querySelector<HTMLElement>("[data-stage]")!;
  const kicker = root.querySelector<HTMLElement>("[data-kicker]")!;
  const oldEl = root.querySelector<HTMLElement>("[data-old]")!;
  const newEl = root.querySelector<HTMLElement>("[data-new]")!;
  const lineEl = root.querySelector<HTMLElement>("[data-line]")!;
  const live = root.querySelector<HTMLElement>("[data-live]")!;
  const index = root.querySelector<HTMLOListElement>("[data-index]")!;

  index.innerHTML = impacts
    .map(
      (m, i) => `<li>
        <button type="button" data-i="${i}">
          <span class="ix-n mono">${String(i + 1).padStart(2, "0")}</span>
          <span class="ix-name">${m.project}</span>
          <span class="ix-val mono">${m.value}</span>
          <span class="ix-bar" aria-hidden="true"><i></i></span>
        </button>
      </li>`,
    )
    .join("");
  const rows = [...index.querySelectorAll<HTMLButtonElement>("button")];

  let current = -1;
  const show = (i: number) => {
    current = i;
    const m = impacts[i];
    rows.forEach((r, k) => {
      r.toggleAttribute("data-active", k === i);
      r.setAttribute("aria-current", k === i ? "true" : "false");
      // Restart the progress bar on the active row.
      const bar = r.querySelector<HTMLElement>(".ix-bar i")!;
      bar.classList.remove("run");
      if (k === i) {
        void bar.offsetWidth;
        bar.classList.add("run");
      }
    });

    stage.classList.remove("in");
    void stage.offsetWidth;
    kicker.textContent = m.project;
    oldEl.querySelector("span")!.textContent = m.old ?? "";
    oldEl.toggleAttribute("hidden", !m.old);
    setValue(newEl, m.value, reduced);
    lineEl.textContent = m.line;
    stage.classList.add("in");
    live.textContent = `${m.project}: ${m.old ? `from ${m.old} to ` : ""}${m.value} ${m.line}`;
  };

  index.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (b) show(Number(b.dataset.i));
  });
  // When the active bar fills, move on.
  index.addEventListener("animationend", (e) => {
    if ((e.target as HTMLElement).classList.contains("run")) show((current + 1) % impacts.length);
  });
  // Off screen or in a background tab, the bar (and so the ledger) waits.
  const sync = (on: boolean) => root.toggleAttribute("data-paused", !on);
  new IntersectionObserver(([e]) => sync(e.isIntersecting)).observe(root);
  document.addEventListener("visibilitychange", () => sync(!document.hidden));

  // Wait for Pollen before measuring digit widths, or the wheels size to the fallback font.
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  void fontsReady.then(() => window.setTimeout(() => show(0), reduced ? 0 : 300));
}
