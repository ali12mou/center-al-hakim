import {
  ArrowUpRight,
  Phone,
  Mail,
  MapPin,
  Clock3,
  MessageCircle,
} from "lucide-react";
import { whatsappLink } from "../components/whatsapp.js";
import RequestForm from "../components/RequestForm.jsx";

export default function Contact({
  centre,
  courses,
  departments = [],
  registrationsAvailable,
  request,
  onPrivacy,
}) {
  return (
    <section id="contact" className="section contact section-anchor">
      <div className="container contact-grid">
        <div className="contact-info">
          <span className="eyebrow">UNE QUESTION ? UN PROJET ?</span>
          <h2>
            Parlons de
            <br />
            <span>votre avenir.</span>
          </h2>
          <p>
            Vous hésitez entre deux parcours ou souhaitez en savoir plus ?
            Échangeons sur vos objectifs.
          </p>
          <a className="contact-item" href={`tel:${centre.phoneLink}`}>
            <span className="contact-icon">
              <Phone size={21} />
            </span>
            <span>
              <small>Appelez-nous</small>
              <strong>{centre.phone}</strong>
            </span>
            <ArrowUpRight size={18} />
          </a>
          <a className="contact-item" href={`mailto:${centre.email}`}>
            <span className="contact-icon">
              <Mail size={21} />
            </span>
            <span>
              <small>Envoyez-nous un e-mail</small>
              <strong>{centre.email}</strong>
            </span>
            <ArrowUpRight size={18} />
          </a>
          <a
            className="contact-item"
            href={whatsappLink(centre)}
            target="_blank"
            rel="noreferrer"
          >
            <span className="contact-icon whatsapp-icon">
              <MessageCircle size={22} />
            </span>
            <span>
              <small>Écrivez-nous</small>
              <strong>Discuter sur WhatsApp</strong>
            </span>
            <ArrowUpRight size={18} />
          </a>
          <a
            className="contact-item"
            href="https://www.google.com/maps/search/?api=1&query=Balbala+Avenue+principale+Arta+GAX+Assurance+Djibouti"
            target="_blank"
            rel="noreferrer"
          >
            <span className="contact-icon">
              <MapPin size={22} />
            </span>
            <span>
              <small>Retrouvez le centre</small>
              <strong>{centre.address}</strong>
              <span className="address-note">{centre.landmark}</span>
            </span>
            <ArrowUpRight size={18} />
          </a>
          <div className="contact-availability">
            <Clock3 size={15} />
            <span>
              Les dates et horaires des sessions sont confirmés avec le centre.
            </span>
          </div>
        </div>
        <RequestForm
          centre={centre}
          courses={courses}
          departments={departments}
          registrationsAvailable={registrationsAvailable}
          request={request}
          onPrivacy={onPrivacy}
        />
      </div>
    </section>
  );
}
