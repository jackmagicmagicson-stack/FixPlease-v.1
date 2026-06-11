use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

#[tauri::command]
async fn check_and_install_update(app: AppHandle, server_url: String) -> Result<String, String> {
    let base = server_url.trim_end_matches('/');
    let endpoint = Url::parse(&format!(
        "{base}/v1/updater/{{{{target}}}}/{{{{arch}}}}/{{{{current_version}}}}"
    ))
    .map_err(|e| e.to_string())?;

    let update = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(update) = update {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }

    Ok("Установлена последняя версия.".into())
}

fn ensure_lan_no_proxy() {
    const LAN: &str = "192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.1,localhost,<local>";
    for key in ["NO_PROXY", "no_proxy"] {
        match std::env::var(key) {
            Ok(existing) if !existing.is_empty() => {
                if !existing.contains("192.168.0.0/16") {
                    std::env::set_var(key, format!("{existing},{LAN}"));
                }
            }
            _ => std::env::set_var(key, LAN),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_lan_no_proxy();
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![check_and_install_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
