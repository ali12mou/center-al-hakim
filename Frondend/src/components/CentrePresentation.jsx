import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Pause, Play, Target } from "lucide-react";

export default function CentrePresentation({ about, slides, contactHref = "/contact" }) {
  const items = (slides ?? [{ ...about, body: about.mission, imageUrl: "/images/centre.jpg", buttonLabel: "Faisons connaissance", buttonLink: contactHref }])
    .filter(item => item.published !== false).slice().sort((a,b) => (a.order || 0) - (b.order || 0));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (paused || engaged || focused || reduced || !visible || items.length < 2) return;
    const timer = setInterval(() => setIndex(value => (value + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [paused, engaged, focused, reduced, visible, index, items.length]);
  if (!items.length) return null;
  const active = index % items.length;
  const item = items[active];
  const move = delta => setIndex((active + delta + items.length) % items.length);
  const href = item.buttonLink || contactHref;
  const button = <>{item.buttonLabel || "Faisons connaissance"}<ArrowUpRight size={18} /></>;
  return (
    <section id="centre" className="section centre-stories section-anchor" aria-label="Découvrir le centre" aria-roledescription="carrousel"
      onMouseEnter={() => setEngaged(true)} onMouseLeave={() => setEngaged(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="container">
        <div className="centre-stories-heading"><span>AL-HAKIM CENTER</span><span>APPRENDRE. ÉVOLUER. AVANCER.</span></div>
        <div className="centre-story" key={item._id || active} role="group" aria-roledescription="diapositive" aria-label={`${active + 1} sur ${items.length}`}>
          <div className="centre-story-photo">
            <img src={item.imageUrl || "/images/centre.jpg"} alt="" loading="lazy" onError={event => { if (!event.currentTarget.src.endsWith('/images/centre.jpg')) event.currentTarget.src='/images/centre.jpg'; }} />
            <span className="centre-story-badge"><span /> Formation · Langues · Technologie</span>
            <div className="centre-story-caption"><span>VOTRE AMBITION, NOTRE POINT DE DÉPART</span><strong>Learn today.<br />Lead tomorrow.</strong><small>Visuel d’illustration</small></div>
          </div>
          <div className="centre-story-content">
            <span className="eyebrow">{item.eyebrow || "DÉCOUVREZ LE CENTRE"}</span>
            <h2>{item.title} {item.accent && <span>{item.accent}</span>}</h2>
            <p className="centre-story-description">{item.description}</p>
            {item.body && <div className="centre-story-mission"><Target size={21} /><div><strong>Notre engagement</strong><p>{item.body}</p></div></div>}
            {item.values?.length > 0 && <ul className="centre-story-values">{item.values.map((value,i) => <li key={i}><Check size={15} />{value}</li>)}</ul>}
            {href.startsWith('/') && !href.startsWith('//') ? <Link className="button centre-story-cta" to={href}>{button}</Link> : <a className="button centre-story-cta" href={/^https?:\/\//i.test(href) || href.startsWith('#') ? href : contactHref}>{button}</a>}
          </div>
        </div>
        {items.length > 1 && <div className="centre-story-controls">
          <div className="centre-story-tabs" aria-label="Choisir une présentation">{items.map((slide,i) => <button type="button" key={slide._id || i} onClick={() => setIndex(i)} aria-label={`Présentation ${i+1} : ${slide.title}`} aria-pressed={i===active} className={i===active ? 'is-active' : ''}><span>{String(i+1).padStart(2,'0')}</span><span>{slide.eyebrow || slide.title}</span></button>)}</div>
          <div className="centre-story-arrows"><span aria-live={engaged || paused ? 'polite' : 'off'}>{String(active+1).padStart(2,'0')} / {String(items.length).padStart(2,'0')}</span>
            <button type="button" onClick={() => move(-1)} aria-label="Présentation précédente"><ChevronLeft size={19} /></button>
            {!reduced && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Reprendre le défilement des présentations" : "Mettre en pause les présentations"}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>}
            <button type="button" onClick={() => move(1)} aria-label="Présentation suivante"><ChevronRight size={19} /></button>
          </div>
        </div>}
      </div>
    </section>
  );
}
