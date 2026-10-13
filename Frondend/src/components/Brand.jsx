export default function Brand({ light = false }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <svg
        className="brand-mark"
        viewBox="89 0 192 234"
        role="img"
        aria-label="Logo AL-HAKIM CENTER"
      >
        {/* Le cadrage affiche le symbole du logo original sans modifier le fichier. */}
        <image href="/Untitled-2.png" x="0" y="0" width="411" height="431" />
      </svg>
      <span className="brand-type">
        <span>
          AL-HAKIM <b>CENTER</b>
        </span>
        <small>FORMATION · LANGUES · TECHNOLOGIE</small>
      </span>
    </span>
  );
}
