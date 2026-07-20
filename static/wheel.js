// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = [
  "#e94560", "#0f3460", "#533483", "#e8871e",
  "#1a936f", "#3a7ca5", "#c1666b", "#48a999",
  "#f4a261", "#264653",
];

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("wheel-canvas");
const ctx = canvas.getContext("2d");

// ── Settings (persisted in localStorage) ─────────────────────────────────────
const SETTINGS_KEY = "tof_settings";

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch { return {}; }
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
const settingsModal = document.getElementById("settings-modal");
const durationSlider = document.getElementById("duration-slider");
const durationVal = document.getElementById("duration-val");
const weightSlider = document.getElementById("weight-slider");
const weightVal = document.getElementById("weight-val");

function openSettings() {
  const s = getSettings();
  durationSlider.value = s.spinDuration;
  durationVal.textContent = s.spinDuration + "s";
  weightSlider.value = s.weightEffect;
  weightVal.textContent = s.weightEffect.toFixed(2);
  settingsModal.classList.remove("hidden");
}

durationSlider.addEventListener("input", () => {
  durationVal.textContent = durationSlider.value + "s";
  saveSettings({ spinDuration: parseInt(durationSlider.value) });
});

weightSlider.addEventListener("input", () => {
  const v = parseFloat(weightSlider.value).toFixed(2);
  weightVal.textContent = v;
  saveSettings({ weightEffect: parseFloat(v) });
});

document.getElementById("settings-btn").addEventListener("click", openSettings);
document.getElementById("settings-close").addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});
settingsModal.addEventListener("click", e => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
});

// ── Audio (Web Audio API — roulette ticks) ────────────────────────────────────
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTick(volume = 0.35) {
  if (!audioCtx) return;
  const sampleRate = audioCtx.sampleRate;
  const length = Math.floor(sampleRate * 0.025); // 25ms click
  const buf = audioCtx.createBuffer(1, length, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // white noise shaped with fast exponential decay → sharp click
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
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 10;
  const slice = (2 * Math.PI) / tasks.length; // equal segments regardless of probability

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let startAngle = rotation;
  tasks.forEach((task, i) => {
    const endAngle = startAngle + slice;

    // Sector
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#0f0f1a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const midAngle = startAngle + slice / 2;
    const labelR = r * 0.65;
    const lx = cx + Math.cos(midAngle) * labelR;
    const ly = cy + Math.sin(midAngle) * labelR;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
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

  // Centre cap
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, 2 * Math.PI);
  ctx.fillStyle = "#0f0f1a";
  ctx.fill();
}

// ── Compute landing rotation ──────────────────────────────────────────────────
// Pointer is at TOP (−π/2). Target: selected sector centre lands at −π/2.
function computeTargetRotation(tasks, selectedName, currentRotation, minSpinRevs = 5) {
  const slice = (2 * Math.PI) / tasks.length; // must match drawWheel equal-slice logic
  let sectorStart = 0;
  for (const task of tasks) {
    if (task.name === selectedName) {
      const sectorMid = sectorStart + slice / 2;
      const target = -Math.PI / 2 - sectorMid;
      const minSpins = minSpinRevs * 2 * Math.PI;
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
  const startRotation = currentRotation;
  const totalDelta = targetRotation - startRotation;
  let startTime = null;
  let lastTickRotation = startRotation;

  // One tick per average sector crossing
  const avgSectorAngle = (2 * Math.PI) / tasks.length;

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    currentRotation = startRotation + totalDelta * easeOut(progress);

    // Tick when pointer passes a sector boundary
    if (Math.abs(currentRotation - lastTickRotation) >= avgSectorAngle) {
      // Volume tapers down as wheel slows
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
document.getElementById("spin-btn").addEventListener("click", async () => {
  const energy = parseInt(document.getElementById("energy-input").value, 10);
  if (!energy || energy < 1) return;

  ensureAudio(); // must be called during user gesture

  const { spinDuration, weightEffect } = getSettings();

  showScreen("wheel-screen");
  document.getElementById("spinning-label").textContent = "Spinning…";

  let data;
  try {
    const res = await fetch("/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ energy, weight_effect: weightEffect }),
    });
    data = await res.json();
  } catch {
    showScreen("energy-screen");
    return;
  }

  if (data.error === "no_tasks") {
    showScreen("notasks-screen");
    return;
  }

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
  document.getElementById("result-name").textContent = task.name;
  document.getElementById("result-effort").textContent = `⚡ Effort: ${task.effort}`;
  document.getElementById("result-due").textContent = task.due_date
    ? `📅 Due: ${task.due_date}`
    : "";
  showScreen("result-screen");
}

// ── Complete button ───────────────────────────────────────────────────────────
document.getElementById("complete-btn").addEventListener("click", async () => {
  if (!selectedTask) return;
  await fetch("/api/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: selectedTask.name }),
  });
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
document.getElementById("history-btn").addEventListener("click", async () => {
  showScreen("history-screen");
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  list.innerHTML = "";

  let entries;
  try {
    const res = await fetch("/api/history");
    entries = await res.json();
  } catch {
    empty.style.display = "block";
    empty.textContent = "Could not load history.";
    return;
  }

  if (!entries.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  entries.forEach(e => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <span class="history-name">${e.name}</span>
      <span class="history-cat">${e.category}</span>
      <span class="history-date">${e.completion_date || ""}</span>
    `;
    list.appendChild(item);
  });
});

document.getElementById("history-back").addEventListener("click", () => {
  showScreen("energy-screen");
});
