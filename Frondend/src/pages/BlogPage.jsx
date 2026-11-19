import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Newspaper, ArrowUpRight, ArrowLeft, Search, Play, Clock3 } from "lucide-react";
import "./blog.css";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import { EmptyPublications } from "../components/PublicationCard.jsx";

export default function BlogPage() {
  const { data, error } = usePublicSite();
  const { id } = useParams();
  const items = data?.portal?.blog || [];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const filtered = items.filter(item => (!category || item.category === category) && normalize(`${item.title} ${item.description}`).includes(normalize(query)));
  const selected = id && items.find((item) => item._id === id);
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="LE BLOG DU CENTRE"
      title={selected?.title || "La vie du centre. Des idées pour demain."}
      description={
        selected?.description ||
        "Actualités, conseils et informations publiés par le centre."
      }
    >
      <section className="section news-section">
        <div className="container">
          {id ? (
            selected ? (
              <article className="news-detail">
                <Link className="news-back" to="/blog"><ArrowLeft size={17} /> Toutes les actualités</Link>
                <div className="news-detail-meta"><span className="news-category">{selected.category}</span><span>{selected.author || "AL-HAKIM CENTER"}</span><ArticleMeta item={selected} /></div>
                {selected.videoUrl ? <video key={selected.videoUrl} className="news-video" src={selected.videoUrl} poster={selected.imageUrl || undefined} controls playsInline preload="metadata">Votre navigateur ne peut pas lire cette vidéo. <a href={selected.videoUrl}>Ouvrir la vidéo</a></video> : selected.imageUrl && <img className="news-detail-image" src={selected.imageUrl} alt="" />}
                <p className="news-detail-lead">{selected.description}</p>
                <div className="news-detail-body">{(selected.body || "").split(/\n\s*\n/).map((paragraph,index) => <p key={index}>{paragraph}</p>)}</div>
                <div className="news-detail-end"><div><strong>Une question sur cette actualité ?</strong><p>L’équipe du centre est à votre écoute.</p></div><Link className="button" to="/contact">Nous contacter <ArrowUpRight size={17} /></Link></div>
              </article>
            ) : (
              <EmptyPublications label="Cet article est indisponible ou n’est plus publié." />
            )
          ) : (
            <>
              {items.length > 0 && !query && !category && <NewsCard item={items[0]} featured />}
              <div className="news-toolbar"><div><span className="eyebrow">LE JOURNAL DU CENTRE</span><h2>Toutes nos actualités<span> ({filtered.length})</span></h2></div><label className="news-search"><Search size={17} /><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher une actualité" aria-label="Rechercher une actualité" /></label></div>
              {categories.length > 1 && <div className="news-filters" role="group" aria-label="Catégories des actualités"><button type="button" aria-pressed={!category} onClick={()=>setCategory('')}>Tout le journal</button>{categories.map(value=><button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}</div>}
              <div className="news-grid">{filtered.map(item=><NewsCard item={item} key={item._id} />)}</div>
              {!filtered.length && <EmptyPublications label={items.length ? "Aucune actualité ne correspond à votre recherche." : "Les actualités du centre seront publiées ici."} />}
            </>
          )}
        </div>
      </section>
    </PublicPageLayout>
  );
}

function ArticleMeta({ item }) {
  const date = item.createdAt && new Date(item.createdAt);
  const minutes = Math.max(1, Math.ceil(`${item.description || ''} ${item.body || ''}`.split(/\s+/).length / 200));
  return <span className="news-meta">{date && !Number.isNaN(date.getTime()) && <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Djibouti'}).format(date)}</time>}<span><Clock3 size={13} />{item.videoUrl ? 'Vidéo' : `${minutes} min de lecture`}</span></span>;
}
export function NewsCard({ item, featured = false }) {
  return <article className={featured ? 'news-card news-featured' : 'news-card'}>
    <Link className="news-cover" to={`/blog/${item._id}`} tabIndex={-1} aria-hidden="true">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <div className="news-cover-placeholder"><Newspaper size={44} strokeWidth={1} /><span>AL-HAKIM CENTER</span></div>}{item.videoUrl && <span className="news-video-badge"><Play size={13} fill="currentColor" /> Vidéo</span>}</Link>
    <div className="news-card-content">{featured && <span className="news-featured-label">À LA UNE</span>}<span className="news-category">{item.category || 'La vie du centre'}</span><h2><Link to={`/blog/${item._id}`}>{item.title}</Link></h2><p>{item.description}</p><ArticleMeta item={item} /><Link className="news-read" to={`/blog/${item._id}`}>{item.videoUrl ? 'Découvrir la vidéo' : 'Lire l’article'}<ArrowUpRight size={17} /></Link></div>
  </article>;
}
