import { Link } from "react-router-dom";
import { ArrowUpRight, Inbox, Lock } from "lucide-react";
import { STATUS } from "../lib/format.js";

export function PageHeading({ kicker, title, description, children }) {
  return (
    <div className="admin-page-heading">
      <div>
        {kicker && <span className="admin-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="admin-heading-actions">{children}</div>}
    </div>
  );
}

// Pastille d’état : libellé + couleur, jamais la couleur seule.
export function StatusPill({ status, label }) {
  const [text, tone] = STATUS[status] || [status || "—", "new"];
  return <span className={`admin-status status-${tone}`}>{label || text}</span>;
}

export function Stat({ icon: Icon, label, value, note, tone = "navy", to }) {
  const body = (
    <>
      <span className="stat-top">
        <span>{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon size={18} />
          </span>
        )}
      </span>
      <strong>{value}</strong>
      <span className="stat-note">
        {note}
        {to && <ArrowUpRight size={15} />}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={`admin-stat tone-${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`admin-stat tone-${tone}`}>{body}</div>
  );
}
export function StatGrid({ items, loading, className = "" }) {
  if (loading)
    return (
      <div className={`admin-stats ${className}`}>
        {[0, 1, 2, 3].map((index) => (
          <div className="admin-stat is-loading" key={index} aria-hidden="true" />
        ))}
      </div>
    );
  return (
    <div className={`admin-stats ${className}`}>
      {items.map((item) => (
        <Stat key={item.label} {...item} />
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="admin-section-tabs" role="tablist">
      {tabs.map(([id, label, count]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          className={value === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
          {count > 0 && <b className="tab-count">{count}</b>}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, subtitle, action, children, footer, className = "" }) {
  return (
    <section className={`dashboard-panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <small>{subtitle}</small>}
          </div>
          {action}
        </div>
      )}
      {children}
      {footer}
    </section>
  );
}

export function Empty({ title = "Aucun élément pour le moment.", text, icon: Icon = Inbox }) {
  return (
    <div className="admin-empty">
      <Icon size={33} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}

export function Alert({ error, success }) {
  if (error)
    return (
      <p role="alert" className="admin-error">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="admin-success">
        {success}
      </p>
    );
  return null;
}

export function Forbidden() {
  return (
    <div className="dashboard-panel">
      <Empty
        icon={Lock}
        title="Accès non autorisé"
        text="Votre compte n’a pas accès à cette page. Demandez l’autorisation à l’administrateur général."
      />
    </div>
  );
}

// Choix d’une période (du… au…) en dates « AAAA-MM-JJ » ou mois « AAAA-MM ».
export function PeriodPicker({ from, to, onChange, type = "date" }) {
  return (
    <div className="period-picker">
      <label>
        <span>Du</span>
        <input type={type} value={from} max={to} onChange={(event) => onChange({ from: event.target.value, to })} />
      </label>
      <label>
        <span>au</span>
        <input type={type} value={to} min={from} onChange={(event) => onChange({ from, to: event.target.value })} />
      </label>
    </div>
  );
}

// Tableau simple : colonnes { label, render, className, align }.
export function SimpleTable({ columns, rows, rowKey = (row) => row._id || row.id, empty, className = "" }) {
  if (!rows?.length) return empty || <p className="dashboard-zero">Aucune donnée pour cette période.</p>;
  return (
    <div className="admin-table-scroll">
      <table className={`admin-table ${className}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={column.align === "right" ? "num" : ""}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row) || index}>
              {columns.map((column) => (
                <td key={column.label} className={column.align === "right" ? "num" : column.className || ""}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PersonCell({ name, detail }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  return (
    <span className="person-name">
      <i>{initials}</i>
      <span>
        <strong>{name || "—"}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </span>
  );
}
