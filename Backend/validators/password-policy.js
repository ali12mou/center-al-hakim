// Règles partagées : le Backend les impose, l’administration les affiche en direct.
const common = [
  "password",
  "motdepasse",
  "azerty",
  "qwerty",
  "123456",
  "admin",
  "alhakim",
  "al-hakim",
  "djibouti",
  "bienvenue",
  "welcome",
  "letmein",
];
const characterTypes = (value) =>
  [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(value),
  ).length;

export const passwordRules = [
  {
    id: "length",
    label: "Au moins 12 caractères",
    test: (value) => value.length >= 12,
  },
  {
    id: "mix",
    label: "Trois types parmi minuscules, majuscules, chiffres et symboles",
    test: (value) => characterTypes(value) >= 3,
  },
  {
    id: "username",
    label: "Ne contient pas le nom d’utilisateur",
    test: (value, { username = "" } = {}) =>
      value.length > 0 &&
      (username.length < 3 ||
        !value.toLowerCase().includes(username.toLowerCase())),
  },
  {
    id: "common",
    label: "Aucun mot courant ni caractère répété",
    test: (value) =>
      value.length > 0 &&
      !/(.)\1{3,}/.test(value) &&
      !common.some((word) => value.toLowerCase().includes(word)),
  },
];

export function passwordProblem(value, context = {}) {
  if (typeof value !== "string" || value.length > 128)
    return "Utilisez au plus 128 caractères.";
  const failed = passwordRules.find((rule) => !rule.test(value, context));
  return failed
    ? `Mot de passe trop faible : ${failed.label.toLowerCase()}.`
    : null;
}

// 0 à 5 : chaque règle respectée compte, la longueur au-delà de 16 aussi.
export function passwordScore(value, context = {}) {
  if (!value) return 0;
  const passed = passwordRules.filter((rule) => rule.test(value, context));
  return passed.length + (passed.length === 4 && value.length >= 16 ? 1 : 0);
}
