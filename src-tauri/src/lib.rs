// nyarch desktop shell (Tauri 2).
// The frontend is the same React/Vite SPA used on the web; this wraps it in a
// native window using the system WebView (WebKitGTK on Linux, WebView2 on Windows).
//
// Background behaviour:
//   * The app installs a system-tray icon.
//   * Closing the window HIDES it to the tray instead of quitting, so the
//     realtime notification subscription keeps running and native push
//     notifications can still fire while the window is closed.
//   * Left-click the tray icon (or the "Show nyarch" menu item) to reopen the
//     window; "Quit" exits the app for real.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;

// Tracks whether we've already told the user the app keeps running in the tray.
static HINTED_TRAY: AtomicBool = AtomicBool::new(false);

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // On Wayland compositors built on wlroots (Hyprland, Sway, river, ...),
    // WebKitGTK's DMABUF renderer can fail with "Error 71 (Protocol error)"
    // or "Failed to create GBM buffer". Disabling it falls back to a renderer
    // that works everywhere. Only set it if the user has not chosen a value.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // ── system tray ──────────────────────────────────────────
            let show_item = MenuItem::with_id(app, "show", "Show nyarch", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("nyarch")
                .menu(&menu)
                // Show the menu only on right-click; left-click reopens the window.
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
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

            Ok(())
        })
        // Closing the window hides it to the tray instead of quitting, so the
        // notification subscription keeps running in the background.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();

                // First time only: let the user know we're still running.
                if !HINTED_TRAY.swap(true, Ordering::Relaxed) {
                    let _ = window
                        .app_handle()
                        .notification()
                        .builder()
                        .title("nyarch is still running")
                        .body("Closed to the tray — you'll still get notifications. Right-click the tray icon to quit.")
                        .show();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running nyarch");
}
