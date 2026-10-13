import {
  ArrowUpRight,
  Check,
  BriefcaseBusiness,
  Users,
  TrendingUp,
} from "lucide-react";

export default function Entreprises({ content, onRequest }) {
  const data = content.enterprise;
  return (
    <section id="entreprises" className="enterprise section-anchor">
      <div className="container">
        <div className="enterprise-panel">
          <div className="enterprise-content">
            <span className="eyebrow">{data.eyebrow}</span>
            <h2>{data.title}</h2>
            <p>{data.description}</p>
            <ul className="check-list">
              {data.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} /> {feature}
                </li>
              ))}
            </ul>
            <button className="button button-white" onClick={onRequest}>
              {data.action} <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="enterprise-art" aria-hidden="true">
            <span className="art-ring ring-one" />
            <span className="art-ring ring-two" />
            <div className="art-card art-card-one">
              <BriefcaseBusiness size={28} />
              <span>
                Des équipes
                <br />
                <b>mieux préparées.</b>
              </span>
            </div>
            <div className="art-card art-card-two">
              <TrendingUp size={29} />
              <span>
                Des compétences
                <br />
                <b>qui font la différence.</b>
              </span>
            </div>
            <span className="art-circle">
              <Users size={49} strokeWidth={1.3} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
