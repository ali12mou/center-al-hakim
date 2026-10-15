import { ArrowUpRight, MapPin, Phone } from "lucide-react";
import Brand from "./Brand.jsx";

export default function Footer({
  centre,
  departments,
  onPrivacy,
  onLegal,
  onDepartment,
}) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/#accueil" aria-label="Retour à l’accueil">
              <Brand light />
            </a>
            <p>
              Des compétences pour aujourd’hui.
              <br />
              Des perspectives pour demain.
            </p>
            <span className="footer-slogan">{centre.slogan}</span>
          </div>
          <div>
            <h3>Explorez le centre</h3>
            <a href="#formations">Nos formations</a>
            <a href="#centre">Notre mission</a>
            <a href="#entreprises">Formations entreprises</a>
            <a href="#contact">
              Préinscription <ArrowUpRight size={13} />
            </a>
          </div>
          <div>
            <h3>Nos domaines</h3>
            {departments.map((department) => (
              <a
                href="#formations"
                key={department.id}
                onClick={(event) => {
                  event.preventDefault();
                  onDepartment(department.id);
                }}
              >
                {department.name}
              </a>
            ))}
          </div>
          <div>
            <h3>Restons en contact</h3>
            <a href={`tel:${centre.phoneLink}`}>
              <Phone size={14} /> {centre.phone}
            </a>
            <a
              href={`https://wa.me/${centre.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp <ArrowUpRight size={14} />
            </a>
            <p className="footer-address">
              <MapPin size={14} />
              <span>
                {centre.address}
                <br />
                {centre.landmark}
              </span>
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} AL-HAKIM CENTER. Tous droits réservés.
          </span>
          <div>
            <button onClick={onLegal}>Informations du centre</button>
            <button onClick={onPrivacy}>Confidentialité</button>
            <a href="/admin/login">Administration</a>
            <a href="#accueil">Retour en haut ↑</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
