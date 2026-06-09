import type { ReactNode } from "react";

interface Props {
  step?: number;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function FormSection({ step, title, hint, children }: Props) {
  return (
    <section className="form-section">
      <div className="form-section-head">
        {step != null && <span className="form-step">{step}</span>}
        <div>
          <h3 className="form-section-title">{title}</h3>
          {hint && <p className="hint">{hint}</p>}
        </div>
      </div>
      <div className="form-section-body">{children}</div>
    </section>
  );
}
