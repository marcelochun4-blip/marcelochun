/* ============================================================
   Corrosion Crisis: Save the Watershed
   An IB Group 4 environmental engineering simulation.
   Pure HTML/CSS/JS + Chart.js. No build step required.
   ============================================================ */

"use strict";

/* ---------------- Static data ---------------- */

// City metal structures and their position in the reactivity series.
const METALS = [
  { name: "Magnesium pipes",            symbol: "Mg", reactivity: 5,
    half: "Mg + 2H⁺ → Mg²⁺ + H₂",
    note: "Magnesium is very high in the reactivity series, so it oxidises rapidly even in mildly acidic water, releasing Mg²⁺ ions." },
  { name: "Aluminium tanks",            symbol: "Al", reactivity: 4,
    half: "2Al + 6H⁺ → 2Al³⁺ + 3H₂",
    note: "Aluminium's protective oxide layer dissolves under acidic conditions, exposing fresh metal and freeing toxic Al³⁺ ions." },
  { name: "Zinc-coated bridges",        symbol: "Zn", reactivity: 3,
    half: "Zn + 2H⁺ → Zn²⁺ + H₂",
    note: "The sacrificial zinc galvanising corrodes preferentially, protecting steel but adding Zn²⁺ to the water." },
  { name: "Iron water mains",           symbol: "Fe", reactivity: 2,
    half: "Fe + 2H⁺ → Fe²⁺ + H₂",
    note: "Iron reacts with hydrogen ions in acidic water, releasing Fe²⁺ ions into the water supply and accelerating infrastructure degradation." },
  { name: "Copper monitoring stations", symbol: "Cu", reactivity: 1,
    half: "Cu corrodes only slowly (Cu is below H in the series)",
    note: "Copper sits below hydrogen in the reactivity series, so it resists attack by dilute acids; corrosion is slow and Cu²⁺ release is minimal." }
];

// Random annual environmental events.
const EVENTS = [
  { id: "acidrain", type: "bad",  title: "Acid Rain", phChange: -1,
    isPollution: true,
    desc: "Sulfur and nitrogen oxides from fossil-fuel combustion formed H₂SO₄ and HNO₃ in the atmosphere, which fell as acid rain and lowered the watershed pH." },
  { id: "spill", type: "bad", title: "Industrial Spill", phChange: -1.5,
    isPollution: true,
    desc: "A factory discharged acidic effluent directly into the river. Strong acids dissociated fully, sharply increasing the H⁺ concentration." },
  { id: "mining", type: "bad", title: "Mining Runoff", phChange: -1,
    isPollution: true,
    desc: "Acid mine drainage — sulfide minerals oxidising to sulfuric acid — leached into the reservoir, lowering pH and adding dissolved metals." },
  { id: "heavyrain", type: "neutral", title: "Heavy Rainfall", phChange: 0,
    isPollution: false, flushPollutants: true,
    desc: "Intense rainfall increased flow and diluted the system, flushing some accumulated pollutants downstream. Water Quality improved slightly." },
  { id: "grant", type: "good", title: "Environmental Grant", phChange: 0,
    isPollution: false, budgetChange: 1000,
    desc: "A national watershed-protection grant was awarded, adding $1,000 to your remediation budget." }
];

// Player actions.
const ACTIONS = {
  limestone:  { cost: 500,  label: "Add Limestone" },
  treatment:  { cost: 1500, label: "Upgrade Water Treatment" },
  infra:      { cost: 2000, label: "Replace Infrastructure" },
  controls:   { cost: 1000, label: "Install Pollution Controls" },
  monitor:    { cost: 0,    label: "Monitor Only" }
};

const MAX_YEARS = 20;

/* ---------------- Game state ---------------- */

let state;

function freshState() {
  return {
    year: 0,
    ph: 7.0,
    infrastructure: 100,
    quality: 90,
    biodiversity: 90,
    budget: 10000,
    pollutionShield: false,    // set by "Install Pollution Controls"
    selectedAction: null,
    metalRotation: 0,          // which metal narrates the corrosion pop-up
    history: { year: [0], ph: [7.0], bio: [90], quality: [90], infra: [100] },
    over: false
  };
}

/* ---------------- Chemistry helpers ---------------- */

