// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::consts::OS == "linux" {
        // SAFETY: called in main before any threads are spawned
        unsafe {
            std::env::set_var("PERL5LIB", "/usr/lib/media-metadata-cleaner_exiftool:lib:bin/lib");
        }
    }
    media_metadata_cleaner_lib::run();
}
