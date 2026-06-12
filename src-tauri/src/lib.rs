// nyarch desktop shell (Tauri 2).
// The frontend is the same React/Vite SPA used on the web; this wraps it in a
// native window using the system WebView (WebKitGTK on Linux, WebView2 on Windows).

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
        .run(tauri::generate_context!())
        .expect("error while running nyarch");
}
