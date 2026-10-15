import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { adminApi } from "../services/adminApi.js";
import { dateLabel } from "../config/sections.js";

export default function AssessmentResultsPage() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    adminApi("/resources/attempts?limit=100")
      .then(setData)
      .catch((failure) => setError(failure.message));
  }, []);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">ORIENTATION DES APPRENANTS</span>
          <h1>Résultats des évaluations</h1>
          <p>
            {data.total} évaluation{data.total > 1 ? "s" : ""} enregistrée
            {data.total > 1 ? "s" : ""}.
          </p>
        </div>
        <ClipboardCheck size={35} />
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="dashboard-panel">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom complet</th>
                <th>E-mail</th>
                <th>Téléphone</th>
                <th>Résultat</th>
                <th>Date</th>
                <th>Orientation</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.phone || "—"}</td>
                  <td>
                    {item.score} / {item.total}
                  </td>
                  <td>{dateLabel(item.createdAt)}</td>
                  <td>{item.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length && (
          <p className="dashboard-zero">
            Les résultats apparaîtront après les premières évaluations.
          </p>
        )}
      </div>
    </>
  );
}
