use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{Path, Query, State, WebSocketUpgrade},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    attachments::{get_attachment, save_attachment},
    auth::{issue_token, verify_password, AdminAuth},
    error::{ApiError, ApiResult},
    semver,
    models::{
        AppSettings, AuthorRole, CategoryTemplate, CloseRequest, CreateCategoryRequest,
        CreateTicketRequest, LoginRequest, LoginResponse, MessageRequest, PurgeClosedRequest,
        PurgeClosedResponse, RejectRequest, TicketStatus, UpdateSettingsRequest,
        UpdateTicketRequest, UpsertTemplateRequest, VersionResponse,
    },
    stats::compute_stats,
    state::AppState,
    tickets::{
        add_message, close_ticket, create_category, create_ticket, delete_template, get_ticket,
        get_ticket_by_number, list_attachments, list_categories, list_messages, list_templates,
        list_tickets_admin, purge_closed_tickets, resolve_ticket, submit_ticket, take_ticket,
        update_ticket, upsert_template, TicketSort,
    },
    models::ClosureType,
    ws::handle_socket,
};

#[derive(Deserialize)]
pub struct TicketListQuery {
    pub status: Option<TicketStatus>,
    pub category_id: Option<Uuid>,
    /// importance (default) | newest | oldest
    pub sort: Option<String>,
}

#[derive(Deserialize)]
pub struct StatsQuery {
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    pub to: Option<chrono::DateTime<chrono::Utc>>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/version", get(version))
        .route("/v1/updater/{target}/{arch}/{current}", get(updater_manifest))
        .route("/v1/auth/login", post(login))
        .route("/v1/categories", get(list_categories_handler))
        .route("/v1/categories", post(create_category_handler))
        .route("/v1/categories/{id}/templates", get(list_templates_handler))
        .route("/v1/categories/{id}/templates", post(create_template_handler))
        .route("/v1/templates/{id}", delete(delete_template_handler))
        .route("/v1/tickets", get(list_tickets_handler))
        .route("/v1/tickets", post(create_ticket_handler))
        .route("/v1/tickets/purge-closed", post(purge_closed_handler))
        .route("/v1/tickets/by-number/{num}", get(get_ticket_by_number_handler))
        .route("/v1/tickets/{id}", get(get_ticket_handler))
        .route("/v1/tickets/{id}", put(update_ticket_handler))
        .route("/v1/tickets/{id}/submit", post(submit_ticket_handler))
        .route("/v1/tickets/{id}/take", post(take_ticket_handler))
        .route("/v1/tickets/{id}/resolve", post(resolve_ticket_handler))
        .route("/v1/tickets/{id}/close", post(close_ticket_handler))
        .route("/v1/tickets/{id}/reject", post(reject_ticket_handler))
        .route("/v1/tickets/{id}/messages", get(list_messages_handler))
        .route("/v1/tickets/{id}/messages", post(employee_message_handler))
        .route("/v1/tickets/{id}/messages/admin", post(admin_message_handler))
        .route("/v1/tickets/{id}/attachments", get(list_attachments_handler))
        .route("/v1/tickets/{id}/attachments", post(upload_attachment_handler))
        .route("/v1/attachments/{id}", get(download_attachment_handler))
        .route("/v1/settings", get(get_settings_handler))
        .route("/v1/settings", put(update_settings_handler))
        .route("/v1/stats", get(stats_handler))
        .route("/v1/ws", get(ws_handler))
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}

const SETTINGS_SELECT: &str = "SELECT escalation_minutes, quiet_hours_start, quiet_hours_end, min_client_version, retention_days, client_update_version, client_update_url, client_update_signature FROM app_settings WHERE id = 1";

