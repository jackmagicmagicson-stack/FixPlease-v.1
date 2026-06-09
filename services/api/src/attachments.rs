use std::path::Path;

use axum::body::Bytes;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    config::Config,
    error::{ApiError, ApiResult},
    models::Attachment,
    tickets::{count_attachments, get_ticket},
};

const ALLOWED_PREFIXES: &[&str] = &["image/", "application/pdf", "text/plain"];
const ALLOWED_EXACT: &[&str] = &[
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.ms-excel",
];

pub fn is_allowed_mime(mime: &str) -> bool {
    ALLOWED_PREFIXES.iter().any(|p| mime.starts_with(p))
        || ALLOWED_EXACT.contains(&mime)
}

pub async fn save_attachment(
    pool: &PgPool,
    config: &Config,
    ticket_id: Uuid,
    filename: String,
    mime_type: String,
    data: Bytes,
) -> ApiResult<Attachment> {
    if !is_allowed_mime(&mime_type) {
        return Err(ApiError::BadRequest(format!("mime type not allowed: {mime_type}")));
    }
    if data.len() as u64 > config.max_attachment_bytes {
        return Err(ApiError::BadRequest("file too large".into()));
    }

    let count = count_attachments(pool, ticket_id).await?;
    if count >= 3 {
        return Err(ApiError::BadRequest("maximum 3 attachments per ticket".into()));
    }

    let _ticket = get_ticket(pool, ticket_id).await?;
    tokio::fs::create_dir_all(&config.attachments_dir)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;

    let id = Uuid::new_v4();
    let safe_name = filename
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    let storage_path = config
        .attachments_dir
        .join(format!("{ticket_id}_{id}_{safe_name}"));
    tokio::fs::write(&storage_path, &data)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;

    let attachment = sqlx::query_as::<_, Attachment>(
        r#"
        INSERT INTO attachments (id, ticket_id, filename, mime_type, size_bytes, storage_path)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, ticket_id, filename, mime_type, size_bytes, created_at
        "#,
    )
    .bind(id)
    .bind(ticket_id)
    .bind(&filename)
    .bind(&mime_type)
    .bind(data.len() as i64)
    .bind(storage_path.to_string_lossy().as_ref())
    .fetch_one(pool)
    .await?;

    Ok(attachment)
}

pub async fn get_attachment(pool: &PgPool, id: Uuid) -> ApiResult<(Attachment, std::path::PathBuf)> {
    let row: (Uuid, Uuid, String, String, i64, String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
        "SELECT id, ticket_id, filename, mime_type, size_bytes, storage_path, created_at FROM attachments WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("attachment not found".into()))?;

    let attachment = Attachment {
        id: row.0,
        ticket_id: row.1,
        filename: row.2,
        mime_type: row.3,
        size_bytes: row.4,
        created_at: row.6,
    };
    Ok((attachment, Path::new(&row.5).to_path_buf()))
}
