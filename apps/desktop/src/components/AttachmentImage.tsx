import { ImageOff, Loader2, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ImageLightbox } from "./ImageLightbox";

interface Props {
  attachmentId: string;
  alt: string;
  className?: string;
  expandable?: boolean;
}

export function AttachmentImage({ attachmentId, alt, className, expandable = true }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api.fetchAttachmentBlob(attachmentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId]);

  if (failed) {
    return (
      <div className="chat-image-fallback" role="img" aria-label={alt}>
        <ImageOff size={22} strokeWidth={1.75} aria-hidden />
        <span>{alt}</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="chat-image-loading" aria-hidden>
        <Loader2 size={22} className="spin" />
      </div>
    );
  }

  if (!expandable) {
    return <img src={src} alt={alt} className={className} loading="lazy" />;
  }

  return (
    <>
      <button
        type="button"
        className="chat-image-expand-btn"
        aria-label={`Открыть ${alt} на весь экран`}
        onClick={() => setLightboxOpen(true)}
      >
        <img src={src} alt={alt} className={className} loading="lazy" />
        <span className="chat-image-expand-hint" aria-hidden>
          <ZoomIn size={16} strokeWidth={2} />
        </span>
      </button>
      {lightboxOpen && (
        <ImageLightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
