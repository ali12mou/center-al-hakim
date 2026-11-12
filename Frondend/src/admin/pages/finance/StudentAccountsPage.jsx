import { useEffect, useState } from "react";
import { Ban, FileText, FolderOpen, Plus, Printer, Search, Trash2 } from "lucide-react";
import Dialog from "../../../components/Dialog.jsx";
import ListPage from "../../components/ListPage.jsx";
import PrintDocument from "../../components/PrintDocument.jsx";
import { Alert, PersonCell, SimpleTable, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useLookup, useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { PAYMENT_METHODS, PLANS, dayLabel, money, today } from "../../lib/format.js";
import { dateTimeLabel } from "../../config/sections.js";

const PAY_STATUS = { unpaid: "Non payé", partial: "En cours", overdue: "En retard", paid: "Soldé", cancelled: "Annulé" };

function RegistrationImport({ setValue }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (q.length < 2) return setItems([]);
    const timer = setTimeout(() => {
      adminApi(`/lookups/registrations?q=${encodeURIComponent(q)}`)
        .then((data) => setItems(data.items))
        .catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  return (
    <div className="account-picker compact">
      <label className="admin-search">
        <Search size={16} />
        <input value={q} placeholder="Rechercher un inscrit du site (nom, téléphone)…" onChange={(event) => setQ(event.target.value)} />
      </label>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                onClick={() => {
                  setValue("registrationId", item._id);
                  setValue("studentName", item.name);
                  setValue("phone", item.phone);
                  setValue("email", item.email);
                  if (item.courseId) setValue("courseId", item.courseId);
                  setItems([]);
                  setQ(item.name);
                }}
              >
                <strong>{item.name}</strong>
                <small>{item.reference} · {item.phone} · {item.courseId || "formation non précisée"}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InstallmentsEditor({ value = [], onChange }) {
  const update = (index, patch) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="splits-editor">
      {value.map((row, index) => (
        <div className="split-row" key={index}>
          <input type="date" required value={row.dueDate} onChange={(event) => update(index, { dueDate: event.target.value })} aria-label="Date d’échéance" />
          <input type="number" min={1} step={1} required placeholder="Montant" value={row.amount} onChange={(event) => update(index, { amount: event.target.value })} aria-label="Montant" />
          <input placeholder={`Versement ${index + 1}`} value={row.label} onChange={(event) => update(index, { label: event.target.value })} aria-label="Nom du versement" />
          <button type="button" className="icon-button" aria-label="Retirer l’échéance" onClick={() => onChange(value.filter((_, i) => i !== index))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="split-footer">
        <button type="button" className="panel-action" onClick={() => onChange([...value, { dueDate: today(), amount: "", label: "" }])}>
          <Plus size={14} /> Ajouter une échéance
        </button>
        <span>
          Total des échéances : <b>{money(value.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</b>
        </span>
      </div>
    </div>
  );
}

// Aperçu du montant dû, calculé comme le Backend (remise du catalogue + remise accordée).
function TotalPreview({ values }) {
  const discounts = useLookup("discounts");
  const discount = discounts.find((item) => item._id === values.discountId);
  const base = Number(values.baseAmount) || 0;
  const fee = Number(values.registrationFee) || 0;
  const catalogue = discount ? Math.min(base, Math.round(discount.kind === "percent" ? (base * discount.value) / 100 : discount.value)) : 0;
  const reduction = Math.min(base + fee, catalogue + (Number(values.manualDiscount) || 0));
  const total = base + fee - reduction;
  const count = values.plan === "full" ? 1 : values.plan === "custom" ? values.installments?.length || 0 : Number(values.count) || 1;
  return (
    <div className="total-preview admin-full">
      <span>Formation {money(base)}</span>
      {fee > 0 && <span>+ inscription {money(fee)}</span>}
      {reduction > 0 && <span>− remises {money(reduction)}</span>}
      <strong>Total dû : {money(total)}</strong>
      {values.plan !== "custom" && count > 0 && <small>{count} échéance(s) d’environ {money(Math.floor(total / count))}</small>}
    </div>
  );
}

const fields = (record) => [
  ...(record ? [] : [{ key: "registrationId", label: "Importer un inscrit (facultatif)", type: "custom", render: ({ setValue }) => <RegistrationImport setValue={setValue} /> }]),
  { type: "heading", label: "Student" },
  { key: "studentName", label: "Nom du student", required: true },
  { key: "phone", label: "Téléphone", type: "tel" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "payer.type", label: "Payé par", type: "select", options: [["student", "Le student lui-même"], ["organisation", "Un organisme (entreprise, institution…)"]] },
  { key: "payer.name", label: "Nom de l’organisme", show: (values) => values["payer.type"] === "organisation" },
  { key: "payer.contact", label: "Contact de l’organisme", show: (values) => values["payer.type"] === "organisation" },
  { type: "heading", label: "Formation et montant" },
  {
    key: "feeId",
    label: "Tarif de la formation",
    type: "lookup",
    lookup: "fees",
    placeholder: "— Montant libre —",
    optionLabel: (item) => `${item.label} · ${money(item.amount)}`,
    onPick: (item, setValue) => {
      if (!item) return;
      setValue("baseAmount", item.amount);
      setValue("registrationFee", item.registrationFee);
      setValue("courseId", item.courseId);
      setValue("count", item.durationMonths);
    },
  },
  { key: "courseId", label: "Formation", type: "lookup", lookup: "courses", valueKey: "id", placeholder: "— Non précisée —" },
  { key: "baseAmount", label: "Montant de la formation", type: "money", required: true },
  { key: "registrationFee", label: "Frais d’inscription", type: "money" },
  { key: "discountId", label: "Remise du catalogue", type: "lookup", lookup: "discounts", placeholder: "— Aucune —", optionLabel: (item) => `${item.name} (${item.kind === "percent" ? `${item.value} %` : money(item.value)})` },
  { key: "manualDiscount", label: "Remise accordée (montant)", type: "money" },
  { key: "discountReason", label: "Motif de la remise", show: (values) => Number(values.manualDiscount) > 0 },
  { type: "heading", label: "Modalités de paiement" },
  { key: "plan", label: "Modalité", type: "select", options: Object.entries(PLANS) },
  { key: "count", label: "Nombre de mensualités", type: "number", min: 1, maxValue: 60, show: (values) => values.plan === "monthly" },
  { key: "count", label: "Nombre de versements", type: "select", options: [["3", "3 mois"], ["4", "4 mois"], ["5", "5 mois"]], show: (values) => values.plan === "installments", virtual: true },
  { key: "startDate", label: "Première échéance", type: "date", required: true, default: today, show: (values) => values.plan !== "custom" },
  {
    key: "installments",
    label: "Échéances (dates et montants libres)",
    type: "custom",
    default: [],
    show: (values) => values.plan === "custom",
    render: ({ value, set }) => <InstallmentsEditor value={value} onChange={set} />,
  },
  ...(record ? [{ key: "reason", label: "Motif de la modification", hint: "Conservé dans l’historique du dossier.", wide: true }] : []),
  { key: "notes", label: "Notes", type: "textarea" },
];

function AccountDialog({ id, onClose }) {
  const admin = useAdmin();
  const account = useRemote(`/finance/student-accounts/${id}`);
  const statement = useRemote(`/finance/student-accounts/${id}/statement`);
  const [printing, setPrinting] = useState(null);
  const item = account.data?.item;
  async function print(kind, path) {
    setPrinting({ kind, item: (await adminApi(path)).item });
  }
  return (
    <Dialog title={item ? `Dossier ${item.reference}` : "Dossier"} onClose={onClose} className="admin-details admin-editor-wide">
      <Alert error={account.error || statement.error} />
      {item && (
        <>
          <dl className="mini-facts">
            <div><dt>Student</dt><dd>{item.studentName}</dd></div>
            <div><dt>Formation</dt><dd>{item.courseTitle || "—"}</dd></div>
            <div><dt>Total dû</dt><dd>{money(item.totalAmount)}</dd></div>
            <div><dt>Payé</dt><dd>{money(item.paidAmount)}</dd></div>
            <div><dt>Reste</dt><dd>{money(item.balance)}</dd></div>
            <div><dt>Statut</dt><dd><StatusPill status={item.paymentStatus} label={PAY_STATUS[item.paymentStatus]} /></dd></div>
          </dl>
          {item.discountAmount > 0 && <p className="cell-note">Remise : {money(item.discountAmount)} ({item.discountLabel})</p>}
          <section className="dossier-section">
            <h3>Échéancier · {PLANS[item.plan]}</h3>
            <SimpleTable
              rows={item.schedule}
              columns={[
                { label: "Échéance", render: (row) => row.label },
                { label: "Date", render: (row) => dayLabel(row.dueDate) },
                { label: "Montant", align: "right", render: (row) => money(row.amount) },
                { label: "Payé", align: "right", render: (row) => money(row.paid) },
                { label: "Statut", render: (row) => <StatusPill status={row.status} /> },
              ]}
            />
            <h3>Paiements</h3>
            <SimpleTable
              rows={statement.data?.payments}
              empty={<p className="dashboard-zero">Aucun paiement.</p>}
              columns={[
                { label: "Reçu", render: (row) => row.receiptNumber },
                { label: "Date", render: (row) => dayLabel(row.date) },
                { label: "Moyens", render: (row) => row.splits.map((split) => PAYMENT_METHODS[split.method]).join(" + ") },
                { label: "Montant", align: "right", render: (row) => money(row.amount) },
                { label: "Statut", render: (row) => <StatusPill status={row.status} /> },
                {
                  label: "",
                  render: (row) =>
                    admin.can("finance.payments") && (
                      <button className="panel-action" onClick={() => print("receipt", `/finance/payments/${row._id}`)}>
                        <Printer size={14} /> Reçu
                      </button>
                    ),
                },
              ]}
            />
            <h3>Factures</h3>
            <SimpleTable
              rows={statement.data?.invoices}
              empty={<p className="dashboard-zero">Aucune facture.</p>}
              columns={[
                { label: "Facture", render: (row) => row.number },
                { label: "Émise le", render: (row) => dayLabel(row.issueDate) },
                { label: "Total", align: "right", render: (row) => money(row.total) },
                { label: "Statut", render: (row) => <StatusPill status={row.paymentStatus} /> },
                {
                  label: "",
                  render: (row) =>
                    admin.can("finance.invoices") && (
                      <button className="panel-action" onClick={() => print("invoice", `/finance/invoices/${row._id}`)}>
                        <Printer size={14} /> Facture
                      </button>
                    ),
                },
              ]}
            />
            <h3>Historique</h3>
            <ul className="history-list">
              {[...item.history].reverse().map((entry, index) => (
                <li key={index}>
                  <strong>{entry.action}</strong>
                  <small>{dateTimeLabel(entry.at)} · {entry.by}</small>
                  {entry.detail && <p>{entry.detail}</p>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {printing && <PrintDocument kind={printing.kind} item={printing.item} onClose={() => setPrinting(null)} />}
    </Dialog>
  );
}

export default function StudentAccountsPage() {
  const admin = useAdmin();
  const [open, setOpen] = useState(null);
  return (
    <>
      <ListPage
        kicker="FINANCES · PAIEMENTS DES STUDENTS"
        title="Dossiers et échéanciers"
        description="Un dossier par student et par formation : montant, remises, modalité (intégral, mensuel, 3 à 5 mois ou personnalisé) et solde. Chaque modification de l’échéancier est conservée dans l’historique."
        endpoint="/finance/student-accounts"
        section="finance.schedules"
        search="Student, téléphone, n° de dossier, organisme…"
        exportName="dossiers-eleves"
        createLabel="Nouveau dossier"
        filters={[
          { key: "status", label: "Statut", default: "active", options: [["active", "Dossiers en cours"], ["completed", "Dossiers soldés"], ["cancelled", "Dossiers annulés"], ["", "Tous les dossiers"]] },
          { key: "plan", label: "Modalité", options: [["", "Toutes les modalités"], ...Object.entries(PLANS)] },
        ]}
        editable={(item) => item.status !== "cancelled"}
        deletable={(item) => !item.paidAmount}
        deleteConfirm={(item) => `Supprimer le dossier ${item.reference} ? Possible seulement sans paiement ni facture.`}
        actions={(item, ctx) => [
          { icon: FolderOpen, label: "Voir le dossier", onClick: () => setOpen(item._id) },
          admin.can("finance.invoices", "create") &&
            item.status !== "cancelled" && {
              icon: FileText,
              label: "Établir la facture",
              onClick: () =>
                ctx.run(
                  () => adminApi("/finance/invoices", { method: "POST", body: { studentAccountId: item._id, issueDate: today() } }),
                  "Facture créée : retrouvez-la dans « Factures et reçus ».",
                ),
            },
          admin.can("finance.schedules", "update") &&
            item.status === "active" && {
              icon: Ban,
              label: "Annuler le dossier",
              onClick: () => {
                const reason = window.prompt(`Motif de l’annulation du dossier ${item.reference} :`);
                if (reason)
                  ctx.run(
                    () => adminApi(`/finance/student-accounts/${item._id}`, { method: "PATCH", body: { status: "cancelled", reason } }),
                    "Dossier annulé.",
                  );
              },
            },
        ]}
        columns={[
          { label: "Dossier", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
          {
            label: "Student",
            render: (item) => <PersonCell name={item.studentName} detail={item.payer?.type === "organisation" ? `Payé par ${item.payer.name}` : item.phone} />,
            csv: (item) => item.studentName,
          },
          { label: "Formation", render: (item) => item.courseTitle || "—", csv: (item) => item.courseTitle },
          { label: "Modalité", render: (item) => `${PLANS[item.plan].split(" (")[0]} · ${item.installments.length} éch.`, csv: (item) => PLANS[item.plan] },
          { label: "Total", align: "right", render: (item) => money(item.totalAmount), csv: (item) => item.totalAmount },
          { label: "Reste", align: "right", render: (item) => <b>{money(item.balance)}</b>, csv: (item) => item.balance },
          {
            label: "Prochaine échéance",
            render: (item) => (item.nextDue ? `${dayLabel(item.nextDue.dueDate)} · ${money(item.nextDue.amount)}` : "—"),
            csv: (item) => item.nextDue?.dueDate || "",
          },
          { label: "Statut", render: (item) => <StatusPill status={item.paymentStatus} label={PAY_STATUS[item.paymentStatus]} />, csv: (item) => PAY_STATUS[item.paymentStatus] },
        ]}
        createDefaults={{ plan: "full", count: 1, "payer.type": "student", payer: { type: "student" } }}
        form={{
          title: "dossier de student",
          wide: true,
          fields,
          initial: (record) => ({ ...record, count: String(record.installments.length) }),
          toBody: (body, values) => {
            const installments =
              values.plan === "custom" ? (values.installments || []).map((row) => ({ ...row, amount: Number(row.amount) })) : [];
            return {
              ...body,
              count: Number(values.count) || 1,
              installments,
              // Échéancier personnalisé : le dossier commence à la première échéance.
              startDate: values.plan === "custom" ? installments.map((row) => row.dueDate).sort()[0] || today() : values.startDate,
            };
          },
          footer: (values) => <TotalPreview values={values} />,
        }}
      />
      {open && <AccountDialog id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
