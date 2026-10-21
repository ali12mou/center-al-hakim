import { BookOpen, Users, Clock3, MapPin } from "lucide-react";
import HeroCarousel from "../components/HeroCarousel.jsx";

const icons = { BookOpen, Users, Clock3, MapPin };
export default function Home({ content, slides = [] }) {
  const { hero, benefits } = content;
  // Sans diapositive publiée, le bloc reprend le texte d’accueil par défaut.
  const shown = slides.length
    ? slides
    : [
        {
          _id: "accueil",
          eyebrow: hero.eyebrow,
          title: hero.title,
          accent: hero.accent,
          description: hero.description,
          body: hero.note,
          buttonLabel: hero.primary,
          buttonLink: "/formations",
          imageUrl: "/images/hero-classroom.jpg",
        },
      ];
  return (
    <>
      <HeroCarousel slides={shown} secondaryLabel={hero.secondary} />
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
