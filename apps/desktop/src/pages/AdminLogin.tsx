import { useState } from "react";
import { api, setAdminToken } from "../api";
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
    <div className="card page-card login-card">
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
        />
      </div>
      <button className="btn btn-primary btn-lg" onClick={login}>
        Войти
      </button>
    </div>
  );
}
