import { Check } from "lucide-react";

interface Step {
  num: number;
  title: string;
  active: boolean;
  done: boolean;
}

interface Props {
  steps: Step[];
}

export function FormStepper({ steps }: Props) {
  return (
    <nav className="form-stepper" aria-label="Шаги заявки">
      {steps.map((step) => (
        <div
          key={step.num}
          className={`form-stepper-item${step.active ? " active" : ""}${step.done ? " done" : ""}`}
        >
          <span className="form-stepper-marker" aria-hidden>
            {step.done ? <Check size={14} strokeWidth={2.5} /> : step.num}
          </span>
          <span className="form-stepper-label">{step.title}</span>
        </div>
      ))}
    </nav>
  );
}
