use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiResult},
    models::{
        Attachment, AuthorRole, Category, CategoryTemplate, ClosureType, CreateTicketRequest,
        Ticket, TicketMessage, TicketStatus, UpdateTicketRequest, WsEvent,
    },
    ws::{publish, EventSender},
};

pub async fn list_categories(pool: &PgPool) -> ApiResult<Vec<Category>> {
    sqlx::query_as::<_, Category>("SELECT * FROM categories ORDER BY sort_order, name")
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn list_templates(pool: &PgPool, category_id: Uuid) -> ApiResult<Vec<CategoryTemplate>> {
    sqlx::query_as::<_, CategoryTemplate>(
        "SELECT * FROM category_templates WHERE category_id = $1 ORDER BY sort_order, title",
    )
    .bind(category_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_ticket(pool: &PgPool, id: Uuid) -> ApiResult<Ticket> {
    sqlx::query_as::<_, Ticket>("SELECT * FROM tickets WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("ticket not found".into()))
}

pub async fn get_ticket_by_number(pool: &PgPool, public_number: i64) -> ApiResult<Ticket> {
    sqlx::query_as::<_, Ticket>("SELECT * FROM tickets WHERE public_number = $1")
        .bind(public_number)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("ticket not found".into()))
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum TicketSort {
    #[default]
    Importance,
    Newest,
    Oldest,
}

impl TicketSort {
    pub fn from_query(value: Option<&str>) -> Self {
        match value {
            Some("newest") => Self::Newest,
            Some("oldest") => Self::Oldest,
            _ => Self::Importance,
        }
    }
}

/// Уровень важности: 0 — критично, 3 — обычная.
pub fn importance_rank(ticket: &Ticket) -> u8 {
    match (ticket.is_escalated, ticket.is_priority) {
        (true, true) => 0,
        (true, false) => 1,
        (false, true) => 2,
        (false, false) => 3,
    }
}

fn sort_tickets(tickets: &mut [Ticket], sort: TicketSort) {
    tickets.sort_by(|a, b| {
        match sort {
            TicketSort::Importance => importance_rank(a)
                .cmp(&importance_rank(b))
                .then_with(|| a.submitted_at.cmp(&b.submitted_at))
                .then_with(|| a.created_at.cmp(&b.created_at))
                .then_with(|| a.public_number.cmp(&b.public_number)),
            TicketSort::Newest => b
                .submitted_at
                .cmp(&a.submitted_at)
                .then_with(|| b.created_at.cmp(&a.created_at))
                .then_with(|| b.public_number.cmp(&a.public_number)),
            TicketSort::Oldest => a
                .submitted_at
                .cmp(&b.submitted_at)
                .then_with(|| a.created_at.cmp(&b.created_at))
                .then_with(|| a.public_number.cmp(&b.public_number)),
        }
    });
}

pub async fn list_tickets_admin(
    pool: &PgPool,
    status: Option<TicketStatus>,
    category_id: Option<Uuid>,
    sort: TicketSort,
) -> ApiResult<Vec<Ticket>> {
    let mut tickets = sqlx::query_as::<_, Ticket>("SELECT * FROM tickets")
        .fetch_all(pool)
        .await?;

    if let Some(s) = status {
        tickets.retain(|t| t.status == s);
    }
    if let Some(c) = category_id {
        tickets.retain(|t| t.category_id == c);
    }
    sort_tickets(&mut tickets, sort);
    Ok(tickets)
}

async fn category_allows_priority(pool: &PgPool, category_id: Uuid) -> ApiResult<bool> {
    let row: (bool,) = sqlx::query_as("SELECT allows_priority FROM categories WHERE id = $1")
        .bind(category_id)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

pub async fn create_ticket(
    pool: &PgPool,
    events: &EventSender,
    req: CreateTicketRequest,
) -> ApiResult<Ticket> {
    if req.row_label.trim().is_empty() || req.desk_label.trim().is_empty() {
        return Err(ApiError::BadRequest("row and desk are required".into()));
    }
    let is_draft = req.save_as_draft.unwrap_or(false);
    let category_id = match req.category_id {
        Some(id) => id,
        None if is_draft => {
            let row: Option<(Uuid,)> =
                sqlx::query_as("SELECT id FROM categories ORDER BY sort_order, name LIMIT 1")
                    .fetch_optional(pool)
                    .await?;
            row.map(|r| r.0).ok_or_else(|| {
                ApiError::BadRequest("no categories configured".into())
            })?
        }
        None => return Err(ApiError::BadRequest("category is required".into())),
    };
    let is_priority = category_allows_priority(pool, category_id).await?;
    let status = if is_draft {
        TicketStatus::Draft
    } else {
        TicketStatus::New
    };
    let now = Utc::now();
    let submitted_at = if status == TicketStatus::New {
        Some(now)
    } else {
        None
    };

    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        INSERT INTO tickets (row_label, desk_label, category_id, description, status, is_priority, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(req.row_label.trim())
    .bind(req.desk_label.trim())
    .bind(category_id)
    .bind(req.description)
    .bind(&status)
    .bind(is_priority)
    .bind(submitted_at)
    .fetch_one(pool)
    .await?;

    if status == TicketStatus::New {
        publish(events, &WsEvent::TicketCreated { ticket: ticket.clone() });
    }
    Ok(ticket)
}

pub async fn update_ticket(
    pool: &PgPool,
    events: &EventSender,
    id: Uuid,
    req: UpdateTicketRequest,
) -> ApiResult<Ticket> {
    let mut ticket = get_ticket(pool, id).await?;
    if ticket.status != TicketStatus::Draft {
        return Err(ApiError::BadRequest("only draft tickets can be edited".into()));
    }
    if let Some(v) = req.row_label {
        ticket.row_label = v.trim().to_string();
    }
    if let Some(v) = req.desk_label {
        ticket.desk_label = v.trim().to_string();
    }
    if let Some(v) = req.category_id {
        ticket.category_id = v;
        ticket.is_priority = category_allows_priority(pool, v).await?;
    }
    if let Some(v) = req.description {
        ticket.description = v;
    }

    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets SET row_label = $2, desk_label = $3, category_id = $4, description = $5, is_priority = $6
        WHERE id = $1 RETURNING *
        "#,
    )
    .bind(id)
    .bind(&ticket.row_label)
    .bind(&ticket.desk_label)
    .bind(ticket.category_id)
    .bind(&ticket.description)
    .bind(ticket.is_priority)
    .fetch_one(pool)
    .await?;

    publish(events, &WsEvent::TicketUpdated { ticket: ticket.clone() });
    Ok(ticket)
}

pub async fn submit_ticket(pool: &PgPool, events: &EventSender, id: Uuid) -> ApiResult<Ticket> {
    let ticket = get_ticket(pool, id).await?;
    if ticket.status != TicketStatus::Draft {
        return Err(ApiError::BadRequest("ticket is not a draft".into()));
    }
    let now = Utc::now();
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets SET status = 'new', submitted_at = $2
        WHERE id = $1 AND status = 'draft'
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(now)
    .fetch_one(pool)
    .await?;

    publish(events, &WsEvent::TicketCreated { ticket: ticket.clone() });
    Ok(ticket)
}

pub async fn take_ticket(
    pool: &PgPool,
    events: &EventSender,
    id: Uuid,
    admin_id: Uuid,
) -> ApiResult<Ticket> {
    let now = Utc::now();
    let result = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets
        SET status = 'in_progress', assigned_admin_id = $2,
            first_response_at = COALESCE(first_response_at, $3)
        WHERE id = $1 AND status = 'new' AND assigned_admin_id IS NULL
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(admin_id)
    .bind(now)
    .fetch_optional(pool)
    .await?;

    match result {
        Some(ticket) => {
            publish(events, &WsEvent::TicketUpdated { ticket: ticket.clone() });
            Ok(ticket)
        }
        None => {
            let existing = get_ticket(pool, id).await?;
            if existing.status == TicketStatus::InProgress {
                return Err(ApiError::Conflict("ticket already taken".into()));
            }
            Err(ApiError::Conflict("cannot take ticket".into()))
        }
    }
}

pub async fn resolve_ticket(pool: &PgPool, events: &EventSender, id: Uuid) -> ApiResult<Ticket> {
    let now = Utc::now();
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets SET status = 'resolved', resolved_at = $2
        WHERE id = $1 AND status = 'in_progress'
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(now)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::BadRequest("cannot resolve ticket".into()))?;

    publish(events, &WsEvent::TicketUpdated { ticket: ticket.clone() });
    Ok(ticket)
}

pub async fn close_ticket(
    pool: &PgPool,
    events: &EventSender,
    id: Uuid,
    closure_type: ClosureType,
    reason: Option<String>,
    admin_id: Option<Uuid>,
) -> ApiResult<Ticket> {
    if closure_type == ClosureType::Rejected {
        let r = reason.as_deref().unwrap_or("").trim();
        if r.is_empty() {
            return Err(ApiError::BadRequest("rejection reason required".into()));
        }
    }
    let now = Utc::now();
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets
        SET status = 'closed', closure_type = $2, closure_reason = $3, closed_at = $4,
            assigned_admin_id = COALESCE(assigned_admin_id, $5),
            is_escalated = FALSE,
            resolved_at = COALESCE(resolved_at, CASE WHEN $2::text = 'normal' THEN $4 ELSE resolved_at END)
        WHERE id = $1 AND status != 'closed'
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&closure_type)
    .bind(reason)
    .bind(now)
    .bind(admin_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::BadRequest("ticket already closed or not found".into()))?;

    publish(events, &WsEvent::TicketUpdated { ticket: ticket.clone() });
    Ok(ticket)
}

pub async fn list_messages(pool: &PgPool, ticket_id: Uuid) -> ApiResult<Vec<TicketMessage>> {
    sqlx::query_as::<_, TicketMessage>(
        "SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at",
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn add_message(
    pool: &PgPool,
    events: &EventSender,
    ticket_id: Uuid,
    role: AuthorRole,
    admin_id: Option<Uuid>,
    body: &str,
) -> ApiResult<TicketMessage> {
    if body.trim().is_empty() {
        return Err(ApiError::BadRequest("message body required".into()));
    }
    let ticket = get_ticket(pool, ticket_id).await?;
    if ticket.status == TicketStatus::Closed {
        return Err(ApiError::BadRequest("ticket is closed".into()));
    }

    let msg = sqlx::query_as::<_, TicketMessage>(
        r#"
        INSERT INTO ticket_messages (ticket_id, author_role, author_admin_id, body)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(ticket_id)
    .bind(&role)
    .bind(admin_id)
    .bind(body.trim())
    .fetch_one(pool)
    .await?;

    if role == AuthorRole::Admin && ticket.first_response_at.is_none() {
        let _ = sqlx::query(
            "UPDATE tickets SET first_response_at = NOW() WHERE id = $1 AND first_response_at IS NULL",
        )
        .bind(ticket_id)
        .execute(pool)
        .await;
    }

    publish(
        events,
        &WsEvent::MessageCreated {
            message: msg.clone(),
        },
    );
    Ok(msg)
}

pub async fn list_attachments(pool: &PgPool, ticket_id: Uuid) -> ApiResult<Vec<Attachment>> {
    sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE ticket_id = $1 ORDER BY created_at")
        .bind(ticket_id)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn count_attachments(pool: &PgPool, ticket_id: Uuid) -> ApiResult<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM attachments WHERE ticket_id = $1")
        .bind(ticket_id)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

pub async fn create_category(pool: &PgPool, name: &str) -> ApiResult<Category> {
    let name = name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    sqlx::query_as::<_, Category>(
        "INSERT INTO categories (name, sort_order) VALUES ($1, (SELECT COALESCE(MAX(sort_order),0)+1 FROM categories)) RETURNING *",
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db) = &e {
            if db.constraint().is_some() {
                return ApiError::Conflict("category already exists".into());
            }
        }
        ApiError::Internal(e.into())
    })
}

pub async fn upsert_template(
    pool: &PgPool,
    category_id: Uuid,
    title: &str,
    body: &str,
    sort_order: i32,
) -> ApiResult<CategoryTemplate> {
    sqlx::query_as::<_, CategoryTemplate>(
        r#"
        INSERT INTO category_templates (category_id, title, body, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(category_id)
    .bind(title)
    .bind(body)
    .bind(sort_order)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

#[cfg(test)]
mod sort_tests {
    use super::*;
    use chrono::Utc;

    fn ticket(escalated: bool, priority: bool, mins_ago: i64) -> Ticket {
        let now = Utc::now();
        Ticket {
            id: Uuid::new_v4(),
            public_number: mins_ago,
            row_label: "r".into(),
            desk_label: "d".into(),
            category_id: Uuid::new_v4(),
            description: String::new(),
            status: TicketStatus::New,
            closure_type: None,
            closure_reason: None,
            assigned_admin_id: None,
            is_priority: priority,
            is_escalated: escalated,
            created_at: now,
            submitted_at: Some(now - chrono::Duration::minutes(mins_ago)),
            first_response_at: None,
            resolved_at: None,
            closed_at: None,
        }
    }

    #[test]
    fn importance_order() {
        let mut list = vec![
            ticket(false, false, 1),
            ticket(true, false, 5),
            ticket(false, true, 3),
            ticket(true, true, 10),
        ];
        sort_tickets(&mut list, TicketSort::Importance);
        assert_eq!(importance_rank(&list[0]), 0);
        assert_eq!(importance_rank(&list[1]), 1);
        assert_eq!(importance_rank(&list[2]), 2);
        assert_eq!(importance_rank(&list[3]), 3);
    }
}

/// Удаляет закрытые заявки: по умолчанию только назначенные текущему админу.
pub async fn purge_closed_tickets(
    pool: &PgPool,
    admin_id: Uuid,
    mine_only: bool,
) -> ApiResult<u64> {
    let ids: Vec<Uuid> = if mine_only {
        sqlx::query_scalar(
            "SELECT id FROM tickets WHERE status = 'closed' AND assigned_admin_id = $1",
        )
        .bind(admin_id)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_scalar("SELECT id FROM tickets WHERE status = 'closed'")
            .fetch_all(pool)
            .await?
    };

    if ids.is_empty() {
        return Ok(0);
    }

    let paths: Vec<(String,)> = sqlx::query_as(
        "SELECT storage_path FROM attachments WHERE ticket_id = ANY($1)",
    )
    .bind(&ids)
    .fetch_all(pool)
    .await?;

    for (path,) in paths {
        let _ = tokio::fs::remove_file(&path).await;
    }

    let result = sqlx::query("DELETE FROM tickets WHERE id = ANY($1)")
        .bind(&ids)
        .execute(pool)
        .await?;

    Ok(result.rows_affected())
}

pub async fn delete_template(pool: &PgPool, id: Uuid) -> ApiResult<()> {
    let r = sqlx::query("DELETE FROM category_templates WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound("template not found".into()));
    }
    Ok(())
}
