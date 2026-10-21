// Textes partagés par l’accueil et les pages qui contiennent le formulaire.
export function PrivacyContent({ centre }) {
  return (
    <div className="legal-copy">
      <p>
        Les informations du formulaire servent uniquement à comprendre votre
        demande et à permettre au centre de vous recontacter.
      </p>
      <h3>Comment votre demande est-elle transmise ?</h3>
      <p>
        Si l’enregistrement en ligne est disponible, la demande est enregistrée
        dans la base du centre après votre consentement. Sinon, le site prépare
        un message WhatsApp : vous choisissez ensuite de l’envoyer dans
        WhatsApp. Aucun message n’est envoyé automatiquement.
      </p>
      <h3>Votre choix reste entre vos mains.</h3>
      <p>
        Vous pouvez demander l’accès, la correction ou la suppression de vos
        informations en contactant AL-HAKIM CENTER au {centre.phone} ou à{" "}
        {centre.email}. Ce site n’utilise pas de traceurs publicitaires.
        L’utilisation de WhatsApp est soumise aux conditions de ce service.
      </p>
      <h3>Mesure d’audience</h3>
      <p>
        Le site utilise Google Analytics pour connaître sa fréquentation : pages
        consultées, durée des visites, type d’appareil et pays. Le centre n’en
        consulte que des statistiques globales, jamais reliées aux informations
        que vous saisissez dans le formulaire.
      </p>
    </div>
  );
}
export function LegalContent({ centre }) {
  return (
    <div className="legal-copy">
      <p>
        <strong>{centre.name}</strong>
        <br />
        Formation · Langues · Technologie
      </p>
      <p>
        {centre.address}
        <br />
        {centre.landmark}
        <br />
        Téléphone : {centre.phone}
        <br />
        E-mail : {centre.email}
      </p>
      <p>
        La présentation décrit un projet de centre de formation. Les programmes,
        tarifs, dates d’ouverture et conditions d’inscription restent à
        confirmer directement avec le centre.
      </p>
      <p>
        Les visuels sont illustratifs. Les informations administratives
        complémentaires seront publiées lorsqu’elles seront confirmées.
      </p>
    </div>
  );
}
