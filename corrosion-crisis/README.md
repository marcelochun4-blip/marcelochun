# 🌊 Corrosion Crisis: Save the Watershed

A browser-based environmental engineering simulation built for **IB Diploma Group 4**
(Chemistry / Biology / ESS) students. You play an environmental engineer protecting a
city's water supply over **20 simulated years** as acid rain, industrial pollution, and
mining runoff drive the watershed toward collapse.

It is a *management simulator*, not a quiz — every calculation (corrosion rates, acidity
factors, biodiversity loss) is shown on screen and explained with real chemistry.

## How to play

Just open `index.html` in any modern browser. No server or build step is required
(Chart.js loads from a CDN, so an internet connection is needed for the graphs).

```
corrosion-crisis/
├── index.html   # structure + dashboard, charts, education panel
├── styles.css   # responsive scientific dashboard styling
├── game.js      # all game logic, chemistry, charts, win/loss
└── README.md
```

## Objective

Keep all of the following true until **Year 20**:

| Variable            | Safe range        | Start    |
|---------------------|-------------------|----------|
| Water pH            | 6.0 – 8.0         | 7.0      |
| Infrastructure      | > 50%             | 100%     |
| Water Quality Index | (higher is safer) | 90       |
| Biodiversity        | > 60%             | 90       |
| Budget              | > $0              | $10,000  |

## The chemistry being modelled

- **Acidity factor** rises as pH falls (×1 at pH ≥ 7 up to ×16 at pH ≤ 2).
- **Corrosion** for each structure = `reactivity × acidityFactor`, using the reactivity
  series Mg(5) > Al(4) > Zn(3) > Fe(2) > Cu(1).
- Corrosion drives **infrastructure loss** and **metal-ion pollution** (water-quality loss).
- **Biodiversity** falls below pH 5 / pH 4 and below water quality 50 / 30, and slowly
  recovers in healthy conditions.

## Player actions (one per year)

| Action                     | Cost   | Effect                                  |
|----------------------------|--------|-----------------------------------------|
| Add Limestone              | $500   | pH +1 (CaCO₃ neutralises acid)          |
| Upgrade Water Treatment    | $1,500 | Water Quality +10                       |
| Replace Infrastructure     | $2,000 | Infrastructure +20                      |
| Install Pollution Controls | $1,000 | −50% impact of next pollution event     |
| Monitor Only               | $0     | No effect                               |

## Outcomes

- **Excellent** — Year 20 with biodiversity > 80 and infrastructure > 70.
- **Sustainable** — Year 20 with biodiversity > 60.
- **Failure** — infrastructure, biodiversity, or water quality reaches 0.

A final scientific report explains the outcome in IB-level terms.
