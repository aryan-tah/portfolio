// Page background: a drafting / cutting mat, generated once as an alpha mask
// sized to the viewport and painted with a theme color (body::before), so it
// follows light/dark mode and the palette.

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};

/**
 * A drafting / cutting mat sized to the viewport: a fine grid with stronger
 * major lines, ruler ticks and numbers along the top and left edges, and angle
 * guides with protractor arcs fanning out of the bottom-left corner.
 */
function mat(): Mask {
  const W = Math.min(2600, Math.ceil(window.innerWidth)), H = Math.min(1800, Math.ceil(window.innerHeight));
  const [c, ctx] = canvas(W, H);
  const minor = 16, major = 80;
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // Grid: minor lines faint, major lines stronger. Offset half a pixel for crisp 1px lines.
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += minor) {
    ctx.globalAlpha = x % major === 0 ? 0.32 : 0.1;
    line(x + 0.5, 0, x + 0.5, H);
  }
  for (let y = 0; y <= H; y += minor) {
    ctx.globalAlpha = y % major === 0 ? 0.32 : 0.1;
    line(0, y + 0.5, W, y + 0.5);
  }

  // Angle guides and arcs from the bottom-left corner, kept quiet so they never
  // compete with the diagrams drawn over them.
  ctx.globalAlpha = 0.16;
  ctx.setLineDash([6, 6]);
  const ox = 0, oy = H, reach = Math.hypot(W, H);
  for (const deg of [15, 30, 45, 60, 75]) {
    const a = (deg * Math.PI) / 180;
    line(ox, oy, ox + Math.cos(a) * reach, oy - Math.sin(a) * reach);
  }
  ctx.setLineDash([]);
  for (const r of [major * 4, major * 8, major * 12]) {
    ctx.beginPath();
    ctx.arc(ox, oy, r, -Math.PI / 2, 0);
    ctx.stroke();
  }
  // Degree ticks along the middle arc, like a protractor.
  const pr = major * 8;
  for (let deg = 0; deg <= 90; deg += 5) {
    const a = (deg * Math.PI) / 180;
    const len = deg % 15 === 0 ? 12 : 6;
    line(ox + Math.cos(a) * pr, oy - Math.sin(a) * pr, ox + Math.cos(a) * (pr - len), oy - Math.sin(a) * (pr - len));
  }

  // Rulers along the top and left edges, below the nav so they stay visible.
  ctx.globalAlpha = 0.7;
  ctx.font = '500 10px "Geist Mono", ui-monospace, monospace';
  ctx.textBaseline = "top";
  const top = 56;
  for (let x = 0; x <= W; x += minor / 2) {
    const len = x % major === 0 ? 14 : x % (major / 2) === 0 ? 9 : x % minor === 0 ? 6 : 3;
    line(x + 0.5, top, x + 0.5, top + len);
    if (x % major === 0 && x > 0) ctx.fillText(String(x / major), x + 3, top + 4);
  }
  for (let y = top; y <= H; y += minor / 2) {
    const yy = y - top;
    const len = yy % major === 0 ? 14 : yy % (major / 2) === 0 ? 9 : yy % minor === 0 ? 6 : 3;
    line(0, y + 0.5, len, y + 0.5);
    if (yy % major === 0 && yy > 0) ctx.fillText(String(yy / major), 4, y + 3);
  }
  return { url: c.toDataURL(), size: "100% 100%", repeat: "no-repeat", opacity: 0.4 };
}

type Mask = { url: string; size: string; repeat: string; opacity: number };

let current: Mask | null = null;

export function applyBackdrop() {
  current = mat();
  const root = document.documentElement;
  root.style.setProperty("--bg-mask", `url("${current.url}")`);
  root.style.setProperty("--bg-mask-size", current.size);
  root.style.setProperty("--bg-mask-repeat", current.repeat);
  root.style.setProperty("--bg-opacity", String(current.opacity));
}

/** The mat is sized to the viewport, so it's redrawn when the window changes a lot. */
export function watchBackdropResize() {
  let t = 0;
  let w = window.innerWidth, h = window.innerHeight;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(() => {
      if (Math.abs(window.innerWidth - w) < 120 && Math.abs(window.innerHeight - h) < 160) return;
      w = window.innerWidth;
      h = window.innerHeight;
      applyBackdrop();
    }, 250);
  });
}