async fn updater_manifest(
    State(state): State<AppState>,
    Path((target, arch, current)): Path<(String, String, String)>,
) -> Result<impl IntoResponse, ApiError> {
    let settings: AppSettings = sqlx::query_as(SETTINGS_SELECT)
        .fetch_one(&state.db)
        .await?;

    let update_version = match settings.client_update_version {
        Some(ref v) if !v.is_empty() => v.clone(),
        _ => return Ok(StatusCode::NO_CONTENT.into_response()),
    };

    let url = match settings.client_update_url {
        Some(ref u) if !u.is_empty() => u.clone(),
        _ => return Ok(StatusCode::NO_CONTENT.into_response()),
    };

    let signature = match settings.client_update_signature {
        Some(ref s) if !s.is_empty() => s.clone(),
        _ => return Ok(StatusCode::NO_CONTENT.into_response()),
    };

    if semver::compare(&current, &update_version) >= 0 {
        return Ok(StatusCode::NO_CONTENT.into_response());
    }

    let platform_key = format!("{target}-{arch}");
    Ok(Json(serde_json::json!({
        "version": update_version,
        "notes": "FixPlease update",
        "pub_date": chrono::Utc::now().to_rfc3339(),
        "platforms": {
            platform_key: {
                "signature": signature,
                "url": url
            }
        }
    }))
    .into_response())
}

async fn version(State(state): State<AppState>) -> ApiResult<Json<VersionResponse>> {
    let settings: AppSettings = sqlx::query_as(SETTINGS_SELECT)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(VersionResponse {
        min_client_version: settings.min_client_version,
        api_version: env!("CARGO_PKG_VERSION").into(),
    }))
}

async fn login(State(state): State<AppState>, Json(req): Json<LoginRequest>) -> ApiResult<Json<LoginResponse>> {
    let admin: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, display_name, password_hash FROM admins ORDER BY created_at LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await?;

    let (id, name, hash) = admin.ok_or_else(|| ApiError::Unauthorized("no admin configured".into()))?;
    if !verify_password(&hash, &req.password).await {
        return Err(ApiError::Unauthorized("invalid password".into()));
    }
    let token = issue_token(&state, id, &name)?;
    Ok(Json(LoginResponse {
        token,
        admin_id: id,
        display_name: name,
    }))
}

async fn list_categories_handler(State(state): State<AppState>) -> ApiResult<impl IntoResponse> {
    Ok(Json(list_categories(&state.db).await?))
}

async fn create_category_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Json(req): Json<CreateCategoryRequest>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(create_category(&state.db, &req.name).await?))
}

async fn list_templates_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(list_templates(&state.db, id).await?))
}

async fn create_template_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Path(id): Path<Uuid>,
    Json(req): Json<UpsertTemplateRequest>,
) -> ApiResult<Json<CategoryTemplate>> {
    Ok(Json(
        upsert_template(
            &state.db,
            id,
            &req.title,
            &req.body,
            req.sort_order.unwrap_or(0),
        )
        .await?,
    ))
}

async fn delete_template_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Path(id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    delete_template(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn list_tickets_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Query(q): Query<TicketListQuery>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(
        list_tickets_admin(
            &state.db,
            q.status,
            q.category_id,
            TicketSort::from_query(q.sort.as_deref()),
        )
        .await?,
    ))
}

async fn create_ticket_handler(
    State(state): State<AppState>,
    Json(req): Json<CreateTicketRequest>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(
        create_ticket(&state.db, &state.events, req).await?,
    ))
}

async fn purge_closed_handler(
    State(state): State<AppState>,
    AdminAuth(claims): AdminAuth,
    Json(req): Json<PurgeClosedRequest>,
) -> ApiResult<Json<PurgeClosedResponse>> {
    let mine_only = req.mine_only.unwrap_or(false);
    let deleted = purge_closed_tickets(&state.db, claims.sub, mine_only).await?;
    Ok(Json(PurgeClosedResponse { deleted }))
}

async fn get_ticket_handler(State(state): State<AppState>, Path(id): Path<Uuid>) -> ApiResult<impl IntoResponse> {
    Ok(Json(get_ticket(&state.db, id).await?))
}

async fn get_ticket_by_number_handler(
    State(state): State<AppState>,
    Path(num): Path<i64>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(get_ticket_by_number(&state.db, num).await?))
}

async fn update_ticket_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTicketRequest>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(update_ticket(&state.db, &state.events, id, req).await?))
}

async fn submit_ticket_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(submit_ticket(&state.db, &state.events, id).await?))
}

