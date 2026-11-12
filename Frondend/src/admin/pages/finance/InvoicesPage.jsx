import { useState } from "react";
import { Ban, Plus, Printer, Trash2 } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import PrintDocument from "../../components/PrintDocument.jsx";
import { PageHeading, PersonCell, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { adminApi } from "../../services/adminApi.js";
import { dayLabel, money, today } from "../../lib/format.js";
import { StudentAccountPicker } from "./fields.jsx";
import PaymentsPage from "./PaymentsPage.jsx";

function LinesEditor({ value = [], onChange }) {
  const update = (index, patch) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="splits-editor">
      {value.map((row, index) => (
        <div className="split-row lines-row" key={index}>
          <input required placeholder="Désignation" value={row.label} onChange={(event) => update(index, { label: event.target.value })} aria-label="Désignation" />
          <input type="number" min={0} step={1} value={row.quantity} onChange={(event) => update(index, { quantity: event.target.value })} aria-label="Quantité" />
          <input type="number" min={0} step={1} value={row.unitPrice} onChange={(event) => update(index, { unitPrice: event.target.value })} aria-label="Prix unitaire" />
          <button type="button" className="icon-button" aria-label="Retirer la ligne" onClick={() => onChange(value.filter((_, i) => i !== index))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="split-footer">
        <button type="button" className="panel-action" onClick={() => onChange([...value, { label: "", quantity: 1, unitPrice: 0 }])}>
          <Plus size={14} /> Ajouter une ligne
        </button>
        <span>
          Sous-total : <b>{money(value.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0), 0))}</b>
        </span>
      </div>
    </div>
  );
}

const fields = (record) => [
  ...(record
    ? []
    : [
        {
          key: "account",
          label: "Dossier du student",
          type: "custom",
          virtual: true,
          default: null,
          render: ({ value, set }) => <StudentAccountPicker value={value} onChange={set} />,
        },
      ]),
  { key: "issueDate", label: "Date d’émission", type: "date", required: true, default: today },
  { key: "dueDate", label: "Date d’échéance", type: "date", hint: "Par défaut : selon les paramètres financiers." },
  { key: "billTo.kind", label: "Facturer à", type: "select", options: [["student", "Le student"], ["organisation", "L’organisme qui finance la formation"]] },
  { key: "billTo.name", label: "Nom du destinataire", hint: record ? undefined : "Laissez vide pour reprendre le dossier." },
  { key: "billTo.address", label: "Adresse" },
  { key: "billTo.contact", label: "Contact" },
  {
    key: "lines",
    label: "Lignes de la facture",
    type: "custom",
    default: [],
    hint: record ? undefined : "Laissez vide : la formation, les frais d’inscription et la remise du dossier sont repris automatiquement.",
    render: ({ value, set }) => <LinesEditor value={value} onChange={set} />,
  },
  { key: "discount", label: "Remise", type: "money", show: () => Boolean(record) },
  ...(record ? [{ key: "reason", label: "Motif de la correction", required: true, wide: true, hint: "Conservé dans l’historique de la facture." }] : []),
  { key: "notes", label: "Notes", type: "textarea" },
];

function Invoices() {
  const admin = useAdmin();
  const [printing, setPrinting] = useState(null);
  return (
    <>
      <ListPage
        heading={false}
        endpoint="/finance/invoices"
        section="finance.invoices"
        search="N° de facture, destinataire…"
        exportName="factures"
        createLabel="Nouvelle facture"
        filters={[
          { key: "from", label: "Du", type: "date" },
          { key: "to", label: "au", type: "date" },
          { key: "status", label: "Statut", options: [["", "Toutes les factures"], ["issued", "Émises"], ["cancelled", "Annulées"]] },
        ]}
        editable={(item) => item.status !== "cancelled"}
        deletable={() => false}
        actions={(item, ctx) => [
          { icon: Printer, label: "Imprimer la facture", onClick: () => setPrinting(item) },
          admin.can("finance.invoices", "delete") &&
            item.status === "issued" && {
              icon: Ban,
              label: "Annuler la facture",
              tone: "delete",
              onClick: () => {
                const reason = window.prompt(`Motif de l’annulation de la facture ${item.number} :`);
                if (reason) ctx.run(() => adminApi(`/finance/invoices/${item._id}/cancel`, { method: "POST", body: { reason } }), "Facture annulée.");
              },
            },
        ]}
        columns={[
          { label: "Facture", render: (item) => <span className="record-id">{item.number}</span>, csv: (item) => item.number },
          { label: "Émise le", render: (item) => <span className="nowrap">{dayLabel(item.issueDate)}</span>, csv: (item) => item.issueDate },
          {
            label: "Destinataire",
            render: (item) => <PersonCell name={item.billTo?.name} detail={item.billTo?.kind === "organisation" ? `Student : ${item.studentAccountId?.studentName}` : item.studentAccountId?.courseTitle} />,
            csv: (item) => item.billTo?.name,
          },
          { label: "Total", align: "right", render: (item) => money(item.total), csv: (item) => item.total },
          { label: "Payé", align: "right", render: (item) => money(item.paid), csv: (item) => item.paid },
          { label: "Échéance", render: (item) => dayLabel(item.dueDate), csv: (item) => item.dueDate || "" },
          { label: "Statut", render: (item) => <StatusPill status={item.paymentStatus} />, csv: (item) => item.paymentStatus },
        ]}
        form={{
          title: "facture",
          wide: true,
          fields,
          toBody: (body, values, record) => {
            const lines = (values.lines || []).map((row) => ({ label: row.label, quantity: Number(row.quantity) || 0, unitPrice: Number(row.unitPrice) || 0 }));
            if (record) return { ...body, lines };
            if (!values.account) throw new Error("Choisissez le dossier du student.");
            const billTo = body.billTo?.name ? body.billTo : undefined;
            return { ...body, billTo, lines, studentAccountId: values.account._id };
          },
        }}
      />
      {printing && <PrintDocument kind="invoice" item={printing} onClose={() => setPrinting(null)} />}
    </>
  );
}

export default function InvoicesPage() {
  const admin = useAdmin();
  const [tab, setTab] = useState(admin.can("finance.invoices") ? "invoices" : "receipts");
  return (
    <>
      <PageHeading
        kicker="FINANCES · FACTURATION"
        title="Factures et reçus"
        description="Factures numérotées au nom du student ou de l’organisme qui finance la formation, et reçus de chaque paiement confirmé, à imprimer ou enregistrer en PDF."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ...(admin.can("finance.invoices") ? [["invoices", "Factures"]] : []),
          ...(admin.can("finance.payments") ? [["receipts", "Reçus de paiement"]] : []),
        ]}
      />
      {tab === "invoices" ? <Invoices /> : <PaymentsPage heading={false} />}
    </>
  );
}
