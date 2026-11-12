import { useState } from "react";
import { FileText, FolderOpen, Plus, Trash2 } from "lucide-react";
import Dialog from "../../../components/Dialog.jsx";
import ListPage from "../../components/ListPage.jsx";
import FormDialog from "../../components/FormDialog.jsx";
import { Alert, PersonCell, SimpleTable, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote, invalidateLookup } from "../../hooks/useRemote.js";
import { adminApi, fileUrl } from "../../services/adminApi.js";
import {
  CONTRACT_TYPES,
  DOCUMENT_KINDS,
  PAY_TYPES,
  PAYMENT_METHODS,
  SHIFTS,
  STAFF_STATUS,
  dayLabel,
  money,
  today,
} from "../../lib/format.js";
import { staffFields } from "./fields.js";

const payLabel = (item) =>
  item.payType === "hourly"
    ? `${money(item.hourlyRate)} / h`
    : item.payType === "flat"
      ? `${money(item.flatAmount)} (forfait)`
      : `${money(item.monthlySalary)} / mois`;

function Fact({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  );
}

// Dossier complet : identité, documents, contrats et prochaines séances.
export function StaffDossier({ staffId, onClose }) {
  const admin = useAdmin();
  const { data, reload, error } = useRemote(`/rh/staff/${staffId}`);
  const contracts = useRemote(admin.can("rh.contracts") ? `/rh/contracts?staffId=${staffId}&all=1` : null);
  const planning = useRemote(admin.can("rh.planning") ? `/rh/planning?staffId=${staffId}&from=${today()}&limit=8` : null);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState("");
  const item = data?.item;
  async function removeDocument(document) {
    if (!window.confirm(`Retirer « ${document.name} » du dossier ?`)) return;
    try {
      await adminApi(`/rh/staff/${staffId}/documents/${document._id}`, { method: "DELETE" });
      reload();
    } catch (problem) {
      setFailure(problem.message);
    }
  }
  return (
    <Dialog title={item ? item.fullName : "Dossier du personnel"} onClose={onClose} className="admin-details admin-editor-wide">
      <Alert error={error || failure} />
      {item && (
        <>
          <p className="dossier-meta">
            <span className="chip">{item.reference}</span>
            <span className="chip">{item.kind === "teacher" ? "Enseignant" : "Employé"}</span>
            <StatusPill status={item.status} label={STAFF_STATUS[item.status]} />
          </p>
          <dl className="record-details">
            <Fact label="Poste">{item.position}</Fact>
            <Fact label="Spécialité">{item.specialty}</Fact>
            <Fact label="Téléphone">{item.phone}</Fact>
            <Fact label="E-mail">{item.email}</Fact>
            <Fact label="Date d’entrée">{item.hireDate && dayLabel(item.hireDate)}</Fact>
            <Fact label="Pièce d’identité">{item.nationalId}</Fact>
            {item.kind === "teacher" && <Fact label="Matières">{item.subjects.join(" · ")}</Fact>}
            {item.kind === "teacher" && <Fact label="Classes">{item.classes.join(" · ")}</Fact>}
            {item.kind === "teacher" && <Fact label="Disponibilités">{item.availability}</Fact>}
            {admin.can("rh.rates") && <Fact label="Rémunération">{`${PAY_TYPES[item.payType]} · ${payLabel(item)}`}</Fact>}
            {admin.can("rh.rates") && <Fact label="Versement">{`${PAYMENT_METHODS[item.paymentMethod]} ${item.paymentAccount}`}</Fact>}
            <Fact label="Personne à prévenir">{item.emergencyContact}</Fact>
            <Fact label="Adresse">{item.address}</Fact>
          </dl>
          {admin.can("rh.contracts") && (
            <section className="dossier-section">
              <header>
                <h3>Documents</h3>
                {admin.can("rh.contracts", "create") && (
                  <button className="panel-action" onClick={() => setAdding(true)}>
                    <Plus size={14} /> Ajouter un document
                  </button>
                )}
              </header>
              {item.documents.length ? (
                <ul className="document-list">
                  {item.documents.map((document) => (
                    <li key={document._id}>
                      <FileText size={17} />
                      <a href={fileUrl(document.url)} target="_blank" rel="noreferrer">
                        {document.name}
                      </a>
                      <small>
                        {DOCUMENT_KINDS[document.kind]}
                        {document.expiresAt && ` · expire le ${dayLabel(document.expiresAt)}`}
                      </small>
                      {admin.can("rh.contracts", "delete") && (
                        <button aria-label={`Retirer ${document.name}`} onClick={() => removeDocument(document)}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-zero">Aucun document dans ce dossier.</p>
              )}
              <h3>Contrats</h3>
              <SimpleTable
                rows={contracts.data?.items}
                empty={<p className="dashboard-zero">Aucun contrat enregistré.</p>}
                columns={[
                  { label: "Référence", render: (row) => row.reference },
                  { label: "Type", render: (row) => CONTRACT_TYPES[row.type] },
                  { label: "Période", render: (row) => `${dayLabel(row.startDate)} → ${row.endDate ? dayLabel(row.endDate) : "indéterminée"}` },
                  { label: "Statut", render: (row) => <StatusPill status={row.status} /> },
                ]}
              />
            </section>
          )}
          {admin.can("rh.planning") && (
            <section className="dossier-section">
              <h3>Prochaines séances</h3>
              <SimpleTable
                rows={planning.data?.items}
                empty={<p className="dashboard-zero">Aucune séance prévue.</p>}
                columns={[
                  { label: "Date", render: (row) => dayLabel(row.date) },
                  { label: "Horaire", render: (row) => `${row.startTime}–${row.endTime} · ${SHIFTS[row.shift]}` },
                  { label: "Classe / poste", render: (row) => row.label },
                  { label: "Statut", render: (row) => <StatusPill status={row.status} /> },
                ]}
              />
            </section>
          )}
        </>
      )}
      {adding && (
        <FormDialog
          title="Ajouter un document"
          fields={[
            { key: "name", label: "Nom du document", required: true, placeholder: "Ex. : Passeport, Licence d’anglais" },
            { key: "kind", label: "Type", type: "select", options: Object.entries(DOCUMENT_KINDS), default: "identite" },
            { key: "expiresAt", label: "Date d’expiration (facultative)", type: "date" },
            { key: "url", label: "Fichier", type: "file" },
          ]}
          onClose={() => setAdding(false)}
          onSubmit={async (body) => {
            if (!body.url) throw new Error("Joignez le fichier du document.");
            await adminApi(`/rh/staff/${staffId}/documents`, { method: "POST", body });
            setAdding(false);
            reload();
          }}
        />
      )}
    </Dialog>
  );
}

export default function StaffPage({ kind }) {
  const admin = useAdmin();
  const teacher = kind === "teacher";
  const [dossier, setDossier] = useState(null);
  const section = teacher ? "rh.teachers" : "rh.employees";
  const showPay = admin.can("rh.rates");
  return (
    <>
      <ListPage
        kicker="RESSOURCES HUMAINES · PERSONNEL"
        title={teacher ? "Enseignants" : "Employés"}
        description={
          teacher
            ? "Enseignants à temps partiel ou payés à l’heure : matières, classes, disponibilités et documents."
            : "Employés mensualisés : poste, contrat, coordonnées et documents."
        }
        endpoint="/rh/staff"
        section={section}
        query={{ kind }}
        search="Nom, matricule, téléphone, poste…"
        exportName={teacher ? "enseignants" : "employes"}
        createLabel={teacher ? "Ajouter un enseignant" : "Ajouter un employé"}
        filters={[{ key: "status", label: "Statut", default: "active", options: [["", "Tous les statuts"], ...Object.entries(STAFF_STATUS)] }]}
        onChanged={() => invalidateLookup("staff")}
        columns={[
          { label: "Matricule", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
          {
            label: teacher ? "Enseignant" : "Employé",
            render: (item) => <PersonCell name={item.fullName} detail={item.position || item.specialty} />,
            csv: (item) => item.fullName,
          },
          { label: "Téléphone", render: (item) => item.phone || "—", csv: (item) => item.phone },
          teacher
            ? { label: "Matières", render: (item) => item.subjects.join(", ") || "—", csv: (item) => item.subjects.join(", ") }
            : { label: "Service", render: (item) => item.department || "—", csv: (item) => item.department },
          ...(showPay
            ? [{ label: "Rémunération", render: (item) => payLabel(item), csv: (item) => `${PAY_TYPES[item.payType]} ${payLabel(item)}` }]
            : []),
          { label: "Statut", render: (item) => <StatusPill status={item.status} label={STAFF_STATUS[item.status]} />, csv: (item) => STAFF_STATUS[item.status] },
        ]}
        actions={(item) => [{ icon: FolderOpen, label: "Ouvrir le dossier", onClick: () => setDossier(item._id) }]}
        deleteConfirm={(item) => `Supprimer le dossier de ${item.fullName} ? Possible seulement sans contrat, présence ni bulletin.`}
        createDefaults={{ status: "active", payType: teacher ? "hourly" : "monthly" }}
        form={{
          title: teacher ? "enseignant" : "employé",
          wide: true,
          fields: staffFields(kind, admin.can("rh.rates", "update")),
          toBody: (body, _values, record) => (record ? body : { ...body, kind }),
        }}
      />
      {dossier && <StaffDossier staffId={dossier} onClose={() => setDossier(null)} />}
    </>
  );
}
