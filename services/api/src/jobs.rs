use chrono::Utc;
use sqlx::PgPool;
use tracing::info;

use crate::{
    models::{Ticket, WsEvent},
    ws::{publish, EventSender},
};

pub async fn run_escalation(pool: &PgPool, events: &EventSender) {
    let settings: (i32,) = match sqlx::query_as("SELECT escalation_minutes FROM app_settings WHERE id = 1")
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("escalation settings: {e}");
            return;
        }
    };

    let minutes = settings.0;
    let tickets = match sqlx::query_as::<_, Ticket>(
        r#"
        SELECT * FROM tickets
        WHERE status = 'new' AND is_escalated = FALSE
          AND submitted_at IS NOT NULL
          AND submitted_at < NOW() - ($1 || ' minutes')::interval
        "#,
    )
    .bind(minutes)
    .fetch_all(pool)
    .await
    {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!("escalation query: {e}");
            return;
        }
    };

    for ticket in tickets {
        let updated = sqlx::query_as::<_, Ticket>(
            "UPDATE tickets SET is_escalated = TRUE WHERE id = $1 RETURNING *",
        )
        .bind(ticket.id)
        .fetch_optional(pool)
        .await;

        if let Ok(Some(t)) = updated {
            publish(
                events,
                &WsEvent::TicketEscalated {
                    ticket_id: t.id,
                    public_number: t.public_number,
                },
            );
            info!("escalated ticket #{}", t.public_number);
        }
    }
}

pub async fn run_retention(pool: &PgPool, attachments_dir: &std::path::Path) {
    let settings: (i32,) = match sqlx::query_as("SELECT retention_days FROM app_settings WHERE id = 1")
        .fetch_one(pool)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("retention settings: {e}");
            return;
        }
    };

    let cutoff = Utc::now() - chrono::Duration::days(settings.0 as i64);

    let paths: Vec<(String,)> = match sqlx::query_as(
        r#"
        SELECT a.storage_path FROM attachments a
        JOIN tickets t ON t.id = a.ticket_id
        WHERE t.created_at < $1
        "#,
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await
    {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("retention paths: {e}");
            return;
        }
    };

    for (path,) in &paths {
        let _ = tokio::fs::remove_file(path).await;
    }

    if let Err(e) = sqlx::query(
        r#"
        DELETE FROM tickets WHERE created_at < $1
        "#,
    )
    .bind(cutoff)
    .execute(pool)
    .await
    {
        tracing::warn!("retention delete tickets: {e}");
    } else {
        info!("retention purge before {cutoff}");
    }

    let _ = attachments_dir;
}

pub fn spawn_background_jobs(pool: PgPool, events: EventSender, attachments_dir: std::path::PathBuf) {
    let pool_esc = pool.clone();
    let events_esc = events.clone();
    tokio::spawn(async move {
        loop {
            run_escalation(&pool_esc, &events_esc).await;
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    });

    let pool2 = pool;
    let dir = attachments_dir.clone();
    tokio::spawn(async move {
        loop {
            run_retention(&pool2, &dir).await;
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        }
    });
}
