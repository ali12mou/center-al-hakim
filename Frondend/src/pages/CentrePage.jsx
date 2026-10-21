import { useNavigate } from "react-router-dom";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import { CentreAbout, Departments } from "./Centre.jsx";
import Partners from "../components/Partners.jsx";
import LatestInformations from "../components/LatestInformations.jsx";
import { PracticalInfo, PageCta } from "../components/PageBlocks.jsx";

export default function CentrePage() {
  const { data, error } = usePublicSite();
  const navigate = useNavigate();
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="LE CENTRE"
      title="Un centre de formation au service de vos ambitions."
      description="Découvrez AL-HAKIM CENTER : notre mission, nos valeurs et nos quatre pôles de formation, à Balbala, Djibouti."
    >
      {data && (
        <>
          <CentreAbout about={data.content.about} contactHref="/contact" />
          <Departments
            departments={data.departments}
            onDepartment={(id) => navigate(`/formations?pole=${id}`)}
          />
          <PracticalInfo centre={data.centre} />
          <Partners items={data.portal?.partners || []} />
          <LatestInformations items={data.portal?.informations} />
          <PageCta
            eyebrow="FAISONS CONNAISSANCE"
            title="Parlons de vos objectifs."
            text="Une question sur un programme ou sur le centre ? L’équipe vous répond et vous oriente."
            primary={{ to: "/contact", label: "Contacter le centre" }}
            secondary={{ to: "/formations", label: "Voir les formations" }}
          />
        </>
      )}
    </PublicPageLayout>
  );
}