// Map pH to the acidity factor that scales corrosion.
function acidityFactor(ph) {
  if (ph >= 7) return 1;
  if (ph >= 6) return 2;   // pH 6
  if (ph >= 5) return 4;   // pH 5
  if (ph >= 4) return 8;   // pH 4
  if (ph >= 3) return 12;  // pH 3
  return 16;               // pH 2 and below
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------------- DOM references ---------------- */

const $ = (id) => document.getElementById(id);

/* ---------------- Charts ---------------- */

let charts = {};

function buildCharts() {
  // Destroy any existing charts (on restart).
  Object.values(charts).forEach((c) => c && c.destroy());
  charts = {};

  const mk = (canvasId, label, color, suggestedMin, suggestedMax) => {
    const ctx = $(canvasId).getContext("2d");
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: [...state.history.year],
        datasets: [{
          label,
          data: [],
          borderColor: color,
          backgroundColor: color + "33",
          fill: true,
          tension: 0.25,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e6f1ff" } } },
        scales: {
          x: { title: { display: true, text: "Year", color: "#9fb3c8" },
               ticks: { color: "#9fb3c8" }, grid: { color: "#244865" } },
          y: { suggestedMin, suggestedMax,
               ticks: { color: "#9fb3c8" }, grid: { color: "#244865" } }
        }
      }
    });
  };

  charts.ph = mk("phChart", "Water pH vs Year", "#38bdf8", 2, 8);
  charts.bio = mk("bioChart", "Biodiversity vs Year", "#34d399", 0, 100);
  charts.quality = mk("qualityChart", "Water Quality vs Year", "#fbbf24", 0, 100);
  charts.infra = mk("infraChart", "Infrastructure Health vs Year", "#f472b6", 0, 100);
  refreshCharts();
}

function refreshCharts() {
  const h = state.history;
  const apply = (chart, arr) => {
    chart.data.labels = [...h.year];
    chart.data.datasets[0].data = [...arr];
    chart.update();
  };
  apply(charts.ph, h.ph);
  apply(charts.bio, h.bio);
  apply(charts.quality, h.quality);
  apply(charts.infra, h.infra);
}

/* ---------------- Rendering ---------------- */

function meterState(value, warn, bad) {
  if (value <= bad) return "state-bad";
  if (value <= warn) return "state-warn";
  return "state-good";
}

function render() {
  $("year-display").textContent = state.year;

  // pH (safe 6–8). Bar maps pH 2..8 to 0..100%.
  $("ph-value").textContent = state.ph.toFixed(1);
  $("ph-fill").style.width = clamp(((state.ph - 2) / 6) * 100, 0, 100) + "%";
  setCardState("card-ph", state.ph >= 6 ? "state-good" : state.ph >= 5 ? "state-warn" : "state-bad");

  // Infrastructure (safe >50).
  $("infra-value").textContent = Math.round(state.infrastructure) + "%";
  $("infra-fill").style.width = state.infrastructure + "%";
  setCardState("card-infra", meterState(state.infrastructure, 50, 25));

  // Water quality.
  $("quality-value").textContent = Math.round(state.quality);
  $("quality-fill").style.width = state.quality + "%";
  setCardState("card-quality", meterState(state.quality, 50, 30));

  // Biodiversity (safe >60).
  $("bio-value").textContent = Math.round(state.biodiversity);
  $("bio-fill").style.width = state.biodiversity + "%";
  setCardState("card-bio", state.biodiversity > 60 ? "state-good" : state.biodiversity > 40 ? "state-warn" : "state-bad");
  renderFish();

  // Budget.
  $("budget-value").textContent = "$" + Math.round(state.budget).toLocaleString();
  setCardState("card-budget", state.budget > 0 ? "state-good" : "state-bad");

  // Disable actions the player cannot afford.
  document.querySelectorAll(".action-btn").forEach((btn) => {
    const a = ACTIONS[btn.dataset.action];
    btn.disabled = state.budget < a.cost;
    btn.classList.toggle("selected", state.selectedAction === btn.dataset.action);
  });
}

function setCardState(cardId, cls) {
  const el = $(cardId);
  el.classList.remove("state-good", "state-warn", "state-bad");
  el.classList.add(cls);
}

function renderFish() {
  const total = 10;
  const alive = Math.round((state.biodiversity / 100) * total);
  let s = "";
  for (let i = 0; i < total; i++) s += i < alive ? "🐟" : "💀";
  $("fish-row").textContent = s;
}

