// Lien WhatsApp avec un premier message déjà rédigé : le visiteur n’a plus
// qu’à appuyer sur « Envoyer ». Sans message, WhatsApp s’ouvre sur une
// conversation vide.
export const whatsappLink = (centre, message = centre.whatsappMessage) =>
  `https://wa.me/${centre.whatsapp}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;
