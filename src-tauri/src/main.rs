// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    if env::consts::OS == "linux" {
        // hack to set PERL5LIB for exiftool
        env::set_var("PERL5LIB", "/usr/lib/media-metadata-cleaner_exiftool:lib:bin/lib");
    }
    media_metadata_cleaner_lib::run()
}