function renderMetals() {
  const grid = $("metals-grid");
  grid.innerHTML = "";
  METALS.forEach((m) => {
    const div = document.createElement("div");
    div.className = "metal-card";
    div.innerHTML = `
      <div class="m-symbol">${m.symbol}</div>
      <div class="m-name">${m.name}</div>
      <div class="m-react">${m.reactivity}</div>
      <div class="m-react-label">reactivity</div>`;
    grid.appendChild(div);
  });
}

/* ---------------- Science pop-ups ---------------- */

function logScience(title, formula, body, meta) {
  const log = $("science-log");
  const item = document.createElement("div");
  item.className = "science-item";
  item.innerHTML = `
    <strong>${title}</strong>
    ${formula ? `<span class="formula">${formula}</span>` : ""}
    <span>${body}</span>
    ${meta ? `<span class="meta">${meta}</span>` : ""}`;
  log.prepend(item);
}

/* ---------------- Event handling ---------------- */

let currentEvent = null;

function rollEvent() {
  currentEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  applyEvent(currentEvent);
  showEventCard(currentEvent);
}

function applyEvent(ev) {
  let phChange = ev.phChange;

  // Pollution controls halve the next pollution event's pH impact.
  let shieldNote = "";
  if (ev.isPollution && state.pollutionShield) {
    phChange = phChange / 2;
    state.pollutionShield = false;
    shieldNote = " Pollution controls absorbed half of the impact.";
  }

  if (phChange !== 0) {
    state.ph = clamp(state.ph + phChange, 2.0, 8.0);
  }
  if (ev.budgetChange) state.budget += ev.budgetChange;
  if (ev.flushPollutants) state.quality = clamp(state.quality + 8, 0, 100);

  ev._appliedPhChange = phChange;
  ev._shieldNote = shieldNote;
}

function showEventCard(ev) {
  const card = $("event-card");
  card.className = "event-card " + (ev.type === "bad" ? "bad" : ev.type === "good" ? "good" : "");
  let effect = "";
  if (ev._appliedPhChange) effect += `pH ${ev._appliedPhChange > 0 ? "+" : ""}${ev._appliedPhChange}. `;
  if (ev.budgetChange) effect += `Budget +$${ev.budgetChange}. `;
  if (ev.flushPollutants) effect += `Water Quality +8. `;
  if (!effect) effect = "No direct change to pH.";
  card.innerHTML = `
    <h3>${ev.title}</h3>
    <p>${ev.desc}${ev._shieldNote || ""}</p>
    <p><strong>Effect:</strong> ${effect}</p>`;
}

/* ---------------- Player action ---------------- */

function selectAction(key) {
  state.selectedAction = key;
  render();
  $("status-line").textContent =
    `Selected: ${ACTIONS[key].label} (cost $${ACTIONS[key].cost}). Press “Advance to Next Year”.`;
}

function applyAction(key) {
  const a = ACTIONS[key];
  state.budget -= a.cost;
  switch (key) {
    case "limestone":
      state.ph = clamp(state.ph + 1, 2.0, 8.0);
      logScience("Action: Add Limestone", "CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂",
        "Calcium carbonate (limestone) neutralised acidic water by consuming hydrogen ions, raising the pH by 1.0 and restoring buffering capacity.",
        "Cost $500");
      break;
    case "treatment":
      state.quality = clamp(state.quality + 10, 0, 100);
      logScience("Action: Upgrade Water Treatment", null,
        "Improved filtration and aeration removed dissolved metal ions and particulates, raising the Water Quality Index by 10.",
        "Cost $1,500");
      break;
    case "infra":
      state.infrastructure = clamp(state.infrastructure + 20, 0, 100);
      logScience("Action: Replace Infrastructure", null,
        "Corroded pipes and fittings were replaced with new material, restoring 20% of infrastructure health.",
        "Cost $2,000");
      break;
    case "controls":
      state.pollutionShield = true;
      logScience("Action: Install Pollution Controls", null,
        "Scrubbers and containment systems were installed. The next pollution event's acidifying impact will be reduced by 50%.",
        "Cost $1,000");
      break;
    case "monitor":
      logScience("Action: Monitor Only", null,
        "You collected baseline data this year without intervening. No parameters were changed.",
        "Cost $0");
      break;
  }
}

/* ---------------- Corrosion + biodiversity ---------------- */

