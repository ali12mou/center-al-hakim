import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Globe, LogOut, ShieldCheck } from "lucide-react";
import { initials } from "../config/sections.js";

export default function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="account-menu" ref={root}>
      <button
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="admin-avatar">{initials(user.name)}</span>
        <span className="account-name">
          <strong>{user.name}</strong>
          <small>Administrateur</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-head">
            <strong>{user.name}</strong>
            <small>@{user.username}</small>
          </div>
          <Link role="menuitem" to="/admin/security" onClick={() => setOpen(false)}>
            <ShieldCheck size={17} />
            Sécurité du compte
          </Link>
          <Link role="menuitem" to="/" onClick={() => setOpen(false)}>
            <Globe size={17} />
            Voir le site public
          </Link>
          <button role="menuitem" className="account-logout" onClick={onLogout}>
            <LogOut size={17} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
