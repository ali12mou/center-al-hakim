import { Link, NavLink } from "react-router-dom";
import {
  ArrowUpRight,
  Globe,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Brand from "../../components/Brand.jsx";
import { initials } from "../config/sections.js";

// Barre latérale : sélecteur d’espace (Général, Centre, RH, Finance) puis le
// menu de l’espace affiché, limité aux pages autorisées pour ce compte.
export default function AdminSidebar({
  open,
  collapsed,
  badges,
  user,
  modules,
  current,
  onToggle,
  onLogout,
}) {
  const active = modules.find((module) => module.id === current) || modules[0];
  return (
    <aside className={open ? "admin-sidebar sidebar-open" : "admin-sidebar"}>
      <div className="sidebar-head">
        <Link
          to="/admin"
          className="admin-brand"
          aria-label="Tableau de bord AL-HAKIM CENTER"
        >
          <Brand light />
        </Link>
        <button
          className="sidebar-collapse"
          onClick={onToggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      {modules.length > 1 && (
        <nav className="module-switch" aria-label="Espaces de gestion">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.id}
                to={module.groups[0].items[0].path}
                className={module.id === active?.id ? `module-tab is-active module-${module.id}` : `module-tab module-${module.id}`}
                aria-current={module.id === active?.id ? "page" : undefined}
                title={module.label}
              >
                <Icon size={17} />
                <span className="sidebar-label">{module.short}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {active && (
        <nav aria-label={active.label}>
          <span className="sidebar-module-title sidebar-label">{active.label}</span>
          {active.groups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <span className="sidebar-caption">{group.label}</span>
              {group.items.map(({ path, icon: Icon, label, badge }) => {
                const count = badge ? badges[badge] || 0 : 0;
                return (
                  <NavLink
                    end={["/admin", "/admin/rh", "/admin/finance", "/admin/centre", "/admin/finance/depenses", "/admin/eleves"].includes(path)}
                    key={path}
                    to={path}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={19} />
                    <span className="sidebar-label">{label}</span>
                    {count > 0 && (
                      <b className="sidebar-badge" aria-label={`${count} à traiter`}>
                        {count > 99 ? "99+" : count}
                      </b>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      )}
      <div className="sidebar-footer">
        <Link
          to="/"
          className="sidebar-site"
          title={collapsed ? "Voir le site public" : undefined}
        >
          <Globe size={18} />
          <span className="sidebar-label">Voir le site public</span>
          <ArrowUpRight size={15} className="sidebar-label" />
        </Link>
        <div className="sidebar-user">
          <span className="admin-avatar">{initials(user.name)}</span>
          <span className="sidebar-label">
            <strong>{user.name}</strong>
            <small>@{user.username}</small>
          </span>
          <button
            onClick={onLogout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
