import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
import FormDialog from "../../components/FormDialog.jsx";
import ListPage from "../../components/ListPage.jsx";
import { Alert, Forbidden, PageHeading, Panel, PeriodPicker, SimpleTable } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { invalidateLookup, useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { ACCOUNT_KINDS, PAYMENT_METHODS, dayLabel, money, monthStart, today } from "../../lib/format.js";
import { accountField } from "./fields.jsx";

const MOVEMENTS = {
  student_payment: "Paiement de student",
  expense: "Dépense",
  staff_payment: "Rémunération",
  advance: "Avance au personnel",
  transfer_in: "Transfert reçu",
  transfer_out: "Transfert envoyé",
};
const INTRO = {
  cash: "La caisse en espèces du centre : encaissements, dépenses payées en liquide et dépôts en banque.",
  bank: "Les comptes bancaires du centre : virements, versements et dépôts.",
  dmoney: "Le portefeuille D-Money du centre.",
  waafi: "Le portefeuille Waafi du centre.",
  cacpay: "Le compte CAC Pay du centre.",
  sabapay: "Le compte Saba Pay du centre.",
};
const accountFields = (kind) => [
  { key: "name", label: "Nom du compte", required: true, placeholder: kind === "bank" ? "Ex. : CAC Bank – compte courant" : `Ex. : ${ACCOUNT_KINDS[kind]} principal` },
  { key: "number", label: kind === "bank" ? "N° de compte / IBAN" : kind === "cash" ? "Emplacement" : "N° marchand / téléphone" },
  ...(kind === "bank" ? [{ key: "bankName", label: "Banque" }] : []),
  { key: "holder", label: "Titulaire" },
  { key: "openingBalance", label: "Solde d’ouverture", type: "number", step: 1, hint: "Le montant présent sur le compte au démarrage du suivi." },
  { key: "openingDate", label: "Date du solde d’ouverture", type: "date" },
  { key: "active", label: "Compte actif", type: "checkbox", default: true, hint: "Un compte désactivé ne peut plus recevoir ni verser d’argent." },
  { key: "notes", label: "Notes", type: "textarea" },
];

function Movements({ account }) {
  const [period, setPeriod] = useState({ from: monthStart(), to: today() });
  const { data, error } = useRemote(`/finance/accounts/${account._id}/movements?from=${period.from}&to=${period.to}`);
  const items = data?.items || [];
  const inflow = items.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const outflow = items.filter((item) => item.amount < 0).reduce((sum, item) => sum - item.amount, 0);
  return (
    <Panel
      title={`Mouvements · ${account.name}`}
      subtitle={`Entrées ${money(inflow)} · sorties ${money(outflow)} sur la période`}
      action={<PeriodPicker {...period} onChange={setPeriod} />}
    >
      <Alert error={error} />
      <SimpleTable
        rows={items}
        rowKey={(row) => `${row.kind}-${row.reference}-${row.date}-${row.amount}`}
        empty={<p className="dashboard-zero">Aucun mouvement sur cette période.</p>}
        columns={[
          { label: "Date", render: (row) => <span className="nowrap">{dayLabel(row.date)}</span> },
          { label: "Opération", render: (row) => MOVEMENTS[row.kind] },
          { label: "Description", render: (row) => row.label },
          { label: "Référence", render: (row) => <span className="record-id">{row.reference || "—"}</span> },
          {
            label: "Montant",
            align: "right",
            render: (row) => (
              <span className={row.amount > 0 ? "amount-in" : "amount-out"}>
                {row.amount > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                {row.amount > 0 ? "+" : "−"} {money(Math.abs(row.amount))}
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}

export default function AccountsPage({ kind }) {
  const admin = useAdmin();
  const allowed = admin.can("finance.accounts");
  const { data, error, reload } = useRemote(allowed ? "/finance/accounts/balances" : null);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  if (!allowed) return <Forbidden />;
  const accounts = (data?.items || []).filter((item) => item.kind === kind);
  const current = accounts.find((item) => item._id === selected) || accounts[0];
  const total = accounts.filter((item) => item.active).reduce((sum, item) => sum + item.balance, 0);
  return (
    <>
      <PageHeading kicker="FINANCES · CAISSE ET COMPTES" title={ACCOUNT_KINDS[kind]} description={INTRO[kind]}>
        {admin.can("finance.transfers", "create") && (
          <Link to="/admin/finance/transferts" className="button button-outline">
            <Repeat size={16} /> Transfert entre comptes
          </Link>
        )}
        {admin.can("finance.accounts", "create") && (
          <button className="button" onClick={() => setEditor({ record: null })}>
            <Plus size={16} /> Ajouter un compte
          </button>
        )}
      </PageHeading>
      <Alert error={error} />
      <div className="account-cards">
        {accounts.map((account) => (
          <div
            key={account._id}
            className={`account-card ${current?._id === account._id ? "is-selected" : ""} ${account.active ? "" : "is-inactive"}`}
          >
            <button className="account-card-select" aria-pressed={current?._id === account._id} onClick={() => setSelected(account._id)}>
              <strong>{account.name}</strong>
              <small>{[account.bankName, account.number].filter(Boolean).join(" · ") || PAYMENT_METHODS[account.kind]}</small>
              <b className={account.balance < 0 ? "amount-out" : ""}>{money(account.balance)}</b>
              <span className="account-card-flow">
                <span>Entrées {money(account.inflow)}</span>
                <span>Sorties {money(account.outflow)}</span>
              </span>
              {!account.active && <em className="chip">Désactivé</em>}
            </button>
            {admin.can("finance.accounts", "update") && (
              <button className="icon-button account-card-edit" aria-label={`Modifier ${account.name}`} onClick={() => setEditor({ record: account })}>
                <Pencil size={15} />
              </button>
            )}
          </div>
        ))}
        {data && !accounts.length && <p className="dashboard-zero">Aucun compte de ce type. Ajoutez-en un pour suivre son solde.</p>}
      </div>
      {accounts.length > 1 && <p className="cell-note">Solde total des comptes actifs : <b>{money(total)}</b></p>}
      {current && <Movements key={current._id} account={current} />}
      {editor && (
        <FormDialog
          title={editor.record ? `Modifier · ${editor.record.name}` : `Ajouter un compte · ${ACCOUNT_KINDS[kind]}`}
          fields={accountFields(kind)}
          initial={editor.record || { active: true, openingBalance: 0 }}
          onClose={() => setEditor(null)}
          onSubmit={async (body) => {
            await adminApi(editor.record ? `/finance/accounts/${editor.record._id}` : "/finance/accounts", {
              method: editor.record ? "PATCH" : "POST",
              body: { ...body, kind },
            });
            invalidateLookup("accounts");
            setEditor(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export function TransfersPage() {
  return (
    <ListPage
      kicker="FINANCES · CAISSE ET COMPTES"
      title="Transferts entre comptes"
      description="Dépôt des espèces en banque, retrait, ou passage d’un portefeuille mobile vers le compte bancaire. Les transferts ne sont ni des recettes ni des dépenses."
      endpoint="/finance/transfers"
      section="finance.transfers"
      search="Référence, note…"
      exportName="transferts"
      createLabel="Nouveau transfert"
      filters={[
        { key: "from", label: "Du", type: "date" },
        { key: "to", label: "au", type: "date" },
      ]}
      editable={() => false}
      deletable={(item) => item.status === "done"}
      deleteConfirm={(item) => `Annuler le transfert ${item.reference} de ${money(item.amount)} ? Les soldes seront recalculés.`}
      columns={[
        { label: "Référence", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
        { label: "Date", render: (item) => dayLabel(item.date), csv: (item) => item.date },
        { label: "De", render: (item) => item.fromAccountId?.name, csv: (item) => item.fromAccountId?.name },
        { label: "Vers", render: (item) => item.toAccountId?.name, csv: (item) => item.toAccountId?.name },
        { label: "Montant", align: "right", render: (item) => <b>{money(item.amount)}</b>, csv: (item) => item.amount },
        { label: "Note", render: (item) => item.notes || item.transactionRef || "—", csv: (item) => item.notes },
        { label: "Statut", render: (item) => (item.status === "done" ? "Effectué" : "Annulé"), csv: (item) => item.status },
      ]}
      createDefaults={{ date: today() }}
      form={{
        title: "transfert",
        fields: [
          { key: "date", label: "Date", type: "date", required: true },
          accountField("fromAccountId", "Depuis le compte"),
          accountField("toAccountId", "Vers le compte"),
          { key: "amount", label: "Montant", type: "money", required: true },
          { key: "transactionRef", label: "Référence (bordereau, transaction)" },
          { key: "notes", label: "Note", type: "textarea", placeholder: "Ex. : Dépôt de la caisse à la banque" },
        ],
      }}
    />
  );
}
