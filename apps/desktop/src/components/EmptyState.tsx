import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  spinning?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, spinning }: Props) {
  return (
    <div className="empty-state">
      <div className={`empty-state-icon-wrap${spinning ? " spin" : ""}`} aria-hidden>
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
