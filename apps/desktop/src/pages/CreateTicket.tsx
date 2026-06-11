import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { MAX_ATTACHMENTS } from "../constants";
import { clearDraftId, getDraftId, setDraftId } from "../draftStorage";
import { AttachmentFileList } from "../components/AttachmentFileList";
import type { ToastData } from "../components/Toast";
import { FormSection } from "../components/FormSection";
import { FormStepper } from "../components/FormStepper";
import { useInterfacePrefs } from "../components/InterfacePrefsProvider";
import { PageHeader } from "../components/PageHeader";
import { categoryIcon, computeFormStep, getCategoryHints } from "../employeeUx";
import {
  getLastLocation,
  getRememberLocation,
  saveLastLocation,
  setRememberLocation,
} from "../locationMemory";
import { saveLastTicket } from "../notify";
import { getActiveHistoryEntries, upsertTicketHistory } from "../ticketHistory";
import type { Category, CategoryTemplate, Ticket } from "../types";

interface Props {
  onCreated: (t: Ticket) => void;
  onToast?: (toast: ToastData) => void;
}

export function CreateTicket({ onCreated, onToast }: Props) {
  const { prefs } = useInterfacePrefs();
  const enhanced = prefs.employeeUxEnhanced;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [row, setRow] = useState(() => getLastLocation().row);
  const [desk, setDesk] = useState(() => getLastLocation().desk);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [rememberPlace, setRememberPlace] = useState(getRememberLocation);
  const [draftId, setDraftIdState] = useState<string | null>(() => getDraftId());
  const [pendingDraftBanner, setPendingDraftBanner] = useState(false);
  const rowRef = useRef<HTMLInputElement>(null);

  const currentStep = computeFormStep(row, desk, categoryId, description);
  const selectedCategory = categories.find((c) => c.id === categoryId);

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
        `${msg}. Обратитесь в IT-отдел — возможно, не настроен адрес сервера.`,
      );
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadDraftIntoForm = useCallback(async (id: string) => {
    try {
      const t = await api.ticket(id);
      if (t.status !== "draft") {
        clearDraftId();
        setDraftIdState(null);
        return;
      }
      setRow(t.row_label);
      setDesk(t.desk_label);
      setCategoryId(t.category_id);
      setDescription(t.description);
      setDraftIdState(id);
      setDraftId(id);
      setPendingDraftBanner(false);
    } catch {
      clearDraftId();
      setDraftIdState(null);
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
    const storedDraft = getDraftId();
    if (storedDraft) {
      setPendingDraftBanner(true);
      loadDraftIntoForm(storedDraft);
    }
  }, [loadDraftIntoForm]);

  useEffect(() => {
    const active = getActiveHistoryEntries()[0];
    if (!active) {
      setActiveTicket(null);
      return;
    }
    api
      .ticket(active.id)
      .then((t) => {
        upsertTicketHistory(t);
        if (t.status !== "closed" && t.status !== "draft") {
          setActiveTicket(t);
        } else {
          setActiveTicket(null);
        }
      })
      .catch(() => setActiveTicket(null));
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setTemplates([]);
      return;
    }
    api.templates(categoryId).then(setTemplates).catch(() => setTemplates([]));
  }, [categoryId]);

  const addFiles = useCallback((picked: File[]) => {
    if (picked.length === 0) return;
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS));
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (!enhanced || row.trim()) return;
    rowRef.current?.focus();
  }, [enhanced, row]);

  useEffect(() => {
    if (!enhanced) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItems: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageItems.push(file);
        }
      }
      if (imageItems.length === 0) return;
      e.preventDefault();
      addFiles(imageItems);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [enhanced, addFiles]);

  const applyTemplate = (t: CategoryTemplate) => {
    setDescription((d) => (d ? `${d}\n\n${t.body}` : t.body));
  };

  const uploadFiles = async (ticketId: string) => {
    for (const f of files.slice(0, MAX_ATTACHMENTS)) {
      await api.uploadAttachment(ticketId, f);
    }
  };

  const ticketPayload = () => ({
    row_label: row,
    desk_label: desk,
    category_id: categoryId || undefined,
    description,
  });

  const validatePlace = () => {
    if (!row.trim() || !desk.trim()) {
      setError("Укажите ряд и стол — так администратор найдёт вас быстрее");
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    setError("");
    setSuccess("");
    if (!validatePlace()) return;
    setLoading(true);
    try {
      let ticket: Ticket;
      if (draftId) {
        ticket = await api.updateTicket(draftId, ticketPayload());
      } else {
        ticket = await api.createTicket({ ...ticketPayload(), save_as_draft: true });
        setDraftIdState(ticket.id);
        setDraftId(ticket.id);
      }
      if (files.length) await uploadFiles(ticket.id);
      setSuccess("Черновик сохранён. Можно вернуться и отправить позже.");
      setPendingDraftBanner(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const discardDraft = () => {
    clearDraftId();
    setDraftIdState(null);
    setPendingDraftBanner(false);
    setDescription("");
    setFiles([]);
    setCategoryId("");
    setSuccess("");
  };

  const submit = async () => {
    setError("");
    setSuccess("");
    if (!categoryId) {
      setError("Выберите категорию проблемы");
      return;
    }
    if (!validatePlace()) return;
    setLoading(true);
    try {
      let ticket: Ticket;
      if (draftId) {
        await api.updateTicket(draftId, { ...ticketPayload(), category_id: categoryId });
        ticket = await api.submitTicket(draftId);
        clearDraftId();
        setDraftIdState(null);
      } else {
        ticket = await api.createTicket({
          ...ticketPayload(),
          category_id: categoryId,
          save_as_draft: false,
        });
      }
      if (files.length) await uploadFiles(ticket.id);
      setRememberLocation(rememberPlace);
      if (rememberPlace) {
        saveLastLocation(row, desk);
      }
      saveLastTicket(ticket);
      if (enhanced && onToast) {
        onToast({
          message: `Заявка #${ticket.public_number} отправлена`,
          actionLabel: "Открыть",
          onAction: () => onCreated(ticket),
        });
      } else {
        setSuccess(`Заявка #${ticket.public_number} отправлена. Статус — во вкладке «Мои заявки».`);
      }
      onCreated(ticket);
      setDescription("");
      setFiles([]);
      setCategoryId("");
      setPendingDraftBanner(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const stepperSteps = [
    { num: 1, title: "Место", active: currentStep === 1, done: currentStep > 1 },
    { num: 2, title: "Категория", active: currentStep === 2, done: currentStep > 2 },
    { num: 3, title: "Описание", active: currentStep === 3, done: currentStep > 3 },
    { num: 4, title: "Отправка", active: currentStep === 4, done: false },
  ];

  const actionButtons = (
    <div className="action-bar action-bar-primary">
      <button className="btn" disabled={loading} onClick={saveDraft}>
        Сохранить черновик
      </button>
      <button className="btn btn-primary btn-lg" disabled={loading || !categoryId} onClick={submit}>
        Отправить заявку
      </button>
    </div>
  );

  const formBody = (
    <>
      {activeTicket && !enhanced && (
        <div className="info-banner">
          У вас уже есть активная заявка #{activeTicket.public_number}. Можно создать ещё одну, но
          проще следить за текущей во вкладке «Мои заявки».
        </div>
      )}

      {(draftId || pendingDraftBanner) && (
        <div className="info-banner">
          Есть незавершённый черновик.
          <div className="action-bar" style={{ marginTop: "0.5rem" }}>
            {draftId && (
              <button type="button" className="btn" onClick={() => loadDraftIntoForm(draftId)}>
                Продолжить
              </button>
            )}
            <button type="button" className="btn btn-link" onClick={discardDraft}>
              Удалить черновик
            </button>
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <FormSection step={1} title="Где вы находитесь?" hint="Укажите ряд и стол — администратор найдёт вас">
        <div className="form-grid-2">
          <div className="form-row">
            <label>Ряд</label>
            <input
              ref={rowRef}
              value={row}
              onChange={(e) => setRow(e.target.value)}
              placeholder="3 ряд"
            />
          </div>
          <div className="form-row">
            <label>Стол</label>
            <input value={desk} onChange={(e) => setDesk(e.target.value)} placeholder="5 стол" />
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={rememberPlace}
            onChange={(e) => setRememberPlace(e.target.checked)}
          />
          Запомнить ряд и стол для следующих заявок
        </label>
      </FormSection>

      <FormSection step={2} title="Что случилось?" hint="Выберите тип проблемы">
        {categoriesLoading && <p className="hint">Загрузка категорий…</p>}
        {categoriesError && (
          <div className="error-banner">
            {categoriesError}
            <button type="button" className="btn" style={{ marginTop: "0.5rem" }} onClick={loadCategories}>
              Повторить
            </button>
          </div>
        )}
        {!categoriesLoading && !categoriesError && categories.length > 0 && (
          <div
            className={`category-picker${enhanced ? " category-picker-enhanced" : ""}`}
            role="listbox"
            aria-label="Категория"
          >
            {categories.map((c) => {
              const Icon = enhanced ? categoryIcon(c.name) : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={categoryId === c.id}
                  className={`category-option${categoryId === c.id ? " selected" : ""}`}
                  onClick={() => setCategoryId(c.id)}
                >
                  {Icon && <Icon size={18} strokeWidth={2} className="category-option-icon" aria-hidden />}
                  <span className="category-option-name">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {selectedCategory && !enhanced && <p className="hint">Выбрано: {selectedCategory.name}</p>}
        {enhanced && selectedCategory && (
          <div className="category-hints">
            <p className="category-hints-title">Перед отправкой проверьте:</p>
            <ul className="category-hints-list">
              {getCategoryHints(selectedCategory.name).map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        )}
      </FormSection>

      <FormSection
        step={3}
        title="Подробности"
        hint={
          enhanced
            ? "Опишите проблему. Скриншот можно вставить через Ctrl+V."
            : "Чем точнее описание — тем быстрее помогут. Можно приложить скриншот."
        }
      >
        {templates.length > 0 && (
          <div className="form-row">
            <label>Готовые формулировки</label>
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
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Например: с утра не открывается почта, пишет ошибку подключения…"
          />
        </div>
        <div className="form-row">
          <label>Вложения (до {MAX_ATTACHMENTS} файлов)</label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <AttachmentFileList files={files} onRemove={removeFile} />
          {files.length >= MAX_ATTACHMENTS && (
            <p className="hint">Достигнут лимит вложений ({MAX_ATTACHMENTS})</p>
          )}
        </div>
      </FormSection>

      {!enhanced && <FormSection step={4} title="Отправка">{actionButtons}</FormSection>}
    </>
  );

  return (
    <div className={`card page-card${enhanced ? " create-ticket-enhanced" : ""}`}>
      <PageHeader
        title="Новая заявка"
        lead="Опишите проблему — администратор увидит её в очереди. Обычно достаточно 1–2 минут."
      />

      {enhanced ? (
        <div className="create-ticket-layout">
          <FormStepper steps={stepperSteps} />
          <div className="create-ticket-main">{formBody}</div>
        </div>
      ) : (
        formBody
      )}

      {enhanced && <div className="sticky-action-bar">{actionButtons}</div>}
    </div>
  );
}
