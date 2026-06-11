import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, setAdminToken } from "../api";
import { setAdminProfile } from "../adminSession";
import { AppLogo } from "../components/AppLogo";
import { PageHeader } from "../components/PageHeader";

interface Props {
  onSuccess: () => void;
}

export function AdminLogin({ onSuccess }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    try {
      const res = await api.login(displayName.trim(), password);
      setAdminToken(res.token);
      setAdminProfile({
        admin_id: res.admin_id,
        display_name: res.display_name,
        is_super_admin: res.is_super_admin,
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="login-screen">
      <div className="card page-card login-card">
        <div className="login-hero">
          <AppLogo size="sm" />
          <div className="login-hero-icon" aria-hidden>
            <ShieldCheck size={22} strokeWidth={1.75} />
          </div>
        </div>
        <PageHeader
          title="Кабинет администратора"
          lead="Вход по имени и паролю. Рабочие администраторы обрабатывают заявки; главный администратор управляет учётками в настройках."
        />
        {error && <div className="error-banner">{error}</div>}
        <div className="form-row">
          <label>Имя</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            autoFocus
            placeholder="Например: Админ 1"
          />
        </div>
        <div className="form-row">
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Введите пароль"
          />
        </div>
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={login}
          disabled={!displayName.trim() || !password}
        >
          Войти
        </button>
      </div>
    </div>
  );
}
