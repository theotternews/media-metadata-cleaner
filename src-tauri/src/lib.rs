use base64::Engine;
use std::fs;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn read_file(path: &str) -> (i32, String, String) {
    println!("read_file: {}", path);
    match fs::read(path) {
        Ok(data) => (
            0,
            String::new(),
            base64::engine::general_purpose::STANDARD.encode(&data),
        ),
        Err(e) => (1, e.to_string(), String::new()),
    }
}

#[tauri::command]
fn write_file(path: &str, data: &[u8]) -> (i32, String) {
    println!("write_file: {} -> {}", path, data.len());
    match fs::write(path, data) {
        Ok(()) => (0, String::new()),
        Err(e) => (1, e.to_string()),
    }
}

#[tauri::command]
fn copy_file(src: &str, dst: &str) -> (i32, String) {
    println!("copy_file: {} -> {}", src, dst);
    match fs::copy(src, dst) {
        Ok(bytes) => (0, format!("Copied {} bytes", bytes)),
        Err(e) => (1, e.to_string()),
    }
}

include!(concat!(env!("OUT_DIR"), "/git_urls.rs"));

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .menu(|handle| {
            let quit = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;
            let file = Submenu::with_items(handle, "File", true, &[&quit])?;

            let report = MenuItem::with_id(handle, "report_problem", "Report a Problem", true, None::<&str>)?;
            let homepage = MenuItem::with_id(handle, "homepage", "Homepage", true, None::<&str>)?;
            let help = Submenu::with_items(handle, "Help", true, &[&report, &homepage])?;

            Menu::with_items(handle, &[&file, &help])
        })
        .setup(|app| {
            app.on_menu_event(|app_handle, event| {
                match event.id().0.as_str() {
                    "quit" => {
                        app_handle.exit(0);
                    }
                    "report_problem" => {
                        let _ = app_handle.opener().open_url(ISSUES_URL, None::<&str>);
                    }
                    "homepage" => {
                        let _ = app_handle.opener().open_url(HOMEPAGE_URL, None::<&str>);
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, write_file, copy_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
