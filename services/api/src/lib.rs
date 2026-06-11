mod admins;
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

const WORKER_ADMINS: &[(&str, &str)] = &[
    ("Админ 1", "admin1"),
    ("Админ 2", "admin2"),
    ("Админ 3", "admin3"),
];

async fn seed_worker_admins(pool: &sqlx::PgPool) -> anyhow::Result<()> {
    let workers: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM admins WHERE is_super_admin = FALSE")
            .fetch_one(pool)
            .await?;
    if workers.0 > 0 {
        return Ok(());
    }
    for (name, pwd) in WORKER_ADMINS {
        let hash = auth::hash_password(pwd).await?;
        sqlx::query(
            "INSERT INTO admins (display_name, password_hash, is_super_admin) VALUES ($1, $2, FALSE)",
        )
        .bind(*name)
        .bind(hash)
        .execute(pool)
        .await?;
        tracing::info!("bootstrapped worker admin: {name}");
    }
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
        sqlx::query(
            "INSERT INTO admins (display_name, password_hash, is_super_admin) VALUES ($1, $2, TRUE)",
        )
        .bind("Главный администратор")
        .bind(hash)
        .execute(pool)
        .await?;
        tracing::info!("bootstrapped super admin");
        seed_worker_admins(pool).await?;
    } else {
        if let Some(pwd) = password {
            let hash = auth::hash_password(pwd).await?;
            sqlx::query(
                "UPDATE admins SET password_hash = $1 WHERE is_super_admin = TRUE",
            )
            .bind(hash)
            .execute(pool)
            .await?;
        }
        seed_worker_admins(pool).await?;
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
