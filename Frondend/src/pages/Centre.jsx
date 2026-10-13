import {
  ArrowUpRight,
  Check,
  Target,
  Languages,
  BriefcaseBusiness,
  Monitor,
  ChartNoAxesCombined,
} from "lucide-react";

const icons = { Languages, BriefcaseBusiness, Monitor, ChartNoAxesCombined };
export default function Centre({ content, departments, onDepartment }) {
  const { about, steps } = content;
  return (
    <>
      <section id="centre" className="section about section-anchor">
        <div className="container about-grid">
          <div className="about-visual">
            <img
              src="/images/centre.jpg"
              alt="Illustration d’un groupe d’apprenants échangeant ensemble"
              loading="lazy"
              width="1000"
              height="800"
            />
            <span className="about-caption">
              LEARN TODAY.
              <br />
              <b>LEAD TOMORROW.</b>
              <span>Notre ambition pour chaque apprenant.</span>
            </span>
            <span className="about-illustration">Visuel d’illustration</span>
          </div>
          <div className="about-content">
            <span className="eyebrow">{about.eyebrow}</span>
            <h2>
              {about.title}
              <br />
              <span>{about.accent}</span>
            </h2>
            <p>{about.description}</p>
            <div className="mission">
              <Target size={23} />
              <p>
                <strong>Notre mission</strong>
                {about.mission}
              </p>
            </div>
            <ul className="value-list">
              {about.values.map((value) => (
                <li key={value}>
                  <Check size={16} /> {value}
                </li>
              ))}
            </ul>
            <a className="text-link" href="#contact">
              Faisons connaissance <ArrowUpRight size={17} />
            </a>
          </div>
        </div>
      </section>
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
                    <ArrowUpRight size={19} />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section journey">
        <div className="container">
          <span className="eyebrow">
            UN PARCOURS SIMPLE, DES OBJECTIFS CLAIRS
          </span>
          <h2>De votre envie à votre prochaine étape.</h2>
          <div className="steps">
            {steps.map((step) => (
              <div className="step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
