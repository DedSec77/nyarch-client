// nyarch desktop shell (Tauri 2).
// The frontend is the same React/Vite SPA used on the web; this wraps it in a
// native window using the system WebView (WebKitGTK on Linux, WebView2 on Windows).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running nyarch");
}
