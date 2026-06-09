import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { getLastTicketId, getLastTicketNumber } from "../notify";
import { subscribe } from "../ws";
import { ticketStatusLabel } from "../statusLabels";
import type { Attachment, Ticket, TicketMessage } from "../types";

export function TrackTicket() {
  const [number, setNumber] = useState(getLastTicketNumber() || "");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (idOrNum?: { id?: string; num?: number }) => {
    setError("");
    try {
      let t: Ticket;
      if (idOrNum?.id) t = await api.ticket(idOrNum.id);
      else if (idOrNum?.num) t = await api.ticketByNumber(idOrNum.num);
      else if (!number.trim()) throw new Error("Введите номер заявки");
      else t = await api.ticketByNumber(parseInt(number, 10));
      setTicket(t);
      setMessages(await api.messages(t.id));
      setAttachments(await api.attachments(t.id));
    } catch (e) {
      setError(String(e));
      setTicket(null);
    }
  }, [number]);

  useEffect(() => {
    const last = getLastTicketId();
    if (last) load({ id: last });
  }, [load]);

  useEffect(() => {
    return subscribe((ev) => {
      if (!ticket) return;
      if (
        (ev.type === "ticket_updated" && ev.ticket.id === ticket.id) ||
        (ev.type === "message_created" && ev.message.ticket_id === ticket.id)
      ) {
        load({ id: ticket.id });
      }
    });
  }, [ticket, load]);

  const sendReply = async () => {
    if (!ticket || !reply.trim()) return;
    try {
      const msg = await api.sendMessage(ticket.id, reply);
      setMessages((m) => [...m, msg]);
      setReply("");
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="card">
      <h2>Статус заявки</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          placeholder="Номер заявки"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <button className="btn btn-primary" onClick={() => load()}>
          Найти
        </button>
        {getLastTicketId() && (
          <button className="btn" onClick={() => load({ id: getLastTicketId()! })}>
            Последняя заявка
          </button>
        )}
      </div>
      {!ticket && !error && <div className="empty">Введите номер или откройте последнюю заявку</div>}
      {ticket && (
        <>
          <p>
            <strong>#{ticket.public_number}</strong>{" "}
            <span className={`status-${ticket.status}`}>{ticketStatusLabel(ticket)}</span>
            {ticket.is_priority && <span className="badge priority">приоритет</span>}
          </p>
          <p>
            {ticket.row_label}, {ticket.desk_label}
          </p>
          <p>{ticket.description}</p>
          {ticket.closure_reason && (
            <p>
              <em>{ticket.closure_reason}</em>
            </p>
          )}
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className="message">
                <div className="meta">
                  {m.author_role === "admin" ? "Администратор" : "Вы"} —{" "}
                  {new Date(m.created_at).toLocaleString()}
                </div>
                {m.body}
              </div>
            ))}
          </div>
          {ticket.status !== "closed" && (
            <div className="toolbar">
              <input
                style={{ flex: 1 }}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Ответить..."
              />
              <button className="btn btn-primary" onClick={sendReply}>
                Отправить
              </button>
            </div>
          )}
          {attachments.length > 0 && (
            <div>
              <h4>Вложения</h4>
              {attachments.map((a) =>
                a.mime_type.startsWith("image/") ? (
                  <img key={a.id} className="preview-img" src={api.attachmentUrl(a.id)} alt={a.filename} />
                ) : (
                  <p key={a.id}>
                    <a href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer">
                      {a.filename}
                    </a>
                  </p>
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
