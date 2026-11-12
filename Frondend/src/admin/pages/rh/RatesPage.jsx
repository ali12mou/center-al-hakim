import ListPage from "../../components/ListPage.jsx";
import { PersonCell } from "../../components/ui.jsx";
import { PAY_TYPES, PAYMENT_METHODS, money } from "../../lib/format.js";
import { payFields } from "./fields.js";

const amount = (item) =>
  item.payType === "hourly" ? `${money(item.hourlyRate)} / heure` : item.payType === "flat" ? `${money(item.flatAmount)} / mois (forfait)` : `${money(item.monthlySalary)} / mois`;

export default function RatesPage() {
  return (
    <ListPage
      kicker="RESSOURCES HUMAINES · PAIE"
      title="Tarifs horaires et salaires"
      description="Le tarif horaire des enseignants, le salaire des employés mensualisés ou le forfait convenu : la base du calcul des rémunérations."
      endpoint="/rh/rates"
      section="rh.rates"
      search="Nom de la personne…"
      creatable={false}
      deletable={() => false}
      exportName="tarifs-et-salaires"
      filters={[{ key: "kind", label: "Type", options: [["", "Enseignants et employés"], ["teacher", "Enseignants"], ["employee", "Employés"]] }]}
      columns={[
        { label: "Personne", render: (item) => <PersonCell name={item.fullName} detail={`${item.reference} · ${item.position || item.specialty || (item.kind === "teacher" ? "Enseignant" : "Employé")}`} />, csv: (item) => item.fullName },
        { label: "Type", render: (item) => (item.kind === "teacher" ? "Enseignant" : "Employé"), csv: (item) => item.kind },
        { label: "Rémunération", render: (item) => PAY_TYPES[item.payType], csv: (item) => PAY_TYPES[item.payType] },
        { label: "Montant", align: "right", render: (item) => <b>{amount(item)}</b>, csv: (item) => amount(item) },
        { label: "Versement", render: (item) => `${PAYMENT_METHODS[item.paymentMethod]}${item.paymentAccount ? ` · ${item.paymentAccount}` : ""}`, csv: (item) => PAYMENT_METHODS[item.paymentMethod] },
      ]}
      form={{ title: "rémunération", fields: payFields.slice(1) }}
    />
  );
}
