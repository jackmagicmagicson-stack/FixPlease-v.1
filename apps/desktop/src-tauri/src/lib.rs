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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![check_and_install_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
