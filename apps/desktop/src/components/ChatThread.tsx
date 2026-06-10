import { MessageCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { EmptyState } from "./EmptyState";
import type { Attachment, TicketMessage } from "../types";

const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_AUTHORS_KEY = "fixplease_attachment_authors";

type ViewerRole = "admin" | "employee";

interface Props {
  ticketId: string;
  ticketClosed: boolean;
  viewerRole: ViewerRole;
  asAdmin: boolean;
  messages: TicketMessage[];
  attachments: Attachment[];
  onRefresh: () => void | Promise<void>;
  error?: string;
  onError?: (message: string) => void;
}

type TimelineItem =
  | { kind: "message"; at: string; data: TicketMessage }
  | { kind: "attachment"; at: string; data: Attachment; side: ViewerRole };

function loadAttachmentAuthors(ticketId: string): Record<string, ViewerRole> {
  try {
    const raw = localStorage.getItem(`${ATTACHMENT_AUTHORS_KEY}_${ticketId}`);
    return raw ? (JSON.parse(raw) as Record<string, ViewerRole>) : {};
  } catch {
    return {};
  }
}

function saveAttachmentAuthor(ticketId: string, attachmentId: string, role: ViewerRole) {
  const map = loadAttachmentAuthors(ticketId);
  map[attachmentId] = role;
  localStorage.setItem(`${ATTACHMENT_AUTHORS_KEY}_${ticketId}`, JSON.stringify(map));
}

function guessAttachmentSide(
  attachment: Attachment,
  authors: Record<string, ViewerRole>,
): ViewerRole {
  if (authors[attachment.id]) return authors[attachment.id];
  return "employee";
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function ChatThread({
  ticketId,
  ticketClosed,
  viewerRole,
  asAdmin,
  messages,
  attachments,
  onRefresh,
  error,
  onError,
}: Props) {
  const [reply, setReply] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const attachmentAuthors = useMemo(() => loadAttachmentAuthors(ticketId), [ticketId, attachments]);

  const timeline = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = [
      ...messages.map((m) => ({ kind: "message" as const, at: m.created_at, data: m })),
      ...attachments
        .filter((a) => a.mime_type.startsWith("image/"))
        .map((a) => ({
          kind: "attachment" as const,
          at: a.created_at,
          data: a,
          side: guessAttachmentSide(a, attachmentAuthors),
        })),
    ];
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }, [messages, attachments, attachmentAuthors]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.length, pendingFiles.length]);

  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPendingPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [pendingFiles]);

  const existingCount = attachments.length;
  const slotsLeft = Math.max(0, MAX_ATTACHMENTS - existingCount);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files).filter(isImageFile);
      if (incoming.length === 0) {
        onError?.("Можно прикрепить только изображения (PNG, JPG, GIF, WebP).");
        return;
      }
      const tooBig = incoming.find((f) => f.size > MAX_IMAGE_BYTES);
      if (tooBig) {
        onError?.(`Файл «${tooBig.name}» слишком большой (макс. 10 МБ).`);
        return;
      }

      setPendingFiles((prev) => {
        const room = slotsLeft - prev.length;
        if (room <= 0) {
          onError?.(`Не более ${MAX_ATTACHMENTS} вложений на заявку.`);
          return prev;
        }
        const next = [...prev, ...incoming.slice(0, room)];
        if (incoming.length > room) {
          onError?.(`Добавлено ${room} из ${incoming.length}: лимит ${MAX_ATTACHMENTS} вложений.`);
        }
        return next;
      });
    },
    [onError, slotsLeft],
  );

  useEffect(() => {
    setPendingFiles((prev) => {
      const allowed = Math.max(0, slotsLeft);
      if (prev.length <= allowed) return prev;
      return prev.slice(0, allowed);
    });
  }, [slotsLeft]);

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (ticketClosed) return;
    addFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (ticketClosed) return;
    const items = e.clipboardData?.files;
    if (items?.length) {
      e.preventDefault();
      addFiles(items);
    }
  };

  const handleSend = async () => {
    const text = reply.trim();
    if (!text && pendingFiles.length === 0) return;
    if (ticketClosed) return;

    setSending(true);
    onError?.("");
    try {
      for (const file of pendingFiles) {
        const att = await api.uploadAttachment(ticketId, file);
        saveAttachmentAuthor(ticketId, att.id, viewerRole);
      }
      if (text) {
        await api.sendMessage(ticketId, text, asAdmin);
      } else if (pendingFiles.length > 0) {
        const names = pendingFiles.map((f) => f.name).join(", ");
        await api.sendMessage(ticketId, `📎 ${names}`, asAdmin);
      }
      setReply("");
      setPendingFiles([]);
      await onRefresh();
      textareaRef.current?.focus();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) void handleSend();
    }
  };

  const canSend = !ticketClosed && !sending && (reply.trim().length > 0 || pendingFiles.length > 0);

  return (
    <section className="content-block chat-section">
      <h3 className="block-title">
        {viewerRole === "admin" ? "Переписка с сотрудником" : "Переписка"}
      </h3>

      {error && <div className="error-banner">{error}</div>}

      <div
        className={`chat-thread${dragOver ? " chat-thread-dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!ticketClosed) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="chat-messages" ref={scrollRef}>
          {timeline.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Сообщений пока нет"
              description={
                ticketClosed
                  ? "Переписка по этой заявке завершена."
                  : "Напишите первым или перетащите скриншот в область чата."
              }
            />
          ) : (
            timeline.map((item) => {
              if (item.kind === "message") {
                const m = item.data;
                const isOwn =
                  viewerRole === "admin" ? m.author_role === "admin" : m.author_role === "employee";
                const authorLabel =
                  m.author_role === "admin"
                    ? viewerRole === "admin"
                      ? "Вы"
                      : "Администратор"
                    : viewerRole === "employee"
                      ? "Вы"
                      : "Сотрудник";

                return (
                  <div
                    key={`msg-${m.id}`}
                    className={`chat-bubble-row chat-bubble-row-${isOwn ? "own" : "other"}`}
                  >
                    <div className={`chat-bubble chat-bubble-${m.author_role}`}>
                      <p className="chat-bubble-text">{m.body}</p>
                    </div>
                    <div className="chat-bubble-meta">
                      {authorLabel} · {formatMessageTime(m.created_at)}
                    </div>
                  </div>
                );
              }

              const att = item.data;
              const isOwn = item.side === viewerRole;

              return (
                <div
                  key={`att-${att.id}`}
                  className={`chat-bubble-row chat-bubble-row-${isOwn ? "own" : "other"}`}
                >
                  <div className={`chat-bubble chat-bubble-image chat-bubble-${item.side === "admin" ? "admin" : "employee"}`}>
                    <img
                      src={api.attachmentUrl(att.id)}
                      alt={att.filename}
                      className="chat-image"
                      loading="lazy"
                    />
                  </div>
                  <div className="chat-bubble-meta">
                    {isOwn ? "Вы" : item.side === "admin" ? "Администратор" : "Сотрудник"} ·{" "}
                    {formatMessageTime(att.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!ticketClosed && (
          <div className="chat-composer">
            {pendingFiles.length > 0 && (
              <div className="chat-pending-files">
                {pendingFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="chat-pending-thumb">
                    <img src={pendingPreviews[i]} alt={file.name} />
                    <button
                      type="button"
                      className="chat-pending-remove"
                      aria-label={`Убрать ${file.name}`}
                      onClick={() => removePending(i)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="chat-composer-row">
              <textarea
                ref={textareaRef}
                className="chat-input"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Написать сообщение… Enter — отправить, Shift+Enter — новая строка"
                rows={1}
                disabled={sending}
              />
              <button
                type="button"
                className="btn btn-primary chat-send-btn"
                disabled={!canSend}
                onClick={() => void handleSend()}
                aria-label="Отправить"
              >
                <Send size={18} strokeWidth={2} />
              </button>
            </div>

            <p className="chat-composer-hint">
              Перетащите изображение в чат или вставьте из буфера (Ctrl+V).{" "}
              {slotsLeft > 0
                ? `Можно прикрепить ещё ${slotsLeft - pendingFiles.length} из ${MAX_ATTACHMENTS}.`
                : "Лимит вложений достигнут."}
            </p>
          </div>
        )}

        {ticketClosed && (
          <p className="hint chat-closed-hint">Заявка закрыта — новые сообщения отправить нельзя.</p>
        )}

        {dragOver && !ticketClosed && (
          <div className="chat-drop-overlay" aria-hidden>
            Отпустите, чтобы прикрепить изображение
          </div>
        )}
      </div>
    </section>
  );
}
