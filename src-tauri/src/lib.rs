mod commands;

use tauri::menu::{Menu, MenuItem, Submenu};
use tauri_plugin_opener::OpenerExt;

include!(concat!(env!("OUT_DIR"), "/git_urls.rs"));

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .menu(|handle| {
            let quit = MenuItem::with_id(handle, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
            let file = Submenu::with_items(handle, "File", true, &[&quit])?;

            let report = MenuItem::with_id(handle, "report_problem", "Report a Problem", true, None::<&str>)?;
            let homepage = MenuItem::with_id(handle, "homepage", "Homepage", true, None::<&str>)?;
            let help = Submenu::with_items(handle, "Help", true, &[&report, &homepage])?;

            Menu::with_items(handle, &[&file, &help])
        })
        .setup(|app| {
            app.on_menu_event(|app_handle, event| match event.id().0.as_str() {
                "quit" => app_handle.exit(0),
                "report_problem" => { let _ = app_handle.opener().open_url(ISSUES_URL, None::<&str>); }
                "homepage" => { let _ = app_handle.opener().open_url(HOMEPAGE_URL, None::<&str>); }
                _ => {}
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            commands::copy_file,
            commands::remove_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