function processCorrosion() {
  const factor = acidityFactor(state.ph);

  // Total corrosion across all structures this year.
  let totalCorrosion = 0;
  METALS.forEach((m) => { totalCorrosion += m.reactivity * factor; });

  // Convert corrosion into infrastructure loss and pollution (quality loss).
  // Scale chosen so neutral water is gentle but acidic water bites hard.
  const infraLoss = totalCorrosion * 0.12;
  const pollutionLoss = totalCorrosion * 0.10;

  state.infrastructure = clamp(state.infrastructure - infraLoss, 0, 100);
  state.quality = clamp(state.quality - pollutionLoss, 0, 100);

  // Rotate the narrating metal so explanations cycle between metals.
  const m = METALS[state.metalRotation % METALS.length];
  state.metalRotation++;
  const metalCorr = (m.reactivity * factor).toFixed(1);
  logScience(
    `Corrosion — ${m.name}`,
    m.half,
    `${m.note} At pH ${state.ph.toFixed(1)} the acidity factor is ×${factor}, so this structure's corrosion rate is ${m.reactivity} × ${factor} = ${metalCorr}.`,
    `Year ${state.year}: infrastructure −${infraLoss.toFixed(1)}%, water quality −${pollutionLoss.toFixed(1)} from metal-ion pollution.`
  );
}

function processBiodiversity() {
  let loss = 0;
  const reasons = [];
  if (state.ph < 5) { loss += 10; reasons.push("pH below 5 (−10)"); }
  if (state.ph < 4) { loss += 20; reasons.push("pH below 4 (−20)"); }
  if (state.quality < 50) { loss += 10; reasons.push("water quality below 50 (−10)"); }
  if (state.quality < 30) { loss += 20; reasons.push("water quality below 30 (−20)"); }

  // Gentle recovery when conditions are healthy.
  if (loss === 0 && state.ph >= 6 && state.quality >= 60) {
    state.biodiversity = clamp(state.biodiversity + 3, 0, 100);
    logScience("Biodiversity — Recovery", null,
      "Circum-neutral pH and good water quality allowed sensitive species to recolonise. Biodiversity rose by 3.",
      `Year ${state.year}`);
  } else if (loss > 0) {
    state.biodiversity = clamp(state.biodiversity - loss, 0, 100);
    logScience("Biodiversity — Stress", null,
      `Abiotic stressors reduced biodiversity by ${loss}: ${reasons.join(", ")}.`,
      `Year ${state.year}`);
  }
}

/* ---------------- Turn loop ---------------- */

function advanceYear() {
  if (state.over) return;

  // A player must pick an action each year (Monitor Only is the free default).
  if (!state.selectedAction) {
    $("status-line").textContent = "⚠️ Choose an action first (use “Monitor Only” to do nothing).";
    return;
  }

  state.year++;

  // 1) Random environmental event at the start of the year.
  rollEvent();

  // 2) Apply the player's chosen action.
  applyAction(state.selectedAction);

  // 3) Corrosion chemistry.
  processCorrosion();

  // 4) Biodiversity response.
  processBiodiversity();

  // 5) Record history + redraw.
  recordHistory();
  state.selectedAction = null;
  render();
  refreshCharts();

  // 6) Check for end conditions.
  if (checkFailure()) return;
  if (state.year >= MAX_YEARS) { endGame(); return; }

  $("status-line").textContent = `Year ${state.year} complete. Choose next year's action.`;
}

function recordHistory() {
  const h = state.history;
  h.year.push(state.year);
  h.ph.push(Number(state.ph.toFixed(2)));
  h.bio.push(Math.round(state.biodiversity));
  h.quality.push(Math.round(state.quality));
  h.infra.push(Math.round(state.infrastructure));
}

/* ---------------- Win / loss ---------------- */

function checkFailure() {
  let reason = null;
  if (state.infrastructure <= 0) reason = "Infrastructure health collapsed to 0% — the water network failed catastrophically.";
  else if (state.biodiversity <= 0) reason = "Biodiversity reached 0 — the aquatic ecosystem collapsed completely.";
  else if (state.quality <= 0) reason = "The Water Quality Index hit 0 — the supply became unsafe for the city.";
  if (reason) { endGame("fail", reason); return true; }
  return false;
}

