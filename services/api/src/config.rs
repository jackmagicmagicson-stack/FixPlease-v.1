use std::path::PathBuf;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub jwt_secret: String,
    pub attachments_dir: PathBuf,
    pub max_attachment_bytes: u64,
    pub bootstrap_admin_password: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://fixplease:fixplease@localhost:5432/fixplease".into()),
            bind_addr: std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "change-me-in-production-use-long-secret".into()),
            attachments_dir: PathBuf::from(
                std::env::var("ATTACHMENTS_DIR").unwrap_or_else(|_| "./data/attachments".into()),
            ),
            max_attachment_bytes: std::env::var("MAX_ATTACHMENT_BYTES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(10 * 1024 * 1024),
            bootstrap_admin_password: std::env::var("BOOTSTRAP_ADMIN_PASSWORD").ok(),
        })
    }
}
