import { useEffect, useState } from "react";
import { api } from "../api";
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

  return (
    <div className="card">
      <h2>Категории и шаблоны</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          placeholder="Новая категория"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
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
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ul className="ticket-list">
        {templates.map((t) => (
          <li key={t.id}>
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
      <h4>Новый шаблон</h4>
      <input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Заголовок" />
      <textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} placeholder="Текст" />
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
    </div>
  );
}
