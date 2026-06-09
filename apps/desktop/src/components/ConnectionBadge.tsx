interface Props {
  ok: boolean;
}

export function ConnectionBadge({ ok }: Props) {
  return (
    <span className={`connection-badge ${ok ? "ok" : "bad"}`} title={ok ? "Сервер доступен" : "Нет связи с сервером"}>
      <span className="connection-dot" />
      {ok ? "Сервер" : "Нет связи"}
    </span>
  );
}
