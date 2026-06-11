import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { AdminUser } from "../types";
import { FormSection } from "./FormSection";

interface Props {
  currentAdminId: string;
}

export function AdminManagement({ currentAdminId }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAdmins(await api.listAdmins());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (admin: AdminUser) => {
    setEditingId(admin.id);
    setEditName(admin.display_name);
    setEditPassword("");
    setMsg("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPassword("");
  };

  const createAdmin = async () => {
    setError("");
    setMsg("");
    try {
      await api.createAdmin({ display_name: newName, password: newPassword });
      setNewName("");
      setNewPassword("");
      setMsg("Администратор добавлен");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveEdit = async (id: string) => {
    setError("");
    setMsg("");
    try {
      await api.updateAdmin(id, {
        display_name: editName,
        password: editPassword.trim() ? editPassword : undefined,
      });
      setMsg("Изменения сохранены");
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (admin.is_super_admin) return;
    if (!window.confirm(`Удалить учётку «${admin.display_name}»?`)) return;
    setError("");
    setMsg("");
    try {
      await api.deleteAdmin(admin.id);
      setMsg("Администратор удалён");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <FormSection
      title="Администраторы"
      hint="Главная учётка управляет рабочими администраторами. Рабочие входят по имени и паролю и видны в отчётах."
    >
      {error && <div className="error-banner">{error}</div>}
      {msg && <div className="success-banner">{msg}</div>}
      {loading && <p className="hint">Загрузка…</p>}

      {!loading && (
        <ul className="admin-user-list">
          {admins.map((admin) => (
            <li key={admin.id} className="admin-user-row">
              {editingId === admin.id ? (
                <div className="admin-user-edit">
                  <div className="form-row">
                    <label>Имя для входа</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-row">
                    <label>Новый пароль</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Оставьте пустым, чтобы не менять"
                    />
                  </div>
                  <div className="action-bar">
                    <button type="button" className="btn btn-primary" onClick={() => saveEdit(admin.id)}>
                      Сохранить
                    </button>
                    <button type="button" className="btn" onClick={cancelEdit}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="admin-user-info">
                    <span className="admin-user-name">
                      {admin.is_super_admin && (
                        <UserCog size={16} strokeWidth={2} aria-hidden className="admin-user-icon" />
                      )}
                      {admin.display_name}
                    </span>
                    <span className="admin-user-role">
                      {admin.is_super_admin ? "Главный администратор" : "Рабочий администратор"}
                      {admin.id === currentAdminId ? " · вы" : ""}
                    </span>
                  </div>
                  <div className="admin-user-actions">
                    <button
                      type="button"
                      className="btn btn-icon"
                      aria-label={`Редактировать ${admin.display_name}`}
                      onClick={() => startEdit(admin)}
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </button>
                    {!admin.is_super_admin && (
                      <button
                        type="button"
                        className="btn btn-icon btn-danger-soft"
                        aria-label={`Удалить ${admin.display_name}`}
                        onClick={() => removeAdmin(admin)}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="admin-user-create">
        <h4 className="block-title">Добавить администратора</h4>
        <div className="form-grid-2">
          <div className="form-row">
            <label>Имя для входа</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Например: Админ 4"
            />
          </div>
          <div className="form-row">
            <label>Пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Не короче 4 символов"
            />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!newName.trim() || newPassword.length < 4}
          onClick={createAdmin}
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          Добавить
        </button>
      </div>
    </FormSection>
  );
}
