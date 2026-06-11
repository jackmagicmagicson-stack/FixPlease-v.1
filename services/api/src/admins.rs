use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth,
    error::{ApiError, ApiResult},
    models::{CreateAdminRequest, UpdateAdminRequest},
};

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct AdminUser {
    pub id: Uuid,
    pub display_name: String,
    pub is_super_admin: bool,
    pub created_at: DateTime<Utc>,
}

pub async fn get_admin_profile(pool: &PgPool, admin_id: Uuid) -> ApiResult<AdminUser> {
    sqlx::query_as::<_, AdminUser>(
        "SELECT id, display_name, is_super_admin, created_at FROM admins WHERE id = $1",
    )
    .bind(admin_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("admin not found".into()))
}

pub async fn is_super_admin(pool: &PgPool, admin_id: Uuid) -> ApiResult<bool> {
    let row: Option<(bool,)> =
        sqlx::query_as("SELECT is_super_admin FROM admins WHERE id = $1")
            .bind(admin_id)
            .fetch_optional(pool)
            .await?;
    row.map(|r| r.0)
        .ok_or_else(|| ApiError::NotFound("admin not found".into()))
}

pub async fn list_admins(pool: &PgPool) -> ApiResult<Vec<AdminUser>> {
    sqlx::query_as::<_, AdminUser>(
        "SELECT id, display_name, is_super_admin, created_at FROM admins ORDER BY is_super_admin DESC, display_name",
    )
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn create_admin(pool: &PgPool, req: CreateAdminRequest) -> ApiResult<AdminUser> {
    let name = req.display_name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("имя обязательно".into()));
    }
    if req.password.trim().len() < 4 {
        return Err(ApiError::BadRequest("пароль не короче 4 символов".into()));
    }
    let hash = auth::hash_password(req.password.trim()).await?;
    sqlx::query_as::<_, AdminUser>(
        r#"
        INSERT INTO admins (display_name, password_hash, is_super_admin)
        VALUES ($1, $2, FALSE)
        RETURNING id, display_name, is_super_admin, created_at
        "#,
    )
    .bind(name)
    .bind(hash)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db) = &e {
            if db.constraint() == Some("idx_admins_display_name_unique") {
                return ApiError::Conflict("администратор с таким именем уже есть".into());
            }
        }
        ApiError::from(e)
    })
}

pub async fn update_admin(
    pool: &PgPool,
    id: Uuid,
    req: UpdateAdminRequest,
) -> ApiResult<AdminUser> {
    let existing = get_admin_profile(pool, id).await?;

    let name = match req.display_name {
        Some(n) => {
            let trimmed = n.trim();
            if trimmed.is_empty() {
                return Err(ApiError::BadRequest("имя обязательно".into()));
            }
            trimmed.to_string()
        }
        None => existing.display_name,
    };

    let hash = if let Some(pwd) = req.password {
        let trimmed = pwd.trim();
        if trimmed.len() < 4 {
            return Err(ApiError::BadRequest("пароль не короче 4 символов".into()));
        }
        Some(auth::hash_password(trimmed).await?)
    } else {
        None
    };

    if let Some(h) = hash {
        sqlx::query_as::<_, AdminUser>(
            r#"
            UPDATE admins SET display_name = $2, password_hash = $3
            WHERE id = $1
            RETURNING id, display_name, is_super_admin, created_at
            "#,
        )
        .bind(id)
        .bind(&name)
        .bind(h)
        .fetch_one(pool)
        .await
    } else {
        sqlx::query_as::<_, AdminUser>(
            r#"
            UPDATE admins SET display_name = $2
            WHERE id = $1
            RETURNING id, display_name, is_super_admin, created_at
            "#,
        )
        .bind(id)
        .bind(&name)
        .fetch_one(pool)
        .await
    }
    .map_err(|e| {
        if let sqlx::Error::Database(db) = &e {
            if db.constraint() == Some("idx_admins_display_name_unique") {
                return ApiError::Conflict("администратор с таким именем уже есть".into());
            }
        }
        ApiError::from(e)
    })
}

pub async fn delete_admin(pool: &PgPool, id: Uuid, actor_id: Uuid) -> ApiResult<()> {
    if id == actor_id {
        return Err(ApiError::BadRequest("нельзя удалить свою учётку".into()));
    }
    let target = get_admin_profile(pool, id).await?;
    if target.is_super_admin {
        return Err(ApiError::BadRequest("нельзя удалить главного администратора".into()));
    }
    let deleted = sqlx::query("DELETE FROM admins WHERE id = $1 AND is_super_admin = FALSE")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(ApiError::NotFound("admin not found".into()));
    }
    Ok(())
}

pub async fn find_admin_for_login(
    pool: &PgPool,
    display_name: &str,
) -> ApiResult<(Uuid, String, String, bool)> {
    let name = display_name.trim();
    if name.is_empty() {
        return Err(ApiError::Unauthorized("invalid credentials".into()));
    }
    let row: Option<(Uuid, String, String, bool)> = sqlx::query_as(
        "SELECT id, display_name, password_hash, is_super_admin FROM admins WHERE display_name = $1",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?;
    row.ok_or_else(|| ApiError::Unauthorized("invalid credentials".into()))
}
