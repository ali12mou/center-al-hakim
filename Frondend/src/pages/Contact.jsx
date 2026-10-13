import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Phone,
  MapPin,
  Clock3,
  MessageCircle,
  CheckCircle2,
  Send,
  AlertCircle,
} from "lucide-react";
import { sendRequest } from "../services/api.js";

export default function Contact({
  centre,
  courses,
  registrationsAvailable,
  request,
  onPrivacy,
}) {
  const [kind, setKind] = useState("registration");
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (request) {
      setKind(request.kind);
      setCourseId(request.courseId || "");
      setResult(null);
      setError("");
    }
  }, [request]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const data = {
      ...values,
      kind,
      courseId: kind === "registration" ? courseId : "",
      consent: values.consent === "on",
    };
    if (registrationsAvailable) {
      setBusy(true);
      try {
        const saved = await sendRequest(data);
        setResult({ type: "saved", ...saved });
      } catch (failure) {
        setError(
          `${failure.message} Vous pouvez également contacter le centre via WhatsApp.`,
        );
      } finally {
        setBusy(false);
      }
    } else {
      const course = courses.find((item) => item.id === courseId);
      const message = `Bonjour AL-HAKIM CENTER,\n\n${kind === "enterprise" ? "Je souhaite discuter d’une formation pour mon entreprise." : kind === "contact" ? "Je souhaite obtenir des renseignements." : `Je suis intéressé(e) par la formation : ${course?.title}.`}\nNom : ${data.name}\nE-mail : ${data.email}\nTéléphone : ${data.phone}\nDisponibilité : ${data.schedule}\n\n${data.message}\n\nJe souhaite connaître les dates, tarifs et modalités.`;
      setResult({
        type: "whatsapp",
        url: `https://wa.me/${centre.whatsapp}?text=${encodeURIComponent(message)}`,
      });
    }
  }
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
          <a
            className="contact-item"
            href={`https://wa.me/${centre.whatsapp}`}
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
        <form
          className="contact-form"
          onSubmit={submit}
          onChange={() => {
            setResult(null);
            setError("");
          }}
        >
          <h3>Faisons le premier pas.</h3>
          <p>Présentez-nous votre projet en quelques mots.</p>
          <div className="form-kind" role="group" aria-label="Type de demande">
            {[
              ["registration", "Une formation"],
              ["enterprise", "Mon entreprise"],
              ["contact", "Une question"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={kind === value ? "selected" : ""}
                key={value}
                onClick={() => {
                  setKind(value);
                  setResult(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label>
              <span>
                Nom complet <em>*</em>
              </span>
              <input
                name="name"
                autoComplete="name"
                placeholder="Votre nom et prénom"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label>
              <span>
                Téléphone <em>*</em>
              </span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+253 …"
                required
                minLength={6}
                maxLength={30}
                pattern="[+0-9 ]{6,30}"
              />
            </label>
            <label className="full-width">
              <span>
                Adresse e-mail <em>*</em>
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                required
                maxLength={254}
              />
            </label>
            {kind === "registration" && (
              <label className="full-width">
                <span>
                  La formation qui vous intéresse <em>*</em>
                </span>
                <select
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  required
                  name="courseId"
                >
                  <option value="">Choisir une formation</option>
                  {courses.map((course) => (
                    <option value={course.id} key={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-width">
              <span>Votre disponibilité</span>
              <select name="schedule" defaultValue="flexible">
                <option value="flexible">À définir ensemble</option>
                <option value="matin">Le matin</option>
                <option value="soir">Le soir</option>
                <option value="week-end">Le week-end</option>
              </select>
            </label>
            <label className="full-width">
              <span>
                Votre message <em>*</em>
              </span>
              <textarea
                name="message"
                placeholder={
                  kind === "enterprise"
                    ? "Vos objectifs, votre activité et le nombre de collaborateurs concernés…"
                    : "Vos objectifs, votre niveau ou vos questions…"
                }
                required
                minLength={10}
                maxLength={2000}
                rows={3}
              />
            </label>
          </div>
          <label className="honeypot" aria-hidden="true">
            Votre site web
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="consent">
            <input type="checkbox" name="consent" required />
            <span>
              J’accepte que mes informations servent à traiter ma demande.{" "}
              <button type="button" onClick={onPrivacy}>
                Confidentialité
              </button>
            </span>
          </label>
          {error && (
            <div className="form-error" role="alert">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}
          {result ? (
            <div className="form-result" role="status">
              <CheckCircle2 size={23} />
              <div>
                {result.type === "saved" ? (
                  <>
                    <strong>Votre demande est enregistrée.</strong>
                    <p>
                      Référence : {result.reference}. Le centre vous contactera
                      pour préciser les modalités.
                    </p>
                  </>
                ) : (
                  <>
                    <strong>Votre demande est prête.</strong>
                    <p>
                      Ouvrez WhatsApp pour la vérifier et l’envoyer au centre.
                    </p>
                    <a
                      className="button button-whatsapp"
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Continuer sur WhatsApp <ArrowUpRight size={17} />
                    </a>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              className="button form-submit"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Envoi en cours…"
                : registrationsAvailable
                  ? "Envoyer ma demande"
                  : "Préparer ma demande WhatsApp"}
              <Send size={16} />
            </button>
          )}
          <p className="form-disclaimer">
            Une demande ne confirme pas une inscription. Les dates, tarifs et
            conditions vous seront communiqués par le centre.
          </p>
        </form>
      </div>
    </section>
  );
}
