// ── Data layer (localStorage) ─────────────────────────────────────────────────
const TODOS_KEY   = "tof_todos";
const HISTORY_KEY = "tof_history";

function loadTodos()  { try { return JSON.parse(localStorage.getItem(TODOS_KEY))   || []; } catch { return []; } }
function saveTodos(t) { localStorage.setItem(TODOS_KEY, JSON.stringify(t)); }
function loadHistory(){ try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }

function appendHistory(name, category, effort, status = "done") {
  const h = loadHistory();
  h.push({ name, category, completion_date: formatDate(todayDate()), status, effort });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

// ── Seed data (loaded once on first visit) ────────────────────────────────────
const SEED_TODOS = [
  { name: "Water plants",          category: "household", reoccuring: "TRUE",  reoccuring_rate: "1 week",   last_done: "25/7/2026", due_date: "1/8/2026",   effort: "1" },
  { name: "Finish climwin",        category: "science",   reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "",            effort: "5" },
  { name: "Clean bike",            category: "household", reoccuring: "TRUE",  reoccuring_rate: "2 week",   last_done: "19/7/2026", due_date: "3/8/2026",   effort: "3" },
  { name: "Create piano schedule", category: "hobbies",   reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "",            effort: "3" },
  { name: "Baking",                category: "hobbies",   reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "1/7/2026",  due_date: "19/8/2026",  effort: "4" },
  { name: "Edit photos",           category: "hobbies",   reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "",          due_date: "15/8/2026",  effort: "4" },
  { name: "Take photos",           category: "hobbies",   reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "1/7/2026",  due_date: "19/8/2026",  effort: "7" },
  { name: "Aus passport",          category: "admin",     reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "1/9/2026",   effort: "5" },
  { name: "UK passport",           category: "admin",     reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "7/10/2026",  effort: "5" },
  { name: "Prepare Aus tax 2026",  category: "admin",     reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "31/10/2026", effort: "4" },
  { name: "Data viz",              category: "hobbies",   reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "",          due_date: "15/8/2026",  effort: "6" },
  { name: "Clean bathroom",        category: "household", reoccuring: "TRUE",  reoccuring_rate: "2 week",   last_done: "25/7/2026", due_date: "8/8/2026",   effort: "3" },
  { name: "Laundry",               category: "household", reoccuring: "TRUE",  reoccuring_rate: "1 week",   last_done: "25/7/2026", due_date: "1/8/2026",   effort: "1" },
  { name: "Frame pictures",        category: "household", reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "",            effort: "7" },
  { name: "Clean rangehood",       category: "household", reoccuring: "TRUE",  reoccuring_rate: "3 month",  last_done: "1/6/2026",  due_date: "1/9/2026",   effort: "4" },
  { name: "German focussed study", category: "hobbies",   reoccuring: "TRUE",  reoccuring_rate: "1 week",   last_done: "",          due_date: "1/8/2026",   effort: "4" },
  { name: "UK reregister to vote", category: "admin",     reoccuring: "FALSE", reoccuring_rate: "",         last_done: "",          due_date: "",            effort: "4" },
  { name: "Ecogon",                category: "coding",    reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "",          due_date: "8/8/2026",   effort: "8" },
  { name: "Choice matters RPG",    category: "coding",    reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "",          due_date: "15/8/2026",  effort: "8" },
  { name: "AI pipelines",          category: "coding",    reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "",          due_date: "8/8/2026",   effort: "5" },
  { name: "Birding",               category: "hobbies",   reoccuring: "TRUE",  reoccuring_rate: "1 month",  last_done: "26/7/2026", due_date: "26/8/2026",  effort: "8" },
  { name: "Clean kitchen",         category: "household", reoccuring: "TRUE",  reoccuring_rate: "2 weeks",  last_done: "",          due_date: "1/8/2026",   effort: "4" },
];

if (!localStorage.getItem(TODOS_KEY)) saveTodos(SEED_TODOS);

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayDate() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function parseDate(s) {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function daysDiff(a, b) {
  return Math.round((b - a) / 86400000);
}

function parseRate(rateStr) {
  if (!rateStr) return 7;
  const parts = rateStr.toLowerCase().split(" ");
  const n = parseInt(parts[0]) || 1;
  const unit = parts[1] || "";
  if (unit.includes("week"))  return n * 7;
  if (unit.includes("month")) return n * 30;
  return n;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── Probability logic (port of app.py:compute_weight) ─────────────────────────
function computeWeight(task, weightEffect = 1.0) {
  const today   = todayDate();
  const dueStr  = task.due_date  || "";
  const doneStr = task.last_done || "";

  if (doneStr) {
    const lastDone = parseDate(doneStr);
    const elapsed  = daysDiff(lastDone, today);

    if (!dueStr) return elapsed === 0 ? 0.0 : 1.0;

    const due      = parseDate(dueStr);
    const period   = Math.max(1, daysDiff(lastDone, due));
    const progress = elapsed / period;
    if (progress <= 0) return 0.0;

    const base = Math.min(1.0, progress);
    const rem  = daysDiff(today, due);
    const urgency = rem < 0 ? 3.0 : rem < 30 ? (30 - rem) / 10.0 : 0.0;
    return base + urgency * weightEffect;
  }

  if (!dueStr || weightEffect === 0) return 1.0;
  const rem = daysDiff(today, parseDate(dueStr));
  if (rem < 0)   return 1.0 + 3.0 * weightEffect;
  if (rem >= 30) return 1.0;
  return 1.0 + (30 - rem) / 10.0 * weightEffect;
}

function weightedRandomChoice(items, weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── Spin (port of /api/spin) ──────────────────────────────────────────────────
function spinLocal(energy, weightEffect) {
  const byEnergy   = loadTodos().filter(t => parseInt(t.effort) <= energy);
  const weighted   = byEnergy.map(t => ({ t, w: computeWeight(t, weightEffect) }));
  const candidates = weighted.filter(({ w }) => w > 0);
  if (!candidates.length) return { error: "no_tasks" };

  const items      = candidates.map(c => c.t);
  const weights    = candidates.map(c => c.w);
  const total      = weights.reduce((a, b) => a + b, 0);
  const normalised = weights.map(w => w / total);
  const selected   = weightedRandomChoice(items, weights);

  return {
    selected: selected.name,
    tasks: items.map((t, i) => ({
      name: t.name, category: t.category,
      effort: parseInt(t.effort), weight: normalised[i], due_date: t.due_date,
    })),
  };
}

// ── Complete / Skip (ports of /api/complete and /api/skip) ────────────────────
function completeTodoLocal(name) {
  const today   = todayDate();
  const updated = [];
  for (const t of loadTodos()) {
    if (t.name === name) {
      appendHistory(t.name, t.category, t.effort, "done");
      if (t.reoccuring === "TRUE") {
        t.last_done = formatDate(today);
        if (t.reoccuring_rate) t.due_date = formatDate(addDays(today, parseRate(t.reoccuring_rate)));
        updated.push(t);
      }
      // non-recurring: dropped (not pushed)
    } else {
      updated.push(t);
    }
  }
  saveTodos(updated);
}

function skipTodoLocal(name) {
  const task = loadTodos().find(t => t.name === name);
  if (task) appendHistory(task.name, task.category, task.effort, "skipped");
}

// ── Todo CRUD (ports of /api/todos/*) ─────────────────────────────────────────
function addTodoLocal(payload) {
  const name = (payload.name || "").trim();
  if (!name) return { error: "name_required" };
  const todos = loadTodos();
  if (todos.some(t => t.name === name)) return { error: "duplicate_name" };
  todos.push({
    name,
    category:        (payload.category || "").trim(),
    reoccuring:      payload.reoccuring ? "TRUE" : "FALSE",
    reoccuring_rate: (payload.reoccuring_rate || "").trim(),
    last_done:       "",
    due_date:        (payload.due_date || "").trim(),
    effort:          String(parseInt(payload.effort) || 1),
  });
  saveTodos(todos);
  return { ok: true };
}

function updateTodoLocal(originalName, payload) {
  const todos = loadTodos();
  const idx   = todos.findIndex(t => t.name === originalName);
  if (idx === -1) return { error: "not_found" };
  todos[idx] = {
    name:            (payload.name || originalName).trim(),
    category:        (payload.category || "").trim(),
    reoccuring:      payload.reoccuring ? "TRUE" : "FALSE",
    reoccuring_rate: (payload.reoccuring_rate || "").trim(),
    last_done:       todos[idx].last_done,
    due_date:        (payload.due_date || "").trim(),
    effort:          String(parseInt(payload.effort) || todos[idx].effort || 1),
  };
  saveTodos(todos);
  return { ok: true };
}

function deleteTodoLocal(name) {
  saveTodos(loadTodos().filter(t => t.name !== name));
}

// ── Category → colour ─────────────────────────────────────────────────────────
const DEFAULT_CATEGORY_COLORS = {
  household: "#3987e5",
  science:   "#008300",
  hobbies:   "#d55181",
  admin:     "#c98500",
  coding:    "#d95926",
};
const DEFAULT_FALLBACK_COLOR = "#d95926";

function getCategoryColors() {
  const s = loadSettings();
  return { ...DEFAULT_CATEGORY_COLORS, ...(s.categoryColors || {}) };
}

function getFallbackColor() {
  return loadSettings().fallbackColor || DEFAULT_FALLBACK_COLOR;
}

function getCategoryColor(cat) {
  return getCategoryColors()[cat] || getFallbackColor();
}

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("wheel-canvas");
const ctx    = canvas.getContext("2d");

// ── Settings (persisted in localStorage) ─────────────────────────────────────
const SETTINGS_KEY = "tof_settings";

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

function getSettings() {
  const s = loadSettings();
  return {
    spinDuration: s.spinDuration ?? 4,
    weightEffect: s.weightEffect ?? 1.0,
  };
}

function saveSettings(patch) {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
}

// ── Settings modal wiring ─────────────────────────────────────────────────────
const settingsModal  = document.getElementById("settings-modal");
const durationSlider = document.getElementById("duration-slider");
const durationVal    = document.getElementById("duration-val");
const weightSlider   = document.getElementById("weight-slider");
const weightVal      = document.getElementById("weight-val");

function openSettings() {
  const s = getSettings();
  durationSlider.value    = s.spinDuration;
  durationVal.textContent = s.spinDuration + "s";
  weightSlider.value      = s.weightEffect;
  weightVal.textContent   = s.weightEffect.toFixed(2);
  settingsModal.classList.remove("hidden");
  drawWeightGraph(s.weightEffect);
  populateCategoryColors();
}

function populateCategoryColors() {
  const container = document.getElementById("category-colors-list");
  const todos = loadTodos();
  const cats  = [...new Set(todos.map(t => t.category).filter(Boolean))];

  if (!cats.length) {
    container.innerHTML = '<p class="form-hint">No categories found.</p>';
    return;
  }

  container.innerHTML = "";
  const colors = getCategoryColors();

  cats.sort().forEach(cat => {
    const color = colors[cat] || getFallbackColor();
    const row = document.createElement("div");
    row.className = "color-row";
    row.innerHTML = `
      <input type="color" class="cat-color-input" value="${color}" data-cat="${cat}" title="${cat}">
      <span class="color-label">${cat}</span>
      <button class="color-reset-btn" data-cat="${cat}" title="Reset to default">Reset</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll(".cat-color-input").forEach(input => {
    input.addEventListener("input", () => {
      const existing = loadSettings().categoryColors || {};
      existing[input.dataset.cat] = input.value;
      saveSettings({ categoryColors: existing });
    });
  });

  container.querySelectorAll(".color-reset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat      = btn.dataset.cat;
      const existing = loadSettings().categoryColors || {};
      delete existing[cat];
      saveSettings({ categoryColors: existing });
      const input = container.querySelector(`.cat-color-input[data-cat="${cat}"]`);
      if (input) input.value = DEFAULT_CATEGORY_COLORS[cat] || DEFAULT_FALLBACK_COLOR;
    });
  });
}

durationSlider.addEventListener("input", () => {
  durationVal.textContent = durationSlider.value + "s";
  saveSettings({ spinDuration: parseInt(durationSlider.value) });
});

weightSlider.addEventListener("input", () => {
  const v = parseFloat(weightSlider.value).toFixed(2);
  weightVal.textContent = v;
  saveSettings({ weightEffect: parseFloat(v) });
  drawWeightGraph(parseFloat(v));
});

document.getElementById("settings-btn").addEventListener("click", openSettings);
document.getElementById("settings-close").addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});
settingsModal.addEventListener("click", e => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
});

// ── Weight graph ──────────────────────────────────────────────────────────────
const weightGraphCanvas = document.getElementById("weight-graph");

// Urgency curve for a fully-available task (base=1.0) — used only for the graph
function weightAt(daysRemaining, weightEffect) {
  if (daysRemaining < 0)   return 1.0 + 3.0 * weightEffect;
  if (daysRemaining >= 30) return 1.0;
  return 1.0 + (30 - daysRemaining) / 10 * weightEffect;
}

function drawWeightGraph(weightEffect) {
  const gc = weightGraphCanvas;
  const gx = gc.getContext("2d");
  const W  = gc.width, H = gc.height;

  const PAD = { top: 14, right: 10, bottom: 30, left: 36 };
  const pw  = W - PAD.left - PAD.right;
  const ph  = H - PAD.top  - PAD.bottom;

  const xMin = -8, xMax = 34;
  const yMin =  0, yMax = 4.5;
  const toX = d => PAD.left + ((d - xMin) / (xMax - xMin)) * pw;
  const toY = v => PAD.top + ph - ((v - yMin) / (yMax - yMin)) * ph;

  gx.clearRect(0, 0, W, H);
  gx.fillStyle = "#0f0f1a";
  gx.fillRect(0, 0, W, H);

  gx.strokeStyle = "rgba(255,255,255,0.07)";
  gx.lineWidth = 1;
  [1, 2, 3, 4].forEach(y => {
    const py = toY(y);
    gx.beginPath(); gx.moveTo(PAD.left, py); gx.lineTo(PAD.left + pw, py); gx.stroke();
  });

  gx.strokeStyle = "rgba(233,69,96,0.45)";
  gx.lineWidth = 1;
  gx.setLineDash([3, 3]);
  const dueX = toX(0);
  gx.beginPath(); gx.moveTo(dueX, PAD.top); gx.lineTo(dueX, PAD.top + ph); gx.stroke();
  gx.setLineDash([]);

  gx.strokeStyle = "rgba(255,255,255,0.2)";
  gx.lineWidth = 1;
  gx.setLineDash([4, 4]);
  const baseY = toY(1);
  gx.beginPath(); gx.moveTo(PAD.left, baseY); gx.lineTo(PAD.left + pw, baseY); gx.stroke();
  gx.setLineDash([]);

  const pts = [];
  for (let d = xMin; d <= xMax; d += 0.25) {
    pts.push([toX(d), toY(weightAt(d, weightEffect))]);
  }

  gx.beginPath();
  gx.moveTo(pts[0][0], baseY);
  pts.forEach(([px, py]) => gx.lineTo(px, py));
  gx.lineTo(pts[pts.length - 1][0], baseY);
  gx.closePath();
  gx.fillStyle = "rgba(57,135,229,0.15)";
  gx.fill();

  gx.beginPath();
  pts.forEach(([px, py], i) => i === 0 ? gx.moveTo(px, py) : gx.lineTo(px, py));
  gx.strokeStyle = "#3987e5";
  gx.lineWidth   = 2;
  gx.lineJoin    = "round";
  gx.stroke();

  gx.strokeStyle = "rgba(255,255,255,0.18)";
  gx.lineWidth   = 1;
  gx.beginPath();
  gx.moveTo(PAD.left, PAD.top); gx.lineTo(PAD.left, PAD.top + ph);
  gx.lineTo(PAD.left + pw, PAD.top + ph);
  gx.stroke();

  gx.fillStyle   = "rgba(255,255,255,0.4)";
  gx.font        = "10px 'Segoe UI', system-ui, sans-serif";
  gx.textAlign   = "right";
  gx.textBaseline = "middle";
  [1, 2, 3, 4].forEach(y => gx.fillText(`×${y}`, PAD.left - 4, toY(y)));

  gx.textBaseline = "top";
  [[-7, "-7d"], [0, "due"], [7, "+7d"], [14, "+14d"], [21, "+21d"], [30, "+30d"]].forEach(([d, lbl]) => {
    const px = toX(d);
    gx.strokeStyle = "rgba(255,255,255,0.18)";
    gx.beginPath(); gx.moveTo(px, PAD.top + ph); gx.lineTo(px, PAD.top + ph + 3); gx.stroke();
    gx.fillStyle = d === 0 ? "rgba(233,69,96,0.8)" : "rgba(255,255,255,0.4)";
    gx.textAlign = "center";
    gx.fillText(lbl, px, PAD.top + ph + 5);
  });
}

// ── Audio (Web Audio API — roulette ticks) ────────────────────────────────────
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTick(volume = 0.35) {
  if (!audioCtx) return;
  const sampleRate = audioCtx.sampleRate;
  const length     = Math.floor(sampleRate * 0.025);
  const buf        = audioCtx.createBuffer(1, length, sampleRate);
  const data       = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 10);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buf;
  const gain = audioCtx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

// ── Screen helpers ────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── Draw wheel ────────────────────────────────────────────────────────────────
function drawWheel(tasks, rotation) {
  const cx    = canvas.width  / 2;
  const cy    = canvas.height / 2;
  const r     = cx - 10;
  const slice = (2 * Math.PI) / tasks.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let startAngle = rotation;
  tasks.forEach(task => {
    const endAngle = startAngle + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle   = getCategoryColor(task.category);
    ctx.fill();
    ctx.strokeStyle = "#0f0f1a";
    ctx.lineWidth   = 2;
    ctx.stroke();

    const midAngle = startAngle + slice / 2;
    const labelR   = r * 0.65;
    const lx = cx + Math.cos(midAngle) * labelR;
    const ly = cy + Math.sin(midAngle) * labelR;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle   = "#fff";
    ctx.font        = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";

    const words = task.name.split(" ");
    const lines = [];
    let line = "";
    words.forEach(w => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > 90) { lines.push(line); line = w; }
      else line = test;
    });
    lines.push(line);
    lines.forEach((l, li) => {
      ctx.fillText(l, 0, (li - (lines.length - 1) / 2) * 16);
    });

    ctx.restore();
    startAngle = endAngle;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, 2 * Math.PI);
  ctx.fillStyle = "#0f0f1a";
  ctx.fill();
}

// ── Compute landing rotation ──────────────────────────────────────────────────
function computeTargetRotation(tasks, selectedName, currentRotation, minSpinRevs = 5) {
  const slice = (2 * Math.PI) / tasks.length;
  let sectorStart = 0;
  for (const task of tasks) {
    if (task.name === selectedName) {
      const sectorMid = sectorStart + slice / 2;
      const target    = -Math.PI / 2 - sectorMid;
      const minSpins  = minSpinRevs * 2 * Math.PI;
      let delta = ((target - currentRotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (delta < Math.PI / 4) delta += 2 * Math.PI;
      return currentRotation + minSpins + delta;
    }
    sectorStart += slice;
  }
  return currentRotation + minSpinRevs * 2 * Math.PI;
}

// ── Animation ─────────────────────────────────────────────────────────────────
let currentRotation = 0;

function animateSpin(tasks, targetRotation, durationMs, onDone) {
  const startRotation  = currentRotation;
  const totalDelta     = targetRotation - startRotation;
  let startTime        = null;
  let lastTickRotation = startRotation;
  const avgSectorAngle = (2 * Math.PI) / tasks.length;

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed  = ts - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    currentRotation = startRotation + totalDelta * easeOut(progress);

    if (Math.abs(currentRotation - lastTickRotation) >= avgSectorAngle) {
      const speed = 1 - easeOut(progress);
      playTick(0.15 + speed * 0.4);
      lastTickRotation = currentRotation;
    }

    drawWheel(tasks, currentRotation);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      currentRotation = targetRotation;
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

// ── State ─────────────────────────────────────────────────────────────────────
let selectedTask = null;

// ── Spin button ───────────────────────────────────────────────────────────────
document.getElementById("spin-btn").addEventListener("click", () => {
  const energy = parseInt(document.getElementById("energy-input").value, 10);
  if (!energy || energy < 1) return;

  ensureAudio();

  const { spinDuration, weightEffect } = getSettings();
  const data = spinLocal(energy, weightEffect);

  if (data.error === "no_tasks") {
    showScreen("notasks-screen");
    return;
  }

  showScreen("wheel-screen");
  document.getElementById("spinning-label").textContent = "Spinning…";

  const { selected, tasks } = data;
  selectedTask = tasks.find(t => t.name === selected);

  drawWheel(tasks, currentRotation);
  const targetRotation = computeTargetRotation(tasks, selected, currentRotation);

  animateSpin(tasks, targetRotation, spinDuration * 1000, () => {
    document.getElementById("spinning-label").textContent = "";
    showResult(selectedTask);
  });
});

// ── Show result ───────────────────────────────────────────────────────────────
function showResult(task) {
  document.getElementById("result-category").textContent = task.category;
  document.getElementById("result-name").textContent     = task.name;
  document.getElementById("result-effort").textContent   = `⚡ Effort: ${task.effort}`;
  document.getElementById("result-due").textContent      = task.due_date ? `📅 Due: ${task.due_date}` : "";
  showScreen("result-screen");
}

// ── Complete button ───────────────────────────────────────────────────────────
document.getElementById("complete-btn").addEventListener("click", () => {
  if (!selectedTask) return;
  completeTodoLocal(selectedTask.name);
  showScreen("energy-screen");
  selectedTask = null;
});

// ── Not done yet ──────────────────────────────────────────────────────────────
document.getElementById("notdone-btn").addEventListener("click", () => {
  if (!selectedTask) return;
  skipTodoLocal(selectedTask.name);
  showScreen("energy-screen");
  selectedTask = null;
});

// ── Spin again ────────────────────────────────────────────────────────────────
document.getElementById("respin-btn").addEventListener("click", () => {
  showScreen("energy-screen");
  selectedTask = null;
});

// ── Retry (no tasks) ──────────────────────────────────────────────────────────
document.getElementById("retry-btn").addEventListener("click", () => {
  showScreen("energy-screen");
});

// ── History ───────────────────────────────────────────────────────────────────
document.getElementById("history-btn").addEventListener("click", () => {
  showScreen("history-screen");
  const list    = document.getElementById("history-list");
  const empty   = document.getElementById("history-empty");
  list.innerHTML = "";

  const entries = loadHistory().slice().reverse();

  if (!entries.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  entries.forEach(e => {
    const status = e.status || "done";
    const item   = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <span class="history-name">${e.name}</span>
      <span class="history-cat">${e.category}</span>
      <span class="history-status history-status--${status}">${status === "skipped" ? "not done" : "done"}</span>
      <span class="history-date">${e.completion_date || ""}</span>
    `;
    list.appendChild(item);
  });
});

document.getElementById("history-back").addEventListener("click", () => {
  showScreen("energy-screen");
});

// ── Date form helpers ─────────────────────────────────────────────────────────
// App uses D/M/YYYY; <input type="date"> uses YYYY-MM-DD

function toInputDate(s) {
  if (!s) return "";
  const parts = s.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function fromInputDate(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

// ── Todos screen ──────────────────────────────────────────────────────────────
function loadTodosScreen() {
  const list  = document.getElementById("todos-list");
  const empty = document.getElementById("todos-empty");
  list.innerHTML    = "";
  empty.style.display = "none";

  const todos = loadTodos();

  if (!todos.length) {
    empty.style.display = "block";
    return;
  }

  todos.forEach(t => {
    const item      = document.createElement("div");
    item.className  = "todo-item";
    const recurring = t.reoccuring === "TRUE";
    const chips = [
      `<span class="todo-chip todo-chip--cat">${t.category || "—"}</span>`,
      `<span class="todo-chip todo-chip--effort">⚡ ${t.effort}</span>`,
      t.due_date ? `<span class="todo-chip todo-chip--due">📅 ${t.due_date}</span>` : "",
      recurring ? `<span class="todo-chip todo-chip--recurring">↻ ${t.reoccuring_rate || "recurring"}</span>` : "",
    ].filter(Boolean).join("");

    item.innerHTML = `
      <div class="todo-item-header">
        <span class="todo-name">${t.name}</span>
        <div class="todo-actions">
          <button class="icon-btn-sm edit-btn"   title="Edit">✎</button>
          <button class="icon-btn-sm delete-btn" title="Delete">✕</button>
        </div>
      </div>
      <div class="todo-meta">${chips}</div>
    `;

    item.querySelector(".edit-btn")  .addEventListener("click", () => openTodoModal(t));
    item.querySelector(".delete-btn").addEventListener("click", () => deleteTodo(t.name));
    list.appendChild(item);
  });
}

document.getElementById("todos-btn").addEventListener("click", () => {
  showScreen("todos-screen");
  loadTodosScreen();
});

document.getElementById("todos-back").addEventListener("click", () => {
  showScreen("energy-screen");
});

document.getElementById("todos-add-btn").addEventListener("click", () => openTodoModal());

function deleteTodo(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  deleteTodoLocal(name);
  loadTodosScreen();
}

// ── Add / Edit Todo modal ─────────────────────────────────────────────────────
const todoModal    = document.getElementById("todo-modal");
const todoRateRow  = document.getElementById("todo-rate-row");
const todoRecurring = document.getElementById("todo-recurring");
const todoRateInput = document.getElementById("todo-rate");
const todoError    = document.getElementById("todo-error");
let _editingName   = null;

function openTodoModal(todo = null) {
  _editingName = todo ? todo.name : null;
  document.getElementById("todo-modal-title").textContent = todo ? "Edit Todo" : "Add Todo";
  document.getElementById("todo-name").value     = todo ? todo.name            : "";
  document.getElementById("todo-category").value = todo ? (todo.category || "") : "";
  document.getElementById("todo-effort").value   = todo ? (todo.effort   || 3)  : 3;
  document.getElementById("todo-due").value      = todo ? toInputDate(todo.due_date) : "";

  const recurring = todo ? todo.reoccuring === "TRUE" : false;
  todoRecurring.checked      = recurring;
  todoRateInput.value        = todo ? (todo.reoccuring_rate || "") : "";
  todoRateInput.disabled     = !recurring;
  todoRateRow.style.opacity  = recurring ? "1" : "0.4";
  todoError.style.display    = "none";

  // Populate category datalist from localStorage
  const cats = [...new Set(loadTodos().map(t => t.category).filter(Boolean))];
  document.getElementById("cat-suggestions").innerHTML = cats.map(c => `<option value="${c}">`).join("");

  todoModal.classList.remove("hidden");
  setTimeout(() => document.getElementById("todo-name").focus(), 50);
}

function closeTodoModal() {
  todoModal.classList.add("hidden");
  _editingName = null;
}

todoRecurring.addEventListener("change", () => {
  const on = todoRecurring.checked;
  todoRateInput.disabled    = !on;
  todoRateRow.style.opacity = on ? "1" : "0.4";
  if (!on) todoRateInput.value = "";
});

document.getElementById("todo-save-btn")  .addEventListener("click", saveTodo);
document.getElementById("todo-cancel-btn").addEventListener("click", closeTodoModal);
document.getElementById("todo-modal-close").addEventListener("click", closeTodoModal);
document.getElementById("add-todo-btn")   .addEventListener("click", () => openTodoModal());

todoModal.addEventListener("click", e => {
  if (e.target === todoModal) closeTodoModal();
});

function saveTodo() {
  const name = document.getElementById("todo-name").value.trim();
  if (!name) { showTodoError("Name is required."); return; }

  const effort = parseInt(document.getElementById("todo-effort").value, 10);
  if (!effort || effort < 1 || effort > 10) {
    showTodoError("Effort must be between 1 and 10.");
    return;
  }

  const payload = {
    name,
    category:        document.getElementById("todo-category").value.trim(),
    effort,
    due_date:        fromInputDate(document.getElementById("todo-due").value),
    reoccuring:      todoRecurring.checked,
    reoccuring_rate: todoRecurring.checked ? todoRateInput.value.trim() : "",
  };

  const result = _editingName
    ? updateTodoLocal(_editingName, payload)
    : addTodoLocal(payload);

  if (result.error) {
    const msg = result.error === "duplicate_name" ? "A todo with that name already exists."
              : result.error === "name_required"  ? "Name is required."
              : "Something went wrong.";
    showTodoError(msg);
    return;
  }

  closeTodoModal();
  if (document.getElementById("todos-screen").classList.contains("active")) {
    loadTodosScreen();
  }
}

function showTodoError(msg) {
  todoError.textContent   = msg;
  todoError.style.display = "block";
}
