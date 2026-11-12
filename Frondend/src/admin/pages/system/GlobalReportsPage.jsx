import { useState } from "react";
import { BookOpen, Download, Eye, GraduationCap, Mail, Users, Wallet, Receipt, UserRound, MousePointerClick } from "lucide-react";
import { ColumnChart, HBars } from "../../components/Charts.jsx";
import { Alert, PageHeading, Panel, PeriodPicker, SimpleTable, StatGrid } from "../../components/ui.jsx";
import { adminApi } from "../../services/adminApi.js";
import { useRemote } from "../../hooks/useRemote.js";
import { dayLabel, downloadCsv, money, monthStart, today } from "../../lib/format.js";
import { statusLabels } from "../../config/sections.js";

const CONTENT = {
  courses: "Formations (Courses)",
  competences: "Compétences",
  certifications: "Certifications",
  partners: "Partenaires",
  businesses: "Offres Businesses",
  blog: "Articles du blog",
  informations: "Informations",
  assessments: "Skill Assessment",
  slides: "Diapositives de l’accueil",
};
const EXPORTS = [
  ["registrations", "Liste des inscrits"],
  ["contacts", "Messages de contact"],
  ["staff", "Liste du personnel"],
  ["payments", "Paiements des students"],
  ["expenses", "Dépenses du centre"],
  ["visits", "Fréquentation du site"],
];

export default function GlobalReportsPage() {
  const [period, setPeriod] = useState({ from: monthStart(), to: today() });
  const { data, error } = useRemote(`/system/reports?from=${period.from}&to=${period.to}`, { delay: 200 });
  const [exportError, setExportError] = useState("");
  async function exportList(dataset, label) {
    try {
      const { rows } = await adminApi(`/system/export/${dataset}?from=${period.from}&to=${period.to}`);
      if (!rows.length) return setExportError(`« ${label} » : aucune ligne sur cette période.`);
      setExportError("");
      downloadCsv(`${dataset}-${period.from}-${period.to}`, rows);
    } catch (failure) {
      setExportError(failure.message);
    }
  }
  const students = data?.students;
  const finance = data?.finance;
  const visitors = data?.visitors;
  return (
    <>
      <PageHeading
        kicker="ADMINISTRATION GÉNÉRALE"
        title="Rapports généraux"
        description="Students, personnel, paiements, contenu publié et fréquentation du site, sur la période choisie."
      >
        <PeriodPicker {...period} onChange={setPeriod} />
      </PageHeading>
      <Alert error={error || exportError} />
      <h2 className="report-title">Students et demandes</h2>
      <StatGrid
        loading={!data}
        items={
          data
            ? [
                { icon: Users, label: "Inscriptions sur la période", value: students.registrationsInRange, note: `${students.registrations} au total`, to: "/admin/registrations" },
                { icon: Mail, label: "Messages de contact", value: students.contactsInRange, note: `${students.contacts} au total`, tone: "pink", to: "/admin/contacts" },
                { icon: GraduationCap, label: "Tests Skill Assessment", value: students.attempts, note: "Réalisés sur la période", tone: "green" },
                { icon: UserRound, label: "Personnel actif", value: data.staff.teachers + data.staff.employees, note: `${data.staff.teachers} enseignant(s) · ${data.staff.employees} employé(s)`, tone: "blue" },
              ]
            : []
        }
      />
      <div className="dashboard-grid">
        <Panel title="Inscriptions par formation" subtitle="Sur la période">
          <HBars items={(students?.byCourse || []).map((row) => ({ key: row.id || "none", label: row.title, value: row.count }))} />
        </Panel>
        <Panel title="Suivi des inscriptions" subtitle="Statut des demandes de la période">
          <HBars
            items={Object.entries(statusLabels).map(([key, label]) => ({ key, label, value: students?.byStatus[key] || 0 }))}
          />
        </Panel>
      </div>
      <h2 className="report-title">Finances</h2>
      <StatGrid
        loading={!data}
        items={
          data
            ? [
                { icon: Wallet, label: "Encaissé sur la période", value: money(finance.collected), note: `${finance.payments} paiement(s)`, tone: "green" },
                { icon: Receipt, label: "Reste à recevoir", value: money(finance.receivable), note: `Sur ${money(finance.billed)} facturés`, tone: "pink" },
                { icon: Wallet, label: "Dépenses validées", value: money(finance.expenses), note: `${finance.expenseCount} dépense(s)` },
                { icon: UserRound, label: "Rémunérations versées", value: money(finance.salaries), note: "Salaires et enseignants", tone: "blue" },
              ]
            : []
        }
        className="money-stats"
      />
      <h2 className="report-title">Fréquentation du site public</h2>
      <StatGrid
        loading={!data}
        items={
          data
            ? [
                { icon: Eye, label: "Pages vues", value: visitors.views, note: "Sur la période" },
                { icon: MousePointerClick, label: "Visites", value: visitors.sessions, note: "Sessions de navigation", tone: "blue" },
                { icon: BookOpen, label: "Formations publiées", value: data.content.courses.published, note: `${data.content.courses.total} au total`, tone: "green", to: "/admin/courses" },
                { icon: GraduationCap, label: "Compétences publiées", value: data.content.competences.published, note: `${data.content.competences.total} au total`, tone: "pink", to: "/admin/competences" },
              ]
            : []
        }
      />
      <div className="dashboard-grid dashboard-grid-wide">
        <Panel title="Pages vues par jour" subtitle="Comptage anonyme, sans cookie ni adresse IP">
          {visitors?.daily.length ? (
            <ColumnChart
              label="Pages vues par jour"
              format={(value) => `${value} vue${value > 1 ? "s" : ""}`}
              items={visitors.daily.slice(-31).map((row) => ({
                key: row.day,
                label: row.day.slice(8),
                title: dayLabel(row.day),
                value: row.views,
              }))}
            />
          ) : (
            <p className="dashboard-zero">Les visites du site apparaîtront ici dès les premières consultations.</p>
          )}
        </Panel>
        <Panel title="Pages les plus consultées">
          <HBars items={(visitors?.pages || []).map((row) => ({ key: row.path, label: row.path, value: row.views }))} />
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Contenu du site" subtitle="Publié / total">
          <SimpleTable
            rows={data ? Object.entries(CONTENT).map(([key, label]) => ({ key, label, ...data.content[key] })) : []}
            rowKey={(row) => row.key}
            columns={[
              { label: "Section", render: (row) => row.label },
              { label: "Publiés", align: "right", render: (row) => row.published },
              { label: "Total", align: "right", render: (row) => row.total },
            ]}
          />
        </Panel>
        <Panel title="Exporter les listes" subtitle="Fichiers CSV lisibles dans Excel, pour la période choisie">
          <div className="export-list">
            {EXPORTS.map(([dataset, label]) => (
              <button key={dataset} className="button button-outline" onClick={() => exportList(dataset, label)}>
                <Download size={16} /> {label}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
