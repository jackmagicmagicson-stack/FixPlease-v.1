import { useState } from "react";

interface Props {
  label: string;
  confirmText: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}

/** Подтверждение в интерфейсе — window.confirm в Tauri ненадёжен. */
export function ConfirmAction({ label, confirmText, onConfirm, className = "btn" }: Props) {
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (armed) {
    return (
      <div className="confirm-bar">
        <p className="hint">{confirmText}</p>
        <div className="toolbar">
          <button
            type="button"
            className="btn btn-danger"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm();
              } finally {
                setLoading(false);
                setArmed(false);
              }
            }}
          >
            {loading ? "Удаление…" : "Да, удалить"}
          </button>
          <button type="button" className="btn" disabled={loading} onClick={() => setArmed(false)}>
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className={className} onClick={() => setArmed(true)}>
      {label}
    </button>
  );
}
