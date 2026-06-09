use axum::{
    extract::FromRequestParts,
    http::request::Parts,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::ApiError, state::AppState};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: usize,
    pub name: String,
}

pub fn issue_token(state: &AppState, admin_id: Uuid, name: &str) -> Result<String, ApiError> {
    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(12))
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("time overflow")))?
        .timestamp() as usize;
    let claims = Claims {
        sub: admin_id,
        exp,
        name: name.to_string(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(e.into()))
}

pub fn verify_token(state: &AppState, token: &str) -> Result<Claims, ApiError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map(|d| d.claims)
    .map_err(|_| ApiError::Unauthorized("invalid token".into()))
}

pub struct AdminAuth(pub Claims);

impl FromRequestParts<AppState> for AdminAuth {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(|| ApiError::Unauthorized("missing bearer token".into()))?;
        let claims = verify_token(state, auth)?;
        Ok(AdminAuth(claims))
    }
}

pub async fn hash_password(password: &str) -> anyhow::Result<String> {
    use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};
    use argon2::Argon2;
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| anyhow::anyhow!(e))
}

pub async fn verify_password(hash: &str, password: &str) -> bool {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    use argon2::Argon2;
    PasswordHash::new(hash)
        .ok()
        .and_then(|h| Argon2::default().verify_password(password.as_bytes(), &h).ok())
        .is_some()
}
