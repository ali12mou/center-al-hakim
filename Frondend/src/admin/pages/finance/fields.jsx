import { useEffect, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { adminApi } from "../../services/adminApi.js";
import { useLookup } from "../../hooks/useRemote.js";
import { PAYMENT_METHODS, money } from "../../lib/format.js";

export const accountLabel = (item) => `${item.name}${item.number ? ` · ${item.number}` : ""}`;
export const accountField = (key = "accountId", label = "Compte", extra = {}) => ({
  key,
  label,
  type: "lookup",
  lookup: "accounts",
  filter: (item) => item.active,
  optionLabel: (item) => `${accountLabel(item)} (${PAYMENT_METHODS[item.kind]})`,
  required: true,
  ...extra,
});

// Recherche d’un dossier de student (nom, téléphone, référence).
export function StudentAccountPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      adminApi(`/lookups/student-accounts?q=${encodeURIComponent(q)}`)
        .then((data) => live && setItems(data.items))
        .catch(() => live && setItems([]));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);
  if (value)
    return (
      <div className="picked-account">
        <div>
          <strong>{value.studentName}</strong>
          <small>
            {value.reference} · {value.courseTitle || "Sans formation"} · reste {money(value.balance ?? value.totalAmount - value.paidAmount)}
          </small>
        </div>
        <button type="button" className="panel-action" onClick={() => onChange(null)}>
          Changer
        </button>
      </div>
    );
  return (
    <div className="account-picker">
      <label className="admin-search">
        <Search size={17} />
        <input autoFocus value={q} placeholder="Nom du student, téléphone ou n° de dossier…" onChange={(event) => setQ(event.target.value)} />
      </label>
      <ul>
        {items.map((item) => (
          <li key={item._id}>
            <button type="button" onClick={() => onChange(item)}>
              <strong>{item.studentName}</strong>
              <small>
                {item.reference} · {item.courseTitle || "Sans formation"}
                {item.payer?.type === "organisation" && item.payer.name ? ` · payé par ${item.payer.name}` : ""}
              </small>
              <b>{money(item.balance)}</b>
            </button>
          </li>
        ))}
        {!items.length && <li className="dashboard-zero">Aucun dossier actif avec un solde ne correspond.</li>}
      </ul>
    </div>
  );
}

// Un règlement peut être réparti entre plusieurs moyens de paiement.
export function SplitsEditor({ value = [], onChange }) {
  const accounts = useLookup("accounts").filter((item) => item.active);
  const update = (index, patch) => onChange(value.map((split, i) => (i === index ? { ...split, ...patch } : split)));
  const total = value.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
  return (
    <div className="splits-editor">
      {value.map((split, index) => (
        <div className="split-row" key={index}>
          <select value={split.accountId} required onChange={(event) => update(index, { accountId: event.target.value })} aria-label="Compte qui reçoit">
            <option value="">— Moyen / compte —</option>
            {accounts.map((item) => (
              <option key={item._id} value={item._id}>
                {PAYMENT_METHODS[item.kind]} · {accountLabel(item)}
              </option>
            ))}
          </select>
          <input type="number" min={1} step={1} required placeholder="Montant" value={split.amount} onChange={(event) => update(index, { amount: event.target.value })} aria-label="Montant" />
          <input placeholder="Réf. de transaction" value={split.transactionRef} onChange={(event) => update(index, { transactionRef: event.target.value })} aria-label="Référence de transaction" />
          {value.length > 1 && (
            <button type="button" className="icon-button" aria-label="Retirer ce moyen" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      <div className="split-footer">
        {value.length < 6 && (
          <button type="button" className="panel-action" onClick={() => onChange([...value, { accountId: "", amount: "", transactionRef: "" }])}>
            <Plus size={14} /> Ajouter un moyen de paiement
          </button>
        )}
        <span>
          Total : <b>{money(total)}</b>
        </span>
      </div>
    </div>
  );
}
export const toSplits = (splits) =>
  splits.map((split) => ({ accountId: split.accountId, amount: Number(split.amount), transactionRef: split.transactionRef || "" }));
