use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "ticket_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    Draft,
    New,
    InProgress,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "closure_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ClosureType {
    Normal,
    Rejected,
    Forced,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "author_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AuthorRole {
    Employee,
    Admin,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub sort_order: i32,
    pub is_system: bool,
    pub allows_priority: bool,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CategoryTemplate {
    pub id: Uuid,
    pub category_id: Uuid,
    pub title: String,
    pub body: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub public_number: i64,
    pub row_label: String,
    pub desk_label: String,
    pub category_id: Uuid,
    pub description: String,
    pub status: TicketStatus,
    pub closure_type: Option<ClosureType>,
    pub closure_reason: Option<String>,
    pub assigned_admin_id: Option<Uuid>,
    pub is_priority: bool,
    pub is_escalated: bool,
    pub created_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub first_response_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TicketMessage {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub author_role: AuthorRole,
    pub author_admin_id: Option<Uuid>,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AppSettings {
    pub escalation_minutes: i32,
    pub quiet_hours_start: Option<chrono::NaiveTime>,
    pub quiet_hours_end: Option<chrono::NaiveTime>,
    pub min_client_version: String,
    pub retention_days: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateTicketRequest {
    pub row_label: String,
    pub desk_label: String,
    pub category_id: Uuid,
    pub description: String,
    pub save_as_draft: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketRequest {
    pub row_label: Option<String>,
    pub desk_label: Option<String>,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RejectRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CloseRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PurgeClosedRequest {
    /// true — только заявки, закрытые этим админом (assigned_admin_id)
    pub mine_only: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct PurgeClosedResponse {
    pub deleted: u64,
}

#[derive(Debug, Deserialize)]
pub struct MessageRequest {
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub admin_id: Uuid,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertTemplateRequest {
    pub title: String,
    pub body: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub escalation_minutes: Option<i32>,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
    pub min_client_version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VersionResponse {
    pub min_client_version: String,
    pub api_version: String,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total_tickets: i64,
    pub open_tickets: i64,
    pub closed_tickets: i64,
    pub avg_first_response_minutes: Option<f64>,
    pub by_category: Vec<CategoryStat>,
    pub by_admin: Vec<AdminStat>,
    pub close_rate_percent: f64,
}

#[derive(Debug, Serialize)]
pub struct CategoryStat {
    pub category_name: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct AdminStat {
    pub admin_name: String,
    pub assigned_count: i64,
    pub closed_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsEvent {
    TicketCreated { ticket: Ticket },
    TicketUpdated { ticket: Ticket },
    MessageCreated { message: TicketMessage },
    TicketEscalated { ticket_id: Uuid, public_number: i64 },
}
