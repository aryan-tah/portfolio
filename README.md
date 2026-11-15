# Aryan Tah · portfolio

My personal site. I'm co-founder and forward deployed engineer (full stack) at [Vennbee](https://vennbee.com), where I own search, feed, moderation and real-time chat.

**Live:** [aryantah.com](https://aryantah.com)

![The hero: a rolling headline beside a live diagram of Vennbee's backend](docs/hero.png)

Most portfolio sites tell you someone is good at systems. I wanted this one to show it, so the centerpiece is a diagram that rebuilds itself while you watch. It's built from scratch in TypeScript and Canvas 2D, with no framework and about 15 KB of gzipped JavaScript.

## What's on the page

**Hero.** "I build systems real people run on," then a ledger of what that's meant in numbers: an election count that went from four days to five minutes, 160+ sign-ups in a day for Vennbee, a fly brain cut from 139,248 neurons to 316, a Kafka broker that runs as one binary, and more. Old numbers get struck out and new ones roll in on odometer wheels. The active row's progress bar is the timer; click any row to jump to it.

**Inside Vennbee.** In the Work section, "I build the search behind Vennbee": the highlighted word rolls through search, feed, moderation and real-time chat, and a diagram of Vennbee's backend lights that subsystem's request path.

![The swarm rebuild, partway through](docs/swarm-tangle.png)

**Swarm rebuild.** One screen. Once the diagram is fully in view, a 6.5-second rebuild plays on its own. It starts as a deliberately tangled v0 backend: 39 services, two search services the client has to merge itself, four copies of the moderation service, a polling fallback nobody turned off. A swarm of agents, drawn as multiplayer cursors, flies in and drags each service where it belongs: duplicates into the service that should own them, survivors into a layered design with 14 services. Connections that matter stretch along with the drag and turn into clean edges; the rest get cut the moment their service is picked up. Then traffic starts moving. The traffic keeps flowing after the rebuild ends, and a button pauses or replays it. Hover any node to see what was wrong with it or what it does now.

![The same section after the rebuild, in dark mode](docs/swarm-clean.png)

The four numbers next to the diagram (services, connections, edge crossings, duplicates) are counted from the drawing on every frame. They are not typed in. The clean layout's layer order came from a brute-force search over every ordering for the fewest crossings, which got it from 9 down to 3.

![The Forager demo: a query, its parsed plan, and the pipeline](docs/forager.png)

**Forager demo.** Vennbee's search takes Google-style queries over a nested social network. The demo types a complex query, such as "friends of friends in both SWE Internship 2027 and ACM at UCR who placed at Cutie Hack and know Python", shows the structured plan it parses into as chips, then lights the pipeline: parse, validate, keyword, semantic and facts lanes, fuse, graph rerank, permission check. Every plan uses fields Forager's plan schema really has; two queries come from Vennbee's search eval set and the rest combine its features.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-checks, then writes dist/
npm run preview   # serves dist/
```

## How it's put together

```
index.html            page structure and all static copy
forager/ moderation/ graph/ twobrains/ foresight/ camus/
                      one case-study page each
src/
  content.ts          experience, projects, education, stack (edit this first)
  main.ts             renders sections, runs the swarm's playback loop
  case.ts             entry for case-study pages
  cases.ts            home-page case studies, each with a small visual
  impact.ts           hero ledger: struck-out old numbers, odometer new ones
  system.ts           Vennbee subsystem diagram in the Work section
  forager.ts          Forager demo: query, parsed plan, pipeline
  styles.css          tokens, layout, every component
  swarm/
    graph.ts          both architectures, merge notes, crossing counter
    scene.ts          canvas renderer and the rebuild timeline
public/
  favicon.svg
  fonts/              Pollen, subset to Latin, and its OFL license
  vennbee.png         Vennbee app icon
  ucr.svg             UC Riverside mark (public domain, via Wikimedia Commons)
  hexhomes.png        HexHomes mark
  og.png              social preview, captured from the hero
```

A few decisions worth knowing about:

- **The swarm is a pure function of progress.** Every node position, edge cut and agent path is computed from progress `p` between 0 and 1, plus a separate clock for ambient motion like orbiting agents and packets. Playback just advances `p`, which is why pause and replay need no extra state, and why traffic keeps moving once `p` reaches 1.
- **It starts when you can see all of it.** A second `IntersectionObserver` watches the diagram, offset by the sticky nav, and only advances the rebuild while at least 97% of it is in frame. Scroll away mid-rebuild and it waits for you.
- **Each messy node names its fate.** In `graph.ts`, a node with `into: "search"` folds into the clean `search` node, and a node whose `into` is its own id survives and moves to its layered position. Merging nodes chase their target's current position, so the two move together.
- **The canvas only runs while it's on screen.** An `IntersectionObserver` starts and stops the `requestAnimationFrame` loop. Device pixel ratio is capped at 2.
- **Wide screens lay the clean design out left to right; phones lay it out top to bottom.** The same graph, with labels moved under the nodes.
- **Type is [Pollen](https://github.com/nidheesh-m-vakharia/pollen) by Nidheesh Vakharia for everything but labels, which use Geist Mono.** Pollen is self-hosted from `public/fonts/`, subset to Latin (106 KB instead of 700 KB), with its SIL Open Font License alongside. **Colors live in CSS.** Each palette is defined in OKLCH and redefined for dark mode. The canvas reads the same custom properties, so the diagram follows the system theme.

## Accessibility

- Respects `prefers-reduced-motion`: ambient motion, packets and CSS transitions turn off, and the swarm doesn't autoplay. It waits for the Play button.
- Every interactive control is a real `button` or `input` and works from the keyboard. The query chips behave as a radio group with arrow keys.
- Visible focus rings, a skip link, and hover effects limited to devices that can actually hover.

## Make it yours

Fork it, then:

1. Replace the copy in `src/content.ts` and the hero and contact text in `index.html`.
2. Put your own numbers in `src/impact.ts`, redraw the Vennbee diagram in `src/system.ts` and the two swarm architectures in `src/swarm/graph.ts`. The section's heading updates itself from the node counts.
3. Pick a palette. `src/styles.css` defines four (cobalt, signal, teal, honey), each with light and dark modes; set `data-palette` on `<html>` in `index.html`. On localhost a switcher in the bottom-right corner lets you compare them live. Each palette has one accent color and keeps it to small marks.
4. Update the `og:image` URL in `index.html` and the source link in the footer.

## Deploy

The live site runs on [Railway](https://railway.com) from the `Dockerfile`: Node builds the site, then [Caddy](https://caddyserver.com) serves `dist/` with compression, long-lived caching for hashed assets, and no-cache on the page itself. To ship from a checkout:

```bash
railway up
```

Pushing to `main` also publishes a copy to GitHub Pages through `.github/workflows/deploy.yml`. Vite's `base` is `./`, so the same build works on either.

## License

The code is MIT licensed; see [LICENSE](LICENSE). The written content about me (work history, project descriptions) is mine, so please swap in your own if you reuse the site.
