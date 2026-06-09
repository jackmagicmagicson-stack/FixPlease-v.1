import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { saveLastTicket } from "../notify";
import type { Category, CategoryTemplate, Ticket } from "../types";

interface Props {
  onCreated: (t: Ticket) => void;
}

export function CreateTicket({ onCreated }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [row, setRow] = useState("");
  const [desk, setDesk] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const list = await api.categories();
      setCategories(list);
      if (list.length === 0) {
        setCategoriesError("Список категорий пуст. Проверьте, что API запущен и миграции применены.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCategoriesError(
        `${msg}. Укажите URL сервера в «Настройки» (например http://127.0.0.1:8080) и убедитесь, что API запущен.`,
      );
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    const onUrlChange = () => {
      setCategoryId("");
      setTemplates([]);
      loadCategories();
    };
    window.addEventListener("fixplease-server-url-changed", onUrlChange);
    return () => window.removeEventListener("fixplease-server-url-changed", onUrlChange);
  }, [loadCategories]);

  useEffect(() => {
    if (!categoryId) {
      setTemplates([]);
      return;
    }
    api.templates(categoryId).then(setTemplates).catch(() => setTemplates([]));
  }, [categoryId]);

  const applyTemplate = (t: CategoryTemplate) => {
    setDescription((d) => (d ? `${d}\n\n${t.body}` : t.body));
  };

  const uploadFiles = async (ticketId: string) => {
    for (const f of files.slice(0, 3)) {
      await api.uploadAttachment(ticketId, f);
    }
  };

  const submit = async (asDraft: boolean) => {
    setError("");
    setSuccess("");
    if (!categoryId) {
      setError("Выберите категорию");
      return;
    }
    setLoading(true);
    try {
      let ticket: Ticket;
      if (draftId) {
        await api.updateTicket(draftId, {
          row_label: row,
          desk_label: desk,
          category_id: categoryId,
          description,
        });
        ticket = asDraft
          ? await api.ticket(draftId)
          : await api.submitTicket(draftId);
      } else {
        ticket = await api.createTicket({
          row_label: row,
          desk_label: desk,
          category_id: categoryId,
          description,
          save_as_draft: asDraft,
        });
      }
      if (!asDraft && files.length) await uploadFiles(ticket.id);
      if (!asDraft) {
        saveLastTicket(ticket);
        setSuccess(`Заявка #${ticket.public_number} отправлена`);
        onCreated(ticket);
        setRow("");
        setDesk("");
        setDescription("");
        setFiles([]);
        setDraftId(null);
        setCategoryId("");
      } else {
        setDraftId(ticket.id);
        setSuccess("Черновик сохранён");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="card">
      <h2>Создать заявку</h2>
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      <div className="form-row">
        <label>Ряд</label>
        <input value={row} onChange={(e) => setRow(e.target.value)} placeholder="3 ряд" />
      </div>
      <div className="form-row">
        <label>Стол</label>
        <input value={desk} onChange={(e) => setDesk(e.target.value)} placeholder="5 стол" />
      </div>
      <div className="form-row">
        <label>Категория</label>
        {categoriesLoading && <p className="hint">Загрузка категорий...</p>}
        {categoriesError && (
          <div className="error-banner">
            {categoriesError}
            <button type="button" className="btn" style={{ marginTop: "0.5rem" }} onClick={loadCategories}>
              Повторить
            </button>
          </div>
        )}
        {!categoriesLoading && !categoriesError && categories.length > 0 && (
          <div className="category-picker" role="listbox" aria-label="Категория">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={categoryId === c.id}
                className={`category-option${categoryId === c.id ? " selected" : ""}`}
                onClick={() => setCategoryId(c.id)}
              >
                <span className="category-option-name">{c.name}</span>
                {c.allows_priority && <span className="badge priority">приоритет</span>}
              </button>
            ))}
          </div>
        )}
        {selectedCategory && (
          <p className="hint">Выбрано: {selectedCategory.name}</p>
        )}
      </div>
      {templates.length > 0 && (
        <div className="form-row">
          <label>Шаблоны</label>
          <div className="toolbar">
            {templates.map((t) => (
              <button key={t.id} type="button" className="btn" onClick={() => applyTemplate(t)}>
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="form-row">
        <label>Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Вложения (до 3)</label>
        <input
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 3))}
        />
        {files.length > 0 && <p className="hint">{files.map((f) => f.name).join(", ")}</p>}
      </div>
      <div className="toolbar">
        <button className="btn btn-primary" disabled={loading || !categoryId} onClick={() => submit(false)}>
          Отправить
        </button>
        <button className="btn" disabled={loading || !categoryId} onClick={() => submit(true)}>
          Сохранить черновик
        </button>
      </div>
    </div>
  );
}
