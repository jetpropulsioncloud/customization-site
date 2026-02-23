const LS_KEY = "bc_builder_state_v1";

const canvas = document.getElementById("canvas");
const blocksLayer = document.getElementById("blocksLayer");
const decoLayer = document.getElementById("decoLayer");

const addTextBtn = document.getElementById("addText");
const addImageBtn = document.getElementById("addImage");
const fontSelect = document.getElementById("fontSelect");

const toggleDecoBtn = document.getElementById("toggleDeco");
const addEmojiBtn = document.getElementById("addEmoji");
const emojiInput = document.getElementById("emojiInput");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const resetBtn = document.getElementById("resetBtn");

const exportDialog = document.getElementById("exportDialog");
const exportArea = document.getElementById("exportArea");
const closeExport = document.getElementById("closeExport");
const copyExport = document.getElementById("copyExport");
const MAX_TEXT_BLOCKS = 5;
const MAX_IMAGE_BLOCKS = 5;
const MAX_DECOS = 10;
const addBannerBtn = document.getElementById("addBanner");

let decoMode = false;
let history = [];

const state = {
  blocks: [],
  decorations: [],
  selectedDecoId: null,
  selectedBlockId: null
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function getGrid() {
  const rect = canvas.getBoundingClientRect();
  const cols = 12;
  const colW = rect.width / cols;
  const rowH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row"), 10) || 24;
  return { rect, cols, colW, rowH };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pxToGrid(xPx, yPx) {
  const { cols, colW, rowH } = getGrid();
  const gx = Math.round(xPx / colW);
  const gy = Math.round(yPx / rowH);
  return { x: clamp(gx, 0, cols - 1), y: clamp(gy, 0, 999) };
}
function saveState() {
  history.push(JSON.stringify(state));
  if (history.length > 50) history.shift();
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function sizePxToGrid(wPx, hPx) {
  const { cols, colW, rowH } = getGrid();
  const gw = Math.round(wPx / colW);
  const gh = Math.round(hPx / rowH);
  return { w: clamp(gw, 1, cols), h: clamp(gh, 2, 999) };
}

function gridToPx(x, y, w, h) {
  const { cols, colW, rowH } = getGrid();
  const px = x * colW;
  const py = y * rowH;
  const pw = (w * colW);
  const ph = (h * rowH);
  return { px, py, pw, ph, cols, colW, rowH };
}

function renderAll() {
  blocksLayer.innerHTML = "";
  decoLayer.innerHTML = "";

  for (const b of state.blocks) renderBlock(b);
  for (const d of state.decorations) renderDeco(d);
}

function makeBlockShell(b) {
  const el = document.createElement("div");
  el.className = "block";
  el.dataset.id = b.id;

  const head = document.createElement("div");
  head.className = "block-head";

  const title = document.createElement("div");
  title.className = "block-title";
  title.textContent = b.type === "text" ? "Text Box" : "Image Box";

  const actions = document.createElement("div");
  actions.className = "block-actions";

  const del = document.createElement("button");
  del.className = "iconbtn";
  del.type = "button";
  del.textContent = "Delete";

  del.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.blocks = state.blocks.filter(x => x.id !== b.id);
    renderAll();
    saveState();
  });
  el.addEventListener("pointerdown", (e) => {
    if (decoMode) return;
    state.selectedBlockId = b.id;
    if (fontSelect) {
      fontSelect.value = b.fontFamily || "inherit";
    }
  });
  actions.appendChild(del);
  head.appendChild(title);
  head.appendChild(actions);

  const body = document.createElement("div");
  body.className = "block-body";

  const resize = document.createElement("div");
  resize.className = "resize";
  resize.title = "Resize";

  el.appendChild(head);
  el.appendChild(body);
  el.appendChild(resize);

  setupDrag(el, head, b, "block");
  setupResize(el, resize, b, "block");

  return { el, body };
}
function addBannerBlock() {
  if (state.blocks.some(b => b.type === "banner")) {
    alert("Only one banner allowed.");
    return;
  }

  const b = {
    id: uid("blk"),
    type: "banner",
    x: 0,
    y: 0,
    w: 12,
    h: 6,
    dataUrl: ""
  };

  state.blocks.push(b);
  renderAll();
}
function addVoteBlock() {
  if (state.blocks.some(b => b.type === "vote")) {
    alert("Only one vote button allowed.");
    return;
  }

  const b = {
    id: uid("blk"),
    type: "vote",
    x: 9,
    y: 6,
    w: 3,
    h: 3
  };

  state.blocks.push(b);
  renderAll();
}
function togglePreview(on) {
  document.body.classList.toggle("preview", on);
}
function validateBeforePublish() {
  const hasBanner = state.blocks.some(b => b.type === "banner");
  const hasVote = state.blocks.some(b => b.type === "vote");

  if (!hasBanner) {
    alert("You must add a banner.");
    return false;
  }

  if (!hasVote) {
    alert("You must add a vote button.");
    return false;
  }

  return true;
}
function renderBlock(b) {
  const { el, body } = makeBlockShell(b);
  const { px, py, pw, ph } = gridToPx(b.x, b.y, b.w, b.h);
  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;

  if (b.type === "text") {
    const rte = document.createElement("div");
    rte.className = "rte";
    rte.contentEditable = "true";
    rte.spellcheck = true;
    rte.innerHTML = b.html || "<b>Title</b><br/>Write your lore, staff info, rules, etc.";
    rte.addEventListener("input", () => {
      b.html = rte.innerHTML;
    });
    body.appendChild(rte);
  }
  if (b.fontFamily) {
    rte.style.fontFamily = b.fontFamily;
  }
  if (b.type === "image") {
    const box = document.createElement("div");
    box.className = "imagebox";

    const label = document.createElement("div");
    label.innerHTML = "<b>Image Block</b><div class='muted'>Choose an image to preview.</div>";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    const preview = document.createElement("div");
    preview.className = "muted";
    preview.style.fontWeight = "900";
  if (b.type === "vote") {
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = "Vote for this server";
    body.appendChild(btn);
  }

    if (b.dataUrl) {
      box.style.backgroundImage = `url('${b.dataUrl}')`;
      box.style.backgroundSize = "cover";
      box.style.backgroundPosition = "center";
      box.style.borderStyle = "solid";
      label.style.display = "none";
      preview.textContent = "Image set";
    }

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const dataUrl = await fileToDataUrl(file);
      b.dataUrl = dataUrl;

      box.style.backgroundImage = `url('${dataUrl}')`;
      box.style.backgroundSize = "cover";
      box.style.backgroundPosition = "center";
      box.style.borderStyle = "solid";
      label.style.display = "none";
      preview.textContent = "Image set";
    });

    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(preview);
    body.appendChild(box);
  }

  blocksLayer.appendChild(el);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function renderDeco(d) {
  const el = document.createElement("div");
  el.className = "deco";
  el.dataset.id = d.id;
  el.textContent = d.value;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "deco-del";
  del.textContent = "×";
  const rot = document.createElement("div");
  rot.className = "deco-rot";

  rot.addEventListener("pointerdown", (e) => {
    if (!decoMode) return;
    e.preventDefault();
    e.stopPropagation();

    state.selectedDecoId = d.id;
    renderAll();

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + d.x * rect.width;
    const centerY = rect.top + d.y * rect.height;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startRot = Number(d.rot || 0);

    const onMove = (ev) => {
      ev.preventDefault();

      const ang = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      const deltaDeg = (ang - startAngle) * (180 / Math.PI);

      let next = startRot + deltaDeg;

      if (ev.shiftKey) {
        next = Math.round(next / 15) * 15;
      }

      d.rot = next;

      renderAll();
      saveState();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  el.appendChild(rot);
  del.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  del.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    state.decorations = state.decorations.filter(x => x.id !== d.id);
    if (state.selectedDecoId === d.id) state.selectedDecoId = null;

    renderAll();
    saveState();
  });

  el.appendChild(del);  const res = document.createElement("div");
  res.className = "deco-resize";
  res.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  el.appendChild(res);

  const rect = canvas.getBoundingClientRect();
  el.style.left = `${d.x * rect.width}px`;
  el.style.top = `${d.y * rect.height}px`;
  el.style.fontSize = `${d.size}px`;
  el.style.opacity = `${d.opacity}`;
  el.style.transform = `rotate(${d.rot}deg)`;
  el.style.zIndex = String(d.z || 1);

  el.addEventListener("pointerdown", (e) => {
    if (!decoMode) return;
    e.preventDefault();
    selectDeco(el);
  });

  setupDrag(el, el, d, "deco");
  setupDecoResize(el, res, d);

  decoLayer.appendChild(el);
}

function setupDrag(containerEl, handleEl, item, kind) {
  handleEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".deco-resize")) return;
    if (e.target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;

    if (kind === "deco" && !decoMode) return;
    if (kind === "block" && decoMode) return;
    if (kind === "deco") {
      state.selectedDecoId = item.id;
      for (const node of decoLayer.querySelectorAll(".deco")) node.classList.remove("selected");
      const node = decoLayer.querySelector(`[data-id="${item.id}"]`);
      if (node) node.classList.add("selected");
    }

    e.preventDefault();    

    const startX = e.clientX;
    const startY = e.clientY;

    const rect = containerEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const origLeft = rect.left - canvasRect.left;
    const origTop = rect.top - canvasRect.top;

    handleEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (kind === "block") {
        const nextLeft = origLeft + dx;
        const nextTop = origTop + dy;

        const g = pxToGrid(nextLeft, nextTop);
        item.x = g.x;
        item.y = g.y;

        const { px, py, pw, ph } = gridToPx(item.x, item.y, item.w, item.h);
        containerEl.style.left = `${px}px`;
        containerEl.style.top = `${py}px`;
        containerEl.style.width = `${pw}px`;
        containerEl.style.height = `${ph}px`;
      }

      if (kind === "deco") {
        const canvasW = canvasRect.width;
        const canvasH = canvasRect.height;
        const nx = clamp((origLeft + dx) / canvasW, 0, 1);
        const ny = clamp((origTop + dy) / canvasH, 0, 1);
        item.x = nx;
        item.y = ny;
        containerEl.style.left = `${nx * canvasW}px`;
        containerEl.style.top = `${ny * canvasH}px`;
      }
    };

    const onUp = () => {
      handleEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function setupResize(blockEl, handleEl, b) {
  handleEl.addEventListener("pointerdown", (e) => {
    if (decoMode) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;

    const rect = blockEl.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;

    handleEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const nextW = Math.max(80, startW + dx);
      const nextH = Math.max(120, startH + dy);

      const g = sizePxToGrid(nextW, nextH);
      b.w = g.w;
      b.h = g.h;

      const { px, py, pw, ph } = gridToPx(b.x, b.y, b.w, b.h);
      blockEl.style.left = `${px}px`;
      blockEl.style.top = `${py}px`;
      blockEl.style.width = `${pw}px`;
      blockEl.style.height = `${ph}px`;
    };

    const onUp = () => {
      handleEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function setupDecoResize(decoEl, handleEl, d) {
  handleEl.addEventListener("pointerdown", (e) => {
    if (!decoMode) return;
    e.preventDefault();

    const startY = e.clientY;
    const startSize = d.size;

    handleEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      const nextSize = clamp(startSize + dy * 0.2, 14, 180);
      d.size = nextSize;
      decoEl.style.fontSize = `${nextSize}px`;
    };

    const onUp = () => {
      handleEl.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function addTextBlock() {
  if (state.blocks.filter(b => b.type === "text").length >= MAX_TEXT_BLOCKS) {
    alert("Maximum text boxes reached.");
    return;
  }
  const id = uid("blk");
  const b = {
    id,
    type: "text",
    x: 1,
    y: 1,
    w: 6,
    h: 8,
    html: "<b>Title</b><br/>Write your lore, staff info, rules, etc."
  };
  state.blocks.push(b);
  renderAll();
}

function addImageBlock() {
  if (state.blocks.filter(b => b.type === "image").length >= MAX_IMAGE_BLOCKS) {
    alert("Maximum image boxes reached.");
    return;
  }
  const id = uid("blk");
  const b = {
    id,
    type: "image",
    x: 7,
    y: 1,
    w: 4,
    h: 8,
    dataUrl: ""
  };
  state.blocks.push(b);
  renderAll();
}

function addEmojiDeco() {
  setDecoMode(true);
  const emojiCount = state.decorations.filter(d => d.type === "emoji").length;
  if (emojiCount >= 10) {
    alert("Max 10 emojis for now.");
    return;
  }
  const raw = (emojiInput.value || "✨").trim() || "✨";
  const val = Array.from(raw).slice(0, 3).join("") || "✨";

  const id = uid("deco");
  const d = {
    id,
    type: "emoji",
    value: val,
    x: 0.52,
    y: 0.16,
    size: 54,
    opacity: 1,
    rot: 0,
    z: 10
  };

  state.decorations.push(d);
  renderAll();
  saveState();
}

function setDecoMode(on) {
  decoMode = on;

  toggleDecoBtn.textContent = `Edit decorations: ${decoMode ? "On" : "Off"}`;
  toggleDecoBtn.classList.toggle("primary", decoMode);
  toggleDecoBtn.classList.toggle("ghost", !decoMode);

  canvas.classList.toggle("deco-on", decoMode);
  canvas.style.cursor = decoMode ? "crosshair" : "default";

  if (!decoMode) {
    state.selectedDecoId = null;
    for (const node of decoLayer.querySelectorAll(".deco")) {
      node.classList.remove("selected");
    }
  }
}

function saveState() {
  const payload = JSON.stringify(state);
  localStorage.setItem(LS_KEY, payload);
}

function selectDeco(el) {
  for (const node of decoLayer.querySelectorAll(".deco")) {
    node.classList.remove("selected");
  }
  el.classList.add("selected");
  state.selectedDecoId = el.dataset.id;
}

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  const parsed = JSON.parse(raw);

  state.blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  state.decorations = Array.isArray(parsed.decorations) ? parsed.decorations : [];
  renderAll();
}

function resetState() {
  state.blocks = [];
  state.decorations = [];
  renderAll();
}

function exportState() {
  exportArea.value = JSON.stringify(state, null, 2);
  exportDialog.showModal();
}

function copyExportText() {
  navigator.clipboard.writeText(exportArea.value || "");
  copyExport.textContent = "Copied";
  setTimeout(() => (copyExport.textContent = "Copy"), 900);
}

canvas.addEventListener("pointerdown", (e) => {
  if (!decoMode) return;
  if (e.target.closest(".deco")) return;

  state.selectedDecoId = null;
  for (const node of decoLayer.querySelectorAll(".deco")) {
    node.classList.remove("selected");
  }
});

addTextBtn.addEventListener("click", addTextBlock);
addImageBtn.addEventListener("click", addImageBlock);
addBannerBtn.addEventListener("click", addBannerBlock);
if (fontSelect) {
  fontSelect.addEventListener("change", () => {
    if (!state.selectedBlockId) return;
    const b = state.blocks.find(x => x.id === state.selectedBlockId);
    if (!b) return;
    b.fontFamily = fontSelect.value || "inherit";
    renderAll();
    saveState();
  });
}
toggleDecoBtn.addEventListener("click", () => setDecoMode(!decoMode));
addEmojiBtn.addEventListener("click", addEmojiDeco);

saveBtn.addEventListener("click", () => {
  saveState();
  saveBtn.textContent = "Saved";
  setTimeout(() => (saveBtn.textContent = "Save"), 900);
});

loadBtn.addEventListener("click", () => loadState());

exportBtn.addEventListener("click", () => exportState());

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset canvas? This clears blocks and decorations.")) return;
  resetState();
});

window.addEventListener("keydown", (e) => {
  if (!decoMode) return;
  if (!state.selectedDecoId) return;

  if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();

    state.decorations = state.decorations.filter(d => d.id !== state.selectedDecoId);
    state.selectedDecoId = null;

    renderAll();
    saveState();
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();

    const step = e.shiftKey ? 0.02 : 0.005;
    const d = state.decorations.find(x => x.id === state.selectedDecoId);
    if (!d) return;

    if (e.key === "ArrowLeft") d.x -= step;
    if (e.key === "ArrowRight") d.x += step;
    if (e.key === "ArrowUp") d.y -= step;
    if (e.key === "ArrowDown") d.y += step;

    d.x = Math.max(0, Math.min(1, d.x));
    d.y = Math.max(0, Math.min(1, d.y));

    renderAll();
    saveState();
  }
});

closeExport.addEventListener("click", () => exportDialog.close());
copyExport.addEventListener("click", copyExportText);

window.addEventListener("resize", () => renderAll());
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    if (history.length > 1) {
      history.pop();
      const prev = history[history.length - 1];
      const parsed = JSON.parse(prev);
      state.blocks = parsed.blocks;
      state.decorations = parsed.decorations;
      renderAll();
    }
  }
});

addTextBlock();
addImageBlock();
setDecoMode(false);
renderAll();