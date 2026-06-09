#[sqlx::test(migrations = "../../migrations")]
async fn seed_categories_exist(pool: sqlx::PgPool) -> sqlx::Result<()> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
        .fetch_one(&pool)
        .await?;
    assert!(count.0 >= 7);
    Ok(())
}
