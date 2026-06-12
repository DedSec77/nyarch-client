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
    // ── Linux / WebKitGTK compatibility ──────────────────────────────────
    // WebKitGTK is the only WebView on Linux and is fragile in two ways:
    //   * Native Wayland (especially NVIDIA + wlroots compositors like
    //     Hyprland/Sway) crashes the DMABUF renderer and/or stutters badly.
    //   * Inside an AppImage its sandboxed web process often fails to start
    //     (white screen), because bubblewrap can't find its helpers.
    // The fix that actually works on NVIDIA+Hyprland is to run the WebView
    // through XWayland (GDK_BACKEND=x11) with the DMABUF renderer off, and to
    // disable the WebKit sandbox when running from an AppImage.
    // Everything is overridable: if the user already exported a value we keep
    // it, so power users with working GPU compositing aren't forced onto the
    // compatibility path.
    #[cfg(target_os = "linux")]
    {
        let set_default = |k: &str, v: &str| {
            if std::env::var_os(k).is_none() {
                std::env::set_var(k, v);
            }
        };

        // Force the more reliable rendering path on Wayland/NVIDIA.
        let is_wayland = std::env::var_os("WAYLAND_DISPLAY").is_some()
            || std::env::var("XDG_SESSION_TYPE")
                .map(|v| v.eq_ignore_ascii_case("wayland"))
                .unwrap_or(false);
        if is_wayland {
            // Route the WebView through XWayland — WebKitGTK is far more stable
            // there on NVIDIA than on native Wayland. (The native window can
            // stay Wayland; this only affects the GTK/WebKit backend.)
            set_default("GDK_BACKEND", "x11");
        }
        // Avoid the DMABUF crash + GBM buffer failures (required on NVIDIA).
        set_default("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        // Reduce scroll/animation stutter when GPU compositing misbehaves.
        set_default("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

        // Inside an AppImage the WebKit sandbox usually can't start its helper
        // process -> white screen. Detect the AppImage runtime and turn it off.
        if std::env::var_os("APPIMAGE").is_some() {
            set_default("WEBKIT_FORCE_SANDBOX", "0");
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
