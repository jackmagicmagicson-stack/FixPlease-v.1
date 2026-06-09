#[tokio::main]
async fn main() -> anyhow::Result<()> {
    fixplease_api::run().await
}
