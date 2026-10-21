export const initialSkills = [
  {
    title: "Communication en langues",
    category: "langues",
    icon: "Languages",
    description:
      "Développez votre expression en anglais, français, arabe et chinois.",
    body: "Des parcours progressifs selon votre niveau, avec des exercices de compréhension et de conversation.",
    published: true,
  },
  {
    title: "Outils numériques & bureautique",
    category: "informatique",
    icon: "Monitor",
    description:
      "Gagnez en autonomie avec l’informatique, Word, Excel et PowerPoint.",
    body: "Les contenus associent prise en main, mises en situation et exercices pratiques.",
    published: true,
  },
  {
    title: "Management & communication",
    category: "management",
    icon: "BriefcaseBusiness",
    description:
      "Structurez vos projets et développez vos compétences professionnelles.",
    body: "Ressources humaines, service à la clientèle, leadership et communication professionnelle.",
    published: true,
  },
  {
    title: "Comptabilité & gestion",
    category: "finance",
    icon: "ChartNoAxesCombined",
    description:
      "Construisez une maîtrise pratique des chiffres et des outils de gestion.",
    body: "Découvrez la comptabilité informatisée, Sage 100 et Excel appliqué à la finance.",
    published: true,
  },
];
export const initialBusinesses = [
  {
    title: "Des formations pour vos équipes",
    description:
      "Un programme construit selon les objectifs de votre organisation.",
    body: "Présentez-nous votre activité, vos besoins et les compétences à développer. Les modalités et le calendrier sont convenus avec le centre.",
    audience: "Entreprises et institutions",
    benefits: [
      "Analyse de vos besoins",
      "Langues et communication professionnelle",
      "Management, bureautique et finance",
    ],
    published: true,
  },
  {
    title: "Ateliers & perfectionnement",
    description:
      "Travaillez une compétence précise à travers des exercices concrets.",
    body: "Le projet du centre prévoit des ateliers, des séminaires et des sessions de perfectionnement professionnel adaptés aux participants.",
    benefits: [
      "Objectifs définis ensemble",
      "Cas pratiques adaptés",
      "Formats courts selon le programme",
    ],
    published: true,
  },
];
export const initialCertifications = [
  {
    title: "Attestation de participation",
    description:
      "Un document qui retrace votre participation à un programme du centre.",
    body: "Les conditions de délivrance sont confirmées pour chaque formation. Le document précise le participant, le programme, le volume horaire, la date et une référence de vérification.",
    issuer: "AL-HAKIM CENTER",
    requirements: [
      "Participation selon les conditions du programme",
      "Validation administrative du centre",
    ],
    accreditation: "Attestation du centre — modalités à confirmer",
    published: true,
  },
  {
    title: "Attestation de fin de formation",
    description:
      "Valorisez le parcours accompli et les compétences travaillées.",
    body: "Une attestation de fin de formation est envisagée selon les conditions du programme et les évaluations prévues. Elle ne constitue pas une certification Microsoft ni un agrément international.",
    issuer: "AL-HAKIM CENTER",
    requirements: ["Suivi du parcours", "Évaluations selon le programme"],
    accreditation: "Aucune reconnaissance externe annoncée",
    published: true,
  },
];
export const initialAssessments = [
  {
    title: "Où en êtes-vous en informatique ?",
    skill: "Informatique & bureautique",
    description:
      "Six questions pour faire le point et orienter votre choix de formation.",
    body: "Cette évaluation est indicative. Elle ne délivre pas de certification et ne remplace pas un échange avec le centre.",
    published: true,
    questions: [
      {
        prompt: "Quel outil permet de rédiger un document professionnel ?",
        choices: [
          "Word",
          "Un navigateur web",
          "Une calculatrice",
          "Un lecteur vidéo",
        ],
        correctIndex: 0,
      },
      {
        prompt: "Dans Excel, quel signe commence une formule ?",
        choices: ["#", "=", "&", "@"],
        correctIndex: 1,
      },
      {
        prompt: "Quel outil est conçu pour préparer une présentation ?",
        choices: [
          "La messagerie",
          "Le bloc-notes",
          "PowerPoint",
          "L’explorateur de fichiers",
        ],
        correctIndex: 2,
      },
      {
        prompt: "Quel mot de passe est généralement le plus robuste ?",
        choices: [
          "123456",
          "Le prénom seul",
          "Une phrase longue et unique",
          "password",
        ],
        correctIndex: 2,
      },
      {
        prompt: "À quoi sert une copie de sauvegarde ?",
        choices: [
          "À augmenter la taille des polices",
          "À retrouver les fichiers en cas de perte",
          "À effacer les e-mails",
          "À remplacer une souris",
        ],
        correctIndex: 1,
      },
      {
        prompt: "Que vérifier avant d’ouvrir une pièce jointe inattendue ?",
        choices: [
          "Uniquement son nom",
          "La couleur de l’e-mail",
          "Le nombre de pages",
          "L’expéditeur et le contexte du message",
        ],
        correctIndex: 3,
      },
    ],
  },
];
export const initialPartners = [
  {
    title: "Microsoft",
    description:
      "Un écosystème de technologies abordées dans les programmes de bureautique.",
    body: "Microsoft Word, Excel et PowerPoint figurent dans les programmes proposés. Aucun partenariat officiel ni statut de centre agréé Microsoft n’est annoncé.",
    website: "https://www.microsoft.com",
    relationship: "ecosystem",
    published: true,
  },
];
export const initialInformation = [
  {
    title: "Construisons votre parcours",
    category: "Orientation",
    description:
      "Vous souhaitez développer une compétence ? Échangeons sur votre niveau et vos objectifs.",
    body: "Les dates, tarifs, horaires et conditions de chaque programme sont confirmés directement avec AL-HAKIM CENTER avant toute inscription.",
    published: true,
  },
];
// Diaporama de l’accueil : repris des textes et visuels existants, modifiable
// ensuite depuis le menu « Accueil » de l’administration.
export const initialSlides = [
  {
    eyebrow: "UN NOUVEAU CHAPITRE POUR VOTRE AVENIR",
    title: "Apprenez aujourd’hui.",
    accent: "Allez plus loin demain.",
    description:
      "Des langues aux compétences numériques, construisez votre avenir avec des formations pratiques, pensées pour le monde professionnel à Djibouti.",
    body: "Étudiants, professionnels, entrepreneurs : votre prochaine étape commence ici.",
    buttonLabel: "Découvrir les formations",
    buttonLink: "/formations",
    imageUrl: "/images/hero-classroom.jpg",
    order: 1,
    published: true,
  },
  {
    eyebrow: "TROUVEZ VOTRE PROCHAINE ÉTAPE",
    title: "Une compétence.",
    accent: "De nouvelles possibilités.",
    description:
      "Choisissez le parcours qui donne du sens à vos ambitions.",
    body: "Langues, management, informatique, comptabilité : quatre pôles pour progresser.",
    buttonLabel: "Découvrir les formations",
    buttonLink: "/formations",
    imageUrl: "/images/informatique.jpg",
    order: 2,
    published: true,
  },
  {
    eyebrow: "POUR LES ENTREPRISES & LES INSTITUTIONS",
    title: "Faites grandir les compétences de vos équipes.",
    accent: "",
    description:
      "Un besoin spécifique ? Construisons un programme adapté à votre activité, à vos collaborateurs et à vos objectifs.",
    body: "",
    buttonLabel: "Discutons de vos besoins",
    buttonLink: "/entreprises",
    imageUrl: "/images/management.jpg",
    order: 3,
    published: true,
  },
];
