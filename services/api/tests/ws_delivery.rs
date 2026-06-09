//! Integration test: ticket submit notifies via WebSocket within 1 second.

use futures::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[tokio::test]
#[ignore = "requires running API and DB: DATABASE_URL=... cargo test --test ws_delivery -- --ignored"]
async fn ticket_created_within_one_second() {
    let base = std::env::var("TEST_API_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into());
    let ws_url = base.replace("http://", "ws://").replace("https://", "wss://") + "/v1/ws";

    let categories: serde_json::Value = reqwest::get(format!("{base}/v1/categories"))
        .await
        .expect("categories")
        .json()
        .await
        .expect("json");
    let cat_id = categories[0]["id"].as_str().expect("category id");

    let (mut ws, _) = connect_async(&ws_url).await.expect("ws connect");
    let start = std::time::Instant::now();

    let client = reqwest::Client::new();
    let ticket: serde_json::Value = client
        .post(format!("{base}/v1/tickets"))
        .json(&json!({
            "row_label": "1 ряд",
            "desk_label": "1 стол",
            "category_id": cat_id,
            "description": "integration test",
            "save_as_draft": false
        }))
        .send()
        .await
        .expect("create")
        .json()
        .await
        .expect("ticket json");

    let ticket_id = ticket["id"].as_str().unwrap();

    while start.elapsed().as_secs() < 2 {
        if let Some(Ok(Message::Text(text))) = ws.next().await {
            let ev: serde_json::Value = serde_json::from_str(&text).unwrap();
            if ev["type"] == "ticket_created" && ev["ticket"]["id"] == ticket_id {
                assert!(
                    start.elapsed().as_millis() < 1000,
                    "WS event took {:?}",
                    start.elapsed()
                );
                return;
            }
        }
    }
    panic!("no ticket_created event within 2s");
}
