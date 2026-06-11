import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button type="button" className="image-lightbox-close" aria-label="Закрыть" onClick={onClose}>
        <X size={22} strokeWidth={2} />
      </button>
      <img src={src} alt={alt} className="image-lightbox-img" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
