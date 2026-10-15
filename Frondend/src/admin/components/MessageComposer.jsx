import { useState } from "react";
import { MessageCircle, Mail, Send, CheckCircle2 } from "lucide-react";
import Dialog from "../../components/Dialog.jsx";
import { adminApi } from "../services/adminApi.js";

export default function MessageComposer({
  channel,
  record,
  resource,
  onClose,
}) {
  const [subject, setSubject] = useState(
    "Votre demande auprès de AL-HAKIM CENTER",
  );
  const [message, setMessage] = useState(
    `Bonjour ${record.name},\n\nNous vous contactons concernant ${record.courseTitle && record.courseTitle !== "Non précisé" ? `la formation ${record.courseTitle}` : "votre demande auprès du centre"}.\n\nL’équipe AL-HAKIM CENTER\n+253 77 75 66 38`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const digits = record.phone.replace(/\D/g, "").replace(/^00/, "");
  const phone = digits.length === 8 ? `253${digits}` : digits;
  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminApi("/emails", {
        method: "POST",
        body: { resource, id: record._id, subject, message },
      });
      setSent(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        channel === "whatsapp"
          ? "Préparer un message WhatsApp"
          : "Envoyer un e-mail"
      }
      onClose={onClose}
    >
      <p className="composer-recipient">
        <strong>{record.name}</strong>
        <br />
        {channel === "whatsapp" ? record.phone : record.email}
      </p>
      {sent ? (
        <div className="form-result">
          <CheckCircle2 size={25} />
          <p>L’e-mail a été transmis au serveur de messagerie.</p>
        </div>
      ) : (
        <form className="admin-form" onSubmit={send}>
          {channel === "email" && (
            <label>
              Objet
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={3}
                maxLength={200}
                required
              />
            </label>
          )}
          <label>
            Message
            <textarea
              rows={8}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={10000}
              required
            />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="composer-actions">
            {channel === "whatsapp" ? (
              <a
                className="button button-whatsapp"
                href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={18} />
                Ouvrir WhatsApp
              </a>
            ) : (
              <>
                <button className="button" disabled={busy}>
                  <Send size={16} />
                  {busy ? "Envoi…" : "Envoyer depuis le site"}
                </button>
                <a
                  className="button button-outline"
                  href={`mailto:${record.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
                >
                  <Mail size={16} />
                  Ouvrir l’application e-mail
                </a>
              </>
            )}
          </div>
          <small>
            WhatsApp ouvre le message à vérifier avant envoi. L’envoi d’e-mails
            depuis le site utilise le serveur SMTP configuré dans le backend.
          </small>
        </form>
      )}
    </Dialog>
  );
}
