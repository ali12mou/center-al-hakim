import { useState } from "react";
import { Check, FileText, X } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { PageHeading, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useLookup, invalidateLookup } from "../../hooks/useRemote.js";
import { adminApi, fileUrl } from "../../services/adminApi.js";
import { PAYMENT_METHODS, dayLabel, money, monthStart, today } from "../../lib/format.js";
import { accountField } from "./fields.jsx";

const STATUS = { pending: "À valider", validated: "Validée", rejected: "Refusée" };
const proofLink = (item) =>
  item.proofUrl ? (
    <a className="doc-link" href={fileUrl(item.proofUrl)} target="_blank" rel="noreferrer">
      <FileText size={15} /> Voir
    </a>
  ) : (
    <span className="cell-note">Aucun</span>
  );

export function ExpensesList({ openNew = false, heading = true, proofsOnly = false }) {
  const admin = useAdmin();
  const categories = useLookup("expense-categories");
  const approver = admin.can("finance.expenses", "approve");
  const decide = (item, ctx, status) => {
    const note = status === "rejected" ? window.prompt("Motif du refus :") : "";
    if (note === null) return;
    ctx.run(
      () => adminApi(`/finance/expenses/${item._id}/decision`, { method: "POST", body: { status, note } }),
      status === "validated" ? "Dépense validée : elle est déduite du compte." : "Dépense refusée.",
    );
  };
  return (
    <ListPage
      heading={heading}
      kicker="FINANCES · DÉPENSES DU CENTRE"
      title={openNew ? "Nouvelle dépense" : "Dépenses du centre"}
      description="Loyer, électricité, eau, internet, fournitures (feuilles, stylos), matériel informatique, mobilier, climatisation, entretien… Au-dessus du seuil fixé dans les paramètres, une dépense attend la validation d’un responsable."
      endpoint="/finance/expenses"
      section="finance.expenses"
      search="Bénéficiaire, description, référence…"
      exportName="depenses"
      createLabel="Nouvelle dépense"
      autoCreate={openNew}
      filters={[
        { key: "from", label: "Du", type: "date", default: proofsOnly ? "" : monthStart() },
        { key: "to", label: "au", type: "date", default: proofsOnly ? "" : today() },
        { key: "categoryId", label: "Catégorie", options: [["", "Toutes les catégories"], ...categories.map((item) => [item._id, item.name])] },
        { key: "status", label: "Statut", options: [["", "Tous les statuts"], ...Object.entries(STATUS)] },
      ]}
      editable={(item) => item.status === "pending" || approver}
      deletable={(item) => item.status !== "validated" || approver}
      deleteConfirm={(item) => `Supprimer la dépense ${item.reference} (${money(item.amount)}) ?`}
      actions={(item, ctx) => [
        approver && item.status === "pending" && { icon: Check, label: "Valider", tone: "approve", onClick: () => decide(item, ctx, "validated") },
        approver && item.status === "pending" && { icon: X, label: "Refuser", tone: "delete", onClick: () => decide(item, ctx, "rejected") },
      ]}
      columns={[
        { label: "Référence", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
        { label: "Date", render: (item) => <span className="nowrap">{dayLabel(item.date)}</span>, csv: (item) => item.date },
        { label: "Catégorie", render: (item) => <span className="chip">{item.categoryName}</span>, csv: (item) => item.categoryName },
        {
          label: "Bénéficiaire",
          render: (item) => (
            <>
              <strong>{item.beneficiary}</strong>
              {item.description && <small className="cell-note">{item.description}</small>}
            </>
          ),
          csv: (item) => `${item.beneficiary} ${item.description}`,
        },
        { label: "Montant", align: "right", render: (item) => <b>{money(item.amount)}</b>, csv: (item) => item.amount },
        { label: "Payé par", render: (item) => `${PAYMENT_METHODS[item.method]} · ${item.accountId?.name || ""}`, csv: (item) => PAYMENT_METHODS[item.method] },
        { label: "Justificatif", render: proofLink, csv: (item) => (item.proofUrl ? "Oui" : "Non") },
        {
          label: "Statut",
          render: (item) => (
            <>
              <StatusPill status={item.status} label={STATUS[item.status]} />
              {item.decidedBy?.name && <small className="cell-note">par {item.decidedBy.name}</small>}
              {item.decisionNote && <small className="cell-note">{item.decisionNote}</small>}
            </>
          ),
          csv: (item) => STATUS[item.status],
        },
      ]}
      createDefaults={{ date: today(), method: "cash" }}
      form={{
        title: "dépense",
        fields: [
          { key: "date", label: "Date", type: "date", required: true },
          {
            key: "categoryId",
            label: "Catégorie",
            type: "lookup",
            lookup: "expense-categories",
            required: true,
            optionLabel: (item) => `${item.name}${item.requiresProof ? " (justificatif obligatoire)" : ""}`,
          },
          { key: "beneficiary", label: "Bénéficiaire / fournisseur", required: true, placeholder: "Ex. : Librairie, EDD, Djibouti Télécom" },
          { key: "amount", label: "Montant", type: "money", required: true },
          accountField("accountId", "Payé depuis le compte"),
          { key: "transactionRef", label: "Référence (facture, reçu, transaction)" },
          { key: "description", label: "Description", type: "textarea", placeholder: "Ex. : 10 rames de papier A4, réparation du climatiseur salle 2" },
          { key: "proofUrl", label: "Justificatif (facture, reçu)", type: "file" },
        ],
      }}
    />
  );
}

export default function ExpensesPage({ openNew = false }) {
  return <ExpensesList key={openNew ? "new" : "list"} openNew={openNew} />;
}

export function CategoriesPage() {
  const admin = useAdmin();
  const [tab, setTab] = useState(admin.can("finance.expenseCategories") ? "categories" : "proofs");
  return (
    <>
      <PageHeading
        kicker="FINANCES · DÉPENSES DU CENTRE"
        title="Catégories et justificatifs"
        description="Les catégories de dépenses du centre et les pièces justificatives jointes à chaque dépense."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ...(admin.can("finance.expenseCategories") ? [["categories", "Catégories"]] : []),
          ...(admin.can("finance.expenses") ? [["proofs", "Justificatifs des dépenses"]] : []),
        ]}
      />
      {tab === "categories" ? (
        <ListPage
          heading={false}
          endpoint="/finance/expense-categories"
          section="finance.expenseCategories"
          search="Nom de la catégorie…"
          createLabel="Nouvelle catégorie"
          onChanged={() => invalidateLookup("expense-categories")}
          deleteConfirm={(item) => `Supprimer la catégorie « ${item.name} » ? Impossible si des dépenses l’utilisent.`}
          columns={[
            { label: "Catégorie", render: (item) => <strong>{item.name}</strong> },
            { label: "Description", render: (item) => item.description || "—" },
            { label: "Justificatif", render: (item) => (item.requiresProof ? "Obligatoire" : "Facultatif") },
            { label: "État", render: (item) => <StatusPill status={item.active ? "active" : "inactive"} label={item.active ? "Active" : "Désactivée"} /> },
          ]}
          form={{
            title: "catégorie",
            fields: [
              { key: "name", label: "Nom", required: true },
              { key: "description", label: "Description", wide: true },
              { key: "requiresProof", label: "Justificatif obligatoire", type: "checkbox" },
              { key: "active", label: "Catégorie active", type: "checkbox", default: true },
            ],
          }}
        />
      ) : (
        <ExpensesList heading={false} proofsOnly />
      )}
    </>
  );
}
