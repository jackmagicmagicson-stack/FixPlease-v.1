use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use tokio::sync::broadcast;

use crate::models::WsEvent;

pub type EventSender = broadcast::Sender<String>;

pub fn new_hub() -> EventSender {
    broadcast::channel(1024).0
}

pub fn publish(sender: &EventSender, event: &WsEvent) {
    if let Ok(json) = serde_json::to_string(event) {
        let _ = sender.send(json);
    }
}

pub async fn handle_socket(socket: WebSocket, sender: Arc<EventSender>) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let mut sub = sender.subscribe();

    let mut send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                msg = sub.recv() => {
                    match msg {
                        Ok(payload) => {
                            if ws_tx.send(Message::Text(payload.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    }
                }
                ping = ws_rx.next() => {
                    match ping {
                        Some(Ok(Message::Ping(p))) => {
                            if ws_tx.send(Message::Pong(p)).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(Message::Close(_))) | None => break,
                        _ => {}
                    }
                }
            }
        }
    });

    send_task.await.ok();
}
