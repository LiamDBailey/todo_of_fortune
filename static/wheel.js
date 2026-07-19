// Palette for wheel sectors
const COLORS = [
  "#e94560", "#0f3460", "#533483", "#e8871e",
  "#1a936f", "#3a7ca5", "#c1666b", "#48a999",
  "#f4a261", "#264653",
];

const canvas = document.getElementById("wheel-canvas");
const ctx = canvas.getContext("2d");

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
  const total = tasks.reduce((s, t) => s + t.weight, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let startAngle = rotation;
  tasks.forEach((task, i) => {
    const slice = (task.weight / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;

    // Sector fill
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

    // Wrap long names
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

// ── Compute landing rotation for selected task ────────────────────────────────
// The pointer sits at the top (−π/2). We want the selected sector centred there.
function computeTargetRotation(tasks, selectedName, currentRotation) {
  const total = tasks.reduce((s, t) => s + t.weight, 0);
  let sectorStart = 0;
  for (const task of tasks) {
    const slice = (task.weight / total) * 2 * Math.PI;
    if (task.name === selectedName) {
      const sectorMid = sectorStart + slice / 2;
      // angle needed to bring sectorMid to top (−π/2)
      const target = -Math.PI / 2 - sectorMid;
      // normalise so we always spin at least 5 full rotations forward
      const minSpins = 5 * 2 * Math.PI;
      let delta = ((target - currentRotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (delta < Math.PI / 4) delta += 2 * Math.PI; // avoid near-zero spin
      return currentRotation + minSpins + delta;
    }
    sectorStart += slice;
  }
  return currentRotation + 5 * 2 * Math.PI;
}

// ── Animation ─────────────────────────────────────────────────────────────────
let currentRotation = 0;

function animateSpin(tasks, targetRotation, onDone) {
  const startRotation = currentRotation;
  const totalDelta = targetRotation - startRotation;
  const duration = 4000; // ms
  let startTime = null;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);
    currentRotation = startRotation + totalDelta * easeOut(progress);
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

  showScreen("wheel-screen");
  document.getElementById("spinning-label").textContent = "Spinning…";

  let data;
  try {
    const res = await fetch("/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ energy }),
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

  // Draw initial wheel before spinning
  drawWheel(tasks, currentRotation);

  const targetRotation = computeTargetRotation(tasks, selected, currentRotation);

  animateSpin(tasks, targetRotation, () => {
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
