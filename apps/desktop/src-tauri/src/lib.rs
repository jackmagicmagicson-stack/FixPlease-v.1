use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_updater::UpdaterExt;
use tokio_tungstenite::Connector;
use url::Url;

fn websocket_plugin() -> impl tauri::plugin::Plugin<tauri::Wry> {
    let tls = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .expect("websocket tls connector");
    tauri_plugin_websocket::Builder::new()
        .tls_connector(Connector::NativeTls(tls))
        .build()
}

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

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(windows)]
fn ensure_ca_installed(app: &AppHandle) {
    let Ok(res_dir) = app.path().resource_dir() else {
        return;
    };
    let ca = res_dir.join("certs").join("fixplease-ca.cer");
    if !ca.is_file() {
        return;
    }
    let check = std::process::Command::new("certutil")
        .args(["-store", "Root"])
        .output();
    if let Ok(out) = check {
        let text = String::from_utf8_lossy(&out.stdout);
        if text.contains("FixPlease LAN CA") {
            return;
        }
    }
    let Some(path) = ca.to_str() else {
        return;
    };
    let _ = std::process::Command::new("certutil")
        .args(["-addstore", "-f", "Root", path])
        .status();
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
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(websocket_plugin())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(windows)]
            ensure_ca_installed(app.handle());
            let show_item = MenuItem::with_id(app, "show", "Показать FixPlease", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Завершить", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let icon = app.default_window_icon().expect("missing app icon").clone();

            let app_handle = app.handle().clone();
            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("FixPlease")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let hide_handle = app_handle.clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        hide_main_window(&hide_handle);
                        api.prevent_close();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![check_and_install_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
