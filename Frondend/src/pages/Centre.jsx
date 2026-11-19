import CentrePresentation from "../components/CentrePresentation.jsx";
import {
  ArrowUpRight,
  Languages,
  BriefcaseBusiness,
  Monitor,
  ChartNoAxesCombined,
  Compass,
  MessagesSquare,
  Rocket,
} from "lucide-react";

const icons = { Languages, BriefcaseBusiness, Monitor, ChartNoAxesCombined };
// Sur l’accueil, ces trois blocs se suivent ; les pages Le centre, Nos
// formations et Entreprises les reprennent séparément.
export default function Centre({ content, departments, onDepartment, presentations }) {
  return (
    <>
      <CentreAbout about={content.about} slides={presentations} />
      <Departments departments={departments} onDepartment={onDepartment} />
      <Journey steps={content.steps} />
    </>
  );
}
export function CentreAbout(props) { return <CentrePresentation {...props} />; }
export function Departments({ departments, onDepartment }) {
  return (
    <section className="section departments-section">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">QUATRE PÔLES, UN MÊME OBJECTIF</span>
            <h2>Faire avancer votre avenir.</h2>
          </div>
          <p className="heading-aside">
            Des parcours complémentaires,
            <br />
            pensés pour vos ambitions.
          </p>
        </div>
        <div className="department-grid">
          {departments.map((department, index) => {
            const Icon = icons[department.icon];
            return (
              <a
                className={`department department-${department.color}`}
                key={department.id}
                href="#formations"
                onClick={(event) => {
                  event.preventDefault();
                  onDepartment(department.id);
                }}
              >
                <span className="department-top">
                  <Icon size={48} strokeWidth={1.6} aria-hidden="true" />
                  <span>0{index + 1}</span>
                </span>
                <span className="department-name">{department.name}</span>
                <h3>{department.title}</h3>
                <p>{department.description}</p>
                <span className="department-arrow">
                  Explorer les formations
                  <ArrowUpRight size={19} />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
export function Journey({
  steps,
  eyebrow = "UN PARCOURS SIMPLE, DES OBJECTIFS CLAIRS",
  title = "De votre envie à votre prochaine étape.",
}) {
  return (
    <section className="section journey">
      <div className="container">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <div className="steps">
          {steps.map((step,index) => {const StepIcon=[Compass,MessagesSquare,Rocket][index%3];return (
            <div className="step" key={step.number}>
              <div className="journey-step-top"><span className="step-number">{step.number}</span><StepIcon size={28} strokeWidth={1.5}/></div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          );})}
        </div>
      </div>
    </section>
  );
}
