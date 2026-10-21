import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import Brand from "./Brand.jsx";
import { whatsappLink } from "./whatsapp.js";

export default function Footer({ centre, departments, onPrivacy, onLegal }) {
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
            <Link to="/formations">Nos formations</Link>
            <Link to="/centre">Notre mission</Link>
            <Link to="/entreprises">Formations entreprises</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/inscription">
              Préinscription <ArrowUpRight size={13} />
            </Link>
          </div>
          <div>
            <h3>Nos domaines</h3>
            {departments.map((department) => (
              <Link to={`/formations?pole=${department.id}`} key={department.id}>
                {department.name}
              </Link>
            ))}
          </div>
          <div>
            <h3>Restons en contact</h3>
            <a href={`tel:${centre.phoneLink}`}>
              <Phone size={14} /> {centre.phone}
            </a>
            <a href={`mailto:${centre.email}`}>
              <Mail size={14} /> {centre.email}
            </a>
            <a
              href={whatsappLink(centre)}
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
            <a
              href="#contenu"
              onClick={(event) => {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Retour en haut ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
