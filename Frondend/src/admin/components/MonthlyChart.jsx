import { useState } from "react";

const short = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthDate = (key) => new Date(`${key}-01T00:00:00Z`);
const W = 640;
const H = 230;
const PAD = { top: 22, right: 8, bottom: 30, left: 34 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

// Plus petit pas « rond » donnant 4 graduations entières au-dessus du maximum.
function scaleStep(max) {
  for (let power = 1; ; power *= 10)
    for (const factor of [1, 2, 5])
      if (factor * power * 4 >= max) return factor * power;
}
// Barre arrondie en haut seulement : la base reste posée sur l’axe.
function barPath(x, y, width, height) {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export default function MonthlyChart({ months }) {
  const [active, setActive] = useState(null);
  const step = scaleStep(Math.max(1, ...months.map((item) => item.count)));
  const top = step * 4;
  const band = plotW / months.length;
  const barWidth = Math.min(26, band * 0.56);
  const y = (value) => PAD.top + plotH - (value / top) * plotH;
  const total = months.reduce((sum, item) => sum + item.count, 0);
  const current = months.length - 1;
  const hovered = active === null ? null : months[active];
  return (
    <div className="monthly-chart">
      <div className="monthly-chart-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Inscriptions des 12 derniers mois : ${total} au total, ${months[current].count} ce mois-ci.`}
          onMouseLeave={() => setActive(null)}
        >
          {[0, 1, 2, 3, 4].map((tick) => (
            <g key={tick} className={tick ? "chart-grid" : "chart-baseline"}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick * step)} y2={y(tick * step)} />
              <text x={PAD.left - 8} y={y(tick * step) + 4} textAnchor="end">
                {tick * step}
              </text>
            </g>
          ))}
          {months.map((item, index) => {
            const x = PAD.left + band * index + (band - barWidth) / 2;
            const height = y(0) - y(item.count);
            return (
              <g
                key={item.month}
                className={[
                  "chart-bar",
                  index === current ? "is-current" : "",
                  index === active ? "is-active" : "",
                ].join(" ")}
              >
                {item.count > 0 && (
                  <path d={barPath(x, y(item.count), barWidth, height)} />
                )}
                {index === current && item.count > 0 && (
                  <text className="chart-value" x={x + barWidth / 2} y={y(item.count) - 7} textAnchor="middle">
                    {item.count}
                  </text>
                )}
                <text className="chart-month" x={x + barWidth / 2} y={H - 9} textAnchor="middle">
                  {short.format(monthDate(item.month)).replace(".", "")}
                </text>
                {/* Zone de survol plus large que la barre, accessible au clavier. */}
                <rect
                  className="chart-hit"
                  x={PAD.left + band * index}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  tabIndex={0}
                  aria-label={`${long.format(monthDate(item.month))} : ${item.count} inscription${item.count > 1 ? "s" : ""}`}
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
              top: `${(y(hovered.count) / H) * 100}%`,
            }}
          >
            <span>{long.format(monthDate(hovered.month))}</span>
            <strong>
              {hovered.count} inscription{hovered.count > 1 ? "s" : ""}
            </strong>
          </div>
        )}
      </div>
      {total === 0 && (
        <p className="chart-empty">Aucune inscription sur les 12 derniers mois.</p>
      )}
      <table className="sr-only">
        <caption>Inscriptions par mois</caption>
        <tbody>
          {months.map((item) => (
            <tr key={item.month}>
              <th scope="row">{long.format(monthDate(item.month))}</th>
              <td>{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
