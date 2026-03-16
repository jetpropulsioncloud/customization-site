import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PASTE",
  authDomain: "PASTE",
  projectId: "PASTE",
  storageBucket: "PASTE",
  messagingSenderId: "PASTE",
  appId: "PASTE"
};

const GRID = {
  columns: 12,
  width: 1120,
  rowHeight: 56,
  gap: 12,
  padding: 14
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const params = new URLSearchParams(window.location.search);
const serverId = params.get("id");

const els = {
  canvas: document.getElementById("canvas"),
  note: document.getElementById("note"),
  serverName: document.getElementById("serverName"),
  serverIp: document.getElementById("serverIp"),
  viewsPill: document.getElementById("viewsPill"),
  upvotesPill: document.getElementById("upvotesPill"),
  statusPill: document.getElementById("statusPill")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeHtml(dirty) {
  const t = document.createElement("template");
  t.innerHTML = String(dirty || "");

  const blocked = new Set(["script", "style", "iframe", "object", "embed", "link", "meta"]);
  const walker = document.createTreeWalker(t.content, NodeFilter.SHOW_ELEMENT, null);

  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;

    if (blocked.has(el.tagName.toLowerCase())) {
      toRemove.push(el);
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = (attr.value || "").trim();

      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && val.toLowerCase().startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  }

  for (const el of toRemove) el.remove();
  return t.innerHTML;
}

function gridToPx(x, y, w, h) {
  const cellW = (GRID.width - GRID.padding * 2 - GRID.gap * (GRID.columns - 1)) / GRID.columns;

  const px = GRID.padding + x * (cellW + GRID.gap);
  const py = GRID.padding + y * (GRID.rowHeight + GRID.gap);
  const pw = cellW * w + GRID.gap * (w - 1);
  const ph = GRID.rowHeight * h + GRID.gap * (h - 1);

  return { px, py, pw, ph };
}

function canvasHeightFromBlocks(blocks, decorations) {
  let maxBottom = 12;

  for (const b of blocks || []) {
    const bottom = (b.y || 0) + (b.h || 1);
    if (bottom > maxBottom) maxBottom = bottom;
  }

  for (const d of decorations || []) {
    const bottom = (d.y || 0) + (d.h || 1);
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return GRID.padding * 2 + maxBottom * (GRID.rowHeight + GRID.gap) + 40;
}

function makeBlockShell(b) {
  const el = document.createElement("div");
  el.className = "pv-block";

  const body = document.createElement("div");
  body.className = "pv-body";

  el.appendChild(body);
  return { el, body };
}

function renderBlock(b) {
  const { el, body } = makeBlockShell(b);
  const { px, py, pw, ph } = gridToPx(b.x || 0, b.y || 0, b.w || 1, b.h || 1);

  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;
  el.style.transform = `rotate(${b.rot || 0}deg)`;

  if (b.type === "text") {
    const box = document.createElement("div");
    box.className = "pv-text";
    box.innerHTML = sanitizeHtml(b.html || "");
    if (b.fontFamily) box.style.fontFamily = b.fontFamily;
    body.appendChild(box);
  }

  if (b.type === "image" || b.type === "banner") {
    const img = document.createElement("div");
    img.className = "pv-image";
    img.style.backgroundImage = `url("${escapeHtml(b.imageUrl || "")}")`;
    body.appendChild(img);
  }

  if (b.type === "vote") {
    const a = document.createElement("a");
    a.className = "pv-vote";
    a.href = String(b.voteUrl || "#");
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = String(b.label || "Vote here");
    body.appendChild(a);
  }

  return el;
}

function renderDecoration(d) {
  const el = document.createElement("div");
  el.className = "pv-deco";
  el.textContent = d.emoji || "✨";

  const { px, py, pw, ph } = gridToPx(d.x || 0, d.y || 0, d.w || 1, d.h || 1);

  el.style.left = `${px}px`;
  el.style.top = `${py}px`;
  el.style.width = `${pw}px`;
  el.style.height = `${ph}px`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = `${Math.max(24, Math.min(pw, ph) * 0.75)}px`;
  el.style.transform = `rotate(${d.rot || 0}deg)`;

  return el;
}

function renderPage(serverData, pageData) {
  els.serverName.textContent = serverData.name || "Untitled Server";
  els.serverIp.textContent = serverData.ip || "No IP listed";
  els.viewsPill.textContent = `${Number(serverData.views || 0).toLocaleString()} views`;
  els.upvotesPill.textContent = `${Number(serverData.upvotes || 0).toLocaleString()} upvotes`;
  els.statusPill.textContent = serverData.isPublished ? "Published" : "Draft";

  const blocks = Array.isArray(pageData.blocks) ? pageData.blocks : [];
  const decorations = Array.isArray(pageData.decorations) ? pageData.decorations : [];

  els.note.textContent = `Viewing published page for ${serverData.name || "this server"}.`;
  els.canvas.innerHTML = "";
  els.canvas.style.minHeight = `${canvasHeightFromBlocks(blocks, decorations)}px`;

  for (const b of blocks) {
    els.canvas.appendChild(renderBlock(b));
  }

  for (const d of decorations) {
    els.canvas.appendChild(renderDecoration(d));
  }
}

function renderError(message) {
  document.body.innerHTML = `
    <div class="topbar">
      <div class="wrap topbar-inner">
        <div class="brand">
          <div class="logo-mark"></div>
          <div class="logo-text">BlockClub</div>
        </div>
      </div>
    </div>
    <main class="wrap">
      <div class="error-box">
        <h2>Could not load server page</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    </main>
  `;
}

async function loadServerPage() {
  if (!serverId) {
    renderError("Missing server id in the URL. Use server.html?id=YOUR_SERVER_ID");
    return;
  }

  const serverRef = doc(db, "servers", serverId);
  const pageRef = doc(db, "servers", serverId, "pages", "main");

  const [serverSnap, pageSnap] = await Promise.all([
    getDoc(serverRef),
    getDoc(pageRef)
  ]);

  if (!serverSnap.exists()) {
    renderError("That server page does not exist.");
    return;
  }

  const serverData = serverSnap.data() || {};
  if (!serverData.isPublished) {
    renderError("This server page is not published yet.");
    return;
  }

  const pageData = pageSnap.exists() ? pageSnap.data() || {} : { blocks: [], decorations: [] };
  renderPage(serverData, pageData);
}

loadServerPage().catch((err) => {
  console.error(err);
  renderError(err.message || "Unknown error while loading the page.");
});