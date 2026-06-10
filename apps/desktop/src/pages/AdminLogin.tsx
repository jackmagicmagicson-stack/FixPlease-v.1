import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, setAdminToken } from "../api";
import { AppLogo } from "../components/AppLogo";
import { PageHeader } from "../components/PageHeader";

interface Props {
  onSuccess: () => void;
}

export function AdminLogin({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    try {
      const res = await api.login(password);
      setAdminToken(res.token);
      onSuccess();
    } catch (e) {
      setError(String(e));
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
          lead="Вход только для сотрудников техподдержки. После входа откроется очередь заявок."
        />
        {error && <div className="error-banner">{error}</div>}
        <div className="form-row">
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            autoFocus
            placeholder="Введите пароль"
          />
        </div>
        <button className="btn btn-primary btn-lg btn-block" onClick={login}>
          Войти
        </button>
      </div>
    </div>
  );
}
