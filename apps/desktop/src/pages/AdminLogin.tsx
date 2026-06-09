import { useState } from "react";
import { api, setAdminToken } from "../api";

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
    <div className="card">
      <h2>Вход в кабинет администратора</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-row">
        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
      </div>
      <button className="btn btn-primary" onClick={login}>
        Войти
      </button>
    </div>
  );
}
