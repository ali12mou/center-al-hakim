import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import Contact from "./Contact.jsx";
import Faq from "../components/Faq.jsx";
import Dialog from "../components/Dialog.jsx";
import { PrivacyContent } from "../components/LegalNotices.jsx";

export default function ContactPage() {
  const { data, error } = usePublicSite();
  const [search] = useSearchParams();
  const [privacy, setPrivacy] = useState(false);
  // /contact?demande=enterprise ou ?formation=anglais préremplit le formulaire.
  const request = useMemo(() => {
    const formation = search.get("formation");
    if (formation) return { kind: "registration", courseId: formation };
    const kind = search.get("demande");
    return { kind: ["enterprise", "registration"].includes(kind) ? kind : "contact" };
  }, [search]);
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="CONTACT"
      title="Parlons de votre projet."
      description="Une question sur une formation, une préinscription ou un besoin pour votre entreprise ? L’équipe du centre vous répond."
    >
      {data && (
        <>
          <Contact
            centre={data.centre}
            courses={data.courses}
            departments={data.departments}
            registrationsAvailable={data.registrationsAvailable}
            request={request}
            onPrivacy={() => setPrivacy(true)}
          />
          <Faq items={data.content.faq} />
        </>
      )}
      {privacy && (
        <Dialog
          title="Vos informations, avec respect."
          onClose={() => setPrivacy(false)}
        >
          <PrivacyContent centre={data.centre} />
        </Dialog>
      )}
    </PublicPageLayout>
  );
}
