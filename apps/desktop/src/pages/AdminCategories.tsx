import { useEffect, useState } from "react";
import { api } from "../api";
import { FormSection } from "../components/FormSection";
import { PageHeader } from "../components/PageHeader";
import type { Category, CategoryTemplate } from "../types";

export function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  const [newCat, setNewCat] = useState("");
  const [tplTitle, setTplTitle] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const cats = await api.categories();
    setCategories(cats);
    if (!selected && cats[0]) setSelected(cats[0].id);
  };

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.templates(selected).then(setTemplates).catch((e) => setError(String(e)));
  }, [selected]);

  const selectedCategory = categories.find((c) => c.id === selected);

  return (
    <div className="card page-card">
      <PageHeader
        title="Справочник"
        lead="Категории проблем и готовые формулировки для сотрудников. Меняется редко."
      />
      {error && <div className="error-banner">{error}</div>}

      <FormSection title="Категории">
        <div className="toolbar">
          <input
            placeholder="Название новой категории"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={async () => {
              await api.createCategory(newCat);
              setNewCat("");
              refresh();
            }}
          >
            Добавить
          </button>
        </div>

        {categories.length > 0 && (
          <div className="category-picker" role="listbox" aria-label="Категория">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={selected === c.id}
                className={`category-option${selected === c.id ? " selected" : ""}`}
                onClick={() => setSelected(c.id)}
              >
                <span className="category-option-name">{c.name}</span>
                {c.allows_priority && <span className="badge priority">приоритет</span>}
              </button>
            ))}
          </div>
        )}
      </FormSection>

      {selectedCategory && (
        <FormSection
          title={`Шаблоны: ${selectedCategory.name}`}
          hint="Сотрудник видит их при создании заявки в этой категории"
        >
          {templates.length === 0 ? (
            <p className="hint">Шаблонов пока нет — добавьте ниже.</p>
          ) : (
            <ul className="template-list">
              {templates.map((t) => (
                <li key={t.id} className="template-item">
                  <strong>{t.title}</strong>
                  <p>{t.body}</p>
                  <button
                    className="btn"
                    onClick={async () => {
                      await api.deleteTemplate(t.id);
                      api.templates(selected).then(setTemplates);
                    }}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="form-row">
            <label>Новый шаблон</label>
            <input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Краткий заголовок кнопки" />
          </div>
          <div className="form-row">
            <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} placeholder="Текст, который подставится в описание" />
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await api.createTemplate(selected, { title: tplTitle, body: tplBody });
              setTplTitle("");
              setTplBody("");
              api.templates(selected).then(setTemplates);
            }}
          >
            Сохранить шаблон
          </button>
        </FormSection>
      )}
    </div>
  );
}
