import { useId } from "react";
import { LOGO, CAP_CUT } from "./logoParts.js";

// Emblème animé (toque qui se soulève, anneau qui tourne) pendant un chargement.
export default function LogoLoader({ label }) {
  const id = useId().replaceAll(":", "");
  return (
    <span className="logo-loader" role="status">
      <svg viewBox="70 -6 232 256" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-cap`}>
            <path d={`${CAP_CUT} V-8 H86Z`} />
          </clipPath>
          <clipPath id={`${id}-emblem`}>
            <path d={`${CAP_CUT} V240 H86Z`} />
          </clipPath>
        </defs>
        <circle className="logo-loader-track" cx="186" cy="150" r="98" />
        <circle
          className="logo-loader-arc"
          cx="186"
          cy="150"
          r="98"
          pathLength="100"
        />
        <image
          href={LOGO}
          width="411"
          height="431"
          clipPath={`url(#${id}-emblem)`}
        />
        <g className="logo-loader-cap">
          <image
            href={LOGO}
            width="411"
            height="431"
            clipPath={`url(#${id}-cap)`}
          />
        </g>
      </svg>
      {label && <span className="logo-loader-label">{label}</span>}
    </span>
  );
}
