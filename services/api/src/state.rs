use std::sync::Arc;

use sqlx::PgPool;

use crate::{config::Config, ws::EventSender};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub events: Arc<EventSender>,
}

impl AppState {
    pub fn new(db: PgPool, config: Config, events: EventSender) -> Self {
        Self {
            db,
            config: Arc::new(config),
            events: Arc::new(events),
        }
    }
}
