import { Link } from "react-router-dom";
import { ArrowUp, ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { whatsappLink } from "./whatsapp.js";
import { footerDefaults } from "../../../Backend/data/siteSettings.js";
import "./footer.css";
const FooterLink=({url,children,...props})=>url.startsWith('/')?<Link to={url} {...props}>{children}</Link>:<a href={url} {...props}>{children}</a>;
export default function Footer({centre,onPrivacy,onLegal,campaigns=[]}){
  const footer={...footerDefaults,...centre.footer};
  return <footer className="footer footer-professional"><div className="container">
    <div className="footer-signup"><div><span className="footer-overline">AL-HAKIM CENTER</span><h2>{footer.ctaTitle}</h2><p>{footer.ctaDescription}</p></div><div className="footer-signup-actions"><FooterLink className="button footer-primary" url={footer.primaryUrl}>{footer.primaryLabel}<ArrowUpRight size={18}/></FooterLink><FooterLink className="button footer-secondary" url={footer.secondaryUrl}>{footer.secondaryLabel}</FooterLink></div></div>
    {campaigns.map(item=><div className="footer-campaign" key={item._id}><div><strong>{item.title}</strong><p>{item.description}</p></div>{item.buttonLink&&<FooterLink url={item.buttonLink}>{item.buttonLabel||'Découvrir la campagne'} <ArrowUpRight size={17}/></FooterLink>}</div>)}
    <div className="footer-columns"><div className="footer-brand"><a href="/" aria-label={`${centre.name}, accueil`} className="footer-logo"><img src={footer.logoUrl} alt={centre.name}/></a><strong>{footer.introduction}</strong><p>{footer.description}</p><span className="footer-motto">{footer.motto}</span></div>
      <div className="footer-links"><h3>{footer.discoverTitle}</h3>{footer.links.map(item=><FooterLink key={item.url+item.label} url={item.url}>{item.label}</FooterLink>)}</div>
      <div className="footer-links"><h3>{footer.domainsTitle}</h3>{footer.domains.map(item=><FooterLink key={item.url+item.label} url={item.url}>{item.label}</FooterLink>)}</div>
      <div className="footer-contact"><h3>{footer.contactTitle}</h3><a href={`tel:${centre.phoneLink}`}><Phone size={17}/><span>{centre.phone}</span></a><a href={`mailto:${centre.email}`}><Mail size={17}/><span>{centre.email}</span></a><div className="footer-location"><MapPin size={18}/><span>{centre.address}<small>{centre.landmark}</small></span></div><a className="footer-whatsapp" href={whatsappLink(centre)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>{footer.whatsappLabel}</a>{centre.mapUrl&&<a href={centre.mapUrl} target="_blank" rel="noreferrer">{footer.mapLabel}<ArrowUpRight size={15}/></a>}</div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} {centre.name}. {footer.copyright}</span><div>{onLegal&&<button type="button" onClick={onLegal}>{footer.legalLabel}</button>}{onPrivacy&&<button type="button" onClick={onPrivacy}>{footer.privacyLabel}</button>}{footer.termsUrl&&<FooterLink url={footer.termsUrl}>{footer.termsLabel}</FooterLink>}<button type="button" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>{footer.backToTopLabel}<ArrowUp size={14}/></button></div></div>
  </div></footer>;
}
