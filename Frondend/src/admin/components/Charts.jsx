import { useState } from "react";
import { compact } from "../lib/format.js";

const W = 640;
const H = 230;
const PAD = { top: 22, right: 8, bottom: 30, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

// Pas « rond » donnant 4 graduations au-dessus du maximum.
function scaleStep(max) {
  for (let power = 1; ; power *= 10)
    for (const factor of [1, 2, 2.5, 5])
      if (factor * power * 4 >= max) return factor * power;
}
// Barre arrondie en haut seulement : la base reste posée sur l’axe.
function barPath(x, y, width, height) {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}
function Axis({ step, y }) {
  return [0, 1, 2, 3, 4].map((tick) => (
    <g key={tick} className={tick ? "chart-grid" : "chart-baseline"}>
      <line x1={PAD.left} x2={W - PAD.right} y1={y(tick * step)} y2={y(tick * step)} />
      <text x={PAD.left - 8} y={y(tick * step) + 4} textAnchor="end">
        {compact(tick * step)}
      </text>
    </g>
  ));
}

// Colonnes d’une seule série (une couleur, pas de légende : le titre la nomme).
export function ColumnChart({ items, format = String, label, highlightLast = true }) {
  const [active, setActive] = useState(null);
  const step = scaleStep(Math.max(1, ...items.map((item) => item.value)));
  const y = (value) => PAD.top + plotH - (value / (step * 4)) * plotH;
  const band = plotW / Math.max(1, items.length);
  const barWidth = Math.min(24, band * 0.56);
  const last = items.length - 1;
  const hovered = active === null ? null : items[active];
  return (
    <div className="monthly-chart">
      <div className="monthly-chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setActive(null)}>
          <Axis step={step} y={y} />
          {items.map((item, index) => {
            const x = PAD.left + band * index + (band - barWidth) / 2;
            return (
              <g
                key={item.key}
                className={["chart-bar", highlightLast && index === last ? "is-current" : "", index === active ? "is-active" : ""].join(" ")}
              >
                {item.value > 0 && <path d={barPath(x, y(item.value), barWidth, y(0) - y(item.value))} />}
                <text className="chart-month" x={x + barWidth / 2} y={H - 9} textAnchor="middle">
                  {item.label}
                </text>
                <rect
                  className="chart-hit"
                  x={PAD.left + band * index}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  tabIndex={0}
                  aria-label={`${item.title || item.label} : ${format(item.value)}`}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: `${((PAD.left + band * active + band / 2) / W) * 100}%`,
              top: `${(y(hovered.value) / H) * 100}%`,
            }}
          >
            <span>{hovered.title || hovered.label}</span>
            <strong>{format(hovered.value)}</strong>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <th scope="row">{item.title || item.label}</th>
              <td>{format(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Entrées et sorties par mois : deux colonnes accolées (2 px d’écart), une légende.
const SERIES = [
  ["inflow", "Entrées"],
  ["outflow", "Sorties"],
];
export function FlowChart({ items, format = String, label }) {
  const [active, setActive] = useState(null);
  const step = scaleStep(Math.max(1, ...items.flatMap((item) => [item.inflow, item.outflow])));
  const y = (value) => PAD.top + plotH - (value / (step * 4)) * plotH;
  const band = plotW / Math.max(1, items.length);
  const barWidth = Math.min(20, (band * 0.7 - 2) / 2);
  const hovered = active === null ? null : items[active];
  return (
    <div className="monthly-chart flow-chart">
      <ul className="chart-legend">
        {SERIES.map(([key, name]) => (
          <li key={key}>
            <i className={`legend-${key}`} />
            {name}
          </li>
        ))}
      </ul>
      <div className="monthly-chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setActive(null)}>
          <Axis step={step} y={y} />
          {items.map((item, index) => {
            const start = PAD.left + band * index + (band - (barWidth * 2 + 2)) / 2;
            return (
              <g key={item.key} className={index === active ? "is-active" : ""}>
                {SERIES.map(([key], offset) =>
                  item[key] > 0 ? (
                    <path
                      key={key}
                      className={`flow-${key}`}
                      d={barPath(start + offset * (barWidth + 2), y(item[key]), barWidth, y(0) - y(item[key]))}
                    />
                  ) : null,
                )}
                <text className="chart-month" x={start + barWidth + 1} y={H - 9} textAnchor="middle">
                  {item.label}
                </text>
                <rect
                  className="chart-hit"
                  x={PAD.left + band * index}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  tabIndex={0}
                  aria-label={`${item.title || item.label} : entrées ${format(item.inflow)}, sorties ${format(item.outflow)}`}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: `${((PAD.left + band * active + band / 2) / W) * 100}%`,
              top: `${(y(Math.max(hovered.inflow, hovered.outflow)) / H) * 100}%`,
            }}
          >
            <span>{hovered.title || hovered.label}</span>
            <strong>Entrées : {format(hovered.inflow)}</strong>
            <strong>Sorties : {format(hovered.outflow)}</strong>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Mois</th>
            <th>Entrées</th>
            <th>Sorties</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <th scope="row">{item.title || item.label}</th>
              <td>{format(item.inflow)}</td>
              <td>{format(item.outflow)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Barres horizontales d’une seule série, valeur en bout de ligne.
export function HBars({ items, format = String, empty = "Aucune donnée pour cette période." }) {
  if (!items.length) return <p className="dashboard-zero">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="course-bars">
      {items.map((item) => (
        <div key={item.key}>
          <span>
            {item.label}
            <b>{format(item.value)}</b>
          </span>
          <div>
            <i style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
