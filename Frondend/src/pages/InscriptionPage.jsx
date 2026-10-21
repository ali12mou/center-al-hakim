import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import Contact from "./Contact.jsx";
import Dialog from "../components/Dialog.jsx";

export default function InscriptionPage() {
  const { data, error } = usePublicSite();
  const [search] = useSearchParams();
  const [privacy, setPrivacy] = useState(false);
  const request = useMemo(
    () => ({ kind: "registration", courseId: search.get("formation") || "" }),
    [search],
  );
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="PRÉINSCRIPTION"
      title="Faites le premier pas."
      description="Votre demande permet au centre de préciser avec vous les dates, tarifs et modalités."
    >
      {data && (
        <Contact
          centre={data.centre}
          courses={data.courses}
          departments={data.departments}
          registrationsAvailable={data.registrationsAvailable}
          request={request}
          onPrivacy={() => setPrivacy(true)}
        />
      )}
      {privacy && (
        <Dialog title="Vos informations" onClose={() => setPrivacy(false)}>
          <p>
            Votre nom, vos coordonnées et votre demande servent à traiter votre
            préinscription et à vous recontacter. Vous pouvez demander leur
            correction ou suppression auprès du centre.
          </p>
        </Dialog>
      )}
    </PublicPageLayout>
  );
}
