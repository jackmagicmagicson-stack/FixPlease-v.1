import { X } from "lucide-react";
import { useEffect } from "react";

export interface ToastData {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props extends ToastData {
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, actionLabel, onAction, onDismiss, durationMs = 8000 }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs]);

  return (
    <div className="app-toast" role="status">
      <span className="app-toast-message">{message}</span>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button type="button" className="app-toast-close" aria-label="Закрыть" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
