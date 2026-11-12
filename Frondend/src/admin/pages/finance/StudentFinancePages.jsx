// Finances : Frais des formations, Liste des students, Encaissements.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ban, KeyRound, Printer, UserRound } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import PrintDocument from "../../components/PrintDocument.jsx";
import { StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { invalidateLookup, useLookup } from "../../hooks/useRemote.js";
import { adminApi, fileUrl } from "../../services/adminApi.js";
import { PAYMENT_METHODS, dayLabel, money, today } from "../../lib/format.js";
import "./student-finance.css";

const FEE_TYPES = {
  monthly: "Frais mensuel",
  registration: "Frais d’inscription",
  training: "Frais de formation",
  exam: "Frais d’examen",
  certificate: "Frais de certificat",
  other: "Autre frais",
};
// L’année scolaire commence en septembre.
function currentSchoolYear(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
const schoolYears = () => {
  const start = Number(currentSchoolYear().slice(0, 4));
  return [-1, 0, 1, 2].map((offset) => `${start + offset}-${start + offset + 1}`);
};
const STUDENT_STATUS = {
  new: ["Nouvelle demande", "new"],
  contacted: ["Contacté", "contacted"],
  confirmed: ["Inscrit", "confirmed"],
  closed: ["Clôturé", "closed"],
};
const PROFILES = { apprenant: "Apprenant", professionnel: "Professionnel", entreprise: "Entreprise" };
const PAYMENT_STATUS = { paid: "Payé (soldé)", partial: "Payé en partie", unpaid: "Non payé" };
const courseOptions = (courses, all) => [["", all], ...courses.map((course) => [course.id, course.title])];

function Avatar({ name, url }) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return url ? (
    <img className="student-avatar" src={fileUrl(url)} alt="" loading="lazy" />
  ) : (
    <span className="student-avatar" aria-hidden="true">
      {initials || <UserRound size={16} />}
    </span>
  );
}

// ——— Frais des formations ———
export function FeesPage() {
  const courses = useLookup("courses");
  return (
    <ListPage
      kicker="FINANCES · FRAIS DE FORMATION"
      title="Frais des formations"
      description="Les frais de chaque formation par année scolaire : frais mensuels, d’inscription, d’examen… Ils sont proposés automatiquement lors d’un encaissement."
      endpoint="/finance/fees"
      section="finance.fees"
      search="Rechercher un frais…"
      exportName="frais-formations"
      createLabel="Nouveau frais scolaire"
      onChanged={() => invalidateLookup("fees")}
      filters={[
        { key: "courseId", label: "Formation", options: courseOptions(courses, "Toutes les formations") },
        { key: "active", label: "Statut", options: [["", "Tous les statuts"], ["true", "Actifs"], ["false", "Désactivés"]] },
      ]}
      columns={[
        { label: "Formation", render: (item) => <strong>{item.courseTitle}</strong>, csv: (item) => item.courseTitle },
        {
          label: "Type de frais",
          render: (item) => <span className={`chip fee-type fee-${item.feeType || "training"}`}>{FEE_TYPES[item.feeType || "training"]}</span>,
          csv: (item) => FEE_TYPES[item.feeType || "training"],
        },
        {
          label: "Montant",
          align: "right",
          render: (item) => (
            <>
              <b>{money(item.amount)}</b>
              {item.feeType === "monthly" && <small className="cell-note">par mois · {item.durationMonths} mois</small>}
            </>
          ),
          csv: (item) => item.amount,
        },
        { label: "Année scolaire", render: (item) => item.schoolYear || "—", csv: (item) => item.schoolYear || "" },
        {
          label: "Statut",
          render: (item) => <StatusPill status={item.active ? "active" : "inactive"} label={item.active ? "Actif" : "Désactivé"} />,
          csv: (item) => (item.active ? "Actif" : "Désactivé"),
        },
      ]}
      createDefaults={{ active: true, feeType: "monthly", durationMonths: 1, schoolYear: currentSchoolYear() }}
      form={{
        title: "frais scolaire",
        // Tarifs créés avant l’ajout du type : prix total d’une formation.
        initial: (record) => ({
          ...record,
          feeType: record.feeType || "training",
          schoolYear: record.schoolYear || currentSchoolYear(),
        }),
        fields: [
          {
            key: "courseId",
            label: "Formation",
            type: "lookup",
            lookup: "courses",
            valueKey: "id",
            required: true,
            placeholder: "— Sélectionner —",
          },
          { key: "feeType", label: "Type de frais", type: "select", options: Object.entries(FEE_TYPES) },
          {
            key: "amount",
            label: "Montant",
            type: "money",
            required: true,
            hint: (values) => (values.feeType === "monthly" ? "Montant d’un mois." : "Montant total de ce frais."),
          },
          {
            key: "durationMonths",
            label: "Nombre de mois",
            type: "number",
            min: 1,
            maxValue: 60,
            show: (values) => values.feeType === "monthly",
            hint: (values) =>
              values.amount && values.durationMonths
                ? `Total sur la formation : ${money(Number(values.amount) * Number(values.durationMonths))}`
                : "Durée de la formation en mois.",
          },
          { key: "schoolYear", label: "Année scolaire", type: "select", options: schoolYears().map((year) => [year, year]) },
          { key: "active", label: "Frais actif", type: "checkbox" },
          { key: "notes", label: "Notes", type: "textarea" },
        ],
        // Le nom du frais est calculé par le serveur (type – formation).
        toBody: (body) => ({
          ...body,
          durationMonths: body.feeType === "monthly" ? body.durationMonths || 1 : 1,
        }),
      }}
    />
  );
}

// ——— Liste des students ———
export function StudentsPage() {
  const courses = useLookup("courses");
  const [params] = useSearchParams();
  const studentFields = (record) => [
    // Nouveau student : choisi dans Gestion du centre › Inscrits, ou saisi à la main.
    !record && {
      key: "registrationId",
      label: "Choisir dans les Inscrits (Gestion du centre)",
      type: "lookup",
      lookup: "registrations",
      query: "student=0",
      wide: true,
      placeholder: "— Nouveau student (pas encore inscrit) —",
      optionLabel: (item) =>
        `${item.name} · ${courses.find((course) => course.id === item.courseId)?.title || "Sans formation"} · ${item.phone || "—"} · ${item.reference}`,
      hint: "Les informations de l’inscrit sont reprises : complétez ce qui manque, puis enregistrez.",
      onPick: (item, setValue) => {
        setValue("pickedReference", item?.reference || "");
        if (!item) return;
        setValue("name", item.name || "");
        setValue("courseId", item.courseId || "");
        setValue("phone", item.phone || "");
        setValue("email", item.email || "");
        setValue("enrolledOn", item.enrolledOn || String(item.createdAt || "").slice(0, 10) || today());
        setValue("username", item.username || "");
        setValue("profile", item.profile || "apprenant");
        setValue("status", "confirmed");
        if (item.photoUrl) setValue("photoUrl", item.photoUrl);
      },
    },
    { key: "photoUrl", label: "Photo", type: "file", hint: "Photo d’identité (PNG, JPG ou WebP)." },
    {
      key: "reference",
      label: "ID student",
      type: "custom",
      virtual: true,
      render: ({ values }) => (
        <input
          value={record?.reference || values.pickedReference || "Généré automatiquement à l’enregistrement"}
          readOnly
          disabled
          className="readonly-input"
        />
      ),
    },
    { key: "name", label: "Nom complet", required: true, placeholder: "Prénom et nom" },
    { key: "courseId", label: "Compétence / formation", type: "lookup", lookup: "courses", valueKey: "id", required: true, placeholder: "— Sélectionner —" },
    { key: "phone", label: "Contact téléphone", type: "tel", required: true, placeholder: "+253 77 00 00 00" },
    { key: "enrolledOn", label: "Date d’inscription", type: "date" },
    { key: "email", label: "E-mail (facultatif)", type: "email" },
    { key: "username", label: "Nom d’utilisateur", placeholder: "Ex. : amina.ali", hint: "Identifiant du student (lettres, chiffres, point, tiret)." },
    {
      key: "password",
      label: "Mot de passe",
      type: "password",
      placeholder: record ? "Laisser vide pour conserver l’actuel" : "8 caractères minimum",
      hint: record?.hasPassword ? "Un mot de passe est déjà défini." : "Facultatif.",
    },
    { key: "profile", label: "Profil", type: "select", options: Object.entries(PROFILES) },
    { key: "status", label: "Statut", type: "select", options: Object.entries(STUDENT_STATUS).map(([key, [label]]) => [key, label]) },
  ].filter(Boolean);
  return (
    <ListPage
      kicker="FINANCES · STUDENTS"
      title="Liste des students"
      description="Les students du centre et leur situation de paiement. « Nouveau student » permet de choisir une personne dans Gestion du centre › Inscrits et de compléter sa fiche."
      endpoint="/finance/students"
      section="finance.students"
      search="Nom, ID, téléphone ou nom d’utilisateur…"
      exportName="liste-eleves"
      createLabel="Nouveau student"
      onChanged={() => invalidateLookup("registrations")}
      filters={[
        { key: "courseId", label: "Formation", options: courseOptions(courses, "Toutes les formations") },
        { key: "status", label: "Statut", options: [["", "Tous les statuts"], ...Object.entries(STUDENT_STATUS).map(([key, [label]]) => [key, label])] },
        {
          key: "payment",
          label: "Paiement",
          default: PAYMENT_STATUS[params.get("paiement")] ? params.get("paiement") : "",
          options: [["", "Payé ou non"], ...Object.entries(PAYMENT_STATUS)],
        },
      ]}
      deleteConfirm={(item) => `Retirer ${item.name} de la liste des students ? (La fiche reste dans les Inscrits.)`}
      columns={[
        { label: "Photo", render: (item) => <Avatar name={item.name} url={item.photoUrl} /> },
        { label: "ID", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
        { label: "Nom complet", render: (item) => <strong>{item.name}</strong>, csv: (item) => item.name },
        { label: "Compétence / formation", render: (item) => item.courseTitle, csv: (item) => item.courseTitle },
        { label: "Contact téléphone", render: (item) => <a href={`tel:${item.phone}`} className="nowrap">{item.phone}</a>, csv: (item) => item.phone },
        { label: "Date", render: (item) => <span className="nowrap">{dayLabel(item.enrolledOn)}</span>, csv: (item) => item.enrolledOn },
        { label: "Username", render: (item) => item.username || <span className="muted">—</span>, csv: (item) => item.username },
        {
          label: "Mot de passe",
          render: (item) =>
            item.hasPassword ? (
              <span className="password-set" title="Mot de passe chiffré : il ne peut pas être affiché.">
                <KeyRound size={14} /> ••••••••
              </span>
            ) : (
              <span className="muted">Non défini</span>
            ),
          csv: (item) => (item.hasPassword ? "Défini" : "Non défini"),
        },
        { label: "Profil", render: (item) => PROFILES[item.profile] || "—", csv: (item) => PROFILES[item.profile] },
        {
          label: "Statut",
          render: (item) => {
            const [label, tone] = STUDENT_STATUS[item.status] || STUDENT_STATUS.new;
            return <span className={`admin-status status-${tone}`}>{label}</span>;
          },
          csv: (item) => STUDENT_STATUS[item.status]?.[0],
        },
        {
          label: "Paiement",
          render: (item) => (
            <>
              <StatusPill status={item.paymentStatus} label={PAYMENT_STATUS[item.paymentStatus]} />
              {item.due > 0 && <small className="cell-note">{money(item.paid)} / {money(item.due)}</small>}
            </>
          ),
          csv: (item) => `${PAYMENT_STATUS[item.paymentStatus]} (${item.paid}/${item.due})`,
        },
      ]}
      createDefaults={{ status: "confirmed", profile: "apprenant", enrolledOn: today() }}
      form={{
        title: "student",
        wide: true,
        fields: studentFields,
        initial: (record) => ({ ...record, password: "" }),
        toBody: (body, _values, record) => {
          const { reference, ...rest } = body;
          if (!rest.password) delete rest.password;
          if (record && !rest.photoUrl) rest.photoUrl = "";
          return rest;
        },
      }}
    />
  );
}

// ——— Encaissements ———
export function CollectionsPage() {
  const admin = useAdmin();
  const courses = useLookup("courses");
  const [printing, setPrinting] = useState(null);
  async function print(item) {
    setPrinting((await adminApi(`/finance/payments/${item._id}`)).item);
  }
  return (
    <>
      <ListPage
        kicker="FINANCES · PAIEMENTS DES STUDENTS"
        title="Encaissements"
        description="Chaque paiement reçu d’un student, avec le frais réglé et le mode de paiement. Le reçu est numéroté et imprimable."
        endpoint="/finance/collections"
        section="finance.payments"
        search="Nom du student, référence ou n° de reçu…"
        exportName="encaissements"
        createLabel="Nouvel encaissement"
        onChanged={() => invalidateLookup("registrations")}
        filters={[
          { key: "courseId", label: "Formation", options: courseOptions(courses, "Toutes les formations") },
          { key: "method", label: "Mode", options: [["", "Tous les modes"], ...Object.entries(PAYMENT_METHODS)] },
          { key: "status", label: "Statut", options: [["", "Tous les statuts"], ["confirmed", "Confirmés"], ["cancelled", "Annulés"]] },
        ]}
        editable={() => false}
        deletable={() => false}
        actions={(item, ctx) => [
          { icon: Printer, label: "Imprimer le reçu", onClick: () => print(item).catch((failure) => ctx.setError(failure.message)) },
          admin.can("finance.payments", "delete") &&
            item.status === "confirmed" && {
              icon: Ban,
              label: "Annuler l’encaissement",
              tone: "delete",
              onClick: () => {
                const reason = window.prompt(`Motif de l’annulation du reçu ${item.receiptNumber} :`);
                if (reason)
                  ctx.run(
                    () => adminApi(`/finance/payments/${item._id}/cancel`, { method: "POST", body: { reason } }),
                    "Encaissement annulé : la situation du student a été recalculée.",
                  );
              },
            },
        ]}
        columns={[
          {
            label: "Référence",
            render: (item) => (
              <>
                <span className="record-id">{item.reference}</span>
                <small className="cell-note">Reçu {item.receiptNumber}</small>
              </>
            ),
            csv: (item) => item.reference,
          },
          { label: "ID", render: (item) => <span className="record-id">{item.studentCode || "—"}</span>, csv: (item) => item.studentCode },
          {
            label: "Nom complet",
            render: (item) => (
              <span className="student-cell">
                <Avatar name={item.studentName} url={item.photoUrl} />
                <strong>{item.studentName}</strong>
              </span>
            ),
            csv: (item) => item.studentName,
          },
          { label: "Formation", render: (item) => item.courseTitle || "—", csv: (item) => item.courseTitle },
          { label: "Frais lié", render: (item) => item.feeLabel || "—", csv: (item) => item.feeLabel },
          { label: "Montant", align: "right", render: (item) => <b>{money(item.amount)}</b>, csv: (item) => item.amount },
          {
            label: "Mode paiement",
            render: (item) => <span className="chip">{PAYMENT_METHODS[item.method] || "—"}</span>,
            csv: (item) => PAYMENT_METHODS[item.method],
          },
          { label: "Date", render: (item) => <span className="nowrap">{dayLabel(item.date)}</span>, csv: (item) => item.date },
          {
            label: "Statut",
            render: (item) => (
              <>
                <StatusPill status={item.status} />
                {item.status === "cancelled" && <small className="cell-note">{item.cancelReason}</small>}
              </>
            ),
            csv: (item) => (item.status === "cancelled" ? `Annulé : ${item.cancelReason}` : "Confirmé"),
          },
        ]}
        createDefaults={{ method: "cash", date: today() }}
        form={{
          title: "encaissement",
          intro: "Choisissez d’abord la formation : la liste des students et des frais s’adapte.",
          fields: [
            {
              key: "courseId",
              label: "Formation",
              type: "lookup",
              lookup: "courses",
              valueKey: "id",
              required: true,
              placeholder: "— Sélectionner —",
              onPick: (_item, setValue) => {
                setValue("registrationId", "");
                setValue("feeId", "");
              },
            },
            {
              key: "registrationId",
              label: "Student",
              type: "lookup",
              lookup: "registrations",
              query: (values) => (values.courseId ? `courseId=${encodeURIComponent(values.courseId)}&student=1` : ""),
              filter: (item, values) => Boolean(values.courseId) && item.courseId === values.courseId,
              optionLabel: (item) => `${item.name} · ${item.reference}${item.phone ? ` · ${item.phone}` : ""}`,
              placeholder: "Choisir d’abord la formation, puis le student",
              hint: "Students de la Liste des students inscrits à cette formation.",
              required: true,
            },
            {
              key: "feeId",
              label: "Frais lié",
              type: "lookup",
              lookup: "fees",
              filter: (item, values) => item.courseId === values.courseId,
              optionLabel: (item) =>
                `${item.label} · ${money(item.amount)}${item.feeType === "monthly" ? " / mois" : ""}${item.schoolYear ? ` · ${item.schoolYear}` : ""}`,
              placeholder: "Frais actif de la formation (automatique)",
              hint: "Facultatif : sans choix, le frais actif de la formation est utilisé.",
              onPick: (item, setValue) => item && setValue("amount", item.amount),
            },
            { key: "amount", label: "Montant", type: "money", required: true },
            { key: "method", label: "Mode paiement", type: "select", options: Object.entries(PAYMENT_METHODS) },
            { key: "date", label: "Date", type: "date", required: true },
            { key: "notes", label: "Observations", type: "textarea", placeholder: "Ex. : mensualité de novembre, payé par le père…" },
          ],
        }}
      />
      {printing && <PrintDocument kind="receipt" item={printing} onClose={() => setPrinting(null)} />}
    </>
  );
}
