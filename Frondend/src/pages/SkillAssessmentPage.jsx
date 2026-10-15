import { useState } from "react";
import { ClipboardCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import PublicationCard, {
  EmptyPublications,
} from "../components/PublicationCard.jsx";
import { submitAssessment } from "../services/api.js";

export default function SkillAssessmentPage() {
  const { data, error } = usePublicSite();
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    const values = new FormData(event.currentTarget);
    try {
      setResult(
        await submitAssessment(selected._id, {
          name: values.get("name"),
          email: values.get("email"),
          phone: values.get("phone") || "",
          answers: selected.questions.map((_, index) =>
            Number(values.get(`answer-${index}`)),
          ),
          consent: values.get("consent") === "on",
        }),
      );
    } catch (error) {
      setFailure(error.message);
    } finally {
      setBusy(false);
    }
  }
  const items = data?.portal?.assessments || [];
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="SKILL ASSESSMENT · ORIENTATION"
      title="Faites le point sur vos compétences."
      description="Une évaluation indicative pour vous orienter vers un parcours adapté. Les réponses sont évaluées par le centre."
    >
      <section className="section">
        <div className="container">
          {result ? (
            <div className="assessment-result">
              <CheckCircle2 size={45} />
              <span className="eyebrow">VOTRE POINT DE DÉPART</span>
              <h2>
                {result.score} / {result.total} bonnes réponses
              </h2>
              <strong>{result.percentage} %</strong>
              <p>{result.recommendation}</p>
              <small>{result.note}</small>
              <a className="button" href="/courses">
                Découvrir les formations <ArrowRight size={17} />
              </a>
              <button
                className="text-link"
                onClick={() => {
                  setResult(null);
                  setSelected(null);
                }}
              >
                Revenir aux évaluations
              </button>
            </div>
          ) : selected ? (
            <form className="assessment-form" onSubmit={submit}>
              <div className="assessment-heading">
                <ClipboardCheck size={33} />
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Nom complet</span>
                  <input name="name" required minLength={2} maxLength={100} />
                </label>
                <label>
                  <span>E-mail</span>
                  <input name="email" type="email" required maxLength={254} />
                </label>
                <label className="full-width">
                  <span>Téléphone (facultatif)</span>
                  <input name="phone" type="tel" maxLength={30} />
                </label>
              </div>
              {selected.questions.map((question, index) => (
                <fieldset key={index} className="assessment-question">
                  <legend>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {question.prompt}
                  </legend>
                  {question.choices.map((choice, option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={`answer-${index}`}
                        value={option}
                        required
                      />
                      {choice}
                    </label>
                  ))}
                </fieldset>
              ))}
              <label className="consent">
                <input type="checkbox" name="consent" required />
                <span>
                  J’accepte que ces informations et mes réponses servent à mon
                  orientation par le centre.
                </span>
              </label>
              {failure && (
                <p className="admin-error" role="alert">
                  {failure}
                </p>
              )}
              <div className="assessment-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setSelected(null)}
                >
                  Retour
                </button>
                <button className="button" disabled={busy}>
                  {busy ? "Évaluation en cours…" : "Voir mon résultat"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="publication-grid">
                {items.map((item) => (
                  <PublicationCard
                    item={item}
                    key={item._id}
                    icon={ClipboardCheck}
                    action="Commencer l’évaluation"
                    onView={data.registrationsAvailable ? setSelected : null}
                  />
                ))}
                {!items.length && <EmptyPublications />}
              </div>
              {!data?.registrationsAvailable && (
                <p className="assessment-availability">
                  L’évaluation en ligne sera disponible prochainement. Contactez
                  le centre pour faire le point sur votre niveau.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </PublicPageLayout>
  );
}
