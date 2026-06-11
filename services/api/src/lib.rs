mod attachments;
mod auth;
mod config;
mod error;
mod jobs;
mod models;
mod routes;
mod semver;
mod state;
mod stats;
mod tickets;
mod ws;

pub const DEFAULT_JWT_SECRET: &str = "change-me-in-production-use-long-secret";

use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub async fn run() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "fixplease_api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    tokio::fs::create_dir_all(&config.attachments_dir).await?;

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("../../migrations").run(&pool).await?;

    bootstrap_admin(
        &pool,
        config.bootstrap_admin_password.as_deref(),
        config.strict_config,
    )
    .await?;

    let events = ws::new_hub();
    jobs::spawn_background_jobs(pool.clone(), events.clone());

    let state = state::AppState::new(pool, config.clone(), events);
    let app = routes::router(state).layer(
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any),
    );

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!("listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn bootstrap_admin(
    pool: &sqlx::PgPool,
    password: Option<&str>,
    strict: bool,
) -> anyhow::Result<()> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM admins")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        let pwd = match password {
            Some(p) => p,
            None if strict => {
                anyhow::bail!("BOOTSTRAP_ADMIN_PASSWORD required to create initial admin");
            }
            None => "admin",
        };
        let hash = auth::hash_password(pwd).await?;
        sqlx::query("INSERT INTO admins (display_name, password_hash) VALUES ($1, $2)")
            .bind("Admin")
            .bind(hash)
            .execute(pool)
            .await?;
        tracing::info!("bootstrapped admin user");
    } else if let Some(pwd) = password {
        let hash = auth::hash_password(pwd).await?;
        sqlx::query(
            "UPDATE admins SET password_hash = $1 WHERE id = (SELECT id FROM admins ORDER BY created_at LIMIT 1)",
        )
        .bind(hash)
        .execute(pool)
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::attachments::is_allowed_mime;

    #[test]
    fn mime_whitelist() {
        assert!(is_allowed_mime("image/png"));
        assert!(is_allowed_mime("application/pdf"));
        assert!(!is_allowed_mime("application/x-executable"));
    }
}
