import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { loadingCount, onLoadingChange } from "../services/loading.js";
import { LOGO, CAP_CUT } from "./logoParts.js";

// Durées (ms) : affichage complet, puis disparition. « route » = changement de page.
const timings = {
  intro: { hold: 3300, reduced: 1200, leave: 600 },
  route: { hold: 1000, reduced: 300, leave: 350 },
};
// Sur un réseau lent, le logo reste affiché au plus ce temps après l’animation.
const MAX_WAIT = 15000;

function LogoPart({ clip }) {
  return (
    <image
      href={LOGO}
      width="411"
      height="431"
      clipPath={clip && `url(#${clip})`}
    />
  );
}

// Le logo se compose à chaque chargement du site, puis en version courte à
// chaque changement de page publique, et reste visible tant que la page charge.
export default function IntroSplash() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const isPublic = (path) => !path.startsWith("/admin");
  const [run, setRun] = useState({ id: 0, mode: "intro" });
  const [stage, setStage] = useState(() =>
    isPublic(pathname) ? "loading" : "done",
  );
  const lastPath = useRef(pathname);
  const active = stage !== "done";
  const timing = timings[run.mode];

  function skip() {
    setStage((current) => (current === "done" ? current : "leaving"));
  }

  useEffect(() => {
    // Le logo statique de index.html couvre le téléchargement du JavaScript.
    document.getElementById("boot-splash")?.remove();
  }, []);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (!isPublic(pathname)) return setStage("done");
    setRun((current) => ({ id: current.id + 1, mode: "route" }));
    setStage("loading");
  }, [pathname]);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", skip);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", skip);
    };
  }, [active]);

  useEffect(() => {
    const after = (delay, next) => {
      const timer = setTimeout(() => setStage(next), delay);
      return () => clearTimeout(timer);
    };
    if (stage === "loading") {
      // On attend le logo pour que l’animation ne démarre pas dans le vide.
      const image = new Image();
      const start = () =>
        setStage((current) => (current === "loading" ? "playing" : current));
      image.onload = image.onerror = start;
      image.src = LOGO;
      const fallback = setTimeout(start, 1500);
      return () => {
        image.onload = image.onerror = null;
        clearTimeout(fallback);
      };
    }
    if (stage === "playing") {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      return after(reduced ? timing.reduced : timing.hold, "waiting");
    }
    if (stage === "waiting") {
      if (!loadingCount()) return setStage("leaving");
      const stop = onLoadingChange((count) => count || setStage("leaving"));
      const limit = setTimeout(() => setStage("leaving"), MAX_WAIT);
      return () => {
        stop();
        clearTimeout(limit);
      };
    }
    if (stage === "leaving") return after(timing.leave, "done");
  }, [stage, run, timing]);

  if (!active) return null;
  return (
    <div
      key={run.id}
      className={`intro intro-${stage} intro-mode-${run.mode}`}
      aria-hidden="true"
      onClick={skip}
    >
      <div className="intro-stage">
        <svg className="intro-logo" viewBox="-8 -8 400 374">
          <defs>
            <clipPath id="intro-cap">
              <path d={`${CAP_CUT} V-8 H86Z`} />
            </clipPath>
            <clipPath id="intro-emblem">
              <path d={`${CAP_CUT} V240 H86Z`} />
            </clipPath>
            <clipPath id="intro-name">
              <rect x="-8" y="240" width="400" height="68" />
            </clipPath>
            <clipPath id="intro-center">
              <rect x="-8" y="312" width="400" height="52" />
            </clipPath>
            <filter id="intro-white">
              <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
            </filter>
            <mask id="intro-shape">
              <image
                href={LOGO}
                width="411"
                height="431"
                filter="url(#intro-white)"
              />
            </mask>
            <linearGradient id="intro-gleam-fill">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle className="intro-ripple" cx="186" cy="150" r="86" />
          <circle className="intro-ripple intro-ripple-late" cx="186" cy="150" r="86" />
          <g className="intro-emblem">
            <LogoPart clip="intro-emblem" />
          </g>
          <g className="intro-cap">
            <LogoPart clip="intro-cap" />
          </g>
          {/* Le texte monte derrière une fente fixe : seul son bandeau est visible. */}
          <g clipPath="url(#intro-name)">
            <g className="intro-rise intro-name">
              <LogoPart clip="intro-name" />
            </g>
          </g>
          <g clipPath="url(#intro-center)">
            <g className="intro-rise intro-center">
              <LogoPart clip="intro-center" />
            </g>
          </g>
          <g mask="url(#intro-shape)">
            <rect
              className="intro-gleam"
              x="-300"
              y="-8"
              width="150"
              height="374"
              fill="url(#intro-gleam-fill)"
            />
          </g>
        </svg>
        <p className="intro-tagline">
          {t("Apprenez aujourd’hui.")} <b>{t("Allez plus loin demain.")}</b>
        </p>
        <span className="intro-progress">
          <span />
        </span>
        <span className="intro-status">{t("Chargement…")}</span>
      </div>
      <span className="intro-skip">{t("Passer")}</span>
    </div>
  );
}
