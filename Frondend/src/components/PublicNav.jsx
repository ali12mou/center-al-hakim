import { NavLink } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Building2,
  Award,
  Newspaper,
} from "lucide-react";
import { useLanguage } from '../context/LanguageContext.jsx';

export default function PublicNav() {
  const { t } = useLanguage();
  const links = [
    ["/courses", BookOpen, "Courses"],
    ["/competences", GraduationCap, "Compétences"],
    ["/skill-assessment", ClipboardCheck, "Skill Assessment"],
    ["/businesses", Building2, "Businesses"],
    ["/certifications", Award, "Certifications"],
    ["/blog", Newspaper, "Blog"],
  ];
  return (
    <nav className="public-subnav" aria-label="Nos services">
      <div className="container">
        {links.map(([href, Icon, label]) => (
          <NavLink key={href} to={href}>
            <Icon size={16} />
            {t(label)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
