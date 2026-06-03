# 💧 AquaCheck — Water Quality Testing Simulator

An interactive web app for a **CSP IB interdisciplinary project** linking
**Chemistry** and **Biology** through a real-world issue: water pollution and
**UN Sustainable Development Goal 6 (Clean Water & Sanitation)**.

The user acts as an environmental scientist: choose a polluted water sample,
read its chemistry, see the biological consequences, and then run a
**remediation lab** to clean the water and watch the ecosystem recover.

---

## ▶️ How to run it

No installation, no internet, no build step.

1. Open the `water-quality-simulator` folder.
2. **Double-click `index.html`** — it opens in any web browser (Chrome, Edge, Safari, Firefox).

That's it. It also works perfectly on a phone or a projector for your presentation.

---

## 🎬 The 4-step flow

| Step | Screen | What happens |
|------|--------|--------------|
| 1 | **Pick a sample** | Choose a source: mountain spring (clean), agricultural runoff, industrial discharge, or urban stormwater. Each loads realistic starting chemistry. |
| 2 | **Chemical analysis** | Six sliders: pH, dissolved oxygen, nitrates, phosphates, heavy metals, turbidity. Adjust them to run "what-if" experiments. |
| 3 | **Biological impact** | The chemistry is turned into living consequences for fish, microbes/algae, plants, invertebrates and human safety — plus a 0–100 ecosystem health score. |
| 4 | **Remediation lab** | Apply treatments (liming, aeration, wetlands, carbon filters, sedimentation, buffer strips) and watch the score recover in real time. |

---

## 🔬 The science (great for your IB write-up)

### Chemistry side
- **pH** — acid/base chemistry; industrial effluent is acidic, neutralised by limestone (CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂).
- **Dissolved oxygen** — gas solubility; restored by aeration.
- **Nitrates & phosphates** — nutrient ions (NO₃⁻, PO₄³⁻) from fertilizer.
- **Heavy metals** — toxic ions removed by adsorption onto activated carbon.
- **Turbidity** — suspended solids and light penetration.

### Biology side
- **Dissolved oxygen → fish survival** (trout need > 7 mg/L).
- **Nitrates + phosphates → eutrophication** (algal blooms, cyanobacteria, dead zones).
- **Turbidity → photosynthesis** (cloudy water blocks light to aquatic plants).
- **Heavy metals & oxygen → invertebrates** as pollution bio-indicators.
- **Nitrates & metals → human drinking-water safety** (10 mg/L nitrate limit).

### Scientific-method angle
Treat each slider as a **variable**. Hold the others constant, change one, and
record how the health score and biological outcomes respond — that's a
controlled experiment your group can document with screenshots.

---

## 🧠 How the model works (transparent, editable)

Everything lives in **one file: `index.html`** (HTML + CSS + JavaScript, no
libraries). The logic is in plain functions you can tweak:

- `PARAMS` / `SOURCES` — the parameters and preset samples.
- `healthScore()` — weighted 0–100 ecosystem score (oxygen & metals weighted heaviest).
- `biologicalImpacts()` — the chemistry → biology rules.
- `REMEDS` — each treatment and the chemical change it applies.

Change a number, save, refresh the browser — instant update. Good for
explaining and defending your design to the examiners.

> ⚠️ The thresholds are **simplified, teaching-friendly approximations** based
> on common freshwater guidelines — for education, not real water certification.

---

## 💡 Presentation tips
- Open with the **industrial sample** (score crashes to "Critical") for impact.
- Then walk through the **remediation lab** live, applying treatments one by one.
- Compare against the **mountain spring** baseline to show the contrast.
- Tie it back to **SDG 6** and a **local** water source near your school to hit
  the international-mindedness / local-to-global criterion.