function endGame(forcedResult, forcedReason) {
  state.over = true;
  $("game-screen").classList.add("hidden");
  $("end-screen").classList.remove("hidden");

  let verdict, cls, summary;

  if (forcedResult === "fail") {
    verdict = "❌ Mission Failed";
    cls = "verdict-fail";
    summary = forcedReason;
  } else {
    // Reached Year 20 — grade the outcome.
    const bio = state.biodiversity, infra = state.infrastructure;
    if (bio > 80 && infra > 70) {
      verdict = "🏆 Excellent — Watershed Thriving";
      cls = "verdict-excellent";
      summary = "You reached Year 20 with biodiversity above 80% and infrastructure above 70%. The watershed is healthy and resilient.";
    } else if (bio > 60) {
      verdict = "✅ Sustainable — Watershed Stable";
      cls = "verdict-sustainable";
      summary = "You reached Year 20 with biodiversity above 60%. The watershed survived and remains viable, though there is room to improve.";
    } else {
      verdict = "❌ Mission Failed — Ecosystem Degraded";
      cls = "verdict-fail";
      summary = "You reached Year 20, but biodiversity fell to or below 60%. The ecosystem is too degraded to be considered sustainable.";
    }
  }

  $("report-title").textContent = "Final Scientific Report";
  $("report-body").innerHTML = `
    <div class="report-verdict ${cls}">${verdict}</div>
    <p>${summary}</p>
    <h3>Final Watershed Parameters (Year ${state.year})</h3>
    <ul class="report-stats">
      <li>💧 Water pH: <strong>${state.ph.toFixed(1)}</strong> (safe 6.0–8.0)</li>
      <li>🏗️ Infrastructure: <strong>${Math.round(state.infrastructure)}%</strong> (target &gt;50%)</li>
      <li>🧪 Water Quality Index: <strong>${Math.round(state.quality)}</strong></li>
      <li>🐟 Biodiversity: <strong>${Math.round(state.biodiversity)}</strong> (target &gt;60%)</li>
      <li>💰 Remaining budget: <strong>$${Math.round(state.budget).toLocaleString()}</strong></li>
    </ul>
    <h3>The Science of Your Outcome</h3>
    <p>${scienceNarrative()}</p>`;
}

function scienceNarrative() {
  const parts = [];
  if (state.ph < 6) {
    parts.push(`Persistent acidity (final pH ${state.ph.toFixed(1)}) raised the acidity factor to ×${acidityFactor(state.ph)}, accelerating corrosion of reactive metals such as magnesium and aluminium and flooding the water with toxic metal ions (Mg²⁺, Al³⁺, Fe²⁺).`);
  } else {
    parts.push(`You maintained a near-neutral pH (final ${state.ph.toFixed(1)}), keeping the acidity factor low so that corrosion of the city's metals — ranked by the reactivity series Mg > Al > Zn > Fe > Cu — stayed manageable.`);
  }
  if (state.biodiversity > 60) {
    parts.push("Because pH and water quality remained within tolerable bounds, acid- and metal-sensitive species survived and the aquatic food web stayed intact.");
  } else {
    parts.push("Sustained acidification and metal-ion pollution acted as abiotic stressors: sensitive organisms died off first, the food web simplified, and biodiversity fell below the sustainable threshold.");
  }
  parts.push("This models the real chemistry of watershed acidification: buffering with carbonate (limestone), controlling pollution at source, and maintaining infrastructure are the key levers an environmental engineer controls.");
  return parts.join(" ");
}

/* ---------------- Wiring ---------------- */

function startGame() {
  state = freshState();
  $("start-screen").classList.add("hidden");
  $("end-screen").classList.add("hidden");
  $("game-screen").classList.remove("hidden");
  $("science-log").innerHTML = "";
  $("event-card").className = "event-card";
  $("event-card").innerHTML = `<p class="event-hint">Choose an action, then press “Advance to Next Year” to begin Year 1.</p>`;
  $("status-line").textContent = "";
  renderMetals();
  render();
  buildCharts();
}

document.addEventListener("DOMContentLoaded", () => {
  $("start-btn").addEventListener("click", startGame);
  $("restart-btn").addEventListener("click", startGame);
  $("advance-btn").addEventListener("click", advanceYear);

  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectAction(btn.dataset.action));
  });

  $("edu-toggle").addEventListener("click", () => {
    const c = $("edu-content");
    c.classList.toggle("hidden");
    $("edu-arrow").textContent = c.classList.contains("hidden") ? "▸" : "▾";
  });
});
