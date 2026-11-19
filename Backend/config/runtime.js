// Trust only the local reverse proxy by default in production, never every IP.
export function proxySetting(env = process.env) {
  const value = env.TRUST_PROXY?.trim();
  if (!value) return env.NODE_ENV === "production" ? "loopback" : false;
  if (value === "false" || value === "0") return false;
  if (value === "true")
    throw new Error("TRUST_PROXY=true est trop permissif. Utilisez loopback, une IP ou un nombre de proxys.");
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function smtpOptions(env = process.env) {
  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  const user = env.SMTP_USER?.trim();
  // Preserve password whitespace: it can be part of the SMTP credential.
  const password = env.SMTP_PASSWORD;
  if (!host || !from || (user && !password))
    throw new Error("SMTP incomplet : renseignez SMTP_HOST, SMTP_FROM et SMTP_PASSWORD si SMTP_USER est défini.");
  const port = Number(env.SMTP_PORT?.trim() || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("SMTP_PORT doit être un port valide (465 ou 587 habituellement).");
  const secureValue = env.SMTP_SECURE?.trim().toLowerCase();
  if (secureValue && !["true", "false"].includes(secureValue))
    throw new Error("SMTP_SECURE doit être true ou false.");
  const secure = secureValue ? secureValue === "true" : port === 465;
  if ((port === 465 && !secure) || (port === 587 && secure))
    throw new Error("Configuration TLS SMTP incompatible : port 465 avec SMTP_SECURE=true ; port 587 avec SMTP_SECURE=false (STARTTLS).");
  return {
    host, port, secure,
    requireTLS: !secure && port === 587,
    ...(user ? { auth: { user, pass: password } } : {}),
    connectionTimeout: 10000,
    dnsTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
}