async fn take_ticket_handler(
    State(state): State<AppState>,
    AdminAuth(claims): AdminAuth,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(
        take_ticket(&state.db, &state.events, id, claims.sub).await?,
    ))
}

async fn resolve_ticket_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(resolve_ticket(&state.db, &state.events, id).await?))
}

async fn close_ticket_handler(
    State(state): State<AppState>,
    AdminAuth(claims): AdminAuth,
    Path(id): Path<Uuid>,
    Json(req): Json<CloseRequest>,
) -> ApiResult<impl IntoResponse> {
    let ticket = get_ticket(&state.db, id).await?;
    let closure_type = if ticket.status == TicketStatus::Resolved {
        ClosureType::Normal
    } else {
        ClosureType::Forced
    };
    Ok(Json(
        close_ticket(
            &state.db,
            &state.events,
            id,
            closure_type,
            req.reason,
            Some(claims.sub),
        )
        .await?,
    ))
}

async fn reject_ticket_handler(
    State(state): State<AppState>,
    AdminAuth(claims): AdminAuth,
    Path(id): Path<Uuid>,
    Json(req): Json<RejectRequest>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(
        close_ticket(
            &state.db,
            &state.events,
            id,
            ClosureType::Rejected,
            Some(req.reason),
            Some(claims.sub),
        )
        .await?,
    ))
}

async fn list_messages_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(list_messages(&state.db, id).await?))
}

async fn employee_message_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<MessageRequest>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(
        add_message(
            &state.db,
            &state.events,
            id,
            AuthorRole::Employee,
            None,
            &req.body,
        )
        .await?,
    ))
}

async fn admin_message_handler(
    State(state): State<AppState>,
    AdminAuth(claims): AdminAuth,
    Path(id): Path<Uuid>,
    Json(req): Json<MessageRequest>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(
        add_message(
            &state.db,
            &state.events,
            id,
            AuthorRole::Admin,
            Some(claims.sub),
            &req.body,
        )
        .await?,
    ))
}

async fn list_attachments_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(list_attachments(&state.db, id).await?))
}

async fn upload_attachment_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: axum::http::HeaderMap,
    body: Bytes,
) -> ApiResult<impl IntoResponse> {
    let filename = headers
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("file.bin")
        .to_string();
    let mime = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    Ok(Json(
        save_attachment(&state.db, &state.config, id, filename, mime, body).await?,
    ))
}

async fn download_attachment_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let (attachment, path) = get_attachment(&state.db, id).await?;
    let data = tokio::fs::read(&path)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok((
        [
            (header::CONTENT_TYPE, attachment.mime_type),
            (
                header::CONTENT_DISPOSITION,
                format!("inline; filename=\"{}\"", attachment.filename),
            ),
        ],
        data,
    ))
}

async fn get_settings_handler(State(state): State<AppState>) -> ApiResult<Json<AppSettings>> {
    let settings = sqlx::query_as(SETTINGS_SELECT)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(settings))
}

async fn update_settings_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Json(req): Json<UpdateSettingsRequest>,
) -> ApiResult<Json<AppSettings>> {
    sqlx::query(
        r#"
        UPDATE app_settings SET
            escalation_minutes = COALESCE($1, escalation_minutes),
            min_client_version = COALESCE($2, min_client_version),
            client_update_version = COALESCE($3, client_update_version),
            client_update_url = COALESCE($4, client_update_url),
            client_update_signature = COALESCE($5, client_update_signature),
            updated_at = NOW()
        WHERE id = 1
        "#,
    )
    .bind(req.escalation_minutes)
    .bind(req.min_client_version)
    .bind(req.client_update_version)
    .bind(req.client_update_url)
    .bind(req.client_update_signature)
    .execute(&state.db)
    .await?;

    get_settings_handler(State(state)).await
}

async fn stats_handler(
    State(state): State<AppState>,
    AdminAuth(_): AdminAuth,
    Query(q): Query<StatsQuery>,
) -> ApiResult<impl IntoResponse> {
    Ok(Json(compute_stats(&state.db, q.from, q.to).await?))
}

async fn ws_handler(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let events = Arc::clone(&state.events);
    ws.on_upgrade(move |socket| handle_socket(socket, events))
}
