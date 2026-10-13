import {
  ArrowUpRight,
  ArrowRight,
  Check,
  BookOpen,
  Users,
  Clock3,
  MapPin,
  Sparkles,
} from "lucide-react";

const icons = { BookOpen, Users, Clock3, MapPin };
export default function Home({ content, centre }) {
  const { hero, benefits } = content;
  return (
    <>
      <section id="accueil" className="hero section-anchor">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="eyebrow-line" /> {hero.eyebrow}
            </span>
            <h1>
              {hero.title}
              <br />
              <span>{hero.accent}</span>
            </h1>
            <p className="hero-description">{hero.description}</p>
            <div className="hero-actions">
              <a href="#formations" className="button">
                {hero.primary} <ArrowUpRight size={19} />
              </a>
              <a className="text-link" href="#contact">
                {hero.secondary} <ArrowRight size={17} />
              </a>
            </div>
            <p className="hero-note">
              <span className="check-circle">
                <Check size={12} />
              </span>{" "}
              {hero.note}
            </p>
            <div className="hero-numbers">
              <div>
                <strong>
                  04<span> pôles</span>
                </strong>
                <small>Pour développer vos compétences</small>
              </div>
              <span className="number-divider" />
              <div>
                <strong>
                  04<span> langues</span>
                </strong>
                <small>Pour élargir vos horizons</small>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-dots" aria-hidden="true" />
            <div className="hero-photo-wrap">
              <img
                className="hero-photo"
                src="/images/hero-classroom.jpg"
                alt="Illustration de jeunes adultes apprenant ensemble autour d’un ordinateur"
                width="1536"
                height="1024"
                fetchPriority="high"
              />
              <span className="image-note">{content.imageNote}</span>
              <div className="photo-label">
                <span />
                <span>Apprendre. Pratiquer. Progresser.</span>
              </div>
            </div>
            <div className="hero-float">
              <span className="float-icon">
                <Sparkles size={22} />
              </span>
              <div>
                <strong>Votre potentiel, sans limites.</strong>
                <span>Une compétence à la fois.</span>
              </div>
            </div>
            <div className="hero-place">
              <MapPin size={14} /> Balbala, Djibouti
            </div>
          </div>
        </div>
      </section>
      <div className="benefits">
        <div className="container benefits-grid">
          {benefits.map((item) => {
            const Icon = icons[item.icon];
            return (
              <div className="benefit" key={item.title}>
                <span className="benefit-icon">
                  <Icon size={23} strokeWidth={1.6} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
