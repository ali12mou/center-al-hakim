import ListPage from "../../components/ListPage.jsx";
import { StatusPill } from "../../components/ui.jsx";
import { invalidateLookup } from "../../hooks/useRemote.js";
import { money } from "../../lib/format.js";

const activeCell = (item) => <StatusPill status={item.active ? "active" : "inactive"} label={item.active ? "Actif" : "Désactivé"} />;

export function DiscountsPage() {
  return (
    <ListPage
      kicker="FINANCES · FRAIS DE FORMATION"
      title="Remises et réductions"
      description="Les remises autorisées (fratrie, étudiant, groupe d’entreprise…), en pourcentage ou en montant fixe."
      endpoint="/finance/discounts"
      section="finance.discounts"
      search="Nom de la remise…"
      createLabel="Nouvelle remise"
      onChanged={() => invalidateLookup("discounts")}
      columns={[
        { label: "Remise", render: (item) => <strong>{item.name}</strong> },
        { label: "Valeur", align: "right", render: (item) => (item.kind === "percent" ? `${item.value} %` : money(item.value)) },
        { label: "Conditions", render: (item) => item.description || "—" },
        { label: "État", render: activeCell },
      ]}
      createDefaults={{ active: true, kind: "percent" }}
      form={{
        title: "remise",
        fields: [
          { key: "name", label: "Nom", required: true, placeholder: "Ex. : Réduction fratrie" },
          { key: "kind", label: "Type", type: "select", options: [["percent", "Pourcentage du prix"], ["fixed", "Montant fixe"]] },
          { key: "value", label: "Valeur", type: "number", min: 0, step: 1, required: true, hint: (values) => (values.kind === "percent" ? "En %, de 0 à 100." : "En francs Djibouti.") },
          { key: "description", label: "Conditions d’attribution", type: "textarea" },
          { key: "active", label: "Remise active", type: "checkbox" },
        ],
      }}
    />
  );
}
