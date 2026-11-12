import { useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { Alert, PageHeading, Panel, PersonCell, SimpleTable, StatusPill, Tabs } from "../../components/ui.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { fileUrl } from "../../services/adminApi.js";
import { CONTRACT_TYPES, DOCUMENT_KINDS, PAY_TYPES, dayLabel, money, today } from "../../lib/format.js";
import { staffField } from "./fields.js";
import { StaffDossier } from "./StaffPage.jsx";

const STATUS = { draft: "Brouillon", active: "En cours", ended: "Terminé", terminated: "Rompu" };

function Documents() {
  const [q, setQ] = useState("");
  const [dossier, setDossier] = useState(null);
  const { data, error } = useRemote(`/rh/documents?q=${encodeURIComponent(q)}`, { delay: 200 });
  const soon = today();
  return (
    <>
      <Alert error={error} />
      <div className="admin-resource-bar">
        <div>
          <strong>{data?.items.length ?? 0}</strong>
          <span>documents dans les dossiers</span>
        </div>
        <label className="admin-search">
          <input value={q} placeholder="Nom de la personne…" onChange={(event) => setQ(event.target.value)} />
        </label>
      </div>
      <Panel subtitle="Pour ajouter un document, ouvrez le dossier de la personne.">
        <SimpleTable
          rows={data?.items}
          empty={<p className="dashboard-zero">Aucun document pour le moment. Ouvrez le dossier d’un enseignant ou d’un employé pour en ajouter.</p>}
          columns={[
            { label: "Personne", render: (row) => <PersonCell name={row.staffName} detail={row.staffReference} /> },
            {
              label: "Document",
              render: (row) => (
                <a className="doc-link" href={fileUrl(row.url)} target="_blank" rel="noreferrer">
                  <FileText size={15} /> {row.name}
                </a>
              ),
            },
            { label: "Type", render: (row) => DOCUMENT_KINDS[row.kind] },
            {
              label: "Expiration",
              render: (row) =>
                row.expiresAt ? (
                  <StatusPill status={row.expiresAt < soon ? "overdue" : "active"} label={dayLabel(row.expiresAt)} />
                ) : (
                  "—"
                ),
            },
            { label: "Ajouté le", render: (row) => dayLabel(row.uploadedAt?.slice(0, 10)) },
            {
              label: "Dossier",
              render: (row) => (
                <button className="panel-action" onClick={() => setDossier(row.staffId)}>
                  <FolderOpen size={14} /> Ouvrir
                </button>
              ),
            },
          ]}
        />
      </Panel>
      {dossier && <StaffDossier staffId={dossier} onClose={() => setDossier(null)} />}
    </>
  );
}

export default function ContractsPage() {
  const [tab, setTab] = useState("contracts");
  return (
    <>
      <PageHeading
        kicker="RESSOURCES HUMAINES · PERSONNEL"
        title="Contrats et documents"
        description="Contrats de travail et de vacation, pièces d’identité, diplômes et attestations du personnel."
      />
      <Tabs value={tab} onChange={setTab} tabs={[["contracts", "Contrats"], ["documents", "Documents du personnel"]]} />
      {tab === "documents" ? (
        <Documents />
      ) : (
        <ListPage
          heading={false}
          endpoint="/rh/contracts"
          section="rh.contracts"
          search={false}
          filters={[{ key: "status", label: "Statut", options: [["", "Tous les contrats"], ...Object.entries(STATUS)] }]}
          exportName="contrats"
          createLabel="Nouveau contrat"
          columns={[
            { label: "Référence", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
            { label: "Personne", render: (item) => <PersonCell name={item.staffId?.fullName} detail={item.position || item.staffId?.reference} />, csv: (item) => item.staffId?.fullName },
            { label: "Type", render: (item) => CONTRACT_TYPES[item.type], csv: (item) => CONTRACT_TYPES[item.type] },
            { label: "Début", render: (item) => dayLabel(item.startDate), csv: (item) => item.startDate },
            { label: "Fin", render: (item) => (item.endDate ? dayLabel(item.endDate) : "Indéterminée"), csv: (item) => item.endDate || "" },
            { label: "Rémunération", render: (item) => `${money(item.amount)} · ${PAY_TYPES[item.payType]}`, csv: (item) => item.amount },
            { label: "Statut", render: (item) => <StatusPill status={item.status} label={STATUS[item.status]} />, csv: (item) => STATUS[item.status] },
            {
              label: "Contrat signé",
              render: (item) =>
                item.documentUrl ? (
                  <a className="doc-link" href={fileUrl(item.documentUrl)} target="_blank" rel="noreferrer">
                    <FileText size={15} /> Voir
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
          form={{
            title: "contrat",
            fields: [
              staffField(),
              { key: "type", label: "Type de contrat", type: "select", options: Object.entries(CONTRACT_TYPES) },
              { key: "position", label: "Poste ou mission" },
              { key: "status", label: "Statut", type: "select", options: Object.entries(STATUS), default: "active" },
              { key: "startDate", label: "Date de début", type: "date", required: true, default: today },
              { key: "endDate", label: "Date de fin", type: "date", hint: "Laissez vide pour un CDI." },
              { key: "payType", label: "Rémunération", type: "select", options: Object.entries(PAY_TYPES) },
              { key: "amount", label: "Montant (salaire, tarif horaire ou forfait)", type: "money" },
              { key: "hoursPerWeek", label: "Heures par semaine", type: "number", min: 0, step: 0.5 },
              { key: "documentUrl", label: "Contrat signé (PDF)", type: "file" },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
          }}
        />
      )}
    </>
  );
}
