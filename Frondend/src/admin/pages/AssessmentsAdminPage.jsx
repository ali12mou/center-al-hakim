import { useState } from "react";
import ResourcePage from "./ResourcePage.jsx";
import AssessmentResultsPage from "./AssessmentResultsPage.jsx";

export default function AssessmentsAdminPage() {
  const [tab, setTab] = useState("tests");
  return (
    <>
      <div className="admin-section-tabs">
        <button
          className={tab === "tests" ? "active" : ""}
          onClick={() => setTab("tests")}
        >
          Tests & publications
        </button>
        <button
          className={tab === "results" ? "active" : ""}
          onClick={() => setTab("results")}
        >
          Résultats des apprenants
        </button>
      </div>
      {tab === "tests" ? (
        <ResourcePage resource="assessments" />
      ) : (
        <AssessmentResultsPage />
      )}
    </>
  );
}
