import type { ReactNode } from "react";

interface Props {
  title: string;
  lead?: string;
  children?: ReactNode;
}

export function PageHeader({ title, lead, children }: Props) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h2>{title}</h2>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  );
}
