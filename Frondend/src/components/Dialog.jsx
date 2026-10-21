import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// `media` : image ou vidéo affichée sur toute la largeur, au-dessus du titre.
export default function Dialog({
  title,
  children,
  onClose,
  className = "",
  media = null,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = before;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Fermer la fenêtre"
      >
        <X size={21} />
      </button>
      {media}
      <div className="dialog-inner">
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
