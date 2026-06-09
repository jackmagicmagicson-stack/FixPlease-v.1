use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::{
    error::ApiResult,
    models::{AdminStat, CategoryStat, StatsResponse},
};

pub async fn compute_stats(
    pool: &PgPool,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
) -> ApiResult<StatsResponse> {
    let from = from.unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
    let to = to.unwrap_or_else(Utc::now);

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tickets WHERE created_at >= $1 AND created_at <= $2",
    )
    .bind(from)
    .bind(to)
    .fetch_one(pool)
    .await?;

    let open: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tickets WHERE created_at >= $1 AND created_at <= $2 AND status NOT IN ('closed')",
    )
    .bind(from)
    .bind(to)
    .fetch_one(pool)
    .await?;

    let closed: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tickets WHERE created_at >= $1 AND created_at <= $2 AND status = 'closed'",
    )
    .bind(from)
    .bind(to)
    .fetch_one(pool)
    .await?;

    let avg: Option<(Option<f64>,)> = sqlx::query_as(
        r#"
        SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - submitted_at)) / 60.0)
        FROM tickets
        WHERE created_at >= $1 AND created_at <= $2 AND first_response_at IS NOT NULL
        "#,
    )
    .bind(from)
    .bind(to)
    .fetch_optional(pool)
    .await?;

    let by_category = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT c.name, COUNT(t.id)
        FROM tickets t
        JOIN categories c ON c.id = t.category_id
        WHERE t.created_at >= $1 AND t.created_at <= $2
        GROUP BY c.name
        ORDER BY COUNT(t.id) DESC
        "#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|(category_name, count)| CategoryStat {
        category_name,
        count,
    })
    .collect();

    let by_admin = sqlx::query_as::<_, (String, i64, i64)>(
        r#"
        SELECT COALESCE(a.display_name, 'Unassigned'),
               COUNT(*) FILTER (WHERE t.assigned_admin_id = a.id),
               COUNT(*) FILTER (WHERE t.assigned_admin_id = a.id AND t.status = 'closed')
        FROM admins a
        LEFT JOIN tickets t ON t.assigned_admin_id = a.id AND t.created_at >= $1 AND t.created_at <= $2
        GROUP BY a.id, a.display_name
        "#,
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|(admin_name, assigned_count, closed_count)| AdminStat {
        admin_name,
        assigned_count,
        closed_count,
    })
    .collect();

    let close_rate = if total.0 > 0 {
        (closed.0 as f64 / total.0 as f64) * 100.0
    } else {
        0.0
    };

    Ok(StatsResponse {
        total_tickets: total.0,
        open_tickets: open.0,
        closed_tickets: closed.0,
        avg_first_response_minutes: avg.and_then(|a| a.0),
        by_category,
        by_admin,
        close_rate_percent: close_rate,
    })
}
