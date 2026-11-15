// Hybrid search toy. Keyword scores are computed live from the text below;
// semantic scores are hand-set stand-ins for cosine similarity. The blend is
// the same shape Vennbee uses: score = α·semantic + (1 − α)·keyword.

type Community = { name: string; text: string };

const communities: Community[] = [
  { name: "UCR Bouldering Club", text: "bouldering climbing gym weekends saturday" },
  { name: "Climbing Gym Regulars", text: "climbing gym routes belay" },
  { name: "Climbing the Ladder: Career Club", text: "climbing careers resumes internships networking" },
  { name: "Weekend Warriors Rec League", text: "weekends basketball pickup league" },
  { name: "Sunday Hikers of the Inland Empire", text: "hiking trails outdoor sunday easy" },
  { name: "Riverside Trail Runners", text: "running trails outdoor races" },
  { name: "Night Owls Study Hall", text: "studying library late night quiet" },
  { name: "Board Game Night", text: "board games friday night casual" },
];

type Query = { q: string; semantic: number[] };

const queries: Query[] = [
  { q: "people who go bouldering on weekends", semantic: [0.92, 0.81, 0.18, 0.34, 0.41, 0.36, 0.08, 0.12] },
  { q: "somewhere quiet to study late", semantic: [0.06, 0.05, 0.31, 0.04, 0.08, 0.05, 0.94, 0.38] },
  { q: "outdoor stuff, nothing too intense", semantic: [0.44, 0.27, 0.09, 0.3, 0.9, 0.58, 0.05, 0.33] },
];

const STOP = new Set(["people", "who", "go", "on", "to", "the", "a", "of", "stuff", "nothing", "too", "somewhere"]);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));

function keywordScores(q: string): number[] {
  const qt = tokens(q);
  const raw = communities.map((c) => {
    const ct = new Set(tokens(c.name + " " + c.text));
    return qt.filter((w) => ct.has(w)).length;
  });
  const max = Math.max(...raw, 1);
  return raw.map((r) => r / max);
}

export function mountSearch(root: HTMLElement) {
  const qWrap = root.querySelector<HTMLElement>("[data-queries]")!;
  const slider = root.querySelector<HTMLInputElement>("[data-alpha]")!;
  const out = root.querySelector<HTMLOutputElement>("[data-alpha-out]")!;
  const list = root.querySelector<HTMLOListElement>("[data-results]")!;
  list.style.setProperty("--rows", String(communities.length));

  let qi = 0;

  const buttons = queries.map((q, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "query";
    b.setAttribute("role", "radio");
    b.textContent = `“${q.q}”`;
    b.addEventListener("click", () => {
      qi = i;
      render();
    });
    qWrap.appendChild(b);
    return b;
  });

  // Arrow keys move between queries, as a radio group should.
  qWrap.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    qi = (qi + d + queries.length) % queries.length;
    render();
    buttons[qi].focus();
  });

  const rows = communities.map((c) => {
    const li = document.createElement("li");
    li.className = "result";
    li.innerHTML = `
      <span class="result-rank"></span>
      <span class="result-name">${c.name}</span>
      <span class="result-bar" aria-hidden="true"><i></i><i></i></span>
      <span class="result-score"></span>`;
    list.appendChild(li);
    return li;
  });

  const render = () => {
    const alpha = Number(slider.value) / 100;
    out.textContent = `α ${alpha.toFixed(2)}`;
    slider.style.setProperty("--fill", `${slider.value}%`);
    buttons.forEach((b, i) => {
      b.setAttribute("aria-checked", String(i === qi));
      b.tabIndex = i === qi ? 0 : -1;
    });

    const q = queries[qi];
    const kw = keywordScores(q.q);
    const scored = communities.map((_, i) => {
      const k = (1 - alpha) * kw[i];
      const s = alpha * q.semantic[i];
      return { i, k, s, total: k + s };
    });
    const order = [...scored].sort((a, b) => b.total - a.total || a.i - b.i);
    order.forEach((r, rank) => {
      const li = rows[r.i];
      li.style.transform = `translateY(${rank * 50}px)`;
      li.querySelector(".result-rank")!.textContent = String(rank + 1);
      li.querySelector(".result-score")!.textContent = r.total.toFixed(2);
      // Two stacked bars, both scaled from the left: total underneath, keyword share on top.
      const [totalBar, kwBar] = li.querySelectorAll<HTMLElement>(".result-bar i");
      totalBar.style.transform = `scaleX(${Math.min(1, r.total)})`;
      kwBar.style.transform = `scaleX(${Math.min(1, r.k)})`;
      li.toggleAttribute("data-dim", r.total < 0.15);
    });
  };

  slider.addEventListener("input", render);
  render();
}
