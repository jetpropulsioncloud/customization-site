const LS_KEY = "bc_builder_state_v1";

const canvas = document.getElementById("canvas");
const note = document.getElementById("note");
const closeBtn = document.getElementById("closeBtn");
if (closeBtn) closeBtn.addEventListener("click", () => window.close());
let liveState = null;

function getRowH() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--row").trim();
  const n = parseInt(raw || "24", 10);
  return Number.isFinite(n) ? n : 24;
}

function gridToPx(x, y, w, h) {
  const rect = canvas.getBoundingClientRect();
  const cols = 12;
  const colW = rect.width / cols;
  const rowH = getRowH();

  return {
    left: x * colW,
    top: y * rowH,
    width: w * colW,
    height: h * rowH
  };
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function render() {
  canvas.innerHTML = "";

  let stateToUse = liveState;

  if (!stateToUse) {
    const raw = localStorage.getItem(LS_KEY);
    stateToUse = raw ? safeParse(raw) : null;
  }

  if (!stateToUse || (!Array.isArray(stateToUse.blocks) && !Array.isArray(stateToUse.decorations))) {
    note.textContent = "No saved layout found. Go to the editor and click Preview.";
    return;
  }

  const blocks = Array.isArray(stateToUse.blocks) ? stateToUse.blocks : [];
  const decos = Array.isArray(stateToUse.decorations) ? stateToUse.decorations : [];

  note.textContent = `Live preview: ${blocks.length} block(s), ${decos.length} decoration(s).`;

  for (const b of blocks) {
    const { left, top, width, height } = gridToPx(b.x || 0, b.y || 0, b.w || 1, b.h || 2);

    const el = document.createElement("div");
    el.className = "pv-block";
    el.style.transformOrigin = "center";
    el.style.transform = `rotate(${b.rot || 0}deg)`;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    const body = document.createElement("div");
    body.className = "pv-body";

    if (b.type === "text") {
      const t = document.createElement("div");
      t.className = "pv-text";
      t.style.fontFamily = b.fontFamily || "inherit";
      t.style.textAlign = b.align || "left";
      t.innerHTML = b.html || "";
      body.appendChild(t);
    }

    if (b.type === "image" || b.type === "banner") {
      const img = document.createElement("div");
      img.className = "pv-image";
      if (b.dataUrl) img.style.backgroundImage = `url('${b.dataUrl}')`;
      body.appendChild(img);
    }

    if (b.type === "vote") {
      const a = document.createElement("a");
      a.className = "pv-vote";
      a.href = (b.voteUrl || "").trim() || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = b.label || "Vote here";
      body.appendChild(a);
    }

    el.appendChild(body);
    canvas.appendChild(el);
  }

  const rect = canvas.getBoundingClientRect();
  for (const d of decos) {
    if (d.type !== "emoji") continue;

    const el = document.createElement("div");
    el.className = "pv-deco";
    el.textContent = d.value || "✨";

    const x = (d.x || 0) * rect.width;
    const y = (d.y || 0) * rect.height;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${d.size || 54}px`;
    el.style.opacity = `${d.opacity ?? 1}`;
    el.style.transform = `translate(-50%, -50%) rotate(${d.rot || 0}deg)`;

    canvas.appendChild(el);
  }
}

window.addEventListener("resize", render);
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.type !== "BC_PREVIEW_STATE") return;

  liveState = event.data.state;
  render();
});

window.addEventListener("load", render);
