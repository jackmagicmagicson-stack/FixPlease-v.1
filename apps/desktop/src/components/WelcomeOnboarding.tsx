import { ClipboardList, MessageSquare, PlusCircle, Sparkles, WifiOff } from "lucide-react";
import { useState } from "react";
import { setOnboardingDone } from "../onboardingState";

interface Props {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Sparkles,
    title: "Добро пожаловать в FixPlease",
    body: "Это приложение для быстрых IT-заявок из офиса. Опишите проблему — администратор увидит её в очереди и ответит в чате.",
  },
  {
    icon: PlusCircle,
    title: "Создайте заявку за пару минут",
    body: "Укажите ряд и стол, выберите категорию и опишите проблему. Можно приложить скриншот или вставить его через Ctrl+V.",
  },
  {
    icon: ClipboardList,
    title: "Следите за статусом",
    body: "Во вкладке «Мои заявки» видно активное обращение и историю. Ответы администратора приходят автоматически.",
  },
  {
    icon: WifiOff,
    title: "Если сервер не отвечает",
    body: "При проблемах с подключением обратитесь в IT-отдел — они помогут восстановить доступ к серверу заявок.",
  },
  {
    icon: MessageSquare,
    title: "Готово к работе",
    body: "Начните с вкладки «Новая заявка». При необходимости интерфейс можно вернуть к классическому виду в настройках.",
  },
] as const;

export function WelcomeOnboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    setOnboardingDone();
    onComplete();
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card card">
        <div className="onboarding-progress" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot${i === step ? " active" : ""}${i < step ? " done" : ""}`} />
          ))}
        </div>

        <div className="onboarding-icon-wrap" aria-hidden>
          <Icon size={32} strokeWidth={1.75} />
        </div>

        <h2 id="onboarding-title" className="onboarding-title">
          {current.title}
        </h2>
        <p className="onboarding-body">{current.body}</p>

        <div className="onboarding-actions">
          <button type="button" className="btn btn-link" onClick={finish}>
            Пропустить
          </button>
          <div className="action-bar">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
                Назад
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={next}>
              {isLast ? "Начать работу" : "Далее"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
