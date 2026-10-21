import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";

// Premier bloc de l’accueil : diapositives gérées dans le menu « Accueil » de
// l’administration (image ou vidéo de fond, textes, bouton).
const DELAY = 7000;

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function SlideLink({ href, className, children }) {
  // Les pages du site restent dans l’application ; le reste est un lien classique.
  if (href.startsWith("/") && !href.includes("#"))
    return (
      <Link className={className} to={href}>
        {children}
      </Link>
    );
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      className={className}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function SlideMedia({ slide, active, first, reduced }) {
  const video = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) element.play().catch(() => {});
    else element.pause();
  }, [active]);
  return (
    <div className="hero-slide-media" aria-hidden="true">
      {slide.imageUrl && !imageFailed && (
        <img
          src={slide.imageUrl}
          alt=""
          fetchPriority={first ? "high" : undefined}
          onError={() => setImageFailed(true)}
        />
      )}
      {/* Mouvement réduit demandé : l’image remplace la vidéo. */}
      {slide.videoUrl && !reduced && (
        <video
          ref={video}
          src={slide.videoUrl}
          poster={slide.imageUrl || undefined}
          muted
          loop
          playsInline
          preload={first ? "auto" : "metadata"}
        />
      )}
    </div>
  );
}

export default function HeroCarousel({ slides, secondaryLabel }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const touchStart = useRef(null);
  const reduced = usePrefersReducedMotion();
  const count = slides.length;
  const current = Math.min(index, count - 1);
  // Pas de défilement automatique si le visiteur lit, a mis en pause,
  // a quitté l’onglet ou préfère réduire les animations.
  const playing = count > 1 && !hovered && !stopped && !hidden && !reduced;
  const go = (next) => setIndex((next + count) % count);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIndex((value) => (value + 1) % count), DELAY);
    return () => clearTimeout(timer);
  }, [playing, current, count]);

  return (
    <section
      id="accueil"
      className="hero-carousel section-anchor"
      aria-roledescription="carrousel"
      aria-label="À la une"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(current - 1);
        if (event.key === "ArrowRight") go(current + 1);
      }}
      // Glisser du doigt (au moins 50 px, plus horizontal que vertical).
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        if (!touchStart.current || count < 2) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.current.x;
        const dy = touch.clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
          go(current + (dx < 0 ? 1 : -1));
      }}
    >
      <h1 className="sr-only">
        AL-HAKIM CENTER, centre de formation à Djibouti
      </h1>
      {slides.map((slide, position) => {
        const active = position === current;
        return (
          <div
            key={slide._id}
            className={active ? "hero-slide is-active" : "hero-slide"}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${position + 1} sur ${count}`}
            aria-hidden={!active}
            inert={!active}
          >
            <SlideMedia
              slide={slide}
              active={active}
              first={position === 0}
              reduced={reduced}
            />
            <div className="container hero-slide-content">
              {slide.eyebrow && (
                <span className="eyebrow">
                  <span className="eyebrow-line" /> {slide.eyebrow}
                </span>
              )}
              <h2>
                {slide.title}
                {slide.accent && (
                  <>
                    <br />
                    <span>{slide.accent}</span>
                  </>
                )}
              </h2>
              {slide.description && (
                <p className="hero-description">{slide.description}</p>
              )}
              <div className="hero-actions">
                {slide.buttonLabel && slide.buttonLink && (
                  <SlideLink className="button" href={slide.buttonLink}>
                    {slide.buttonLabel} <ArrowUpRight size={19} />
                  </SlideLink>
                )}
                <Link className="text-link" to="/contact">
                  {secondaryLabel} <ArrowRight size={17} />
                </Link>
              </div>
              {slide.body && (
                <p className="hero-note">
                  <span className="check-circle">
                    <Check size={12} />
                  </span>{" "}
                  {slide.body}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {count > 1 && (
        <div className="container hero-controls">
          <div className="hero-pager" role="group" aria-label="Diapositives">
            {slides.map((slide, position) => (
              <button
                key={slide._id}
                type="button"
                className={position === current ? "is-active" : ""}
                aria-label={`Diapositive ${position + 1} : ${slide.title}`}
                aria-current={position === current ? "true" : undefined}
                onClick={() => go(position)}
              >
                {/* La barre suit le minuteur : elle repart de zéro à chaque reprise. */}
                {position === current && playing && (
                  <span key={current} className="hero-progress" />
                )}
              </button>
            ))}
          </div>
          <div className="hero-buttons">
            {!reduced && (
              <button
                type="button"
                onClick={() => setStopped(!stopped)}
                aria-label={
                  stopped ? "Reprendre le défilement" : "Mettre en pause le défilement"
                }
              >
                {stopped ? <Play size={17} /> : <Pause size={17} />}
              </button>
            )}
            <button
              type="button"
              className="hero-arrow"
              onClick={() => go(current - 1)}
              aria-label="Diapositive précédente"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="hero-arrow"
              onClick={() => go(current + 1)}
              aria-label="Diapositive suivante"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
