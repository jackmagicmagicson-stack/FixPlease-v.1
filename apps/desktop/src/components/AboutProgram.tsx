import { ExternalLink } from "lucide-react";
import { FormSection } from "./FormSection";

const REPO_URL = "https://github.com/jackmagicmagicson-stack/FixPlease-v.1";
const RELEASES_URL = "https://github.com/jackmagicmagicson-stack/FixPlease-v.1/releases";

const CREDITS = [
  {
    name: "Карагезян Мамикон",
    role: "Основной разработчик приложения",
  },
  {
    name: "Сергеев Иван",
    role: "Ответственный за деплой и обновления",
  },
  {
    name: "Хабибуллин Рустам",
    role: "Работа с сервером и техническое обслуживание",
  },
] as const;

export function AboutProgram() {
  return (
    <FormSection
      title="О программе"
      hint={`FixPlease · версия клиента ${__APP_VERSION__}`}
    >
      <p className="about-lead">
        FixPlease — система заявок в IT для локальной сети офиса. Сотрудники создают
        обращения с указанием места и категории, прикрепляют скриншоты и ведут переписку
        с поддержкой. Администраторы видят очередь в реальном времени, берут заявки в работу,
        закрывают или отклоняют их, ведут справочник категорий и формируют отчёты.
      </p>
      <p className="hint about-stack">
        Клиент: Tauri 2 + React · Сервер: Rust/Axum, PostgreSQL, Docker, HTTPS
      </p>

      <h4 className="block-title about-subtitle">Полезные ссылки</h4>
      <ul className="about-links">
        <li>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} strokeWidth={2} aria-hidden />
            Репозиторий на GitHub
          </a>
        </li>
        <li>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} strokeWidth={2} aria-hidden />
            Сборки и релизы
          </a>
        </li>
      </ul>

      <h4 className="block-title about-subtitle">Авторы</h4>
      <ul className="about-credits">
        {CREDITS.map((person) => (
          <li key={person.name} className="about-credit-item">
            <span className="about-credit-name">{person.name}</span>
            <span className="about-credit-role">{person.role}</span>
          </li>
        ))}
      </ul>
    </FormSection>
  );
}
